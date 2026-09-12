# TowCalc Pro OSOW integration

Implemented September 12, 2026. Supabase project: `ofolfmkhagsjwkgjewof` (TowCalc Pro).

## Database and import

- Imported 50 distinct state rows from `OSOW Data sep26.xlsx`, sheet `OSOW Limits`, into the existing `public.state_transport_limits` table by `state_code`.
- Preserved the existing `US` national baseline. Total: 51 rows.
- Compared every imported field against the workbook: 50 rows compared, zero mismatches. Source blank `updated_at` cells use the database timestamp. Source notes, URLs, retrieval dates, and null escort thresholds are preserved.
- Applied migration `20260912201804_integrate_osow_state_limits.sql`. It reproduces the table and import on a fresh database, keeps RLS enabled, and adds nullable JSON configuration fields without new public access policies.
- Both existing company configurations now have `client_portal.osow_pricing`: `enabled: false`, `generalPermit: null`, `oneEscort: null`, `twoEscort: null`.
- All nine existing company weight tiers have nullable `averageClearanceIn` and `averageVehicleWeightLbs`. Existing rates, bounds, order, and other tier fields are preserved. No client-specific rate records were modified.

## Calculator behavior

When state-specific OSOW rules are enabled in Settings → Pricing:

1. Evaluate only the loaded customer route, excluding base-to-pickup and dropoff-to-base travel.
2. Intersect route segments with Census state polygons. This detects intervening states, including those containing neither endpoint. Charge each affected state once even if the route re-enters it.
3. Calculate loaded height as equipment height plus Average Clearance, in inches. Calculate GVW as equipment weight plus attachment weight plus Average Vehicle Weight, in pounds. The user confirmed that the two averages mean deck height and empty truck/trailer weight respectively.
4. Flag width, loaded height, and GVW strictly above the supplied legal limits. Escort thresholds trigger at equality or above; the highest matching requirement wins. Indiana's explicit workbook note about GVW above 200,000 pounds also triggers two escorts.
5. Charge General OSOW once per affected state. A blank general price falls back to the existing weight-tier permit price, then existing base permit price or $150. Charge the highest escort tier once per trip. The two-escort amount is the combined charge for both escorts; it does not add the one-escort amount.
6. Share OSOW logic between browser estimates and authoritative server calculations. Use company vehicle averages even when a client has custom rate tiers. Persist state results, source references, dimensions, GVW, fees, escort count, and review reasons in `quote_details.osow`.

Missing measurements, missing state coverage, unspecified escort thresholds, missing escort prices, and relevant source notes produce review flags. Authoritative quotes with these flags require approval. A failed limits lookup returns an error instead of silently pricing from an empty dataset. Explicitly entered zero prices remain zero.

Existing general calculator behavior and the legacy permit/escort path remain in place while the new setting is disabled. Existing flat-rate and maximum-price zone override semantics are retained; OSOW permit and escort charges are passed together through the existing fee calculation so flat-rate overrides do not silently omit escorts.

## Files

- `src/lib/osow.js`: shared rule evaluation and fee calculation.
- `src/lib/routeStates.js`, `src/data/stateBoundaries.js`: segment/state intersection and encoded boundaries, loaded on demand in the browser.
- `api/ops.js`, `src/services/osowLimits.js`: authenticated access to the reference table through the server; no browser service-role key.
- `api/createQuote.js`, `api/_quoteEngine.js`: live rule loading, authoritative calculation, saved detail and approval flags.
- `src/services/quoteCalculator.js`, `src/App.jsx`: routed browser estimates and permit metadata.
- `src/components/Settings/PricingTab.jsx`: General OSOW / 1 Escort / 2 Escorts pricing, enable switch, and per-weight-class vehicle averages.
- `src/lib/configSchema.js`, `src/lib/configValidation/clientPortal.js`, `src/lib/configValidation/sanitize.js`: normalization, validation, and persistence.
- `src/components/ClientQuoteForm.jsx`, `src/components/QuoteResultsCard.jsx`: defer state pricing until routing and show OSOW results/review reasons without double-counting permits.
- Migration and tests are included alongside the application changes.

## Assumptions and limits

- Prices are company charges, not verified state permit fees. No prices or vehicle averages were invented. Enter the averages and escort prices, then enable the state-specific setting and save.
- Blank escort thresholds mean unspecified, not unlimited or no escort needed. Notes that mention police escorts, utility lifting, bucket trucks, ambiguous triggers, or special routing remain review reasons rather than being converted to ordinary pilot-car charges.
- The workbook covers width, height, GVW and selected escort rules. It does not supply a complete axle, length, overhang, bridge, time-of-day, road-class or special-permit ruleset. These require separate confirmation. The imported regulations were not independently re-verified with each state.
- State boundaries are generalized US Census 2023 cartographic boundaries at 1:500,000, retained to six decimal places and delta encoded. They support pricing screening, not legal routing or bridge-clearance certification. Near-border routes require confirmation. DC and territories have geometry but no workbook rules and therefore require review.
- Boundary source: https://www2.census.gov/geo/tiger/GENZ2023/shp/cb_2023_us_state_500k.zip
- New OSOW charging is off in both company configurations to preserve existing quotes until configuration is complete. The implementation is in the local checkout; no app deployment was performed.

## Verification

- 188 Node unit tests passed, including threshold equality, null handling, explicit zero pricing, per-state deduplication, Indiana GVW exception, intervening-state geometry, normalization and company/client separation.
- 34 component tests passed, including the actual browser/server public calculation paths with OSOW fees and weight-tier rounding, and editing the new pricing controls.
- Lint and production/PWA builds passed. Vite reports a size warning for the on-demand boundary chunk; the build succeeds.
- Live import verification: 50 compared, zero mismatches; 51 total table rows; nine tiers with both new fields; two company configurations retain disabled new pricing.
- Supabase security advisors showed pre-existing warnings for callable security-definer functions and disabled leaked-password protection. Reference tables have RLS without policies and are intentionally read through server code. No new public policies or privileged functions were introduced.

Advisor references: https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable and https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection
