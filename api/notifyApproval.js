import { sendStoredApprovalEmail } from './_approvalEmail.js';
import { canAccessQuote, enforceRateLimit, requireUser, sendApiError } from './_security.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const payload = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
    const quoteId = String(payload.quoteId || '').trim();
    if (!quoteId) return res.status(400).json({ error: 'quoteId is required.' });
    const { admin, profile } = await requireUser(req);
    await enforceRateLimit(admin, `approval:${profile.id}`, { limit: 10, windowMs: 60 * 60 * 1000 });
    const { data: quote, error: quoteError } = await admin.from('quote_logs').select('*').eq('id', quoteId).eq('company_id', profile.company_id).single();
    if (quoteError || !quote) return res.status(404).json({ error: 'Quote not found.' });
    if (!canAccessQuote(profile, quote, 'request_dispatch')) return res.status(403).json({ error: 'You do not have access to this quote.' });
    await sendStoredApprovalEmail(admin, profile, quote);
    return res.status(200).json({ success: true });
  } catch (error) {
    return sendApiError(res, error, 'Approval notification failed.');
  }
}
