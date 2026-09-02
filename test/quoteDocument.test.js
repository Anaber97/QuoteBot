import test from 'node:test';
import assert from 'node:assert/strict';
import { PDFDocument } from 'pdf-lib';
import { buildQuotePdf } from '../api/_quoteDocument.js';

test('buildQuotePdf creates a branded, single-price PDF with a stable filename', async () => {
  const result = await buildQuotePdf({
    quote: {
      id: '12345678-1234-1234-1234-123456789012', quote_reference: 'Q-2026-000123', created_at: '2026-09-02T12:00:00Z',
      customer_name: 'Test Customer', pickup_address: 'Pickup', dropoff_address: 'Dropoff', all_waypoints: ['Pickup', 'Dropoff'],
      min_quote: 1250, max_quote: 1250, total_miles: 100, total_hours: 3, quote_details: { name: 'Excavator' },
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
