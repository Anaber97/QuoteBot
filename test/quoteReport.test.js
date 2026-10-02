import test from 'node:test';
import assert from 'node:assert/strict';
import { buildQuoteReport } from '../api/_quoteReport.js';

test('report email escapes submitted text and links to the stored quote', () => {
  const mail = buildQuoteReport({ quote: { id: 'abc-123', min_quote: 525, all_waypoints: ['Pickup', 'Dropoff'], quote_details: { weight: 7561, width: 41, height: 82 } },
    profile: { email: 'client@example.test' }, reason: '<script>alert(1)</script>', displayedTotal: 500 });
  assert.ok(mail.html.includes('&lt;script&gt;'));
  assert.ok(!mail.html.includes('<script>'));
  assert.ok(mail.html.includes('https://app.towcalc.com/?quote=abc-123'));
  assert.ok(mail.html.includes('Open in TowCalc'));
  assert.ok(mail.html.includes('$525'));
  assert.ok(mail.html.includes('$500'));
  assert.ok(mail.html.includes('7561'));
});
