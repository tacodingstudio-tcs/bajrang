// apps/api/src/routes/public.ts
// Unauthenticated endpoints for the guest-facing hotel website.
// Deliberately minimal — no auth, no req.db/req.schemaName (those come from
// tenantMiddleware, which only runs on the protected route group). Every
// handler here resolves its own tenant + branch from public.tenants.

import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { db } from '@billing/db'
import { getTenantDb } from '../lib/tenant-db.js'
import { razorpay, isRazorpayConfigured } from '../lib/razorpay.js'
import { whatsappQueue } from '../lib/queues.js'

function toE164(phone: string): string {
  // Length-based, not a startsWith('91') check — a bare 10-digit Indian
  // number can itself start with "91" (e.g. 9123456780), which would
  // wrongly be treated as already having the country code prefixed.
  const digits = phone.replace(/\D/g, '')
  return digits.length === 10 ? `91${digits}` : digits
}

function tbl(schemaName: string, table: string) {
  return `"${schemaName}"."${table}"`
}

function generateFolioNo(prefix: string = 'FLO'): string {
  const now = new Date()
  const yy  = String(now.getFullYear()).slice(2)
  const mm  = String(now.getMonth() + 1).padStart(2, '0')
  const seq = Math.floor(Math.random() * 9000) + 1000
  return `${prefix}-${yy}${mm}-${seq}`
}

// Single-tenant deployment for now — the public website has no tenant
// selector, so we resolve the one active hotel tenant. If this platform
// ever hosts multiple hotel websites, swap this for a slug/domain lookup.
async function resolveHotelTenant() {
  const tenant = await db.tenant.findFirst({
    where: { isActive: true, slug: { contains: 'hotel' } },
  })
  if (!tenant) throw Object.assign(new Error('No hotel tenant configured'), { statusCode: 404 })

  const tdb = getTenantDb(tenant.schemaName)
  const branch = await tdb.branch.findFirst({ where: { domainType: 'hotel', isActive: true } })
  if (!branch) throw Object.assign(new Error('No active hotel branch'), { statusCode: 404 })

  return { tenant, branch, tdb, schemaName: tenant.schemaName }
}

export const publicRoutes: FastifyPluginAsync = async (app) => {

  // GET /api/public/hotel — basic hotel profile for the site header/footer
  app.get('/hotel', async () => {
    const { tenant, branch } = await resolveHotelTenant()
    return {
      name:         branch.name,
      gstin:        branch.gstin,
      address:      branch.address,
      stateCode:    branch.stateCode,
      domainConfig: branch.domainConfig,
      tenantName:   tenant.name,
    }
  })

  // GET /api/public/website — every admin-editable website content section,
  // keyed by section name (hero, highlights, nearbyPlaces, reviews, guides,
  // footer). Sections with no row yet are simply absent from the response —
  // the website falls back to its own hardcoded defaults for those.
  app.get('/website', async () => {
    const { branch, tdb, schemaName } = await resolveHotelTenant()
    const rows = await tdb.$queryRawUnsafe<{ section: string; data: unknown }[]>(
      `SELECT "section", "data" FROM ${tbl(schemaName, 'hotel_website_content')} WHERE "branchId" = $1::uuid`,
      branch.id
    )
    return Object.fromEntries(rows.map((r) => [r.section, r.data]))
  })

  // GET /api/public/hotel/rooms — room types on offer, grouped, cheapest-first.
  // No live-availability filtering here (that needs date params); this is
  // catalogue data for the "Rooms" page.
  app.get('/hotel/rooms', async () => {
    const { branch, tdb, schemaName } = await resolveHotelTenant()
    const t = tbl(schemaName, 'hotel_rooms')
    const rows = await tdb.$queryRawUnsafe<any[]>(
      `SELECT r."roomType",
              MIN(r."ratePerNight")::float AS "fromRate",
              MAX(r."maxOccupancy")        AS "maxOccupancy",
              bool_or(r."hasAc")           AS "hasAc",
              bool_or(r."hasTv")           AS "hasTv",
              bool_or(r."hasWifi")         AS "hasWifi",
              bool_or(r."hasGeyser")       AS "hasGeyser",
              array_agg(DISTINCT r."viewType") FILTER (WHERE r."viewType" IS NOT NULL) AS "viewTypes",
              (array_agg(r."imageUrl") FILTER (WHERE r."imageUrl" IS NOT NULL))[1] AS "imageUrl",
              (array_agg(r."description") FILTER (WHERE r."description" IS NOT NULL))[1] AS "description",
              COUNT(*)::int AS "roomCount",
              -- array_agg over an already-array column produces a 2D array, where
              -- single-subscript [1] indexing silently returns NULL — so this one
              -- is picked via a correlated subquery instead of array_agg(...)[1].
              (SELECT x."images" FROM ${t} x
                WHERE x."branchId" = r."branchId" AND x."roomType" = r."roomType"
                  AND x."isActive" = true AND x."images" IS NOT NULL AND array_length(x."images", 1) > 0
                LIMIT 1) AS "images"
       FROM ${t} r
       WHERE r."branchId" = $1::uuid AND r."isActive" = true
       GROUP BY r."roomType", r."branchId"
       ORDER BY "fromRate" ASC`,
      branch.id
    )
    return rows
  })

  // POST /api/public/hotel/inquiry — guest submits a booking inquiry from the
  // website. Creates a `reserved` booking against the first available room of
  // the requested type so it shows up in the admin's Bookings list for staff
  // to confirm/call the guest back. Does not require a specific roomId — the
  // public site only lets guests pick a room *type*.
  app.post('/hotel/inquiry', async (req, reply) => {
    const body = z.object({
      guestName:    z.string().min(1).max(100),
      guestPhone:   z.string().min(10).max(15),
      guestEmail:   z.string().email().optional(),
      roomType:     z.string().min(1),
      checkIn:      z.string(),   // ISO date
      checkOut:     z.string(),   // ISO date
      adults:       z.number().int().min(1).default(1),
      children:     z.number().int().min(0).default(0),
      notes:        z.string().max(500).optional(),
    }).parse(req.body)

    if (new Date(body.checkOut) <= new Date(body.checkIn)) {
      return reply.status(422).send({ error: 'checkOut must be after checkIn' })
    }

    const { branch, tdb, schemaName } = await resolveHotelTenant()

    const availableRoom = await tdb.$queryRawUnsafe<any[]>(
      `SELECT r.* FROM ${tbl(schemaName, 'hotel_rooms')} r
       WHERE r."branchId" = $1::uuid AND r."roomType" = $2 AND r."isActive" = true
         AND r.status NOT IN ('maintenance','blocked')
         AND r.id NOT IN (
           SELECT "roomId" FROM ${tbl(schemaName, 'hotel_bookings')}
           WHERE status IN ('reserved','checked_in')
             AND "checkIn" < $4 AND "checkOut" > $3
         )
       ORDER BY r."ratePerNight" ASC LIMIT 1`,
      branch.id, body.roomType, new Date(body.checkIn), new Date(body.checkOut)
    )

    const room = availableRoom[0]
    if (!room) {
      return reply.status(409).send({ error: `No ${body.roomType} rooms available for those dates. Please call the hotel directly.` })
    }

    const nights = Math.max(1, Math.round((+new Date(body.checkOut) - +new Date(body.checkIn)) / 86400000))
    const ratePerNight = Number(room.ratePerNight)

    const booking = await tdb.$queryRawUnsafe<any[]>(
      `INSERT INTO ${tbl(schemaName, 'hotel_bookings')}
         (id, "branchId", "folioNo", "roomId", "guestName", "guestPhone", "guestEmail",
          adults, children, "checkIn", "checkOut", "bookingSource", "mealPlan",
          "advancePaid", "ratePerNight", "totalAmount", status, notes)
       VALUES (gen_random_uuid(), $1::uuid, $2, $3::uuid, $4, $5, $6,
               $7, $8, $9, $10, 'website', 'EP',
               0, $11, $12, 'reserved', $13)
       RETURNING *`,
      branch.id, generateFolioNo('WEB'), room.id, body.guestName, body.guestPhone,
      body.guestEmail ?? null, body.adults, body.children,
      new Date(body.checkIn), new Date(body.checkOut), ratePerNight, ratePerNight * nights,
      body.notes ?? null
    )

    const totalAmount = ratePerNight * nights

    // Deposit payment link — 20% of the estimated total, so a guest can
    // secure the booking immediately instead of waiting for a callback.
    // Best-effort: Razorpay being unconfigured, or the API call failing,
    // must never fail the inquiry itself — the booking already exists and
    // staff will call to confirm either way.
    let depositLink: string | null = null
    let depositAmount = 0
    if (isRazorpayConfigured()) {
      try {
        depositAmount = Math.round(totalAmount * 0.2)
        const paymentLink = await razorpay.paymentLink.create({
          amount:   depositAmount * 100, // paise
          currency: 'INR',
          accept_partial: false,
          description: `Booking deposit — ${booking[0].folioNo}`,
          customer: {
            name:    body.guestName,
            contact: body.guestPhone,
            email:   body.guestEmail,
          },
          notify: { sms: false, email: false },
          reference_id: booking[0].folioNo,
          notes: {
            schemaName: schemaName,
            bookingId:  booking[0].id,
            branchId:   branch.id,
          },
        })
        depositLink = paymentLink.short_url
      } catch (err) {
        console.error('[public.hotel.inquiry] Razorpay deposit link failed:', (err as Error).message)
      }
    }

    const message =
      `Hi ${body.guestName}, your booking inquiry at ${branch.name} is received! 🙏\n` +
      `Folio: ${booking[0].folioNo}\n` +
      `Room: ${room.roomType} (${room.roomNo})\n` +
      `Estimated total: ₹${totalAmount.toFixed(0)}\n\n` +
      (depositLink
        ? `Secure your booking by paying a ₹${depositAmount} deposit:\n${depositLink}`
        : `Our team will call shortly to confirm your booking.`)

    try {
      await whatsappQueue.add('hotel_message', { type: 'hotel_message', toPhone: toE164(body.guestPhone), message })
    } catch (err) {
      console.error('[public.hotel.inquiry] failed to queue guest WhatsApp message:', (err as Error).message)
    }

    return reply.status(201).send({
      folioNo:  booking[0].folioNo,
      roomType: room.roomType,
      roomNo:   room.roomNo,
      nights,
      totalAmount,
      depositLink,
      depositAmount: depositLink ? depositAmount : null,
      message: depositLink
        ? 'Inquiry received — pay the deposit to secure your booking, or wait for our team to call.'
        : 'Inquiry received — our team will call to confirm your booking.',
    })
  })
}
