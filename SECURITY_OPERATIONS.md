# Security and operations

## Environment separation

Public browser configuration uses only `VITE_GOOGLE_MAPS_API_KEY`, `VITE_SUPABASE_URL`, and `VITE_SUPABASE_ANON_KEY`. Server secrets are `GOOGLE_MAPS_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and `GEMINI_API_KEY` and must never use a `VITE_` prefix.

Production must use the production Supabase project and production-restricted Google keys. Preview should use a separate Supabase project or branch and separate provider keys. Development uses local `.env` values. Never expose production service-role credentials to Preview or Development.

## Migrations

1. Review SQL and take a database backup before destructive or data-transforming migrations.
2. Apply migrations to a Supabase development branch or disposable project first.
3. Run application tests, then Supabase security and performance advisors.
4. Apply to production before deploying application code that depends on the schema.
5. Verify grants, RLS policies, constraints, and the affected workflow after deployment.

The baseline migration creates a blank project schema. All subsequent migrations must remain ordered and idempotent where practical.

## Backup and recovery

Supabase Pro provides daily backups. Before a high-risk release, verify the latest backup in the dashboard and record its timestamp. For additional protection, schedule a logical export of schema and essential data to encrypted storage outside the primary project. Test restoration into a non-production project at least quarterly. Never test recovery by overwriting production.

## Spend and quota controls

- Google Cloud: restrict browser and server Maps keys separately, enable only required APIs, set Routes API quotas, and create budget notifications at 50%, 80%, and 100% of the monthly budget.
- Gemini: use only the server key, retain the database-backed per-user limit, configure project-level API quotas, and create the same budget thresholds in Google Cloud Billing.
- Vercel: enable Spend Management notifications and a hard usage limit appropriate to the launch budget; scope secrets independently to Production, Preview, and Development.
- Supabase: enable organization spend notifications, database/storage usage alerts, and review compute size before enabling automatic scaling.

## Key rotation

Create the replacement credential first, update Development/Preview, verify, then update Production and redeploy. Revoke the old credential only after production verification. Rotate Supabase service-role and Gemini keys immediately if either has ever been exposed in a browser bundle, source control, logs, or screenshots.
