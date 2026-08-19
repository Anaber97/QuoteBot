# TowCalc Pro

TowCalc Pro is a React/Vite quoting application for towing and equipment transport teams. It supports company-specific pricing, geofences, client accounts, quote history, invitations, and authenticated Supabase-backed configuration.

## Local development

1. Copy `.env.example` to `.env` and fill in the required values.
2. Set `SITE_URL` to the application origin used in invitation links.
3. Run `npm run dev`.

Use server-only names for secrets: `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`, and `GOOGLE_MAPS_API_KEY`. Never reference those values from code under `src/`. The server Maps key must have the Routes API enabled and should be restricted to the Routes API and the production server environment. `VITE_GOOGLE_MAPS_API_KEY` remains the browser-restricted key used for autocomplete and map display.

Quote submission is server-authoritative. Apply `20260818154500_server_authoritative_quotes.sql` before deploying the matching application build; it removes direct browser quote inserts and limits browser quote updates to BOL metadata.

## Quality checks

- `npm test` runs the focused security tests.
- `npm run lint` checks the source.
- `npm run build` creates the production bundle.
- `npm audit --omit=dev` checks production dependencies.

The same commands run automatically for every pull request through `.github/workflows/quality.yml`. Pull requests should not be merged while any quality check is failing.

## Operational endpoints

- `GET /api/health` checks that the application can reach its database. It returns no customer data.
- `GET /api/syntheticQuote` runs a deterministic quote calculation and requires `Authorization: Bearer <SYNTHETIC_CHECK_TOKEN>`.

Runtime errors are emitted as structured, privacy-scrubbed JSON in Vercel logs. If `ERROR_WEBHOOK_URL` is set, server errors are also forwarded to that monitoring destination without quote inputs, names, addresses, phone numbers, or email addresses.

## Database changes

Supabase schema changes live in `supabase/migrations`. Apply all migrations before deploying application code that depends on them. The tenant-security migration enables RLS, installs tenant-scoped policies, and restricts the invite-acceptance function.

Deployment security, migration, backup, recovery, quota, and key-rotation procedures are documented in `SECURITY_OPERATIONS.md`. Use `.env.example` as the authoritative environment-variable inventory.

The quote formula, surcharge order, status lifecycle, permissions, deployment checklist, and rollback steps are documented in `docs/OPERATIONS.md`.
