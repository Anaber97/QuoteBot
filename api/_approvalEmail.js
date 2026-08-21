import { escapeHtml } from './_security.js';

export async function sendStoredApprovalEmail(admin, profile, quote) {
  const { data: config } = await admin.from('app_config').select('client_portal').eq('company_id', profile.company_id).maybeSingle();
  const configuredRecipient = String(config?.client_portal?.contact_email || '').trim();
  const { data: managers } = configuredRecipient ? { data: [] } : await admin.from('profiles').select('email').eq('company_id', profile.company_id).eq('role', 'manager').limit(1);
  const recipient = configuredRecipient || managers?.[0]?.email;
  if (!recipient) throw Object.assign(new Error('No approval recipient is configured.'), { status: 400 });
  const details = quote.quote_details && typeof quote.quote_details === 'object' ? quote.quote_details : {};
  const safe = (value, fallback = 'N/A') => escapeHtml(value ?? fallback);
  const html = `<p>A client quote approval request was submitted.</p><ul>
    <li>Equipment: ${safe(details.name || details.equipmentName, 'Unknown')}</li>
    <li>Make: ${safe(details.make)}</li><li>Model: ${safe(details.model)}</li><li>Serial Number: ${safe(details.serialNumber)}</li>
    <li>Estimated weight: ${safe(details.weight, '0')} lbs</li><li>Pickup: ${safe(quote.pickup_address)}</li><li>Dropoff: ${safe(quote.dropoff_address)}</li>
    <li>Authoritative quote: $${safe(quote.min_quote)}${quote.max_quote !== quote.min_quote ? ` – $${safe(quote.max_quote)}` : ''}</li>
    <li>Permit flags: ${safe(Array.isArray(details.permitFlags) && details.permitFlags.length ? details.permitFlags.join(', ') : 'None')}</li></ul>
    <p>Submitted by ${safe(profile.full_name || profile.email)}. Quote reference: ${safe(quote.id)}</p>`;
  const { error } = await admin.functions.invoke('send-quote-approval-email', {
    body: { to: recipient, subject: `Quote approval required — ${String(details.name || details.equipmentName || quote.id).slice(0, 100)}`, html },
  });
  if (error) throw error;
}
