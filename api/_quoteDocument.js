import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { normalizeConfig } from '../src/lib/configSchema.js';

const safeText = (value, fallback = 'N/A') => String(value ?? '').trim() || fallback;
const money = (value) => `$${Number(value || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const cleanReference = (quote) => safeText(quote.quote_reference, `Q-${String(quote.id || '').slice(0, 8).toUpperCase()}`).replace(/[^A-Za-z0-9_-]/g, '-');
const hexColor = (value) => {
  const match = String(value || '').match(/^#?([0-9a-f]{6})$/i);
  if (!match) return rgb(37 / 255, 99 / 255, 235 / 255);
  return rgb(parseInt(match[1].slice(0, 2), 16) / 255, parseInt(match[1].slice(2, 4), 16) / 255, parseInt(match[1].slice(4, 6), 16) / 255);
};

export async function loadQuoteDocumentContext(admin, quote) {
  const [{ data: company }, { data: row }] = await Promise.all([
    admin.from('companies').select('id, name').eq('id', quote.company_id).single(),
    admin.from('app_config').select('*').eq('company_id', quote.company_id).maybeSingle(),
  ]);
  const config = normalizeConfig(row || { company_id: quote.company_id });
  let logoBytes = null;
  if (config.branding?.logo_path) {
    const { data, error } = await admin.storage.from('company-branding').download(config.branding.logo_path);
    if (!error && data) logoBytes = new Uint8Array(await data.arrayBuffer());
  }
  return { company: company || { name: 'TowCalc Customer' }, config, logoBytes };
}

export async function buildQuotePdf({ quote, company, config, logoBytes = null }) {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const accent = hexColor(config.branding?.accent_color);
  const navy = rgb(15 / 255, 23 / 255, 42 / 255);
  const muted = rgb(71 / 255, 85 / 255, 105 / 255);
  const line = rgb(226 / 255, 232 / 255, 240 / 255);
  const details = quote.quote_details && typeof quote.quote_details === 'object' ? quote.quote_details : {};
  const branding = config.branding || {};
  const companyName = safeText(branding.display_name, company.name || 'TowCalc Customer');
  const reference = cleanReference(quote);
  const pageSize = [612, 792];
  const margin = 48;
  let page; let y;

  const addPage = () => { page = pdf.addPage(pageSize); y = 744; };
  const ensure = (height) => { if (y - height < 54) addPage(); };
  const wrap = (text, font, size, maxWidth) => {
    const words = safeText(text, '').split(/\s+/).filter(Boolean); const lines = []; let current = '';
    for (const word of words) { const next = current ? `${current} ${word}` : word; if (font.widthOfTextAtSize(next, size) <= maxWidth) current = next; else { if (current) lines.push(current); current = word; } }
    if (current) lines.push(current); return lines.length ? lines : [''];
  };
  const text = (value, x, size = 10, font = regular, color = navy) => page.drawText(safeText(value, ''), { x, y, size, font, color });
  const rule = () => { page.drawLine({ start: { x: margin, y }, end: { x: pageSize[0] - margin, y }, thickness: 1, color: line }); y -= 14; };
  const section = (title) => { ensure(34); y -= 6; text(title.toUpperCase(), margin, 9, bold, accent); y -= 12; rule(); };
  const row = (label, value, options = {}) => {
    const valueLines = wrap(value, regular, 10, options.width || 330); const height = Math.max(18, valueLines.length * 13 + 5); ensure(height);
    text(label, margin, 9, bold, muted); valueLines.forEach((item, index) => { page.drawText(item, { x: 190, y: y - index * 13, size: 10, font: regular, color: navy }); }); y -= height;
  };

  addPage();
  page.drawRectangle({ x: 0, y: 704, width: 612, height: 88, color: navy });
  let logoDrawn = false;
  if (logoBytes) {
    try {
      const logo = logoBytes[0] === 0x89 ? await pdf.embedPng(logoBytes) : await pdf.embedJpg(logoBytes);
      const scaled = logo.scale(Math.min(1, 120 / logo.width, 50 / logo.height));
      page.drawImage(logo, { x: margin, y: 723, width: scaled.width, height: scaled.height }); logoDrawn = true;
    } catch { logoDrawn = false; }
  }
  page.drawText(companyName, { x: logoDrawn ? 190 : margin, y: 750, size: 18, font: bold, color: rgb(1, 1, 1) });
  page.drawText('TRANSPORT QUOTE', { x: logoDrawn ? 190 : margin, y: 727, size: 9, font: bold, color: rgb(148 / 255, 163 / 255, 184 / 255) });
  page.drawText(reference, { x: 430, y: 750, size: 12, font: bold, color: rgb(1, 1, 1) });
  page.drawText(new Date(quote.created_at).toLocaleDateString('en-US'), { x: 430, y: 730, size: 9, font: regular, color: rgb(203 / 255, 213 / 255, 225 / 255) });
  y = 674;
  page.drawText(quote.min_quote === quote.max_quote ? money(quote.min_quote) : `${money(quote.min_quote)} - ${money(quote.max_quote)}`, { x: margin, y, size: 28, font: bold, color: accent });
  page.drawText('ESTIMATED TRANSPORT PRICE', { x: margin, y: y - 17, size: 8, font: bold, color: muted }); y -= 52;

  section('Customer'); row('Customer', quote.customer_name); row('Phone', quote.customer_phone);
  section('Equipment'); row('Equipment', details.name || details.equipmentName || quote.truck_class); row('Make / Model', [details.make, details.model].filter(Boolean).join(' ')); row('Serial number', details.serialNumber); row('Operating weight', `${Number(details.weight || 0).toLocaleString()} lbs`); row('Dimensions', [details.length || details.lengthFt, details.width || details.widthFt, details.height || details.heightFt].filter(Boolean).join(' x ')); row('Permit flags', Array.isArray(details.permitFlags) ? details.permitFlags.join(', ') || 'None' : details.permitFlags || 'None');
  section('Route'); row('Pickup', quote.pickup_address || quote.all_waypoints?.[0]); row('Destination', quote.dropoff_address || quote.all_waypoints?.at(-1)); if ((quote.all_waypoints || []).length > 2) row('All stops', quote.all_waypoints.join(' -> '), { width: 360 });
  if (branding.show_pricing_breakdown !== false) { section('Quote details'); row('Distance', `${Number(quote.total_miles || 0).toFixed(1)} miles`); row('Estimated time', `${Number(quote.total_hours || 0).toFixed(2)} hours`); row('Equipment class', quote.truck_class); const fees = Object.entries(quote.applied_surcharges || {}).filter(([, enabled]) => Boolean(enabled)).map(([name]) => name).join(', '); row('Applied charges', fees || 'None'); }
  if (quote.notes) { section('Notes'); row('Notes', quote.notes, { width: 360 }); }
  ensure(80); y -= 12; page.drawRectangle({ x: margin, y: y - 56, width: 516, height: 66, color: rgb(248 / 255, 250 / 255, 252 / 255), borderColor: line, borderWidth: 1 });
  const footerLines = wrap(branding.pdf_footer, regular, 8, 480); footerLines.slice(0, 4).forEach((item, index) => page.drawText(item, { x: margin + 16, y: y - 15 - index * 11, size: 8, font: regular, color: muted }));

  const contact = [branding.phone, branding.email, branding.website, branding.address].filter(Boolean).join(' | ');
  pdf.getPages().forEach((item, index) => { item.drawLine({ start: { x: margin, y: 38 }, end: { x: 564, y: 38 }, thickness: 1, color: line }); item.drawText(contact || companyName, { x: margin, y: 23, size: 7, font: regular, color: muted }); item.drawText(`Page ${index + 1} of ${pdf.getPageCount()} | Generated by TowCalc`, { x: 420, y: 23, size: 7, font: regular, color: muted }); });
  pdf.setTitle(`${reference} - ${companyName}`); pdf.setAuthor(companyName); pdf.setCreator('TowCalc');
  return { bytes: Buffer.from(await pdf.save()), filename: `${reference}.pdf`, reference, companyName };
}
