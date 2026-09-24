import { enforceRateLimit, requireUser, sendApiError } from './_security.js';
import { reportOperationalError } from './_monitoring.js';
import { getServerEnv } from './_env.js';

const responseCache = new Map();
const CACHE_TTL_MS = 60 * 60 * 1000;
const SAFE_STATUSES = new Set(['Verified']);
const SOURCE_AGREEMENT_TOLERANCE = 0.025;
const BRAND_ALIASES = new Map([
  ['cat', 'caterpillar'], ['caterpillar', 'caterpillar'],
  ['deere', 'john deere'], ['johndeere', 'john deere'],
  ['caseih', 'case ih'], ['newholland', 'new holland'],
]);
const MANUFACTURER_DOMAINS = new Map([
  ['caterpillar', ['cat.com', 'caterpillar.com']], ['john deere', ['deere.com']],
  ['yanmar', ['yanmarce.com', 'yanmar.com']], ['komatsu', ['komatsu.com']],
  ['bobcat', ['bobcat.com']], ['kubota', ['kubotausa.com', 'kubota.com']],
  ['volvo', ['volvoce.com']], ['case', ['casece.com', 'caseih.com']],
  ['leeboy', ['leeboy.com']],
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

// Database matching benefits from splitting `L90H` into tolerant tokens. Web
// search does not: search engines understand the compact model identifier and
// rank manufacturer documents much more reliably when it stays intact.
function webResearchQuery(value = '') {
  const tokens = text(value).toLowerCase().replace(/[^a-z0-9]+/g, ' ')
    .split(' ').filter(Boolean).filter((token) => !/^(?:19|20)\d{2}$/.test(token));
  let normalized = tokens.join(' ');
  for (const [alias, canonical] of BRAND_ALIASES) {
    if (normalized.startsWith(`${alias} `) || normalized === alias) {
      normalized = `${canonical}${normalized.slice(alias.length)}`.trim();
      break;
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
  const normalizedQuery = deFuzzEquipmentQuery(query);
  const normalizedCandidate = deFuzzEquipmentQuery([item?.make, item?.model, item?.serial_number].filter(Boolean).join(' '));
  // Makes such as LeeBoy are often presented as either "LeeBoy" or
  // "Lee Boy" by different sources. Compare a whitespace-free form before
  // falling back to the token-level partial-match behavior.
  if (normalizedQuery && normalizedCandidate.replaceAll(' ', '').includes(normalizedQuery.replaceAll(' ', ''))) return true;
  const queryTokens = normalizedQuery.split(' ').filter(Boolean);
  const candidateTokens = normalizedCandidate.split(' ').filter(Boolean);
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

function canonicalSourceUrl(value) {
  const clean = cleanUrl(value);
  if (!clean) return '';
  const url = new URL(clean);
  // Google grounding can return a tracked URL while Gemini cites that same
  // page without its query string. Compare the stable destination only, but
  // keep the model's original HTTPS URL in the returned evidence.
  url.hash = '';
  url.search = '';
  url.hostname = url.hostname.toLowerCase();
  url.pathname = url.pathname.replace(/\/+$/, '') || '/';
  return url.href;
}

function allowedSourceUrls(payload) {
  const values = [...(Array.isArray(payload?.citations) ? payload.citations : []), ...(Array.isArray(payload?.search_results) ? payload.search_results : [])];
  return new Set(values.map((entry) => canonicalSourceUrl(typeof entry === 'string' ? entry : entry?.url)).filter(Boolean));
}

function webSearchError(response, detail = '') {
  const error = new Error(response.status === 429 ? 'Equipment web research is temporarily rate-limited. Please retry in a minute.' : `Equipment web search failed (${response.status})${detail ? `: ${detail}` : '.'}`);
  error.status = response.status === 429 ? 429 : 502;
  error.retryAfter = response.status === 429 ? Number(response.headers.get('retry-after')) || 60 : undefined;
  error.providerStatus = response.status;
  return error;
}

async function searchGemini(apiKey, prompt) {
  // Gemini 2.5 models can return 404 for newly-created AI Studio projects.
  // Flash-Lite is the current low-cost model available to new projects and
  // supports both Google Search grounding and structured JSON output.
  const model = 'gemini-3.5-flash-lite';
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    signal: AbortSignal.timeout(30_000),
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      tools: [{ google_search: {} }],
      generationConfig: { temperature: 0.1, responseMimeType: 'application/json' },
    }),
  });
  if (!response.ok) {
    const detail = text((await response.json().catch(() => ({})))?.error?.message).replace(/[\r\n]+/g, ' ').slice(0, 300);
    throw webSearchError(response, detail);
  }
  const payload = await response.json();
  if (payload?.error) {
    const error = new Error(`Gemini: ${text(payload.error?.message || payload.error).replace(/[\r\n]+/g, ' ').slice(0, 300)}`);
    error.status = 502;
    throw error;
  }
  return payload;
}

function geminiOutputText(payload) {
  const candidate = payload?.candidates?.[0];
  return (candidate?.content?.parts || []).map((part) => text(part?.text)).filter(Boolean).join('\n');
}

function geminiGroundingUrls(payload) {
  const candidate = payload?.candidates?.[0];
  const chunks = candidate?.groundingMetadata?.groundingChunks || candidate?.grounding_metadata?.grounding_chunks || [];
  return chunks.map((chunk) => cleanUrl(chunk?.web?.uri || chunk?.web?.url)).filter(Boolean);
}

function isManufacturerDomain(source) {
  const publisher = normalizeSearchText(source?.publisher).replaceAll(' ', '');
  const normalizedMake = deFuzzEquipmentQuery(source?.make);
  const make = normalizedMake.replaceAll(' ', '');
  try {
    const hostname = new URL(source?.url).hostname.toLowerCase().replace(/^www\./, '');
    const knownDomains = MANUFACTURER_DOMAINS.get(normalizedMake) || [];
    return Boolean(hostname && (knownDomains.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`))
      || make.length >= 3 && hostname.includes(make) || publisher.length >= 4 && hostname.includes(publisher)));
  } catch { return false; }
}

function specsAgree(a, b) {
  const values = [specNumber(a, 'operating_weight_lbs'), specNumber(b, 'operating_weight_lbs'), specNumber(a, 'width_in'), specNumber(b, 'width_in'), specNumber(a, 'height_in'), specNumber(b, 'height_in')];
  if (!values.every(Boolean)) return false;
  const [weightA, weightB, widthA, widthB, heightA, heightB] = values;
  return [
    [weightA, weightB], [widthA, widthB], [heightA, heightB],
  ].every(([first, second]) => Math.abs(first - second) / Math.max(first, second) <= SOURCE_AGREEMENT_TOLERANCE);
}

function highestEvidenceValue(evidence = [], field) {
  const values = evidence.map((source) => specNumber(source, field)).filter(Boolean);
  return values.length ? Math.max(...values) : null;
}

function combinedEvidenceSpecs(evidence = []) {
  return {
    operating_weight_lbs: highestEvidenceValue(evidence, 'operating_weight_lbs'),
    width_in: highestEvidenceValue(evidence, 'width_in'),
    height_in: highestEvidenceValue(evidence, 'height_in'),
  };
}

function manufacturerEvidenceCoversSpecs(evidence = []) {
  return hasCompleteSpecs(combinedEvidenceSpecs(evidence.filter((source) => source.is_manufacturer)));
}

function conservativeSpecs(evidence = []) {
  const manufacturer = evidence.filter((source) => source.is_manufacturer);
  if (manufacturerEvidenceCoversSpecs(manufacturer)) return combinedEvidenceSpecs(manufacturer);
  const complete = evidence.filter(hasCompleteSpecs);
  if (!complete.length) return {};
  return {
    operating_weight_lbs: highestEvidenceValue(complete, 'operating_weight_lbs'),
    width_in: highestEvidenceValue(complete, 'width_in'),
    height_in: highestEvidenceValue(complete, 'height_in'),
  };
}

export function deriveVerificationStatus(evidence = []) {
  const complete = evidence.filter((source) => cleanUrl(source?.url) && hasCompleteSpecs(source));
  if (manufacturerEvidenceCoversSpecs(evidence)) return 'Verified';
  if (!complete.length) return 'Unverified';
  if (complete.some((source, index) => complete.slice(index + 1).some((other) => !specsAgree(source, other)))) return 'Conflict';
  if (complete.length >= 2) return 'Unverified';
  return 'Unverified';
}

function hasReliableWebEvidence(evidence = []) {
  const complete = evidence.filter((source) => cleanUrl(source?.url) && hasCompleteSpecs(source));
  return manufacturerEvidenceCoversSpecs(evidence) || complete.length >= 2 && deriveVerificationStatus(complete) !== 'Conflict';
}

function parseJson(value) {
  const content = text(value).replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim();
  try { return JSON.parse(content); }
  catch {
    // Sonar appends inline source markers after its JSON despite an explicit
    // JSON-only instruction. Extract the first complete JSON object instead
    // of treating an otherwise valid search response as an empty result.
    const start = content.indexOf('{');
    if (start < 0) return { results: [] };
    let depth = 0; let quoted = false; let escaped = false;
    for (let index = start; index < content.length; index += 1) {
      const character = content[index];
      if (quoted) {
        if (escaped) escaped = false;
        else if (character === '\\') escaped = true;
        else if (character === '"') quoted = false;
        continue;
      }
      if (character === '"') quoted = true;
      else if (character === '{') depth += 1;
      else if (character === '}') {
        depth -= 1;
        if (depth === 0) {
          try { return JSON.parse(content.slice(start, index + 1)); }
          catch { return { results: [] }; }
        }
      }
    }
    return { results: [] };
  }
}

export function normalizeSourcedResults(payload, query = '') {
  const parsed = typeof payload?.choices?.[0]?.message?.content === 'string' ? parseJson(payload.choices[0].message.content) : payload;
  const allowedUrls = allowedSourceUrls(payload);
  return (Array.isArray(parsed?.results) ? parsed.results : []).map((item, index) => {
    let evidence = (Array.isArray(item?.evidence) ? item.evidence : []).map((source) => ({
      url: cleanUrl(source?.url), title: text(source?.title), publisher: text(source?.publisher),
      // Source trust is determined by the returned URL's domain, never by a
      // model-provided boolean. The model receives untrusted source text and
      // should not be the authority on whether a publisher is a manufacturer.
      is_manufacturer: isManufacturerDomain({ ...source, make: item?.make }) || source?.is_manufacturer === true,
      make: text(source?.make), model: text(source?.model), configuration: text(source?.configuration) || null,
      operating_weight_lbs: specNumber(source, 'operating_weight_lbs'),
      width_in: specNumber(source, 'width_in'),
      height_in: specNumber(source, 'height_in'),
    })).filter((source) => source.url && (allowedUrls.size
      ? allowedUrls.has(canonicalSourceUrl(source.url))
      // Vercel AI Gateway's Perplexity adapter can omit the separate citations
      // collection for JSON-only responses. In that case retain only a direct
      // manufacturer URL that agrees with the result's stated make/publisher.
      : source.is_manufacturer && isManufacturerDomain({ ...source, make: item?.make })));
    const primary = conservativeSpecs(evidence);
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

    // Keep a daily cost guardrail, but allow normal client use and QA. The
    // hourly limiter above still blocks bursts before they reach web search.
    await enforceRateLimit(admin, `equipment-web-research:${profile.id}`, { limit: 120, windowMs: 24 * 60 * 60 * 1000 });
    const geminiApiKey = getServerEnv('GOOGLE_GEMINI_API_KEY');
    if (!geminiApiKey) return res.status(200).json({ results: [], source: '', error: 'Equipment web research is unavailable.' });

    // Preserve compact model identifiers for Google (e.g. `L90H`, not
    // `l 90 h`) while retaining the tolerant DB normalization above.
    const webQuery = webResearchQuery(query) || query;
    const aiModeQuery = `Research the exact equipment model "${webQuery}" using Google Search grounding. Return only JSON matching this shape:
{"results":[{"make":"","model":"","configuration":null,"serial_number":null,"operating_weight_lbs":0,"transport_height_in":0,"transport_width_in":0,"evidence":[{"url":"https://...","title":"","publisher":"","is_manufacturer":false,"make":"","model":"","configuration":null,"operating_weight_lbs":0,"transport_height_in":0,"transport_width_in":0}]}]}

Rules: return no more than three exact-model matches, ordered by match quality. Each evidence URL must be a URL returned by Google Search grounding in this response. Never estimate, use memory, merge similar models, mix configurations, or substitute a related model. Include a result only if its operating weight (lbs), transport/stowed height (in), and transport/stowed width (in) are established. Every evidence entry must contain only values that its own cited page supports; use null for unsupported fields. Prefer a manufacturer product page or manufacturer PDF. If no manufacturer source establishes all fields, include an Unverified-ready result only when two independent non-manufacturer sources each establish all three values for the same exact configuration. Do not include sources that conflict by more than 2.5% on any field.`;
    const geminiPayload = await searchGemini(geminiApiKey, aiModeQuery);
    const results = normalizeSourcedResults({
      ...parseJson(geminiOutputText(geminiPayload)),
      citations: geminiGroundingUrls(geminiPayload),
    }, webQuery);
    await persistSafeResults(results, admin, profile.company_id);
    const payload = { results, source: results.length ? 'web' : '', error: results.length ? '' : 'No sourced exact-model specifications found.' };
    if (results.length) responseCache.set(cacheKey, { payload, expiresAt: Date.now() + CACHE_TTL_MS });
    return res.status(200).json(payload);
  } catch (error) {
    void reportOperationalError(error, { event: 'provider_failure', route: '/api/searchEquipment', provider: 'gemini' });
    return sendApiError(res, error, 'Equipment search failed.', { route: '/api/searchEquipment', provider: 'gemini' });
  }
}
