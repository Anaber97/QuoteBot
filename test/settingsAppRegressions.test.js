import test from 'node:test';
import assert from 'node:assert/strict';

/**
 * Regression guard: Settings.jsx's handleSave() previously referenced
 * `normalizeDriveTimeBuffer` and `ROUNDING_OPTIONS` without importing them,
 * which would throw a ReferenceError the first time a manager saved
 * settings. This statically verifies both are imported from configSchema.
 */
test('Settings.jsx imports every identifier it references from configSchema', async () => {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const settingsSource = fs.readFileSync(path.resolve(__dirname, '../src/components/Settings.jsx'), 'utf8');

  const importLine = settingsSource.match(/import\s*\{([^}]+)\}\s*from\s*'\.\.\/lib\/configSchema'/);
  assert(importLine, 'Settings.jsx must import from ../lib/configSchema');
  const imported = new Set(importLine[1].split(',').map((s) => s.trim()));

  for (const identifier of ['normalizeDriveTimeBuffer', 'ROUNDING_OPTIONS', 'normalizeConfig', 'normalizeClientPortalTier', 'DEFAULT_CONFIG']) {
    assert(imported.has(identifier), `Settings.jsx references "${identifier}" and must import it from configSchema`);
  }
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
