# Frontend changes

What the three frontends must adjust to connect to this API. The lead passes these to the frontend agents. Add
rows at the end; never delete them. **Phase** is when the row was added.

| # | Phase | Repo | File | Change | Why |
|---|---|---|---|---|---|
| F-01 | 1 | spareXB2B | `src/lib/api-client.ts` | Read field errors from `fieldErrors`, not `details`. | Every API error is `{ message, code, fieldErrors? }`. |
| F-02 | 1 | spareXB2C | `src/features/auth/api.ts` (`verifyOtp`) | Don't treat only `404` as a wrong code. A bad code is `422` with `code` `OTP_INVALID` (message says how many tries are left), `OTP_EXPIRED` or `OTP_ATTEMPTS_EXCEEDED`; a new number without a name is `422 NAME_REQUIRED`. Show `message`. | `orNull` turns only 404 into null, so today a wrong code would throw. |
| F-03 | 1 | spareXB2C | `src/features/auth/api.ts` (`requestOtp`) | Handle `429` with `code` `OTP_RESEND_TOO_SOON` or `OTP_SEND_LIMIT` by showing `message`. | Codes go out at most once per 30 s and 5 times per hour per number (B-05). |
| F-04 | 1 | all three | `src/lib/api-client.ts` | On every call, forward the visitor's IP in `X-Forwarded-For` and the browser's `User-Agent` header. The API's `TRUST_PROXY` must list the Next.js servers' addresses. | The API is called from the Next.js server, so without this every rate limit and session would see the server's IP, and the devices list would say "Unknown device". |
| F-05 | 1 | spareXAdmin | `src/features/auth/api.ts` (`getTwoStepChallenge`) | Return `null` on a `404`, as the mock does. | The API answers `404` once a challenge has expired or been used; today `apiClient.get` would throw instead of the page redirecting to `/login?expired=1`. |
| F-06 | 1 | spareXAdmin | `src/features/auth/api.ts` | Expect `422` (not the mock's `410`) for an expired 2-step code (`OTP_EXPIRED`) and a used or expired reset link (`RESET_TOKEN_INVALID`), and `422 ACCOUNT_LOCKED` after 5 wrong passwords. | Error statuses follow CLAUDE.md §6: business rules are 422. Only matters if a screen branches on the status. |
| F-07 | 1 | spareXAdmin | `src/features/uploads/api.ts` | `POST /uploads` returns an `Attachment` (`{ id, name, url, visibility, mimeType, sizeBytes }`). Send the form field `visibility=public` for product images, banners, brand logos and garage photos: their `url` is stable and may be stored. Anything else is `private` (the default): its `url` is a signed link valid for 5 minutes, so store the `id` and get a fresh link from `GET /files/:id` when showing it. | Public files can be cached by browsers and a CDN; documents (GST, KYC, invoices) must never have a permanent link (B-09). |
| F-08 | 1 | spareXAdmin | `src/lib/types.ts` (`Attachment.mimeType`) | Add `"image/webp"`. | WebP uploads are allowed (B-07). |
| F-09 | 1 | spareXAdmin | `src/lib/api-client.ts` | Keep the error `code` on `ApiError` (it already keeps `message` and `fieldErrors`). | Lets screens branch on stable codes instead of message text. |
| F-10 | 1 | spareXB2C | `src/features/account/types.ts` (`DeviceSession.location`) | Expect `location` to be `""` and hide the line when it is empty. | There is no IP-to-location lookup yet (B-08). |
