import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { normalizeConfig } from '../src/lib/configSchema.js';

const safeText = (value, fallback = 'N/A') => String(value ?? '').trim() || fallback;
const money = (value) => `$${Number(value || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const cleanReference = (quote) => safeText(quote.quote_reference, `Q-${String(quote.id || '').slice(0, 8).toUpperCase()}`).replace(/[^A-Za-z0-9_-]/g, '-');
const humanize = (value) => String(value || '').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
const formatDate = (value) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
};
const accentFromHex = (value) => {
  const match = /^#?([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(String(value || ''));
  return match ? rgb(Number.parseInt(match[1], 16) / 255, Number.parseInt(match[2], 16) / 255, Number.parseInt(match[3], 16) / 255) : rgb(37 / 255, 99 / 255, 235 / 255);
};

export async function loadQuoteDocumentContext(admin, quote) {
  const [{ data: company }, { data: row }, { data: client }] = await Promise.all([
    admin.from('companies').select('id, name').eq('id', quote.company_id).single(),
    admin.from('app_config').select('*').eq('company_id', quote.company_id).maybeSingle(),
    quote.quote_source === 'client_portal' && quote.client_id
      ? admin.from('clients').select('id, client_name, logo_path').eq('id', quote.client_id).eq('company_id', quote.company_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const config = normalizeConfig(row || { company_id: quote.company_id });
  let logoBytes = null;
  if (config.branding?.logo_path) {
    const { data, error } = await admin.storage.from('company-branding').download(config.branding.logo_path);
    if (!error && data) logoBytes = new Uint8Array(await data.arrayBuffer());
  }
  let clientLogoBytes = null;
  if (client?.logo_path) {
    const { data, error } = await admin.storage.from('company-branding').download(client.logo_path);
    if (!error && data) clientLogoBytes = new Uint8Array(await data.arrayBuffer());
  }
  return { company: company || { name: 'TowCalc Customer' }, config, logoBytes, client: client || null, clientLogoBytes };
}

export async function buildQuotePdf({ quote, company, config, logoBytes = null, clientLogoBytes = null }) {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const ink = rgb(20 / 255, 25 / 255, 34 / 255);
  const muted = rgb(87 / 255, 96 / 255, 110 / 255);
  const faint = rgb(218 / 255, 222 / 255, 228 / 255);
  const details = quote.quote_details && typeof quote.quote_details === 'object' ? quote.quote_details : {};
  const branding = config.branding || {};
  const accent = accentFromHex(branding.accent_color);
  const companyName = safeText(branding.display_name, company.name || 'TowCalc Customer');
  const reference = cleanReference(quote);
  const isEquipmentQuote = ['equipment_calculator', 'client_portal'].includes(quote.quote_source);
  const pageSize = [612, 792];
  const margin = 48;
  const contentWidth = pageSize[0] - margin * 2;
  let page;
  let y;

  const wrap = (value, font, size, maxWidth) => {
    const words = safeText(value, '').split(/\s+/).filter(Boolean);
    const lines = [];
    let current = '';
    for (const word of words) {
      const next = current ? `${current} ${word}` : word;
      if (font.widthOfTextAtSize(next, size) <= maxWidth) current = next;
      else {
        if (current) lines.push(current);
        current = word;
      }
    }
    if (current) lines.push(current);
    return lines.length ? lines : [''];
  };
  const fit = (value, font, size, maxWidth) => {
    const original = safeText(value, '');
    if (font.widthOfTextAtSize(original, size) <= maxWidth) return original;
    let shortened = original;
    while (shortened.length && font.widthOfTextAtSize(`${shortened}...`, size) > maxWidth) shortened = shortened.slice(0, -1);
    return `${shortened.trim()}...`;
  };
  const drawRight = (value, right, baseline, size, font = regular, color = ink) => {
    const printable = safeText(value, '');
    page.drawText(printable, { x: right - font.widthOfTextAtSize(printable, size), y: baseline, size, font, color });
  };
  const addPage = () => {
    page = pdf.addPage(pageSize);
    y = 736;
    if (pdf.getPageCount() > 1) {
      page.drawText(`${reference} - CONTINUED`, { x: margin, y, size: 9, font: bold, color: muted });
      y -= 30;
    }
  };
  const ensure = (height) => { if (y - height < 62) addPage(); };
  const section = (title) => {
    ensure(46);
    y -= 12;
    page.drawText(title.toUpperCase(), { x: margin, y, size: 8, font: bold, color: ink, characterSpacing: 1.1 });
    page.drawLine({ start: { x: margin, y: y - 8 }, end: { x: margin + 28, y: y - 8 }, thickness: 2, color: accent });
    page.drawLine({ start: { x: margin + 34, y: y - 8 }, end: { x: margin + contentWidth, y: y - 8 }, thickness: 0.6, color: faint });
    y -= 27;
  };
  const fieldRow = (fields) => {
    const gap = 28;
    const width = (contentWidth - gap * (fields.length - 1)) / fields.length;
    const prepared = fields.map((field) => ({ ...field, lines: wrap(field.value, regular, 10.5, width) }));
    const height = Math.max(...prepared.map((field) => 18 + field.lines.length * 14)) + 10;
    ensure(height);
    prepared.forEach((field, index) => {
      const x = margin + index * (width + gap);
      page.drawText(safeText(field.label, '').toUpperCase(), { x, y, size: 7.5, font: bold, color: muted, characterSpacing: 0.6 });
      field.lines.forEach((lineText, lineIndex) => page.drawText(lineText, { x, y: y - 17 - lineIndex * 14, size: 10.5, font: regular, color: ink }));
    });
    y -= height;
  };
  const embedLogo = async (bytes, x, maxWidth, maxHeight = 48) => {
    if (!bytes) return null;
    try {
      const logo = bytes[0] === 0x89 ? await pdf.embedPng(bytes) : await pdf.embedJpg(bytes);
      const scale = Math.min(1, maxWidth / logo.width, maxHeight / logo.height);
      const dimensions = logo.scale(scale);
      page.drawImage(logo, { x, y: 708 + (maxHeight - dimensions.height) / 2, width: dimensions.width, height: dimensions.height });
      return dimensions;
    } catch {
      return null;
    }
  };

  addPage();
  const companyLogo = await embedLogo(logoBytes, margin, clientLogoBytes ? 100 : 118);
  const clientLogo = quote.quote_source === 'client_portal' && clientLogoBytes ? await embedLogo(clientLogoBytes, companyLogo ? 178 : margin, 100) : null;
  if (companyLogo && clientLogo) page.drawText('x', { x: 158, y: 728, size: 12, font: bold, color: muted });

  const titleX = companyLogo || clientLogo ? (clientLogo ? 300 : 190) : margin;
  const titleWidth = 420 - titleX;
  const companyLines = wrap(companyName, bold, 15, titleWidth).slice(0, 2);
  companyLines.forEach((lineText, index) => page.drawText(lineText, { x: titleX, y: 747 - index * 18, size: 15, font: bold, color: ink }));
  page.drawText('TRANSPORT QUOTE', { x: titleX, y: companyLines.length > 1 ? 704 : 716, size: 8, font: bold, color: muted, characterSpacing: 1.2 });
  drawRight(reference, pageSize[0] - margin, 747, 11, bold);
  drawRight(formatDate(quote.created_at), pageSize[0] - margin, 727, 8.5, regular, muted);
  page.drawLine({ start: { x: margin, y: 688 }, end: { x: pageSize[0] - margin, y: 688 }, thickness: 1.5, color: accent });

  page.drawText(money(quote.min_quote), { x: margin, y: 638, size: 30, font: bold, color: ink });
  page.drawText('ESTIMATED TRANSPORT PRICE', { x: margin, y: 618, size: 8, font: bold, color: muted, characterSpacing: 0.9 });
  y = 570;

  section('Customer');
  fieldRow([{ label: 'Customer', value: quote.customer_name }, { label: 'Phone', value: quote.customer_phone }]);
  if (isEquipmentQuote) {
    section('Equipment');
    fieldRow([{ label: 'Equipment', value: details.name || details.equipmentName || quote.truck_class }, { label: 'Make / Model', value: [details.make, details.model].filter(Boolean).join(' ') }]);
    const dimensions = [details.length || details.lengthFt, details.width || details.widthFt, details.height || details.heightFt].filter(Boolean).join(' x ');
    fieldRow([{ label: 'Operating weight', value: details.weight ? `${Number(details.weight).toLocaleString()} lbs` : 'N/A' }, { label: 'Dimensions (L x W x H)', value: dimensions || 'N/A' }]);
    if (details.serialNumber || (Array.isArray(details.permitFlags) && details.permitFlags.length)) {
      fieldRow([{ label: 'Serial number', value: details.serialNumber }, { label: 'Permit flags', value: Array.isArray(details.permitFlags) ? details.permitFlags.join(', ') || 'None' : details.permitFlags || 'None' }]);
    }
  } else {
    section('Service');
    fieldRow([{ label: 'Service / truck class', value: quote.truck_class }, { label: 'Dispatch base', value: quote.base_yard_id }]);
  }
  section('Route');
  fieldRow([{ label: 'Pickup', value: quote.pickup_address || quote.all_waypoints?.[0] }]);
  fieldRow([{ label: 'Destination', value: quote.dropoff_address || quote.all_waypoints?.at(-1) }]);
  if ((quote.all_waypoints || []).length > 2) fieldRow([{ label: 'All stops', value: quote.all_waypoints.join(' -> ') }]);

  if (branding.show_pricing_breakdown !== false) {
    section('Quote details');
    fieldRow([{ label: 'Distance', value: `${Number(quote.total_miles || 0).toFixed(1)} miles` }, { label: 'Estimated time', value: `${Number(quote.total_hours || 0).toFixed(2)} hours` }]);
    const standardFees = Object.entries(quote.applied_surcharges || {}).filter(([name, enabled]) => Boolean(enabled) && name !== 'customZone').map(([name]) => humanize(name));
    const zoneNames = Array.isArray(details.customZoneNames) ? details.customZoneNames : [];
    fieldRow([{ label: 'Equipment class', value: quote.truck_class }, { label: 'Applied pricing', value: [...zoneNames, ...standardFees].join(', ') || 'Standard company pricing' }]);
  }
  if (quote.notes) {
    section('Notes');
    fieldRow([{ label: 'Job notes', value: quote.notes }]);
  }
  if (quote.quote_source === 'client_portal' && branding.pdf_footer) {
    section('Terms');
    const terms = wrap(branding.pdf_footer, regular, 8, contentWidth);
    ensure(terms.length * 11 + 8);
    terms.slice(0, 6).forEach((lineText, index) => page.drawText(lineText, { x: margin, y: y - index * 11, size: 8, font: regular, color: muted }));
    y -= Math.min(terms.length, 6) * 11 + 8;
  }

  const contact = [branding.phone, branding.email, branding.website, branding.address].filter(Boolean).join('  |  ');
  pdf.getPages().forEach((item, index) => {
    item.drawLine({ start: { x: margin, y: 45 }, end: { x: pageSize[0] - margin, y: 45 }, thickness: 0.6, color: faint });
    item.drawText(fit(contact || companyName, regular, 7, contentWidth), { x: margin, y: 27, size: 7, font: regular, color: muted });
    const pageLabel = `Page ${index + 1} of ${pdf.getPageCount()}  |  TowCalc`;
    item.drawText(pageLabel, { x: pageSize[0] - margin - regular.widthOfTextAtSize(pageLabel, 7), y: 14, size: 7, font: regular, color: muted });
  });
  pdf.setTitle(`${reference} - ${companyName}`);
  pdf.setAuthor(companyName);
  pdf.setCreator('TowCalc Pro');
  return { bytes: Buffer.from(await pdf.save()), filename: `${reference}.pdf`, reference, companyName };
}
