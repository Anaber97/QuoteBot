import { canAccessQuote, requireUser, sendApiError } from './_security.js';
import { buildQuotePdf, loadQuoteDocumentContext } from './_quoteDocument.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const quoteId = String(req.query?.quoteId || '').trim();
    if (!quoteId) return res.status(400).json({ error: 'quoteId is required.' });
    const { admin, profile } = await requireUser(req);
    const { data: quote, error } = await admin.from('quote_logs').select('*').eq('id', quoteId).eq('company_id', profile.company_id).single();
    if (error || !quote) return res.status(404).json({ error: 'Quote not found.' });
    if (!canAccessQuote(profile, quote, 'read')) return res.status(403).json({ error: 'You do not have access to this quote.' });
    const context = await loadQuoteDocumentContext(admin, quote);
    const document = await buildQuotePdf({ quote, ...context });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${document.filename}"`);
    res.setHeader('Cache-Control', 'private, no-store');
    return res.status(200).send(document.bytes);
  } catch (error) { return sendApiError(res, error, 'Unable to generate quote PDF.', { route: '/api/quotePdf', provider: 'pdf' }); }
}
