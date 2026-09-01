import test from 'node:test';
import assert from 'node:assert/strict';
import { createFakeAdmin, createMockReqRes } from './helpers/mockSupabase.js';
import { canAccessQuote } from '../api/_security.js';

/**
 * FULL WORKFLOW INTEGRATION TEST
 *
 * sign in -> calculate & save a quote -> reopen it -> change its status.
 * Chains the real createQuote + updateQuoteStatus handlers (with the real
 * pricing/quote engine) against a single in-memory "quote_logs" table shared
 * across steps, so a bug at any step (e.g. losing company_id, or allowing an
 * illegal status transition) would break the whole chain.
 */

let uniq = 0;
async function freshImport(path) {
  uniq += 1;
  return import(`${path}?t=${uniq}`);
}

// In-memory "database" shared across the whole workflow.
function createInMemoryStore() {
  const quoteLogs = new Map();
  const appConfig = new Map([
    ['company-a', {
      company_id: 'company-a',
      pricing: { hourly_min: 100, hourly_max: 150, drive_time_buffer: 10, load_unload_base_mins: 30, rounding_interval: 25 },
      surcharges: {},
      geofences: { disabledZones: [], customZones: [] },
      bases: [{ id: 'base-1', name: 'Main Yard', address: '100 Main St, Springfield' }],
      users: [],
      client_portal: {},
    }],
  ]);
  return { quoteLogs, appConfig };
}

function adminFor(store, profile) {
  return createFakeAdmin({
    tableResponders: {
      app_config: () => ({ data: store.appConfig.get(profile.company_id) || null, error: null }),
      quote_logs: (state) => {
        if (state.op === 'insert') {
          const id = `quote-${store.quoteLogs.size + 1}`;
          const row = { id, ...state.payload };
          store.quoteLogs.set(id, row);
          return { data: row, error: null };
        }
        if (state.op === 'update') {
          const row = store.quoteLogs.get(state.filters.id);
          if (!row || row.company_id !== state.filters.company_id) return { data: null, error: { message: 'not found' } };
          Object.assign(row, state.payload);
          return { data: { id: row.id, status: row.status }, error: null };
        }
        // select
        const row = store.quoteLogs.get(state.filters.id);
        if (!row || (state.filters.company_id && row.company_id !== state.filters.company_id)) {
          return { data: null, error: { message: 'not found' } };
        }
        return { data: row, error: null };
      },
    },
  });
}

test('sign in -> calculate & save -> reopen -> change status (end-to-end)', async (t) => {
  const store = createInMemoryStore();
  const managerProfile = { id: 'user-1', role: 'manager', company_id: 'company-a' };

  // ----- Step 1: "sign in" is represented by requireUser resolving a profile -----
  t.mock.module('../api/_security.js', {
    exports: {
      canAccessQuote,
      enforceRateLimit: async () => {},
      sendApiError: (res, error, fallback) => res.status(error?.status || 500).json({ error: error?.status ? error.message : fallback }),
      requireUser: async () => ({ admin: adminFor(store, managerProfile), profile: managerProfile }),
    },
  });
  t.mock.module('../api/_routes.js', {
    exports: {
      computeServerRoute: async () => ({ totalMeters: 32186.9, rawDriveMinutes: 45, customerRoutePoints: [], legs: [] }),
      resolveGoogleLocalities: async () => [],
    },
  });
  t.mock.module('../api/_approvalEmail.js', { exports: { sendStoredApprovalEmail: async () => {} } });

  // ----- Step 2: calculate & save a quote -----
  const { default: createQuoteHandler } = await freshImport('../api/createQuote.js');
  const { req: createReq, res: createRes } = createMockReqRes({
    method: 'POST',
    body: { baseId: 'base-1', waypoints: ['100 Main St, Springfield', '200 Oak Ave, Springfield'], selectedTruckClassId: 'light' },
  });
  await createQuoteHandler(createReq, createRes);
  assert.equal(createRes.statusCode, 201, JSON.stringify(createRes.body));
  const savedQuote = createRes.body.quote;
  assert.equal(savedQuote.company_id, 'company-a');
  assert.equal(savedQuote.status, 'submitted');
  assert(savedQuote.min_quote > 0);

  // ----- Step 3: reopen (re-fetch full quote details, as QuoteLog.jsx does) -----
  const admin = adminFor(store, managerProfile);
  const { data: reopened, error: reopenError } = await admin.from('quote_logs').select('*').eq('id', savedQuote.id).single();
  assert.equal(reopenError, null);
  assert.equal(reopened.id, savedQuote.id);
  assert.equal(reopened.status, 'submitted');

  // ----- Step 4: change status (submitted -> approved is a legal transition) -----
  const { default: updateStatusHandler } = await freshImport('../api/updateQuoteStatus.js');
  const { req: statusReq, res: statusRes } = createMockReqRes({
    method: 'PATCH',
    body: { quoteId: savedQuote.id, status: 'approved' },
  });
  await updateStatusHandler(statusReq, statusRes);
  assert.equal(statusRes.statusCode, 200, JSON.stringify(statusRes.body));
  assert.equal(statusRes.body.quote.status, 'approved');
  assert.equal(store.quoteLogs.get(savedQuote.id).status, 'approved');
});

test('workflow rejects a second manager from a different company trying to reopen the quote', async (t) => {
  const store = createInMemoryStore();
  const managerProfile = { id: 'user-1', role: 'manager', company_id: 'company-a' };
  const outsiderProfile = { id: 'user-2', role: 'manager', company_id: 'company-b' };

  t.mock.module('../api/_security.js', {
    exports: {
      canAccessQuote,
      enforceRateLimit: async () => {},
      sendApiError: (res, error, fallback) => res.status(error?.status || 500).json({ error: error?.status ? error.message : fallback }),
      requireUser: async () => ({ admin: adminFor(store, managerProfile), profile: managerProfile }),
    },
  });
  t.mock.module('../api/_routes.js', {
    exports: {
      computeServerRoute: async () => ({ totalMeters: 16093.4, rawDriveMinutes: 20, customerRoutePoints: [], legs: [] }),
      resolveGoogleLocalities: async () => [],
    },
  });
  t.mock.module('../api/_approvalEmail.js', { exports: { sendStoredApprovalEmail: async () => {} } });

  const { default: createQuoteHandler } = await freshImport('../api/createQuote.js');
  const { req: createReq, res: createRes } = createMockReqRes({
    method: 'POST',
    body: { baseId: 'base-1', waypoints: ['100 Main St, Springfield', '200 Oak Ave, Springfield'] },
  });
  await createQuoteHandler(createReq, createRes);
  assert.equal(createRes.statusCode, 201);
  const savedQuote = createRes.body.quote;

  // Outsider (different company) attempts to reopen the same quote id.
  const outsiderAdmin = adminFor(store, outsiderProfile);
  const { data, error } = await outsiderAdmin.from('quote_logs').select('*').eq('id', savedQuote.id).eq('company_id', outsiderProfile.company_id).single();
  assert.equal(data, null);
  assert(error);
});
