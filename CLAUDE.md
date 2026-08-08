# Hotel Platform — CLAUDE.md

Complete reference for AI-assisted development on this codebase.
Read this before making any changes.

---

## What this project is

A **multi-tenant hotel management + billing backend** extracted from the HisabKitab billing platform.
One deployment serves many hotels (tenants). Each hotel gets its own PostgreSQL schema (`t_<slug>`)
with physically isolated data — no row-level security, no shared tables for business data.

**Stack:**
- Runtime: Node.js 22, TypeScript (ESM)
- Framework: Fastify 4
- ORM: Prisma 5 (public schema) + `$queryRawUnsafe` (per-tenant hotel tables)
- DB: PostgreSQL 16
- Cache / queues: Redis 7 + BullMQ
- Auth: JWT (access token 15 min) + refresh tokens (server-side table)
- Validation: Zod (all inputs) — ZodError → 422 via global error handler
- Payments: Razorpay
- AI: Anthropic Claude / OpenAI (optional)
- Package manager: pnpm 9 (workspaces)
- Build: Turborepo

---

## Repository layout

```
hotelPlatform/
├── apps/
│   ├── api/                     ← main backend (this is where almost all work happens)
│   │   ├── src/
│   │   │   ├── server.ts        ← Fastify app bootstrap, all route registrations
│   │   │   ├── routes/          ← one file per feature area
│   │   │   │   ├── hotel.ts     ← ★ hotel-specific: rooms, bookings, housekeeping, folio
│   │   │   │   ├── invoices.ts  ← invoice create/update/credit-note
│   │   │   │   ├── payments.ts  ← receipts, party ledger
│   │   │   │   ├── parties.ts   ← guests / companies / suppliers
│   │   │   │   ├── products.ts  ← room types, F&B items, services
│   │   │   │   ├── reports.ts   ← GSTR-1, profit & loss, balance sheet
│   │   │   │   ├── analytics.ts ← dashboard stats, charts
│   │   │   │   ├── auth.ts      ← login, register, refresh, logout
│   │   │   │   ├── tenants.ts   ← tenant onboarding + branch setup
│   │   │   │   ├── branches.ts  ← branch CRUD
│   │   │   │   ├── users.ts     ← staff user management
│   │   │   │   ├── staff.ts     ← staff profiles, shifts, attendance
│   │   │   │   ├── expenses.ts  ← hotel expenses
│   │   │   │   ├── inventory.ts ← stock management
│   │   │   │   ├── stock.ts     ← stock adjustments
│   │   │   │   ├── notifications.ts
│   │   │   │   ├── categories.ts, brands.ts, gallery.ts
│   │   │   │   ├── discount-rules.ts
│   │   │   │   ├── webhooks.ts  ← Razorpay HMAC webhooks
│   │   │   │   └── ai.ts        ← AI suggestions
│   │   │   ├── middleware/
│   │   │   │   ├── tenant.ts    ← JWT verify → attach req.db, req.schemaName, req.branchId
│   │   │   │   └── error.ts     ← ZodError→422, Prisma→409/404, JWT→401
│   │   │   ├── lib/
│   │   │   │   ├── provision-schema.ts  ← creates hotel_* tables for new tenants
│   │   │   │   ├── tenant-db.ts         ← per-tenant Prisma client cache
│   │   │   │   ├── invoice-number.ts    ← sequential invoice numbering
│   │   │   │   ├── idempotency.ts       ← idempotency key dedup
│   │   │   │   ├── redis.ts, queues.ts
│   │   │   │   └── password.ts, razorpay.ts
│   │   │   ├── services/
│   │   │   │   ├── invoice.service.ts   ← createInvoice, domain validation
│   │   │   │   ├── party.service.ts     ← party ledger / balance
│   │   │   │   └── product.service.ts
│   │   │   └── __tests__/
│   │   │       ├── hotel.test.ts        ← ★ main hotel test suite (1260 lines)
│   │   │       └── *.test.ts            ← shared infrastructure tests
│   │   ├── .env                 ← local secrets (never commit)
│   │   └── jest.config.cjs
│   ├── web/                     ← frontend (React/Vite — not modified in this extract)
│   └── mobile/                  ← mobile app (not modified)
├── packages/
│   ├── db/                      ← Prisma schema + migrations (public schema only)
│   ├── domain-registry/         ← Zod schemas for all domains incl. hotel invoice data
│   ├── gst-engine/              ← GST calculation logic
│   ├── shared/                  ← shared TypeScript types
│   └── pdf/                     ← PDF generation
├── docker/
│   └── docker-compose.yml       ← postgres:5432, redis:6379, pgadmin:5050
└── CLAUDE.md                    ← this file
```

---

## Multi-tenancy model

```
PostgreSQL
├── public schema              ← Prisma manages this
│   ├── tenants                ← one row per hotel group
│   ├── branches               ← one row per hotel property
│   ├── users
│   ├── refresh_tokens
│   └── idempotency_keys
└── t_<slug> schema            ← one per tenant, created by provisionTenantSchema()
    ├── products               ← room types, F&B items, services
    ├── parties                ← guests, companies, suppliers
    ├── invoices + invoice_items
    ├── payments
    ├── hotel_rooms            ← ★ hotel extension table
    ├── hotel_bookings         ← ★ hotel extension table
    ├── hotel_folio_charges    ← ★ hotel extension table
    ├── hotel_housekeeping     ← ★ hotel extension table
    └── ... (expenses, staff, inventory, etc.)
```

**Rule:** Every route accesses the tenant schema via `req.db` (Prisma client pre-scoped to
`search_path = t_<slug>`) or via `req.db.$queryRawUnsafe()` for hotel extension tables.
Never use the global `db` from `@billing/db` in route handlers — that hits the public schema.

**`req` context fields set by `tenantMiddleware`:**
```typescript
req.tenantId    // UUID of the tenant
req.schemaName  // e.g. "t_sunrise_hotel"
req.branchId    // UUID of the branch (from JWT)
req.userId      // UUID of the logged-in user
req.role        // 'owner' | 'manager' | 'cashier' | 'viewer'
req.db          // PrismaClient scoped to this tenant's schema
```

---

## Hotel domain — tables & fields

### `hotel_rooms`
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| branchId | UUID | |
| roomNo | TEXT | e.g. "101", "2A" |
| roomType | TEXT | standard / deluxe / suite / villa |
| floor | TEXT | |
| bedType | TEXT | single / double / twin / king |
| maxOccupancy | INT | |
| ratePerNight | DECIMAL | |
| weekendRate | DECIMAL | optional override |
| hasAc, hasTv, hasGeyser, hasWifi | BOOL | amenity flags |
| viewType | TEXT | pool / garden / sea / city |
| amenities | TEXT[] | extra amenities list |
| status | TEXT | `available` / `occupied` / `dirty` / `maintenance` / `blocked` |
| isActive | BOOL | soft-delete flag |

### `hotel_bookings`
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| folioNo | TEXT | auto-generated e.g. `FLO-2608-4521` |
| roomId | UUID FK → hotel_rooms | |
| guestName | TEXT | required |
| guestPhone / guestEmail | TEXT | |
| nationality | TEXT | default 'Indian' |
| idType / idNumber | TEXT | for Form-C |
| adults / children | INT | |
| checkIn / checkOut | TIMESTAMPTZ | planned dates |
| actualCheckIn / actualCheckOut | TIMESTAMPTZ | real timestamps |
| bookingSource | TEXT | walk_in / ota / phone / website / agent |
| mealPlan | TEXT | EP / CP / MAP / AP |
| advancePaid | DECIMAL | |
| ratePerNight / totalAmount | DECIMAL | |
| status | TEXT | `reserved` → `checked_in` → `checked_out` / `cancelled` / `no_show` |
| formCFiled | BOOL | foreign national C-form |
| partyId | UUID | links to parties table (for invoicing) |
| invoiceId | UUID | links to invoices table after checkout |

### `hotel_folio_charges`
| Column | Type | Notes |
|---|---|---|
| bookingId | UUID | |
| chargeType | TEXT | room / food / laundry / minibar / spa / transport / telephone / other |
| description | TEXT | |
| qty / rate / amount | DECIMAL | |
| gstRate | DECIMAL | GST % on this charge |
| date | DATE | |

### `hotel_housekeeping`
| Column | Type | Notes |
|---|---|---|
| roomId | UUID | |
| bookingId | UUID | optional — set for in-stay cleans |
| taskType | TEXT | checkout_clean / stay_clean / deep_clean / maintenance / turndown |
| status | TEXT | `pending` → `in_progress` → `done` / `skipped` |
| priority | TEXT | low / normal / high / urgent |
| assignedTo | TEXT | staff name |
| scheduledFor | DATE | |
| completedAt | TIMESTAMPTZ | |

---

## Hotel API endpoints

All endpoints require JWT (`Authorization: Bearer <token>`).
All are under prefix `/api/hotel`.

```
GET    /api/hotel/dashboard          — occupancy stats, today's arrivals/departures, revenue
GET    /api/hotel/availability        — available rooms for a date range

Rooms
GET    /api/hotel/rooms               — list all rooms (filter: status, roomType, floor)
POST   /api/hotel/rooms               — create room
GET    /api/hotel/rooms/:id           — get single room with active booking
PATCH  /api/hotel/rooms/:id           — update room (rate, status, amenities, etc.)
DELETE /api/hotel/rooms/:id           — soft-delete (sets isActive=false)

Bookings
GET    /api/hotel/bookings            — list bookings (filter: status, date range, roomId)
POST   /api/hotel/bookings            — create booking (status starts as 'reserved')
GET    /api/hotel/bookings/:id        — get booking with room + folio charges
PATCH  /api/hotel/bookings/:id        — update booking details
POST   /api/hotel/bookings/:id/checkin   — check in guest (status → 'checked_in', roomstatus → 'occupied')
POST   /api/hotel/bookings/:id/checkout  — check out (status → 'checked_out', creates invoice, clears room)
POST   /api/hotel/bookings/:id/charges   — add folio charge (food, laundry, minibar, etc.)
DELETE /api/hotel/bookings/:id/charges/:chargeId — remove a folio charge

Housekeeping
GET    /api/hotel/housekeeping        — list tasks (filter: date, status, roomId)
POST   /api/hotel/housekeeping        — create housekeeping task
PATCH  /api/hotel/housekeeping/:id    — update task status / assign staff

Operations
POST   /api/hotel/night-audit         — run night audit (generate stay charges, advance dates)
```

**Other routes used by hotel workflows:**

| Operation | Endpoint |
|---|---|
| Register hotel / login | `POST /api/auth/register`, `POST /api/auth/login` |
| Create guest as party | `POST /api/parties` |
| Add room as product | `POST /api/products` |
| Create/view invoice | `POST /api/invoices`, `GET /api/invoices/:id` |
| Record payment | `POST /api/payments` |
| GST reports | `GET /api/reports/gstr1`, `GET /api/reports/gst-summary` |
| Revenue analytics | `GET /api/analytics/revenue`, `GET /api/analytics/dashboard` |

---

## Invoice domain data for hotel

When creating an invoice for a hotel tenant, pass `domainData` with hotel-specific fields
(validated against `HotelInvoiceData` in `packages/domain-registry/src/index.ts`):

```typescript
{
  booking_ref:      string   // optional — links to hotel_bookings.folioNo
  room_no:          string   // optional
  meal_plan:        'EP' | 'CP' | 'MAP' | 'AP'  // optional
  check_in_date:    string   // optional ISO date
  check_out_date:   string   // optional ISO date
  nights:           number   // optional
  guests:           number   // optional
  advance_paid:     number   // deducted from total, default 0
}
```

---

## How checkout generates an invoice

`POST /api/hotel/bookings/:id/checkout` does the following in sequence:
1. Validates booking is in `checked_in` status
2. Sets `actualCheckOut`, status → `checked_out`
3. Sets room status → `dirty` (triggers housekeeping task)
4. Reads all `hotel_folio_charges` for the booking
5. Calls `POST /api/invoices` internally (via `invoice.service.ts`) with all charges as line items
6. Sets `hotel_bookings.invoiceId` to the created invoice
7. Returns the booking with the invoice attached

---

## How to run locally

### 1. Start infrastructure
```bash
cd docker
docker compose up -d postgres redis
```

### 2. Set up environment
```bash
cp apps/api/.env.example apps/api/.env
# Edit .env — minimum required:
#   DATABASE_URL=postgresql://billing_app:localdev123@localhost:5432/billing_db
#   REDIS_URL=redis://localhost:6379
#   JWT_SECRET=<any 64-char random string>
```

### 3. Run DB migrations + seed
```bash
pnpm db:migrate      # runs prisma migrate dev
pnpm db:seed         # creates demo hotel tenant + admin user
```

### 4. Start API server
```bash
pnpm --filter @hotel/api dev
# Server starts on http://localhost:3000
# Health check: GET http://localhost:3000/health
```

### 5. Verify
```bash
curl http://localhost:3000/health
# {"status":"ok","timestamp":"...","version":"0.0.1"}
```

---

## Running tests

```bash
# All tests (sequential, avoids DB connection exhaustion)
pnpm --filter @hotel/api test -- --runInBand

# Hotel-specific tests only
pnpm --filter @hotel/api test -- --testPathPattern=hotel --runInBand

# With verbose output
pnpm --filter @hotel/api test -- --runInBand --verbose
```

**Test setup:** `global-setup.ts` starts the server, cleans up test tenant schemas from
previous runs (schemas with phones starting with 7 or 8), then repriovisions seeded tenants.

---

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `REDIS_URL` | ✅ | Redis connection string |
| `JWT_SECRET` | ✅ prod | 64-char random hex — falls back to insecure default in dev |
| `JWT_EXPIRES_IN` | — | Access token TTL, default `15m` |
| `PORT` | — | Server port, default `3000` |
| `WEB_URL` | — | Frontend origin for CORS, default `http://localhost:5173` |
| `NODE_ENV` | — | `development` / `production` |
| `ANTHROPIC_API_KEY` | — | Claude AI (optional — for AI suggestions feature) |
| `OPENAI_API_KEY` | — | OpenAI fallback (optional) |
| `RAZORPAY_KEY_ID` | — | Razorpay payments (optional) |
| `RAZORPAY_KEY_SECRET` | — | Razorpay payments (optional) |
| `RAZORPAY_WEBHOOK_SECRET` | — | Razorpay webhook HMAC verification |
| `WHATSAPP_TOKEN` | — | WhatsApp Business API (optional) |
| `WHATSAPP_PHONE_NUMBER_ID` | — | WhatsApp Business API (optional) |
| `STORAGE_TYPE` | — | `local` (default) or `azure` |

---

## Key patterns to follow

### Adding a new hotel endpoint
1. Add route in `apps/api/src/routes/hotel.ts`
2. Use `tbl(req.schemaName, 'hotel_<table>')` for raw SQL queries
3. Always filter by `"branchId" = $N::uuid` to enforce tenant isolation
4. Validate all input with Zod — throw naturally and the error handler returns 422
5. Register nothing in `server.ts` — `hotelRoutes` is already registered at `/api/hotel`

### Adding a new hotel table
1. Add `CREATE TABLE IF NOT EXISTS` block in `lib/provision-schema.ts` inside `provisionTenantSchema()`
2. Follow the existing pattern: all columns quoted, UUID PKs with `gen_random_uuid()`, `branchId UUID NOT NULL`
3. The table is created automatically for new tenants and on `POST /api/admin/reprovision-all`

### Raw SQL pattern (hotel tables are not in Prisma schema)
```typescript
// Always use parameterised queries — never string-interpolate user input
const rows = await req.db.$queryRawUnsafe<MyType[]>(
  `SELECT * FROM ${tbl(req.schemaName, 'hotel_rooms')}
   WHERE "branchId" = $1::uuid AND status = $2`,
  req.branchId,
  'available',
)
```

### Error throwing pattern
```typescript
// Fastify catches these and returns the statusCode
if (!booking) throw Object.assign(new Error('Booking not found'), { statusCode: 404 })
if (booking.status === 'checked_out') throw Object.assign(new Error('Already checked out'), { statusCode: 409 })
```

### Zod validation pattern
```typescript
const body = z.object({
  roomId:    z.string().uuid(),
  guestName: z.string().min(1).max(100),
  checkIn:   z.string().datetime(),
  adults:    z.number().int().min(1).default(1),
}).parse(req.body)
// ZodError is caught globally → 422 with field-level detail
```

---

## Tenant onboarding flow

```
POST /api/tenants/register
  { businessName, ownerName, phone, password, domainType: 'hotel' }
  → Creates tenant row in public.tenants
  → Creates branch row in public.branches
  → Calls provisionTenantSchema() — creates all hotel_* tables in t_<slug> schema
  → Returns JWT for the owner user

POST /api/auth/login
  { phone, password }
  → Returns { accessToken, refreshToken }
  → All subsequent requests: Authorization: Bearer <accessToken>

POST /api/auth/refresh
  { refreshToken }
  → Returns new accessToken (rotate refresh token)
```

---

## Packages in this monorepo

| Package | Purpose |
|---|---|
| `@billing/db` | Prisma client + public schema migrations. Import `{ db }` for public schema operations only. |
| `@billing/domain-registry` | Zod schemas for hotel invoice data (`HotelInvoiceData`), product attributes, item meta. |
| `@billing/gst-engine` | GST rate calculation, CGST/SGST/IGST split, GST number validation. |
| `@billing/shared` | Shared TypeScript types used across API, web, and mobile. |
| `@billing/pdf` | PDF generation for invoices and folios. |

---

## Docker services

| Service | Port | Credentials |
|---|---|---|
| PostgreSQL | 5432 | user: `billing_app`, pass: `localdev123`, db: `billing_db` |
| Redis | 6379 | no auth |
| pgAdmin | 5050 | dev@local.com / admin |
| Redis Commander | 8081 | no auth |

---

## Common commands

```bash
# Dev
pnpm --filter @hotel/api dev          # start API with hot reload
pnpm db:studio                        # open Prisma Studio (public schema browser)
pnpm db:seed                          # re-seed demo data

# Database
pnpm db:migrate                       # run pending Prisma migrations
pnpm db:reset                         # wipe and re-migrate (dev only)

# Tests
pnpm --filter @hotel/api test -- --runInBand                    # all tests
pnpm --filter @hotel/api test -- --testPathPattern=hotel        # hotel tests only

# Type-check
pnpm --filter @hotel/api typecheck

# Build
pnpm --filter @hotel/api build        # compile to dist/
```

---

## What was removed from the original billing-platform

This repo is a focused extract. The following domains were removed because they have no relation
to hotel operations:

- Restaurant / KOT system
- Gym memberships
- Diagnostic lab reports
- Service visits (pest control, maintenance)
- Nozzle readings (petrol pump)
- Job cards (automobile workshop)
- Serial number tracking
- Tiffin subscriptions + deliveries
- Coaching / tuition
- Robotics billing
- Clinic / OPD
- Contracts
- GRN (Goods Receipt Notes)
- Broadcast messaging

The domain-registry package still contains schemas for all these domains — that is harmless.
Only the API routes and tests were removed.
