// Applies a migration SQL file to all tenant schemas
import { PrismaClient } from '@prisma/client'
import { readFileSync } from 'fs'

const BASE_URL = 'postgresql://billing_app:localdev123@localhost:5432/billing_db'
const sqlFile  = process.argv[2]
if (!sqlFile) { console.error('Usage: node apply-migration.mjs <path-to-sql>'); process.exit(1) }

const sql = readFileSync(sqlFile, 'utf8')
// Split on -- comments that start a new statement block, keeping each CREATE TABLE separate
const statements = sql
  .split(/\n(?=CREATE |ALTER |DROP |INSERT )/g)
  .map(s => s.trim())
  .filter(Boolean)

const publicDb = new PrismaClient({ datasources: { db: { url: BASE_URL } } })
const schemas  = await publicDb.$queryRawUnsafe(
  `SELECT schema_name FROM information_schema.schemata WHERE schema_name LIKE 't_%' ORDER BY schema_name`
)
await publicDb.$disconnect()

for (const { schema_name } of schemas) {
  const db = new PrismaClient({ datasources: { db: { url: `${BASE_URL}?schema=${schema_name}` } } })
  let ok = 0, fail = 0
  for (const stmt of statements) {
    try {
      await db.$executeRawUnsafe(stmt)
      ok++
    } catch (e) {
      const msg = e.message?.split('\n').filter(Boolean).pop()?.trim()
      if (!msg?.includes('already exists')) { console.log(`  ✗ ${schema_name}: ${msg}`); fail++ }
      else ok++
    }
  }
  console.log(`  ✓ ${schema_name} — ${ok} ok, ${fail} failed`)
  await db.$disconnect()
}
console.log('Done.')
