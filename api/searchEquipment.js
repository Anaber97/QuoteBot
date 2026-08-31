import { enforceRateLimit, requireUser, sendApiError } from './_security.js';
import { reportOperationalError } from './_monitoring.js';
import { getServerEnv } from './_env.js';

const responseCache = new Map();
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

const LOCAL_FALLBACK_EQUIPMENT = [
  {
    make: 'Caterpillar',
    model: '320D',
    serial_number: 'CAT320D-001',
    operating_weight_lbs: 45000,
    width_in: 102,
    height_in: 138,
    source: 'fallback',
  },
  {
    make: 'Caterpillar',
    model: '320E',
    serial_number: 'CAT320E-001',
    operating_weight_lbs: 48000,
    width_in: 102,
    height_in: 144,
    source: 'fallback',
  },
  {
    make: 'John Deere',
    model: '850J',
    serial_number: 'JD850J-001',
    operating_weight_lbs: 52000,
    width_in: 108,
    height_in: 150,
    source: 'fallback',
  },
];

function getFallbackEquipmentMatches(query) {
  const cleanQuery = String(query || '').trim().toLowerCase();
  if (!cleanQuery) {
    return [];
  }

  return LOCAL_FALLBACK_EQUIPMENT.filter((item) => {
    const haystack = [
      item.make,
      item.model,
      item.serial_number,
      `${item.make} ${item.model}`,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    return haystack.includes(cleanQuery);
  }).map((item) => ({ ...item }));
}

function coerceString(value) {
  if (value == null) {
    return '';
  }

  if (typeof value === 'string') {
    return value.trim();
  }

  return String(value).trim();
}

function extractValue(item, keys) {
  if (!item || typeof item !== 'object') {
    return '';
  }

  for (const key of keys) {
    const value = item[key];
    const text = coerceString(value);
    if (text) {
      return text;
    }
  }

  return '';
}

function extractNumericValue(item, keys) {
  if (!item || typeof item !== 'object') {
    return null;
  }

  for (const key of keys) {
    const value = item[key];
    if (value == null || value === '') {
      continue;
    }

    const numericValue = Number(value);
    if (Number.isFinite(numericValue) && numericValue > 0) {
      return numericValue;
    }
  }

  const nested = item?.equipment || item?.specs || item?.details || null;
  if (nested && typeof nested === 'object') {
    return extractNumericValue(nested, keys);
  }

  return null;
}

function inferMakeModelFromQuery(query) {
  const cleaned = coerceString(query);
  if (!cleaned) {
    return { make: '', model: '' };
  }

  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return { make: '', model: '' };
  }

  if (parts.length === 1) {
    return { make: parts[0], model: '' };
  }

  return {
    make: parts[0],
    model: parts.slice(1).join(' '),
  };
}

function normalizeDimensionValue(value, sourceHint = '') {
  if (value == null || value === '') {
    return null;
  }

  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return null;
  }

  if (sourceHint && /ft|feet/i.test(sourceHint)) {
    return numericValue * 12;
  }

  return numericValue;
}

function normalizeEquipmentItem(item) {
  if (!item || typeof item !== 'object') {
    return item;
  }

  const nested = item?.equipment || item?.specs || item?.details || null;
  const widthIn = normalizeDimensionValue(
    item?.width_in ?? item?.width_inches ?? nested?.width_in ?? nested?.width_inches ?? item?.width_ft ?? nested?.width_ft ?? item?.width ?? nested?.width,
    item?.width_ft != null || nested?.width_ft != null ? 'ft' : ''
  );
  const heightIn = normalizeDimensionValue(
    item?.height_in ?? item?.height_inches ?? nested?.height_in ?? nested?.height_inches ?? item?.height_ft ?? nested?.height_ft ?? item?.height ?? nested?.height,
    item?.height_ft != null || nested?.height_ft != null ? 'ft' : ''
  );

  return {
    ...item,
    width_in: widthIn ?? null,
    height_in: heightIn ?? null,
    width_ft: widthIn == null ? null : Number((widthIn / 12).toFixed(1)),
    height_ft: heightIn == null ? null : Number((heightIn / 12).toFixed(1)),
  };
}

function parseAiPayload(rawText) {
  const cleaned = coerceString(rawText).replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim();

  try {
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed)) {
      return parsed;
    }

    if (Array.isArray(parsed?.results)) {
      return parsed.results;
    }

    if (Array.isArray(parsed?.items)) {
      return parsed.items;
    }

    if (parsed && typeof parsed === 'object') {
      return [parsed];
    }
  } catch (error) {
    console.warn('AI Gateway payload was not valid JSON:', error);
  }

  return [];
}

function normalizeAiResults(payload, query = '') {
  const items = Array.isArray(payload) ? payload : parseAiPayload(payload);
  const fallback = inferMakeModelFromQuery(query);

  return items
    .filter(Boolean)
    .map((item) => {
      const nested = item?.equipment || item?.specs || item?.details || null;
      const make = extractValue(item, ['make', 'manufacturer', 'brand', 'equipment_make', 'manufacturer_name'])
        || extractValue(nested, ['make', 'manufacturer', 'brand', 'equipment_make', 'manufacturer_name'])
        || fallback.make
        || 'Unknown';
      const model = extractValue(item, ['model', 'model_name', 'equipment_model', 'modelNumber', 'name', 'equipment_name'])
        || extractValue(nested, ['model', 'model_name', 'equipment_model', 'modelNumber', 'name', 'equipment_name'])
        || fallback.model
        || 'Unknown';
      const serialNumber = extractValue(item, ['serial_number', 'serialNumber', 'serial', 'serial_no']) || null;
      const operatingWeightLbs = extractNumericValue(
        { ...item, ...(nested || {}) },
        ['operating_weight_lbs', 'operating_weight_lb', 'operating_weight', 'weight_lbs', 'weight_lb', 'weight', 'estimated_weight_lbs']
      );
      const requestedConfidence = coerceString(item?.confidence).toLowerCase();
      const confidence = ['low', 'medium', 'high'].includes(requestedConfidence)
        ? requestedConfidence
        : (operatingWeightLbs && make !== 'Unknown' && model !== 'Unknown' ? 'medium' : 'low');

      const normalizedItem = normalizeEquipmentItem({
        ...item,
        make,
        model,
        serial_number: serialNumber || null,
        operating_weight_lbs: operatingWeightLbs,
        width_ft: item?.width_ft ?? nested?.width_ft ?? item?.width ?? nested?.width ?? null,
        height_ft: item?.height_ft ?? nested?.height_ft ?? item?.height ?? nested?.height ?? null,
        source: 'ai-gateway',
        confidence,
      });

      return {
        ...normalizedItem,
        make,
        model,
        serial_number: serialNumber || null,
        operating_weight_lbs: operatingWeightLbs,
        source: 'ai-gateway',
        confidence,
      };
    })
    .slice(0, 8);
}

function normalizeSearchText(value) {
  return coerceString(value).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function hasPlausibleSpecs(item) {
  const weight = Number(item?.operating_weight_lbs);
  const width = Number(item?.width_in);
  const height = Number(item?.height_in);

  return Number.isFinite(weight) && weight >= 500 && weight <= 500000
    && Number.isFinite(width) && width >= 24 && width <= 300
    && Number.isFinite(height) && height >= 24 && height <= 300;
}

export function isHighConfidenceEquipmentResult(item, query = '') {
  if (coerceString(item?.confidence).toLowerCase() !== 'high' || !hasPlausibleSpecs(item)) {
    return false;
  }

  const make = normalizeSearchText(item?.make);
  const model = normalizeSearchText(item?.model);
  const serial = normalizeSearchText(item?.serial_number);
  const queryText = normalizeSearchText(query);
  if (!make || !model || !queryText || make === 'unknown' || model === 'unknown') {
    return false;
  }

  if (serial && queryText === serial) {
    return true;
  }

  const queryTokens = queryText.split(' ').filter(Boolean);
  const candidateTokens = `${make} ${model}`.split(' ').filter(Boolean);
  if (queryTokens.length < 2) {
    return false;
  }

  return queryTokens.every((queryToken) => candidateTokens.some((candidateToken) => (
    candidateToken === queryToken
    || (queryToken.length >= 3 && candidateToken.startsWith(queryToken))
  )));
}

async function persistHighConfidenceResults(results, supabaseAdmin, companyId, queryText) {
  if (!Array.isArray(results) || results.length === 0 || !supabaseAdmin || !companyId) {
    return;
  }

  for (const item of results) {
    try {
      if (!isHighConfidenceEquipmentResult(item, queryText)) {
        continue;
      }

      const candidate = {
        company_id: companyId,
        make: item.make,
        model: item.model,
        serial_number: item.serial_number || null,
        operating_weight_lbs: item.operating_weight_lbs ?? null,
        width_ft: item.width_ft ?? null,
        height_ft: item.height_ft ?? null,
        width_in: item.width_in ?? null,
        height_in: item.height_in ?? null,
        source: 'ai-gateway',
      };

      let query = supabaseAdmin.from('equipment_specs').select('id').eq('company_id', companyId).limit(1);
      if (candidate.serial_number) {
        query = query.eq('serial_number', candidate.serial_number);
      } else {
        query = query.ilike('make', candidate.make).ilike('model', candidate.model);
      }

      const { data: existingRows, error: selectError } = await query;
      if (selectError) {
        console.warn('Unable to check for existing equipment row:', selectError);
        continue;
      }

      const existing = existingRows?.[0];
      if (!existing?.id) {
        await supabaseAdmin.from('equipment_specs').insert(candidate);
      }
    } catch (error) {
      console.warn('Failed to persist high-confidence AI equipment result:', error);
    }
  }
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const rawQuery = String(req.query?.query || '').trim();
    if (!rawQuery) {
      return res.status(200).json([]);
    }
    if (rawQuery.length < 2 || rawQuery.length > 80) return res.status(400).json({ error: 'Search must be 2 to 80 characters.' });
    const query = rawQuery.replace(/[,%()]/g, ' ').replace(/\s+/g, ' ').trim();
    const { admin, profile } = await requireUser(req);
    await enforceRateLimit(admin, `equipment-search:${profile.id}`, { limit: 120, windowMs: 60 * 60 * 1000 });

    const cacheKey = `${profile.company_id}:${query.toLowerCase()}`;
    const cached = responseCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return res.status(200).json(cached.payload);

    const supabaseUrl = getServerEnv('SUPABASE_URL') || getServerEnv('VITE_SUPABASE_URL');

    let results = [];
    let source = '';
    let error = '';

    if (supabaseUrl) {
      const { data, error: supabaseError } = await admin
        .from('equipment_specs')
        .select('*')
        .or(`company_id.is.null,company_id.eq.${profile.company_id}`)
        .or(`make.ilike.%${query.toLowerCase()}%,model.ilike.%${query.toLowerCase()}%,serial_number.ilike.%${query.toLowerCase()}%`)
        .limit(8);

      if (!supabaseError) {
        results = data || [];
        source = results.length > 0 ? 'supabase' : '';
      }
    }

    const fallbackResults = getFallbackEquipmentMatches(query);
    if (results.length === 0 && fallbackResults.length > 0) {
      results = fallbackResults;
      source = 'fallback';
    }

    const gatewayToken = getServerEnv('AI_GATEWAY_API_KEY') || getServerEnv('VERCEL_OIDC_TOKEN');
    const gatewayModel = getServerEnv('AI_GATEWAY_MODEL') || 'openai/gpt-5-nano';
    const gatewayFallbackModel = getServerEnv('AI_GATEWAY_FALLBACK_MODEL') || 'anthropic/claude-haiku-4.5';

    if (results.length === 0) {
      await enforceRateLimit(admin, `ai-gateway:${profile.id}`, { limit: 20, windowMs: 24 * 60 * 60 * 1000 });
      if (!gatewayToken) {
        return res.status(200).json({
          results: [],
          source: '',
          error: 'AI Gateway authentication is unavailable. Enable Vercel OIDC or set AI_GATEWAY_API_KEY.',
        });
      }

      try {
        const gatewayResponse = await fetch(
          'https://ai-gateway.vercel.sh/v1/chat/completions',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${gatewayToken}`,
            },
            body: JSON.stringify({
              model: gatewayModel,
              messages: [
                {
                  role: 'system',
                  content: 'You identify heavy equipment for towing quotes. Never invent specifications. Use high confidence only when the make, exact model, operating weight, width, and height are known for that exact model. Use medium for model-family estimates and low for broad inferences.',
                },
                {
                  role: 'user',
                  content: `Find up to 3 likely equipment matches for "${query}". Express weight in pounds and dimensions in inches. Return an empty results array when there is not enough information.`,
                },
              ],
              stream: false,
              providerOptions: {
                gateway: {
                  models: [gatewayFallbackModel],
                  user: profile.id,
                  tags: ['feature:equipment-search'],
                },
              },
              response_format: {
                type: 'json_schema',
                json_schema: {
                  name: 'equipment_search_results',
                  strict: true,
                  schema: {
                    type: 'object',
                    properties: {
                      results: {
                        type: 'array',
                        maxItems: 3,
                        items: {
                          type: 'object',
                          properties: {
                            make: { type: 'string' },
                            model: { type: 'string' },
                            serial_number: { type: ['string', 'null'] },
                            operating_weight_lbs: { type: 'number' },
                            width_in: { type: 'number' },
                            height_in: { type: 'number' },
                            confidence: { type: 'string', enum: ['low', 'medium', 'high'] },
                          },
                          required: ['make', 'model', 'serial_number', 'operating_weight_lbs', 'width_in', 'height_in', 'confidence'],
                          additionalProperties: false,
                        },
                      },
                    },
                    required: ['results'],
                    additionalProperties: false,
                  },
                },
              },
            }),
          }
        );

        if (gatewayResponse.ok) {
          const gatewayPayload = await gatewayResponse.json();
          const rawText = gatewayPayload?.choices?.[0]?.message?.content || '{"results":[]}';

          try {
            const parsedPayload = JSON.parse(rawText);
            results = normalizeAiResults(parsedPayload?.results || [], query);
            source = results.length > 0 ? 'ai-gateway' : '';

            if (results.length > 0) {
              await persistHighConfidenceResults(results, admin, profile.company_id, query);
            }
          } catch (parseErr) {
            console.warn('AI Gateway response was not valid JSON:', parseErr);
            return res.status(200).json({
              results: [],
              source: '',
              error: `AI Gateway returned invalid data: ${parseErr.message}`,
            });
          }
        } else {
          const errorText = await gatewayResponse.text();
          let providerMessage = `AI Gateway request failed (${gatewayResponse.status}).`;
          try {
            const parsedError = JSON.parse(errorText);
            providerMessage = parsedError?.error?.message || parsedError?.message || providerMessage;
          } catch {
            // Keep the concise status message when the provider returns non-JSON.
          }
          const fallbackMatches = getFallbackEquipmentMatches(query);
          return res.status(200).json({
            results: fallbackMatches.slice(0, 8),
            source: fallbackMatches.length > 0 ? 'fallback' : '',
            error: providerMessage,
          });
        }
      } catch (gatewayError) {
        void reportOperationalError(gatewayError, { event: 'provider_failure', route: '/api/searchEquipment', provider: 'ai-gateway' });
        const fallbackMatches = getFallbackEquipmentMatches(query);
        return res.status(200).json({
          results: fallbackMatches.slice(0, 8),
          source: fallbackMatches.length > 0 ? 'fallback' : '',
          error: `AI Gateway request failed: ${gatewayError.message}`,
        });
      }
    }

    const payload = {
      results: results.slice(0, 8),
      source,
      error,
    };
    responseCache.set(cacheKey, { payload, expiresAt: Date.now() + CACHE_TTL_MS });
    return res.status(200).json(payload);
  } catch (error) {
    return sendApiError(res, error, 'Equipment search failed.', { route: '/api/searchEquipment', provider: 'ai-gateway' });
  }
}
