import test from 'node:test';
import assert from 'node:assert/strict';
import { clientPortalConfig } from '../shared/config/clientPortal.js';

test('portal config excludes internal pricing, staff, other clients, and base addresses', () => {
  const source = { company_id: 'company-a', pricing: { hourly_rate: 200 }, users: [{ email: 'staff@example.test' }],
    bases: [{ id: 'base-1', name: 'Main', address: 'Private yard' }],
    client_portal: { contact_email: 'dispatch@example.test', weight_tiers: [{ rate: 100 }], clients: [{ id: 'other-client' }] },
    branding: { display_name: 'Tow company', internal: 'hidden' } };
  const result = clientPortalConfig(source);
  assert.equal(result.pricing, undefined);
  assert.equal(result.users, undefined);
  assert.equal(result.client_portal.weight_tiers, undefined);
  assert.equal(result.client_portal.clients, undefined);
  assert.equal(result.bases[0].address, undefined);
  assert.equal(result.branding.internal, undefined);
  assert.equal(result.client_portal.contact_email, 'dispatch@example.test');
});
