import { enforceRateLimit, requireUser, sendApiError } from './_security.js';
import { reportOperationalError } from './_monitoring.js';
import { getServerEnv } from './_env.js';

const responseCache = new Map();
const CACHE_TTL_MS = 60 * 60 * 1000;
const SAFE_STATUSES = new Set(['Verified', 'Corroborated']);

const text = (value) => value == null ? '' : String(value).trim();
const number = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};
const normalizeSearchText = (value) => text(value).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

export function matchesEquipmentSearch(item, query = '') {
  const queryTokens = normalizeSearchText(query).split(' ').filter(Boolean);
  const candidateTokens = normalizeSearchText([item?.make, item?.model, item?.serial_number].filter(Boolean).join(' ')).split(' ').filter(Boolean);
  return queryTokens.length > 0 && candidateTokens.length > 0 && queryTokens.every((queryToken) =>
    candidateTokens.some((candidateToken) => candidateToken === queryToken || (queryToken.length >= 3 && candidateToken.startsWith(queryToken)))
  );
}

function cleanUrl(value) {
  try {
    const url = new URL(text(value));
    return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
  } catch { return ''; }
}

function allowedSourceUrls(payload) {
  const values = [...(Array.isArray(payload?.citations) ? payload.citations : []), ...(Array.isArray(payload?.search_results) ? payload.search_results : [])];
  return new Set(values.map((entry) => cleanUrl(typeof entry === 'string' ? entry : entry?.url)).filter(Boolean));
}

function specsAgree(a, b) {
  const values = [number(a?.operating_weight_lbs), number(b?.operating_weight_lbs), number(a?.width_in), number(b?.width_in), number(a?.height_in), number(b?.height_in)];
  if (!values.every(Boolean)) return false;
  const [weightA, weightB, widthA, widthB, heightA, heightB] = values;
  return Math.abs(weightA - weightB) / Math.max(weightA, weightB) <= 0.02 && Math.abs(widthA - widthB) <= 1 && Math.abs(heightA - heightB) <= 1;
}

export function deriveVerificationStatus(evidence = []) {
  const complete = evidence.filter((source) => cleanUrl(source?.url) && number(source?.operating_weight_lbs) && number(source?.width_in) && number(source?.height_in));
  if (!complete.length) return 'Unverified';
  if (complete.some((source, index) => complete.slice(index + 1).some((other) => !specsAgree(source, other)))) return 'Conflict';
  if (complete.some((source) => source?.is_manufacturer === true)) return 'Verified';
  if (complete.length >= 2) return 'Corroborated';
  return 'Unverified';
}

function parseJson(value) {
  try { return JSON.parse(text(value).replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim()); }
  catch { return { results: [] }; }
}

export function normalizeSourcedResults(payload, query = '') {
  const parsed = typeof payload?.choices?.[0]?.message?.content === 'string' ? parseJson(payload.choices[0].message.content) : payload;
  const allowedUrls = allowedSourceUrls(payload);
  return (Array.isArray(parsed?.results) ? parsed.results : []).map((item, index) => {
    const evidence = (Array.isArray(item?.evidence) ? item.evidence : []).map((source) => ({
      url: cleanUrl(source?.url), title: text(source?.title), publisher: text(source?.publisher),
      is_manufacturer: source?.is_manufacturer === true,
      operating_weight_lbs: number(source?.operating_weight_lbs), width_in: number(source?.width_in), height_in: number(source?.height_in),
    })).filter((source) => source.url && allowedUrls.has(source.url));
    const primary = evidence[0] || {};
    const result = {
      id: `web-${index}-${normalizeSearchText(`${item?.make}-${item?.model}`)}`,
      make: text(item?.make), model: text(item?.model), configuration: text(item?.configuration) || null,
      serial_number: text(item?.serial_number) || null,
      operating_weight_lbs: number(item?.operating_weight_lbs) || primary.operating_weight_lbs || null,
      width_in: number(item?.width_in) || primary.width_in || null,
      height_in: number(item?.height_in) || primary.height_in || null,
      verification_status: deriveVerificationStatus(evidence), sources: evidence, source: 'web',
      retrieved_at: new Date().toISOString(), weight_type: 'operating',
    };
    result.width_ft = result.width_in ? Number((result.width_in / 12).toFixed(1)) : null;
    result.height_ft = result.height_in ? Number((result.height_in / 12).toFixed(1)) : null;
    return result;
  }).filter((item) => item.make && item.model && matchesEquipmentSearch(item, query)).slice(0, 3);
}

async function persistSafeResults(results, admin, companyId) {
  for (const item of results.filter((result) => SAFE_STATUSES.has(result.verification_status))) {
    const candidate = {
      company_id: companyId, make: item.make, model: item.model, configuration: item.configuration,
      serial_number: item.serial_number, operating_weight_lbs: item.operating_weight_lbs,
      width_in: item.width_in, height_in: item.height_in, width_ft: item.width_ft, height_ft: item.height_ft,
      source: 'web', sources: item.sources, verification_status: item.verification_status,
      retrieved_at: item.retrieved_at, weight_type: 'operating',
    };
    const { data: existing } = await admin.from('equipment_specs').select('id').eq('company_id', companyId).ilike('make', item.make).ilike('model', item.model).limit(1);
    if (existing?.[0]?.id) await admin.from('equipment_specs').update(candidate).eq('id', existing[0].id);
    else await admin.from('equipment_specs').insert(candidate);
  }
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const rawQuery = text(req.query?.query);
    if (!rawQuery) return res.status(200).json({ results: [], source: '' });
    if (rawQuery.length < 2 || rawQuery.length > 80) return res.status(400).json({ error: 'Search must be 2 to 80 characters.' });
    const query = rawQuery.replace(/[,%()]/g, ' ').replace(/\s+/g, ' ').trim();
    const { admin, profile } = await requireUser(req);
    await enforceRateLimit(admin, `equipment-search:${profile.id}`, { limit: 120, windowMs: 60 * 60 * 1000 });
    const cacheKey = `${profile.company_id}:${query.toLowerCase()}`;
    const cached = responseCache.get(cacheKey);
    if (cached?.expiresAt > Date.now()) return res.status(200).json(cached.payload);

    const tokens = normalizeSearchText(query).split(' ').filter(Boolean).slice(0, 6);
    let dbQuery = admin.from('equipment_specs').select('*').or(`company_id.is.null,company_id.eq.${profile.company_id}`);
    for (const token of tokens) dbQuery = dbQuery.or(`make.ilike.%${token}%,model.ilike.%${token}%,serial_number.ilike.%${token}%`);
    const { data: stored, error: storedError } = await dbQuery.limit(8);
    if (!storedError && stored?.length) {
      const payload = { results: stored, source: 'database', error: '' };
      responseCache.set(cacheKey, { payload, expiresAt: Date.now() + CACHE_TTL_MS });
      return res.status(200).json(payload);
    }

    await enforceRateLimit(admin, `ai-gateway:${profile.id}`, { limit: 30, windowMs: 24 * 60 * 60 * 1000 });
    const oidcHeader = typeof req.headers?.get === 'function' ? req.headers.get('x-vercel-oidc-token') : req.headers?.['x-vercel-oidc-token'];
    const gatewayToken = getServerEnv('AI_GATEWAY_API_KEY') || getServerEnv('VERCEL_OIDC_TOKEN') || text(Array.isArray(oidcHeader) ? oidcHeader[0] : oidcHeader);
    if (!gatewayToken) return res.status(200).json({ results: [], source: '', error: 'Equipment search authentication is unavailable.' });

    const gatewayResponse = await fetch('https://ai-gateway.vercel.sh/v1/chat/completions', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${gatewayToken}` },
      signal: AbortSignal.timeout(45000),
      body: JSON.stringify({
        model: getServerEnv('EQUIPMENT_SEARCH_MODEL') || 'perplexity/sonar-pro', stream: false,
        messages: [
          { role: 'system', content: 'Search the live web for exact heavy-equipment specifications. Never estimate or merge configurations. Prefer the manufacturer product page or manufacturer PDF. Report operating weight, not shipping weight, plus transport width and transport height for one exact configuration. Every evidence URL must be a page you actually searched. If sources disagree, preserve each source value.' },
          { role: 'user', content: `Research "${query}". Return JSON only: {"results":[{"make":"","model":"","configuration":null,"serial_number":null,"operating_weight_lbs":0,"width_in":0,"height_in":0,"evidence":[{"url":"https://...","title":"","publisher":"","is_manufacturer":false,"operating_weight_lbs":0,"width_in":0,"height_in":0}]}]}. Return no more than 3 exact matches and an empty results array if reliable dimensions and operating weight cannot be found.` },
        ],
      }),
    });
    if (!gatewayResponse.ok) throw new Error(`AI Gateway request failed (${gatewayResponse.status}).`);
    const results = normalizeSourcedResults(await gatewayResponse.json(), query);
    await persistSafeResults(results, admin, profile.company_id);
    const payload = { results, source: results.length ? 'web' : '', error: results.length ? '' : 'No sourced exact-model specifications found.' };
    responseCache.set(cacheKey, { payload, expiresAt: Date.now() + CACHE_TTL_MS });
    return res.status(200).json(payload);
  } catch (error) {
    void reportOperationalError(error, { event: 'provider_failure', route: '/api/searchEquipment', provider: 'ai-gateway' });
    return sendApiError(res, error, 'Equipment search failed.', { route: '/api/searchEquipment', provider: 'ai-gateway' });
  }
}
