# TowCalc Pro

TowCalc Pro is a React/Vite quoting application for towing and equipment transport teams. It supports company-specific pricing, geofences, client accounts, quote history, invitations, and authenticated Supabase-backed configuration.

## Local development

1. Copy the required values into `.env`.
2. Set `SITE_URL` to the application origin used in invitation links.
3. Run `npm run dev`.

Use server-only names for secrets: `SUPABASE_SERVICE_ROLE_KEY` and `GEMINI_API_KEY`. Never reference those values from code under `src/`.

## Quality checks

- `npm test` runs the focused security tests.
- `npm run lint` checks the source.
- `npm run build` creates the production bundle.
- `npm audit --omit=dev` checks production dependencies.

## Database changes

Supabase schema changes live in `supabase/migrations`. Apply all migrations before deploying application code that depends on them. The tenant-security migration enables RLS, installs tenant-scoped policies, and restricts the invite-acceptance function.
