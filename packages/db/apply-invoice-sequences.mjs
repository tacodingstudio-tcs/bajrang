import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function run() {
  const schemas = await prisma.$queryRaw`
    SELECT schema_name FROM information_schema.schemata
    WHERE schema_name LIKE 't_%' ORDER BY schema_name
  `
  console.log(`Found ${schemas.length} tenant schemas`)

  for (const { schema_name } of schemas) {
    try {
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "${schema_name}".invoice_sequences (
          branch_id   UUID   NOT NULL,
          txn_type    TEXT   NOT NULL,
          fy          TEXT   NOT NULL DEFAULT to_char(now(),'YY'),
          current_val BIGINT NOT NULL DEFAULT 0,
          PRIMARY KEY (branch_id, txn_type, fy)
        )
      `)
      console.log(`✓ ${schema_name}`)
    } catch (err) {
      console.error(`✗ ${schema_name}:`, err.message)
    }
  }

  console.log('invoice_sequences migration complete')
  await prisma.$disconnect()
}

run().catch(console.error)
