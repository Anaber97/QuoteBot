import test from 'node:test';
import assert from 'node:assert/strict';
import { signBolAccess, verifyBolAccess } from '../api/_bolAccess.js';

test('BOL access signatures accept an untampered unexpired link', () => {
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-server-secret';
  const expiresAt = Math.floor(Date.now() / 1000) + 60;
  assert.equal(verifyBolAccess('quote-1', expiresAt, signBolAccess('quote-1', expiresAt)), true);
});

test('BOL access signatures reject quote tampering and expiration', () => {
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-server-secret';
  const expiresAt = Math.floor(Date.now() / 1000) + 60;
  const signature = signBolAccess('quote-1', expiresAt);
  assert.equal(verifyBolAccess('quote-2', expiresAt, signature), false);
  assert.equal(verifyBolAccess('quote-1', Math.floor(Date.now() / 1000) - 1, signature), false);
});
