import test from 'node:test';
import assert from 'node:assert/strict';
import { sendEmailDelivery } from '../api/_emailDelivery.js';
import { assertSameRequest, fingerprint, requestId } from '../api/_idempotency.js';

test('an ambiguous delivery retries with identical stored payload and provider key', async () => {
  const bodies = [];
  let attempts = 0;
  const delivery = { id: 'delivery-1', status: 'pending', created_at: new Date().toISOString(), payload: { to: 'test@example.test', html: 'Frozen content' } };
  const admin = {
    functions: { invoke: async (_name, options) => { bodies.push(options.body); return { data: { id: 'provider-1' } }; } },
    rpc: async () => (++attempts === 1 ? { error: new Error('Database unavailable') } : {}),
  };
  await assert.rejects(sendEmailDelivery(admin, delivery), /Database unavailable/);
  await sendEmailDelivery(admin, delivery);
  assert.deepEqual(bodies[0], bodies[1]);
  assert.equal(bodies[0].idempotencyKey, 'delivery-delivery-1');
});

test('completed and expired deliveries are never sent again', async () => {
  let sends = 0;
  const admin = { functions: { invoke: async () => { sends++; } } };
  await sendEmailDelivery(admin, { status: 'sent' });
  await assert.rejects(sendEmailDelivery(admin, { status: 'pending', created_at: '2020-01-01T00:00:00Z' }), { status: 409 });
  assert.equal(sends, 0);
});

test('request identifiers cannot be reused for different inputs', () => {
  assert.throws(() => requestId({ headers: { 'idempotency-key': 'invalid' } }), { status: 400 });
  assert.throws(() => assertSameRequest({ request_hash: fingerprint({ amount: 1 }) }, fingerprint({ amount: 2 })), { status: 409 });
});
