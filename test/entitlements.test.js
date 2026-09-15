import test from 'node:test';
import assert from 'node:assert/strict';

import {
  FEATURES,
  PLAN_CODES,
  getSupportServiceLevel,
  hasFeature,
  isWithinLimit,
  resolveEntitlements,
} from '../src/lib/entitlements.js';

test('keeps all existing access when tier enforcement is off', () => {
  const result = resolveEntitlements(null);

  assert.equal(result.enforced, false);
  assert.equal(result.planName, 'Legacy access');
  assert.equal(hasFeature(result, FEATURES.CLIENT_PORTALS), true);
  assert.equal(isWithinLimit(result, 'teamMembers', 1000), true);
});

test('resolves active subscriptions to their configured plan', () => {
  const result = resolveEntitlements(
    { plan_code: PLAN_CODES.BUSINESS, status: 'active' },
    { enforcementEnabled: true }
  );

  assert.equal(result.planCode, PLAN_CODES.BUSINESS);
  assert.equal(hasFeature(result, FEATURES.EQUIPMENT_CALCULATOR), true);
  assert.equal(isWithinLimit(result, 'locations', 4), true);
  assert.equal(isWithinLimit(result, 'locations', 5), false);
});

test('falls back to Core when enforcement is on without paid access', () => {
  const result = resolveEntitlements(
    { plan_code: PLAN_CODES.ENTERPRISE, status: 'canceled' },
    { enforcementEnabled: true }
  );

  assert.equal(result.planCode, PLAN_CODES.CORE);
  assert.equal(hasFeature(result, FEATURES.QUOTE_CALCULATOR), true);
  assert.equal(hasFeature(result, FEATURES.CLIENT_PORTALS), false);
});

test('past-due subscriptions retain access during the provider grace period', () => {
  const result = resolveEntitlements(
    { plan_code: PLAN_CODES.BUSINESS, status: 'past_due' },
    { enforcementEnabled: true }
  );

  assert.equal(result.planCode, PLAN_CODES.BUSINESS);
});

test('all plans include tickets but only Enterprise receives priority support', () => {
  const core = resolveEntitlements(
    { plan_code: PLAN_CODES.CORE, status: 'active' },
    { enforcementEnabled: true }
  );
  const business = resolveEntitlements(
    { plan_code: PLAN_CODES.BUSINESS, status: 'active' },
    { enforcementEnabled: true }
  );
  const enterprise = resolveEntitlements(
    { plan_code: PLAN_CODES.ENTERPRISE, status: 'active' },
    { enforcementEnabled: true }
  );

  assert.equal(hasFeature(core, FEATURES.SUPPORT_TICKETS), true);
  assert.equal(hasFeature(business, FEATURES.SUPPORT_TICKETS), true);
  assert.equal(hasFeature(core, FEATURES.PRIORITY_SUPPORT), false);
  assert.equal(hasFeature(business, FEATURES.PRIORITY_SUPPORT), false);
  assert.equal(getSupportServiceLevel(core), 'standard');
  assert.equal(getSupportServiceLevel(business), 'standard');
  assert.equal(getSupportServiceLevel(enterprise), 'priority');
});
