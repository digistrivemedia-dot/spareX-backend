# Data model

The storage contract for every MongoDB collection: what is stored, who owns it, how records link, and which rules
protect money and stock. Read it with `CLAUDE.md` (§5 module rules, §8 MongoDB rules).

**Two layers, on purpose:**

- **Storage** (this file) is one canonical model shared by every app.
- **Responses** follow each frontend's `types.ts`. The three frontends were built separately and name things
  differently (`pincode` / `pin`, `price` / `priceInPaise`, `out_for_delivery` / `out-for-delivery`). Each surface's
  DTOs translate between storage and that frontend's contract. **A 1:1 rename is mapped in the DTO, never pushed onto
  a frontend.** `FRONTEND-CHANGES.md` is only for cases where a frontend is missing information, holds data in a
  shape storage can't map, or contradicts a business rule. §3 lists the ones known today.

Where this file and a frontend disagree, this file wins for storage, and the frontend's `types.ts` wins for response
shapes. Where this file is silent, ask the lead.

## 1. Conventions

**Ids.** Prefixed random strings from `newId(prefix)` (Phase 1). Each collection's prefix is listed with it. Seeded
records keep the ids the frontend mocks use.

**Human numbers.** These are separate from ids and come from `counters` inside the transaction that creates the
record (§8 rule 4):

| Record | Format | Counter key | Resets |
|---|---|---|---|
| Order | `ORD-2026-0143` | `order:2026` | calendar year |
| Quotation | `QT-2026-0012` | `quotation:2026` | calendar year |
| Return | `RET-2026-0007` | `return:2026` | calendar year |
| Enquiry | `ENQ-1024` | `enquiry` | never |
| Application | `APP-2026-0031` | `application:2026` | calendar year |
| Booking | `BK-2026-0219` | `booking:2026` | calendar year |
| Job card | `JC-2026-0418` | `job-card:2026` | calendar year |
| Kannali tax invoice | `KG/26-27/0001` (format in settings, Q-13) | `invoice:26-27` | financial year |
| Kannali credit note | `CN/26-27/0001` | `credit-note:26-27` | financial year |
| Garage service invoice | `<garage prefix>/26-27/0001` | `garage-invoice:<garageId>:26-27` | financial year |
| Payout | `PO-2026-0004` | `payout:2026` | calendar year |

Years and financial years (April to March) are computed in Asia/Kolkata.

**Money.** Integer paise, always.
- **Product prices are stored including GST.** That's what admin types in and what B2C shows. The B2B "price
  excluding GST" is derived in the B2B DTO.
- **Garage service prices and job card lines are stored excluding GST, with their GST rate.** That's what garages
  type in. B2C's GST-inclusive amounts are derived.
- **Every stored line also snapshots its computed `taxable`, `gst` and `total`** at the moment it is created, using
  `common/money.ts`. No screen ever recomputes tax for an existing record, and totals are sums of stored line values.
- A business discount is applied to the GST-inclusive unit price and rounded to the paisa
  (`round(price × (100 − discountPercent) / 100)`), then tax is split out of it like any other line.

**Enums** are stored in snake_case (`out_for_delivery`). Surfaces that use other spellings map them in the DTO.

**Phone numbers** are E.164 (`+919845012345`). **Addresses** are stored as:

```ts
Address = { line1, line2?, landmark?, city, state, pincode }      // line2 = area / locality
ContactAddress = Address & { name, phone }                         // a person at an address
```

The customer address book (Phase 1) adds `_id`, `label` and `isDefault`. Orders, bookings, invoices and returns store
a **copy** of the address as it was, never an id.

**Actor refs.** `ActorRef = { type: 'admin' | 'customer' | 'business' | 'garage' | 'system', id, name }`, as in
Phase 1. Every timeline entry and money record stores who did it.

**Timelines.** Records with a status keep a bounded embedded `timeline: { status, at, by: ActorRef, note? }[]`.
Status changes are only made through the module's service, which checks the transition against the allowed-moves
table for that record (§5). An illegal move is `422 INVALID_STATUS_CHANGE`.

**Soft delete.** Records other records point to have `deletedAt: Date | null`, and default queries exclude them.
Master records and products use `active: false` (hidden from shoppers) rather than deletion.

**Embedding rule.** Embed only bounded child data that is read with its parent: order lines, a job card's
inspection, a product's fitment rows (capped at 500), a business's branches (capped at 50). Anything that grows with
time gets its own collection: ledger entries, payments, stock movements, reviews.

## 2. Collections at a glance

| Module | Collections | Phase |
|---|---|---|
| sessions, auth | `sessions`, `otpCodes`, `passwordResetTokens` | 1 ✅ |
| admin-users, roles | `adminUsers`, `roles` | 1 ✅ |
| customers | `customers` | 1 ✅ |
| audit | `auditEntries` | 1 ✅ |
| files | `files` | 1 ✅ |
| platform | `counters`, `settings`, `notifications`, `outbox` | 2 (`counters`), 5, 9 |
| masters | `vehicleTypes`, `vehicleBrands`, `vehicleModels`, `vehicleVariants`, `productCategories`, `partBrands`, `serviceCategories`, `serviceItems`, `servicePackages`, `inspectionTemplates` | 2 |
| catalog | `products`, `stockMovements` | 2 |
| vehicles | `vehicles` | 3 |
| enquiries | `enquiries` | 3 |
| businesses | `businessApplications`, `businesses`, `businessUsers` | 4 |
| credit | `creditAccounts`, `creditLedgerEntries` | 6 |
| orders | `orders`, `quotations` | 5 |
| payments | `payments`, `refunds` | 5 |
| invoicing | `invoices`, `creditNotes` | 6 |
| returns | `returns` | 6 |
| garages | `garages`, `payouts` | 7 (`garages` profile base in 4) |
| service | `bookings`, `jobCards` | 7 |
| marketing | `banners`, `homeFeatures`, `contentPages`, `faqs`, `coupons`, `couponRedemptions` | 8 |
| reviews | `reviews` | 8 |

How the main records link:

```
customers ─┬─< vehicles >─ vehicleModels / vehicleVariants
           ├─< orders (b2c) >─< products >─ productCategories, partBrands
           ├─< bookings ── jobCards >── garages ── businesses
           └─< returns, enquiries, reviews

businesses ─┬─< businessUsers (roles, branch)
            ├── creditAccounts ─< creditLedgerEntries
            ├─< orders (b2b), quotations, invoices, payments
            └── garages (when type = garage_workshop) ─< bookings ─< jobCards ─< payouts
```

## 3. Conflicts between the frontends, resolved

| # | Conflict | Decision | Frontend change? |
|---|---|---|---|
| D-01 | Admin prices include GST; B2B prices exclude it | Products are stored including GST; B2B values are derived (§1) | No, mapped |
| D-02 | Vehicle types: admin and B2C `bike, scooter, car, commercial`; B2B `two_wheeler, three_wheeler, car, commercial` | Admin and B2C list (Q-02). `two_wheeler` can't map to bike *or* scooter | **Yes, B2B** uses the canonical list. Three-wheelers: new client question (see §9) |
| D-03 | Business roles: admin `owner, manager, purchaser, accountant` + separate garage staff roles; B2B five roles, several per user | B2B's five roles (`owner, manager, technician, spares, billing`), several per user, one branch each, from `spareXB2B/src/features/auth/roles.ts` | **Yes, admin**: one users list per business with B2B's roles; no separate garage staff list |
| D-04 | Admin `Garage` has its own branches, staff and optional `businessId`; B2B garage is a business with one profile for all branches; B2C lists garage *locations* | A garage is the service profile of a business (`garages.businessId` required). Its locations are that business's branches. B2C lists one card per **branch** (name = garage name + branch). Kannali's own workshops are a business created by admin, whose garage has `ownership: 'kannali'` | **Yes, admin**: garage branches and staff come from the business |
| D-05 | Job card statuses: admin 8, B2B 14 | B2B's 14 (§5.7). Admin shows them as they are; B2C sees its simpler stages, derived | **Yes, admin** uses the 14 statuses |
| D-06 | Booking statuses: admin 6, B2B 3 (`new, accepted, declined`), B2C request + stages | Admin's six (§5.6); B2B and B2C map | No, mapped |
| D-07 | Return statuses: admin 9, B2B and B2C 5 | Admin's nine plus `picked_up` (§5.5); customer surfaces map to their five | No, mapped |
| D-08 | Quotation statuses: admin `sent`, `converted`; B2B `quoted` | `requested, quoted, accepted, rejected, expired`. Accepting creates the order in the same transaction and sets `orderId` | **Yes, admin**: `sent` → `quoted`, no `converted` (accepted + `orderId`) |
| D-09 | Order payment status: B2B has `due, overdue`; B2C has `payment-pending` as an order status | Order status adds `payment_pending` (B2C online orders before payment). Payment status is `pending, paid, failed, refunded, partially_refunded, cancelled`. B2B `due`/`overdue` is derived from the credit invoice's due date | **Yes, admin**: orders list hides `payment_pending` by default and shows it as a filter |
| D-10 | B2B vehicles are free-text make and model; admin needs master ids | Vehicles point at the master (`brandId`, `modelId`, optional `variantId` and `year`). A garage walk-in whose vehicle isn't in the master stores `unlisted: { make, model }` and raises a `vehicle_not_listed` enquiry automatically | **Yes, B2B**: pick make and model from the master, with "not listed" as a fallback |
| D-11 | B2B shows stock per delivery branch; Q-07 says one stock count | One count per product; the B2B DTO returns the same quantity for every branch | No, mapped |
| D-12 | Admin settings has editable OTP limits; Phase 1 reads them from env | OTP and lockout limits stay in env (security, not business); the admin settings screen shows them read-only | **Yes, admin**: Security section read-only |
| D-13 | Admin "Integrations" could be read as editable keys | API keys live only in env or a secret manager, never in MongoDB. The screen shows provider, mode, masked key id, status and a "test connection" button | **Yes, admin**, if its form edits keys |
| D-14 | Banner placements and fields differ (admin `b2c_hero`…; B2C `home-hero`… with subtitle, CTA, alt) | Admin's placement names; banners also store `subtitle`, `ctaLabel` and `imageAlt` | **Yes, admin**: add the three fields. B2C is mapped |
| D-15 | Admin features a flat product list; B2C home has titled product shelves and vehicle brands | `homeFeatures` stores categories, titled shelves of products, and vehicle brands | **Yes, admin**: shelves have a title and a "view all" link |
| D-16 | Enquiry statuses: admin `new, in_progress, resolved, closed`; B2C `open, answered, closed`; B2C has photos | Admin's statuses; B2C mapped; photos stored | **Yes, admin**: show photos |
| D-17 | Carts and saved items | Carts and saved items stay in the browser at launch. Checkout sends only product ids and quantities, and the server prices everything | No |
| D-18 | Business GSTIN: admin required, B2B optional | Optional (B2B rule: businesses without GST can still buy). Invoices without a buyer GSTIN are B2C-style tax invoices | **Yes, admin**: GSTIN optional on applications and businesses |

**Three conflicts are business decisions, not technical ones.** They're built as below with a switch, and listed in
§9 for the lead:
- **D-19 Booking time.** B2C and B2B both built time slots; the admin default (Q-20) is date only. Storage keeps
  `date` + `slot: { from, to } | null`. A slot is the arrival time, or the pickup window with pick and drop. The
  `bookingTimeSlots` switch decides whether customers choose one.
- **D-20 Who picks the garage.** B2C offers "Kannali picks the best garage", with the request offered to garages one
  after another, as well as "choose a garage". The admin plan treated auto-assignment as an add-on. Storage supports
  both (`bookings.offers`, §4.18). Each garage gets `settings.service.garageAcceptMinutes` (default **15 minutes**,
  not seconds) to accept.
- **D-21 Service prices.** B2C sells **service packages at one admin-set price at every garage**; B2B and admin let
  **each garage price its own services** (Q-08). Storage has both: `servicePackages` (admin-priced, used when a
  customer books a package) and `garages.services` (garage-priced, used for walk-ins, extra work and estimates).

## 4. Collections

Fields are listed as TypeScript shapes. Every collection also has `createdAt` and `updatedAt`. Indexes follow each
shape.

### 4.1 Built in Phase 1 (for reference)

`adminUsers` (`adm`), `roles`, `sessions` (`ses`), `otpCodes` (`otp`), `passwordResetTokens` (`prt`), `customers`
(`cus`), `auditEntries`, `files`. Their schemas in `src/modules/*` are authoritative. Additions in later phases:
- `customers`: `hasAppAccount: boolean`. False when a garage created the customer at a walk-in; it becomes true
  the first time they sign in with OTP, and they then see their full history (one central record per phone number).
- `files`: `ownerType`/`ownerId` when an upload belongs to a record, so orphaned uploads can be cleaned up later.

### 4.2 `counters` (platform)

```ts
{ _id: string /* e.g. "invoice:26-27" */, seq: number }
```

`nextNumber(key, session)` in `common/database` is the only way to read it (§8 rule 4).

### 4.3 Masters

```ts
vehicleTypes        { _id: 'bike'|'scooter'|'car'|'commercial', name, description, sortOrder, active }
vehicleBrands       { _id 'vbr', name, slug (unique), logoFileId|null, description, vehicleTypes: VehicleType[], active }
vehicleModels       { _id 'vmo', brandId, name, slug, vehicleType, active }
vehicleVariants     { _id 'vva', modelId, name, fuel: 'petrol'|'diesel'|'cng'|'electric'|'hybrid',
                      engineCc|null, batteryKwh|null, years: number[], active }
productCategories   { _id 'pca', name, slug (unique), parentId|null, imageFileId|null, sortOrder, active }
partBrands          { _id 'pbr', name, slug (unique), logoFileId|null, isOem, active }
serviceCategories   { _id 'sca', name, sortOrder, active }
serviceItems        { _id 'sit', categoryId, name, description, vehicleTypes: VehicleType[], active }
servicePackages     { _id 'spk', name, description, includes: string[], durationLabel, price /* incl GST */,
                      gstRate, vehicleModelIds: string[] /* empty = every model of vehicleTypes */,
                      vehicleTypes: VehicleType[], isRoutine, active }                         // D-21
inspectionTemplates { _id 'ins', vehicleType (unique),
                      sections: { section: InspectionSection, items: { id, label }[] }[] }
```

Indexes: `vehicleModels {brandId, name}` unique; `vehicleVariants {modelId, name}` unique; `productCategories
{parentId, sortOrder}`; `serviceItems {categoryId}`; `servicePackages {vehicleModelIds}`.

Rules: a master record in use is switched off, never deleted. Names are unique within their parent.

### 4.4 `products` (catalog, `prd`)

```ts
{
  name, slug (unique), sku (unique), partNumber, hsnCode, gstRate: 0|5|12|18|28,
  categoryId, subcategoryId|null, partBrandId,
  description, highlights: string[], specs: { label, value }[],
  images: { fileId, url, alt }[],                       // public files (B-09); the first is the main image
  mrp, price,                                           // incl GST; price ≤ mrp
  stock: number (min 0), lowStockLevel,
  unit /* "piece", "bottle", "pair" */, packSize, packName|null,
  dimensionsMm: { length, width, height }|null, weightGrams, warrantyMonths|null,
  fitment: {
    universal: boolean,                                 // true: fits every vehicle of vehicleTypes
    vehicleTypes: VehicleType[],
    rows: { _id, brandId, modelId, variantId|null /* every variant */, years: number[] /* empty = all */ }[]  // ≤ 500
  },
  seo: { title, description },
  installation: { available: boolean, charge|null },    // behind the productInstallation switch (Q-19)
  salesCount: number,                                   // for "popular" sorting; updated when an order is delivered
  active, deletedAt|null
}
```

Indexes: `sku` unique; `slug` unique; `partNumber`; `{categoryId, active, price}`; `{partBrandId, active}`;
`{'fitment.rows.modelId': 1, 'fitment.rows.variantId': 1}`; `{'fitment.universal': 1, 'fitment.vehicleTypes': 1}`; a
text index on `name, partNumber, sku` (weights: partNumber and sku above name).

"Fits my vehicle" = `universal && vehicleTypes ∋ type`, **or** a fitment row with the model whose variant is null or
the same, and whose years are empty or include the year.

### 4.5 `stockMovements` (catalog, `stm`)

Append-only: every stock change, from any cause.

```ts
{ productId, change: number /* + adds, − removes */, balanceAfter, reason:
    'purchase_received'|'damaged'|'count_correction'|'returned_to_stock'|'other'      // admin adjustments
  | 'order_placed'|'order_cancelled'|'payment_expired'|'return_restocked'|'replacement_sent',
  note, orderId|null, returnId|null, by: ActorRef, at }
```

Index: `{productId, at: -1}`.

**The only way stock changes** is `CatalogService.changeStock(productId, change, reason, …, session)`. It does the
conditional `$inc` (§8 rule 3), writes the movement with `balanceAfter` from the update's result, and audits admin
adjustments. All of this happens inside the caller's transaction.

### 4.6 `vehicles` (vehicles, `veh`)

```ts
{
  registrationNumber: string|null,      // stored normalised (no spaces, upper case); null for a new vehicle
  vehicleType, brandId|null, modelId|null, variantId|null, year|null, fuel|null,
  unlisted: { make, model }|null,       // D-10: exactly one of modelId or unlisted is set
  colour|null, chassisNumber|null, odometerKm, odometerUpdatedAt,
  ownerId: string|null,                 // customer; null only for a garage walk-in not linked yet
  owners: { customerId, customerName, from: IsoDate, to: IsoDate|null }[],
  photos: { fileId, url }[],
  documents: { kind: 'rc'|'insurance'|'puc', number|null, provider|null, expiresOn|null, fileId|null }[],  // always 3
  isDefault: boolean,                   // the owner's default vehicle
  addedBy: 'customer'|'garage', deletedAt|null
}
```

Indexes: `registrationNumber` unique where it is not null; `{ownerId}`; `{brandId, modelId}`.

Rules: one vehicle record for life, whoever owns it. **Transfer** (Q-04) closes the current `owners` entry, opens a
new one and changes `ownerId`, in one update. Service history isn't stored here; it's read from `jobCards` by
`vehicleId`. Other garages see a visit without prices.

### 4.7 `enquiries` (`enq`)

```ts
{ number, kind: 'vehicle_not_listed'|'no_part_fits', status: 'new'|'in_progress'|'resolved'|'closed',
  source: 'customer'|'garage', customerId|null, name, phone, email|null,
  vehicle: { vehicleId|null, vehicleType|null, brand, model, variant|null, year|null },
  partQuery|null, message, photos: { fileId, url }[],
  notes: { _id, at, by: ActorRef, text }[], reply: { text, at, by: ActorRef }|null }
```

Indexes: `number` unique; `{status, createdAt: -1}`; `{customerId, createdAt: -1}`.

### 4.8 `businessApplications` (businesses, `bap`)

```ts
{ number, businessName, type: BusinessType, gstin|null, pan|null, licenceNumber|null, otherRegistration|null,
  contact: { name, email, phone }, address: Address, location: { lat, lng }|null,
  photos: { fileId, url }[], documents: { fileId, type: 'gst_certificate'|'pan_card'|'trade_licence'|'shop_photo'|'other' }[],
  status: 'submitted'|'under_review'|'approved'|'sent_back'|'rejected',
  sentBackFields: string[], reviewNotes: string[], rejectionReason|null,
  businessId|null, timeline: TimelineEvent[] }

BusinessType = 'garage_workshop'|'fleet_operator'|'dealer'|'parts_retailer'|'reseller'|'corporate'
```

Indexes: `number` unique; `{status, createdAt}`; `gstin`.

**Approval** (one transaction): create the `businesses` record, the owner's `businessUsers` record (status
`invited`, must set a password on first login), the credit account if credit is enabled at approval, and the garage
profile (status `not_live`) when the type is `garage_workshop`. Then audit it, and queue the welcome email through the
outbox.

### 4.9 `businesses` (businesses, `bus`)

```ts
{ name, type: BusinessType, gstin|null, pan|null, email, phone, registeredAddress: Address,
  location: { lat, lng }|null,
  branches: { _id 'brn', name, isMain, address: Address, gstin|null, contactName, contactPhone,
              location: { lat, lng }|null, active }[],                       // ≤ 50, exactly one isMain
  discountPercent: number (0–100, two decimals),                             // B2B price = B2C price − this %
  status: 'active'|'on_hold', holdReason|null,
  applicationId|null /* null for Kannali's own workshops, created by admin */, approvedAt, photos: { fileId, url }[] }
```

Indexes: `gstin` unique where not null; `{status, type}`; `name` text.

`on_hold` stops new orders, quotation acceptance and new bookings for that business. Existing records keep running.

### 4.10 `businessUsers` (businesses, `bur`)

```ts
{ businessId, name, email (unique), phone, passwordHash|null, roles: ('owner'|'manager'|'technician'|'spares'|'billing')[],
  branchId, status: 'invited'|'active'|'disabled', mustSetPassword, twoStepEnabled,
  failedSignIns, lockedUntil|null, lastActiveAt|null }
```

Indexes: `email` unique; `{businessId, status}`; `{businessId, branchId}`.

Rules: a business always has at least one active owner. Permissions come from `spareXB2B/src/features/auth/permissions.ts`.
Branch scope comes from `scopeToBranch`. B2B sign-in (Phase 4) follows the admin sign-in rules from Phase 1, against
this collection.

### 4.11 `creditAccounts` and `creditLedgerEntries` (credit)

```ts
creditAccounts (`cra`) {
  businessId (unique), enabled, status: 'active'|'on_hold'|'disabled', holdReason|null,
  limit, termsDays (default 30, Q-11),
  outstanding,        // invoiced and unpaid
  committed,          // credit orders placed but not yet invoiced
  enabledAt }

creditLedgerEntries (`cle`) {                          // append-only
  accountId, businessId, type: 'invoice'|'payment'|'credit_note'|'adjustment',
  amount,             // + increases what is owed, − reduces it
  balanceAfter, reference /* invoice, payment or credit note number */,
  invoiceId|null, paymentId|null, creditNoteId|null, orderId|null, dueOn|null, note|null, by: ActorRef, at }
```

Indexes: `creditLedgerEntries {accountId, at}`.

Rules:
- **Placing a credit order** reserves credit in one conditional update:
  `updateOne({ businessId, status: 'active', $expr: { $lte: [{ $add: ['$outstanding', '$committed', amount] }, '$limit'] } }, { $inc: { committed: amount } })`.
  No match means `422 CREDIT_LIMIT_EXCEEDED` or `CREDIT_ON_HOLD`.
- **Invoicing at dispatch** moves the amount from `committed` to `outstanding` and writes the `invoice` ledger
  entry, with `dueOn = invoice date + termsDays`.
- **Cancellation before dispatch** releases `committed`.
- **"Overdue"** is computed, not stored: unpaid invoices with `dueOn` before today. Overdue warns but doesn't block
  (Q-11). Only the limit and `on_hold` block.
- The displayed `status: 'overdue'` is derived from the above.

### 4.12 `orders` (orders, `ord`)

```ts
{
  number, channel: 'b2c'|'b2b',
  customerId|null, businessId|null, placedBy: ActorRef,       // exactly one of customerId / businessId
  branchId|null, poNumber|null, poDate|null, notes|null, quotationId|null,   // B2B
  vehicleId|null, couponCode|null,                                            // B2C
  buyerGstin|null,
  items: { _id 'oit', productId, name, sku, partNumber, brandName, hsnCode, imageUrl|null,
           quantity, mrp, listPrice /* B2C price */, unitPrice /* charged, incl GST */, gstRate,
           taxable, gst, total, returnedQuantity }[],
  totals: { mrp, itemsTotal, productDiscount, couponDiscount, businessSavings, deliveryCharge,
            taxable, gst, total },
  status: OrderStatus, cancellation: { reason, note|null, by: ActorRef, at }|null,
  payment: { mode: 'online'|'cod'|'bank_transfer'|'credit',
             status: 'pending'|'paid'|'failed'|'refunded'|'partially_refunded'|'cancelled',
             method: 'upi'|'card'|'netbanking'|'wallet'|'bank_transfer'|'cash'|'cod'|'credit'|null,
             paidAmount, refundedAmount, paidAt|null, failureReason|null },   // summary; `payments` is the record
  reservedUntil|null,                        // online B2C orders: stock is held until this time
  deliveryAddress: ContactAddress, billingAddress: ContactAddress,
  shipment: { courier, trackingNumber, shippedAt }|null, expectedDeliveryOn|null, deliveredAt|null,
  invoiceId|null, returnableUntil|null,
  timeline: TimelineEvent<OrderStatus>[]
}

OrderStatus = 'payment_pending'|'placed'|'confirmed'|'processing'|'packed'|'shipped'|'out_for_delivery'|'delivered'|'cancelled'
```

Indexes: `number` unique; `{customerId, createdAt: -1}`; `{businessId, createdAt: -1}`; `{status, createdAt: -1}`;
`{channel, createdAt: -1}`; `{'payment.status', 'payment.mode'}`; `{reservedUntil}` where status is
`payment_pending`.

### 4.13 `payments` and `refunds` (payments)

```ts
payments (`pay`) {                                  // append-only except status
  payerType: 'customer'|'business', payerId,
  purpose: 'order'|'credit_invoices'|'job_card',
  orderId|null, jobCardId|null,
  allocations: { invoiceId, amount }[],             // credit_invoices only
  amount, gateway: 'razorpay'|'fake'|'offline',
  method: 'upi'|'card'|'netbanking'|'wallet'|'bank_transfer'|'cash'|'cod'|'credit',
  status: 'created'|'awaiting_confirmation'|'successful'|'failed',
  gatewayOrderId|null, gatewayPaymentId|null, reference|null /* UTR, receipt */,
  failureReason|null, confirmedBy: ActorRef|null, confirmedAt|null }

refunds (`rfd`) { paymentId, orderId|null, returnId|null, amount, status: 'pending'|'processed'|'failed',
                  gatewayRefundId|null, reason, by: ActorRef, processedAt|null }
```

Indexes: `gatewayOrderId` unique where not null; `gatewayPaymentId` unique where not null; `{orderId}`;
`{payerType, payerId, createdAt: -1}`; `{status, method}` (the "to confirm" list).

Webhook idempotency: the unique `gatewayPaymentId` and the `status` check make a repeated webhook a no-op.

### 4.14 `invoices` and `creditNotes` (invoicing)

Kannali's own tax invoices for parts sales. Garage service invoices live on the job card (§4.16).

```ts
invoices (`inv`) {
  number, orderId, channel, buyer: { type, id, name, gstin|null, address: ContactAddress },
  seller: { legalName, gstin, address } /* copied from settings */,
  lines: { description, hsnCode, quantity, unitPrice, gstRate, taxable, cgst, sgst, igst, total }[],
  totals: { taxable, cgst, sgst, igst, total },
  issuedAt, dueOn|null /* credit only */, balance /* unpaid; 0 unless credit */, awaitingConfirmation,
  pdfFileId|null }

creditNotes (`crn`) {
  number, invoiceId, orderId, returnId|null, channel, buyer: { … as invoice },
  reason, lines: { … as invoice lines }[], totals: { … },
  appliedTo: 'refund'|'credit_ledger', issuedAt, issuedBy: ActorRef, pdfFileId|null }
```

Indexes: `number` unique on each; `{orderId}`; `{'buyer.id', issuedAt: -1}`; `{dueOn, balance}`.

GST split: CGST + SGST when the delivery state equals Kannali's state, otherwise IGST. This is one function in
`common/money.ts`, unit tested. The PDF is generated by an outbox job after the transaction commits.

### 4.15 `quotations` (orders, `quo`)

```ts
{ number, businessId, branchId, requestedBy: ActorRef,
  status: 'requested'|'quoted'|'accepted'|'rejected'|'expired',
  lines: { _id, productId, name, sku, partNumber, brandName, quantity, listPrice /* B2C, incl GST */,
           discountPercent, unitPrice /* quoted, incl GST */, gstRate, taxable, gst, total }[],
  extraDiscount, totals: { taxable, gst, total },
  customerNotes|null, kannaliNotes|null, attachments: { fileId, name, sizeBytes }[],
  validUntil: IsoDate|null /* quotedAt + settings.quotations.validityDays (7) */,
  revisions: { version, at, by: ActorRef, total, note }[], orderId|null,
  timeline: TimelineEvent[] }
```

Indexes: `number` unique; `{businessId, createdAt: -1}`; `{status, validUntil}`.

Accepting a quotation re-checks stock and creates the order at the quoted prices, in one transaction. A daily job
marks overdue `quoted` quotations `expired`.

### 4.16 `returns` (returns, `ret`)

```ts
{ number, kind: 'return'|'replacement', channel, orderId, orderNumber,
  customerId|null, businessId|null, branchId|null,
  items: { orderItemId, productId, name, sku, quantity, unitPrice, taxable, gst, total }[],
  reason: 'damaged'|'wrong_item'|'does_not_fit'|'defective'|'not_as_described'|'not_needed',
  customerNote, photos: { fileId, url }[],
  status: ReturnStatus, rejectionReason|null,
  pickup: { date: IsoDate, window, address: ContactAddress }|null,
  verification: { condition: 'unused'|'opened'|'used'|'damaged', notes, photos, by: ActorRef, at }|null,
  resolution: { type: 'refund'|'credit_note'|'replacement', amount, refundId|null, creditNoteId|null,
                replacementOrderId|null, at }|null,
  timeline: TimelineEvent<ReturnStatus>[] }

ReturnStatus = 'requested'|'approved'|'rejected'|'pickup_scheduled'|'picked_up'|'verified'
             | 'refunded'|'credit_note_issued'|'replacement_sent'|'closed'
```

Indexes: `number` unique; `{orderId}`; `{status, createdAt: -1}`.

Rules: a return can only be requested within `settings.orders.returnWindowDays` of delivery, and not for
non-returnable categories once opened (Q-12). Quantity can't exceed `orderItem.quantity − returnedQuantity`, and the
`returnedQuantity` increment is conditional. Every resolution issues a credit note. B2B credit customers get it
applied to the ledger; everyone else is refunded the way they paid (B2B rule).

### 4.17 `garages` and `payouts` (garages)

```ts
garages (`gar`) {
  businessId (unique), name, slug (unique), ownership: 'kannali'|'partner',
  status: 'live'|'not_live', liveSince|null,
  about, photos: { fileId, url }[], vehicleTypes: VehicleType[],
  openingHours: { day: Weekday, isOpen, opensAt, closesAt }[], holidays: { date, name }[],
  dailyBookingLimit,                               // per branch per day
  services: { serviceItemId, name, price /* excl GST */, gstRate, durationMinutes, active }[],
  pickAndDrop: boolean, invoicePrefix,             // e.g. "SSTW" → SSTW/26-27/0001
  ratingByBranch: { branchId, average, count }[], rating: { average, count } }

payouts (`pyo`) { number, garageId, jobCardIds: string[], paymentIds: string[], amount, platformFee,
                  reference /* bank UTR */, settledAt, by: ActorRef }        // behind garagePayouts (Q-09)
```

Indexes: `businessId` unique; `slug` unique; `{status, vehicleTypes}`; `payouts {garageId, settledAt: -1}`.

Rules: the garage's legal name, GSTIN and branch addresses come from its business, never copied here. Going live
requires a complete profile, at least one priced service, and opening hours (admin readiness check). Ratings are
recalculated when a review is published or hidden.

### 4.18 `bookings` (service, `bkg`)

```ts
{ number, customerId, vehicleId, vehicleLabel, registrationNumber|null,
  garageChoice: 'chosen'|'best',                                         // D-20
  garageId|null, branchId|null,                                          // set once a garage accepts
  offers: { garageId, branchId, offeredAt, expiresAt, response: 'pending'|'accepted'|'declined'|'expired', reason|null }[],
  packageId|null, services: { serviceItemId|null, packageId|null, name, price, gstRate }[],   // snapshot
  estimatedTotal, date: IsoDate, slot: { from, to }|null,                 // D-19
  pickAndDrop: { pickupAddress: ContactAddress, dropAddress: ContactAddress, staff: { userId, name, phone }|null }|null,
  customerNote, status: BookingStatus, declineReason|null, cancellation: { reason, by: ActorRef, at }|null,
  jobCardId|null, timeline: TimelineEvent<BookingStatus>[] }

BookingStatus = 'pending'|'accepted'|'declined'|'cancelled'|'in_progress'|'completed'
```

Indexes: `number` unique; `{customerId, createdAt: -1}`; `{garageId, branchId, date}`; `{status, 'offers.expiresAt'}`.

Rules:
- Nothing is paid at booking.
- With `chosen`, there is one offer. With `best`, the service ranks live garages (vehicle type, open that day,
  under the daily limit, distance, rating) and offers them in turn. A scheduled job expires offers and moves to the
  next garage. With no garage left, the booking is `declined`.
- **Accepting creates the job card** (status `confirmed`) in the same transaction.
- `in_progress` and `completed` follow the job card.

### 4.19 `jobCards` (service, `jcd`)

One per vehicle visit, run by the garage in B2B. Admin reads it; the customer sees a projection.

```ts
{ number, garageId, branchId, source: 'booking'|'walk_in', bookingId|null,
  customerId, vehicleId, vehicleLabel, registrationNumber|null,
  status: JobStatus, complaints: string[], scheduledAt|null, promisedAt|null,
  technician: { userId, name }|null,
  checkIn: { at, by: StaffRef, odometerKm, fuelLevel, damages: { _id, area, note, photos }[], complaints, photos }|null,
  inspection: { at, by: StaffRef, items: { _id, section, item, result: 'ok'|'attention'|'replace', note, photos }[] }|null,
  estimate: { lines: { _id, kind: 'labour'|'service'|'part'|'consumable', description, productId|null, partNumber|null,
                       quantity, unitPrice /* excl GST */, gstRate, taxable, gst, total,
                       approval: 'pending'|'approved'|'rejected', decidedAt|null, isExtra, isDone }[],
              sentAt|null, approvalNote|null, decidedAt|null, decidedBy: ActorRef|null },
  progress: { _id, at, by: StaffRef, text, photos, isExtraWork }[],
  qualityChecks: { at, by: StaffRef, result: 'pass'|'rework', items: { label, isOk }[], note|null }[],
  invoice: { number, issuedAt, seller: { legalName, gstin|null, address }, lines: [...approved lines],
             taxable, gst, total, pdfFileId|null }|null,
  payment: { status: 'unpaid'|'paid', method: 'online'|'at_garage'|'cash'|null, paymentId|null,
             amount, paidAt|null, receivedBy: StaffRef|null, reference|null, cashReceived|null },
  handover: { at, by: StaffRef, odometerKm, checklist: { label, isDone }[], photos }|null,
  nextService: { date|null, odometerKm|null }|null,
  payoutId|null,                                    // set when an online payment is settled to the garage
  timeline: TimelineEvent<JobStatus>[] }

JobStatus = 'booked'|'confirmed'|'vehicle_received'|'job_card_created'|'inspection'|'awaiting_approval'|'approved'
          | 'in_progress'|'quality_check'|'ready'|'payment_pending'|'paid'|'completed'|'closed'
```

`StaffRef = { userId, name }`.

Indexes: `number` unique; `{garageId, branchId, status}`; `{vehicleId, createdAt: -1}`; `{customerId, createdAt: -1}`;
`{'technician.userId', status}`.

Rules:
- Each action needs the matching B2B permission (`jobs:inspect`, `jobs:qa`, `jobs:billing`…) and is limited to
  the user's branch.
- The customer approves or rejects each line, on B2C or through staff ("By phone").
- **Rejecting every line closes the job** (`closed`), with no fee by default (Q-14).
- The invoice is built only from approved lines, **in the garage's name and GSTIN**, numbered from the garage's
  own counter, in one transaction with the status change.
- **Parts used from the SpareX catalogue don't touch Kannali stock.** Garages hold no stock module.

### 4.20 Marketing and content

```ts
banners      (`ban`) { title, subtitle, ctaLabel, linkUrl, placement: 'b2c_hero'|'b2c_dashboard_promo'|'b2b_offers'|'announcement_strip',
                       webImage: { fileId, url }|null, mobileImage: { fileId, url }|null, imageAlt,
                       startsAt, endsAt|null, sortOrder, active }
homeFeatures         { _id: 'b2c-home', categoryIds: string[], vehicleBrandIds: string[],
                       shelves: { _id, title, viewAllHref, productIds: string[] }[], updatedBy: ActorRef }   // single doc
contentPages (`pag`) { slug (unique), title, summary, kind: 'policy'|'help', sections: { _id, heading, paragraphs: string[] }[],
                       published, updatedBy: ActorRef }
faqs         (`faq`) { question, answer, category: 'orders'|'returns'|'payments'|'fitment'|'service'|'account', sortOrder, active }
coupons      (`cpn`) { code (unique, upper case), description, discountType: 'percentage'|'flat', value, maxDiscount|null,
                       scope: 'all'|'product'|'brand'|'category'|'first_order'|'b2b'|'garage'|'service_booking', scopeIds: string[],
                       minOrderValue, startsAt, endsAt|null, usageLimit|null, perCustomerLimit, usedCount, active }
couponRedemptions    { couponId, customerId|null, businessId|null, orderId, discount, at }
```

Indexes: `banners {placement, active, startsAt}`; `coupons code` unique; `couponRedemptions {couponId, customerId}`.

Coupon use is reserved with a conditional `$inc` on `usedCount` (below `usageLimit`) inside the order transaction.
The per-customer limit is checked by counting redemptions in the same transaction. Coupons are behind the `coupons`
switch (Q-06).

### 4.21 `reviews` (reviews, `rev`)

```ts
{ kind: 'garage'|'product', garageId|null, branchId|null, jobCardId|null, productId|null,
  customerId, customerName, vehicleName|null, rating: 1–5, title|null, comment,
  status: 'pending'|'published'|'hidden', hiddenReason|null }
```

Indexes: `{garageId, status, createdAt: -1}`; `{productId, status}`; unique `{jobCardId, customerId}` where
`jobCardId` is set (one review per visit).

Garage reviews are allowed only after the job card is `completed`, by that job's customer. Product reviews are behind
`productReviews` (Q-03).

### 4.22 Platform: `settings`, `notifications`, `outbox`

```ts
settings { _id: 'platform',
  business:  { legalName, gstin, state, registeredAddress: Address, invoiceNumberFormat, creditNoteNumberFormat,
               supportPhone, supportEmail },
  delivery:  { deliveryCharge, freeDeliveryAbove, serviceablePincodes: string[] /* empty = all */, codLimit, codFee },
  orders:    { returnWindowDays, nonReturnableCategoryIds: string[], paymentHoldMinutes /* 30 */ },
  quotations:{ validityDays },
  service:   { pickupWindows: { from, to }[], timeSlots: { from, to }[], inspectionFee, garageAcceptMinutes },
  switches:  { productReviews, productInstallation, bookingTimeSlots, coupons, b2cCashOnDelivery, garagePayouts },
  updatedBy: ActorRef }

notifications (`ntf`) { recipientType: 'customer'|'business_user'|'admin', recipientId, title, description, href,
                        tone: 'info'|'success'|'warning'|'danger', readAt|null }
outbox        (`obx`) { type /* 'sms' | 'email' | 'whatsapp' | 'invoice_pdf' | … */, payload, status: 'pending'|'done'|'failed',
                        attempts, nextAttemptAt, lastError|null }
```

Indexes: `notifications {recipientType, recipientId, createdAt: -1}`; `outbox {status, nextAttemptAt}`; a 90-day TTL
on `notifications` and on `outbox` rows that are `done`.

Settings is one document, cached in memory and reloaded on change. The frontends' feature switches (`features.ts` /
`config.ts`) read `switches` from a public endpoint once the backend is live. Every settings change is audited with
before and after values.

## 5. Allowed status moves

Each module keeps these as one table in code (`ALLOWED_MOVES`) with unit tests.

1. **Application:** submitted → under_review → approved | sent_back | rejected. sent_back → submitted (resubmitted).
2. **Order:**
   - payment_pending → placed (paid) | cancelled (payment expired or failed).
   - placed → confirmed → processing → packed → shipped → out_for_delivery → delivered.
   - Any state before shipped → cancelled.
3. **Payment:** created → successful | failed. Offline payments: awaiting_confirmation → successful | failed.
4. **Quotation:** requested → quoted (sent) → accepted | rejected | expired. quoted → quoted (revision).
5. **Return:**
   - requested → approved | rejected.
   - approved → pickup_scheduled → picked_up → verified → refunded | credit_note_issued | replacement_sent → closed.
   - verified → rejected (the item failed verification).
6. **Booking:**
   - pending → accepted | declined | cancelled.
   - accepted → in_progress → completed.
   - accepted | in_progress → cancelled, only before the vehicle is received.
7. **Job card:**
   - booked → confirmed → vehicle_received → job_card_created → inspection → awaiting_approval → approved
     → in_progress → quality_check → ready → payment_pending → paid → completed.
   - quality_check → in_progress (rework). in_progress → awaiting_approval (extra work).
   - awaiting_approval → closed (everything rejected).
   - Walk-ins start at vehicle_received.

## 6. Money flows (each one is a single transaction)

| Flow | Inside the transaction |
|---|---|
| Place B2C online order | Price lines from `products`; apply coupon (reserve use); `changeStock(−)` per line; create order `payment_pending` with `reservedUntil`; create `payments` (`created`) with the gateway order |
| Payment success (webhook or verified callback) | `payments` → successful (unique gateway id); order → `placed`, payment summary `paid`; outbox: confirmation SMS |
| Payment hold expires | Order → `cancelled`; `changeStock(+)` per line (`payment_expired`); release coupon use |
| Place B2C COD / B2B bank transfer / B2B online | As above, but COD and bank transfer go straight to `placed` with payment `pending` (an admin confirms later) |
| Place B2B credit order | Price with the business discount; `changeStock(−)`; reserve credit (`committed += total`); order `placed` |
| Accept quotation | Re-check stock; create the order at the quoted prices as above; quotation → `accepted` with `orderId` |
| Cancel before dispatch | Order → `cancelled`; `changeStock(+)`; release credit or coupon; create a refund for any paid amount |
| Dispatch (mark shipped) | Next invoice number; create `invoices`; credit: `committed → outstanding` + ledger `invoice` entry with due date; outbox: invoice PDF |
| Admin confirms offline payment | `payments` → successful; order or invoice balances; ledger `payment` entry (credit) |
| B2B pays credit invoices | `payments` with allocations (chosen invoices, else oldest first); invoice balances; `outstanding −=`; ledger `payment` entry |
| Return resolved | Next credit note number; `creditNotes`; refund (`refunds`) or ledger `credit_note` entry; `changeStock(+)` if restocked; `returnedQuantity +=` |
| Job card billed | Garage invoice number from the garage's counter; invoice on the job card; status → `payment_pending` |
| Job card paid online | `payments` (purpose `job_card`) → successful; job card → `paid` |
| Garage payout | `payouts` record; `payoutId` on every settled job card (conditional on it being null) |

## 7. What each phase builds from this file

| Phase | Collections |
|---|---|
| 2 | `counters` + `nextNumber`, masters (§4.3 incl. `servicePackages`), `products`, `stockMovements`, CSV import, `files` owner fields |
| 3 | `vehicles`, `enquiries`, `customers.hasAppAccount` |
| 4 | `businessApplications`, `businesses`, `businessUsers` (+ B2B auth), `garages` base profile (created on approval) |
| 5 | `orders`, `quotations`, `payments`, `refunds`, `settings` (delivery, quotations, switches), `couponRedemptions` reads |
| 6 | `creditAccounts`, `creditLedgerEntries`, `invoices`, `creditNotes`, `returns`, `outbox` (invoice PDF) |
| 7 | `garages` (full), `bookings`, `jobCards`, `payouts` |
| 8 | `banners`, `homeFeatures`, `contentPages`, `faqs`, `coupons`, `reviews` |
| 9 | `notifications`, the outbox senders, dashboards, reports (aggregations over the above), remaining `settings` |

## 8. Seed

Each phase extends `npm run seed` with its collections.
- **Data:** where the three frontends' demo data disagree, the admin mocks are the master set. The records the B2C
  and B2B demo users see are added on top, with the same ids, so their screens look complete.
- **Numbers:** human numbers follow §1, even where a mock used another format (numbers are display strings; no
  frontend parses them).
- **Counters** are seeded to continue after the highest seeded number.

## 9. For the lead: decisions to confirm

The defaults below are built in, so nothing waits on them.

| # | Question | Default built |
|---|---|---|
| D-19 | Do customers choose a **time slot** when booking, or only a date (plus a pickup window with pick and drop)? B2C and B2B screens have slots; the admin default (Q-20) was date only | Storage supports both; `bookingTimeSlots` switch **on**, to match the two built apps |
| D-20 | Can customers let **Kannali pick the garage** (offered to garages one after another), or only choose one themselves? | Both supported. Each garage gets **15 minutes** to accept (B2C's demo uses seconds, which garages can't meet) |
| D-21 | **Service prices:** admin-set packages at one price everywhere (B2C), garage-set prices (B2B, admin, Q-08), or both? | Both: packages at admin prices for booked work; garage prices for walk-ins and extra work |
| D-22 | Are **three-wheelers** (autos) in scope? B2B lists them; Q-02's default doesn't | Not a vehicle type until confirmed; adding one is a master record plus one enum value |
| D-23 | Is **GST charged on the delivery charge**? | Yes, as its own invoice line at 18% (SAC 9965) |
