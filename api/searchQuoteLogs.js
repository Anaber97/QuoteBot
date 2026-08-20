import { canAccessQuote, enforceRateLimit, requireUser, sendApiError } from './_security.js';

const PAGE_SIZE = 20;
const searchableText = (quote) => {
  const equipment = quote.quote_details && typeof quote.quote_details === 'object' ? quote.quote_details : {};
  const reference = quote.quote_reference || `Q-${String(quote.id || '').slice(0, 8).toUpperCase()}`;
  return [quote.id, reference, quote.customer_name, quote.customer_phone, equipment.make, equipment.model, equipment.name, equipment.equipmentName]
    .map((value) => String(value || '').toLowerCase())
    .join(' ');
};

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
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
    const accessible = (data || []).filter((quote) => canAccessQuote(profile, quote, 'read'));
    const matches = accessible.filter((quote) => searchableText(quote).includes(query));
    const start = page * PAGE_SIZE;
    return res.status(200).json({ quotes: matches.slice(start, start + PAGE_SIZE), hasMore: matches.length > start + PAGE_SIZE });
  } catch (error) {
    return sendApiError(res, error, 'Quote search failed.', { route: '/api/searchQuoteLogs', provider: 'database' });
  }
}
