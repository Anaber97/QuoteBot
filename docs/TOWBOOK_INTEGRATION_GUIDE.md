# TowCalc ↔ Towbook Integration Guide

Prepared for September 2, 2026.

## Recommendation

Ask Towbook for an approved, server-to-server integration first. Design one TowCalc integration service that supports:

1. **Export:** create a new Towbook call from a saved TowCalc quote.
2. **Import:** enter a Towbook call number in TowCalc and prefill a quote.
3. **Later companion extension:** show TowCalc beside Towbook for a faster dispatcher workflow, using the same approved API—not page scraping.

Build both directions in phases. Start with export because it eliminates the most expensive double entry and is easier to validate. Add import after Towbook confirms call lookup/search semantics.

No public, self-service Towbook developer documentation or API-key portal was found as of September 1, 2026. Towbook does advertise multiple integrations and digital dispatch capabilities, so private/partner integrations clearly exist. Treat endpoint details, commercial terms, and access as questions for Towbook rather than assumptions.

## Tomorrow's objective

Get the request into Towbook's integration/product team with enough detail for a useful yes/no response and a technical handoff.

Contact Towbook Support at [support@towbook.com](mailto:support@towbook.com) or (810) 320-5063. Their official support page says support is available 24/7. Ask that the request be routed to **API partnerships/integrations or product engineering**.

## Email to send

**Subject:** API / integration access request — TowCalc quote-to-call workflow

Hello Towbook team,

I operate TowCalc (https://towcalc.com), a quoting application for towing and equipment-transport companies. I would like to build an approved integration for mutual Towbook customers that reduces duplicate data entry between quoting and dispatch.

The initial workflows are:

1. Export a saved TowCalc quote to Towbook as a new call.
2. Enter a Towbook call number in TowCalc and import the call details to create or update a quote.

The data involved would include customer/contact information, account, pickup and destination addresses, additional stops, vehicle/equipment details, service type, notes, mileage, quoted amount, and an external TowCalc quote ID/link. We would store the Towbook call ID on the TowCalc quote to prevent duplicate exports and support reconciliation.

Could you please route this to the team responsible for API partnerships or integrations and advise:

- whether Towbook offers a partner/private API for reading and creating calls;
- the authentication model and whether access is per Towbook company/account;
- sandbox or test-account availability;
- endpoints and schemas for call lookup by call number, call creation, and call updates;
- webhook support for call creation/status/update events;
- rate limits, idempotency support, pagination, and error conventions;
- required security review, partner agreement, branding rules, and commercial fees;
- whether a browser extension or embedded companion UI is permitted under Towbook's terms;
- the process for production approval and customer authorization/revocation.

We will keep Towbook credentials server-side, request the minimum scopes, encrypt stored tokens, maintain tenant isolation and audit logs, and will not automate or scrape the Towbook UI without written approval.

I would be happy to provide a field map, workflow demo, or technical contact details. Thank you.

## Questions for the call

Do not end the conversation with only “Do you have an API?” Capture answers to:

- Is this a public API, private customer API, or approved-partner program?
- Can a third-party SaaS serve multiple Towbook customer companies?
- OAuth authorization, per-company API token, or service credentials?
- Available scopes: calls read, calls write, accounts/customers read, rates read, attachments write?
- Can we retrieve a call by the human-facing call number, or only an internal ID?
- Can we create a draft/unassigned call rather than immediately dispatching it?
- Which fields are required to create a call?
- How are custom call requirements and equipment types represented?
- Can TowCalc attach a PDF/quote link and an external reference?
- Are create requests idempotent, or may retries create duplicates?
- Are webhooks available for call updates/status changes?
- Sandbox, sample payloads, OpenAPI/Postman collection, and test credentials?
- Rate limits, IP allowlisting, certification, fees, and support SLA?
- Data retention/deletion requirements and incident-notification terms?
- Is an API-powered Chrome/Edge extension explicitly allowed?

## Proposed product behavior

### Phase 1 — Export quote to Towbook

Add an **Export to Towbook** action only on saved quotes.

1. User reviews the final quote.
2. TowCalc validates required Towbook fields and shows a preview.
3. User confirms creation.
4. TowCalc's server sends the request with a unique idempotency key based on company and quote ID.
5. TowCalc stores Towbook's internal ID, call number, export time, exporting user, and a sanitized response summary.
6. The button changes to **Open in Towbook** / **Sync update**, preventing accidental duplicate calls.

Never silently create a second call after a timeout. Reconcile by idempotency key or external reference first.

### Phase 2 — Import Towbook call for quote

Add an **Import Towbook call** action:

1. User enters the displayed Towbook call number.
2. TowCalc's server queries Towbook within that customer's authorized company.
3. TowCalc shows a preview and highlights missing/ambiguous values.
4. User confirms; TowCalc prefills the quote but still runs TowCalc's own authoritative rate engine.
5. TowCalc stores the Towbook ID/call number as the source reference.

Import should not trust Towbook-supplied prices as TowCalc-calculated prices. Preserve source values separately and require the normal TowCalc save flow.

## Initial field map to validate with Towbook

| TowCalc | Desired Towbook call field | Direction |
| --- | --- | --- |
| Quote ID / `Q-...` reference | External reference or notes | Export |
| Customer name and phone | Requester/customer/contact | Both |
| Client account | Account/bill-to | Both |
| Pickup address | Pickup/service location | Both |
| Dropoff address | Destination | Both |
| Waypoints | Additional destinations/stops | Both |
| Equipment make/model/serial | Vehicle/equipment fields | Both |
| Weight and dimensions | Equipment/custom fields/notes | Both |
| Truck class/service type | Service/equipment type | Both |
| Permit flags/surcharges | Custom requirements/notes | Export |
| Final/custom quote | Quoted amount | Export |
| Towbook call number and ID | Integration metadata on quote | Import/result |

Do not hard-code this mapping until Towbook supplies schemas and required enumerations.

## Architecture and security

- Browser → authenticated TowCalc API → Towbook API. Never call Towbook directly from the browser.
- Store credentials/tokens encrypted and scoped by TowCalc company.
- Managers connect/disconnect Towbook; dispatchers may use the connection but cannot see credentials.
- Validate tenant ownership on every import/export.
- Use minimum scopes and redact tokens, customer data, addresses, and phone numbers from logs.
- Record an audit event for connect, disconnect, import, export, retry, failure, and link change.
- Add timeouts, bounded retries with jitter, and a circuit breaker; do not block quote creation if Towbook is unavailable.
- Persist external IDs and idempotency keys in dedicated integration records, not only free-text notes.
- Provide a disconnect flow that revokes the credential and stops synchronization.

## Browser-extension option

An extension can make the experience superb: a side panel or floating calculator could read the current approved Towbook call, calculate in TowCalc, and write the confirmed result back. It is not a substitute for API access.

### Good version

- Towbook explicitly permits it.
- The extension uses OAuth or another approved API method.
- It requests narrowly scoped permissions for Towbook domains only.
- It sends data through the same tenant-safe TowCalc integration service.
- A human confirms every write.

### Bad version

- Reads fields by scraping Towbook page HTML.
- Injects values by simulating clicks/typing.
- Stores Towbook usernames, passwords, cookies, or tokens in extension storage.
- Depends on private network requests observed in browser developer tools.

The bad version will break when Towbook changes its interface and may violate terms or expose customer data. Do not build it without written authorization.

## Decision tree

- **Towbook grants read/write API:** build Phase 1 export, then Phase 2 import; add an API-powered extension only if dispatchers need it.
- **Towbook grants write-only:** build export; use call number as the returned link; keep import manual.
- **Towbook grants read-only:** build call import/prefill; include a copy-ready dispatch summary for manual Towbook entry.
- **Towbook offers an intake email/parser:** generate a structured Towbook-compatible dispatch email as a near-term bridge.
- **Towbook declines access:** do not scrape. Build a copy/paste workflow, CSV/PDF export if supported, and gather customer demand for a renewed partner request.

## What not to build before Towbook replies

- Production endpoints guessed from browser traffic
- A schema based on screenshots
- Credential storage
- Background two-way sync
- UI automation against Towbook

What can be built safely now is the provider-neutral model: integration connection records, external call references, idempotent export jobs, audit events, and a field-mapping layer. Those pieces remain useful regardless of Towbook's exact API.

## Sensible delivery order

1. Obtain written access, documentation, and sandbox credentials.
2. Write the approved field map and data-handling agreement.
3. Implement company connection and token lifecycle.
4. Implement export in the sandbox with idempotency and audit logs.
5. Pilot with one internal company and reconcile every call manually.
6. Implement import by call number.
7. Add webhooks/status sync only when the basic workflows are stable.
8. Consider the extension as a convenience layer.

## Later: paid plans without panic

Keep entitlement checks separate from Towbook logic. A future plan might expose capabilities such as:

- Free/trial: core calculator and limited quote history
- Pro: teams, client portal, email workflows
- Integration add-on: Towbook connection, exports/imports, higher sync volume

Enforce entitlements on the server, not only by hiding buttons. Track usage events now (quotes saved, invites sent, exports, imports) without introducing billing yet. This creates evidence for pricing rather than forcing guesses.

## References

- [Towbook official support contact](https://towbook.com/support)
- [Towbook features and advertised integrations](https://towbook.com/features)
- [Towbook Help Center](https://intercom.help/towbook/en/)
- [Towbook pricing and plan features](https://towbook.com/pricing)

