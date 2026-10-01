import test from 'node:test';
import assert from 'node:assert/strict';
import { readStoredConfig } from '../shared/config/storage.js';
import { normalizeConfig } from '../src/lib/configSchema.js';

test('stored config merges partial structured sections without losing legacy fields', () => {
  const row = { config: { pricing: { hourly_rate: 150, mileage_rate: 8 }, branding: { display_name: 'Tow' } }, pricing: { hourly_rate: 200 } };
  const result = readStoredConfig(row);
  assert.deepEqual(result.pricing, { hourly_rate: 200, mileage_rate: 8 });
  assert.equal(normalizeConfig(row).pricing.mileage_rate, 8);
  assert.equal(result.branding.display_name, 'Tow');
  assert.equal(result.config, undefined);
  assert.equal(row.config.pricing.hourly_rate, 150);
});
