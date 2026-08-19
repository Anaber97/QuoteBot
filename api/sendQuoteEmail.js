import { canAccessQuote, enforceRateLimit, escapeHtml, requireUser, sendApiError } from './_security.js';

const validEmail = (value) => /^\S+@\S+\.\S+$/.test(String(value || '').trim());

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
    const quoteId = String(body.quoteId || '').trim();
    const action = ['share', 'action', 'bol_attached'].includes(body.action) ? body.action : 'action';
    if (!quoteId) return res.status(400).json({ error: 'quoteId is required.' });
    const { admin, profile } = await requireUser(req);
    await enforceRateLimit(admin, `quote-email:${profile.id}`, { limit: 30, windowMs: 60 * 60 * 1000 });

    const { data: quote, error: quoteError } = await admin.from('quote_logs').select('*').eq('id', quoteId).eq('company_id', profile.company_id).single();
    if (quoteError || !quote) return res.status(404).json({ error: 'Quote not found.' });
    if (!canAccessQuote(profile, quote, action === 'action' ? 'request_dispatch' : 'read')) return res.status(403).json({ error: 'You do not have access to this quote.' });

    const { data: config } = await admin.from('app_config').select('client_portal').eq('company_id', profile.company_id).maybeSingle();
    const portal = config?.client_portal || {};
    let recipient = String(body.recipient || '').trim();
    if (action !== 'share') {
      recipient = portal.send_jobs_to_contact_email !== false ? String(portal.contact_email || '').trim() : String(portal.dispatch_email || '').trim();
      if (!recipient) {
        const { data: managers } = await admin.from('profiles').select('email').eq('company_id', profile.company_id).eq('role', 'manager').limit(1);
        recipient = managers?.[0]?.email || '';
      }
    }
    if (!validEmail(recipient)) return res.status(400).json({ error: 'A valid recipient email is required.' });

    let bolLink = '';
    if (quote.bol_path) {
      const { data } = await admin.storage.from('quote-bols').createSignedUrl(quote.bol_path, 60 * 60 * 24);
      bolLink = data?.signedUrl || '';
    }
    const safe = (value, fallback = 'N/A') => escapeHtml(value || fallback);
    const details = quote.quote_details && typeof quote.quote_details === 'object' ? quote.quote_details : {};
    const permitFlags = Array.isArray(details.permitFlags) ? details.permitFlags.join(', ') : details.permitFlags;
    const surcharges = Object.entries(quote.applied_surcharges || {}).filter(([, enabled]) => Boolean(enabled)).map(([name]) => name).join(', ');
    const subjectPrefix = action === 'share' ? 'Transport quote' : action === 'bol_attached' ? 'BOL attached — dispatch requested' : 'Client quote ready for dispatch';
    const html = `<h2>${action === 'share' ? 'Transport Quote' : 'Client Dispatch Request'}</h2>
      <p>${action === 'share' ? 'A transport quote was shared with you.' : `Submitted for dispatch by ${safe(profile.full_name || profile.email)}.`}</p>
      <h3>Customer</h3><ul><li>Name: ${safe(quote.customer_name)}</li><li>Phone: ${safe(quote.customer_phone)}</li></ul>
      <h3>Equipment</h3><ul><li>Equipment: ${safe(details.name || details.equipmentName)}</li><li>Make: ${safe(details.make)}</li><li>Model: ${safe(details.model)}</li><li>Serial number: ${safe(details.serialNumber)}</li><li>Operating weight: ${safe(details.weight, '0')} lbs</li><li>Attachment type: ${safe(details.attachmentType, 'None')}</li><li>Attachment weight: ${safe(details.attachmentWeight, '0')} lbs</li><li>Dimensions: ${safe(details.length || details.lengthFt)} × ${safe(details.width || details.widthFt)} × ${safe(details.height || details.heightFt)}</li><li>Permit flags: ${safe(permitFlags, 'None')}</li></ul>
      <h3>Locations and Route</h3><ul><li>Pickup: ${safe(quote.pickup_address)}</li><li>Dropoff: ${safe(quote.dropoff_address)}</li><li>All stops: ${safe(Array.isArray(quote.all_waypoints) ? quote.all_waypoints.join(' → ') : '')}</li><li>Distance: ${safe(quote.total_miles, '0')} miles</li><li>Estimated hours: ${safe(quote.total_hours, '0')}</li><li>Truck class: ${safe(quote.truck_class)}</li><li>Base: ${safe(quote.base_yard_id)}</li></ul>
      <h3>Quote</h3><ul><li>Range: $${safe(quote.min_quote)} – $${safe(quote.max_quote)}</li><li>Custom quote: ${quote.custom_quote == null ? 'None' : `$${safe(quote.custom_quote)}`}</li><li>Applied surcharges: ${safe(surcharges, 'None')}</li><li>Notes: ${safe(quote.notes, 'None')}</li><li>Logged: ${safe(new Date(quote.created_at).toLocaleString('en-US', { timeZone: 'America/Chicago' }))} CT</li></ul>
      <h3>Documents and Attachments</h3><ul><li>BOL: ${quote.bol_name ? safe(quote.bol_name) : 'Not attached'}</li></ul>${bolLink ? `<p><a href="${escapeHtml(bolLink)}">Open attached BOL</a> (secure link expires in 24 hours)</p>` : '<p><strong>No BOL is currently attached.</strong></p>'}`;
    const { error: emailError } = await admin.functions.invoke('send-quote-approval-email', { body: { to: recipient, subject: `${subjectPrefix} — ${String(quote.customer_name || quote.id).slice(0, 100)}`, html } });
    if (emailError) throw emailError;
    return res.status(200).json({ success: true });
  } catch (error) { return sendApiError(res, error, 'Quote email failed.', { route: '/api/sendQuoteEmail', provider: 'email' }); }
}
