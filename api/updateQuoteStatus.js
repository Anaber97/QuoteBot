import { canAccessQuote, enforceRateLimit, requireUser, sendApiError } from './_security.js';

const STATUSES = ['draft', 'submitted', 'approval_required', 'approved', 'dispatched', 'completed', 'cancelled'];

// Explicit state machine: only these forward transitions are allowed.
// 'completed' and 'cancelled' are terminal — no transitions out of them.
export const VALID_TRANSITIONS = {
  draft: ['submitted', 'cancelled'],
  submitted: ['approval_required', 'approved', 'dispatched', 'cancelled'],
  approval_required: ['approved', 'cancelled'],
  approved: ['dispatched', 'cancelled'],
  dispatched: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
};

export function isValidTransition(fromStatus, toStatus) {
  if (!STATUSES.includes(fromStatus) || !STATUSES.includes(toStatus)) return false;
  return (VALID_TRANSITIONS[fromStatus] || []).includes(toStatus);
}

export default async function handler(req, res) {
  if (req.method !== 'PATCH') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
    const quoteId = String(body.quoteId || '').trim();
    const status = String(body.status || '').trim();
    if (!quoteId || !STATUSES.includes(status)) return res.status(400).json({ error: 'A valid quoteId and status are required.' });
    const { admin, profile } = await requireUser(req);
    await enforceRateLimit(admin, `quote-status:${profile.id}`, { limit: 60, windowMs: 60 * 60 * 1000 });
    const { data: quote, error: quoteError } = await admin.from('quote_logs').select('id, company_id, client_id, quote_source, status').eq('id', quoteId).eq('company_id', profile.company_id).single();
    if (quoteError || !quote) return res.status(404).json({ error: 'Quote not found.' });
    if (!canAccessQuote(profile, quote, 'change_status')) return res.status(403).json({ error: 'Manager or dispatcher access is required.' });
    if (!isValidTransition(quote.status, status)) {
      return res.status(409).json({ error: `Cannot change status from "${quote.status}" to "${status}".` });
    }
    const { data, error } = await admin.from('quote_logs').update({ status }).eq('id', quoteId).eq('company_id', profile.company_id).select('id, status').single();
    if (error) throw error;
    return res.status(200).json({ success: true, quote: data });
  } catch (error) {
    return sendApiError(res, error, 'Unable to update quote status.', { route: '/api/updateQuoteStatus', provider: 'database' });
  }
}

