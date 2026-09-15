import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const migration = readFileSync(
  new URL('../supabase/migrations/20260902204911_add_billing_entitlements.sql', import.meta.url),
  'utf8'
).toLowerCase();

test('subscription records use RLS and company-scoped reads', () => {
  assert.match(migration, /alter table public\.company_subscriptions enable row level security/);
  assert.match(migration, /to authenticated\s+using \(company_id = \(select company_id from private\.current_profile\(\)\)\)/);
});

test('browser clients cannot mutate authoritative subscription state', () => {
  assert.match(migration, /revoke all on table public\.company_subscriptions from anon, authenticated/);
  assert.match(migration, /grant select on table public\.company_subscriptions to authenticated/);
  assert.doesNotMatch(migration, /grant (insert|update|delete|all).*authenticated/);
});

test('trusted server billing code can maintain subscription state', () => {
  assert.match(migration, /grant all on table public\.company_subscriptions to service_role/);
});
