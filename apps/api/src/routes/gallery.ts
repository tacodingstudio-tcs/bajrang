// apps/api/src/routes/gallery.ts
import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'

// Domains that support gallery
const GALLERY_DOMAINS = new Set([
  'photography', 'salon', 'repair', 'catering', 'printing', 'hotel',
  'pest_control', 'laundry', 'automobile',
])

const MAX_IMAGE_BYTES = 500_000 // 500 KB base64 limit per image

export const galleryRoutes: FastifyPluginAsync = async (app) => {

  // GET /api/gallery — list items for this branch (optionally filtered by party)
  app.get('/', async (req) => {
    const query = z.object({
      partyId: z.string().uuid().optional(),
      limit:   z.coerce.number().default(24),
      offset:  z.coerce.number().default(0),
    }).parse(req.query)

    const items = await req.db.galleryItem.findMany({
      where: {
        branchId: req.branchId,
        ...(query.partyId && { partyId: query.partyId }),
      },
      select: {
        id: true, caption: true, tags: true, domainType: true,
        thumbData: true, partyId: true, invoiceId: true, createdAt: true,
        party: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take:    query.limit,
      skip:    query.offset,
    })

    const total = await req.db.galleryItem.count({
      where: {
        branchId: req.branchId,
        ...(query.partyId && { partyId: query.partyId }),
      },
    })

    return { data: items, meta: { total, limit: query.limit, offset: query.offset } }
  })

  // GET /api/gallery/:id — get full image data
  app.get('/:id', async (req) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params)
    const item   = await req.db.galleryItem.findFirst({
      where: { id, branchId: req.branchId },
    })
    if (!item) throw Object.assign(new Error('Not found'), { statusCode: 404 })
    return item
  })

  // POST /api/gallery — upload new image
  app.post('/', async (req, reply) => {
    const input = z.object({
      imageData:  z.string().min(6).max(MAX_IMAGE_BYTES * 1.4), // base64 image or video: URL
      thumbData:  z.string().max(MAX_IMAGE_BYTES * 0.2).optional(),
      caption:    z.string().max(200).optional(),
      tags:       z.array(z.string().max(50)).max(10).default([]),
      partyId:    z.string().uuid().optional(),
      invoiceId:  z.string().uuid().optional(),
      domainType: z.string().max(60),
    }).parse(req.body)

    // Allow base64 image data URIs OR video: URL references (YouTube, Drive, Vimeo, etc.)
    const isImage = input.imageData.startsWith('data:image/')
    const isVideo = input.imageData.startsWith('video:') || input.imageData.startsWith('gdrive:')
    if (!isImage && !isVideo) {
      return reply.status(400).send({ error: 'imageData must be a base64 image data URI or a video: URL reference' })
    }

    const item = await req.db.galleryItem.create({
      data: {
        branchId:   req.branchId,
        partyId:    input.partyId ?? null,
        invoiceId:  input.invoiceId ?? null,
        imageData:  input.imageData,
        thumbData:  input.thumbData ?? null,
        caption:    input.caption ?? null,
        tags:       input.tags,
        domainType: input.domainType,
      },
      select: {
        id: true, caption: true, tags: true, domainType: true,
        thumbData: true, partyId: true, createdAt: true,
      },
    })

    return reply.status(201).send(item)
  })

  // PATCH /api/gallery/:id — update caption / tags
  app.patch('/:id', async (req) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params)
    const input   = z.object({
      caption: z.string().max(200).optional(),
      tags:    z.array(z.string().max(50)).max(10).optional(),
    }).parse(req.body)

    const existing = await req.db.galleryItem.findFirst({ where: { id, branchId: req.branchId } })
    if (!existing) throw Object.assign(new Error('Not found'), { statusCode: 404 })

    return req.db.galleryItem.update({
      where: { id },
      data: {
        ...(input.caption !== undefined && { caption: input.caption }),
        ...(input.tags    !== undefined && { tags:    input.tags    }),
      },
      select: { id: true, caption: true, tags: true },
    } as any)
  })

  // DELETE /api/gallery/:id
  app.delete('/:id', async (req, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params)
    const existing = await req.db.galleryItem.findFirst({ where: { id, branchId: req.branchId } })
    if (!existing) throw Object.assign(new Error('Not found'), { statusCode: 404 })
    await req.db.galleryItem.delete({ where: { id } })
    return reply.status(204).send()
  })
}

export { GALLERY_DOMAINS }
