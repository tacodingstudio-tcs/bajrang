import Fastify from 'fastify'
import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import jwt from '@fastify/jwt'
import rateLimit from '@fastify/rate-limit'
import { redis } from './lib/redis.js'

// Route handlers
import { authRoutes }           from './routes/auth.js'
import { invoiceRoutes }        from './routes/invoices.js'
import { productRoutes }        from './routes/products.js'
import { partyRoutes }          from './routes/parties.js'
import { paymentRoutes }        from './routes/payments.js'
import { stockRoutes }          from './routes/stock.js'
import { tenantRoutes }         from './routes/tenants.js'
import { aiRoutes }             from './routes/ai.js'
import { analyticsRoutes }      from './routes/analytics.js'
import { reportRoutes }         from './routes/reports.js'
import { webhookRoutes }        from './routes/webhooks.js'
import { branchRoutes }         from './routes/branches.js'
import { userRoutes }           from './routes/users.js'
import { notificationRoutes }   from './routes/notifications.js'
import { categoryRoutes }       from './routes/categories.js'
import { brandRoutes }          from './routes/brands.js'
import { expenseRoutes }        from './routes/expenses.js'
import { inventoryRoutes }      from './routes/inventory.js'
import { staffRoutes }          from './routes/staff.js'
import { galleryRoutes }        from './routes/gallery.js'
import { discountRulesRoutes }  from './routes/discount-rules.js'
import { hotelRoutes }          from './routes/hotel.js'

// Middleware
import { tenantMiddleware } from './middleware/tenant.js'
import { errorHandler }     from './middleware/error.js'

const app = Fastify({
  logger: {
    level: process.env['NODE_ENV'] === 'production' ? 'warn' : 'info',
    transport:
      process.env['NODE_ENV'] !== 'production'
        ? { target: 'pino-pretty', options: { colorize: true } }
        : undefined,
  },
  bodyLimit: 50 * 1024 * 1024,
  connectionTimeout: 0,
  requestTimeout:    0,
})

// ── Startup guard ─────────────────────────────────────────────────────────────
if (process.env['NODE_ENV'] === 'production') {
  if (!process.env['JWT_SECRET'])
    throw new Error('JWT_SECRET must be set in production.')
  if (!process.env['DATABASE_URL'])
    throw new Error('DATABASE_URL must be set in production.')
}

// ── Security plugins ──────────────────────────────────────────────────────────
await app.register(helmet, { contentSecurityPolicy: false })

await app.register(cors, {
  origin: process.env['WEB_URL'] ?? 'http://localhost:5173',
  credentials: true,
})

await app.register(rateLimit, {
  max: process.env['NODE_ENV'] === 'production' ? 500 : 10000,
  timeWindow: '1 minute',
  keyGenerator: (req) => req.ip,
})

await app.register(jwt, {
  secret: process.env['JWT_SECRET'] ?? 'dev-secret-change-in-production',
  sign: { expiresIn: process.env['JWT_EXPIRES_IN'] ?? '15m' },
})

// ── Global error handler ──────────────────────────────────────────────────────
app.setErrorHandler(errorHandler)

app.addContentTypeParser('*', (_req, _payload, done) => done(null, {}))

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/health', async () => ({
  status: 'ok',
  timestamp: new Date().toISOString(),
  version: process.env['npm_package_version'] ?? '0.0.1',
}))

// ── Test-only admin endpoints ─────────────────────────────────────────────────
if (process.env['NODE_ENV'] !== 'production') {
  app.post('/api/admin/flush-db', async () => {
    const { disconnectAllTenantDbs } = await import('./lib/tenant-db.js')
    await disconnectAllTenantDbs()
    return { flushed: true }
  })

  app.post('/api/admin/reprovision-all', async () => {
    const { db } = await import('@billing/db')
    const { provisionTenantSchema } = await import('./lib/provision-schema.js')
    const tenants = await db.$queryRawUnsafe<{ schemaName: string }[]>(
      `SELECT "schemaName" FROM public.tenants`
    )
    const results: { schema: string; ok: boolean; error?: string }[] = []
    for (const t of tenants) {
      try {
        await provisionTenantSchema(t.schemaName)
        results.push({ schema: t.schemaName, ok: true })
      } catch (err: any) {
        results.push({ schema: t.schemaName, ok: false, error: err?.message })
      }
    }
    return { provisioned: results.filter(r => r.ok).length, results }
  })
}

// ── Public routes ─────────────────────────────────────────────────────────────
await app.register(authRoutes,    { prefix: '/api/auth' })
await app.register(tenantRoutes,  { prefix: '/api/tenants' })
await app.register(webhookRoutes, { prefix: '/api/webhooks' })

// Product image (JWT via query param for browser <img> tags)
app.get('/api/products/:id/image', async (req, reply) => {
  const { id }    = (req.params as any)
  const { token } = (req.query  as any)

  if (!token) return reply.status(401).send({ error: 'Unauthorized' })

  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (typeof id !== 'string' || !UUID_RE.test(id))
    return reply.status(400).send({ error: 'Invalid product ID' })

  let tdb: any
  try {
    const payload = app.jwt.verify<{ schemaName: string }>(token)
    const { getTenantDb } = await import('./lib/tenant-db.js')
    tdb = getTenantDb(payload.schemaName)
  } catch { return reply.status(401).send({ error: 'Unauthorized' }) }

  const product = await tdb.product.findFirst({
    where: { id }, select: { image: true, imageMime: true },
  })
  if (!product?.image) return reply.status(404).send({ error: 'No image' })
  reply
    .header('Content-Type', product.imageMime ?? 'image/jpeg')
    .header('Cache-Control', 'public, max-age=86400')
    .send(product.image)
})

// ── Protected routes ──────────────────────────────────────────────────────────
await app.register(async (protectedApp) => {
  protectedApp.addHook('preHandler', tenantMiddleware)

  // Core billing
  await protectedApp.register(invoiceRoutes,       { prefix: '/api/invoices' })
  await protectedApp.register(productRoutes,       { prefix: '/api/products' })
  await protectedApp.register(partyRoutes,         { prefix: '/api/parties' })
  await protectedApp.register(paymentRoutes,       { prefix: '/api/payments' })
  await protectedApp.register(stockRoutes,         { prefix: '/api/stock' })

  // Hotel-specific
  await protectedApp.register(hotelRoutes,         { prefix: '/api/hotel' })

  // Operations
  await protectedApp.register(analyticsRoutes,     { prefix: '/api/analytics' })
  await protectedApp.register(reportRoutes,        { prefix: '/api/reports' })
  await protectedApp.register(expenseRoutes,       { prefix: '/api/expenses' })
  await protectedApp.register(inventoryRoutes,     { prefix: '/api/inventory' })
  await protectedApp.register(staffRoutes,         { prefix: '/api/staff' })

  // Setup / config
  await protectedApp.register(branchRoutes,        { prefix: '/api/branches' })
  await protectedApp.register(userRoutes,          { prefix: '/api/users' })
  await protectedApp.register(notificationRoutes,  { prefix: '/api/notifications' })
  await protectedApp.register(categoryRoutes,      { prefix: '/api/categories' })
  await protectedApp.register(brandRoutes,         { prefix: '/api/brands' })
  await protectedApp.register(galleryRoutes,       { prefix: '/api/gallery' })
  await protectedApp.register(discountRulesRoutes, { prefix: '/api/discount-rules' })
  await protectedApp.register(aiRoutes,            { prefix: '/api/ai' })
})

// ── Graceful shutdown ─────────────────────────────────────────────────────────
async function shutdown(signal: string) {
  app.log.info(`Received ${signal} — shutting down gracefully`)
  try {
    await app.close()
    const { disconnectAllTenantDbs } = await import('./lib/tenant-db.js')
    await disconnectAllTenantDbs()
  } finally {
    process.exit(0)
  }
}
process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT',  () => shutdown('SIGINT'))

// ── Ensure public schema tables exist ─────────────────────────────────────────
{
  const { db: publicDb } = await import('@billing/db')
  await publicDb.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS refresh_tokens (
      id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      token_hash  TEXT        NOT NULL UNIQUE,
      tenant_id   UUID        NOT NULL,
      schema_name TEXT        NOT NULL,
      user_id     UUID        NOT NULL,
      payload     JSONB       NOT NULL DEFAULT '{}',
      user_agent  TEXT,
      expires_at  TIMESTAMPTZ NOT NULL,
      revoked     BOOLEAN     NOT NULL DEFAULT false,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)
  await publicDb.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_rt_hash ON refresh_tokens(token_hash)`)
  const ikCols = await publicDb.$queryRawUnsafe<{column_name:string}[]>(
    `SELECT column_name FROM information_schema.columns WHERE table_name='idempotency_keys' AND table_schema='public'`
  )
  const ikColNames = ikCols.map(c => c.column_name)
  const requiredIkCols = ['branch_id','endpoint','idempotency_key','response_status','response_body','completed_at']
  if (ikColNames.length > 0 && requiredIkCols.some(c => !ikColNames.includes(c))) {
    await publicDb.$executeRawUnsafe(`DROP TABLE IF EXISTS idempotency_keys`)
  }
  await publicDb.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS idempotency_keys (
      id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      branch_id       UUID        NOT NULL,
      endpoint        TEXT        NOT NULL,
      idempotency_key TEXT        NOT NULL,
      status          TEXT        NOT NULL DEFAULT 'processing',
      response_status INTEGER,
      response_body   JSONB,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      completed_at    TIMESTAMPTZ,
      UNIQUE (branch_id, endpoint, idempotency_key)
    )
  `)
  await publicDb.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_ik_branch_endpoint ON idempotency_keys(branch_id, endpoint, idempotency_key)`)
}

// ── Start server ──────────────────────────────────────────────────────────────
const port = parseInt(process.env['PORT'] ?? '3000', 10)

try {
  await app.listen({ port, host: '0.0.0.0' })
  app.log.info(`Server running on http://localhost:${port}`)
} catch (err) {
  app.log.error(err)
  process.exit(1)
}

export { app }
