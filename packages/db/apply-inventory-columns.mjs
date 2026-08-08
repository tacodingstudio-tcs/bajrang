// apply-inventory-columns.mjs
// Adds missing columns to inventory tables across all tenant schemas.
// Run with: node apply-inventory-columns.mjs

import { PrismaClient } from '@prisma/client'

const BASE_URL = 'postgresql://billing_app:localdev123@localhost:5432/billing_db'

const rootDb = new PrismaClient({ datasourceUrl: BASE_URL })

const schemas = await rootDb.$queryRaw`
  SELECT schema_name FROM information_schema.schemata
  WHERE schema_name LIKE 't_%'
  ORDER BY schema_name
`

console.log(`Found ${schemas.length} tenant schemas\n`)

const statements = [
  // stock_transfers — add missing columns
  `ALTER TABLE stock_transfers ADD COLUMN IF NOT EXISTS "receivedDate" DATE`,
  `ALTER TABLE stock_transfers ADD COLUMN IF NOT EXISTS "receivedBy"   UUID`,

  // stock_adjustment_items — add missing approvedAt on parent
  `ALTER TABLE stock_adjustments ADD COLUMN IF NOT EXISTS "approvedAt" TIMESTAMPTZ`,

  // stock_transfer_items — actual DB has qty/costRate; add sentQty/receivedQty/rate aliases
  `ALTER TABLE stock_transfer_items ADD COLUMN IF NOT EXISTS "sentQty"     DECIMAL(10,3) DEFAULT 0`,
  `ALTER TABLE stock_transfer_items ADD COLUMN IF NOT EXISTS "receivedQty" DECIMAL(10,3) DEFAULT 0`,
  `ALTER TABLE stock_transfer_items ADD COLUMN IF NOT EXISTS "rate"        DECIMAL(12,4) DEFAULT 0`,

  // Backfill sentQty from qty where sentQty is still 0 and qty > 0
  `UPDATE stock_transfer_items SET "sentQty" = qty, "rate" = "costRate" WHERE "sentQty" = 0 AND qty > 0`,

  // goods_receipt_items — Prisma schema uses batchId column (not in original table)
  `ALTER TABLE goods_receipt_items ADD COLUMN IF NOT EXISTS "batchId" UUID`,
]

let ok = 0, fail = 0

for (const { schema_name } of schemas) {
  const db = new PrismaClient({
    datasourceUrl: `${BASE_URL}?schema=${schema_name}`,
  })

  process.stdout.write(`  ${schema_name} ... `)
  try {
    for (const sql of statements) {
      await db.$executeRawUnsafe(`SET search_path TO "${schema_name}"`)
      await db.$executeRawUnsafe(sql)
    }
    console.log('✓')
    ok++
  } catch (e) {
    console.log(`✗  ${e.message}`)
    fail++
  } finally {
    await db.$disconnect()
  }
}

await rootDb.$disconnect()
console.log(`\nDone: ${ok} OK, ${fail} failed`)
