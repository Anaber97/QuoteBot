import { enforceRateLimit, requireUser, sendApiError } from './_security.js';
import { reportOperationalError } from './_monitoring.js';
import { getServerEnv } from './_env.js';
import { extractText, getDocumentProxy } from 'unpdf';

const responseCache = new Map();
const CACHE_TTL_MS = 60 * 60 * 1000;
const SAFE_STATUSES = new Set(['Verified']);
const SOURCE_AGREEMENT_TOLERANCE = 0.025;
const MAX_MANUFACTURER_PDF_BYTES = 8 * 1024 * 1024;
const MAX_MANUFACTURER_PDF_PAGES = 12;
const MAX_MANUFACTURER_TEXT_CHARS = 16_000;
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

function openAiOutputText(payload) {
  if (text(payload?.output_text)) return text(payload.output_text);
  return (Array.isArray(payload?.output) ? payload.output : []).flatMap((item) =>
    Array.isArray(item?.content) ? item.content : []
  ).filter((item) => item?.type === 'output_text').map((item) => text(item?.text)).join('\n');
}

function openAiCitations(payload) {
  const output = Array.isArray(payload?.output) ? payload.output : [];
  const annotations = output.flatMap((item) =>
    Array.isArray(item?.content) ? item.content : []
  ).flatMap((item) => Array.isArray(item?.annotations) ? item.annotations : [])
    .map((annotation) => annotation?.url || annotation?.url_citation?.url)
    .map(cleanUrl);
  const toolSources = output.filter((item) => item?.type === 'web_search_call')
    .flatMap((item) => Array.isArray(item?.action?.sources) ? item.action.sources : [])
    .map((source) => cleanUrl(source?.url));
  return [...annotations, ...toolSources].filter(Boolean);
}

function openAiSearchPayload(payload) {
  return {
    results: parseJson(openAiOutputText(payload)).results || [],
    citations: openAiCitations(payload),
  };
}

async function callOpenAi(apiKey, { instructions, input, useWebSearch = false, timeout = 45_000 }) {
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    signal: AbortSignal.timeout(timeout),
    body: JSON.stringify({
      model: getServerEnv('EQUIPMENT_SEARCH_MODEL') || 'gpt-5.6-luna',
      instructions,
      input,
      ...(useWebSearch ? {
        tools: [{ type: 'web_search', search_context_size: 'low' }],
        include: ['web_search_call.action.sources'],
      } : {}),
    }),
  });
  if (!response.ok) {
    const error = new Error(response.status === 429
      ? 'Equipment web research is temporarily rate-limited. Please retry in a minute.'
      : `OpenAI request failed (${response.status}).`);
    error.status = response.status === 429 ? 429 : 502;
    error.retryAfter = response.status === 429 ? Number(response.headers.get('retry-after')) || 60 : undefined;
    throw error;
  }
  return response.json();
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

function conservativeSpecs(evidence = []) {
  const manufacturer = evidence.find((source) => source.is_manufacturer);
  if (manufacturer) return manufacturer;
  const complete = evidence.filter(hasCompleteSpecs);
  return {
    operating_weight_lbs: Math.max(...complete.map((source) => source.operating_weight_lbs)),
    width_in: Math.max(...complete.map((source) => source.width_in)),
    height_in: Math.max(...complete.map((source) => source.height_in)),
  };
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

async function extractPdfText(url) {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(12_000),
    headers: { Accept: 'application/pdf,application/octet-stream;q=0.9' },
  });
  if (!response.ok) throw new Error(`Manufacturer PDF fetch failed (${response.status}).`);
  const declaredSize = Number(response.headers.get('content-length'));
  if (Number.isFinite(declaredSize) && declaredSize > MAX_MANUFACTURER_PDF_BYTES) throw new Error('Manufacturer PDF is too large.');
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength > MAX_MANUFACTURER_PDF_BYTES) throw new Error('Manufacturer PDF is too large.');
  const pdf = await getDocumentProxy(bytes);
  try {
    if (pdf.numPages > MAX_MANUFACTURER_PDF_PAGES) throw new Error('Manufacturer PDF has too many pages.');
    const { text: extracted } = await extractText(pdf, { mergePages: true });
    return text(extracted).slice(0, MAX_MANUFACTURER_TEXT_CHARS);
  } finally {
    await pdf.destroy?.();
  }
}

async function extractManufacturerSpecs(url, make, model, openAiApiKey) {
  const documentText = await extractPdfText(url);
  if (!documentText) return null;
  const payload = await callOpenAi(openAiApiKey, {
    instructions: 'Extract exact equipment transport specs from the supplied manufacturer PDF text only. Do not browse, infer, estimate, or use outside knowledge. Use overall/stowed machine width and overall/stowed machine height, not track width, lift height, reach, or an attachment dimension. Return only JSON: {"operating_weight_lbs":number,"transport_width_in":number,"transport_height_in":number}. Return null when all three cannot be established for one exact model/configuration.',
    input: `Manufacturer: ${make}; model: ${model}; source URL: ${url}\n\nPDF text:\n${documentText}`,
    timeout: 25_000,
  });
  const parsed = parseJson(openAiOutputText(payload));
  return hasCompleteSpecs(parsed) ? {
    operating_weight_lbs: specNumber(parsed, 'operating_weight_lbs'),
    transport_width_in: specNumber(parsed, 'width_in'),
    transport_height_in: specNumber(parsed, 'height_in'),
  } : null;
}

export async function enrichManufacturerPdfResults(payload, query, openAiApiKey) {
  const parsed = parseJson(payload?.choices?.[0]?.message?.content);
  const candidates = Array.isArray(parsed?.results) ? parsed.results : [];
  let changed = false;
  for (const item of candidates) {
    if (hasCompleteSpecs(item)) continue;
    const source = (Array.isArray(item?.evidence) ? item.evidence : []).find((entry) => entry?.is_manufacturer === true && /\.pdf(?:$|[?#])/i.test(text(entry?.url)));
    if (!source) continue;
    try {
      const extracted = await extractManufacturerSpecs(cleanUrl(source.url), text(item.make), text(item.model), openAiApiKey);
      if (!extracted) continue;
      Object.assign(item, extracted);
      Object.assign(source, extracted);
      changed = true;
    } catch { /* An unreadable manufacturer document is simply not a usable source. */ }
  }
  return changed ? normalizeSourcedResults({ results: candidates }, query) : [];
}

export function normalizeSourcedResults(payload, query = '') {
  const parsed = typeof payload?.choices?.[0]?.message?.content === 'string' ? parseJson(payload.choices[0].message.content) : payload;
  const allowedUrls = allowedSourceUrls(payload);
  return (Array.isArray(parsed?.results) ? parsed.results : []).map((item, index) => {
    // Sonar frequently returns the extracted specs on the result, while its
    // citation records contain URL metadata only. The prompt requires each
    // cited source to support these exact values, so retain the result-level
    // values for such citations instead of discarding a valid match.
    const itemSpecs = {
      operating_weight_lbs: specNumber(item, 'operating_weight_lbs'),
      width_in: specNumber(item, 'width_in'),
      height_in: specNumber(item, 'height_in'),
    };
    let evidence = (Array.isArray(item?.evidence) ? item.evidence : []).map((source) => ({
      url: cleanUrl(source?.url), title: text(source?.title), publisher: text(source?.publisher),
      is_manufacturer: source?.is_manufacturer === true,
      operating_weight_lbs: specNumber(source, 'operating_weight_lbs') || itemSpecs.operating_weight_lbs,
      width_in: specNumber(source, 'width_in') || itemSpecs.width_in,
      height_in: specNumber(source, 'height_in') || itemSpecs.height_in,
    })).filter((source) => source.url && (allowedUrls.size
      ? allowedUrls.has(source.url)
      // Vercel AI Gateway's Perplexity adapter can omit the separate citations
      // collection for JSON-only responses. In that case retain only a direct
      // manufacturer URL that agrees with the result's stated make/publisher.
      : source.is_manufacturer && isManufacturerDomain({ ...source, make: item?.make })));
    // Some AI Gateway providers return canonical citations separately from the
    // JSON response, so their URLs do not byte-match the model's evidence URLs.
    // Use only those provider-returned citations; never admit a model-invented URL.
    if (!evidence.some((source) => source.is_manufacturer) && evidence.length < 2 && hasCompleteSpecs(item)) {
      const fallbackUrls = [...allowedUrls].filter((url) => !evidence.some((source) => source.url === url)).slice(0, 2 - evidence.length);
      evidence = [...evidence, ...fallbackUrls.map((url) => ({ ...itemSpecs, url, title: '', publisher: '', is_manufacturer: false }))];
    }
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
    const openAiApiKey = getServerEnv('OPENAI_API_KEY');
    if (!openAiApiKey) return res.status(200).json({ results: [], source: '', error: 'Equipment web research is unavailable.' });

    const openAiPayload = await callOpenAi(openAiApiKey, {
      useWebSearch: true,
      instructions: 'You research transport specifications for heavy equipment. Always use web search. Return JSON only, with no Markdown or prose. Returned evidence URLs must be actual web-search sources; never invent URLs.',
      input: `Search the live web for up to three likely exact matches for "${query}". Normalize common brand aliases, punctuation, spacing, partial model numbers, serial numbers, and model-year text. Never estimate, merge configurations, or combine values from separate sources. For each match establish operating weight (lbs), transport height (in), and transport width (in) for one exact configuration. Prefer a manufacturer product page or manufacturer PDF; read the overall/stowed dimensions shown in a spec drawing, never lift height, track width, or attachment reach. A manufacturer page/PDF is Verified. Otherwise include a match only with two agreeing non-manufacturer sources and mark it Unverified. Exclude incomplete or conflicting matches. Return JSON only, with no Markdown: {"results":[{"make":"","model":"","configuration":null,"serial_number":null,"operating_weight_lbs":0,"transport_height_in":0,"transport_width_in":0,"evidence":[{"url":"https://...","title":"","publisher":"","is_manufacturer":false,"operating_weight_lbs":0,"transport_height_in":0,"transport_width_in":0}]}]}. Evidence URLs must be the actual web-search sources. Use an empty results array if any required measurement cannot be sourced; never use 0 as a placeholder.`,
    });
    const sourcedPayload = openAiSearchPayload(openAiPayload);
    let results = normalizeSourcedResults(sourcedPayload, query);
    if (!results.length) results = await enrichManufacturerPdfResults({
      ...sourcedPayload,
      choices: [{ message: { content: JSON.stringify(sourcedPayload) } }],
    }, query, openAiApiKey);
    await persistSafeResults(results, admin, profile.company_id);
    const payload = { results, source: results.length ? 'web' : '', error: results.length ? '' : 'No sourced exact-model specifications found.' };
    if (results.length) responseCache.set(cacheKey, { payload, expiresAt: Date.now() + CACHE_TTL_MS });
    return res.status(200).json(payload);
  } catch (error) {
    void reportOperationalError(error, { event: 'provider_failure', route: '/api/searchEquipment', provider: 'openai' });
    return sendApiError(res, error, 'Equipment search failed.', { route: '/api/searchEquipment', provider: 'openai' });
  }
}
