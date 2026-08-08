# Domain Attributes Architecture

## How Staff, Invoice, and Product Attributes Are Handled

---

## Request Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    REQUEST ARRIVES                               │
│         JWT → branchId → branch.domainType = "pharmacy"         │
└──────────────────────┬──────────────────────────────────────────┘
                       │
          ┌────────────▼────────────┐
          │     DOMAIN_REGISTRY     │
          │  ["pharmacy"] = {       │
          │    features: {...}      │
          │    productAttrsSchema   │
          │    invoiceDataSchema    │
          │    defaultDomainConfig  │
          │  }                      │
          └────────────┬────────────┘
                       │
        ┌──────────────┼──────────────┐
        │              │              │
        ▼              ▼              ▼
  ┌───────────┐  ┌───────────┐  ┌───────────┐
  │   STAFF   │  │  INVOICE  │  │  PRODUCT  │
  └─────┬─────┘  └─────┬─────┘  └─────┬─────┘
        │              │              │
        ▼              ▼              ▼

┌───────────────┐ ┌───────────────┐ ┌───────────────┐
│  users table  │ │invoices table │ │products table │
│               │ │               │ │               │
│  id           │ │  id           │ │  id           │
│  name         │ │  invoiceNo    │ │  name         │
│  phone        │ │  partyId      │ │  sku          │
│  role         │ │  totalAmt     │ │  salePrice    │
│  pin          │ │  gstAmt       │ │  gstRate      │
│  branchIds[]  │ │  status       │ │  trackStock   │
│               │ │               │ │               │
│  ┌─────────┐  │ │  ┌─────────┐  │ │  ┌─────────┐  │
│  │  attrs  │  │ │  │  data   │  │ │  │domain   │  │
│  │  Json   │  │ │  │  Json   │  │ │  │ Attrs   │  │
│  │         │  │ │  │         │  │ │  │  Json   │  │
│  │{dept,   │  │ │  │{prescNo,│  │ │  │         │  │
│  │ shift,  │  │ │  │ dlNo,   │  │ │  │{drugSch,│  │
│  │ salary} │  │ │  │ vehicle │  │ │  │ generic,│  │
│  └─────────┘  │ │  │  No...} │  │ │  │ batch.. │  │
│               │ │  └─────────┘  │ │  └─────────┘  │
└───────────────┘ └───────────────┘ └───────────────┘
       │                 │                  │
       ▼                 ▼                  ▼
  No validation    invoiceDataSchema   productAttrsSchema
  (free-form)      from DOMAIN_REGISTRY from DOMAIN_REGISTRY
                   validates on write   validates on write
```

---

## What Lives Where

| Attribute Group | Column | Type | Validated By |
|---|---|---|---|
| Staff core | `name`, `phone`, `role`, `pin`, `branchIds` | real columns | Zod fixed schema |
| Staff extras | `users.attrs` | `Json` | none — free form |
| Invoice core | `invoiceNo`, `partyId`, `totalAmt`, `gstAmt` | real columns | Zod fixed schema |
| Invoice domain extras | `invoices.data` | `Json` | `DOMAIN_REGISTRY[domainType].invoiceDataSchema` |
| Product core | `name`, `sku`, `salePrice`, `gstRate`, `unit` | real columns | Zod fixed schema |
| Product domain extras | `products.domainAttrs` | `Json` | `DOMAIN_REGISTRY[domainType].productAttrsSchema` |

---

## Write Path

Same pattern for all three entities:

```
Frontend sends flat object
  { name, sku, salePrice, drugSchedule, genericName, requiresPrescription }
                │
                ▼
      service splits it:
        core fields   → real columns
        domain fields → buildDomainAttrs() → domainAttrs Json
                │
                ▼
      validateProductAttrs(domainType, domainAttrs)
        DOMAIN_REGISTRY["pharmacy"].productAttrsSchema.parse(domainAttrs)
                │
                ▼
           db.product.update({ ...coreFields, domainAttrs })
```

---

## Read Path

```
db.product.findMany() → row.domainAttrs = { drugSchedule: "H", genericName: "..." }

Service spreads domainAttrs back into flat response:
  return { ...product, ...product.domainAttrs }

Frontend sees same flat object it always sent — no change needed.
```

---

## New Tenant Registration Flow (Domain Setup)

```
POST /api/tenants/register
{ businessName, phone, pin, domainType: "pharmacy", gstin, city }
```

### Step 1 — Validate & deduplicate
- Zod validates input
- `domainType` must be one of the 27 keys from `DOMAIN_REGISTRY`
- Phone uniqueness checked in `public.tenants`

### Step 2 — Create row in public schema

```
public.tenants
  slug:       "fresh-pharmacy-k3x2"
  schemaName: "t_fresh_pharmacy_k3x2"
  plan:       "free"
```

No domain-specific data lives here.

### Step 3 — Create isolated PostgreSQL schema

```sql
SELECT public.create_tenant_schema('t_fresh_pharmacy_k3x2')
```

- Creates ~24 base tables (`products`, `invoices`, `parties`, `batches`, etc.) inside a new schema
- `provisionTenantSchema()` applies any Prisma migrations so new tenants are always up to date
- **Domain plays no role here** — every tenant gets the exact same table structure regardless of domain

### Step 4 — Create Branch (domain is locked in here)

```ts
branch.domainType   = "pharmacy"
branch.domainConfig = DOMAIN_REGISTRY["pharmacy"].defaultDomainConfig
                    // e.g. { enforce_fefo: true, require_batch: true }
```

`domainType` on the `branches` table is the single source of truth for all domain-specific behaviour. Every request after login carries the `branchId` in the JWT, so every API call knows the domain by looking up `branch.domainType`.

### Step 5 — Create Owner user + seed invoice sequences
Standard — no domain involvement.

---

## Runtime Domain Routing

```
Request → JWT (has branchId)
       → tenantMiddleware reads branchId → req.branchId
       → route handler fetches branch.domainType
       → DOMAIN_REGISTRY[domainType] gives:
            .features            → what UI features are enabled (hasBatches, hasKOT, etc.)
            .productAttrsSchema  → Zod validates domainAttrs on product write
            .invoiceDataSchema   → Zod validates invoice.data on invoice write
            .defaultDomainConfig → preset config stored on branch at creation
```

**No domain-specific tables are ever created.** All 27 domains share the same table structure. The `domainAttrs` / `data` / `attrs` JSON columns hold whatever that domain needs. The single string `branch.domainType` is the switch that controls everything at runtime.

---

## Domain-Specific Fields by Domain (stored in domainAttrs JSON)

| Domain | Example domainAttrs fields |
|---|---|
| General Retail | `weightGrams`, `packSize`, `minOrderQty`, `shelfLocation`, `altUnit` |
| Pharmacy | `drugSchedule`, `requiresPrescription`, `genericName`, `manufacturer`, `form`, `strengthDosage`, `stripQty`, `isNarcotic`, `dlNumber` |
| Electronics | `modelNumber`, `isSpare`, `warrantyMonths`, `compatibleModels`, `colorOptions`, `storageOptions` |
| Tiffin / Food | `mealType`, `cuisineType`, `allergens`, `caloriesPer100g`, `isAvailableBreakfast`, `preparationTimeMin`, `isSeasonalItem` |
| Petrol Pump | `fuelGrade`, `tankId`, `densityKgL`, `octaneRating` |
| Gym / Fitness | `servingSizeG`, `flavour`, `proteinPer100g`, `isConsumable`, `equipmentCondition` |
| Diagnostic Lab | `testCode`, `sampleType`, `turnaroundHours`, `requiresFasting`, `methodology`, `referenceRange`, `nablAccredited` |
| Pest Control | `activeIngredient`, `concentrationPct`, `applicationMethod`, `toxicityLevel`, `targetPest`, `dosePerSqft`, `isCertifiedSafe` |

---

## Key Principle

> All three attribute types (staff / invoice / product) follow the same pattern:
> **fixed real columns for universal fields + Json column for domain-specific fields + DOMAIN_REGISTRY schema for validation.**
>
> The domain type string on the branch is the single switch. No domain-specific tables. No code forks per domain. One shared schema for all 27 domains.
