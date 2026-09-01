# TowCalc Production Email Setup

Prepared for September 2, 2026.

## Outcome

After this checklist:

- TowCalc account invitations and password-reset messages are delivered from a TowCalc address.
- Quote shares, approval notices, and dispatch requests are delivered from a TowCalc address.
- SPF, DKIM, and DMARC protect deliverability.
- A real-user test proves both email paths work.

## Important: TowCalc has two email paths

| Message | Current code path | What must be configured |
| --- | --- | --- |
| Account invite | `api/inviteUser.js` → Supabase Auth | Custom SMTP in Supabase Auth |
| Password reset | Supabase Auth | Custom SMTP in Supabase Auth |
| Dispatch request | `api/sendQuoteEmail.js` → Supabase Edge Function | Deployed `send-quote-approval-email` function and email-provider secret |
| Approval notice | `api/_approvalEmail.js` → same Edge Function | Same function and secret |
| Quote share/BOL notice | `api/sendQuoteEmail.js` → same Edge Function | Same function and secret |

Configuring Supabase SMTP alone does **not** configure dispatch emails.

## Recommended setup

Use one transactional provider account—Resend is the simplest fit—with two sending identities:

- Auth: `TowCalc Accounts <accounts@auth.towcalc.com>`
- Operational: `TowCalc Dispatch <dispatch@notify.towcalc.com>`

Separate subdomains protect the reputation of critical login mail from operational volume. Do not use a personal Gmail mailbox as production infrastructure.

## Before touching dashboards

Have these available:

- DNS access for `towcalc.com`
- Access to the production Supabase project
- A Resend account (or equivalent transactional email provider)
- Test inboxes at Gmail and Outlook that are not members of the Supabase organization
- The deployed production URL: `https://towcalc.com`

Never put SMTP passwords or provider API keys in a `VITE_` environment variable, source control, screenshots, or browser code.

## Part 1 — Verify the sending domains

1. In the email provider, add `auth.towcalc.com` and `notify.towcalc.com` as sending domains.
2. Add the provider's exact SPF and DKIM DNS records at the DNS host.
3. Add a DMARC TXT record. A safe starting policy is monitoring mode:

   `v=DMARC1; p=none; rua=mailto:dmarc@towcalc.com; adkim=s; aspf=s`

4. Wait until the provider reports both domains as verified.
5. Once reports show legitimate mail is aligned, move gradually to `p=quarantine`, then `p=reject`.

Do not create a second SPF TXT record on an existing hostname; merge authorized senders into one SPF record. Disable provider click tracking for Auth emails because rewritten links can interfere with single-use authentication links.

## Part 2 — Configure Supabase Auth SMTP

In the production Supabase dashboard:

1. Open **Authentication → Emails → SMTP Settings** (the wording may appear as **Custom SMTP**).
2. Enable custom SMTP.
3. Copy the SMTP host, port, username, and password from the provider. Prefer TLS on port 587 unless the provider specifies otherwise.
4. Set sender name to `TowCalc Accounts`.
5. Set sender email to `accounts@auth.towcalc.com`.
6. Save.
7. Open **Authentication → URL Configuration**:
   - Site URL: `https://towcalc.com`
   - Allowed redirect URL: `https://towcalc.com/**`
   - Keep only intentional Preview/local entries in addition to production.
8. Review the Invite and Reset Password templates. Keep them concise and ensure their action links use Supabase's template variables rather than a hand-written token.
9. Open **Authentication → Rate Limits**. Supabase initially limits custom-SMTP Auth email to 30 per hour; choose a deliberate limit appropriate for launch.

The built-in Supabase mailer is not production mail: it is restricted to organization-team addresses and is currently heavily rate-limited. Custom SMTP is required for real customer invitations.

## Part 3 — Configure operational email

TowCalc currently invokes a Supabase Edge Function named `send-quote-approval-email`. Its source is **not present in this repository**. Before declaring email complete:

1. In Supabase, open **Edge Functions** and confirm `send-quote-approval-email` exists in the production project.
2. Inspect its current deployment/source and confirm:
   - it accepts `{ to, subject, html }`;
   - it requires an authenticated caller;
   - it validates the recipient and payload size;
   - it uses a fixed verified sender such as `TowCalc Dispatch <dispatch@notify.towcalc.com>`;
   - it never accepts a caller-supplied `from` address;
   - provider failures return a non-2xx response.
3. Add the provider API key in **Edge Functions → Secrets** as `RESEND_API_KEY` (or the exact variable the existing function expects).
4. Redeploy the function if the sender, validation, or secret name changes.
5. Bring the function source into `supabase/functions/send-quote-approval-email/` in this repository so production email can be reviewed, restored, and deployed repeatably.

Do not replace this operational path with Supabase Auth SMTP. Auth SMTP is designed for Auth-generated messages, not arbitrary dispatch emails.

## Part 4 — End-to-end test matrix

Run these against production with clearly marked test data:

| Test | Expected result |
| --- | --- |
| Invite a new dispatcher at Gmail | Arrives from TowCalc; link opens `towcalc.com`; registration succeeds |
| Invite a new client at Outlook | Same; invited email and selected client account are enforced |
| Request password reset | Reset link opens TowCalc and succeeds once |
| Share a quote | Recipient gets correct customer, equipment, route, and amount |
| Submit a dispatch request | Configured dispatch/contact inbox receives it |
| Attach a BOL and request dispatch | Email contains a working signed link that expires |
| Force an invalid recipient | UI shows failure; no false success |

For every delivered message, inspect “original message” headers and confirm SPF, DKIM, and DMARC pass. Also check spam, provider delivery logs, Supabase Auth logs, Edge Function logs, and Vercel runtime logs.

## Launch acceptance checklist

- [ ] Both domains verified
- [ ] SPF passes
- [ ] DKIM passes
- [ ] DMARC passes
- [ ] Supabase Auth custom SMTP enabled
- [ ] Production Site URL and redirects correct
- [ ] Auth email rate limit reviewed
- [ ] Edge Function exists and its source is recovered into the repository
- [ ] Provider secret stored only in Supabase
- [ ] Gmail and Outlook invite tests pass
- [ ] Password reset passes
- [ ] Quote share and dispatch request pass
- [ ] Provider alerts/billing limits enabled
- [ ] Credentials recorded in a password manager

## If something fails

- **“Email address not authorized”**: production is still using Supabase's default mailer; enable custom SMTP.
- **Invite arrives but opens the wrong site**: fix Supabase Site URL/redirect allowlist and verify the `SITE_URL` production environment value.
- **Invite works but dispatch email fails**: inspect the Edge Function, its provider secret, and its logs; this is the second email path.
- **Mail lands in spam**: check domain verification and alignment first, then content and sender reputation.
- **Link is already used**: security scanning or click tracking may have consumed a single-use link; disable link tracking and consider an intermediate user-click page.

## References

- [Supabase: Send emails with custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp)
- [Supabase: Sending emails from Edge Functions](https://supabase.com/docs/guides/functions/examples/send-emails)
- [Supabase production checklist](https://supabase.com/docs/guides/deployment/going-into-prod)

