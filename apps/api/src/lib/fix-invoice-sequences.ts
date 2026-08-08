// Fix: create invoice_sequences table in all tenant schemas that are missing it
// Usage: npx tsx apps/api/src/lib/fix-invoice-sequences.ts

import { PrismaClient } from '@billing/db'

const db = new PrismaClient()

async function main() {
  const schemas = await db.$queryRawUnsafe<Array<{ schema_name: string }>>(
    `SELECT schema_name FROM information_schema.schemata WHERE schema_name LIKE 't_%' ORDER BY schema_name`
  )

  const hasSeq = await db.$queryRawUnsafe<Array<{ table_schema: string }>>(
    `SELECT DISTINCT table_schema FROM information_schema.tables WHERE table_name = 'invoice_sequences'`
  )
  const withSeq = new Set(hasSeq.map((r: any) => r.table_schema))

  const missing = schemas.filter((r: any) => !withSeq.has(r.schema_name))
  console.log(`Found ${missing.length} schemas missing invoice_sequences`)

  for (const { schema_name } of missing) {
    await db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "${schema_name}".invoice_sequences (
        branch_id   UUID   NOT NULL,
        txn_type    TEXT   NOT NULL,
        fy          TEXT   NOT NULL,
        current_val BIGINT NOT NULL DEFAULT 1,
        PRIMARY KEY (branch_id, txn_type, fy)
      )
    `)
    await db.$executeRawUnsafe(
      `GRANT SELECT, INSERT, UPDATE ON "${schema_name}".invoice_sequences TO billing_app`
    )
    console.log(`  Created: ${schema_name}`)
  }

  console.log('Done.')
  await db.$disconnect()
}

main().catch(err => { console.error(err); process.exit(1) })
