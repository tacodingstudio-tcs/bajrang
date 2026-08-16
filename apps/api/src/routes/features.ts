// apps/api/src/routes/features.ts
// Tenant-wide feature toggles — deliberately its own tiny route, separate
// from the full Branches CRUD API, so super_user (narrow role) can flip
// these without gaining any of the broader branch-management power that
// route carries (renaming the branch, GSTIN, deactivating it, etc.).
//
//  GET   /api/features    current toggles for this branch
//  PATCH /api/features    update one or more toggles (owner or super_user)

import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'

export const featureRoutes: FastifyPluginAsync = async (app) => {

  app.get('/', async (req) => {
    const branch = await req.db.branch.findUnique({
      where:  { id: req.branchId },
      select: { domainConfig: true },
    })
    const config = (branch?.domainConfig as { contractsEnabled?: boolean; deliveriesEnabled?: boolean }) ?? {}
    return {
      contractsEnabled:  config.contractsEnabled  ?? false,
      deliveriesEnabled: config.deliveriesEnabled ?? false,
    }
  })

  app.patch('/', async (req, reply) => {
    if (!['owner', 'super_user'].includes(req.role))
      return reply.status(403).send({ error: 'Only the owner or super user can change feature settings' })

    const body = z.object({
      contractsEnabled:  z.boolean().optional(),
      deliveriesEnabled: z.boolean().optional(),
    }).parse(req.body)

    const branch = await req.db.branch.findUnique({
      where:  { id: req.branchId },
      select: { domainConfig: true },
    })
    const existing = (branch?.domainConfig as object) ?? {}

    const updated = await req.db.branch.update({
      where: { id: req.branchId },
      data:  { domainConfig: { ...existing, ...body } as never },
      select: { domainConfig: true },
    })

    const config = updated.domainConfig as { contractsEnabled?: boolean; deliveriesEnabled?: boolean }
    return {
      contractsEnabled:  config.contractsEnabled  ?? false,
      deliveriesEnabled: config.deliveriesEnabled ?? false,
    }
  })
}
