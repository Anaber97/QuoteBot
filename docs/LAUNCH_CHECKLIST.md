# Fix and launch checklist

## Before launch

- [ ] Run the disposable Supabase CI workflow successfully to prove all migrations replay from an empty database. Local Docker was unavailable during cleanup.
- [ ] Deploy the matching application build, including the metro surcharge fix. Development database restrictions are already applied; older client builds may fail to load configuration.
- [ ] Verify manager, dispatcher, and client accounts in the deployed environment: login, calculate, save, reopen, change status, and download PDF. Confirm client accounts cannot access staff data or another client's quotes.
- [ ] Check one known metro route with flat pricing, one with percentage pricing, and one explicit zone override. Recalculate unsaved estimates created before the fix; retain existing saved quotes as historical records.
- [ ] Enable Supabase leaked-password protection if supported by the project plan.
- [ ] Send a quote to a designated test recipient and verify the PDF, sender identity, delivery record, and retry behavior. Review ambiguous pending deliveries before resending with a new operation ID.
- [ ] Confirm production environment variables, browser/server Maps restrictions, email configuration, monitoring destination, and spending alerts using SECURITY_OPERATIONS.md.
- [ ] Confirm backup and restore procedures, then perform the deployment smoke check before inviting customers.

## Follow-up improvements

- [ ] Automate deployed browser acceptance tests for the core quote workflow and all three roles.
- [ ] Reduce the geofence dataset and main JavaScript download; migrate legacy Google autocomplete with compatibility tests.
- [ ] Add a reviewed process for abandoned BOL uploads and stale pending email deliveries.
- [ ] Retire legacy duplicated configuration fields after migration and pricing-parity checks.

Completed: client access restrictions, migration-history reconciliation, quote/email retry protections, conditional status updates, full-history search, binary PDF responses, focused component decomposition, mobile/accessibility refinements, and company flat metro surcharge handling. Latest local verification: 255 automated tests, lint, and production build pass. No deployment or customer email was performed for this fix.
