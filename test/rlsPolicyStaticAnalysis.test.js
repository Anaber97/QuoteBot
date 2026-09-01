import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * STATIC RLS/MIGRATION ANALYSIS
 *
 * There's no local Supabase/Docker instance available in this environment to
 * run live RLS integration tests, so this statically replays every migration
 * in chronological order to reconstruct the *effective* final set of RLS
 * policies (accounting for later `drop policy` / re-`create policy`
 * statements), then asserts tenant isolation is actually enforced —
 * especially for BOL storage, which is uploaded/selected/deleted directly
 * from the browser against Supabase Storage rather than through an API
 * handler, so RLS is the *only* enforcement layer.
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.resolve(__dirname, '../supabase/migrations');

function loadMigrationsInOrder() {
  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((name) => name.endsWith('.sql'))
    .sort() // filenames are timestamp-prefixed
    .map((name) => fs.readFileSync(path.join(MIGRATIONS_DIR, name), 'utf8'));
}

/** Builds a registry of table::policyName -> statement text reflecting the final state. */
function buildEffectivePolicyRegistry(migrationTexts) {
  const registry = new Map();
  for (const sql of migrationTexts) {
    // Split on ';' — none of these policy expressions contain literal semicolons.
    const statements = sql.split(';');
    for (const raw of statements) {
      const statement = raw.trim();
      if (!statement) continue;

      const dropMatch = statement.match(/drop\s+policy\s+if\s+exists\s+"?([^"\n]+?)"?\s+on\s+(\S+)/i);
      if (dropMatch) {
        const [, policyName, table] = dropMatch;
        registry.delete(`${table}::${policyName}`);
        continue;
      }

      const createMatch = statement.match(/create\s+policy\s+"?([^"\n]+?)"?\s+on\s+(\S+)\s+for\s+(select|insert|update|delete|all)/i);
      if (createMatch) {
        const [, policyName, table] = createMatch;
        registry.set(`${table}::${policyName}`, statement);
      }
    }
  }
  return registry;
}

const registry = buildEffectivePolicyRegistry(loadMigrationsInOrder());

function policiesForTable(table) {
  return [...registry.entries()].filter(([key]) => key.startsWith(`${table}::`)).map(([, statement]) => statement);
}

// ===== quote_logs tenant isolation =====

test('quote_logs has effective select/update policies scoped by company_id', () => {
  const statements = policiesForTable('public.quote_logs');
  assert(statements.length >= 2, `expected select/update policies, found ${statements.length}`);
  for (const statement of statements) {
    assert.match(statement, /company_id\s*=\s*\(select company_id from private\.current_profile\(\)\)/i);
  }
});

test('quote_logs insert is server-authoritative: no client-facing insert policy or grant remains', () => {
  const migrations = loadMigrationsInOrder().join('\n');
  // The insert policy must have been dropped and never recreated afterward.
  assert(!policiesForTable('public.quote_logs').some((s) => /for\s+insert/i.test(s)), 'quote_logs must not have a client-facing insert policy');
  assert.match(migrations, /revoke insert on public\.quote_logs from authenticated/i);
});

test('quote_logs client-role policies additionally scope by client_id and quote_source', () => {
  const statements = policiesForTable('public.quote_logs');
  const clientScoped = statements.filter((s) => /quote_source\s*=\s*'client_portal'/i.test(s));
  assert(clientScoped.length > 0, 'expected at least one client-portal-scoped clause');
  for (const statement of clientScoped) {
    assert.match(statement, /client_id\s*=\s*\(select client_id from private\.current_profile\(\)\)/i);
  }
});

// ===== BOL storage tenant isolation (client/browser talks directly to Storage) =====

test('quote-bols storage bucket has select/insert/delete policies (no public access)', () => {
  const statements = policiesForTable('storage.objects').filter((s) => /quote-bols/i.test(s));
  const actions = new Set();
  for (const statement of statements) {
    const match = statement.match(/for\s+(select|insert|update|delete|all)/i);
    if (match) actions.add(match[1].toLowerCase());
  }
  assert(actions.has('select'), 'missing select policy for quote-bols');
  assert(actions.has('insert'), 'missing insert policy for quote-bols');
  assert(actions.has('delete'), 'missing delete policy for quote-bols');
});

test('every quote-bols storage policy requires the object to belong to a quote in the caller\'s company', () => {
  const statements = policiesForTable('storage.objects').filter((s) => /quote-bols/i.test(s));
  assert(statements.length > 0);
  for (const statement of statements) {
    assert.match(statement, /bucket_id\s*=\s*'quote-bols'/i);
    assert.match(
      statement,
      /q\.company_id\s*=\s*\(select company_id from private\.current_profile\(\)\)/i,
      `policy does not scope by company_id via joined quote_logs row: ${statement.slice(0, 120)}...`
    );
  }
});

test('quote-bols insert policy also pins the storage path prefix to the caller\'s company_id', () => {
  const statements = policiesForTable('storage.objects').filter((s) => /quote-bols/i.test(s) && /for\s+insert/i.test(s));
  assert(statements.length > 0, 'expected an insert policy for quote-bols');
  for (const statement of statements) {
    assert.match(statement, /storage\.foldername\(name\)\)\[1\]\s*=\s*\(select company_id::text from private\.current_profile\(\)\)/i);
  }
});

test('the quote-bols bucket is created as private (public = false)', () => {
  const migrations = loadMigrationsInOrder().join('\n');
  const bucketMatch = migrations.match(/values\s*\('quote-bols',\s*'quote-bols',\s*(true|false)/i);
  assert(bucketMatch, 'could not find quote-bols bucket definition');
  assert.equal(bucketMatch[1], 'false');
});

// ===== Server-only tables should deny direct client access entirely =====

test('account_requests and company_invites are explicitly denied to direct client access', () => {
  const accountRequests = policiesForTable('public.account_requests');
  const companyInvites = policiesForTable('public.company_invites');
  assert(accountRequests.some((s) => /using\s*\(false\)/i.test(s)), 'account_requests should have an explicit deny-all policy');
  assert(companyInvites.some((s) => /using\s*\(false\)/i.test(s)), 'company_invites should have an explicit deny-all policy (server-only via service role)');
});
