import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { normalizeConfig } from '../src/lib/configSchema.js';

const safeText = (value, fallback = 'N/A') => String(value ?? '').trim() || fallback;
const money = (value) => `$${Number(value || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const cleanReference = (quote) => safeText(quote.quote_reference, `Q-${String(quote.id || '').slice(0, 8).toUpperCase()}`).replace(/[^A-Za-z0-9_-]/g, '-');
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
  const ink = rgb(18 / 255, 18 / 255, 18 / 255);
  const muted = rgb(75 / 255, 75 / 255, 75 / 255);
  const line = rgb(170 / 255, 170 / 255, 170 / 255);
  const details = quote.quote_details && typeof quote.quote_details === 'object' ? quote.quote_details : {};
  const branding = config.branding || {};
  const companyName = safeText(branding.display_name, company.name || 'TowCalc Customer');
  const reference = cleanReference(quote);
  const isEquipmentQuote = ['equipment_calculator', 'client_portal'].includes(quote.quote_source);
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
  const text = (value, x, size = 10, font = regular, color = ink) => page.drawText(safeText(value, ''), { x, y, size, font, color });
  const rule = () => { page.drawLine({ start: { x: margin, y }, end: { x: pageSize[0] - margin, y }, thickness: 1, color: line }); y -= 14; };
  const section = (title) => { ensure(34); y -= 6; text(title.toUpperCase(), margin, 9, bold); y -= 12; rule(); };
  const row = (label, value, options = {}) => {
    const valueLines = wrap(value, regular, 10, options.width || 330); const height = Math.max(18, valueLines.length * 13 + 5); ensure(height);
    text(label, margin, 9, bold, muted); valueLines.forEach((item, index) => { page.drawText(item, { x: 190, y: y - index * 13, size: 10, font: regular, color: ink }); }); y -= height;
  };

  addPage();
  let logoDrawn = false;
  if (logoBytes) {
    try {
      const logo = logoBytes[0] === 0x89 ? await pdf.embedPng(logoBytes) : await pdf.embedJpg(logoBytes);
      const scaled = logo.scale(Math.min(1, 120 / logo.width, 50 / logo.height));
      page.drawImage(logo, { x: margin, y: 710, width: scaled.width, height: scaled.height }); logoDrawn = true;
    } catch { logoDrawn = false; }
  }
  page.drawText(companyName, { x: logoDrawn ? 190 : margin, y: 750, size: 18, font: bold, color: ink });
  page.drawText('TRANSPORT QUOTE', { x: logoDrawn ? 190 : margin, y: 727, size: 9, font: bold, color: muted });
  page.drawText(reference, { x: 430, y: 750, size: 12, font: bold, color: ink });
  page.drawText(new Date(quote.created_at).toLocaleDateString('en-US'), { x: 430, y: 730, size: 9, font: regular, color: muted });
  y = 696; rule(); y -= 4;
  page.drawText(money(quote.min_quote), { x: margin, y, size: 24, font: bold, color: ink });
  page.drawText('ESTIMATED TRANSPORT PRICE', { x: margin, y: y - 17, size: 8, font: bold, color: muted }); y -= 52;

  section('Customer'); row('Customer', quote.customer_name); row('Phone', quote.customer_phone);
  if (isEquipmentQuote) {
    section('Equipment'); row('Equipment', details.name || details.equipmentName || quote.truck_class); row('Make / Model', [details.make, details.model].filter(Boolean).join(' ')); row('Serial number', details.serialNumber); row('Operating weight', details.weight ? `${Number(details.weight).toLocaleString()} lbs` : 'N/A'); row('Dimensions', [details.length || details.lengthFt, details.width || details.widthFt, details.height || details.heightFt].filter(Boolean).join(' x ')); row('Permit flags', Array.isArray(details.permitFlags) ? details.permitFlags.join(', ') || 'None' : details.permitFlags || 'None');
  } else {
    section('Service'); row('Service / truck class', quote.truck_class); if (quote.base_yard_id) row('Dispatch base', quote.base_yard_id);
  }
  section('Route'); row('Pickup', quote.pickup_address || quote.all_waypoints?.[0]); row('Destination', quote.dropoff_address || quote.all_waypoints?.at(-1)); if ((quote.all_waypoints || []).length > 2) row('All stops', quote.all_waypoints.join(' -> '), { width: 360 });
  if (branding.show_pricing_breakdown !== false) { section('Quote details'); row('Distance', `${Number(quote.total_miles || 0).toFixed(1)} miles`); row('Estimated time', `${Number(quote.total_hours || 0).toFixed(2)} hours`); row('Equipment class', quote.truck_class); const fees = Object.entries(quote.applied_surcharges || {}).filter(([, enabled]) => Boolean(enabled)).map(([name]) => name).join(', '); row('Applied charges', fees || 'None'); }
  if (quote.notes) { section('Notes'); row('Notes', quote.notes, { width: 360 }); }
  if (quote.quote_source === 'client_portal' && branding.pdf_footer) {
    ensure(80); y -= 10; rule(); text('TERMS', margin, 8, bold, muted); y -= 14;
    const footerLines = wrap(branding.pdf_footer, regular, 8, 516); footerLines.slice(0, 4).forEach((item, index) => page.drawText(item, { x: margin, y: y - index * 11, size: 8, font: regular, color: muted }));
  }

  const contact = [branding.phone, branding.email, branding.website, branding.address].filter(Boolean).join(' | ');
  pdf.getPages().forEach((item, index) => { item.drawLine({ start: { x: margin, y: 38 }, end: { x: 564, y: 38 }, thickness: 1, color: line }); item.drawText(contact || companyName, { x: margin, y: 23, size: 7, font: regular, color: muted }); item.drawText(`Page ${index + 1} of ${pdf.getPageCount()} | Generated by TowCalc`, { x: 420, y: 23, size: 7, font: regular, color: muted }); });
  pdf.setTitle(`${reference} - ${companyName}`); pdf.setAuthor(companyName); pdf.setCreator('TowCalc Pro');
  return { bytes: Buffer.from(await pdf.save()), filename: `${reference}.pdf`, reference, companyName };
}
