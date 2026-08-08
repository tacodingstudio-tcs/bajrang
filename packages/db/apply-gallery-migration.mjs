// Creates gallery_items table in every tenant schema
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
    // Drop old snake_case version if it exists with wrong columns
    await db.$executeRawUnsafe(`DROP TABLE IF EXISTS gallery_items CASCADE`)

    await db.$executeRawUnsafe(`
      CREATE TABLE gallery_items (
        id           UUID        NOT NULL DEFAULT gen_random_uuid(),
        "branchId"   UUID        NOT NULL,
        "partyId"    UUID,
        "invoiceId"  UUID,
        "imageData"  TEXT        NOT NULL,
        "thumbData"  TEXT,
        caption      TEXT,
        tags         TEXT[]      NOT NULL DEFAULT '{}',
        "domainType" TEXT        NOT NULL,
        "createdAt"  TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt"  TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT gallery_items_pkey PRIMARY KEY (id)
      )
    `)
    await db.$executeRawUnsafe(`
      CREATE INDEX gallery_items_branch_domain_idx
        ON gallery_items ("branchId", "domainType", "createdAt" DESC)
    `)
    await db.$executeRawUnsafe(`
      CREATE INDEX gallery_items_party_idx
        ON gallery_items ("partyId")
    `)
    console.log(`  ✓ ${schema_name}`)
  } catch (e) {
    console.error(`  ✗ ${schema_name}:`, e.message?.split('\n')[0] ?? e)
  } finally {
    await db.$disconnect()
  }
}

console.log('\nDone.')
