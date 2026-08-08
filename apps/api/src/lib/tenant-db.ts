// =============================================================================
// lib/tenant-db.ts
//
// Per-tenant PrismaClient factory.
//
// Each tenant lives in its own PostgreSQL schema (e.g. "t_ramesh_kirana").
// Prisma routes all unqualified table names through the schema set in the
// datasource URL — so passing ?schema=t_ramesh_kirana is all we need.
//
// Clients are cached in-process (one per schema) so we don't open a new
// connection pool on every request. Graceful shutdown calls disconnectAll().
// =============================================================================

import { PrismaClient } from '@prisma/client'

const _cache = new Map<string, PrismaClient>()

/**
 * Returns a PrismaClient scoped to the given tenant schema.
 * Subsequent calls with the same schema return the cached client.
 */
// Defense-in-depth: reject schema names that don't match the provisioning pattern.
// In normal operation every schemaName comes from a signed JWT, so this can only
// trigger if the JWT secret is compromised. Still worth enforcing so a bad schemaName
// never reaches the PostgreSQL connection string.
const SAFE_SCHEMA_RE = /^t_[a-z0-9_]{1,60}$/

export function getTenantDb(schemaName: string): PrismaClient {
  if (!SAFE_SCHEMA_RE.test(schemaName)) {
    throw new Error(`Invalid tenant schema name: "${schemaName}"`)
  }

  if (_cache.has(schemaName)) return _cache.get(schemaName)!

  const baseUrl = process.env.DATABASE_URL
  if (!baseUrl) throw new Error('DATABASE_URL is not set')

  // connection_limit: 1 in test (many ephemeral schemas) / 2 in production
  // (allows two concurrent queries per tenant without serializing on one connection).
  // With N active tenants = connectionLimit*N connections total — keep well under max_connections.
  const connectionLimit = process.env['NODE_ENV'] === 'test' ? 1 : 2
  const url = baseUrl.includes('?')
    ? `${baseUrl}&schema=${schemaName}&connection_limit=${connectionLimit}&pool_timeout=10&idle_timeout=60`
    : `${baseUrl}?schema=${schemaName}&connection_limit=${connectionLimit}&pool_timeout=10&idle_timeout=60`

  const client = new PrismaClient({
    datasources: { db: { url } },
    // Silence per-tenant query logs — keep only errors
    log: process.env.NODE_ENV === 'development' ? ['error'] : ['error'],
  })

  _cache.set(schemaName, client)
  return client
}

/** Called on graceful shutdown to close all tenant DB connections. */
export async function disconnectAllTenantDbs(): Promise<void> {
  await Promise.all([..._cache.values()].map(c => c.$disconnect()))
  _cache.clear()
}

/** Derive schema name from tenant slug (replaces hyphens with underscores). */
export function schemaFromSlug(slug: string): string {
  return `t_${slug.replace(/-/g, '_')}`
}
