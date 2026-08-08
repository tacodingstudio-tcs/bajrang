// Run: node apply-expense-migration.mjs
import { PrismaClient } from '@prisma/client'

const BASE_URL = 'postgresql://billing_app:localdev123@localhost:5432/billing_db'

const STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS "expenses" (
    "id"            UUID         NOT NULL DEFAULT gen_random_uuid(),
    "branchId"      UUID         NOT NULL,
    "date"          DATE         NOT NULL DEFAULT CURRENT_DATE,
    "category"      TEXT         NOT NULL,
    "description"   TEXT,
    "amount"        DECIMAL(12,2) NOT NULL,
    "gstAmount"     DECIMAL(12,2) NOT NULL DEFAULT 0,
    "gstRate"       INTEGER      NOT NULL DEFAULT 0,
    "paymentMode"   TEXT         NOT NULL DEFAULT 'cash',
    "partyId"       UUID,
    "referenceNo"   TEXT,
    "notes"         TEXT,
    "attachmentUrl" TEXT,
    "isRecurring"   BOOLEAN      NOT NULL DEFAULT false,
    "recurrence"    TEXT,
    "createdBy"     UUID         NOT NULL,
    "createdAt"     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    "updatedAt"     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    CONSTRAINT "expenses_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE INDEX IF NOT EXISTS "expenses_branchId_date_idx" ON "expenses"("branchId", "date" DESC)`,
  `CREATE INDEX IF NOT EXISTS "expenses_branchId_category_idx" ON "expenses"("branchId", "category")`,
  `CREATE INDEX IF NOT EXISTS "expenses_branchId_partyId_idx" ON "expenses"("branchId", "partyId")`,
]

// Get all tenant schema names from public schema
const publicDb = new PrismaClient({ datasources: { db: { url: BASE_URL } } })
const schemas = await publicDb.$queryRawUnsafe(
  `SELECT schema_name FROM information_schema.schemata WHERE schema_name LIKE 't_%' ORDER BY schema_name`
)
await publicDb.$disconnect()

console.log(`Found ${schemas.length} tenant schemas`)

for (const { schema_name } of schemas) {
  const url = `${BASE_URL}?schema=${schema_name}`
  const db = new PrismaClient({ datasources: { db: { url } } })
  try {
    for (const stmt of STATEMENTS) await db.$executeRawUnsafe(stmt)
    console.log(`  ✓ ${schema_name}`)
  } catch (e) {
    console.log(`  ✗ ${schema_name}: ${e.message}`)
  } finally {
    await db.$disconnect()
  }
}

console.log('Done.')
