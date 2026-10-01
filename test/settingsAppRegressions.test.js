import test from 'node:test';
import assert from 'node:assert/strict';

// Exercise the save payload directly instead of tying this regression to a component's imports.
test('settings payload normalization executes and retains company scope', async () => {
  const { buildSettingsPayload } = await import('../src/features/settings/buildSettingsPayload.js');
  const result = buildSettingsPayload({ pricing: { hourly_rate: 175 } }, 'company-a');
  assert.equal(result.company_id, 'company-a');
  assert.equal(result.pricing.hourly_rate, 175);
  assert(Array.isArray(result.client_portal.weight_tiers));
});

test('configSchema exports ROUNDING_OPTIONS and normalizeDriveTimeBuffer', async () => {
  const configSchema = await import('../src/lib/configSchema.js');
  assert(Array.isArray(configSchema.ROUNDING_OPTIONS));
  assert(configSchema.ROUNDING_OPTIONS.includes(25));
  assert.equal(typeof configSchema.normalizeDriveTimeBuffer, 'function');
});

test('App.jsx does not contain orphaned dead code after the last export/const statement', async () => {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const appSource = fs.readFileSync(path.resolve(__dirname, '../src/App.jsx'), 'utf8');
  // A dangling top-level `};` immediately followed by another top-level `};`
  // was the signature of the orphaned-object-literal bug found in this file.
  assert(!/\n\s*\};\s*\n\s*\};\s*\n/.test(appSource), 'App.jsx appears to contain orphaned duplicate closing braces');
});
