import { PrismaClient } from '@prisma/client'

const root = new PrismaClient({ datasourceUrl: process.env.DATABASE_URL })

async function main() {
  const schemas = await root.$queryRaw`
    SELECT schema_name FROM information_schema.schemata
    WHERE schema_name LIKE 't_%' ORDER BY schema_name
  `

  for (const { schema_name } of schemas) {
    await root.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "${schema_name}".staff_attendance (
        id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        "branchId"  UUID        NOT NULL,
        "userId"    UUID        NOT NULL,
        date        DATE        NOT NULL,
        "clockIn"   TIMESTAMPTZ,
        "clockOut"  TIMESTAMPTZ,
        status      TEXT        NOT NULL DEFAULT 'present',
        notes       TEXT,
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE ("branchId", "userId", date)
      )
    `)

    await root.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "${schema_name}".staff_shifts (
        id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        "branchId"   UUID        NOT NULL,
        "userId"     UUID        NOT NULL,
        date         DATE        NOT NULL,
        "shiftType"  TEXT        NOT NULL DEFAULT 'morning',
        "shiftStart" TIME,
        "shiftEnd"   TIME,
        notes        TEXT,
        "createdAt"  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `)

    console.log(`✓ ${schema_name}`)
  }
}

main()
  .then(() => { console.log('Done'); process.exit(0) })
  .catch(e => { console.error(e.message); process.exit(1) })
