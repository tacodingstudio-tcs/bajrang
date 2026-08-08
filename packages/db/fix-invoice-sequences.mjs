import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const fy = new Date().getMonth() >= 3
  ? String(new Date().getFullYear()).slice(-2)
  : String(new Date().getFullYear() - 1).slice(-2)

async function run() {
  const schemas = await prisma.$queryRaw`
    SELECT schema_name FROM information_schema.schemata
    WHERE schema_name LIKE 't_%' ORDER BY schema_name
  `
  console.log(`Found ${schemas.length} tenant schemas, FY=${fy}`)

  for (const { schema_name } of schemas) {
    try {
      // Check current columns
      const cols = await prisma.$queryRawUnsafe(
        `SELECT column_name FROM information_schema.columns WHERE table_schema='${schema_name}' AND table_name='invoice_sequences'`
      )
      const colNames = cols.map(c => c.column_name)

      if (colNames.includes('branch_id')) {
        console.log(`✓ ${schema_name} — already correct`)
        continue
      }

      // Read existing data before dropping
      let existing = []
      if (colNames.includes('branchId')) {
        existing = await prisma.$queryRawUnsafe(
          `SELECT "branchId", "txnType", "lastSeq" FROM "${schema_name}".invoice_sequences`
        )
      }

      // Drop old table and recreate with correct schema
      await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS "${schema_name}".invoice_sequences`)
      await prisma.$executeRawUnsafe(`
        CREATE TABLE "${schema_name}".invoice_sequences (
          branch_id   UUID   NOT NULL,
          txn_type    TEXT   NOT NULL,
          fy          TEXT   NOT NULL DEFAULT '${fy}',
          current_val BIGINT NOT NULL DEFAULT 0,
          PRIMARY KEY (branch_id, txn_type, fy)
        )
      `)

      // Migrate existing rows into new schema
      for (const row of existing) {
        await prisma.$executeRawUnsafe(
          `INSERT INTO "${schema_name}".invoice_sequences (branch_id, txn_type, fy, current_val)
           VALUES ('${row.branchId}', '${row.txnType}', '${fy}', ${row.lastSeq})
           ON CONFLICT DO NOTHING`
        )
      }

      console.log(`✓ ${schema_name} — migrated ${existing.length} rows`)
    } catch (err) {
      console.error(`✗ ${schema_name}:`, err.message)
    }
  }

  console.log('invoice_sequences schema fix complete')
  await prisma.$disconnect()
}

run().catch(console.error)
