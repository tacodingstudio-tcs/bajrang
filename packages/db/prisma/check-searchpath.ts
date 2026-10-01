// Diagnostic: shows which search_path a tenant-style connection (?schema=...) really gets.
// Usage:  DATABASE_URL=<url> npx tsx prisma/check-searchpath.ts
import { PrismaClient } from '@prisma/client'

const base = process.env['DATABASE_URL']
if (!base) throw new Error('DATABASE_URL not set')
console.log('host:', new URL(base).host, '| pooled:', /-pooler/.test(base))

const url = `${base}${base.includes('?') ? '&' : '?'}schema=zz_probe&connection_limit=2`
const prisma = new PrismaClient({ datasources: { db: { url } } })
try {
  await prisma.$executeRawUnsafe('CREATE SCHEMA IF NOT EXISTS zz_probe')
  await prisma.$executeRawUnsafe('CREATE TABLE IF NOT EXISTS zz_probe.t (x int)')
  const sp = await prisma.$queryRawUnsafe<{ search_path: string }[]>('SHOW search_path')
  console.log('search_path:', sp[0]?.search_path)
  try {
    await prisma.$queryRawUnsafe('SELECT count(*) FROM t')
    console.log('unqualified table lookup: OK')
  } catch (e) {
    console.log('unqualified table lookup: FAILED —', (e as Error).message.split('\n').pop())
  }
} finally {
  await prisma.$executeRawUnsafe('DROP SCHEMA IF EXISTS zz_probe CASCADE').catch(() => {})
  await prisma.$disconnect()
}
