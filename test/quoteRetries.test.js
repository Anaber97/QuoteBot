import test from 'node:test';
import assert from 'node:assert/strict';
import { createFakeAdmin, createMockReqRes } from './helpers/mockSupabase.js';

test('preview does not save; retrying a save returns one quote and rejects changed input', async (t) => {
  const rows = [];
  let routes = 0;
  const profile = { id: 'client-user', company_id: 'company-a', client_id: 'client-a', role: 'client' };
  const admin = createFakeAdmin({ tableResponders: {
    app_config: () => ({ data: { bases: [{ id: 'yard', address: 'Public test yard' }], pricing: {}, client_portal: { weight_tiers: [{ minWeight: 0, maxWeight: 10000, rate: 150 }] }, geofences: {} } }),
    clients: () => ({ data: { id: 'client-a', company_id: 'company-a', pricing: {}, approval_threshold: 10000 } }),
    quote_logs: (state) => {
      if (state.op === 'insert') {
        const row = { id: `quote-${rows.length + 1}`, ...state.payload };
        rows.push(row);
        return { data: row };
      }
      return { data: rows.find((row) => Object.entries(state.filters).every(([key, value]) => row[key] === value)) || null };
    },
  } });
  t.mock.module('../api/_security.js', { exports: {
    requireUser: async () => ({ admin, profile }),
    enforceRateLimit: async () => {},
    sendApiError: (res, error) => res.status(error.status || 500).json({ error: error.message }),
  } });
  t.mock.module('../api/_routes.js', { exports: {
    computeServerRoute: async () => { routes++; return { totalMeters: 32186, rawDriveMinutes: 40, legs: [], customerRoutePoints: [] }; },
    resolveGoogleLocalities: async () => [],
  } });
  const { default: handler } = await import('../api/createQuote.js?retries');
  const body = { baseId: 'yard', waypoints: ['Public test pickup', 'Public test dropoff'], equipment: { weight: 5000 }, customRate: 1 };
  const call = async (input) => {
    const { req, res } = createMockReqRes({ method: 'POST', body: input });
    req.headers = { ...req.headers, 'idempotency-key': '12345678-1234-4234-8234-123456789abc' };
    await handler(req, res);
    return res;
  };
  const preview = await call({ ...body, preview: true });
  assert.equal(preview.statusCode, 200, JSON.stringify(preview.body));
  assert.equal(rows.length, 0);
  assert.deepEqual(Object.keys(preview.body.estimate).sort(), ['approvalRequired', 'total', 'totalHours', 'totalMiles']);
  const saved = await call(body);
  assert.equal(saved.statusCode, 201, JSON.stringify(saved.body));
  assert.equal(saved.body.quote.min_quote, preview.body.estimate.total);
  assert.equal(saved.body.quote.client_id, profile.client_id);
  assert.equal(saved.body.quote.quote_details.pricingOverrides.customRate, null);
  const retried = await call(body);
  assert.equal(retried.statusCode, 200);
  assert.equal(retried.body.quote.id, saved.body.quote.id);
  assert.equal(rows.length, 1);
  assert.equal(routes, 2, 'A saved retry does not repeat external routing');
  const changed = await call({ ...body, notes: 'Different request' });
  assert.equal(changed.statusCode, 409);
  assert.equal(rows.length, 1);
});
