import { createUserClient, enforceRateLimit, requireUser, sendApiError } from './_security.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const { admin, profile, token } = await requireUser(req);
    await enforceRateLimit(admin, `quote-search:${profile.id}`, { limit: 120, windowMs: 60 * 60 * 1000 });
    const query = String(req.query?.q || '').trim().slice(0, 160);
    const page = Math.max(0, Math.min(500, Number.parseInt(req.query?.page, 10) || 0));
    res.setHeader('Cache-Control', 'private, no-store');
    if (!query) return res.status(200).json({ quotes: [], hasMore: false });
    // User-scoped client is deliberate: database RLS applies to this RPC.
    const { data, error } = await createUserClient(token).rpc('search_quotes', { p_query: query, p_page: page });
    if (error) throw error;
    return res.status(200).json({ quotes: (data || []).slice(0, 20), hasMore: (data || []).length > 20 });
  } catch (error) {
    return sendApiError(res, error, 'Quote search failed.', { route: '/api/searchQuotes', provider: 'database' });
  }
}
