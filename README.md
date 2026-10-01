# TowCalc Pro

TowCalc Pro is a React/Vite quoting application for towing and equipment transport teams. It supports company-specific pricing, geofences, client accounts, quote history, invitations, and authenticated Supabase-backed configuration.

The repository also contains the standalone TowCalc marketing site under `marketing/`. The two projects intentionally remain separate so the calculator can run as a PWA at `app.towcalc.com` while the marketing site remains a standard website at `towcalc.com`.

## Local development

1. Use Node 22 (see `.nvmrc`) and install dependencies with `npm ci`.
2. Copy `.env.example` to `.env` and fill in the required values. Set `SITE_URL` to the application origin used in invitation links.
3. Run `npm run dev`. Both the browser app and local API handlers use this server.

To work on the marketing site, install its dependencies once with `npm --prefix marketing install`, then run `npm run marketing:dev` from the repository root.

Use server-only names for secrets: `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`, and `GOOGLE_MAPS_API_KEY`. Never reference those values from code under `src/`. The server Maps key must have the Routes API enabled and should be restricted to the Routes API and the production server environment. `VITE_GOOGLE_MAPS_API_KEY` remains the browser-restricted key used for autocomplete and map display.

Quote submission is server-authoritative. Apply `20260818154500_server_authoritative_quotes.sql` before deploying the matching application build; it removes direct browser quote inserts and limits browser quote updates to BOL metadata.

## Quality checks

- `npm test` runs the Node.js test suite (`test/*.test.js`): pricing-engine parity between the browser and server calculators, config-schema normalization and validation, the quote-status transition state machine, an API authorization matrix (tenant/role isolation across `createQuote`, `updateQuoteStatus`, `inviteUser`, `appConfig`, and `sendQuoteEmail`), invite lifecycle handling (expiry, reuse, email mismatch), a static replay of every Supabase migration to verify effective RLS policies (including BOL storage tenant isolation), and a full sign-in → calculate → save → reopen → change-status workflow test.
- `npm run test:components` runs React component tests (`test/components/*.test.jsx`) covering Settings unsaved-change/save-error behavior and App-level auth identity changes / failed profile loads.
- `npm run test:all` runs both suites — this is what CI runs.
- `npm run lint` checks the source.
- `npm run build` creates the production bundle.
- `npm run marketing:build` creates the standalone marketing-site bundle.
- `npm audit --omit=dev` checks production dependencies.

With Docker running, use `npx --no-install supabase start` to replay migrations in a disposable local database, then `npx --no-install supabase test db --local`. The database workflow runs these checks separately in CI. `supabase/tests/database/tenant_access.test.sql` verifies real role/tenant isolation and search beyond 1,000 records. The Node suite also retains fast static migration checks. Never use a destructive reset against the hosted project.

The same commands run automatically for every pull request through `.github/workflows/quality.yml`. Pull requests should not be merged while any quality check is failing.

## Operational endpoints

- `GET /api/ops` checks that the application can reach its database. It returns no customer data.
- `GET /api/ops?check=synthetic` runs a deterministic quote calculation and requires `Authorization: Bearer <SYNTHETIC_CHECK_TOKEN>`.

Runtime errors are emitted as structured, privacy-scrubbed JSON in Vercel logs. If `ERROR_WEBHOOK_URL` is set, server errors are also forwarded to that monitoring destination without quote inputs, names, addresses, phone numbers, or email addresses.

## Database changes

Supabase schema changes live in `supabase/migrations`. Apply all migrations before deploying application code that depends on them. The tenant-security migration enables RLS, installs tenant-scoped policies, and restricts the invite-acceptance function.

Deployment security, migration, backup, recovery, quota, and key-rotation procedures are documented in `SECURITY_OPERATIONS.md`. Use `.env.example` as the authoritative environment-variable inventory.

The quote formula, surcharge order, status lifecycle, permissions, deployment checklist, and rollback steps are documented in `docs/OPERATIONS.md`.

The current component boundaries, retry guarantees, and September 2026 cleanup verification are documented in `docs/ENGINEERING_HANDOFF.md`. `docs/archive/schema-historical.sql` is historical reference only; migrations are the schema source of truth.
