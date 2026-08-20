import { calculateAuthoritativeQuote } from './_quoteEngine.js';
import { getServerEnv } from './_env.js';
import { canAccessQuote, createAdminClient, enforceRateLimit, requireUser, sendApiError } from './_security.js';

const PAGE_SIZE = 20;
const searchableText = (quote) => {
  const equipment = quote.quote_details && typeof quote.quote_details === 'object' ? quote.quote_details : {};
  const reference = quote.quote_reference || `Q-${String(quote.id || '').slice(0, 8).toUpperCase()}`;
  return [quote.id, reference, quote.customer_name, quote.customer_phone, equipment.make, equipment.model, equipment.name, equipment.equipmentName]
    .map((value) => String(value || '').toLowerCase())
    .join(' ');
};

async function health(res) {
  const started = Date.now();
  try {
    const admin = createAdminClient();
    const { error } = await admin.from('companies').select('id', { head: true, count: 'exact' }).limit(1);
    if (error) throw error;
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ status: 'ok', database: 'ok', latencyMs: Date.now() - started });
  } catch {
    return res.status(503).json({ status: 'degraded', database: 'unavailable', latencyMs: Date.now() - started });
  }
}

function synthetic(req, res) {
  const expected = getServerEnv('SYNTHETIC_CHECK_TOKEN');
  if (!expected || req.headers?.authorization !== `Bearer ${expected}`) return res.status(401).json({ status: 'unauthorized' });
  try {
    const result = calculateAuthoritativeQuote({
      role: 'dispatch', clientConfig: null,
      input: { waypoints: ['Synthetic pickup', 'Synthetic dropoff'], equipment: {}, activeOverrides: {} },
      config: { pricing: { hourly_min: 100, hourly_max: 100, drive_time_buffer: 0, load_unload_base_mins: 30, rounding_interval: 25 }, geofences: { disabledZones: [], customZones: [] } },
      route: { rawDriveMinutes: 30, totalMeters: 1609.344, customerRoutePoints: [], legs: [] },
    });
    if (result.minQuote !== 100 || result.maxQuote !== 100) throw new Error('Unexpected synthetic calculation result.');
    return res.status(200).json({ status: 'ok', calculation: 'ok' });
  } catch {
    return res.status(503).json({ status: 'degraded', calculation: 'failed' });
  }
}

async function searchQuotes(req, res) {
  try {
    const { admin, profile } = await requireUser(req);
    await enforceRateLimit(admin, `quote-search:${profile.id}`, { limit: 120, windowMs: 60 * 60 * 1000 });
    const query = String(req.query?.q || '').trim().toLowerCase().slice(0, 160);
    const page = Math.max(0, Math.min(500, Number.parseInt(req.query?.page, 10) || 0));
    if (!query) return res.status(200).json({ quotes: [], hasMore: false });

    let databaseQuery = admin.from('quote_logs').select('*').eq('company_id', profile.company_id).order('created_at', { ascending: false }).limit(1000);
    if (profile.role === 'client') databaseQuery = databaseQuery.eq('quote_source', 'client_portal').eq('client_id', profile.client_id);
    const { data, error } = await databaseQuery;
    if (error) throw error;
    const matches = (data || []).filter((quote) => canAccessQuote(profile, quote, 'read')).filter((quote) => searchableText(quote).includes(query));
    const start = page * PAGE_SIZE;
    return res.status(200).json({ quotes: matches.slice(start, start + PAGE_SIZE), hasMore: matches.length > start + PAGE_SIZE });
  } catch (error) {
    return sendApiError(res, error, 'Quote search failed.', { route: '/api/ops?check=quote-search', provider: 'database' });
  }
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ status: 'error' });
  if (req.query?.check === 'synthetic') return synthetic(req, res);
  if (req.query?.check === 'quote-search') return searchQuotes(req, res);
  return health(res);
}
