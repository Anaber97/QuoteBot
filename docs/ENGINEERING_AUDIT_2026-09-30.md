# TowCalc engineering audit — September 30, 2026

## Assessment

TowCalc has a credible application foundation, with engineering safeguards already present. Its main weakness is consistency between source, database, test environment, and deployment. Preserve the existing product and improve it in small, verified changes. A framework rewrite would not address the most important findings.

Scope: local tracked source and configuration, application and marketing checks, and read-only inspection of the live TowCalc Pro Supabase project (`ofolfmkhagsjwkgjewof`). No application source or production settings were changed. This report and ignored verification logs are audit outputs; builds regenerated ignored output directories.

This was not a penetration test or visual/browser accessibility audit. Customer records were not needed. Deployment secrets, branch protections, active alert delivery, backup availability/restoration, and environment isolation were not independently verified.

## Verified strengths

- 205 Node tests and 37 component tests passed: 242 total.
- Application and marketing lint and production builds passed.
- Public npm registry audits reported zero known production dependency vulnerabilities in both projects. Development dependencies were excluded.
- Git working tree was clean at the start; credentials in `.env` are ignored, and `.env.example` is tracked. This is not a full Git-history secret scan.
- The server verifies users through Supabase Auth and checks company membership. Quotes are calculated on the server, with browser/server pricing parity tests.
- All 11 current public database tables have row-level security enabled. Both storage buckets are private and have file size/type restrictions.
- Live email relay source checks server credentials before accepting content. Its disabled gateway JWT verification is not, by itself, evidence of an open email relay.
- CI, rate limiting, error handling, quote audit events, operational endpoints, and recovery instructions already exist.

## Findings, ordered by priority

### 1. Reconcile database migration history before the next schema release — high

There are 18 local migration files and 16 remote migration records.

| Change | Folder | Live database |
|---|---|---|
| Client logo/co-branding | `20260902202725_client_logo_cobranding.sql` | No matching history entry, but `clients.logo_path` and the client-scoped branding policy exist |
| Subscription foundation | `20260902204911_add_billing_entitlements.sql` | No matching history entry; `company_subscriptions` is absent |
| Equipment verification | `20260904194450_equipment_spec_verification.sql` | Recorded as `20260904194843` |
| Equipment server access | `20260904194942_equipment_specs_server_only_access.sql` | Recorded as `20260904194957` |

Consequences: the migration ledger is not a reliable description of deployment state. A clean environment and production can differ even when repository tests pass. Billing is a staged foundation: `src/lib/entitlements.js` defaults to legacy access, and no application/API consumers of its resolver were found. The missing billing table does not establish an active billing outage.

Action: compare actual SQL definitions, distinguish already-applied changes from pending features, and reconcile history deliberately. Do not blindly rerun or mark every migration applied. Establish one reviewed migration/deployment path.

Done when: a disposable database can be built from the repository, expected schema differences are explained, and the release process detects drift.

### 2. Decide exactly what client accounts may read — high review priority

Live `profiles_select_company` and `app_config_select_company` policies allow reads by company membership, without a client-specific restriction. `api/appConfig.js` also returns the full company configuration to any company member. These paths permit client users to read company-wide profile/configuration information, beyond merely hiding controls in the interface.

This is a confirmed access scope, not proof of cross-company exposure. Whether it violates the product's intended privacy model requires a product decision.

Action: document a manager/dispatcher/client access matrix. If clients should see only their own profile and portal configuration, narrow both direct database grants/policies and API responses. API filtering alone would leave direct database reads available.

Done when: real authenticated client tests prove internal staff information and configuration are either intentionally available or denied.

### 3. Make status changes and retries safe — high

`api/updateQuoteStatus.js:37` checks an earlier read of the status, then updates by quote/company ID without checking that the status is still unchanged. Concurrent requests can overwrite an intervening transition. No live trigger enforcing the transition state machine was present in the trigger inventory.

Action: use a conditional update against the expected old status/version and return a conflict if it changed, or put the transition in a transaction-backed database function. Test two competing changes.

`api/sendQuoteEmail.js:77` uses `Date.now()` in its idempotency key. A retry creates a different key, allowing the same logical send to happen again. The email is sent before the audit-event insert; an event failure is logged while the request still returns success. Quote creation likewise has no durable request-id deduplication in the inspected handler.

Action: persist a request/operation identifier and reuse it across retries. For email, record a durable delivery job and delivery state so a successful send and failed audit write can be recovered safely.

Done when: concurrent transitions preserve the state machine, retried saves create one quote, and retried email operations send once with a recoverable delivery record.

### 4. Add real database and browser acceptance tests — high

`test/rlsPolicyStaticAnalysis.test.js` parses SQL strings. `test/fullQuoteWorkflow.test.js` uses mocked authentication and an in-memory database. These are useful tests, but do not execute PostgreSQL policies, replay migrations against PostgreSQL, or exercise a real browser sign-in.

Action: add a disposable Supabase/Postgres CI environment, migration replay, and manager/dispatcher/client tests spanning two companies. Test both direct database and API access, including storage. Add a small browser suite for sign-in, quote creation, reopening a quote, saving settings, and downloading a PDF.

Done when: the checks fail on a missing migration, a cross-company access regression, or a broken browser/API boundary. Retain the existing fast suites.

### 5. Fix local PDF response behavior — medium

The custom Vite API adapter at `vite.config.js:65` changes `send()` responses to `text/plain` and converts their contents with `String(payload)`. `api/sendQuoteEmail.js` returns PDF bytes through this method. Local development therefore does not faithfully serve the production PDF response.

Action: preserve explicit content types and binary bytes in the adapter, and test the actual HTTP download. A standard development runtime may reduce adapter maintenance, but is not required to fix this.

### 6. Search must cover the full quote history — medium

`api/ops.js:52` loads at most the newest 1,000 company quotes and then searches them in JavaScript. Once a company exceeds that limit, older quotes can be omitted even if they match. Pagination only paginates the truncated matches.

Action: filter and paginate in the database with appropriate indexes, preserve company/client authorization, and move quote search out of the operational-health endpoint.

Done when: a matching quote older than the first 1,000 records is returned correctly.

### 7. Give configuration one canonical representation — medium

`api/appConfig.js` writes legacy flat columns, structured JSON columns, and a whole-config JSON copy. `api/appConfig.js` and `api/createQuote.js` contain separate merging logic; a database pricing synchronization trigger adds another layer.

Action: choose one schema-versioned canonical configuration. Isolate compatibility conversion in one adapter and retire duplicate representations only after migration and parity checks. Preserve quote-time pricing snapshots so historical quotes remain explainable.

### 8. Reduce maintenance concentration and tighten contracts — medium

`src/App.jsx` is 723 lines; `src/components/Settings.jsx` is 966 lines. They combine substantial orchestration and UI state. Server modules also import shared business code from under `src/`, which makes ownership less obvious.

Action: gradually group code by feature and put shared business rules/contracts in an explicit shared directory. Extract auth/session, settings persistence, and quote orchestration as cohesive units. Introduce generated database types and typed request/configuration contracts first; avoid a bulk conversion with no behavioral benefit.

Suggested eventual layout: `src/features/{auth,quotes,settings,clients}`, `src/components/ui`, `shared/{pricing,config,contracts}`, `api`, `supabase/{migrations,functions,tests}`, `test/{unit,integration,e2e}`, `marketing`, and `docs`. Move files only when it improves an actual change. Keeping marketing as a separate application is reasonable.

### 9. Address measured payload size — medium

The application build reports a 630.88 kB main JavaScript chunk (176.35 kB gzip), and a 1,641.79 kB route-state chunk (1,134.33 kB gzip). PWA precache totals about 2.3 MiB. Route-state code is split into its own chunk already; code splitting alone does not remove its transfer/storage cost, particularly when precached.

Action: measure real mobile performance, evaluate server-side route-state work or reduced-resolution geometry against boundary correctness, and explicitly decide which resources need offline precaching. Preserve geometry parity tests.

### 10. Complete targeted Supabase hardening — medium/low

- `update_my_default_base(text)` is anonymously executable as a security-definer function. Its body rejects a null authenticated user, so the reviewed definition does not demonstrate an anonymous write exploit. Revoke unnecessary anonymous/public execution and retain the intended authenticated behavior. [Advisor guidance](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable).
- Auth leaked-password protection is disabled. Enable it if supported by the project plan. [Guidance](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).
- The authenticated security-definer notices need function-by-function review. The reviewed invite function validates identity, invitation email, expiry, and token state; do not remove permissions indiscriminately and break onboarding. [Advisor guidance](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable).
- The no-policy notices on `equipment_specs` and `state_transport_limits` are consistent with intentional server-only access. Do not add broad policies just to silence a notice. [Advisor guidance](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy).
- `quote_logs_company_created_at_idx` and `quote_logs_company_created_idx` are duplicate indexes. Review dependencies and retain one. [Advisor guidance](https://supabase.com/docs/guides/database/database-linter?lint=0009_duplicate_index).
- `quote_events.actor_id` lacks a covering foreign-key index. Evaluate/add it based on workload. [Advisor guidance](https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys).
- Eight indexes are reported unused. Limited usage is not sufficient reason to delete indexes supporting tenant queries. [Advisor guidance](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index).

### 11. Make the repository easy to hand over — low, worthwhile

- Stop tracking generated `.vite/deps` cache files; add the cache directory to ignore rules.
- Archive or label `supabase/supabase-current.sql` as a historical snapshot. Its own header says it is not executable; its name suggests more authority than it has.
- Consolidate source brand assets and intentionally retained example PDFs. Remove unused starter artwork only after checking references.
- Add a root runtime version constraint/file, a concise architecture map, and a fresh-clone setup checklist including dependency installation.
- Record which marketing build/deployment route is authoritative: the package contains Next.js plus Vite/vinext/Cloudflare tooling. Verify hosting requirements before removing any of it.
- Centralize API error responses; the config endpoints still return raw database messages on some failure paths.
- Turn recovery and environment-separation documentation into verified practices: demonstrate a restore in non-production, test alert delivery, and confirm preview deployments cannot write production data.

## Recommended sequence

1. **Establish reproducibility:** reconcile migrations, add clean database replay, verify environment isolation, and decide client read permissions.
2. **Protect the core workflow:** conditional status writes, durable retry handling, correct local PDF responses, and database/browser acceptance tests.
3. **Reduce everyday complexity:** canonical config, typed boundaries, cohesive feature modules, complete-history search, and measured payload improvements.
4. **Polish the handover:** repository housekeeping, deployment documentation, backup/alert drills, then a separate visual/accessibility review of the actual user flows.

Professional readiness means another engineer can clone it, understand where rules live, reproduce its database, run meaningful checks, deploy predictably, and recover a failure. Those are achievable improvements to this codebase.
