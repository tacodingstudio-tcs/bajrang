import { PrismaClient } from '@prisma/client'
const db = new PrismaClient()

async function main() {
  const schemas = await db.$queryRaw<Array<{ schema_name: string }>>`
    SELECT schema_name FROM information_schema.schemata
    WHERE schema_name LIKE 't_%' ORDER BY schema_name
  `
  for (const { schema_name } of schemas) {
    // Create categories table
    await db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "${schema_name}".categories (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "branchId" uuid REFERENCES "${schema_name}".branches(id),
        name text NOT NULL,
        slug text NOT NULL,
        icon text,
        color text,
        "parentId" uuid REFERENCES "${schema_name}".categories(id),
        "sortOrder" int DEFAULT 0,
        "isActive" boolean DEFAULT true,
        "createdAt" timestamptz DEFAULT now(),
        UNIQUE("branchId", slug)
      )
    `)
    // Create brands table
    await db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "${schema_name}".brands (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "branchId" uuid REFERENCES "${schema_name}".branches(id),
        name text NOT NULL,
        slug text NOT NULL,
        "isActive" boolean DEFAULT true,
        "createdAt" timestamptz DEFAULT now(),
        UNIQUE("branchId", slug)
      )
    `)
    // Add brandId to products if not exists
    await db.$executeRawUnsafe(`
      ALTER TABLE "${schema_name}".products
        ADD COLUMN IF NOT EXISTS "brandId" uuid REFERENCES "${schema_name}".brands(id)
    `)
    console.log(`✓ ${schema_name}`)
  }
  console.log(`Done — ${schemas.length} schemas updated`)
}
main().catch(console.error).finally(() => db.$disconnect())
