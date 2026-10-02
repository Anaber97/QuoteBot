import test from 'node:test';
import assert from 'node:assert/strict';
import * as security from '../api/_security.js';

test('report endpoint pins the company recipient, checks ownership and validates the reason', async (t) => {
  const profile = { id: 'user', role: 'client', company_id: 'company', client_id: 'client', email: 'client@example.test' };
  const quote = { id: 'quote', company_id: 'company', client_id: 'client', quote_source: 'client_portal', min_quote: 525 };
  let payload; let sends = 0;
  const query = { select() { return this; }, eq() { return this; }, async single() { return { data: quote }; } };
  t.mock.module('../api/_security.js', { namedExports: { ...security, requireUser: async () => ({ profile, admin: { from: () => query } }), enforceRateLimit: async () => {} } });
  t.mock.module('../api/_quoteDocument.js', { namedExports: { buildQuotePdf: async () => { throw new Error('Reports do not require PDFs'); }, loadQuoteDocumentContext: async () => ({ config: { client_portal: { contact_email: 'dispatch@example.test' } } }) } });
  t.mock.module('../api/_emailDelivery.js', { namedExports: {
    findEmailDelivery: async () => ({}),
    storeEmailDelivery: async (_admin, _profile, _op, _quote, event, mail) => { assert.equal(event, 'email_sent'); payload = mail; return {}; },
    sendEmailDelivery: async () => { sends++; },
  } });
  const { default: handler } = await import('../api/sendQuoteEmail.js?report-test');
  const call = async (reason) => {
    const res = { status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
    await handler({ method: 'POST', body: { quoteId: 'quote', action: 'report', reason, recipient: 'attacker@example.test' } }, res);
    return res;
  };
  assert.equal((await call('Price is wrong')).code, 200);
  assert.equal(payload.to, 'dispatch@example.test');
  assert.ok(payload.html.includes('Open in TowCalc'));
  assert.equal(sends, 1);
  assert.equal((await call('   ')).code, 400);
  quote.client_id = 'other-client';
  assert.equal((await call('Wrong price')).code, 403);
  assert.equal(sends, 1);
});
