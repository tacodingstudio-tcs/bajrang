// Business Process Audit migration
// Adds approval fields + e-invoice/e-way bill fields to invoices
// Creates contracts table in all 27 tenant schemas
import { PrismaClient } from '@prisma/client'

const BASE_URL = 'postgresql://billing_app:localdev123@localhost:5432/billing_db'

const publicDb = new PrismaClient({ datasources: { db: { url: BASE_URL } } })
const schemas = await publicDb.$queryRawUnsafe(
  `SELECT schema_name FROM information_schema.schemata WHERE schema_name LIKE 't_%' ORDER BY schema_name`
)
await publicDb.$disconnect()

console.log(`Found ${schemas.length} tenant schemas`)

for (const { schema_name } of schemas) {
  const db = new PrismaClient({ datasources: { db: { url: `${BASE_URL}?schema=${schema_name}` } } })
  try {
    // Add approval fields to invoices
    await db.$executeRawUnsafe(`
      ALTER TABLE invoices
        ADD COLUMN IF NOT EXISTS "approvalStatus" TEXT NOT NULL DEFAULT 'not_required',
        ADD COLUMN IF NOT EXISTS "approvedBy"     UUID,
        ADD COLUMN IF NOT EXISTS "approvedAt"     TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS "approvalNote"   TEXT
    `)
    // Add e-invoice / IRN fields
    await db.$executeRawUnsafe(`
      ALTER TABLE invoices
        ADD COLUMN IF NOT EXISTS "irnNo"           TEXT,
        ADD COLUMN IF NOT EXISTS "irnAckDate"      TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS "irnQrCode"       TEXT,
        ADD COLUMN IF NOT EXISTS "eWayBillNo"      TEXT,
        ADD COLUMN IF NOT EXISTS "eWayBillDate"    TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS "eWayBillValidTo" TIMESTAMPTZ
    `)
    // Index for approval queue
    await db.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS invoices_approval_idx ON invoices ("branchId", "approvalStatus")
    `)

    // Create contracts table
    await db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS contracts (
        id                UUID        NOT NULL DEFAULT gen_random_uuid(),
        "branchId"        UUID        NOT NULL,
        "partyId"         UUID        NOT NULL,
        title             TEXT        NOT NULL,
        "contractNo"      TEXT        NOT NULL,
        "startDate"       DATE        NOT NULL,
        "endDate"         DATE,
        "billingCycle"    TEXT        NOT NULL DEFAULT 'monthly',
        "billingDay"      INT         NOT NULL DEFAULT 1,
        amount            NUMERIC(12,2) NOT NULL,
        "gstRate"         NUMERIC(5,2)  NOT NULL DEFAULT 0,
        status            TEXT        NOT NULL DEFAULT 'active',
        "lastBilledDate"  DATE,
        "nextBillingDate" DATE,
        "autoInvoice"     BOOLEAN     NOT NULL DEFAULT true,
        notes             TEXT,
        terms             TEXT,
        "createdBy"       UUID        NOT NULL,
        "createdAt"       TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt"       TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT contracts_pkey PRIMARY KEY (id)
      )
    `)
    await db.$executeRawUnsafe(`
      CREATE UNIQUE INDEX IF NOT EXISTS contracts_branch_no_idx ON contracts ("branchId", "contractNo")
    `)
    await db.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS contracts_status_idx ON contracts ("branchId", status)
    `)
    await db.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS contracts_next_billing_idx ON contracts ("branchId", "nextBillingDate")
    `)

    console.log(`  ✓ ${schema_name}`)
  } catch (e) {
    console.error(`  ✗ ${schema_name}:`, e.message?.split('\n')[0] ?? e)
  } finally {
    await db.$disconnect()
  }
}

console.log('\nDone.')
