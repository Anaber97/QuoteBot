# Equipment search rollout

Search checks private saved equipment and the existing Supabase catalog before web research. Client private equipment is scoped to the authenticated company and client ID; staff private equipment is company-owned. Scope comes from the server session, never form input. Private results are not cached across users or written into `equipment_specs`.

- HIGH: new web results require the recognized manufacturer's grounded source to cover operating weight, width and height, and are automatically saved to the existing catalog. Existing shared catalog records without usable source evidence are trusted HIGH, as requested; available matching source evidence is re-evaluated.
- MEDIUM: two different source domains agree within 5% on all three fields, calculated against the higher value. Uses the higher value for each field.
- LOW: uncorroborated or conflicting web evidence, or manually saved private specs. Confirmation is required before autofill.

Failed lookups offer a Google search link and manual entry. Save to my equipment stores make, model, optional serial number, operating weight in pounds, and dimensions in inches in `saved_equipment`. Re-saving the same identity in the same scope updates it without creating duplicates. It does not claim manufacturer verification.

## Deployment settings

Set the server-only `GOOGLE_GEMINI_API_KEY` to the working paid TowCalc Pro project key. The local key was corrected during verification; deployment configuration must use that key too. Never prefix it with `VITE_`.

`GEMINI_MODEL` defaults to `gemini-3.5-flash-lite`, using the Interactions API with Google Search and a JSON schema. `GEMINI_DAILY_CAP` defaults to 20, is clamped to 20, and can be set to 0 to disable web research. This is a lookup cap, not a dollar cap: each generation can issue multiple search queries. There are no automatic paid retries. The Google project already had a $5 monthly spend cap; it was left unchanged.

Migration `20261001191851_private_saved_equipment.sql` was applied to the TowCalc Pro database. It enables RLS and denies direct browser/anonymous access; authenticated server routes enforce ownership. No new frontend database permissions are required.

## Verification

Server tests cover source trust, confidence, five-percent boundaries, database-first behavior, HIGH-only persistence, quota/save failures, and private ownership. Component tests cover HIGH/MEDIUM autofill, LOW confirmation, Google fallback, and manual saving. `supabase/tests/private_saved_equipment.sql` verifies update deduplication and company/client separation in a rolled-back transaction.

Local live research returned LOW for Volvo L90H and HIGH for Caterpillar 320 from Cat's official page. Successful test requests do not guarantee that every model has discoverable complete specifications; manual entry remains available.
