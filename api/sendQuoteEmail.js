import { canAccessQuote, enforceRateLimit, escapeHtml, requireUser, sendApiError } from './_security.js';
import { buildQuotePdf, loadQuoteDocumentContext } from './_quoteDocument.js';

const validEmail = (value) => /^\S+@\S+\.\S+$/.test(String(value || '').trim());

export default async function handler(req, res) {
  if (req.method === 'GET') {
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
    } catch (error) { return sendApiError(res, error, 'Unable to generate quote PDF.', { route: '/api/sendQuoteEmail', provider: 'pdf' }); }
  }
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

    const context = await loadQuoteDocumentContext(admin, quote);
    const portal = context.config.client_portal || {};
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
    const document = await buildQuotePdf({ quote, ...context });
    const isDispatch = action !== 'share';
    const brand = context.config.branding || {};
    const subjectPrefix = isDispatch ? (action === 'bol_attached' ? 'BOL attached - dispatch requested' : 'Dispatch requested') : 'Your transport quote';
    const price = `$${safe(quote.min_quote)}`;
    const brandLine = context.client ? `${safe(brand.display_name || context.company.name)} <span style="padding:0 10px;color:#94a3b8">×</span> ${safe(context.client.client_name)}` : safe(brand.display_name || context.company.name);
    const html = `<!doctype html><html><body style="margin:0;background:#f1f5f9;font-family:Arial,sans-serif;color:#0f172a"><div style="display:none;max-height:0;overflow:hidden">${isDispatch ? 'A client requested dispatch.' : 'Your transport quote is attached.'}</div><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td style="padding:32px 16px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;margin:auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 8px 30px rgba(15,23,42,.08)"><tr><td style="padding:28px 32px;background:#0f172a;color:#fff"><div style="font-size:22px;font-weight:800">${brandLine}</div><div style="margin-top:6px;color:#94a3b8;font-size:12px;text-transform:uppercase;letter-spacing:.12em">${isDispatch ? 'Dispatch request' : 'Transport quote'}</div></td></tr><tr><td style="padding:32px"><div style="display:inline-block;padding:6px 10px;border-radius:999px;background:${isDispatch ? '#fff7ed;color:#c2410c' : '#eff6ff;color:#1d4ed8'};font-size:11px;font-weight:800;text-transform:uppercase">${isDispatch ? 'Action requested' : 'Quote ready'}</div><h1 style="margin:18px 0 8px;font-size:26px">${isDispatch ? 'A client is ready to dispatch' : 'Your quote is ready'}</h1><p style="margin:0 0 24px;color:#475569;line-height:1.6">${isDispatch ? `Submitted by ${safe(profile.full_name || profile.email)}. The complete branded quote is attached.` : 'The complete transport quote is attached as a PDF for easy saving and sharing.'}</p><div style="padding:22px;border-radius:12px;background:#f8fafc;border:1px solid #e2e8f0"><div style="font-size:11px;color:#64748b;text-transform:uppercase;font-weight:700">${safe(document.reference)}</div><div style="margin-top:8px;font-size:30px;font-weight:800;color:${safe(brand.accent_color, '#2563eb')}">${price}</div><div style="margin-top:16px;color:#334155;line-height:1.7"><strong>Customer:</strong> ${safe(quote.customer_name)}<br><strong>Equipment:</strong> ${safe(details.name || details.equipmentName || [details.make, details.model].filter(Boolean).join(' '))}<br><strong>Route:</strong> ${safe(Array.isArray(quote.all_waypoints) ? quote.all_waypoints.join(' to ') : '')}<br><strong>Permit flags:</strong> ${safe(permitFlags, 'None')}<br><strong>BOL:</strong> ${quote.bol_name ? safe(quote.bol_name) : 'Not attached'}</div></div>${bolLink ? `<p style="margin:24px 0 0"><a href="${escapeHtml(bolLink)}" style="display:inline-block;padding:12px 18px;border-radius:9px;background:#0f172a;color:#fff;text-decoration:none;font-weight:700">Open attached BOL</a></p>` : ''}<p style="margin:26px 0 0;color:#64748b;font-size:12px;line-height:1.6">${safe(brand.phone, '')}${brand.phone && brand.email ? ' | ' : ''}${safe(brand.email, '')}</p></td></tr><tr><td style="padding:18px 32px;background:#f8fafc;color:#94a3b8;font-size:11px">Generated securely by TowCalc.</td></tr></table></td></tr></table></body></html>`;
    const { data: emailData, error: emailError } = await admin.functions.invoke('send-quote-approval-email', { body: {
      to: recipient,
      subject: `${subjectPrefix} - ${document.reference}`,
      html,
      idempotencyKey: `quote-${quote.id}-${action}-${Date.now()}`,
      attachments: [{ filename: document.filename, content: document.bytes.toString('base64'), content_type: 'application/pdf' }],
    } });
    if (emailError) throw emailError;
    const eventType = isDispatch ? 'dispatch_requested' : 'email_sent';
    const { error: eventError } = await admin.from('quote_events').insert({ quote_id: quote.id, company_id: quote.company_id, actor_id: profile.id, event_type: eventType, metadata: { recipient, provider_message_id: emailData?.id || null, attachment: document.filename } });
    if (eventError) console.error('Email event audit failed:', eventError);
    return res.status(200).json({ success: true });
  } catch (error) { return sendApiError(res, error, 'Quote email failed.', { route: '/api/sendQuoteEmail', provider: 'email' }); }
}
