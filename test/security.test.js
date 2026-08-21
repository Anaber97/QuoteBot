import assert from 'node:assert/strict';
import test from 'node:test';
import { canAccessQuote, enforceRateLimit, escapeHtml, requireAuth } from '../api/_security.js';

test('HTML escaping protects notification templates', () => {
  assert.equal(escapeHtml(`<script>alert("x")</script>`), '&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;');
});

test('authenticated routes reject requests without a bearer token', async () => {
  await assert.rejects(() => requireAuth({ headers: {} }), (error) => error.status === 401);
});

test('persistent rate limiter rejects requests after the configured budget', async () => {
  const admin = { rpc: async () => ({ data: [{ allowed: false, retry_after: 42 }], error: null }) };
  await assert.rejects(
    () => enforceRateLimit(admin, 'test-key', { limit: 1, windowMs: 1000 }),
    (error) => error.status === 429 && error.retryAfter === 42
  );
});

test('quote permissions isolate companies and client accounts by role', () => {
  const quote = { company_id: 'company-a', client_id: 'client-a', quote_source: 'client_portal' };
  assert.equal(canAccessQuote({ role: 'manager', company_id: 'company-a' }, quote, 'manage_company'), true);
  assert.equal(canAccessQuote({ role: 'dispatch', company_id: 'company-a' }, quote, 'read'), true);
  assert.equal(canAccessQuote({ role: 'dispatch', company_id: 'company-a' }, quote, 'manage_company'), false);
  assert.equal(canAccessQuote({ role: 'client', company_id: 'company-a', client_id: 'client-a' }, quote, 'read'), true);
  assert.equal(canAccessQuote({ role: 'client', company_id: 'company-a', client_id: 'client-a' }, quote, 'change_status'), false);
  assert.equal(canAccessQuote({ role: 'client', company_id: 'company-a', client_id: 'client-b' }, quote, 'read'), false);
  assert.equal(canAccessQuote({ role: 'manager', company_id: 'company-b' }, quote, 'read'), false);
});
