// scripts/setup-db.mjs
// Re-applies all custom SQL files that Prisma migrate reset does NOT restore.
// Run this any time after `pnpm reset` wipes the database.
//
// Usage:
//   node scripts/setup-db.mjs

import { readFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { PrismaClient } from '@prisma/client'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

// Load DATABASE_URL from apps/api/.env if not already in environment
const envPath = resolve(root, 'apps/api/.env')
if (!process.env.DATABASE_URL && existsSync(envPath)) {
  const lines = readFileSync(envPath, 'utf-8').split('\n')
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eqIdx = trimmed.indexOf('=')
    if (eqIdx < 0) continue
    const key = trimmed.slice(0, eqIdx).trim()
    const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '')
    if (key && !process.env[key]) process.env[key] = val
  }
}

const sqlDir = resolve(root, 'apps/api/src/lib')
const db     = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL } },
})

const SQL_FILES = [
  'rls-bootstrap.sql',
  'invoice-sequences.sql',
  'ai-suggestions.sql',
  'idempotency.sql',
  'refresh-tokens.sql',
  'razorpay-orders.sql',
]

// Splits a SQL file into individual statements, correctly ignoring semicolons
// inside -- line comments, /* */ block comments, 'single-quoted strings', and
// $$dollar-quoted$$ blocks (used by PL/pgSQL functions).
function splitSql(sql) {
  const stmts = []
  let buf = ''
  let i = 0

  while (i < sql.length) {
    // -- line comment: skip to end of line
    if (sql[i] === '-' && sql[i + 1] === '-') {
      const end = sql.indexOf('\n', i)
      buf += end === -1 ? sql.slice(i) : sql.slice(i, end + 1)
      i = end === -1 ? sql.length : end + 1
      continue
    }
    // /* block comment */
    if (sql[i] === '/' && sql[i + 1] === '*') {
      const end = sql.indexOf('*/', i + 2)
      buf += end === -1 ? sql.slice(i) : sql.slice(i, end + 2)
      i = end === -1 ? sql.length : end + 2
      continue
    }
    // $$ or $tag$ dollar-quoted string
    if (sql[i] === '$') {
      const tagEnd = sql.indexOf('$', i + 1)
      if (tagEnd !== -1) {
        const tag = sql.slice(i, tagEnd + 1)
        const closeIdx = sql.indexOf(tag, tagEnd + 1)
        buf += closeIdx === -1 ? sql.slice(i) : sql.slice(i, closeIdx + tag.length)
        i = closeIdx === -1 ? sql.length : closeIdx + tag.length
        continue
      }
    }
    // 'single-quoted string' (handles '' escapes)
    if (sql[i] === "'") {
      let j = i + 1
      while (j < sql.length) {
        if (sql[j] === "'" && sql[j + 1] === "'") { j += 2; continue }
        if (sql[j] === "'") { j++; break }
        j++
      }
      buf += sql.slice(i, j)
      i = j
      continue
    }
    // statement separator
    if (sql[i] === ';') {
      const stmt = buf.trim()
      if (stmt) stmts.push(stmt)
      buf = ''
      i++
      continue
    }
    buf += sql[i++]
  }
  const last = buf.trim()
  if (last) stmts.push(last)
  return stmts
}

console.log('⚙️  Applying custom SQL migrations...\n')

for (const file of SQL_FILES) {
  const sql = readFileSync(resolve(sqlDir, file), 'utf-8')
  const statements = splitSql(sql)

  let fileOk = true
  for (const stmt of statements) {
    try {
      await db.$executeRawUnsafe(stmt)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      if (msg.includes('already exists')) {
        // expected for IF NOT EXISTS / CREATE POLICY etc
      } else {
        console.error(`✗  ${file}: ${msg}`)
        fileOk = false
      }
    }
  }
  if (fileOk) console.log(`✓  ${file}`)
}

await db.$disconnect()
console.log('\n✅  Custom SQL done.')
console.log('    Now run:  cd packages/db && pnpm seed')
