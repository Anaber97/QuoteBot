# TowCalc Pro engineering operations

## Quote formula

The authoritative formula runs in `api/_quoteEngine.js`; the browser never supplies saved totals.

1. Google Routes returns the complete base → stops → base route once.
2. Drive minutes are multiplied by the selected company, truck-class, weight-tier, or client buffer.
3. Load/unload minutes and configured minutes for each stop after pickup/dropoff are added.
4. Hours are multiplied by the applicable hourly rate or rate range.
5. Enabled percentage surcharges are compounded. Enabled flat surcharges are then added.
6. A qualifying custom-zone flat rate replaces the calculated transport subtotal.
7. The result is rounded to the configured interval.
8. Oversize/overweight permit fees are added after rounding; interstate permit fees use the configured 1.5 multiplier.

Tests lock down weight boundaries, extra stops, flat and percentage charges, metro/hazard routes, permits, attachment weight, rounding, custom client pricing, and the one-request routing rule.

## Roles and permissions

| Capability | Manager | Dispatcher | Client |
|---|---:|---:|---:|
| View company quotes | Yes | Yes | Own client account only |
| Create dispatcher quotes | Yes | Yes | No |
| Create client-portal quotes | No | No | Own client account only |
| Manage company configuration and users | Yes | No | No |
| Attach/request dispatch for client quotes | Yes | Yes | Own client account only |

Database RLS is the final enforcement layer. API handlers repeat important ownership checks as defense in depth. Authorization must use `profiles.role` and `profiles.client_id`, never editable user metadata.

## Quote lifecycle and auditability

Supported statuses are `draft`, `submitted`, `approval_required`, `approved`, `dispatched`, `completed`, and `cancelled`. The professionalization migration adds a human-readable `Q-YYYY-NNNNNN` reference and append-only `quote_events` records for creation and status changes. UI timestamps use the database `created_at` value.

## Google APIs

- Browser key: enable Maps JavaScript and Places APIs; restrict by the exact production and preview HTTP referrers.
- Server key: enable Routes API only; restrict to that API and the deployment environment where supported.
- Never put the server key in a `VITE_` variable.
- Configure daily request quotas plus billing alerts at 50%, 80%, and 100% of budget.

## Deployment

1. Create a preview branch and draft pull request.
2. Apply new migrations to a non-production Supabase project or branch first.
3. Run `npm test`, `npm run lint`, `npm run build`, and `npm audit --omit=dev`.
4. Test dispatcher and client quote flows in the Vercel Preview.
5. Confirm `/api/health`, the protected synthetic check, email, Maps, Gemini, storage uploads, and database writes.
6. Review Supabase security/performance advisors and Vercel runtime errors.
7. Merge only after the preview and checks pass. Apply schema migrations before application code that requires them.

## Rollback and disaster recovery

- Application rollback: use Vercel Deployments to promote the last known-good production deployment. Do not rewrite Git history.
- Database rollback: prefer a forward corrective migration. Restore a backup only for destructive corruption and only after preserving the failed database for investigation.
- Provider incident: disable the affected feature, preserve core quote history, and use the structured provider field in runtime logs to identify Maps, Gemini, email, storage, or database failures.
- Quarterly: restore the latest backup into a non-production project and run the full verification suite.

## Alerts

Monitor `/api/health` publicly and `/api/syntheticQuote` with its bearer token. Route structured Vercel errors to the configured monitoring webhook and alert on `provider` values for `email`, `gemini`, `maps`, `storage`, and `database`. Provider billing/quota alerts remain configured in their own dashboards because application code cannot enforce account-level spend caps.
