# Kannali Garage + SpareX: Backend

Instructions for the agent building this repo. Read this whole file before writing any code. If something here is
unclear or conflicts with what you find, stop and ask the lead; don't guess.

## 1. Pillars

Every decision is checked against these five:

1. **Easy to maintain**: a new developer finds anything in seconds because every module has the same shape.
2. **Easy to scale**: new features are new modules; nothing existing has to be rewritten.
3. **Clean**: small files, plain names, no clever code, no unused code, no speculative abstractions.
4. **Correct with money**: prices, GST, stock, credit and invoices are never wrong, even under failure or double
   requests.
5. **Industry standard**: NestJS conventions; nothing a senior Node developer would find surprising.

## 2. What this backend is

One API for every app on the platform:

| App | Repo | Calls this API at |
|---|---|---|
| Admin panel (Kannali staff) | `C:\Users\muska\Downloads\spareXAdmin` | `/v1/admin` |
| B2C web (customers: shop + service booking) | `C:\Users\muska\Downloads\spareXB2C` | `/v1/b2c` |
| B2B web (businesses buying + garages running jobs) | `C:\Users\muska\Downloads\spareXB2B` | `/v1/b2b` |
| Mobile apps (later) | separate repos | same surfaces |

The three frontends are finished screens running on demo data. Each feature reads data through
`src/features/<feature>/api.ts`, which today calls `src/mocks/` and later calls this API. **Those `api.ts` files and
the `types.ts` next to them are the contract**: before building a module, read the matching files in every frontend
that uses it, and build the endpoints, request bodies and response shapes they expect.

**`DATA-MODEL.md` is the storage contract**: every collection, field, index, status move and money flow. Storage
follows it; response shapes follow the frontends, translated in each surface's DTOs (its intro explains the split).

When a frontend contract is wrong (unsafe, inconsistent, or impossible), don't bend the backend. Build it correctly and
add a row to `FRONTEND-CHANGES.md` (repo, file, what to change, why). The lead passes these to the frontend agents.

Only Kannali sells. There are no sellers or vendors.

## 3. Stack

Use the latest stable version of each at setup time (no betas, no release candidates) and pin exact versions in
`package.json`. Nothing outside this list without the lead's approval.

| Need | Choice |
|---|---|
| Runtime | Node.js 24 LTS, npm |
| Language | TypeScript, `strict: true`, no `any` |
| Framework | NestJS |
| Database | MongoDB Atlas, always a **replica set** (a free M0 cluster for development; no local MongoDB, no Docker) |
| ODM | Mongoose via `@nestjs/mongoose` |
| Validation | `class-validator` + `class-transformer` (DTOs and env config) |
| API docs | `@nestjs/swagger` |
| Config | `@nestjs/config`, env validated at startup; the app refuses to start on a missing or bad value |
| Rate limiting | `@nestjs/throttler` with its built-in in-memory storage (one server instance at launch) |
| OTP codes, lockouts | MongoDB (TTL indexes), not Redis |
| Background jobs | An `outbox` collection in MongoDB, written in the same transaction as the record that triggers it, processed by a worker on `@nestjs/schedule` (retries with backoff, marks done or failed). Not before the phase that first needs it. No Redis, no BullMQ |
| Passwords | `argon2` (argon2id) |
| Logging | `nestjs-pino` (JSON logs, request id, redaction) |
| Health | `@nestjs/terminus` |
| Security headers | `helmet` |
| File storage | One `FileStorage` interface: local disk (`uploads/`, git-ignored) in development and tests; S3-compatible (`@aws-sdk/client-s3`) in staging and production |
| Data migrations | `migrate-mongo` |
| Tests | Jest + Supertest (Nest defaults) + `mongodb-memory-server` (`MongoMemoryReplSet`, so transactions work in tests with nothing installed) |
| Lint / format | ESLint 9 flat config + typescript-eslint + Prettier |

**Outside services before their accounts exist.** Every outside service sits behind a small interface in `infra/`
with two implementations: a local one and the real one. The local one is chosen when the real one's keys are not
configured, so the whole backend can be built, run and tested with no real account. Real adapters are written against
the provider's documented API and switched on in Phase 10 by adding keys to `.env`; no other code changes.

| Service | Local implementation | Real implementation |
|---|---|---|
| Database | `MongoMemoryReplSet` (`dev:memory`, tests) | Atlas |
| SMS, WhatsApp, email | Console senders (print to the log) | Provider adapters (B-02, B-03) |
| Payments | `FakePaymentGateway`: creates orders, simulates success, failure and refunds, and sends signed webhooks to our own endpoint, so the real webhook code path is exercised | Razorpay adapter |
| File storage | Local disk | S3 |

Not used: Redis, BullMQ, Prisma (its MongoDB support has no migrations), TypeORM, GraphQL, microservices, CQRS, event sourcing, a
repository layer over Mongoose.

## 4. Setup (Phase 1, step 1)

This folder already contains `CLAUDE.md` and `OPEN-QUESTIONS.md`, so scaffold with the Nest CLI into a temporary
sub-folder, move everything up to the root, delete the sub-folder, and delete the CLI's sample controller, service and
test. Then add:

- **No Docker.** Development uses a free MongoDB Atlas M0 cluster (the lead creates it and puts the connection string
  in `.env`). Each developer uses their own database name on it, e.g. `kannali_dev_<name>`. Tests never touch Atlas;
  they start `MongoMemoryReplSet`.
- `.env.example` with every variable and a safe placeholder (an Atlas URI placeholder, never a real one). `.env` and
  `uploads/` are git-ignored.
- `npm` scripts:

| Script | Does |
|---|---|
| `dev` | start with watch, against the database in `.env` |
| `dev:memory` | start a `MongoMemoryReplSet`, seed it, and run the app with watch against it; nothing is kept after stopping. For working before an Atlas database exists |
| `build` / `start` | compile / run the compiled app |
| `typecheck` | `tsc --noEmit` |
| `lint` / `format` / `format:check` | ESLint / Prettier write / Prettier check |
| `check` | typecheck + lint + format:check |
| `test` | all tests (in-memory replica set; no internet or Atlas needed after the first run downloads MongoDB) |
| `seed` | wipe the configured database and load demo data; refuses unless `NODE_ENV=development` **and** the database name contains `_dev` |
| `db:indexes` | create or update every collection's indexes |
| `migrate:up` / `migrate:down` / `migrate:create` | migrate-mongo |
| `openapi` | write `openapi/admin.json`, `openapi/b2c.json`, `openapi/b2b.json` |

- `README.md`: how to run locally in five steps or fewer.

## 5. Folder structure

```
src/
  main.ts                    bootstrap: helmet, pino, global pipes and filter, /v1 prefix, swagger (non-production)
  app.module.ts
  config/                    env schema (class-validator) and typed config access
  common/                    small shared pieces only, used by 3+ modules
    errors/                  AppError, error codes, the global exception filter
    http/                    surface decorators (AdminController, B2cController, B2bController), Public, CurrentActor
    pagination/              ListQueryDto, paginate(), Paginated<T>
    database/                withTransaction(), base schema options (timestamps, id transform)
    money.ts                 paise helpers, GST maths (pure functions, unit tested)
    phone.ts                 Indian mobile normalisation (to E.164) and masking
  infra/                     wrappers around outside services, each behind a small interface
    storage/                 FileStorage: local disk (development, tests) and S3 (staging, production)
    sms/                     SmsSender interface: ConsoleSmsSender (local), real provider later
    email/                   EmailSender interface: ConsoleEmailSender (local), real provider later
  modules/
    <module>/
      <module>.module.ts
      <module>.schema.ts      Mongoose schema(s) for this module only
      <module>.service.ts     business rules; the only place this module's models are used
      admin.controller.ts     /v1/admin/<module>  (only the surfaces this module serves)
      b2c.controller.ts       /v1/b2c/<module>
      b2b.controller.ts       /v1/b2b/<module>
      dto/                    request DTOs and response types, per surface where they differ
      <module>.service.spec.ts
test/                         end-to-end tests (Supertest) per surface
migrations/                   migrate-mongo
seed/                         demo data, matching the frontends' mocks
```

Module rules:
- **A module only reads and writes its own collections.** To use another module's data, call that module's exported
  service. Never inject another module's Mongoose model.
- Controllers are thin: validate input, check permission, call one service method, return. No logic.
- Services hold the rules. Split a service only when it passes about 300 lines, by sub-area (e.g. `otp.service.ts`).
- A file in `common/` or `infra/` must be used by more than one module. Otherwise it lives in the module.

## 6. API conventions

**Surfaces.** Every controller belongs to exactly one surface, declared with `@AdminController('path')`,
`@B2cController('path')` or `@B2bController('path')`. Each decorator sets the route prefix (`admin/…`, `b2c/…`,
`b2b/…`), the Swagger tag and document, and the auth guard for that surface. A token from one surface is rejected on
another. Endpoints are authenticated by default; `@Public()` marks the exceptions (sign-in, OTP, health).

**Paths.** Plural nouns, kebab-case: `GET /v1/admin/orders`, `GET /v1/admin/orders/:id`,
`PATCH /v1/admin/orders/:id/status`. The frontend's existing paths win over these rules.

**Responses.** Return the resource itself, no `{ data: … }` wrapper. Records expose `id` (string), never `_id` or
`__v`. Dates are ISO 8601 UTC strings. Money is integer **paise** in fields named for what they are (`price`,
`total`, `gstAmount`). A delete or an action with nothing to return answers `204`.

**Lists.** Query: `page` (from 1), `pageSize`, `q`, `sort=field.asc|desc`, `from`, `to` (`YYYY-MM-DD`), plus named
filters. Response: `{ items, page, pageSize, total }`. Every sortable and filterable field has an index. Admin lists
also have an unpaginated twin at `<path>/all` (same filters, capped at 10,000 rows) for CSV export.

**Errors.** Every error, from anywhere, leaves through the global filter as:

```json
{ "message": "Only 2 left in stock.", "code": "OUT_OF_STOCK", "fieldErrors": { "quantity": ["Max 2"] } }
```

- `message`: plain English, safe to show the user. `code`: stable UPPER_SNAKE_CASE for the frontend to branch on.
  `fieldErrors`: only for validation.
- Status codes: 400 `VALIDATION_FAILED`, 401 `UNAUTHENTICATED`, 403 `FORBIDDEN`, 404 `NOT_FOUND`, 409 `CONFLICT`,
  422 business rule broken (`OUT_OF_STOCK`, `CREDIT_LIMIT_EXCEEDED`, `OTP_INVALID`…), 429 `RATE_LIMITED`,
  500 `INTERNAL` (generic message; details only in the logs).
- Business rules throw `new AppError(code, message, status)`. Never throw raw strings or leak stack traces.

**Versioning.** Everything is under `/v1`. Adding fields or endpoints is not breaking. Renaming or removing is, and
needs the lead's approval and, if unavoidable, `/v2` for that endpoint.

**No CORS.** The web apps call the API from their Next.js servers, never from the browser, and mobile apps don't need
CORS. Leave CORS off.

## 7. Auth and permissions

**Sessions, not JWTs.** On sign-in the server creates a random 32-byte token, stores only its SHA-256 hash in the
`sessions` collection (surface, user id, device label, IP, created, last used, expires), and returns the token. The
frontend keeps it in an httpOnly cookie and sends `Authorization: Bearer <token>`. Signing out deletes the session, so
a copied token stops working. "Log out other devices" deletes the others. Lifetimes per surface are in config
(defaults in `OPEN-QUESTIONS.md`). Expired sessions are removed by a TTL index.

**Three kinds of user, kept separate:**

| Surface | Who | Sign-in | Collection |
|---|---|---|---|
| admin | Kannali staff | email + password; 2-step SMS code (required for Super Admin, optional otherwise) | `adminUsers` |
| b2c | customers | 10-digit mobile + 6-digit SMS OTP; a new number creates the account (with a name) | `customers` |
| b2b | business users | email + password, optional 2-step, first-login password change, after admin approval | `businessUsers` (Phase 4) |

**OTP and code rules** (all values in config): 6 digits, stored hashed, valid 5 minutes, resend after 30 seconds, at
most 5 sends per number per hour, 5 wrong tries kills the code. Codes live in an `otpCodes` collection (phone,
purpose, code hash, attempts, expiry) with a TTL index; the hourly limit counts that number's codes from the last
hour. Admin and B2B password sign-in: 5 failures lock the account for 15 minutes (`failedSignIns` and `lockedUntil`
on the user). Locally, `SMS_PROVIDER=console` logs the code instead of sending it, and only then may a
response include the `demoCode` field the admin frontend already supports.

**Permissions, never role names.** Code checks `@RequirePermission('orders.manage')`, never `role === …`.
- Admin permissions are exactly the strings in `spareXAdmin/src/features/auth/permissions.ts` (`orders.view`
  style). Roles are stored in a `roles` collection (seeded: Super Admin, Admin, with the same permissions as that
  file) so new roles can be added later as data.
- B2B permissions are exactly the strings in `spareXB2B/src/features/auth/permissions.ts` (`orders:view` style),
  with the five fixed garage roles from `roles.ts`; a user can hold several roles. Branch scoping follows
  `scopeToBranch` in the same file.
- B2C customers have no permissions, only ownership: a customer can only ever read or change their own records.
  Every b2c query filters by the signed-in customer's id. A record that isn't theirs is `404`, never `403`.

The signed-in user reaches handlers through `@CurrentActor()`, giving `{ type, id, name, permissions }` (the
`ActorRef` shape in `spareXAdmin/src/lib/types.ts`), which is also what the audit log records.

## 8. MongoDB rules (non-negotiable)

1. **Replica set everywhere**, so transactions work: Atlas (every cluster is one) and `MongoMemoryReplSet` in tests.
2. **Every flow that changes money, stock or a number sequence runs in one transaction** via
   `withTransaction(connection, async (session) => …)`, passing `session` to every operation inside. That means placing an
   order, receiving a payment, refunds, returns, credit ledger entries, invoices, credit notes and job card billing.
3. **Never read then write a quantity.** Stock is changed with a single conditional update:
   `updateOne({ _id, stock: { $gte: qty } }, { $inc: { stock: -qty } })`, and `matchedCount === 0` means out of stock.
   The same pattern applies to credit balances and coupon usage counts.
4. **Number sequences** (invoice, credit note, order, quotation numbers) come from a `counters` collection with
   `findOneAndUpdate({ _id: 'invoice:26-27' }, { $inc: { seq: 1 } }, { upsert: true, new: true, session })`
   inside the same transaction as the record that uses them. No gaps, no duplicates. Financial year runs April to
   March in Asia/Kolkata time.
5. **Strict schemas.** Every schema has `strict: true`, `timestamps: true`, required fields marked, enums for every
   status, `min: 0` on quantities and money, and the shared `toJSON` transform (`id`, no `_id`/`__v`).
6. **Reference by id, copy only what must freeze.** Store `customerId`, `productId` and so on. Copy data only when it
   must never change afterwards: an order line keeps the product name, SKU, HSN, price, discount and GST rate as they were
   at purchase; an invoice keeps the billing address and GSTIN. Don't embed arrays that grow without limit (orders
   inside a customer, ledger entries inside an account); give them their own collection.
7. **Unique indexes** wherever the business says "only one": email, phone, GSTIN, SKU, invoice number, product +
   vehicle variant fitment, one active session token hash.
8. **Append-only money records.** Credit ledger entries, payments and stock movements are never edited or deleted;
   corrections are new reversing entries. Balances are updated in the same transaction as the entry.
9. **Soft delete only** (`deletedAt`) for anything other records point to. Default queries exclude soft-deleted records.
10. **Money is integer paise**, stored as a Number with an integer validator. Never floats, never Decimal128 maths in
    JavaScript. GST is computed per line in `common/money.ts`, with rounding to the paisa defined in one place and unit
    tested.
11. **Indexes are declared on the schema.** `autoIndex` is on locally and off in staging and production, where
    `npm run db:indexes` applies them. Changes to existing data (renames, back-fills) are migrate-mongo migrations,
    never ad-hoc scripts.
12. **Times** are stored in UTC. Anything with a "day" meaning (financial year, daily reports, booking date) is
    computed in Asia/Kolkata.

## 9. Security rules

- Never trust the client for prices, totals, discounts, GST, stock or permissions; recompute on the server.
- Validate every input with a DTO (`whitelist: true`, `forbidNonWhitelisted: true`, `transform: true`).
- Never log passwords, OTPs, tokens, full card or bank details (pino `redact`).
- Secrets only from env. Never in code, git, logs or responses.
- Rate limit: global default per IP, stricter on sign-in, OTP and password reset (per IP **and** per phone or email).
  The web apps' Next servers will forward the visitor's IP in `X-Forwarded-For`; trust it only from configured
  proxies (`TRUST_PROXY`), and log this in `FRONTEND-CHANGES.md`.
- File uploads: allow-list of types (`image/jpeg`, `image/png`, `image/webp`, `application/pdf`), size limit from
  config, random object keys, never the user's file name as the key. Private files are served by short-lived signed URLs.
- Webhooks (Razorpay, later) verify the signature and are idempotent: a repeated event changes nothing.

## 10. Code rules

- Names say what things are. No abbreviations except `id`, `dto`, `url`, `gst`, `otp`.
- Comments explain **why** (a business rule, a non-obvious constraint), never what the next line does. Every
  exported service method has a one-line doc comment.
- No `any`, no `@ts-ignore`, no non-null `!` without a comment saying why it's safe.
- No dead code, no commented-out code, no TODOs without a Q-id or a phase number.
- Magic numbers go to config or a named constant.
- One way to do each thing: one error type, one pagination helper, one transaction helper, one permission decorator.
  If you need a second way, ask.
- Copy the frontends' wording for user-facing messages where they already have it.

## 11. Tests

- **Required:** every flow that touches money, stock, credit, sequences, auth or permissions has tests for the happy
  path, the main failure, and the race or repeat case (two buyers, the last item; a webhook sent twice).
- Unit tests for pure logic (`common/money.ts`, phone normalisation, status transitions).
- End-to-end tests per surface with Supertest against `MongoMemoryReplSet` (one shared instance per test run, a
  separate database per test file, dropped afterwards).
- Plain CRUD with no rules doesn't need tests beyond one e2e smoke test per module.
- Tests read like the business rule they protect: `it('rejects an order when stock runs out between cart and pay')`.

## 12. Demo data (seed)

`npm run seed` loads data that matches the frontends' mocks (same people, products, IDs where the frontends link to
them, prices and statuses), so screens look the same when a feature switches from mock to API. Copy values from the
`src/mocks/` folders of the three frontends; don't invent new demo people. Demo sign-ins match the ones the admin
login screen shows in demo mode.

## 13. Phases

The lead types **"Do Phase N."** Build only that phase. Phases 2 and later start only after `DATA-MODEL.md` exists in
this repo (the lead adds it).

| Phase | Builds | Then the frontends connect |
|---|---|---|
| 1 | Setup, config, errors, logging, health, Swagger, surfaces, sessions, admin auth + profile, B2C auth + profile + addresses + device sessions, roles and permissions, audit log (record + admin list), file uploads, seed for these | Admin A01–A03, A08; B2C login, account |
| 2 | Masters (vehicle hierarchy, product categories, part brands, service master, inspection template), catalogue, fitment, stock, CSV import, B2C and B2B browse and search | Admin masters and catalogue; shop browsing |
| 3 | Customers and vehicles (admin side), vehicle transfer, enquiries | Admin customers, vehicles, enquiries; B2C garage vehicles |
| 4 | B2B registration and applications, businesses, branches, business users and **B2B auth**, garage approval, admin users and roles screens | B2B sign-up and login; admin approvals, admin users |
| 5 | Cart, checkout, B2B discount, quotations, payment gateway (fake gateway + Razorpay adapter) with webhooks, bank transfer and COD, orders | Checkout and orders everywhere |
| 6 | Credit accounts and ledger, GST invoice PDFs, credit notes, returns and replacements, refunds | Credit, invoices, returns |
| 7 | Garage services and prices, bookings, walk-ins, job cards, inspection, estimates and approvals, QC, billing, payouts | B2C service, B2B garage, admin service |
| 8 | Banners, featured content, pages, coupons, garage ratings and reviews | Home pages, admin marketing |
| 9 | Notifications (SMS, WhatsApp, email through the outbox), dashboards, reports, settings and feature switches | Dashboards, reports, settings |
| 10 | Real accounts switched on (Atlas staging and production, SMS, email, WhatsApp, Razorpay, S3), security pass, load test of checkout and search, backups, monitoring (Sentry), deployment, real product import | Go-live |

### Phase 1 in detail

1. Setup (§4), with all scripts working.
2. `config/`: validated env (port, Mongo URI, storage, SMS and email provider, session lifetimes, OTP and
   lockout limits, trust proxy).
3. `common/`: AppError and the filter (§6), surface decorators, `@Public`, `@CurrentActor`, `@RequirePermission`,
   pagination helper, `withTransaction`, base schema options, `money.ts`, `phone.ts`, with unit tests.
4. `infra/`: storage (local disk driver now, S3 driver written but used only when configured), console SMS and email
   senders behind interfaces.
5. Health: `GET /health` (no `/v1` prefix) checks MongoDB.
6. Swagger: three documents at `/docs/admin`, `/docs/b2c`, `/docs/b2b` outside production; `npm run openapi`.
7. `modules/sessions`: create, look up by token hash, touch last-used, list, revoke, revoke others, TTL index.
8. `modules/admin-users` (model and service only; the screens come in Phase 4) + `modules/roles` (seeded).
9. `modules/auth`, admin surface: every endpoint in `spareXAdmin/src/features/auth/api.ts` (sign-in, 2-step
   challenge and verify, me, sign-out, password reset request and confirm, profile, change password, 2-step on/off),
   with lockout and audit entries for sign-in and password changes. Password reset tokens: random, hashed,
   single-use, valid 30 minutes, emailed through the console sender.
10. `modules/customers` (model and service) + `modules/auth`, b2c surface: every endpoint in
    `spareXB2C/src/features/auth/api.ts` and `spareXB2C/src/features/account/api.ts` (OTP request and verify,
    logout, profile, addresses, device sessions).
11. `modules/audit`: `audit.record(actor, input)` for other modules (the `AuditInput` shape in
    `spareXAdmin/src/features/audit/types.ts`) and the admin list endpoint matching the admin audit `api.ts`.
12. `modules/files`: authenticated upload returning an `Attachment` (the shape in `spareXAdmin/src/lib/types.ts`),
    signed download URLs.
13. Seed: roles, the demo admin users, the demo B2C customers with addresses.
14. Tests: OTP (expiry, wrong code, five wrong tries, resend limit), admin lockout, 2-step, session revoke, a token
    from one surface rejected on another, a permission denied, a customer unable to see another customer's address.
15. `FRONTEND-CHANGES.md` for anything the three frontends must adjust to connect (for example, B2B's error body
    uses `details` while this API uses `fieldErrors`; B2C's `verifyOtp` treats only `404` as a wrong code, but this
    API answers `422 OTP_INVALID`).

## 14. Quality gate and report

**While building:** after each module, run typecheck and lint on what changed, and that module's tests.

**End of each phase (all must pass):**
1. `npm run check`
2. `npm test`
3. `npm run build`
4. `npm run seed && npm run dev` (against the developer's Atlas dev database), or `npm run dev:memory` if there is
   none yet, then call every new endpoint once through Swagger, signed in
   as each relevant user, including one denied call.
5. Self-review against §5–§11: module boundaries, thin controllers, transactions where §8 requires them, no secrets,
   no `any`, no dead code.

**Then report, in this format, and stop. Don't commit; the lead commits.**

```
## Phase N report
Built: <modules and endpoints, grouped by surface>
Gate: check ✅/❌ · test ✅/❌ (<n> tests) · build ✅/❌ · manual ✅/❌
Decisions: <anything you chose that this file didn't decide>
Questions: <new B-ids added to OPEN-QUESTIONS.md>
Frontend changes: <new rows in FRONTEND-CHANGES.md>
Fix list: <anything known to be imperfect, to fix at the start of the next phase>
```

At the start of each phase, fix the previous phase's fix list first.

## 15. Open questions

Never wait for an answer. Build the default in `OPEN-QUESTIONS.md`, keep the value in config or one named constant so
changing it is a one-line edit, and add new questions as new rows (next free `B-` id). Never delete rows.
