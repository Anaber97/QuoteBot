import test from 'node:test';
import assert from 'node:assert/strict';
import { getServerEnv } from '../api/_env.js';

test('server environment values are trimmed and unquoted', () => {
  const name = 'QUOTEBOT_ENV_NORMALIZATION_TEST';
  const previousValue = process.env[name];

  try {
    process.env[name] = '  "test-secret"  ';
    assert.equal(getServerEnv(name), 'test-secret');
  } finally {
    if (previousValue === undefined) {
      delete process.env[name];
    } else {
      process.env[name] = previousValue;
    }
  }
});
