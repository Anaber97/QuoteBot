import assert from 'node:assert/strict';
import test from 'node:test';
import { enforceRateLimit, escapeHtml, requireAuth } from '../api/_security.js';

test('HTML escaping protects notification templates', () => {
  assert.equal(escapeHtml(`<script>alert("x")</script>`), '&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;');
});

test('authenticated routes reject requests without a bearer token', async () => {
  await assert.rejects(() => requireAuth({ headers: {} }), (error) => error.status === 401);
});

test('rate limiter rejects requests after the configured budget', () => {
  const key = `test-${Date.now()}`;
  enforceRateLimit(key, { limit: 1, windowMs: 1000 });
  assert.throws(() => enforceRateLimit(key, { limit: 1, windowMs: 1000 }), (error) => error.status === 429);
});
