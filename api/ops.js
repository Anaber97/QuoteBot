import { calculateAuthoritativeQuote } from './_quoteEngine.js';
import { getServerEnv } from './_env.js';
import { createAdminClient } from './_security.js';

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

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ status: 'error' });
  return req.query?.check === 'synthetic' ? synthetic(req, res) : health(res);
}

