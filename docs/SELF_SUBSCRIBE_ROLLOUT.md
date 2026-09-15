# Self-subscribe and tier enforcement rollout

The billing foundation is intentionally dark. No checkout, webhook, or feature restriction is live yet.

## Current safety state

- `company_subscriptions` is provider-neutral and server-managed.
- Authenticated company members may read their own company's status; browser clients cannot insert, update, or delete it.
- `resolveEntitlements()` returns **Legacy access** with every feature and unlimited usage while enforcement is disabled.
- Provider IDs may be stored, but secrets and payment details must never be stored in the table.

## Planned activation sequence

1. Confirm the product catalog, prices, trial/grace-period policy, and grandfathering rules.
2. Add server-only checkout and billing-portal endpoints behind a separate availability flag.
3. Add an idempotent, signature-verified provider webhook that is the only writer of paid status.
4. Load entitlements on the server and enforce them at every privileged API boundary.
5. Add read-only plan UI and upgrade prompts; keep checkout unavailable in production.
6. Add the tenant-scoped support ticket system described below, with server-derived service levels.
7. Test upgrades, downgrades, cancellation, delinquency, replayed webhooks, ticket isolation, and tenant isolation.
8. Backfill explicit plans for existing companies, then enable enforcement in a staging environment.
9. Enable production checkout and enforcement separately, with monitoring and an immediate kill switch.

## Initial tier matrix

| Capability | Core | Business | Enterprise |
| --- | --- | --- | --- |
| Quote calculator, history, PDF/email | Yes | Yes | Yes |
| Equipment Calculator | No | Yes | Yes |
| Private Client Quote Portals | No | Yes | Yes |
| Geofenced service areas | No | Yes | Yes |
| Custom branding | No | No | Yes |
| Submit and track support tickets | Yes | Yes | Yes |
| Priority support queue | No | No | Yes |
| Operating locations | 1 | 5 | Tailored/unlimited |
| Team members | 3 | 12 | Tailored/unlimited |

The catalog is centralized in `src/lib/entitlements.js`. Marketing copy and enforcement should consume the same catalog before launch so they cannot drift.

## Support ticket system

Every subscribed company can create and track support tickets. Enterprise companies receive priority support; Core and Business use the standard queue.

The planned data model includes:

- A tenant-scoped ticket with requester, subject, category, customer-visible status, timestamps, and optional related quote ID.
- A ticket conversation containing public customer replies and separately protected internal notes.
- An attachment store with file-size/type limits and company-scoped access policies.
- An append-only status and assignment history for accountability and reporting.
- A service level snapshot set by trusted server code when the ticket is created.

The browser must never choose `priority`, queue rank, assignee, or internal status. The server derives the service level from current entitlements, and support staff permissions remain separate from customer roles. A later plan change must not silently rewrite historical response-time reporting; escalation rules can promote an open ticket explicitly and leave an audit entry.

Before activation, define operating policy for response targets, support hours and holidays, severity levels, abuse/spam controls, attachment retention, notification delivery, reopening, and what happens to open tickets after cancellation or downgrade. Priority support should be described as queue/service-level priority unless a contractual response-time guarantee is deliberately approved.
