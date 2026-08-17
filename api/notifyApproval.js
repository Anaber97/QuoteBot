import { enforceRateLimit, escapeHtml, requireUser, sendApiError } from './_security.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const payload = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
    const { admin, profile } = await requireUser(req);
    enforceRateLimit(`approval:${profile.id}`, { limit: 10, windowMs: 60 * 60 * 1000 });
    const { data: config } = await admin.from('app_config').select('client_portal').eq('company_id', profile.company_id).maybeSingle();
    const configuredRecipient = String(config?.client_portal?.contact_email || '').trim();
    const { data: managers } = configuredRecipient ? { data: [] } : await admin.from('profiles').select('email').eq('company_id', profile.company_id).eq('role', 'manager').limit(1);
    const recipient = configuredRecipient || managers?.[0]?.email;
    if (!recipient) return res.status(400).json({ error: 'No approval recipient is configured.' });

    const safe = (value, fallback = 'N/A') => escapeHtml(value || fallback);
    const emailBody = {
      to: recipient,
      subject: `Custom quote approval requested for ${String(payload.equipmentName || 'a client load').slice(0, 120)}`,
      html: `<p>A client quote approval request was submitted.</p><ul>
        <li>Company: ${safe(payload.companyName, 'Unknown')}</li><li>Equipment: ${safe(payload.equipmentName, 'Unknown')}</li>
        <li>Make: ${safe(payload.make)}</li><li>Model: ${safe(payload.model)}</li><li>Serial Number: ${safe(payload.serialNumber)}</li>
        <li>Estimated weight: ${safe(payload.weight, '0')} lbs</li><li>Pickup: ${safe(payload.pickupAddr)}</li><li>Dropoff: ${safe(payload.dropoffAddr)}</li>
        <li>Quote amount: ${safe(payload.quoteAmount)}</li><li>Quote range: ${safe(payload.quoteRange)}</li>
        <li>Permit flags: ${safe(payload.permitFlags?.length ? payload.permitFlags.join(', ') : 'None')}</li>
        <li>Attachment: ${safe(payload.attachmentName || payload.attachmentTypeLabel, 'None')}</li></ul>
        <p>Please review the quote and contact the client at ${safe(payload.contactPhone)} or ${safe(payload.contactEmail)}.</p>`,
    };
    const { error } = await admin.functions.invoke('send-quote-approval-email', { body: emailBody });
    if (error) throw error;
    return res.status(200).json({ success: true });
  } catch (error) {
    return sendApiError(res, error, 'Approval notification failed.');
  }
}
