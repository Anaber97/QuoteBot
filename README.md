# TowCalc Pro

TowCalc Pro is a React/Vite quoting application for towing and equipment transport teams. It supports company-specific pricing, geofences, client accounts, quote history, invitations, and authenticated Supabase-backed configuration.

The repository also contains the standalone TowCalc marketing site under `marketing/`. The two projects intentionally remain separate so the calculator can run as a PWA at `app.towcalc.com` while the marketing site remains a standard website at `towcalc.com`.

## Local development

1. Copy `.env.example` to `.env` and fill in the required values.
2. Set `SITE_URL` to the application origin used in invitation links.
3. Run `npm run dev`.

To work on the marketing site, install its dependencies once with `npm --prefix marketing install`, then run `npm run marketing:dev` from the repository root.

Use server-only names for secrets: `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`, and `GOOGLE_MAPS_API_KEY`. Never reference those values from code under `src/`. The server Maps key must have the Routes API enabled and should be restricted to the Routes API and the production server environment. `VITE_GOOGLE_MAPS_API_KEY` remains the browser-restricted key used for autocomplete and map display.

Quote submission is server-authoritative. Apply `20260818154500_server_authoritative_quotes.sql` before deploying the matching application build; it removes direct browser quote inserts and limits browser quote updates to BOL metadata.

## Quality checks

- `npm test` runs the Node.js test suite (`test/*.test.js`): pricing-engine parity between the browser and server calculators, config-schema normalization and validation, the quote-status transition state machine, an API authorization matrix (tenant/role isolation across `createQuote`, `updateQuoteStatus`, `inviteUser`, `getAppConfig`, `saveAppConfig`, `sendQuoteEmail`, `notifyApproval`), invite lifecycle handling (expiry, reuse, email mismatch), a static replay of every Supabase migration to verify effective RLS policies (including BOL storage tenant isolation), and a full sign-in → calculate → save → reopen → change-status workflow test.
- `npm run test:components` runs React component tests (`test/components/*.test.jsx`) covering Settings unsaved-change/save-error behavior and App-level auth identity changes / failed profile loads.
- `npm run test:all` runs both suites — this is what CI runs.
- `npm run lint` checks the source.
- `npm run build` creates the production bundle.
- `npm run marketing:build` creates the standalone marketing-site bundle.
- `npm audit --omit=dev` checks production dependencies.

There is no live Supabase/Docker instance available in CI or local dev by default, so RLS/migration coverage is a static analysis of the migration SQL rather than a live-database integration test; see `test/rlsPolicyStaticAnalysis.test.js`. If you have Docker available, `supabase start` plus the Supabase CLI can be used to run these migrations against a real local Postgres instance for deeper verification.

The same commands run automatically for every pull request through `.github/workflows/quality.yml`. Pull requests should not be merged while any quality check is failing.

## Operational endpoints

- `GET /api/ops` checks that the application can reach its database. It returns no customer data.
- `GET /api/ops?check=synthetic` runs a deterministic quote calculation and requires `Authorization: Bearer <SYNTHETIC_CHECK_TOKEN>`.

Runtime errors are emitted as structured, privacy-scrubbed JSON in Vercel logs. If `ERROR_WEBHOOK_URL` is set, server errors are also forwarded to that monitoring destination without quote inputs, names, addresses, phone numbers, or email addresses.

## Database changes

Supabase schema changes live in `supabase/migrations`. Apply all migrations before deploying application code that depends on them. The tenant-security migration enables RLS, installs tenant-scoped policies, and restricts the invite-acceptance function.

Deployment security, migration, backup, recovery, quota, and key-rotation procedures are documented in `SECURITY_OPERATIONS.md`. Use `.env.example` as the authoritative environment-variable inventory.

The quote formula, surcharge order, status lifecycle, permissions, deployment checklist, and rollback steps are documented in `docs/OPERATIONS.md`.
