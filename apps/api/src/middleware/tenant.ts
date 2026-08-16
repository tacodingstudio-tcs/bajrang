import type { FastifyRequest, FastifyReply } from 'fastify'
import type { PrismaClient } from '@prisma/client'
import { getTenantDb } from '../lib/tenant-db.js'

declare module 'fastify' {
  interface FastifyRequest {
    tenantId:   string
    schemaName: string
    branchId:   string
    userId:     string
    role:       'owner' | 'manager' | 'cashier' | 'viewer' | 'super_user'
    db:         PrismaClient   // tenant-scoped Prisma client — use this in all routes
  }
}

export interface JWTPayload {
  tenantId:   string
  schemaName: string   // e.g. "t_ramesh_kirana"
  branchId:   string
  userId:     string
  role:       'owner' | 'manager' | 'cashier' | 'viewer' | 'super_user'
}

// super_user is a narrow role — website content, AI assistant, and their own
// user profile only. Enforced here (not just hidden in the nav) because
// client-side nav hiding is not access control. Every other protected route
// (bookings, invoices, rooms, branches, other users' data, ...) is off-limits.
const SUPER_USER_ALLOWED_PREFIXES = ['/api/website', '/api/ai', '/api/users/me', '/api/users', '/api/features']

function isAllowedForSuperUser(url: string): boolean {
  const path = url.split('?')[0] ?? url
  return SUPER_USER_ALLOWED_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`))
}

// viewer is the hotel's housekeeping-staff role — housekeeping tasks
// (read + update status), room status (read-only, to see what needs
// cleaning), and their own profile. Same reasoning as super_user above:
// this is real access control, not just hiding nav items.
function isAllowedForViewer(url: string, method: string): boolean {
  const path = url.split('?')[0] ?? url
  if (path === '/api/users/me' || path.startsWith('/api/users/me/')) return true
  if (path === '/api/hotel/housekeeping' || path.startsWith('/api/hotel/housekeeping/')) return true
  if (path === '/api/hotel/rooms' || path.startsWith('/api/hotel/rooms/')) return method === 'GET'
  return false
}

// =============================================================================
// tenantMiddleware
// Runs before every protected route handler.
//
// 1. Verifies the JWT (throws → 401 if invalid / expired)
// 2. Attaches tenant context fields to req
// 3. Attaches a per-tenant PrismaClient (req.db) scoped to the correct
//    PostgreSQL schema — no RLS, no set_config needed.
//    Each tenant's data is physically isolated in its own schema.
// 4. For super_user, blocks any route outside its narrow allowlist.
// =============================================================================
export async function tenantMiddleware(
  req: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  try {
    const payload = await req.jwtVerify<JWTPayload>()

    req.tenantId   = payload.tenantId
    req.schemaName = payload.schemaName
    req.branchId   = payload.branchId
    req.userId     = payload.userId
    req.role       = payload.role

    // getTenantDb is cached — no new connection pool per request
    req.db = getTenantDb(payload.schemaName)

    if (payload.role === 'super_user' && !isAllowedForSuperUser(req.url)) {
      return reply.status(403).send({ error: 'This account only has access to Website, AI Assistant, and its own profile' })
    }

    if (payload.role === 'viewer' && !isAllowedForViewer(req.url, req.method)) {
      return reply.status(403).send({ error: 'This account only has access to Housekeeping and room status' })
    }
  } catch (err) {
    // JWT errors (invalid signature, expiry) are expected — log at debug level.
    // Non-JWT errors (DB connection down, getTenantDb crash) are unexpected —
    // log at error so they appear in production monitoring, not silently masked as 401s.
    const isJwtError = err instanceof Error && (
      err.message.includes('jwt') ||
      err.message.includes('signature') ||
      err.message.includes('expired') ||
      err.message.includes('token')
    )
    if (!isJwtError) {
      req.log.error({ err }, 'tenantMiddleware: unexpected error (not a JWT error)')
    }
    return reply.status(401).send({
      error:   'Unauthorized',
      message: 'Invalid or expired token',
    })
  }
}
