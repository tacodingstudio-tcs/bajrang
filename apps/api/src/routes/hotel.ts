// apps/api/src/routes/hotel.ts
// Complete hotel management system — rooms, bookings, folios, housekeeping, night audit

import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'

// ── Helper: raw SQL against tenant schema ────────────────────────────────────
// Prisma doesn't know about our dynamic hotel_* tables; we use $queryRawUnsafe
// with the schema name injected from req.schemaName (set by tenantMiddleware).
// All inputs are parameterised — never string-interpolated into SQL.

function tbl(schemaName: string, table: string) {
  return `"${schemaName}"."${table}"`
}

// ── Folio number generator ────────────────────────────────────────────────────
function generateFolioNo(prefix: string = 'FLO'): string {
  const now = new Date()
  const yy  = String(now.getFullYear()).slice(2)
  const mm  = String(now.getMonth() + 1).padStart(2, '0')
  const seq = Math.floor(Math.random() * 9000) + 1000
  return `${prefix}-${yy}${mm}-${seq}`
}

// ─────────────────────────────────────────────────────────────────────────────
export const hotelRoutes: FastifyPluginAsync = async (app) => {

  // Allow POST requests with no body (e.g. /night-audit) that lack Content-Type
  app.addContentTypeParser('*', (_req, payload, done) => done(null, null))

  // ══════════════════════════════════════════════════════════════════════════
  // DASHBOARD
  // ══════════════════════════════════════════════════════════════════════════

  // GET /api/hotel/dashboard
  app.get('/dashboard', async (req) => {
    const s = req.schemaName
    const b = req.branchId
    const today = new Date().toISOString().split('T')[0]!

    const [rooms, bookings, housekeeping] = await Promise.all([
      req.db.$queryRawUnsafe<any[]>(
        `SELECT status, COUNT(*) as count FROM ${tbl(s,'hotel_rooms')}
         WHERE "branchId" = $1::uuid AND "isActive" = true GROUP BY status`,
        b
      ),
      req.db.$queryRawUnsafe<any[]>(
        `SELECT * FROM ${tbl(s,'hotel_bookings')}
         WHERE "branchId" = $1::uuid
           AND status IN ('reserved','checked_in')
           AND (DATE("checkIn") = $2::date OR DATE("checkOut") = $2::date OR status = 'checked_in')
         ORDER BY "checkIn" ASC`,
        b, today
      ),
      req.db.$queryRawUnsafe<any[]>(
        `SELECT hk.*, r."roomNo", r."floor"
         FROM ${tbl(s,'hotel_housekeeping')} hk
         JOIN ${tbl(s,'hotel_rooms')} r ON r.id = hk."roomId"
         WHERE hk."branchId" = $1::uuid AND hk."scheduledFor" = $2::date AND hk.status != 'done'
         ORDER BY hk.priority DESC, r."roomNo"`,
        b, today
      ),
    ])

    const roomStats: Record<string, number> = {}
    let totalRooms = 0
    for (const r of rooms) {
      roomStats[r.status] = Number(r.count)
      totalRooms += Number(r.count)
    }

    const arrivalsToday   = bookings.filter(bk => bk.status === 'reserved'    && new Date(bk.checkIn).toISOString().startsWith(today))
    const departuresToday = bookings.filter(bk => bk.status === 'checked_in'  && new Date(bk.checkOut).toISOString().startsWith(today))
    const inHouse         = bookings.filter(bk => bk.status === 'checked_in')

    return {
      roomStats: {
        total:       totalRooms,
        available:   roomStats['available']   ?? 0,
        occupied:    roomStats['occupied']    ?? 0,
        dirty:       roomStats['dirty']       ?? 0,
        maintenance: roomStats['maintenance'] ?? 0,
        blocked:     roomStats['blocked']     ?? 0,
      },
      occupancyPct: totalRooms > 0
        ? Math.round(((roomStats['occupied'] ?? 0) / totalRooms) * 100)
        : 0,
      arrivalsToday,
      departuresToday,
      inHouse,
      housekeepingPending: housekeeping,
    }
  })

  // ══════════════════════════════════════════════════════════════════════════
  // ROOMS
  // ══════════════════════════════════════════════════════════════════════════

  // GET /api/hotel/rooms
  app.get('/rooms', async (req) => {
    const query = z.object({
      status: z.string().optional(),
      floor:  z.string().optional(),
    }).parse(req.query)

    const s = req.schemaName
    const b = req.branchId

    let sql = `SELECT * FROM ${tbl(s,'hotel_rooms')} WHERE "branchId" = $1::uuid AND "isActive" = true`
    const params: any[] = [b]
    if (query.status) { params.push(query.status); sql += ` AND status = $${params.length}` }
    if (query.floor)  { params.push(query.floor);  sql += ` AND floor = $${params.length}` }
    sql += ` ORDER BY "roomNo" ASC`

    return req.db.$queryRawUnsafe<any[]>(sql, ...params)
  })

  // POST /api/hotel/rooms
  app.post('/rooms', async (req, reply) => {
    const body = z.object({
      roomNo:       z.string().min(1),
      roomType:     z.string().default('standard'),
      floor:        z.string().optional(),
      bedType:      z.string().optional(),
      maxOccupancy: z.number().int().min(1).default(2),
      ratePerNight: z.number().min(0),
      weekendRate:  z.number().min(0).optional(),
      hasAc:        z.boolean().default(true),
      hasTv:        z.boolean().default(true),
      hasGeyser:    z.boolean().default(true),
      hasWifi:      z.boolean().default(true),
      viewType:     z.string().optional(),
      amenities:    z.array(z.string()).default([]),
      notes:        z.string().optional(),
    }).parse(req.body)

    const s = req.schemaName
    const b = req.branchId

    const rows = await req.db.$queryRawUnsafe<any[]>(
      `INSERT INTO ${tbl(s,'hotel_rooms')}
        ("branchId","roomNo","roomType","floor","bedType","maxOccupancy","ratePerNight","weekendRate",
         "hasAc","hasTv","hasGeyser","hasWifi","viewType","amenities","notes")
       VALUES ($1::uuid,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
       RETURNING *`,
      b, body.roomNo, body.roomType, body.floor ?? null, body.bedType ?? null,
      body.maxOccupancy, body.ratePerNight, body.weekendRate ?? null,
      body.hasAc, body.hasTv, body.hasGeyser, body.hasWifi,
      body.viewType ?? null, body.amenities, body.notes ?? null
    )
    return reply.status(201).send(rows[0])
  })

  // GET /api/hotel/rooms/:id
  app.get('/rooms/:id', async (req, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params)
    const s = req.schemaName
    const b = req.branchId
    const rows = await req.db.$queryRawUnsafe<any[]>(
      `SELECT * FROM ${tbl(s,'hotel_rooms')} WHERE id = $1::uuid AND "branchId" = $2::uuid`,
      id, b
    )
    if (!rows[0]) return reply.status(404).send({ error: 'Room not found' })
    return rows[0]
  })

  // PATCH /api/hotel/rooms/:id
  app.patch('/rooms/:id', async (req, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params)
    const body = z.object({
      roomNo:       z.string().optional(),
      roomType:     z.string().optional(),
      floor:        z.string().optional(),
      bedType:      z.string().optional(),
      maxOccupancy: z.number().int().optional(),
      ratePerNight: z.number().optional(),
      weekendRate:  z.number().nullable().optional(),
      hasAc:        z.boolean().optional(),
      hasTv:        z.boolean().optional(),
      hasGeyser:    z.boolean().optional(),
      hasWifi:      z.boolean().optional(),
      viewType:     z.string().nullable().optional(),
      amenities:    z.array(z.string()).optional(),
      status:       z.enum(['available','occupied','dirty','maintenance','blocked']).optional(),
      notes:        z.string().nullable().optional(),
      isActive:     z.boolean().optional(),
    }).parse(req.body)

    const s = req.schemaName
    const b = req.branchId
    const sets: string[] = []
    const params: any[] = [id, b]

    const map: Record<string, any> = body
    for (const [key, val] of Object.entries(map)) {
      if (val !== undefined) {
        params.push(val)
        sets.push(`"${key}" = $${params.length}`)
      }
    }
    if (sets.length === 0) return reply.status(400).send({ error: 'Nothing to update' })

    const rows = await req.db.$queryRawUnsafe<any[]>(
      `UPDATE ${tbl(s,'hotel_rooms')} SET ${sets.join(', ')} WHERE id = $1::uuid AND "branchId" = $2::uuid RETURNING *`,
      ...params
    )
    if (!rows[0]) return reply.status(404).send({ error: 'Room not found' })
    return rows[0]
  })

  // DELETE /api/hotel/rooms/:id  (soft-delete)
  app.delete('/rooms/:id', async (req, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params)
    const s = req.schemaName
    const b = req.branchId
    await req.db.$executeRawUnsafe(
      `UPDATE ${tbl(s,'hotel_rooms')} SET "isActive" = false WHERE id = $1::uuid AND "branchId" = $2::uuid`,
      id, b
    )
    return reply.send({ ok: true })
  })

  // ══════════════════════════════════════════════════════════════════════════
  // BOOKINGS
  // ══════════════════════════════════════════════════════════════════════════

  // GET /api/hotel/bookings
  app.get('/bookings', async (req) => {
    const query = z.object({
      status:   z.string().optional(),
      date:     z.string().optional(),   // filter by check-in date (YYYY-MM-DD)
      roomId:   z.string().uuid().optional(),
      search:   z.string().optional(),
      page:     z.coerce.number().default(1),
      limit:    z.coerce.number().default(20),
    }).parse(req.query)

    const s = req.schemaName
    const b = req.branchId
    const offset = (query.page - 1) * query.limit

    let where = `WHERE bk."branchId" = $1::uuid`
    const params: any[] = [b]

    if (query.status) {
      const statuses = query.status.split(',')
      const placeholders = statuses.map((_, i) => `$${params.length + 1 + i}`).join(',')
      params.push(...statuses)
      where += ` AND bk.status IN (${placeholders})`
    }
    if (query.date) {
      params.push(query.date)
      where += ` AND DATE(bk."checkIn") = $${params.length}::date`
    }
    if (query.roomId) {
      params.push(query.roomId)
      where += ` AND bk."roomId" = $${params.length}::uuid`
    }
    if (query.search) {
      params.push(`%${query.search}%`)
      where += ` AND (bk."guestName" ILIKE $${params.length} OR bk."folioNo" ILIKE $${params.length} OR bk."guestPhone" ILIKE $${params.length})`
    }

    const [bookings, totals] = await Promise.all([
      req.db.$queryRawUnsafe<any[]>(
        `SELECT bk.*, r."roomNo", r."roomType", r."floor"
         FROM ${tbl(s,'hotel_bookings')} bk
         LEFT JOIN ${tbl(s,'hotel_rooms')} r ON r.id = bk."roomId"
         ${where}
         ORDER BY bk."checkIn" DESC
         LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        ...params, query.limit, offset
      ),
      req.db.$queryRawUnsafe<any[]>(
        `SELECT COUNT(*) as count FROM ${tbl(s,'hotel_bookings')} bk ${where}`,
        ...params
      ),
    ])

    return {
      data:  bookings,
      total: Number(totals[0]?.count ?? 0),
      page:  query.page,
      limit: query.limit,
    }
  })

  // POST /api/hotel/bookings  — create reservation
  app.post('/bookings', async (req, reply) => {
    const body = z.object({
      roomId:        z.string().uuid(),
      guestName:     z.string().min(1),
      guestPhone:    z.string().optional(),
      guestEmail:    z.string().email().optional(),
      nationality:   z.string().default('Indian'),
      idType:        z.string().optional(),
      idNumber:      z.string().optional(),
      adults:        z.number().int().min(1).default(1),
      children:      z.number().int().min(0).default(0),
      checkIn:       z.string(),   // ISO datetime
      checkOut:      z.string(),   // ISO datetime
      bookingSource: z.string().default('walk_in'),
      bookingRef:    z.string().optional(),
      mealPlan:      z.string().default('EP'),
      advancePaid:   z.number().min(0).default(0),
      ratePerNight:  z.number().min(0),
      notes:         z.string().optional(),
    }).parse(req.body)

    const s = req.schemaName
    const b = req.branchId

    // Validate room exists + is available
    const roomRows = await req.db.$queryRawUnsafe<any[]>(
      `SELECT * FROM ${tbl(s,'hotel_rooms')} WHERE id = $1::uuid AND "branchId" = $2::uuid AND "isActive" = true`,
      body.roomId, b
    )
    if (!roomRows[0]) return reply.status(404).send({ error: 'Room not found' })
    if (roomRows[0].status === 'maintenance' || roomRows[0].status === 'blocked') {
      return reply.status(422).send({ error: `Room is ${roomRows[0].status} and cannot be booked` })
    }

    // Check for overlapping booking
    const conflicts = await req.db.$queryRawUnsafe<any[]>(
      `SELECT id FROM ${tbl(s,'hotel_bookings')}
       WHERE "roomId" = $1::uuid AND status IN ('reserved','checked_in')
         AND "checkIn" < $3 AND "checkOut" > $2`,
      body.roomId, new Date(body.checkIn), new Date(body.checkOut)
    )
    if (conflicts.length > 0) {
      return reply.status(409).send({ error: 'Room already booked for those dates' })
    }

    // Calculate nights and total
    const msPerNight = 86400000
    const nights     = Math.max(1, Math.round(
      (new Date(body.checkOut).getTime() - new Date(body.checkIn).getTime()) / msPerNight
    ))
    const totalAmount = nights * body.ratePerNight

    const folioNo = generateFolioNo('FLO')

    const rows = await req.db.$queryRawUnsafe<any[]>(
      `INSERT INTO ${tbl(s,'hotel_bookings')}
        ("branchId","folioNo","roomId","guestName","guestPhone","guestEmail","nationality",
         "idType","idNumber","adults","children","checkIn","checkOut","bookingSource","bookingRef",
         "mealPlan","advancePaid","ratePerNight","totalAmount","notes","createdBy")
       VALUES ($1::uuid,$2,$3::uuid,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21::uuid)
       RETURNING *`,
      b, folioNo, body.roomId, body.guestName, body.guestPhone ?? null, body.guestEmail ?? null,
      body.nationality, body.idType ?? null, body.idNumber ?? null,
      body.adults, body.children, new Date(body.checkIn), new Date(body.checkOut),
      body.bookingSource, body.bookingRef ?? null, body.mealPlan,
      body.advancePaid, body.ratePerNight, totalAmount, body.notes ?? null, req.userId
    )

    // Add initial advance charge to folio if advance paid
    if (body.advancePaid > 0) {
      await req.db.$executeRawUnsafe(
        `INSERT INTO ${tbl(s,'hotel_folio_charges')}
          ("bookingId","branchId","chargeType","description","qty","rate","amount","date","addedBy")
         VALUES ($1::uuid,$2::uuid,'other','Advance Payment (Credit)',$3,$4,$5,CURRENT_DATE,$6::uuid)`,
        rows[0].id, b, 1, -body.advancePaid, -body.advancePaid, req.userId
      )
    }

    return reply.status(201).send(rows[0])
  })

  // GET /api/hotel/bookings/:id  — booking + folio charges
  app.get('/bookings/:id', async (req, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params)
    const s = req.schemaName
    const b = req.branchId

    const [bookings, charges] = await Promise.all([
      req.db.$queryRawUnsafe<any[]>(
        `SELECT bk.*, r."roomNo", r."roomType", r."floor", r."maxOccupancy"
         FROM ${tbl(s,'hotel_bookings')} bk
         LEFT JOIN ${tbl(s,'hotel_rooms')} r ON r.id = bk."roomId"
         WHERE bk.id = $1::uuid AND bk."branchId" = $2::uuid`,
        id, b
      ),
      req.db.$queryRawUnsafe<any[]>(
        `SELECT * FROM ${tbl(s,'hotel_folio_charges')}
         WHERE "bookingId" = $1::uuid ORDER BY "createdAt" ASC`,
        id
      ),
    ])

    if (!bookings[0]) return reply.status(404).send({ error: 'Booking not found' })

    const totalCharges = charges.reduce((sum, c) => sum + Number(c.amount), 0)
    const booking = bookings[0]

    return {
      ...booking,
      charges,
      totalCharges,
      balance: totalCharges - Number(booking.advancePaid),
    }
  })

  // PATCH /api/hotel/bookings/:id
  app.patch('/bookings/:id', async (req, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params)
    const body = z.object({
      guestName:     z.string().optional(),
      guestPhone:    z.string().nullable().optional(),
      guestEmail:    z.string().nullable().optional(),
      nationality:   z.string().optional(),
      idType:        z.string().nullable().optional(),
      idNumber:      z.string().nullable().optional(),
      adults:        z.number().int().optional(),
      children:      z.number().int().optional(),
      checkIn:       z.string().optional(),
      checkOut:      z.string().optional(),
      bookingSource: z.string().optional(),
      bookingRef:    z.string().nullable().optional(),
      mealPlan:      z.string().optional(),
      advancePaid:   z.number().optional(),
      ratePerNight:  z.number().optional(),
      status:        z.enum(['reserved','checked_in','checked_out','cancelled','no_show']).optional(),
      notes:         z.string().nullable().optional(),
      formCFiled:    z.boolean().optional(),
    }).parse(req.body)

    const s = req.schemaName
    const b = req.branchId
    const sets: string[] = [`"updatedAt" = NOW()`]
    const params: any[] = [id, b]

    const map: Record<string, any> = body
    for (const [key, val] of Object.entries(map)) {
      if (val !== undefined) {
        const v = (key === 'checkIn' || key === 'checkOut') ? new Date(val as string) : val
        params.push(v)
        sets.push(`"${key}" = $${params.length}`)
      }
    }

    const rows = await req.db.$queryRawUnsafe<any[]>(
      `UPDATE ${tbl(s,'hotel_bookings')} SET ${sets.join(', ')}
       WHERE id = $1::uuid AND "branchId" = $2::uuid RETURNING *`,
      ...params
    )
    if (!rows[0]) return reply.status(404).send({ error: 'Booking not found' })
    return rows[0]
  })

  // ══════════════════════════════════════════════════════════════════════════
  // CHECK-IN
  // ══════════════════════════════════════════════════════════════════════════

  // POST /api/hotel/bookings/:id/checkin
  app.post('/bookings/:id/checkin', async (req, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params)
    const body = z.object({
      idType:     z.string().optional(),
      idNumber:   z.string().optional(),
      formCFiled: z.boolean().default(false),
      notes:      z.string().optional(),
    }).parse(req.body)

    const s = req.schemaName
    const b = req.branchId

    const rows = await req.db.$queryRawUnsafe<any[]>(
      `SELECT * FROM ${tbl(s,'hotel_bookings')} WHERE id = $1::uuid AND "branchId" = $2::uuid`,
      id, b
    )
    const booking = rows[0]
    if (!booking) return reply.status(404).send({ error: 'Booking not found' })
    if (booking.status !== 'reserved') {
      return reply.status(422).send({ error: `Cannot check in — booking status is ${booking.status}` })
    }

    const now = new Date()

    // Update booking status + room status simultaneously
    const [updated] = await Promise.all([
      req.db.$queryRawUnsafe<any[]>(
        `UPDATE ${tbl(s,'hotel_bookings')}
         SET status = 'checked_in', "actualCheckIn" = $3,
             "idType" = COALESCE($4, "idType"), "idNumber" = COALESCE($5, "idNumber"),
             "formCFiled" = $6, "updatedAt" = NOW()
         WHERE id = $1::uuid AND "branchId" = $2::uuid RETURNING *`,
        id, b, now, body.idType ?? null, body.idNumber ?? null, body.formCFiled
      ),
      req.db.$executeRawUnsafe(
        `UPDATE ${tbl(s,'hotel_rooms')} SET status = 'occupied' WHERE id = $1::uuid AND "branchId" = $2::uuid`,
        booking.roomId, b
      ),
    ])

    // Add first-night room charge to folio
    await req.db.$executeRawUnsafe(
      `INSERT INTO ${tbl(s,'hotel_folio_charges')}
        ("bookingId","branchId","chargeType","description","qty","rate","amount","gstRate","date","addedBy")
       VALUES ($1::uuid,$2::uuid,'room',$3,1,$4,$5,12,CURRENT_DATE,$6::uuid)`,
      id, b, `Room ${booking.roomNo ?? ''} – Night 1`, Number(booking.ratePerNight),
      Number(booking.ratePerNight), req.userId
    )

    // Create housekeeping task for the next morning
    await req.db.$executeRawUnsafe(
      `INSERT INTO ${tbl(s,'hotel_housekeeping')}
        ("branchId","roomId","bookingId","taskType","status","priority","scheduledFor")
       VALUES ($1::uuid,$2::uuid,$3::uuid,'stay_clean','pending','normal',CURRENT_DATE + 1)`,
      b, booking.roomId, id
    )

    return reply.send(updated[0])
  })

  // ══════════════════════════════════════════════════════════════════════════
  // CHECK-OUT
  // ══════════════════════════════════════════════════════════════════════════

  // POST /api/hotel/bookings/:id/checkout
  app.post('/bookings/:id/checkout', async (req, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params)
    const body = z.object({
      paymentMethod: z.enum(['cash','card','upi','cheque','bank_transfer']).default('cash'),
      notes:         z.string().optional(),
    }).parse(req.body)

    const s = req.schemaName
    const b = req.branchId

    const rows = await req.db.$queryRawUnsafe<any[]>(
      `SELECT * FROM ${tbl(s,'hotel_bookings')} WHERE id = $1::uuid AND "branchId" = $2::uuid`,
      id, b
    )
    const booking = rows[0]
    if (!booking) return reply.status(404).send({ error: 'Booking not found' })
    if (booking.status !== 'checked_in') {
      return reply.status(422).send({ error: `Cannot check out — booking status is ${booking.status}` })
    }

    // Sum all folio charges
    const chargeRows = await req.db.$queryRawUnsafe<any[]>(
      `SELECT COALESCE(SUM(amount),0) as total FROM ${tbl(s,'hotel_folio_charges')} WHERE "bookingId" = $1::uuid`,
      id
    )
    const totalCharges = Number(chargeRows[0]?.total ?? 0)
    const balance      = totalCharges - Number(booking.advancePaid)

    const now = new Date()

    // Update booking + room status
    const [updated] = await Promise.all([
      req.db.$queryRawUnsafe<any[]>(
        `UPDATE ${tbl(s,'hotel_bookings')}
         SET status = 'checked_out', "actualCheckOut" = $3, "totalAmount" = $4, "updatedAt" = NOW()
         WHERE id = $1::uuid AND "branchId" = $2::uuid RETURNING *`,
        id, b, now, totalCharges
      ),
      req.db.$executeRawUnsafe(
        `UPDATE ${tbl(s,'hotel_rooms')} SET status = 'dirty' WHERE id = $1::uuid AND "branchId" = $2::uuid`,
        booking.roomId, b
      ),
    ])

    // Schedule checkout-clean housekeeping task
    await req.db.$executeRawUnsafe(
      `INSERT INTO ${tbl(s,'hotel_housekeeping')}
        ("branchId","roomId","bookingId","taskType","status","priority","scheduledFor")
       VALUES ($1::uuid,$2::uuid,$3::uuid,'checkout_clean','pending','high',CURRENT_DATE)`,
      b, booking.roomId, id
    )

    return reply.send({
      booking: updated[0],
      summary: {
        totalCharges,
        advancePaid: Number(booking.advancePaid),
        balanceDue:  Math.max(0, balance),
        refundable:  balance < 0 ? Math.abs(balance) : 0,
        paymentMethod: body.paymentMethod,
      },
    })
  })

  // ══════════════════════════════════════════════════════════════════════════
  // FOLIO CHARGES
  // ══════════════════════════════════════════════════════════════════════════

  // POST /api/hotel/bookings/:id/charges
  app.post('/bookings/:id/charges', async (req, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params)
    const body = z.object({
      chargeType:  z.enum(['room','food','laundry','minibar','spa','transport','telephone','other']).default('other'),
      description: z.string().min(1),
      qty:         z.number().min(0).default(1),
      rate:        z.number(),
      gstRate:     z.number().min(0).default(0),
      date:        z.string().optional(),
    }).parse(req.body)

    const s = req.schemaName
    const b = req.branchId

    // Ensure booking exists in this branch
    const bkRows = await req.db.$queryRawUnsafe<any[]>(
      `SELECT id, status FROM ${tbl(s,'hotel_bookings')} WHERE id = $1::uuid AND "branchId" = $2::uuid`,
      id, b
    )
    if (!bkRows[0]) return reply.status(404).send({ error: 'Booking not found' })
    if (bkRows[0].status === 'checked_out' || bkRows[0].status === 'cancelled') {
      return reply.status(422).send({ error: 'Cannot add charges to a closed folio' })
    }

    const amount = Number((body.qty * body.rate).toFixed(2))

    const rows = await req.db.$queryRawUnsafe<any[]>(
      `INSERT INTO ${tbl(s,'hotel_folio_charges')}
        ("bookingId","branchId","chargeType","description","qty","rate","amount","gstRate","date","addedBy")
       VALUES ($1::uuid,$2::uuid,$3,$4,$5,$6,$7,$8,$9,$10::uuid)
       RETURNING *`,
      id, b, body.chargeType, body.description,
      body.qty, body.rate, amount, body.gstRate,
      body.date ? new Date(body.date) : new Date(), req.userId
    )
    return reply.status(201).send(rows[0])
  })

  // DELETE /api/hotel/bookings/:id/charges/:chargeId
  app.delete('/bookings/:id/charges/:chargeId', async (req, reply) => {
    const { id, chargeId } = z.object({
      id:       z.string().uuid(),
      chargeId: z.string().uuid(),
    }).parse(req.params)

    const s = req.schemaName
    const b = req.branchId

    await req.db.$executeRawUnsafe(
      `DELETE FROM ${tbl(s,'hotel_folio_charges')}
       WHERE id = $1::uuid AND "bookingId" = $2::uuid AND "branchId" = $3::uuid`,
      chargeId, id, b
    )
    return reply.send({ ok: true })
  })

  // ══════════════════════════════════════════════════════════════════════════
  // HOUSEKEEPING
  // ══════════════════════════════════════════════════════════════════════════

  // GET /api/hotel/housekeeping
  app.get('/housekeeping', async (req) => {
    const query = z.object({
      date:   z.string().optional(),
      status: z.string().optional(),
    }).parse(req.query)

    const s = req.schemaName
    const b = req.branchId
    const date = query.date ?? new Date().toISOString().split('T')[0]

    let sql = `SELECT hk.*, r."roomNo", r."floor", r."roomType"
               FROM ${tbl(s,'hotel_housekeeping')} hk
               LEFT JOIN ${tbl(s,'hotel_rooms')} r ON r.id = hk."roomId"
               WHERE hk."branchId" = $1::uuid AND hk."scheduledFor" = $2::date`
    const params: any[] = [b, date]
    if (query.status) {
      params.push(query.status)
      sql += ` AND hk.status = $${params.length}`
    }
    sql += ` ORDER BY hk.priority DESC, r."roomNo"`

    return req.db.$queryRawUnsafe<any[]>(sql, ...params)
  })

  // POST /api/hotel/housekeeping  — manually create task
  app.post('/housekeeping', async (req, reply) => {
    const body = z.object({
      roomId:       z.string().uuid(),
      bookingId:    z.string().uuid().optional(),
      taskType:     z.enum(['checkout_clean','stay_clean','deep_clean','maintenance','turndown']).default('stay_clean'),
      priority:     z.enum(['low','normal','high','urgent']).default('normal'),
      assignedTo:   z.string().optional(),
      notes:        z.string().optional(),
      scheduledFor: z.string().optional(),
    }).parse(req.body)

    const s = req.schemaName
    const b = req.branchId
    const date = body.scheduledFor ?? new Date().toISOString().split('T')[0]

    const rows = await req.db.$queryRawUnsafe<any[]>(
      `INSERT INTO ${tbl(s,'hotel_housekeeping')}
        ("branchId","roomId","bookingId","taskType","status","priority","assignedTo","notes","scheduledFor")
       VALUES ($1::uuid,$2::uuid,$3::uuid,$4,'pending',$5,$6,$7,$8::date)
       RETURNING *`,
      b, body.roomId, body.bookingId ?? null, body.taskType,
      body.priority, body.assignedTo ?? null, body.notes ?? null, date
    )
    return reply.status(201).send(rows[0])
  })

  // PATCH /api/hotel/housekeeping/:id
  app.patch('/housekeeping/:id', async (req, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params)
    const body = z.object({
      status:     z.enum(['pending','in_progress','done','skipped']).optional(),
      assignedTo: z.string().nullable().optional(),
      notes:      z.string().nullable().optional(),
      priority:   z.enum(['low','normal','high','urgent']).optional(),
    }).parse(req.body)

    const s = req.schemaName
    const b = req.branchId
    const sets: string[] = []
    const params: any[] = [id, b]

    if (body.status !== undefined) {
      params.push(body.status)
      sets.push(`status = $${params.length}`)
      if (body.status === 'done') {
        sets.push(`"completedAt" = NOW()`)
        // When housekeeping is done, mark room as available
        const hkRows = await req.db.$queryRawUnsafe<any[]>(
          `SELECT "roomId" FROM ${tbl(s,'hotel_housekeeping')} WHERE id = $1::uuid AND "branchId" = $2::uuid`,
          id, b
        )
        if (hkRows[0]) {
          await req.db.$executeRawUnsafe(
            `UPDATE ${tbl(s,'hotel_rooms')} SET status = 'available' WHERE id = $1::uuid AND "branchId" = $2::uuid AND status = 'dirty'`,
            hkRows[0].roomId, b
          )
        }
      }
    }
    if (body.assignedTo !== undefined) { params.push(body.assignedTo); sets.push(`"assignedTo" = $${params.length}`) }
    if (body.notes      !== undefined) { params.push(body.notes);      sets.push(`notes = $${params.length}`) }
    if (body.priority   !== undefined) { params.push(body.priority);   sets.push(`priority = $${params.length}`) }

    if (sets.length === 0) return reply.status(400).send({ error: 'Nothing to update' })

    const rows = await req.db.$queryRawUnsafe<any[]>(
      `UPDATE ${tbl(s,'hotel_housekeeping')} SET ${sets.join(', ')}
       WHERE id = $1::uuid AND "branchId" = $2::uuid RETURNING *`,
      ...params
    )
    if (!rows[0]) return reply.status(404).send({ error: 'Task not found' })
    return rows[0]
  })

  // ══════════════════════════════════════════════════════════════════════════
  // NIGHT AUDIT
  // ══════════════════════════════════════════════════════════════════════════

  // POST /api/hotel/night-audit
  // Posts room charges for the current night for all checked-in bookings.
  app.post('/night-audit', async (req, reply) => {
    const s = req.schemaName
    const b = req.branchId
    const today = new Date().toISOString().split('T')[0]!

    // Get all checked-in bookings
    const bookings = await req.db.$queryRawUnsafe<any[]>(
      `SELECT bk.*, r."roomNo"
       FROM ${tbl(s,'hotel_bookings')} bk
       LEFT JOIN ${tbl(s,'hotel_rooms')} r ON r.id = bk."roomId"
       WHERE bk."branchId" = $1::uuid AND bk.status = 'checked_in'`,
      b
    )

    // Check if night audit already ran for today (avoid duplicate charges)
    const alreadyRan: string[] = []
    const charged: string[] = []

    for (const booking of bookings) {
      const existing = await req.db.$queryRawUnsafe<any[]>(
        `SELECT id FROM ${tbl(s,'hotel_folio_charges')}
         WHERE "bookingId" = $1::uuid AND "chargeType" = 'room' AND DATE(date) = $2::date`,
        booking.id, today
      )
      if (existing.length > 0) {
        alreadyRan.push(booking.folioNo)
        continue
      }

      // Calculate night number
      const nightsElapsed = Math.floor(
        (Date.now() - new Date(booking.actualCheckIn ?? booking.checkIn).getTime()) / 86400000
      ) + 1

      await req.db.$executeRawUnsafe(
        `INSERT INTO ${tbl(s,'hotel_folio_charges')}
          ("bookingId","branchId","chargeType","description","qty","rate","amount","gstRate","date","addedBy")
         VALUES ($1::uuid,$2::uuid,'room',$3,1,$4,$5,12,CURRENT_DATE,$6::uuid)`,
        booking.id, b,
        `Room ${booking.roomNo ?? ''} – Night ${nightsElapsed}`,
        Number(booking.ratePerNight),
        Number(booking.ratePerNight),
        req.userId
      )
      charged.push(booking.folioNo)

      // Schedule housekeeping for tomorrow morning
      await req.db.$executeRawUnsafe(
        `INSERT INTO ${tbl(s,'hotel_housekeeping')}
          ("branchId","roomId","bookingId","taskType","status","priority","scheduledFor")
         VALUES ($1::uuid,$2::uuid,$3::uuid,'stay_clean','pending','normal',CURRENT_DATE + 1)
         ON CONFLICT DO NOTHING`,
        b, booking.roomId, booking.id
      )
    }

    return reply.send({
      date:         today,
      charged:      charged.length,
      skipped:      alreadyRan.length,
      chargedFolios: charged,
      skippedFolios: alreadyRan,
    })
  })

  // ══════════════════════════════════════════════════════════════════════════
  // AVAILABILITY CALENDAR
  // ══════════════════════════════════════════════════════════════════════════

  // GET /api/hotel/availability?from=YYYY-MM-DD&to=YYYY-MM-DD
  app.get('/availability', async (req) => {
    const query = z.object({
      from: z.string(),
      to:   z.string(),
    }).parse(req.query)

    const s = req.schemaName
    const b = req.branchId

    const [rooms, bookings] = await Promise.all([
      req.db.$queryRawUnsafe<any[]>(
        `SELECT id, "roomNo", "roomType", "floor", "ratePerNight", "maxOccupancy",
                "hasAc", "hasTv", status
         FROM ${tbl(s,'hotel_rooms')}
         WHERE "branchId" = $1::uuid AND "isActive" = true ORDER BY "roomNo"`,
        b
      ),
      req.db.$queryRawUnsafe<any[]>(
        `SELECT "roomId", "checkIn", "checkOut", "guestName", status, "folioNo"
         FROM ${tbl(s,'hotel_bookings')}
         WHERE "branchId" = $1::uuid AND status IN ('reserved','checked_in')
           AND "checkIn" < $3 AND "checkOut" > $2`,
        b, new Date(query.from), new Date(query.to)
      ),
    ])

    return rooms.map((room) => ({
      ...room,
      bookings: bookings.filter((bk) => bk.roomId === room.id),
    }))
  })
}
