# Backend: open questions

Everything below is **built with the default** shown, so nothing is blocked. Before go-live the lead fills in
**Answer**; changing a default is a config or one-constant edit. Business questions shared with the frontends are in
`spareXAdmin/OPEN-QUESTIONS.md` (Q-ids) and are not repeated here.

**Agent:** add new rows at the end with the next free ID. Never delete rows; when an answer arrives, fill in
**Answer** and set **Status** to `Answered`.

| ID | Question | Affects | Default built | Answer | Status |
|---|---|---|---|---|---|
| B-01 | How long does a signed-in session last per app? | Sessions | Admin 12 hours (Q-21), B2C 30 days, B2B 7 days; each renewed on use up to that limit | | Open |
| B-02 | Which SMS provider for OTPs (needs DLT registration in Kannali's name)? | `infra/sms` | Console sender locally; MSG91 adapter added when the account exists | | Open |
| B-03 | Which email provider, and the sender address? | `infra/email` | Console sender locally; Amazon SES adapter when hosting is decided | | Open |
| B-04 | Hosting: AWS Mumbai or DigitalOcean Bangalore? | Storage, deployment | S3-compatible storage in staging and production (local disk in development), so either works | | Open |
| B-05 | OTP rules: length, validity, resend gap, hourly limit? | B2C sign-in, 2-step | 6 digits, 5 minutes, resend after 30 s, 5 per number per hour, 5 wrong tries | | Open |
| B-06 | Password sign-in lockout? | Admin and B2B sign-in | 5 failures lock the account for 15 minutes | | Open |
| B-07 | Upload limits? | Files | JPEG, PNG, WebP, PDF; 10 MB per file | | Open |
| B-08 | Should the B2C devices list show an approximate location (needs an IP-to-location service)? | Sessions, B2C account | No lookup; `location` is an empty string (F-10) | | Open |
| B-09 | Are catalogue images (products, banners) public links, or private like every other upload? | Files, catalogue (Phase 2) | Every upload is private, served by 5-minute signed links (`SIGNED_URL_TTL_SECONDS`) | Uploads have a visibility. `public` (product images, banners, brand logos, garage photos) gets a stable public URL that can be cached; `private` (GST/KYC documents, invoices, everything else) is served by signed links. | Answered |
| B-10 | Can an admin whose role lacks `auditLog.view` still see their own "My activity"? | Audit log | No: the audit list always needs `auditLog.view` (both seeded roles have it) | | Open |
| B-11 | Must a customer's email or GSTIN be unique across customers? | Customers | No: only the mobile number is unique; several customers may share an email or a business GSTIN | | Open |
| B-12 | Exact SMS wording for codes (DLT templates must match it word for word)? | `infra/sms`, auth | "123456 is your SpareX sign-in code. Don't share it with anyone." (admin: "…Kannali admin sign-in code…") | | Open |
| B-13 | B-01 says sessions are "renewed on use up to that limit". Fixed lifetime from sign-in, or sliding with a cap? | Sessions | Fixed: a session ends its lifetime after sign-in, however much it is used | | Open |
| B-14 | `POST /v1/b2c/auth/otp` reveals whether a number has an account (`isNewUser`, which the B2C login needs). Acceptable? | B2C sign-in | Yes, with per-IP and per-number rate limits | | Open |
| B-15 | Do OTP send limits (one per 30 s, 5 per hour) count a phone number across admin 2-step and B2C sign-in together, or separately? | OTP | Separately, per number and purpose (the demo Super Admin and the demo customer share 9845012345) | | Open |
