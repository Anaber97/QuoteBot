import { escapeHtml } from './_security.js';

export function buildQuoteReport({ quote, profile, reason, displayedTotal }) {
  const safe = (value) => escapeHtml(String(value ?? 'Not supplied'));
  const reference = quote.quote_reference || `Q-${String(quote.id).slice(0, 8).toUpperCase()}`;
  const url = `https://app.towcalc.com/?quote=${encodeURIComponent(quote.id)}`;
  const details = quote.quote_details || {};
  const fields = {
    'Reported by': profile.full_name || profile.email,
    'Reply contact': profile.email,
    'Client account': quote.client_id,
    'Customer': quote.customer_name,
    'Phone': quote.customer_phone,
    'Displayed quote (client reported)': displayedTotal == null ? 'Not supplied' : `$${displayedTotal}`,
    'Saved quote': `$${quote.min_quote}`,
    'Equipment': details.name || [details.make, details.model].filter(Boolean).join(' '),
    'Serial number': details.serialNumber,
    'Operating weight (lbs)': details.weight,
    'Width (in)': details.width,
    'Height (in)': details.height,
    'Attachment': details.attachmentType,
    'Attachment weight (lbs)': details.attachmentWeight,
    'Route': (quote.all_waypoints || []).join(' → '),
    'Quote notes': quote.notes,
    'Permit flags': (details.permitFlags || []).join(', '),
    'OSOW review': (details.osow?.reviewReasons || []).join('; '),
  };
  return {
    subject: `Quote report - ${reference}`,
    html: `<html><body style="font-family:Arial,sans-serif;color:#0f172a"><h1>Client quote report</h1><p>${safe(reference)}</p><h2>Reason for report</h2><p style="white-space:pre-wrap">${safe(reason)}</p><table>${Object.entries(fields).map(([label, value]) => `<tr><th style="text-align:left;padding:6px">${safe(label)}</th><td style="padding:6px;white-space:pre-wrap">${safe(value)}</td></tr>`).join('')}</table><p><a href="${safe(url)}" style="display:inline-block;background:#2563eb;color:white;padding:12px 18px;text-decoration:none;border-radius:8px">Open in TowCalc</a></p><p>Sign in with an account authorized to view this quote.</p></body></html>`,
  };
}
