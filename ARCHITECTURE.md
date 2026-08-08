# HisabKitab BillingPlatform — Architecture Overview

## 1. Multiple Tenants, One Database — Schema-Per-Tenant

Think of PostgreSQL as a filing cabinet. Each tenant gets their own drawer (called a **schema**). All drawers are in the same cabinet (`billing_db`), but they're completely separate:

```
billing_db
├── public schema          ← global: tenants table (slug, schemaName, plan, ownerPhone)
├── t_krishna_wholesale    ← Krishna's entire data: products, invoices, parties, staff…
├── t_glamour_salon        ← Glamour Salon's entire data
├── t_fresh_pharmacy       ← Fresh Pharmacy's entire data
└── t_ramesh_kirana        ← …and so on for every registered business
```

**How a request finds its tenant:** Every API request carries a JWT. The JWT contains `schemaName`. Middleware at `apps/api/src/middleware/auth.ts` decodes the token and calls `getTenantDb(schemaName)`, which returns a PrismaClient pointed at that schema. From that point on, every `req.db.product.findMany()` only sees that tenant's products — Prisma never needs a `WHERE tenantId = ?` filter because the schema itself is the boundary.

**Code:** `apps/api/src/lib/tenant-db.ts`
```ts
getTenantDb("t_krishna_wholesale")
  → PrismaClient with URL: postgres://…?schema=t_krishna_wholesale&connection_limit=1
  → cached in a Map so we reuse one connection pool per tenant
```

---

## 2. Different Domains — DOMAIN_REGISTRY

A "domain" is the business type: retail, pharmacy, restaurant, salon, wholesale, gym, coaching, etc. There are **27 domains** defined in one file:

**Code:** `packages/domain-registry/src/index.ts`

Each domain entry defines:

| Field | What it does |
|---|---|
| `productAttrsSchema` | Zod schema for domain-specific product fields (pharmacy has `saltComposition`, restaurant has `isVeg`, salon has `serviceDuration`) |
| `invoiceDataSchema` | Extra fields on an invoice (restaurant has `tableNumber`, pharmacy has `prescriptionNumber`) |
| `itemMetaSchema` | Per-line-item extras (pharmacy has `batchId`, `expiryDate`) |
| `features` | Boolean flags: `hasBatches`, `hasKOT`, `hasAppointments`, `hasUdhaar` — tells the UI what to show |
| `defaultDomainConfig` | Preset config stored in `branch.domainConfig` JSONB (pharmacy enforces FEFO, restaurant has table count) |

**Where domain type is stored:** In `branch.domainType` (a string like `"pharmacy"`). One branch = one business location.

All 27 domains:
`retail`, `restaurant`, `pharmacy`, `wholesale`, `salon`, `electronics`, `textile`, `hardware`, `jewellery`, `automobile`, `agri`, `catering`, `printing`, `hotel`, `coaching`, `laundry`, `petrol_pump`, `repair`, `tiffin`, `gym`, `diagnostic_lab`, `pest_control`, `photography`, `enterprise`, `clinic`, `sweet`, `optical`

---

## 3. Code Reuse — How the Same Routes Serve All Domains

**All domains share the same API routes.** The invoice route is the same for a pharmacy, a restaurant, and a kirana shop. Domain-specific behavior is injected through:

### a) `domainAttrs` JSONB column on `products`

Every product has a `domainAttrs` JSON column. A pharmacy product looks like:
```json
{ "saltComposition": "Paracetamol 500mg", "scheduleType": "OTC", "requiresPrescription": false }
```
A restaurant item looks like:
```json
{ "isVeg": true, "spiceLevel": "medium", "cuisineType": "North Indian" }
```
The API stores/returns this as raw JSON — validation happens via `DOMAIN_REGISTRY[domainType].productAttrsSchema.parse(domainAttrs)`.

### b) Invoice service — domain-aware logic

**Code:** `apps/api/src/services/invoice.service.ts`

The same `createInvoice()` function handles all domains. Domain-specific paths:
- Reads `branch.domainType` to pick the right Zod schema for validation
- Checks `features.hasBatches` → if true (pharmacy, wholesale), enforces batch/expiry tracking
- Checks `trackStock` per product → services/menu items skip stock deduction

### c) `extensionTables` — domain-specific tables exist only where needed

Pharmacy has `batches` and `pharmacy_prescriptions`. Restaurant has `kot_orders`, `restaurant_tables`. These tables exist in every schema (provision-schema creates them all), but a kirana shop simply never uses `kot_orders`.

---

## 4. New Tenant Onboarding — How a Schema Gets Created

When a business registers at `POST /api/tenants/register`:

1. **Validate** — phone, PIN, GSTIN checksum, domain type (`apps/api/src/routes/tenants.ts`)
2. **Create `tenants` row** in public schema (slug, schemaName, plan)
3. **`create_tenant_schema(schemaName)`** — PostgreSQL function in public schema creates ~24 base tables
4. **`provisionTenantSchema(schemaName)`** — our TS function runs all the DDL that Prisma migrations added to existing tenants: adds 25 missing tables, 94 missing columns, and recreates `invoice_sequences` with correct snake_case columns (`apps/api/src/lib/provision-schema.ts`)
5. **Create branch + owner user** inside the new schema via `getTenantDb(schemaName)`
6. **Seed `invoice_sequences`** — so invoice numbering works on first sale

### Why provision-schema.ts exists

`create_tenant_schema()` is a static PostgreSQL function written once and never updated. As the product grew, Prisma migrations added new tables and columns to existing tenant schemas, but `create_tenant_schema()` stayed behind. `provision-schema.ts` bridges that gap — it's run once per new tenant right after `create_tenant_schema()` completes.

---

## 5. Performance Architecture

### Connection pooling

Each PrismaClient instance has `connection_limit=1`. With 27+ tenant schemas active simultaneously, this keeps total Postgres connections well under the 100-connection default limit. Without this, parallel operations exhaust connections and crash.

**Code:** `apps/api/src/lib/tenant-db.ts` line ~31

### Client caching

`getTenantDb()` caches clients in a `Map<string, PrismaClient>`. First request for a tenant opens a connection; every subsequent request reuses it. No connection overhead per request.

### Sequential invoice numbering — advisory locks

**Code:** `apps/api/src/lib/invoice-number.ts`

Uses `pg_advisory_xact_lock` + `UPDATE invoice_sequences ... RETURNING current_val` inside a transaction. This prevents two simultaneous invoices from getting the same number — no app-level locking needed, Postgres handles it atomically.

### Schema isolation = no cross-tenant query pollution

Because data lives in separate schemas, every query automatically scopes to the right tenant. No `WHERE tenant_id = ?` in every query, no risk of data leaks from missing filters.

---

## 6. Complete File Map

```
billingPlatform/billing-platform/
│
├── packages/
│   ├── domain-registry/src/index.ts   ← 27 domains, Zod schemas, feature flags
│   ├── db/src/index.ts                ← shared PrismaClient for public schema (tenants table)
│   └── types/                         ← shared TypeScript types
│
├── apps/api/src/
│   ├── index.ts                       ← Fastify server startup, plugin registration
│   ├── middleware/
│   │   └── auth.ts                    ← JWT decode → req.db = getTenantDb(schemaName)
│   ├── lib/
│   │   ├── tenant-db.ts               ← getTenantDb() factory + connection cache
│   │   ├── provision-schema.ts        ← DDL migration for new tenant schemas
│   │   ├── invoice-number.ts          ← sequential invoice numbers via advisory lock
│   │   └── password.ts                ← PIN hash/verify
│   ├── routes/
│   │   ├── tenants.ts                 ← /register, /check-phone, /domains
│   │   ├── auth.ts                    ← /login → JWT
│   │   ├── invoices.ts                ← create/list/get invoices
│   │   ├── products.ts                ← CRUD products + domainAttrs
│   │   ├── parties.ts                 ← customers/suppliers
│   │   ├── stock.ts                   ← stock levels, adjustments, expiry alerts
│   │   ├── inventory/
│   │   │   ├── suppliers.ts           ← /api/inventory/suppliers
│   │   │   └── purchase-orders.ts     ← /api/inventory/purchase-orders
│   │   ├── expenses.ts                ← expense tracking
│   │   ├── analytics.ts               ← dashboard charts, GST summary, P&L
│   │   └── ai.ts                      ← reorder suggestions
│   ├── services/
│   │   ├── invoice.service.ts         ← core billing logic (stock check, GST calc, domain validation)
│   │   └── ai/insights.ts             ← AI reorder suggestions
│   └── __tests__/
│       ├── tenant-onboarding.test.ts  ← 34 tests: registration + invoicing per domain
│       └── inventory-domains.test.ts  ← 45 tests: products, stock, POs across domains
│
└── apps/web/src/
    ├── pages/
    │   ├── CreateInvoicePage.tsx
    │   ├── DashboardPage.tsx
    │   ├── ReportsPage.tsx
    │   └── ExpensePage.tsx
    └── components/
```

---

## 7. One-Line Summary

> One Postgres database, one schema per tenant (data isolation), one `DOMAIN_REGISTRY` (behavior customization), one set of shared routes (code reuse), and one cached PrismaClient per schema (performance). Domain-specific data lives in `domainAttrs` JSONB — no separate tables per domain type.
