import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeConfig } from '../src/lib/configSchema.js';
import { sanitizeConfig } from '../src/lib/configValidator.js';
import { buildSettingsPayload } from '../src/features/settings/buildSettingsPayload.js';
import { readStoredConfig } from '../shared/config/storage.js';

test('edited business surcharges survive payload, server sanitation, storage and reload', () => {
  const draft = normalizeConfig({ pricing: { after_hours_multiplier: 25, road_club_multiplier: 15 } });
  const afterHours = draft.pricing.custom_surcharges.find((row) => row.id === 'after-hours');
  Object.assign(afterHours, { value: 50, feeType: 'flat', name: 'After-Hours Service', active: false });
  draft.pricing.custom_surcharges.find((row) => row.id === 'road-club').value = 0;
  const saved = normalizeConfig(sanitizeConfig(buildSettingsPayload(draft, 'company')));
  const reloaded = normalizeConfig(readStoredConfig(saved));
  assert.deepEqual(reloaded.pricing.custom_surcharges.find((row) => row.id === 'after-hours'), afterHours);
  assert.equal(reloaded.pricing.custom_surcharges.find((row) => row.id === 'road-club').value, 0);
  assert.equal(reloaded.pricing.configurable_business_surcharges, true);
});

test('older saved configs without migration marker preserve explicit custom business rates', () => {
  const config = normalizeConfig({ pricing: { after_hours_multiplier: 25,
    custom_surcharges: [{ id: 'after-hours', name: 'After Hours', feeType: 'percent', value: 45, active: true }] } });
  assert.equal(config.pricing.custom_surcharges.find((row) => row.id === 'after-hours').value, 45);
  assert.equal(config.pricing.custom_surcharges.filter((row) => row.id === 'after-hours').length, 1);
});

test('deliberately removed business surcharges do not reappear on save', () => {
  const config = normalizeConfig({ pricing: { configurable_business_surcharges: true, custom_surcharges: [] } });
  assert.deepEqual(normalizeConfig(sanitizeConfig(config)).pricing.custom_surcharges, []);
});
