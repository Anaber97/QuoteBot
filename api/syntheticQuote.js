import { calculateAuthoritativeQuote } from './_quoteEngine.js';
import { getServerEnv } from './_env.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ status: 'error' });
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
