import { escapeHtml } from './_security.js';
import { buildQuotePdf, loadQuoteDocumentContext } from './_quoteDocument.js';

export async function sendStoredApprovalEmail(admin, profile, quote) {
  const context = await loadQuoteDocumentContext(admin, quote);
  const configuredRecipient = String(context.config.client_portal?.contact_email || '').trim();
  const { data: managers } = configuredRecipient ? { data: [] } : await admin.from('profiles').select('email').eq('company_id', profile.company_id).eq('role', 'manager').limit(1);
  const recipient = configuredRecipient || managers?.[0]?.email;
  if (!recipient) throw Object.assign(new Error('No approval recipient is configured.'), { status: 400 });
  const details = quote.quote_details && typeof quote.quote_details === 'object' ? quote.quote_details : {};
  const safe = (value, fallback = 'N/A') => escapeHtml(value ?? fallback);
  const document = await buildQuotePdf({ quote, ...context });
  const html = `<div style="font-family:Arial,sans-serif;max-width:620px;margin:auto;color:#0f172a"><div style="background:#0f172a;color:#fff;padding:24px;border-radius:14px 14px 0 0"><h2 style="margin:0">Quote approval required</h2></div><div style="padding:26px;border:1px solid #e2e8f0"><p>A client quote approval request was submitted. The complete quote is attached as a branded PDF.</p><ul style="line-height:1.8">
    <li>Equipment: ${safe(details.name || details.equipmentName, 'Unknown')}</li>
    <li>Make: ${safe(details.make)}</li><li>Model: ${safe(details.model)}</li><li>Serial Number: ${safe(details.serialNumber)}</li>
    <li>Estimated weight: ${safe(details.weight, '0')} lbs</li><li>Pickup: ${safe(quote.pickup_address)}</li><li>Dropoff: ${safe(quote.dropoff_address)}</li>
    <li>Authoritative quote: $${safe(quote.min_quote)}${quote.max_quote !== quote.min_quote ? ` – $${safe(quote.max_quote)}` : ''}</li>
    <li>Permit flags: ${safe(Array.isArray(details.permitFlags) && details.permitFlags.length ? details.permitFlags.join(', ') : 'None')}</li></ul>
    <p>Submitted by ${safe(profile.full_name || profile.email)}. Quote reference: ${safe(document.reference)}</p></div></div>`;
  const { data, error } = await admin.functions.invoke('send-quote-approval-email', {
    body: { to: recipient, subject: `Quote approval required - ${document.reference}`, html,
      idempotencyKey: `approval-${quote.id}-${Date.now()}`,
      attachments: [{ filename: document.filename, content: document.bytes.toString('base64'), content_type: 'application/pdf' }],
    },
  });
  if (error) throw error;
  const { error: eventError } = await admin.from('quote_events').insert({ quote_id: quote.id, company_id: quote.company_id, actor_id: profile.id, event_type: 'dispatch_requested', metadata: { recipient, provider_message_id: data?.id || null, attachment: document.filename } });
  if (eventError) console.error('Approval email event audit failed:', eventError);
}
