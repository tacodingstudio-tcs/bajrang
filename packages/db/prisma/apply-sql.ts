// Applies a single-statement SQL file (e.g. neon-create-tenant-schema.sql) to DATABASE_URL.
// Usage:  DATABASE_URL=<url> npx tsx prisma/apply-sql.ts <file.sql>
// Any trailing `DO $$ ... $$;` notice block is dropped so the file is one statement.
import { readFileSync } from 'node:fs'
import { PrismaClient } from '@prisma/client'

const file = process.argv[2]
if (!file) throw new Error('Usage: tsx prisma/apply-sql.ts <file.sql>')

let sql = readFileSync(file, 'utf8')
const doIdx = sql.lastIndexOf('\nDO $$')
if (doIdx !== -1) sql = sql.slice(0, doIdx)
sql = sql.trim().replace(/;\s*$/, '')

const prisma = new PrismaClient()
try {
  await prisma.$executeRawUnsafe(sql)
  const rows = await prisma.$queryRawUnsafe<{ n: number }[]>(
    `SELECT count(*)::int AS n FROM pg_proc WHERE proname = 'create_tenant_schema'`,
  )
  console.log(`OK — create_tenant_schema() present: ${rows[0]?.n === 1}`)
} finally {
  await prisma.$disconnect()
}
