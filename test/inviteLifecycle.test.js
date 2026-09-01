import test from 'node:test';
import assert from 'node:assert/strict';
import { createFakeAdmin, createMockReqRes } from './helpers/mockSupabase.js';

/**
 * INVITE LIFECYCLE TESTS
 *
 * Covers getInvite.js (lookup/expiry/reuse) and acceptInvite.js (RPC error
 * mapping for invalid token, expiry, and email-mismatch scenarios).
 */

let uniq = 0;
async function freshImport(path) {
  uniq += 1;
  return import(`${path}?t=${uniq}`);
}

// ===== getInvite.js =====

test('getInvite returns 404 for an unknown token', async (t) => {
  t.mock.module('../api/_security.js', {
    exports: { createAdminClient: () => createFakeAdmin({ tableResponders: { company_invites: () => ({ data: null, error: null }) } }) },
  });
  const { default: handler } = await freshImport('../api/getInvite.js');
  const { req, res } = createMockReqRes({ method: 'POST', body: { token: 'unknown-token' } });
  await handler(req, res);
  assert.equal(res.statusCode, 404);
});

test('getInvite returns 409 when the invite has already been accepted (reuse)', async (t) => {
  t.mock.module('../api/_security.js', {
    exports: {
      createAdminClient: () => createFakeAdmin({
        tableResponders: {
          company_invites: () => ({
            data: { id: 'i1', email: 'a@b.com', role: 'dispatch', company_id: 'c1', status: 'accepted', expires_at: null, accepted_at: '2026-01-01T00:00:00Z' },
            error: null,
          }),
        },
      }),
    },
  });
  const { default: handler } = await freshImport('../api/getInvite.js');
  const { req, res } = createMockReqRes({ method: 'POST', body: { token: 'used-token' } });
  await handler(req, res);
  assert.equal(res.statusCode, 409);
});

test('getInvite returns 410 when the invite has expired', async (t) => {
  t.mock.module('../api/_security.js', {
    exports: {
      createAdminClient: () => createFakeAdmin({
        tableResponders: {
          company_invites: () => ({
            data: { id: 'i1', email: 'a@b.com', role: 'dispatch', company_id: 'c1', status: 'pending', expires_at: '2020-01-01T00:00:00Z', accepted_at: null },
            error: null,
          }),
        },
      }),
    },
  });
  const { default: handler } = await freshImport('../api/getInvite.js');
  const { req, res } = createMockReqRes({ method: 'POST', body: { token: 'expired-token' } });
  await handler(req, res);
  assert.equal(res.statusCode, 410);
});

test('getInvite returns the invite details for a valid pending token', async (t) => {
  t.mock.module('../api/_security.js', {
    exports: {
      createAdminClient: () => createFakeAdmin({
        tableResponders: {
          company_invites: () => ({
            data: { id: 'i1', email: 'a@b.com', role: 'dispatch', company_id: 'c1', full_name: 'A B', status: 'pending', expires_at: '2099-01-01T00:00:00Z', accepted_at: null },
            error: null,
          }),
        },
      }),
    },
  });
  const { default: handler } = await freshImport('../api/getInvite.js');
  const { req, res } = createMockReqRes({ method: 'POST', body: { token: 'valid-token' } });
  await handler(req, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.invite.email, 'a@b.com');
});

// ===== acceptInvite.js =====

const acceptedPolicies = { termsVersion: '2026-09-01-draft', privacyVersion: '2026-09-01-draft' };

function mockAcceptInviteSecurity(rpcResult) {
  return {
    exports: {
      requireAuth: async () => ({ user: { id: 'user-1' }, token: 'access-token' }),
      createUserClient: () => createFakeAdmin({ rpcResponders: { accept_company_invite: () => rpcResult } }),
      sendApiError: (res, error, fallback) => res.status(error?.status || 500).json({ error: error?.status ? error.message : fallback }),
    },
  };
}

test('acceptInvite returns 404 for an invalid/unknown token', async (t) => {
  t.mock.module('../api/_security.js', mockAcceptInviteSecurity({ data: null, error: { message: 'invalid invitation token' } }));
  const { default: handler } = await freshImport('../api/acceptInvite.js');
  const { req, res } = createMockReqRes({ method: 'POST', body: { token: 'bad-token', ...acceptedPolicies } });
  await handler(req, res);
  assert.equal(res.statusCode, 404);
});

test('acceptInvite returns 410 when the invite token has expired', async (t) => {
  t.mock.module('../api/_security.js', mockAcceptInviteSecurity({ data: null, error: { message: 'invite has expired' } }));
  const { default: handler } = await freshImport('../api/acceptInvite.js');
  const { req, res } = createMockReqRes({ method: 'POST', body: { token: 'expired-token', ...acceptedPolicies } });
  await handler(req, res);
  assert.equal(res.statusCode, 410);
});

test('acceptInvite returns 403 when the invite email does not match the authenticated user', async (t) => {
  t.mock.module('../api/_security.js', mockAcceptInviteSecurity({ data: null, error: { message: 'invite email does not match authenticated user' } }));
  const { default: handler } = await freshImport('../api/acceptInvite.js');
  const { req, res } = createMockReqRes({ method: 'POST', body: { token: 'mismatch-token', ...acceptedPolicies } });
  await handler(req, res);
  assert.equal(res.statusCode, 403);
});

test('acceptInvite returns 409-mapped "no longer valid" for an already-accepted (reused) invite', async (t) => {
  t.mock.module('../api/_security.js', mockAcceptInviteSecurity({ data: null, error: { message: 'invitation is no longer valid' } }));
  const { default: handler } = await freshImport('../api/acceptInvite.js');
  const { req, res } = createMockReqRes({ method: 'POST', body: { token: 'reused-token', ...acceptedPolicies } });
  await handler(req, res);
  assert.equal(res.statusCode, 404);
});

test('acceptInvite succeeds for a valid, matching, unused invite', async (t) => {
  t.mock.module('../api/_security.js', mockAcceptInviteSecurity({ data: [{ company_id: 'c1', role: 'dispatch' }], error: null }));
  const { default: handler } = await freshImport('../api/acceptInvite.js');
  const { req, res } = createMockReqRes({ method: 'POST', body: { token: 'good-token', fullName: 'A B', ...acceptedPolicies } });
  await handler(req, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.success, true);
});

test('acceptInvite blocks acceptance when current policy versions are absent', async (t) => {
  let rpcCalled = false;
  t.mock.module('../api/_security.js', mockAcceptInviteSecurity({ data: null, error: null }));
  const { default: handler } = await freshImport('../api/acceptInvite.js');
  const { req, res } = createMockReqRes({ method: 'POST', body: { token: 'good-token' } });
  await handler(req, res);
  assert.equal(res.statusCode, 400);
  assert.match(res.body.error, /must accept/i);
  assert.equal(rpcCalled, false);
});
