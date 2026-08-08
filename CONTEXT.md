# HisabKitab Billing Platform — Developer Context

## Project Structure

**Monorepo root**: `E:\HisabKitab\billingPlatform\billing-platform`

```
billing-platform/
├── apps/
│   ├── api/          Fastify v4, TypeScript ESM
│   └── web/          React 19 + Vite 5 + TailwindCSS 3 + TanStack Query v5
├── packages/
│   └── db/           Prisma 5 + PostgreSQL 16
└── scripts/
    └── setup-db.mjs  Re-applies custom SQL after prisma reset
```

---

## Tech Stack

| Layer     | Technology                                      |
|-----------|-------------------------------------------------|
| API       | Fastify v4, TypeScript ESM, tsx watch           |
| Frontend  | React 19, Vite 5, TailwindCSS 3, TanStack Query v5, recharts |
| Database  | PostgreSQL 16, Prisma 5                         |
| Auth      | JWT access tokens + rotating refresh tokens (SHA-256 hashed, stored in DB) |
| GST API   | GSTZen (`GSTZEN_API_KEY` in `apps/api/.env`)   |

---

## Starting the Servers

```bash
# Terminal 1 — API server (auto-reloads on file save)
cd E:\HisabKitab\billingPlatform\billing-platform\apps\api
pnpm dev

# Terminal 2 — Web (Vite HMR)
cd E:\HisabKitab\billingPlatform\billing-platform\apps\web
pnpm dev
```

Web runs at: http://localhost:5173
API runs at: http://localhost:3000

---

## Database Scripts

All DB scripts run from `packages/db/`:

```bash
cd E:\HisabKitab\billingPlatform\billing-platform\packages\db

pnpm reset    # prisma migrate reset --force  (WIPES everything)
pnpm seed     # tsx prisma/seed.ts  (loads test data)
```

After `pnpm reset`, custom SQL must be re-applied BEFORE seeding:

```bash
# From monorepo root — auto-loads DATABASE_URL from apps/api/.env
cd E:\HisabKitab\billingPlatform\billing-platform
node scripts/setup-db.mjs
```

**Full reset sequence:**
```bash
cd E:\HisabKitab\billingPlatform\billing-platform\packages\db && pnpm reset
cd E:\HisabKitab\billingPlatform\billing-platform && node scripts/setup-db.mjs
cd E:\HisabKitab\billingPlatform\billing-platform\packages\db && pnpm seed
```

---

## Login Credentials (after seed)

| Role               | Phone        | PIN  |
|--------------------|--------------|------|
| Kirana owner       | 9876543210   | 1111 |
| Kirana cashier     | 9876500001   | 2222 |
| Restaurant owner   | 9898765432   | 3333 |
| Pharmacy owner     | 9925123456   | 4444 |
| Electronics owner  | 9933445566   | 7777 |
| Enterprise owner   | 9911223344   | 5555 |
| Enterprise manager | 9911223355   | 6666 |

---

## Critical DB Conventions

Prisma schema uses **camelCase column names** with no `@map` — so all raw SQL must quote them:

```sql
-- WRONG              CORRECT
tenant_id        →   "tenantId"
branch_id        →   "branchId"
grand_total      →   "grandTotal"
txn_type         →   "txnType"
is_active        →   "isActive"
name_local       →   "nameLocal"
hsn_sac_code     →   "hsnSacCode"
gst_rate         →   "gstRate"
date             →   "date"    ← PostgreSQL reserved word, must always be quoted
```

---

## Row Level Security (RLS)

Most tables have RLS enforced. The middleware sets a PostgreSQL session variable before each request:

```sql
set_config('app.tenant_id', '<uuid>', true)   -- LOCAL = transaction-scoped
```

The `current_tenant_id()` function reads:
```sql
NULLIF(current_setting('app.tenant_id', true), '')
```

**`refresh_tokens` is intentionally RLS-free** — token hash is the cryptographic auth (SHA-256); requiring tenant context for lookup creates a chicken-and-egg problem (need token to find tenant, need tenant to read token).

---

## Environment Variables (`apps/api/.env`)

```env
DATABASE_URL=postgresql://billing_app:localdev123@localhost:5432/billing_db
JWT_SECRET=<set>
REFRESH_TOKEN_SECRET=<set>
GSTZEN_API_KEY=8bce4a0f-8af4-4a3f-8597-90af3a2f3ddc
ANTHROPIC_API_KEY=<placeholder — AI HSN suggestions won't work>
RAZORPAY_KEY_ID=<placeholder — payment gateway won't work>
RAZORPAY_KEY_SECRET=<placeholder>
```

---

## What's Implemented

### Backend (`apps/api/src/`)

| Route | File | Notes |
|-------|------|-------|
| `GET /api/invoices/summary/weekly` | `routes/invoices.ts` | 7-day sales data for bar chart |
| `GET /api/tenants/gstin/:gstin` | `routes/tenants.ts` | GSTZen GSTIN lookup (public route) |
| `GET /api/products/low-stock` | `routes/products.ts` | Uses `getLowStockAlerts` from product.service |
| `GET /api/products/categories` | `routes/products.ts` | Raw SQL with quoted `"tenantId"` |

**Services fixed for camelCase raw SQL:**
- `apps/api/src/services/product.service.ts` — `getBatchStockBalances`, `searchProducts` Mode 2
- `apps/api/src/services/gstin.service.ts` — GSTZen API integration (created)

**Custom SQL files** (`apps/api/src/lib/`):
- `refresh-tokens.sql` — creates `refresh_tokens` table, NO RLS (intentional)
- `invoice-sequences.sql` — invoice number sequences
- `idempotency.sql` — idempotency keys table
- `ai-suggestions.sql` — AI suggestion cache
- `razorpay-orders.sql` — Razorpay order tracking

### Frontend (`apps/web/src/`)

| File | Purpose |
|------|---------|
| `components/charts/RevenueBarChart.tsx` | recharts bar chart, last 7 days revenue |
| `components/gstin/GSTINLookup.tsx` | GSTIN lookup widget with validation |
| `pages/DashboardPage.tsx` | Added revenue chart + GSTIN lookup sections |
| `hooks/useApi.ts` | Added `useWeeklySummary()`, `useGstinLookup(gstin)` |
| `lib/api.ts` | Added `invoiceApi.weeklySummary()`, `tenantApi.gstinLookup()` |

### Seed Data (`packages/db/prisma/seed.ts`)

- 10 products (3 intentionally low-stock: Parle-G qty=7/low=15, Surf Excel qty=3/low=10, Colgate qty=4/low=8)
- 7 parties: Mukesh Sharma, Metro C&C (supplier), Kishore Mehta, Anita Verma, Jayesh Patel, Bhavesh Distributors, Sunita Desai
- 14 invoices spread across 7 days (2/day), statuses: paid/partial/confirmed
- Stock ledger entries for all sold items
- Payment + PaymentAllocation records for paid/partial invoices

---

## Known Pending Issues

| Issue | File | Status |
|-------|------|--------|
| `ANTHROPIC_API_KEY` is placeholder | `apps/api/.env` | AI HSN suggestion non-functional |
| Razorpay keys are placeholders | `apps/api/.env` | Payment gateway non-functional |
| Background workers not started | `apps/api/src/workers/index.ts` | Scheduled jobs don't run |
| Other service files may have snake_case raw SQL | `party.service.ts`, `invoice.service.ts` | Will 500 when those routes are hit — fix same way as `product.service.ts` |

---

## Common Debugging Tips

**API returns 500 on a route?**
→ Check if raw SQL in the service uses snake_case column names. Fix: quote to camelCase (`"tenantId"`, etc.)

**Login fails with "Invalid phone number or PIN"?**
→ Most likely `refresh_tokens` table was re-created with RLS (from an old SQL file). Run the full reset sequence above — the fixed `refresh-tokens.sql` has no RLS.

**`pnpm --filter` says unknown option?**
→ Use `cd apps/api && pnpm dev` instead of `pnpm --filter @billing/api dev`

**`setup-db.mjs` fails with no DATABASE_URL?**
→ It now auto-reads `apps/api/.env`. If still failing, check that `apps/api/.env` exists and has `DATABASE_URL`.
