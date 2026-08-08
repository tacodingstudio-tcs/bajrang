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
        ALTER TABLE "${schema_name}".payments
          ADD COLUMN IF NOT EXISTS "chequeNo"       TEXT,
          ADD COLUMN IF NOT EXISTS "chequeDueDate"  DATE,
          ADD COLUMN IF NOT EXISTS "bankName"       TEXT,
          ADD COLUMN IF NOT EXISTS "clearingStatus" TEXT
      `)
      console.log(`✓ ${schema_name}`)
    } catch (err) {
      console.error(`✗ ${schema_name}:`, err.message)
    }
  }
  console.log('PDC migration complete')
  await prisma.$disconnect()
}

run().catch(console.error)
