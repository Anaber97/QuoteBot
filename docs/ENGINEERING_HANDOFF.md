# Engineering handoff — September 30, 2026

This records the implemented cleanup following `ENGINEERING_AUDIT_2026-09-30.md`. The audit is a historical snapshot, not a current list of unfixed defects.

## Structure and ownership

- `src/App.jsx` composes the calculator and workspace. `src/features/auth/useWorkspaceSession.js` owns identity changes and atomic workspace loading; stale responses cannot revive a signed-out workspace. Token refresh preserves unsaved input.
- `src/features/quotes/calculatorState.js` owns calculator state. `src/features/settings/buildSettingsPayload.js` owns settings serialization. Settings, history, and equipment screens are loaded on demand.
- Settings now composes focused draft/persistence, workspace-member, and geofence hooks plus immutable configuration edits under `src/features/settings/`. `QuoteSaveForm` owns contact/BOL submission controls, and `QuoteTripBreakdown` owns dispatcher detail rendering. The Settings component decreased from 862 to 267 lines; QuoteResultsCard decreased from 541 to 276 lines.
- Review components around 400–500 lines for mixed responsibilities; this is a review signal, not a maximum. Split by state ownership and behavior, preserve useful locality, and leave cohesive data catalogs intact.
- `shared/config/storage.js` reads legacy and structured database configuration consistently. `shared/config/clientPortal.js` explicitly limits client-visible configuration. Legacy writes remain compatible during this transition.
- `api/` authenticates requests, applies tenant/role rules and rate limits, and calculates authoritative prices. Client previews use the same server calculation as saved quotes. Company pricing stays off the client portal.
- `shared/database.generated.ts` records the hosted schema, with its types attached to the browser Supabase client. Regenerate after schema changes; this is not a full TypeScript conversion.
- `dev/apiRoutePlugin.js` adapts API handlers for local development. `dev/apiResponse.js` preserves PDF bytes and response headers.
- `supabase/migrations/` is the schema source of truth. The archived SQL snapshot is not a setup script. Generated Vite cache files are no longer tracked.

## Reliability guarantees and boundaries

Quote saves use a persisted browser operation ID and a database uniqueness constraint per actor. Retrying the same operation returns the original quote; reusing the key for different input returns a conflict. Legacy callers without a key do not receive this guarantee. A BOL upload retry can still leave an orphaned storage object if the subsequent metadata update fails; periodically review unattached objects before introducing automated cleanup.

Email requests persist their exact payload before contacting the provider. Retries reuse that payload and provider idempotency key. Completing delivery and recording its quote event happen in one database transaction. Sent payloads are cleared. Pending deliveries older than 23 hours require manual review because the provider's deduplication window is finite. There is no background delivery worker: the user retries the same browser operation. Never blindly resend an ambiguous delivery with a new key; inspect provider delivery history first.

Quote status changes compare the previously read status when updating. Concurrent changes return a conflict instead of silently overwriting each other. Quote search runs in Postgres under the signed-in user's RLS permissions, with bounded pagination and literal search terms; it no longer searches only the newest 1,000 rows.

## Database state

The development Supabase project has 19 migrations matching the local migration names/versions. The equipment migration filenames were reconciled with their already-applied remote versions. Branding and billing foundation migrations were applied, followed by `20260930151711_professional_reliability.sql`. Billing remains an inactive schema foundation; this work does not activate subscriptions or payments.

Client profile reads are self-only; company configuration reads are staff-only. Client quote and account policies remain scoped to the assigned client account. Email delivery and equipment/reference tables deliberately have RLS with no browser policies: only server access is intended. The anonymous grant on the profile helper was removed, a duplicate quote index removed, and the quote-event actor foreign key indexed.

The September 30 advisor check has no duplicate-index or missing-foreign-key-index findings. Unused-index notices are retained because development usage is insufficient evidence for deletion. Authenticated security-definer notices remain for the self-scoped profile, tenant, role, and invite helpers that require elevated execution. Do not change those to invoker indiscriminately; that can break RLS or onboarding.

## Verification and release

Metro surcharge follow-up: browser and server now share `shared/pricing/zoneCharge.js`. Per-zone overrides take precedence over company settings, followed by catalog defaults. Company flat rates and zero-valued overrides are respected; metro checkbox and result labels use the actual charge type. The updated suite passes 215 Node tests and 40 component tests.

- Application lint, production build, 213 Node tests, and 40 component tests pass. Coverage includes binary PDF delivery, concurrent status changes, client config filtering, authoritative client preview/save parity, duplicate-save prevention, email retries, dialog keyboard behavior, token refresh, and late sign-out responses.
- Thirteen pgTAP assertions passed against the hosted development database in a rolled-back transaction, including real tenant isolation, client access restrictions, and search past 1,000 records. No test rows remain; sequence gaps are harmless.
- Signed-in manager navigation and quote search were verified in the local browser. Desktop dark and mobile light layouts were inspected. No customer email was sent during verification.
- Production dependency audits found zero known vulnerabilities in both application and marketing dependencies at audit time. This is a point-in-time result, not a security certification.

Before public launch:

1. Run the new disposable-database CI workflow successfully. Docker was unavailable on this machine, so a complete empty-database replay has not yet been demonstrated here.
2. Deploy the matching application build with the applied database changes. The hosted application has not been deployed by this cleanup; older client builds cannot read the now-restricted internal configuration. Test a real client login and a complete calculate/save/PDF flow in the deployment environment.
3. Enable Supabase leaked-password protection if the project plan supports it: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection. It remained disabled in the final advisor check.
4. Verify email delivery with an explicitly designated test recipient, provider credentials, monitoring, and recovery procedures from `SECURITY_OPERATIONS.md`.

The build still warns about a large main chunk and the sizeable geofence asset. Settings splitting reduced initial JavaScript, but the geography dataset remains a deliberate performance follow-up. Google Maps legacy autocomplete warnings also remain; migrate with a dedicated compatibility test rather than swapping APIs during a security cleanup.
