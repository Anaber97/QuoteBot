import test from 'node:test';
import assert from 'node:assert/strict';
import { equipmentScope, scopeEquipmentQuery, normalizeSavedEquipment } from '../api/_savedEquipment.js';
import { validateEquipment } from '../api/saveEquipment.js';
import { createFakeAdmin, createMockReqRes } from './helpers/mockSupabase.js';

const valid = { make: 'CAT', model: '320', serial_number: 'TEST-1', operating_weight_lbs: 45000, width_in: 102.5, height_in: 138 };

test('private equipment scope is derived from role and rejects unassigned clients', () => {
  assert.deepEqual(equipmentScope({ role: 'client', company_id: 'a', client_id: 'c' }), { company_id: 'a', client_id: 'c' });
  assert.deepEqual(equipmentScope({ role: 'dispatch', company_id: 'a', client_id: 'c' }), { company_id: 'a', client_id: null });
  assert.throws(() => equipmentScope({ role: 'client', company_id: 'a' }), { status: 403 });
});

test('private searches always constrain company and client, or company-only ownership', () => {
  for (const client_id of ['client-a', null]) {
    const filters = [];
    const builder = { eq: (key, value) => { filters.push(['eq', key, value]); return builder; }, is: (key, value) => { filters.push(['is', key, value]); return builder; } };
    scopeEquipmentQuery(builder, { company_id: 'company-a', client_id });
    assert.deepEqual(filters, [['eq', 'company_id', 'company-a'], [client_id ? 'eq' : 'is', 'client_id', client_id]]);
  }
});

test('manual specs remain LOW even if a caller submits HIGH', () => {
  const item = normalizeSavedEquipment({ ...valid, id: 'id', confidence: 'HIGH', verification_status: 'Verified' });
  assert.equal(item.confidence, 'LOW'); assert.equal(item.requires_confirmation, true);
  assert.equal(validateEquipment({ ...valid, company_id: 'attacker', sources: [{}] }).company_id, undefined);
});

test('manual validation rejects missing, invalid, and nonpositive specs', () => {
  for (const changed of [{ make: '' }, { model: '' }, { width_in: 0 }, { height_in: -1 }, { operating_weight_lbs: Infinity }, { width_in: true }, { height_in: 2001 }]) {
    assert.throws(() => validateEquipment({ ...valid, ...changed }), { status: 400 });
  }
  assert.equal(validateEquipment(valid).width_in, 102.5);
  assert.equal(validateEquipment({ ...valid, make: ' cat ' }).equipment_key, validateEquipment(valid).equipment_key);
});

for (const role of ['manager', 'client']) {
  test(`save endpoint ignores supplied ownership and saves only private ${role} scope`, async (t) => {
    let saved;
    const admin = createFakeAdmin({ tableResponders: {
      clients: () => ({ data: { id: 'my-client' } }),
      saved_equipment: (state) => { saved = state.payload; return { data: { id: 'id', ...saved } }; },
      equipment_specs: () => { assert.fail('Manual equipment must never enter the shared catalog'); },
    } });
    t.mock.module('../api/_security.js', { exports: {
      requireUser: async () => ({ admin, profile: { id: 'me', role, company_id: 'my-company', client_id: 'my-client' } }),
      enforceRateLimit: async () => {}, sendApiError: (res, error) => res.status(error.status || 500).json({ error: error.message }),
    } });
    const { default: handler } = await import(`../api/saveEquipment.js?${role}`);
    const { req, res } = createMockReqRes({ method: 'POST', body: { ...valid, company_id: 'other-company', client_id: 'other-client', confidence: 'HIGH' } });
    await handler(req, res);
    assert.equal(res.statusCode, 200); assert.equal(saved.company_id, 'my-company');
    assert.equal(saved.client_id, role === 'client' ? 'my-client' : null);
    assert.equal(saved.confidence, undefined); assert.equal(res.body.equipment.confidence, 'LOW');
  });
}
