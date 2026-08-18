# TowCalc Pro

TowCalc Pro is a React/Vite quoting application for towing and equipment transport teams. It supports company-specific pricing, geofences, client accounts, quote history, invitations, and authenticated Supabase-backed configuration.

## Local development

1. Copy the required values into `.env`.
2. Set `SITE_URL` to the application origin used in invitation links.
3. Run `npm run dev`.

Use server-only names for secrets: `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`, and `GOOGLE_MAPS_API_KEY`. Never reference those values from code under `src/`. The server Maps key must have the Routes API enabled and should be restricted to the Routes API and the production server environment. `VITE_GOOGLE_MAPS_API_KEY` remains the browser-restricted key used for autocomplete and map display.

Quote submission is server-authoritative. Apply `20260818154500_server_authoritative_quotes.sql` before deploying the matching application build; it removes direct browser quote inserts and limits browser quote updates to BOL metadata.

## Quality checks

- `npm test` runs the focused security tests.
- `npm run lint` checks the source.
- `npm run build` creates the production bundle.
- `npm audit --omit=dev` checks production dependencies.

## Database changes

Supabase schema changes live in `supabase/migrations`. Apply all migrations before deploying application code that depends on them. The tenant-security migration enables RLS, installs tenant-scoped policies, and restricts the invite-acceptance function.

Deployment security, migration, backup, recovery, quota, and key-rotation procedures are documented in `SECURITY_OPERATIONS.md`. Use `.env.example` as the authoritative environment-variable inventory.
