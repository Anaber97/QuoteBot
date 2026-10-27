import test from 'node:test';
import assert from 'node:assert/strict';
import { PDFDocument } from 'pdf-lib';
import { buildQuotePdf } from '../api/_quoteDocument.js';

test('buildQuotePdf creates a branded, single-price PDF with a stable filename', async () => {
  const result = await buildQuotePdf({
    quote: {
      id: '12345678-1234-1234-1234-123456789012', quote_reference: 'Q-2026-000123', created_at: '2026-09-02T12:00:00Z',
      customer_name: 'Test Customer', pickup_address: 'Pickup', dropoff_address: 'Dropoff', all_waypoints: ['Pickup', 'Dropoff'],
      min_quote: 1250, max_quote: 1250, total_miles: 100, total_hours: 3, quote_source: 'equipment_calculator', quote_details: { name: 'Excavator' },
    },
    company: { name: 'Acme Towing' },
    config: { branding: { display_name: 'Acme Towing', accent_color: '#2563eb', show_pricing_breakdown: true } },
  });
  assert.equal(result.filename, 'Q-2026-000123.pdf');
  assert.equal(result.bytes.subarray(0, 4).toString(), '%PDF');
  const parsed = await PDFDocument.load(result.bytes);
  assert.equal(parsed.getPageCount(), 1);
  assert.match(parsed.getTitle(), /Q-2026-000123/);
});

test('equipment quote PDFs list overnight stays next to the permit flags', async () => {
  const { extractText, getDocumentProxy } = await import('unpdf');
  const pdfText = async (details) => {
    const { bytes } = await buildQuotePdf({
      quote: { id: '12345678-1234-1234-1234-123456789012', created_at: '2026-10-27T12:00:00Z', pickup_address: 'Pickup', dropoff_address: 'Dropoff',
        min_quote: 3200, max_quote: 3200, quote_source: 'equipment_calculator', quote_details: { name: 'Excavator', ...details } },
      company: { name: 'Acme Towing' }, config: { branding: { display_name: 'Acme Towing' } },
    });
    const { text } = await extractText(await getDocumentProxy(new Uint8Array(bytes)), { mergePages: true });
    return text;
  };
  assert.match(await pdfText({ overnights: { driver: 2, escorts: [1, 0], charge: 800 } }), /OVERNIGHTS[\s\S]*Driver: 2 nights; Escorts: 1 night/);
  assert.doesNotMatch(await pdfText({ overnights: { driver: 0, escorts: [], charge: 0 } }), /OVERNIGHTS/);
});
