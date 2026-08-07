import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const envCandidates = [
  path.resolve(moduleDir, '.env'),
  path.resolve(process.cwd(), '.env'),
  path.resolve(process.cwd(), '.env.local'),
];

function loadEnvFile() {
  for (const envPath of envCandidates) {
    if (!fs.existsSync(envPath)) {
      continue;
    }

    const parsed = {};
    for (const rawLine of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) {
        continue;
      }

      const separatorIndex = line.indexOf('=');
      if (separatorIndex === -1) {
        continue;
      }

      const key = line.slice(0, separatorIndex).trim();
      let value = line.slice(separatorIndex + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }

      parsed[key] = value;
    }

    return parsed;
  }

  return {};
}

let envValues = loadEnvFile();

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

function getEnvValue(...keys) {
  envValues = loadEnvFile();

  for (const key of keys) {
    const value = envValues[key] || process.env[key];
    if (value) {
      return value;
    }
  }

  return '';
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

function parseGeminiPayload(rawText) {
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
    console.warn('Gemini payload was not valid JSON:', error);
  }

  return [];
}

function normalizeGeminiResults(payload, query = '') {
  const items = Array.isArray(payload) ? payload : parseGeminiPayload(payload);
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

      const normalizedItem = normalizeEquipmentItem({
        ...item,
        make,
        model,
        serial_number: serialNumber || null,
        operating_weight_lbs: operatingWeightLbs,
        width_ft: item?.width_ft ?? nested?.width_ft ?? item?.width ?? nested?.width ?? null,
        height_ft: item?.height_ft ?? nested?.height_ft ?? item?.height ?? nested?.height ?? null,
        source: item?.source || 'gemini',
      });

      return {
        ...normalizedItem,
        make,
        model,
        serial_number: serialNumber || null,
        operating_weight_lbs: operatingWeightLbs,
        source: item?.source || 'gemini',
      };
    })
    .slice(0, 8);
}

async function persistGeminiResults(results, supabaseUrl, supabaseKey) {
  if (!Array.isArray(results) || results.length === 0 || !supabaseUrl || !supabaseKey) {
    return;
  }

  const serviceRoleKey =
    process.env.VITE_SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!serviceRoleKey) {
    return;
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  for (const item of results) {
    try {
      if (!item?.make || !item?.model) {
        continue;
      }

      const candidate = {
        make: item.make,
        model: item.model,
        serial_number: item.serial_number || null,
        operating_weight_lbs: item.operating_weight_lbs ?? null,
        width_ft: item.width_ft ?? null,
        height_ft: item.height_ft ?? null,
        source: item.source || 'gemini',
      };

      let query = supabaseAdmin.from('equipment_specs').select('id').limit(1);
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
      if (existing?.id) {
        await supabaseAdmin.from('equipment_specs').update(candidate).eq('id', existing.id);
      } else {
        await supabaseAdmin.from('equipment_specs').insert(candidate);
      }
    } catch (error) {
      console.warn('Failed to persist Gemini equipment result:', error);
    }
  }
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const query = String(req.query?.query || '').trim();
    if (!query) {
      return res.status(200).json([]);
    }

    const supabaseUrl = getEnvValue('VITE_SUPABASE_URL', 'SUPABASE_URL');
    const supabaseKey = getEnvValue('VITE_SUPABASE_ANON_KEY', 'SUPABASE_ANON_KEY');

    let results = [];
    let source = '';
    let error = '';

    if (supabaseUrl && supabaseKey) {
      const supabase = createClient(supabaseUrl, supabaseKey);
      const { data, error: supabaseError } = await supabase
        .from('equipment_specs')
        .select('*')
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

    const geminiKey = getEnvValue(
      'GEMINI_API_KEY',
      'VITE_GEMINI_API_KEY',
      'VITE_GOOGLE_GEMINI_API_KEY'
    );

    if (results.length === 0) {
      if (!geminiKey) {
        return res.status(200).json({
          results: [],
          source: '',
          error: 'Gemini key not configured. Add VITE_GOOGLE_GEMINI_API_KEY to .env.',
        });
      }

      try {
        const geminiResponse = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=${geminiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [
                {
                  parts: [
                    {
                      text: `You are a towing-quote assistant. For the equipment query "${query}", return ONLY valid JSON. Return a JSON array of up to 3 likely equipment matches. Each object must include these exact keys: make, model, serial_number, operating_weight_lbs, width_in, height_in, source. IMPORTANT: infer a realistic make/model from the query whenever possible and do not use "Unknown" unless you truly cannot infer. For operating weight, use the most plausible published operating weight for the specific model family rather than an overly conservative low estimate, if there is a published weight *range*, return options for realistic weights for the lower bound, median, and upper bound of the weight range; if you are uncertain, use a realistic mid-to-upper estimate from the common model range. Express dimensions as inches. Do not include extra commentary.`,
                    },
                  ],
                },
              ],
              generationConfig: {
                responseMimeType: 'application/json',
              },
            }),
          }
        );

        if (geminiResponse.ok) {
          const geminiPayload = await geminiResponse.json();
          const rawText = geminiPayload?.candidates?.[0]?.content?.parts?.[0]?.text || '[]';

          try {
            results = normalizeGeminiResults(rawText, query);
            source = results.length > 0 ? 'gemini' : '';

            if (results.length > 0 && supabaseUrl && supabaseKey) {
              await persistGeminiResults(results, supabaseUrl, supabaseKey);
            }
          } catch (parseErr) {
            console.warn('Gemini response was not valid JSON:', parseErr);
            return res.status(200).json({
              results: [],
              source: '',
              error: `Gemini returned invalid JSON: ${parseErr.message}`,
            });
          }
        } else {
          const errorText = await geminiResponse.text();
          const fallbackMatches = getFallbackEquipmentMatches(query);
          return res.status(200).json({
            results: fallbackMatches.slice(0, 8),
            source: fallbackMatches.length > 0 ? 'fallback' : '',
            error: `Gemini request failed: ${geminiResponse.status} ${errorText}`,
          });
        }
      } catch (geminiError) {
        const fallbackMatches = getFallbackEquipmentMatches(query);
        return res.status(200).json({
          results: fallbackMatches.slice(0, 8),
          source: fallbackMatches.length > 0 ? 'fallback' : '',
          error: `Gemini request failed: ${geminiError.message}`,
        });
      }
    }

    return res.status(200).json({
      results: results.slice(0, 8),
      source,
      error,
    });
  } catch (error) {
    console.error('Equipment search API failed:', error);
    return res.status(500).json({ error: error.message || 'Equipment search failed.' });
  }
}
