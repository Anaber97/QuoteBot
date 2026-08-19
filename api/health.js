import { createAdminClient } from './_security.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ status: 'error' });
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

