import { enforceRateLimit, requireUser, sendApiError } from './_security.js';
import { reportOperationalError } from './_monitoring.js';
import { getServerEnv } from './_env.js';

const responseCache = new Map();
const CACHE_TTL_MS = 60 * 60 * 1000;
const SAFE_STATUSES = new Set(['Verified']);
const BRAND_ALIASES = new Map([
  ['cat', 'caterpillar'], ['caterpillar', 'caterpillar'],
  ['deere', 'john deere'], ['johndeere', 'john deere'],
  ['caseih', 'case ih'], ['newholland', 'new holland'],
]);

const text = (value) => value == null ? '' : String(value).trim();
const number = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};
export const normalizeSearchText = (value) => text(value).toLowerCase()
  .replace(/([a-z])([0-9])/g, '$1 $2').replace(/([0-9])([a-z])/g, '$1 $2')
  .replace(/[^a-z0-9]+/g, ' ').trim();

export function deFuzzEquipmentQuery(value = '') {
  const tokens = normalizeSearchText(value).split(' ').filter(Boolean)
    .filter((token) => !/^(?:19|20)\d{2}$/.test(token));
  const normalized = tokens.join(' ');
  for (const [alias, canonical] of BRAND_ALIASES) {
    if (normalized.startsWith(`${alias} `) || normalized === alias) {
      return `${canonical}${normalized.slice(alias.length)}`.trim();
    }
  }
  return normalized;
}

function searchTokenGroups(value = '') {
  return deFuzzEquipmentQuery(value).split(' ').filter(Boolean).slice(0, 6).map((token) => {
    const aliases = [...BRAND_ALIASES.entries()]
      .filter(([, canonical]) => canonical.split(' ').includes(token))
      .map(([alias]) => alias);
    return [...new Set([token, ...aliases])];
  });
}

function specNumber(item, field) {
  const aliases = {
    operating_weight_lbs: ['operating_weight_lbs'],
    width_in: ['transport_width_in', 'width_in', 'width_inches'],
    height_in: ['transport_height_in', 'height_in', 'height_inches'],
  };
  return number(aliases[field].map((key) => item?.[key]).find((value) => number(value)));
}

function hasCompleteSpecs(item) {
  return Boolean(specNumber(item, 'operating_weight_lbs') && specNumber(item, 'width_in') && specNumber(item, 'height_in'));
}

export function matchesEquipmentSearch(item, query = '') {
  const queryTokens = deFuzzEquipmentQuery(query).split(' ').filter(Boolean);
  const candidateTokens = deFuzzEquipmentQuery([item?.make, item?.model, item?.serial_number].filter(Boolean).join(' ')).split(' ').filter(Boolean);
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
  const values = [specNumber(a, 'operating_weight_lbs'), specNumber(b, 'operating_weight_lbs'), specNumber(a, 'width_in'), specNumber(b, 'width_in'), specNumber(a, 'height_in'), specNumber(b, 'height_in')];
  if (!values.every(Boolean)) return false;
  const [weightA, weightB, widthA, widthB, heightA, heightB] = values;
  return Math.abs(weightA - weightB) / Math.max(weightA, weightB) <= 0.02 && Math.abs(widthA - widthB) <= 1 && Math.abs(heightA - heightB) <= 1;
}

export function deriveVerificationStatus(evidence = []) {
  const complete = evidence.filter((source) => cleanUrl(source?.url) && hasCompleteSpecs(source));
  if (!complete.length) return 'Unverified';
  if (complete.some((source) => source?.is_manufacturer === true)) return 'Verified';
  if (complete.some((source, index) => complete.slice(index + 1).some((other) => !specsAgree(source, other)))) return 'Conflict';
  if (complete.length >= 2) return 'Unverified';
  return 'Unverified';
}

function hasReliableWebEvidence(evidence = []) {
  const complete = evidence.filter((source) => cleanUrl(source?.url) && hasCompleteSpecs(source));
  return complete.some((source) => source.is_manufacturer) || complete.length >= 2 && deriveVerificationStatus(complete) !== 'Conflict';
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
      operating_weight_lbs: specNumber(source, 'operating_weight_lbs'), width_in: specNumber(source, 'width_in'), height_in: specNumber(source, 'height_in'),
    })).filter((source) => source.url && allowedUrls.has(source.url));
    const primary = evidence.find((source) => source.is_manufacturer) || evidence[0] || {};
    const result = {
      id: `web-${index}-${normalizeSearchText(`${item?.make}-${item?.model}`)}`,
      make: text(item?.make), model: text(item?.model), configuration: text(item?.configuration) || null,
      serial_number: text(item?.serial_number) || null,
      operating_weight_lbs: primary.operating_weight_lbs || null,
      width_in: primary.width_in || null,
      height_in: primary.height_in || null,
      verification_status: deriveVerificationStatus(evidence), sources: evidence, source: 'web',
      retrieved_at: new Date().toISOString(), weight_type: 'operating',
    };
    result.transport_width_in = result.width_in;
    result.transport_height_in = result.height_in;
    result.width_ft = result.width_in ? Number((result.width_in / 12).toFixed(1)) : null;
    result.height_ft = result.height_in ? Number((result.height_in / 12).toFixed(1)) : null;
    return result;
  }).filter((item) => item.make && item.model && hasCompleteSpecs(item) && hasReliableWebEvidence(item.sources) && matchesEquipmentSearch(item, query)).slice(0, 3);
}

function normalizeStoredResults(stored = [], query = '') {
  return stored.filter((item) => hasCompleteSpecs(item) && matchesEquipmentSearch(item, query)).map((item) => {
    const width_in = specNumber(item, 'width_in');
    const height_in = specNumber(item, 'height_in');
    return { ...item, operating_weight_lbs: specNumber(item, 'operating_weight_lbs'), width_in, height_in,
      transport_width_in: width_in, transport_height_in: height_in, verification_status: 'Verified', source: 'database' };
  }).slice(0, 3);
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

    const tokenGroups = searchTokenGroups(query);
    let dbQuery = admin.from('equipment_specs').select('*').or(`company_id.is.null,company_id.eq.${profile.company_id}`);
    for (const group of tokenGroups) {
      const predicates = group.flatMap((token) => [`make.ilike.%${token}%`, `model.ilike.%${token}%`, `serial_number.ilike.%${token}%`]);
      dbQuery = dbQuery.or(predicates.join(','));
    }
    const { data: stored, error: storedError } = await dbQuery.limit(8);
    const storedResults = !storedError ? normalizeStoredResults(stored, query) : [];
    if (storedResults.length) {
      const payload = { results: storedResults, source: 'database', error: '' };
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
          { role: 'system', content: 'Search the live web for up to three likely exact heavy-equipment matches. Normalize common brand aliases, punctuation, spacing, partial model numbers, serial numbers, and model-year text. Never estimate, merge configurations, or combine values from separate sources. For every result, establish operating weight (lbs), transport height (in), and transport width (in) for one exact configuration. A manufacturer product page or manufacturer PDF is Verified. Otherwise, return a result only when two or more agreeing non-manufacturer sources corroborate all three values; those results are Unverified and require customer confirmation. Exclude conflicting, incomplete, and single-source non-manufacturer results. Every evidence URL must be a page actually returned by this search.' },
          { role: 'user', content: `Research "${query}". Return JSON only: {"results":[{"make":"","model":"","configuration":null,"serial_number":null,"operating_weight_lbs":0,"transport_height_in":0,"transport_width_in":0,"evidence":[{"url":"https://...","title":"","publisher":"","is_manufacturer":false,"operating_weight_lbs":0,"transport_height_in":0,"transport_width_in":0}]}]}. Return no more than three likely exact matches, or {"results":[]} when no reliable match is found.` },
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
