import { enforceRateLimit, requireUser, sendApiError } from './_security.js';
import { reportOperationalError } from './_monitoring.js';
import { getServerEnv } from './_env.js';
import { equipmentScope, scopeEquipmentQuery, normalizeSavedEquipment, SAVED_EQUIPMENT_COLUMNS } from './_savedEquipment.js';

export const config = { maxDuration: 60 };

const responseCache = new Map();
const CACHE_TTL_MS = 60 * 60 * 1000;
const MAX_CACHE_ENTRIES = 500;
const MEDIUM_TOLERANCE = 0.05; // two independent sources must agree within 5% on every field
const DEFAULT_GEMINI_MODEL = 'gemini-3.5-flash-lite'; // override with GEMINI_MODEL env var
const SPEC_FIELDS = ['operating_weight_lbs', 'width_in', 'height_in'];
const CONFIDENCE_RANK = { HIGH: 0, MEDIUM: 1, LOW: 2 };
const identitySchema = {
  make: { type: 'string' }, model: { type: 'string' }, configuration: { type: ['string', 'null'] },
};
const RESEARCH_SCHEMA = {
  type: 'object', required: ['results'], properties: {
    results: { type: 'array', maxItems: 3, items: {
      type: 'object', required: ['make', 'model', 'configuration', 'evidence'], properties: {
        ...identitySchema,
        evidence: { type: 'array', maxItems: 6, items: {
          type: 'object', required: ['url', 'make', 'model', 'configuration', ...SPEC_FIELDS], properties: {
            ...identitySchema, url: { type: 'string' }, title: { type: 'string' }, publisher: { type: 'string' },
            ...Object.fromEntries(SPEC_FIELDS.map((field) => [field, { type: ['number', 'null'] }])),
          },
        } },
      },
    } },
  },
};

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

// ---------------------------------------------------------------- basics

const text = (value) => value == null ? '' : String(value).trim();
const number = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};
const hostOf = (value) => {
  try { return new URL(text(value)).hostname.toLowerCase().replace(/^www\./, ''); }
  catch { return ''; }
};
const escapeLike = (value) => text(value).replace(/[\\%_]/g, '\\$&');
// Conservatively group subdomains together, including country-code domains.
const independentDomain = (url) => hostOf(url).split('.').slice(-2).join('.');

export const normalizeSearchText = (value) => text(value).toLowerCase()
  .replace(/([a-z])([0-9])/g, '$1 $2').replace(/([0-9])([a-z])/g, '$1 $2')
  .replace(/[^a-z0-9]+/g, ' ').trim();

function applyBrandAlias(normalized) {
  for (const [alias, canonical] of BRAND_ALIASES) {
    if (normalized.startsWith(`${alias} `) || normalized === alias) {
      return `${canonical}${normalized.slice(alias.length)}`.trim();
    }
  }
  return normalized;
}

export function deFuzzEquipmentQuery(value = '') {
  const tokens = normalizeSearchText(value).split(' ').filter(Boolean)
    .filter((token) => !/^(?:19|20)\d{2}$/.test(token));
  return applyBrandAlias(tokens.join(' '));
}

// Database matching splits `L90H` into tolerant tokens. Web search does not:
// search engines rank manufacturer pages far better when the model stays intact.
function webResearchQuery(value = '') {
  const tokens = text(value).toLowerCase().replace(/[^a-z0-9]+/g, ' ')
    .split(' ').filter(Boolean).filter((token) => !/^(?:19|20)\d{2}$/.test(token));
  return applyBrandAlias(tokens.join(' '));
}

function searchTokenGroups(value = '') {
  const tokens = deFuzzEquipmentQuery(value).split(' ').filter(Boolean).slice(0, 6);
  // Single characters (the "l" and "h" in "l 90 h") match nearly every row and
  // would crowd the real match out of the DB result limit. JS matching below
  // still checks every token.
  const useful = tokens.filter((token) => token.length >= 2);
  return (useful.length ? useful : tokens).map((token) => {
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
  return SPEC_FIELDS.every((field) => specNumber(item, field));
}

export function matchesEquipmentSearch(item, query = '') {
  const normalizedQuery = deFuzzEquipmentQuery(query);
  const normalizedCandidate = deFuzzEquipmentQuery([item?.make, item?.model, item?.serial_number].filter(Boolean).join(' '));
  // "LeeBoy" vs "Lee Boy": compare a whitespace-free form first.
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

// ---------------------------------------------------------------- Gemini

function webSearchError(response, detail = '') {
  const error = new Error(response.status === 429
    ? 'Equipment web research has reached its provider quota. Try later or enter specifications manually.'
    : `Equipment web search failed (${response.status})${detail ? `: ${detail}` : '.'}`);
  error.status = response.status === 429 ? 429 : 502;
  error.retryAfter = response.status === 429 ? Number(response.headers.get('retry-after')) || 60 : undefined;
  error.providerStatus = response.status;
  return error;
}

async function searchGemini(apiKey, prompt, { timeoutMs = 40_000 } = {}) {
  const model = text(getServerEnv('GEMINI_MODEL')) || DEFAULT_GEMINI_MODEL;
  const response = await fetch('https://generativelanguage.googleapis.com/v1beta/interactions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    signal: AbortSignal.timeout(timeoutMs),
    body: JSON.stringify({
      model, input: prompt, store: false,
      tools: [{ type: 'google_search' }],
      response_format: { type: 'text', mime_type: 'application/json', schema: RESEARCH_SCHEMA },
      generation_config: { temperature: 0.1, max_output_tokens: 4096 },
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
  if (Array.isArray(payload?.steps)) return payload.steps.filter((step) => step.type === 'model_output')
    .flatMap((step) => step.content || []).filter((block) => block.type === 'text').map((block) => text(block.text)).join('\n');
  const candidate = payload?.candidates?.[0];
  return (candidate?.content?.parts || []).map((part) => text(part?.text)).filter(Boolean).join('\n');
}

function canonicalUrl(value) {
  const clean = cleanUrl(value);
  if (!clean) return '';
  const url = new URL(clean);
  url.search = ''; url.hash = '';
  url.hostname = url.hostname.replace(/^www\./, '');
  url.pathname = url.pathname.replace(/\/+$/, '') || '/';
  return url.href;
}

// Resolve only Google's grounding redirects. Never fetch model-supplied URLs.
export async function geminiGroundedUrls(payload) {
  let chunks = payload?.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
  if (Array.isArray(payload?.steps)) {
    const searched = payload.steps.some((step) => step.type === 'google_search_result' && !step.is_error);
    if (!searched) return [];
    const annotations = payload.steps.filter((step) => step.type === 'model_output')
      .flatMap((step) => step.content || []).flatMap((block) => block.annotations || [])
      .filter((annotation) => annotation.type === 'url_citation').map((annotation) => annotation.url);
    // JSON outputs may omit annotations. A Google-signed grounding URL must
    // actually resolve before it can support a result; arbitrary model URLs cannot.
    const parsedResults = parseJson(geminiOutputText(payload)).results;
    const signed = (Array.isArray(parsedResults) ? parsedResults : []).flatMap((item) => Array.isArray(item.evidence) ? item.evidence : [])
      .map((source) => source.url).filter((url) => hostOf(url) === 'vertexaisearch.cloud.google.com'
        && new URL(url).pathname.startsWith('/grounding-api-redirect/'));
    chunks = [...new Set([...annotations, ...signed])].map((uri) => ({ web: { uri } }));
  }
  const urls = await Promise.all(chunks.slice(0, 12).map(async (chunk) => {
    const original = cleanUrl(chunk?.web?.uri);
    let url = original;
    for (let hop = 0; hop < 3 && hostOf(url) === 'vertexaisearch.cloud.google.com'; hop += 1) {
      try {
        const response = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(3000) });
        const location = response.headers.get('location');
        await response.body?.cancel();
        if (!location) return null;
        url = cleanUrl(new URL(location, url).href);
      } catch { return null; }
    }
    return url && hostOf(url) !== 'vertexaisearch.cloud.google.com' ? { original, url } : null;
  }));
  return urls.filter(Boolean);
}

function parseJson(value) {
  const content = text(value).replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim();
  try { return JSON.parse(content); }
  catch {
    // Models sometimes add prose or markers around the JSON. Extract the first
    // complete JSON object instead of treating the response as empty.
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

// ---------------------------------------------------------------- confidence

// Source trust comes only from the URL's domain, never from a model-provided flag.
function isManufacturerDomain(url, rawMake) {
  const host = hostOf(url);
  const make = deFuzzEquipmentQuery(rawMake);
  if (!host || !make) return false;
  const known = MANUFACTURER_DOMAINS.get(make) || [];
  if (known.some((domain) => host === domain || host.endsWith(`.${domain}`))) return true;
  return false;
}

function specsAgree(a, b, tolerance = MEDIUM_TOLERANCE) {
  return SPEC_FIELDS.every((field) => {
    const x = specNumber(a, field);
    const y = specNumber(b, field);
    return x && y && Math.abs(x - y) / Math.max(x, y) <= tolerance;
  });
}

const highestSpecs = (sources) => Object.fromEntries(SPEC_FIELDS.map((field) => {
  const values = sources.map((source) => specNumber(source, field)).filter(Boolean);
  return [field, values.length ? Math.max(...values) : null];
}));

/**
 * HIGH   - manufacturer page/PDF covers weight, width and height.
 * MEDIUM - two independent (different-domain) sources agree within 5% on every field; higher value used.
 * LOW    - everything else with complete specs (single source, or sources that disagree); higher value used.
 */
export function deriveConfidence(evidence = []) {
  const usable = evidence.filter((source) => cleanUrl(source?.url));
  const manufacturerSpecs = highestSpecs(usable.filter((source) => source.is_manufacturer));
  if (hasCompleteSpecs(manufacturerSpecs)) {
    return { confidence: 'HIGH', specs: manufacturerSpecs, reason: 'Confirmed by manufacturer source' };
  }
  const complete = usable.filter(hasCompleteSpecs);
  for (let i = 0; i < complete.length; i += 1) {
    for (let j = i + 1; j < complete.length; j += 1) {
      if (independentDomain(complete[i].url) !== independentDomain(complete[j].url) && specsAgree(complete[i], complete[j])) {
        return {
          confidence: 'MEDIUM', specs: highestSpecs([complete[i], complete[j]]),
          reason: 'Two independent sources agree within 5%; higher values used',
        };
      }
    }
  }
  if (!complete.length) return { confidence: null, specs: {}, reason: '' };
  const independent = new Set(complete.map((source) => hostOf(source.url))).size > 1;
  return {
    confidence: 'LOW', specs: highestSpecs(complete),
    reason: independent ? 'Sources disagree by more than 5%; higher values used' : 'Single uncorroborated source',
  };
}

// Kept for existing callers/tests.
export function deriveVerificationStatus(evidence = []) {
  const { confidence, reason } = deriveConfidence(evidence);
  if (confidence === 'HIGH') return 'Verified';
  return /disagree/.test(reason) ? 'Conflict' : 'Unverified';
}

// ---------------------------------------------------------------- normalization

export function normalizeSourcedResults(payload, query = '') {
  const grounded = Array.isArray(payload?.grounded_urls) ? payload.grounded_urls : [];
  const allowed = new Set(grounded.map((entry) => canonicalUrl(entry.url || entry)));
  const resolveCitation = (value) => grounded.find((entry) => entry.original === value)?.url || value;

  return (Array.isArray(payload?.results) ? payload.results : []).map((item, index) => {
    const make = text(item?.make);
    const evidence = (Array.isArray(item?.evidence) ? item.evidence : []).map((source) => {
      const url = cleanUrl(resolveCitation(source?.url));
      return {
        url, title: text(source?.title), publisher: text(source?.publisher),
        is_manufacturer: isManufacturerDomain(url, make),
        make: text(source?.make), model: text(source?.model), configuration: text(source?.configuration) || null,
        operating_weight_lbs: specNumber(source, 'operating_weight_lbs'),
        width_in: specNumber(source, 'width_in'),
        height_in: specNumber(source, 'height_in'),
      };
    }).filter((source) => source.url
      && allowed.has(canonicalUrl(source.url))
      // The cited page must be about the model that was searched, not a sibling.
      && source.model && normalizeSearchText(source.model) === normalizeSearchText(item.model)
      && (!source.make || deFuzzEquipmentQuery(source.make) === deFuzzEquipmentQuery(make))
      && normalizeSearchText(source.configuration) === normalizeSearchText(item.configuration));

    const { confidence, specs, reason } = deriveConfidence(evidence);
    if (!confidence) return null;

    const result = {
      id: `web-${index}-${normalizeSearchText(`${make}-${item?.model}`)}`,
      make, model: text(item?.model), configuration: text(item?.configuration) || null,
      serial_number: text(item?.serial_number) || null,
      operating_weight_lbs: specs.operating_weight_lbs,
      width_in: specs.width_in,
      height_in: specs.height_in,
      confidence,
      confidence_reason: reason,
      requires_confirmation: confidence === 'LOW',
      verification_status: confidence === 'HIGH' ? 'Verified' : (/disagree/.test(reason) ? 'Conflict' : 'Unverified'),
      sources: evidence, source: 'web',
      retrieved_at: new Date().toISOString(), weight_type: 'operating',
    };
    result.transport_width_in = result.width_in;
    result.transport_height_in = result.height_in;
    result.width_ft = Number((result.width_in / 12).toFixed(1));
    result.height_ft = Number((result.height_in / 12).toFixed(1));
    return result;
  }).filter((item) => item && item.make && item.model && hasCompleteSpecs(item) && matchesEquipmentSearch(item, query))
    .sort((a, b) => CONFIDENCE_RANK[a.confidence] - CONFIDENCE_RANK[b.confidence])
    .slice(0, 3);
}

export function normalizeStoredResults(stored = [], query = '') {
  return stored
    .filter((item) => hasCompleteSpecs(item) && matchesEquipmentSearch(item, query))
    .map((item) => {
      const evidence = (Array.isArray(item.sources) ? item.sources : []).filter((source) =>
        source.model && normalizeSearchText(source.model) === normalizeSearchText(item.model)
        && normalizeSearchText(source.configuration) === normalizeSearchText(item.configuration)
        && (!source.make || deFuzzEquipmentQuery(source.make) === deFuzzEquipmentQuery(item.make))
      ).map((source) => ({ ...source, is_manufacturer: isManufacturerDomain(source.url, item.make) }));
      
      const derived = deriveConfidence(evidence);
      
      // Defaults to HIGH if no complex web evidence is attached
      const confidence = derived.confidence || 'HIGH';
      const specs = derived.confidence ? derived.specs : item;
      const width_in = specNumber(specs, 'width_in');
      const height_in = specNumber(specs, 'height_in');
      
      return {
        ...item, 
        operating_weight_lbs: specNumber(specs, 'operating_weight_lbs'), 
        width_in, 
        height_in,
        transport_width_in: width_in, 
        transport_height_in: height_in,
        verification_status: confidence === 'HIGH' ? 'Verified' : 'Unverified', 
        confidence,
        confidence_reason: derived.reason || 'Verified internal database record',
        requires_confirmation: confidence === 'LOW', 
        source: 'database',
      };
    }).sort((a, b) => CONFIDENCE_RANK[a.confidence] - CONFIDENCE_RANK[b.confidence]).slice(0, 3);
}

async function persistHighConfidence(results, admin, companyId) {
  for (const item of results.filter((result) => result.confidence === 'HIGH')) {
    try {
      const candidate = {
        company_id: companyId, make: item.make, model: item.model, configuration: item.configuration,
        serial_number: item.serial_number, operating_weight_lbs: item.operating_weight_lbs,
        width_in: item.width_in, height_in: item.height_in, width_ft: item.width_ft, height_ft: item.height_ft,
        source: 'web', sources: item.sources, verification_status: 'Verified',
        retrieved_at: item.retrieved_at, weight_type: 'operating',
      };
      let existingQuery = admin.from('equipment_specs').select('id')
        .eq('company_id', companyId).ilike('make', escapeLike(item.make)).ilike('model', escapeLike(item.model));
      existingQuery = item.configuration ? existingQuery.eq('configuration', item.configuration) : existingQuery.is('configuration', null);
      const { data: existing, error: lookupError } = await existingQuery.limit(1);
      if (lookupError) throw lookupError;
      const { error } = existing?.[0]?.id
        ? await admin.from('equipment_specs').update(candidate).eq('id', existing[0].id).eq('company_id', companyId)
        : await admin.from('equipment_specs').insert(candidate);
      if (error) throw error;
    } catch (error) {
      // Saving is a bonus; never fail the lookup because of it.
      void reportOperationalError(error, { event: 'persist_failure', route: '/api/searchEquipment' });
    }
  }
}

function cacheResponse(key, payload) {
  if (responseCache.size >= MAX_CACHE_ENTRIES) responseCache.delete(responseCache.keys().next().value);
  responseCache.set(key, { payload, expiresAt: Date.now() + CACHE_TTL_MS });
}

// ---------------------------------------------------------------- handler

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const rawQuery = text(req.query?.query);
    if (!rawQuery) return res.status(200).json({ results: [], source: '' });
    if (rawQuery.length < 2 || rawQuery.length > 80) return res.status(400).json({ error: 'Search must be 2 to 80 characters.' });
    const query = rawQuery.replace(/[,%()]/g, ' ').replace(/\s+/g, ' ').trim();
    const { admin, profile } = await requireUser(req);
    const scope = equipmentScope(profile);
    await enforceRateLimit(admin, `equipment-search:${profile.id}`, { limit: 120, windowMs: 60 * 60 * 1000 });
    const cacheKey = `${profile.company_id}:${scope.client_id || 'company'}:${query.toLowerCase()}`;
    const cached = responseCache.get(cacheKey);

    // 1) Supabase first. Cache hits and DB hits never touch the web-research quotas below.
    let privateQuery = scopeEquipmentQuery(admin.from('saved_equipment').select(SAVED_EQUIPMENT_COLUMNS), scope);
    for (const group of searchTokenGroups(query)) {
      privateQuery = privateQuery.or(group.flatMap((token) => [`make.ilike.%${token}%`, `model.ilike.%${token}%`, `serial_number.ilike.%${token}%`]).join(','));
    }
    const { data: personal, error: personalError } = await privateQuery.limit(25);
    if (personalError) void reportOperationalError(personalError, { event: 'saved_equipment_lookup_failure', route: '/api/searchEquipment' });
    const personalResults = !personalError ? (personal || []).filter((item) => hasCompleteSpecs(item) && matchesEquipmentSearch(item, query)).map(normalizeSavedEquipment).slice(0, 5) : [];
    let dbQuery = admin.from('equipment_specs').select('*').or(`company_id.is.null,company_id.eq.${profile.company_id}`);
    for (const group of searchTokenGroups(query)) {
      const predicates = group.flatMap((token) => [`make.ilike.%${token}%`, `model.ilike.%${token}%`, `serial_number.ilike.%${token}%`]);
      dbQuery = dbQuery.or(predicates.join(','));
    }
    const { data: stored, error: storedError } = await dbQuery.limit(25);
    if (storedError) void reportOperationalError(storedError, { event: 'db_failure', route: '/api/searchEquipment' });
    const storedResults = !storedError ? normalizeStoredResults(stored, query) : [];
    if (storedResults.length || personalResults.length) {
      const payload = { results: [...personalResults, ...storedResults], source: personalResults.length ? 'my equipment' : 'database', error: '' };
      return res.status(200).json(payload);
    }
    if (cached?.expiresAt > Date.now()) return res.status(200).json(cached.payload);

    // 2) Bounded paid fallback. This request cap is not a dollar spending cap:
    //    one grounded generation can issue multiple Google searches.
    const geminiApiKey = getServerEnv('GOOGLE_GEMINI_API_KEY');
    if (!geminiApiKey) return res.status(200).json({ results: [], source: '', error: 'Web lookup is not configured. Enter specifications manually to continue.' });
    const configuredCap = Number(getServerEnv('GEMINI_DAILY_CAP') ?? 20);
    const dailyCap = Number.isFinite(configuredCap) ? Math.min(20, Math.max(0, Math.floor(configuredCap))) : 20;
    if (!dailyCap) return res.status(200).json({ results: [], source: '', error: 'Web lookup is disabled. Enter specifications manually to continue.' });
    await enforceRateLimit(admin, `equipment-web-research:${profile.id}`, { limit: dailyCap, windowMs: 24 * 60 * 60 * 1000 });
    await enforceRateLimit(admin, 'equipment-web-research:global', {
      limit: dailyCap, windowMs: 24 * 60 * 60 * 1000,
    });

    const results = await researchEquipment(query, geminiApiKey);

    // 3) Only manufacturer-confirmed (HIGH) results are saved for future lookups.
    await persistHighConfidence(results, admin, profile.company_id);

    const payload = { results, source: results.length ? 'web' : '', error: results.length ? '' : 'No sourced exact-model specifications found.' };
    if (results.length) cacheResponse(cacheKey, payload);
    return res.status(200).json(payload);
  } catch (error) {
    if (error?.name === 'TimeoutError' || error?.name === 'AbortError') {
      return res.status(504).json({ error: 'Equipment lookup timed out. Try again or enter specifications manually.' });
    }
    void reportOperationalError(error, { event: 'provider_failure', route: '/api/searchEquipment', provider: 'gemini' });
    return sendApiError(res, error, 'Equipment search failed.', { route: '/api/searchEquipment', provider: 'gemini' });
  }
}

export async function researchEquipment(query, geminiApiKey = getServerEnv('GOOGLE_GEMINI_API_KEY')) {
  const webQuery = webResearchQuery(query) || query;
  const manufacturerDomains = [...MANUFACTURER_DOMAINS].find(([make]) => deFuzzEquipmentQuery(query).startsWith(`${make} `))?.[1] || [];
  const prompt = `Find transport specifications for the exact equipment model "${webQuery}" using Google Search. ${manufacturerDomains.length ? `First search site:${manufacturerDomains[0]} for this model's weight, width and height. Then search another independent source to corroborate. Include all useful sources, not just the first match.` : 'Seek the manufacturer and two independent sources.'} Return only JSON matching this shape:
{"results":[{"make":"","model":"","configuration":null,"serial_number":null,"evidence":[{"url":"https://...","title":"","publisher":"","make":"","model":"","configuration":null,"operating_weight_lbs":0,"transport_height_in":0,"transport_width_in":0}]}]}

Rules: return at most three likely exact matches, ordered by match quality. Each evidence url must be the exact citation URL returned by Google Search, including its grounding redirect if supplied. Never invent a URL. Do not estimate, use memory, combine similar models, or substitute a related model. Return an exact base-model result when no conflicting configuration is named. Treat an exact-model manufacturer's overall machine width or overall machine height as the transport width or transport height. Search specifically for shipping/transport width AND shipping/transport height AND operating weight, not only weight. Prefer manufacturer product pages or manufacturer PDFs, and include dealers/specification sites when the manufacturer search lacks dimensions. Convert published metric units (kg, mm, m) or feet/inches to lbs and decimal inches. For multiple configurations, return separate results and use the same configuration label on their evidence. Include a result when at least one cited page establishes operating weight (lbs), width (in), and height (in). Each evidence entry must contain only values stated on that cited page; use null for unsupported fields.`;

  const geminiPayload = await searchGemini(geminiApiKey, prompt);
  const suggestions = (geminiPayload.steps || []).filter((step) => step.type === 'google_search_result')
    .flatMap((step) => step.result || []).map((result) => text(result.search_suggestions)).filter(Boolean).join('\n');
  return normalizeSourcedResults({
      ...parseJson(geminiOutputText(geminiPayload)),
      grounded_urls: await geminiGroundedUrls(geminiPayload),
    }, webQuery).map((result) => ({ ...result, search_suggestions: suggestions }));

}
