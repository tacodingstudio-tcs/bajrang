// apps/api/src/routes/website-content.ts
// Admin CRUD for the public hotel website's editable content sections
// (hero, highlights, nearbyPlaces, reviews, guides, footer). Each section is
// a JSONB blob in hotel_website_content, keyed by name — the public site
// reads these via GET /api/public/website and falls back to its own
// hardcoded defaults for any section that has no row yet.
//
//  GET   /api/website             all sections for this branch, keyed by name
//  PATCH /api/website/:section    upsert one section's data (owner only)

import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'

function tbl(schemaName: string, table: string) {
  return `"${schemaName}"."${table}"`
}

const SECTIONS = [
  'hero', 'highlights', 'nearbyPlaces', 'reviews', 'guides', 'footer', 'contact', 'gallery',
  'privacyPolicy', 'termsConditions',
] as const

// Defensive cap on total section size — gallery images can be uploaded as
// base64 data URIs, so this isn't just tiny text fields. 8MB comfortably
// covers ~15 uploaded photos at the per-image cap enforced below.
const MAX_SECTION_BYTES = 8_000_000
const MAX_GALLERY_IMAGE_BYTES = 700_000 // base64 — matches the 500KB raw-image cap used elsewhere

export const websiteContentRoutes: FastifyPluginAsync = async (app) => {

  app.get('/', async (req, reply) => {
    if (!['owner', 'super_user'].includes(req.role))
      return reply.status(403).send({ error: 'Only the owner or super user can view website content' })

    const rows = await req.db.$queryRawUnsafe<{ section: string; data: unknown }[]>(
      `SELECT "section", "data" FROM ${tbl(req.schemaName, 'hotel_website_content')} WHERE "branchId" = $1::uuid`,
      req.branchId
    )
    return Object.fromEntries(rows.map((r) => [r.section, r.data]))
  })

  app.patch('/:section', async (req, reply) => {
    if (!['owner', 'super_user'].includes(req.role))
      return reply.status(403).send({ error: 'Only the owner or super user can edit website content' })

    const { section } = z.object({ section: z.enum(SECTIONS) }).parse(req.params)
    const data = z.record(z.unknown()).or(z.array(z.unknown())).parse(req.body)

    const serialized = JSON.stringify(data)
    if (serialized.length > MAX_SECTION_BYTES)
      return reply.status(413).send({ error: 'This section is too large to save — remove or shrink some images' })

    if (section === 'gallery') {
      const items = (data as { items?: { url?: string }[] }).items ?? []
      const oversized = items.find((it) => it.url?.startsWith('data:') && it.url.length > MAX_GALLERY_IMAGE_BYTES)
      if (oversized)
        return reply.status(413).send({ error: 'One of the uploaded images is too large (max ~500KB each)' })
    }

    await req.db.$executeRawUnsafe(
      `INSERT INTO ${tbl(req.schemaName, 'hotel_website_content')} ("branchId", "section", "data", "updatedAt")
       VALUES ($1::uuid, $2, $3::jsonb, NOW())
       ON CONFLICT ("branchId", "section")
       DO UPDATE SET "data" = $3::jsonb, "updatedAt" = NOW()`,
      req.branchId, section, JSON.stringify(data)
    )

    return { section, data }
  })
}
