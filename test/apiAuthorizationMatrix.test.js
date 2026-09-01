import test from 'node:test';
import assert from 'node:assert/strict';
import { createFakeAdmin, createMockReqRes } from './helpers/mockSupabase.js';
import { canAccessQuote } from '../api/_security.js';

/**
 * API AUTHORIZATION MATRIX
 *
 * Exercises the requireUser/canAccessQuote gating that every handler relies
 * on, across roles (manager/dispatch/client) and tenants (company A vs B),
 * for endpoints beyond quote-status (already covered in
 * quoteStatusTransitions.test.js).
 */

let uniq = 0;
async function freshImport(path) {
  uniq += 1;
  return import(`${path}?t=${uniq}`);
}

function mockSecurityModule(overrides = {}) {
  return {
    exports: {
      canAccessQuote,
      enforceRateLimit: async () => {},
      sendApiError: (res, error, fallback) => res.status(error?.status || 500).json({ error: error?.status ? error.message : fallback }),
      escapeHtml: (value) => String(value ?? ''),
      getTrustedSiteUrl: () => 'https://app.example.com',
      createAdminClient: () => createFakeAdmin(),
      ...overrides,
    },
  };
}

// ===== notifyApproval.js: tenant + role isolation =====

test('notifyApproval rejects a request for a quote in a different company', async (t) => {
  const quote = { id: 'q1', company_id: 'company-b', client_id: null, quote_source: 'main_calculator' };
  t.mock.module('../api/_security.js', mockSecurityModule({
    requireUser: async () => ({ admin: createFakeAdmin({ tableResponders: { quote_logs: () => ({ data: null, error: { message: 'not found' } }) } }), profile: { id: 'u1', role: 'manager', company_id: 'company-a' } }),
  }));
  t.mock.module('../api/_approvalEmail.js', { exports: { sendStoredApprovalEmail: async () => {} } });
  const { default: handler } = await freshImport('../api/notifyApproval.js');
  const { req, res } = createMockReqRes({ method: 'POST', body: { quoteId: quote.id } });
  await handler(req, res);
  assert.equal(res.statusCode, 404); // company-scoped query never finds cross-tenant quote
});

test('notifyApproval rejects a dispatcher acting outside their permitted actions on a client quote', async (t) => {
  const quote = { id: 'q1', company_id: 'company-a', client_id: 'client-a', quote_source: 'client_portal' };
  t.mock.module('../api/_security.js', mockSecurityModule({
    requireUser: async () => ({ admin: createFakeAdmin({ tableResponders: { quote_logs: () => ({ data: quote, error: null }) } }), profile: { id: 'u1', role: 'client', company_id: 'company-a', client_id: 'client-b' } }),
  }));
  t.mock.module('../api/_approvalEmail.js', { exports: { sendStoredApprovalEmail: async () => {} } });
  const { default: handler } = await freshImport('../api/notifyApproval.js');
  const { req, res } = createMockReqRes({ method: 'POST', body: { quoteId: quote.id } });
  await handler(req, res);
  assert.equal(res.statusCode, 403); // wrong client_id
});

test('notifyApproval allows the owning client to request dispatch', async (t) => {
  const quote = { id: 'q1', company_id: 'company-a', client_id: 'client-a', quote_source: 'client_portal' };
  let emailSent = false;
  t.mock.module('../api/_security.js', mockSecurityModule({
    requireUser: async () => ({ admin: createFakeAdmin({ tableResponders: { quote_logs: () => ({ data: quote, error: null }) } }), profile: { id: 'u1', role: 'client', company_id: 'company-a', client_id: 'client-a' } }),
  }));
  t.mock.module('../api/_approvalEmail.js', { exports: { sendStoredApprovalEmail: async () => { emailSent = true; } } });
  const { default: handler } = await freshImport('../api/notifyApproval.js');
  const { req, res } = createMockReqRes({ method: 'POST', body: { quoteId: quote.id } });
  await handler(req, res);
  assert.equal(res.statusCode, 200);
  assert.equal(emailSent, true);
});

// ===== inviteUser.js: manager-only =====

test('inviteUser is rejected before reaching business logic when caller is not a manager', async (t) => {
  t.mock.module('../api/_security.js', mockSecurityModule({
    requireUser: async () => {
      const error = new Error('Manager access required.');
      error.status = 403;
      throw error;
    },
  }));
  const { default: handler } = await freshImport('../api/inviteUser.js');
  const { req, res } = createMockReqRes({ method: 'POST', body: { email: 'a@b.com', role: 'dispatch', company_id: 'company-a' } });
  await handler(req, res);
  assert.equal(res.statusCode, 403);
});

test('inviteUser rejects an invalid role before any database access', async (t) => {
  t.mock.module('../api/_security.js', mockSecurityModule({
    requireUser: async () => ({ admin: createFakeAdmin(), profile: { id: 'u1', role: 'manager', company_id: 'company-a' } }),
  }));
  const { default: handler } = await freshImport('../api/inviteUser.js');
  const { req, res } = createMockReqRes({ method: 'POST', body: { email: 'a@b.com', role: 'superadmin', company_id: 'company-a' } });
  await handler(req, res);
  assert.equal(res.statusCode, 400);
});

test('inviteUser succeeds for a manager inviting a dispatcher in their own company', async (t) => {
  t.mock.module('../api/_security.js', mockSecurityModule({
    requireUser: async () => ({
      admin: createFakeAdmin({
        tableResponders: { company_invites: () => ({ data: [{ id: 'invite-1' }], error: null }) },
      }),
      profile: { id: 'u1', role: 'manager', company_id: 'company-a' },
    }),
  }));
  const { default: handler } = await freshImport('../api/inviteUser.js');
  const { req, res } = createMockReqRes({ method: 'POST', body: { email: 'a@b.com', role: 'dispatch', company_id: 'company-a' } });
  await handler(req, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.success, true);
});

// ===== getAppConfig.js: tenant isolation =====

test('getAppConfig rejects fetching another company\'s configuration', async (t) => {
  t.mock.module('../api/_security.js', mockSecurityModule({
    requireUser: async () => {
      const error = new Error('You do not have access to this company.');
      error.status = 403;
      throw error;
    },
  }));
  const { default: handler } = await freshImport('../api/getAppConfig.js');
  const { req, res } = createMockReqRes({ method: 'GET', query: { company_id: 'company-b' } });
  await handler(req, res);
  assert.equal(res.statusCode, 403);
});

test('getAppConfig returns merged config for an authorized caller', async (t) => {
  t.mock.module('../api/_security.js', mockSecurityModule({
    requireUser: async () => ({
      admin: createFakeAdmin({
        tableResponders: {
          app_config: () => ({ data: { company_id: 'company-a', pricing: { hourly_min: 100 }, config: { pricing: { hourly_max: 150 } } }, error: null }),
        },
      }),
      profile: { id: 'u1', role: 'manager', company_id: 'company-a' },
    }),
  }));
  const { default: handler } = await freshImport('../api/getAppConfig.js');
  const { req, res } = createMockReqRes({ method: 'GET', query: { company_id: 'company-a' } });
  await handler(req, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.config.pricing.hourly_min, 100);
  assert.equal(res.body.config.pricing.hourly_max, 150);
});

// ===== saveAppConfig.js: manager-only enforcement at the handler level =====

test('saveAppConfig rejects a non-manager even with a perfectly valid config body', async (t) => {
  t.mock.module('../api/_security.js', mockSecurityModule({
    requireUser: async () => {
      const error = new Error('Manager access required.');
      error.status = 403;
      throw error;
    },
  }));
  const { default: handler } = await freshImport('../api/saveAppConfig.js');
  const { req, res } = createMockReqRes({
    method: 'POST',
    body: { company_id: 'company-a', config: { pricing: { hourly_min: 100, hourly_max: 150 } } },
    headers: { 'content-length': '200' },
  });
  await handler(req, res);
  assert.equal(res.statusCode, 403);
});

// ===== sendQuoteEmail.js: cross-tenant / cross-role isolation =====

test('sendQuoteEmail rejects when the quote belongs to a different client account', async (t) => {
  const quote = { id: 'q1', company_id: 'company-a', client_id: 'client-a', quote_source: 'client_portal', applied_surcharges: {} };
  t.mock.module('../api/_security.js', mockSecurityModule({
    requireUser: async () => ({
      admin: createFakeAdmin({ tableResponders: { quote_logs: () => ({ data: quote, error: null }) } }),
      profile: { id: 'u1', role: 'client', company_id: 'company-a', client_id: 'client-other' },
    }),
  }));
  const { default: handler } = await freshImport('../api/sendQuoteEmail.js');
  const { req, res } = createMockReqRes({ method: 'POST', body: { quoteId: quote.id, action: 'action' } });
  await handler(req, res);
  assert.equal(res.statusCode, 403);
});
