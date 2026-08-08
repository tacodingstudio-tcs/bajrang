// =============================================================================
// run-product-migration.ts
//
// One-time runner: applies migrate-product-columns-to-json.sql to every active
// tenant schema. Safe to re-run — the SQL uses IF EXISTS on DROP COLUMN.
//
// Usage:
//   npx tsx apps/api/src/lib/run-product-migration.ts
// =============================================================================

import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { PrismaClient } from '@prisma/client'

const __dirname = dirname(fileURLToPath(import.meta.url))

const DATABASE_URL = process.env['DATABASE_URL']
if (!DATABASE_URL) throw new Error('DATABASE_URL is not set')

const migrationSql = readFileSync(
  resolve(__dirname, 'migrate-product-columns-to-json.sql'),
  'utf8'
)

// Split SQL into individual statements (split on semicolons, ignore empty lines)
const statements = migrationSql
  .split(';')
  .map((s) => s.trim())
  .filter((s) => s.length > 0 && !s.startsWith('--'))

async function run() {
  // Public schema client to list all tenants
  const publicDb = new PrismaClient({ datasources: { db: { url: DATABASE_URL } } })

  const tenants = await publicDb.$queryRaw<Array<{ schemaName: string }>>`
    SELECT "schemaName" FROM public.tenants WHERE "isActive" = true ORDER BY "schemaName"
  `

  await publicDb.$disconnect()

  console.log(`Found ${tenants.length} tenant schemas to migrate.\n`)

  let passed = 0
  let failed = 0

  for (const { schemaName } of tenants) {
    // Each tenant gets its own Prisma client pointed at its schema
    const tenantDb = new PrismaClient({
      datasources: { db: { url: `${DATABASE_URL}${DATABASE_URL!.includes('?') ? '&' : '?'}schema=${schemaName}` } },
    })

    try {
      for (const stmt of statements) {
        await tenantDb.$executeRawUnsafe(stmt)
      }
      console.log(`  ✓  ${schemaName}`)
      passed++
    } catch (err: any) {
      console.error(`  ✗  ${schemaName}: ${err.message}`)
      failed++
    } finally {
      await tenantDb.$disconnect()
    }
  }

  console.log(`\nDone. ${passed} succeeded, ${failed} failed.`)
  if (failed > 0) process.exit(1)
}

run().catch((err) => {
  console.error('Fatal:', err)
  process.exit(1)
})
