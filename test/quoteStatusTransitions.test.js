import test from 'node:test';
import assert from 'node:assert/strict';
import { createFakeAdmin, createMockReqRes } from './helpers/mockSupabase.js';
import { canAccessQuote } from '../api/_security.js';

/**
 * QUOTE STATUS TRANSITION TESTS
 *
 * updateQuoteStatus.js previously validated only that the requested status was
 * one of the known strings, without checking whether the transition from the
 * quote's *current* status was legal (e.g. 'completed' -> 'draft'). This
 * exercises the explicit state machine now enforced by the handler.
 */

function mockSecurity({ profile, quote, updateResult }) {
  return {
    exports: {
      requireUser: async () => ({ admin: makeAdmin(quote, updateResult), profile }),
      canAccessQuote,
      enforceRateLimit: async () => {},
      sendApiError: (res, error, fallback) => res.status(error.status || 500).json({ error: error.status ? error.message : fallback }),
    },
  };
}

function makeAdmin(quote, updateResult) {
  return createFakeAdmin({
    tableResponders: {
      quote_logs: (state) => {
        if (state.op === 'update') {
          return updateResult || { data: { id: quote.id, status: state.payload.status }, error: null };
        }
        return { data: quote, error: null };
      },
    },
  });
}

const managerProfile = { id: 'user-1', role: 'manager', company_id: 'company-a' };

async function callUpdateStatus(t, { profile, quote, status, updateResult }) {
  t.mock.module('../api/_security.js', mockSecurity({ profile, quote, updateResult }));
  const { default: handler } = await import(`../api/updateQuoteStatus.js?t=${Math.random()}`);
  const { req, res } = createMockReqRes({ method: 'PATCH', body: { quoteId: quote.id, status } });
  await handler(req, res);
  return res;
}

test('isValidTransition allows the documented forward-moving transitions', async () => {
  const { isValidTransition } = await import('../api/updateQuoteStatus.js');
  assert.equal(isValidTransition('draft', 'submitted'), true);
  assert.equal(isValidTransition('submitted', 'approved'), true);
  assert.equal(isValidTransition('submitted', 'dispatched'), true);
  assert.equal(isValidTransition('approval_required', 'approved'), true);
  assert.equal(isValidTransition('approved', 'dispatched'), true);
  assert.equal(isValidTransition('dispatched', 'completed'), true);
  assert.equal(isValidTransition('draft', 'cancelled'), true);
});

test('isValidTransition rejects skipping/backwards/no-op transitions', async () => {
  const { isValidTransition } = await import('../api/updateQuoteStatus.js');
  assert.equal(isValidTransition('draft', 'draft'), false, 'no-op transition');
  assert.equal(isValidTransition('completed', 'draft'), false, 'backwards from terminal state');
  assert.equal(isValidTransition('dispatched', 'submitted'), false, 'backwards');
  assert.equal(isValidTransition('draft', 'completed'), false, 'skips required steps');
});

test('isValidTransition treats completed and cancelled as terminal', async () => {
  const { isValidTransition, VALID_TRANSITIONS } = await import('../api/updateQuoteStatus.js');
  assert.deepEqual(VALID_TRANSITIONS.completed, []);
  assert.deepEqual(VALID_TRANSITIONS.cancelled, []);
  assert.equal(isValidTransition('completed', 'dispatched'), false);
  assert.equal(isValidTransition('cancelled', 'submitted'), false);
});

test('isValidTransition rejects unknown status values', async () => {
  const { isValidTransition } = await import('../api/updateQuoteStatus.js');
  assert.equal(isValidTransition('draft', 'bogus'), false);
  assert.equal(isValidTransition('bogus', 'draft'), false);
});

test('handler rejects an illegal transition with 409, even for a manager', async (t) => {
  const quote = { id: 'quote-1', company_id: 'company-a', client_id: null, quote_source: 'main_calculator', status: 'completed' };
  const res = await callUpdateStatus(t, { profile: managerProfile, quote, status: 'draft' });
  assert.equal(res.statusCode, 409);
  assert.match(res.body.error, /Cannot change status/);
});

test('handler allows a legal transition for a manager', async (t) => {
  const quote = { id: 'quote-1', company_id: 'company-a', client_id: null, quote_source: 'main_calculator', status: 'submitted' };
  const res = await callUpdateStatus(t, { profile: managerProfile, quote, status: 'approved' });
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.quote.status, 'approved');
});

test('handler rejects status changes from a client role', async (t) => {
  const quote = { id: 'quote-1', company_id: 'company-a', client_id: 'client-a', quote_source: 'client_portal', status: 'submitted' };
  const clientProfile = { id: 'user-2', role: 'client', company_id: 'company-a', client_id: 'client-a' };
  const res = await callUpdateStatus(t, { profile: clientProfile, quote, status: 'approved' });
  assert.equal(res.statusCode, 403);
});

test('handler allows dispatch role to change status within their company', async (t) => {
  const quote = { id: 'quote-1', company_id: 'company-a', client_id: null, quote_source: 'main_calculator', status: 'approved' };
  const dispatchProfile = { id: 'user-3', role: 'dispatch', company_id: 'company-a' };
  const res = await callUpdateStatus(t, { profile: dispatchProfile, quote, status: 'dispatched' });
  assert.equal(res.statusCode, 200);
});
