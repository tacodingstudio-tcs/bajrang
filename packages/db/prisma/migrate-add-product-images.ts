// Run once to add image columns to all existing tenant schemas:
//   npx tsx packages/db/prisma/migrate-add-product-images.ts
import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()

async function main() {
  const schemas = await db.$queryRaw<Array<{ schema_name: string }>>`
    SELECT schema_name FROM information_schema.schemata
    WHERE schema_name LIKE 't_%'
    ORDER BY schema_name
  `

  for (const { schema_name } of schemas) {
    await db.$executeRawUnsafe(`
      ALTER TABLE "${schema_name}".products
        ADD COLUMN IF NOT EXISTS image bytea,
        ADD COLUMN IF NOT EXISTS "imageMime" text
    `)
    console.log(`✓ ${schema_name}`)
  }

  console.log(`\nDone — added image columns to ${schemas.length} tenant schemas.`)
}

main().catch(console.error).finally(() => db.$disconnect())
