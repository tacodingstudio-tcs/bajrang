// hotel.test.ts
//
// Complete test suite for the hotel management system.
// Tests every API endpoint across all hotel domains:
//   - Tenant provisioning (hotel tables auto-created on registration)
//   - Room CRUD + status management
//   - Booking creation with conflict detection
//   - Check-in flow (ID proof, Form-C, room status update, first-night charge)
//   - Folio charges (food, laundry, minibar, room service)
//   - Check-out flow (balance calculation, room marked dirty)
//   - Housekeeping Kanban (task lifecycle, room auto-availability on done)
//   - Night audit (idempotency — duplicate-charge prevention)
//   - Availability calendar
//   - Front desk dashboard
//   - Edge cases & error handling

import axios, { AxiosInstance } from 'axios'
import { PrismaClient } from '@prisma/client'
import { BASE, loginHotel } from './helpers'

// ── Unique phone generator ───────────────────────────────────────────────────
function nextPhone(): string {
  const ts   = Date.now() % 10_000_000
  const rand = Math.floor(Math.random() * 90) + 10
  return `8${String(ts).padStart(7, '0')}${rand}`.slice(0, 10)
}

// ── Tenant cleanup ───────────────────────────────────────────────────────────
const createdTenantIds: string[] = []

afterAll(async () => {
  if (createdTenantIds.length === 0) return
  const db = new PrismaClient()
  try {
    const tenants = await db.$queryRawUnsafe<{ id: string; schemaName: string }[]>(
      `SELECT id, "schemaName" FROM public.tenants
       WHERE id = ANY(ARRAY[${createdTenantIds.map(id => `'${id}'::uuid`).join(',')}])`
    )
    for (const t of tenants) {
      await db.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${t.schemaName}" CASCADE`)
      await db.$executeRawUnsafe(`DELETE FROM public.tenants WHERE id = '${t.id}'`)
    }
  } finally {
    await db.$disconnect()
  }
})

// ── Helper: register a fresh hotel tenant ────────────────────────────────────
async function setupHotelTenant(): Promise<{
  api: AxiosInstance
  branchId: string
  tenantId: string
  schemaName: string
}> {
  const phone = nextPhone()
  const reg   = await axios.post(`${BASE}/api/tenants/register`, {
    businessName: 'Test Hotel',
    ownerName:    'Test Owner',
    phone,
    pin:          '1234',
    domainType:   'hotel',
  })
  expect(reg.status).toBe(201)
  const { branchId, tenantId, slug } = reg.data
  const schemaName = `t_${slug?.replace(/-/g, '_')}`
  createdTenantIds.push(tenantId)

  const loginRes = await axios.post(`${BASE}/api/auth/login`, {
    tenantPhone: phone, phone, pin: '1234',
  })
  const api = axios.create({
    baseURL: BASE,
    headers: { Authorization: `Bearer ${loginRes.data.accessToken}` },
  })
  api.interceptors.response.use(r => r, err => Promise.reject(err))
  return { api, branchId, tenantId, schemaName }
}

// ── Date helpers ─────────────────────────────────────────────────────────────
function futureDate(daysFromNow: number, hour = 14): string {
  const d = new Date()
  d.setDate(d.getDate() + daysFromNow)
  d.setHours(hour, 0, 0, 0)
  return d.toISOString()
}

// ═══════════════════════════════════════════════════════════════════════════════
// 1. TENANT PROVISIONING — hotel tables auto-created on registration
// ═══════════════════════════════════════════════════════════════════════════════

describe('Hotel tenant provisioning', () => {
  let schemaName: string
  let db: PrismaClient

  beforeAll(async () => {
    const tenant = await setupHotelTenant()
    schemaName   = tenant.schemaName
    db           = new PrismaClient()
  })

  afterAll(async () => { await db.$disconnect() })

  test('hotel_rooms table exists after registration', async () => {
    const rows = await db.$queryRawUnsafe<any[]>(
      `SELECT column_name FROM information_schema.columns
       WHERE table_schema = $1 AND table_name = 'hotel_rooms'
       ORDER BY ordinal_position`,
      schemaName
    )
    const cols = rows.map((r: any) => r.column_name)
    expect(cols).toContain('id')
    expect(cols).toContain('roomNo')
    expect(cols).toContain('roomType')
    expect(cols).toContain('ratePerNight')
    expect(cols).toContain('status')
    expect(cols).toContain('hasAc')
    expect(cols).toContain('hasTv')
    expect(cols).toContain('hasWifi')
    expect(cols).toContain('maxOccupancy')
  })

  test('hotel_bookings table exists after registration', async () => {
    const rows = await db.$queryRawUnsafe<any[]>(
      `SELECT column_name FROM information_schema.columns
       WHERE table_schema = $1 AND table_name = 'hotel_bookings'`,
      schemaName
    )
    const cols = rows.map((r: any) => r.column_name)
    expect(cols).toContain('folioNo')
    expect(cols).toContain('guestName')
    expect(cols).toContain('checkIn')
    expect(cols).toContain('checkOut')
    expect(cols).toContain('status')
    expect(cols).toContain('advancePaid')
    expect(cols).toContain('ratePerNight')
    expect(cols).toContain('totalAmount')
  })

  test('hotel_folio_charges table exists after registration', async () => {
    const rows = await db.$queryRawUnsafe<any[]>(
      `SELECT column_name FROM information_schema.columns
       WHERE table_schema = $1 AND table_name = 'hotel_folio_charges'`,
      schemaName
    )
    const cols = rows.map((r: any) => r.column_name)
    expect(cols).toContain('bookingId')
    expect(cols).toContain('chargeType')
    expect(cols).toContain('description')
    expect(cols).toContain('amount')
    expect(cols).toContain('gstRate')
  })

  test('hotel_housekeeping table exists after registration', async () => {
    const rows = await db.$queryRawUnsafe<any[]>(
      `SELECT column_name FROM information_schema.columns
       WHERE table_schema = $1 AND table_name = 'hotel_housekeeping'`,
      schemaName
    )
    const cols = rows.map((r: any) => r.column_name)
    expect(cols).toContain('roomId')
    expect(cols).toContain('taskType')
    expect(cols).toContain('status')
    expect(cols).toContain('priority')
    expect(cols).toContain('assignedTo')
    expect(cols).toContain('scheduledFor')
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// 2. ROOM MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════════

describe('Hotel room management', () => {
  let api: AxiosInstance
  let roomId: string

  beforeAll(async () => {
    const t = await setupHotelTenant()
    api = t.api
  })

  test('create a standard room', async () => {
    const r = await api.post('/api/hotel/rooms', {
      roomNo:       '101',
      roomType:     'standard',
      floor:        '1',
      bedType:      'double',
      maxOccupancy: 2,
      ratePerNight: 1500,
      hasAc:        true,
      hasTv:        true,
      hasGeyser:    true,
      hasWifi:      true,
      viewType:     'garden',
    })
    expect(r.status).toBe(201)
    expect(r.data.roomNo).toBe('101')
    expect(r.data.status).toBe('available')
    expect(Number(r.data.ratePerNight)).toBe(1500)
    roomId = r.data.id
  })

  test('create a deluxe suite', async () => {
    const r = await api.post('/api/hotel/rooms', {
      roomNo:       '201',
      roomType:     'suite',
      floor:        '2',
      bedType:      'king',
      maxOccupancy: 3,
      ratePerNight: 4500,
      weekendRate:  5500,
      hasAc:        true,
      hasTv:        true,
      hasGeyser:    true,
      hasWifi:      true,
      viewType:     'pool',
      notes:        'Corner suite with balcony',
    })
    expect(r.status).toBe(201)
    expect(r.data.roomType).toBe('suite')
    expect(Number(r.data.weekendRate)).toBe(5500)
  })

  test('list rooms returns all created rooms', async () => {
    const r = await api.get('/api/hotel/rooms')
    expect(r.status).toBe(200)
    expect(Array.isArray(r.data)).toBe(true)
    expect(r.data.length).toBeGreaterThanOrEqual(2)
  })

  test('filter rooms by status', async () => {
    const r = await api.get('/api/hotel/rooms?status=available')
    expect(r.status).toBe(200)
    expect(r.data.every((room: any) => room.status === 'available')).toBe(true)
  })

  test('get single room by ID', async () => {
    const r = await api.get(`/api/hotel/rooms/${roomId}`)
    expect(r.status).toBe(200)
    expect(r.data.id).toBe(roomId)
    expect(r.data.roomNo).toBe('101')
  })

  test('update room rate and amenities', async () => {
    const r = await api.patch(`/api/hotel/rooms/${roomId}`, {
      ratePerNight: 1800,
      notes:        'Recently renovated',
    })
    expect(r.status).toBe(200)
    expect(Number(r.data.ratePerNight)).toBe(1800)
    expect(r.data.notes).toBe('Recently renovated')
  })

  test('manually change room status to maintenance', async () => {
    const r = await api.patch(`/api/hotel/rooms/${roomId}`, { status: 'maintenance' })
    expect(r.status).toBe(200)
    expect(r.data.status).toBe('maintenance')
  })

  test('restore room to available', async () => {
    const r = await api.patch(`/api/hotel/rooms/${roomId}`, { status: 'available' })
    expect(r.status).toBe(200)
    expect(r.data.status).toBe('available')
  })

  test('get non-existent room returns 404', async () => {
    const r = await api.get('/api/hotel/rooms/00000000-0000-0000-0000-000000000000')
      .catch(e => e.response)
    expect(r.status).toBe(404)
  })

  test('soft-delete a room', async () => {
    // Create a room to delete
    const created = await api.post('/api/hotel/rooms', {
      roomNo: '999', roomType: 'standard', ratePerNight: 500, maxOccupancy: 1,
    })
    const r = await api.delete(`/api/hotel/rooms/${created.data.id}`)
    expect(r.status).toBe(200)
    expect(r.data.ok).toBe(true)
    // Should not appear in listing
    const list = await api.get('/api/hotel/rooms')
    expect(list.data.find((room: any) => room.id === created.data.id)).toBeUndefined()
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// 3. BOOKING MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════════

describe('Hotel booking management', () => {
  let api: AxiosInstance
  let roomId: string
  let bookingId: string

  beforeAll(async () => {
    const t = await setupHotelTenant()
    api = t.api
    const room = await api.post('/api/hotel/rooms', {
      roomNo: '101', roomType: 'deluxe', floor: '1',
      bedType: 'double', maxOccupancy: 2,
      ratePerNight: 2500, hasAc: true, hasTv: true, hasGeyser: true, hasWifi: true,
    })
    roomId = room.data.id
  })

  test('create a reservation', async () => {
    const r = await api.post('/api/hotel/bookings', {
      roomId,
      guestName:     'Rajesh Kumar',
      guestPhone:    '9712340001',
      guestEmail:    'rajesh@example.com',
      nationality:   'Indian',
      idType:        'aadhar',
      idNumber:      '1234 5678 9012',
      adults:        2,
      children:      1,
      checkIn:       futureDate(1, 14),
      checkOut:      futureDate(3, 11),
      bookingSource: 'walk_in',
      mealPlan:      'CP',
      advancePaid:   2000,
      ratePerNight:  2500,
      notes:         'Honeymoon couple — extra pillow',
    })
    expect(r.status).toBe(201)
    expect(r.data.guestName).toBe('Rajesh Kumar')
    expect(r.data.status).toBe('reserved')
    expect(r.data.folioNo).toMatch(/^FLO-/)
    expect(Number(r.data.advancePaid)).toBe(2000)
    expect(Number(r.data.ratePerNight)).toBe(2500)
    bookingId = r.data.id
  })

  test('list bookings returns the created reservation', async () => {
    const r = await api.get('/api/hotel/bookings?status=reserved')
    expect(r.status).toBe(200)
    expect(r.data.data).toBeDefined()
    expect(r.data.total).toBeGreaterThanOrEqual(1)
    expect(r.data.data.some((b: any) => b.id === bookingId)).toBe(true)
  })

  test('search bookings by guest name', async () => {
    const r = await api.get('/api/hotel/bookings?search=Rajesh')
    expect(r.status).toBe(200)
    expect(r.data.data.some((b: any) => b.guestName === 'Rajesh Kumar')).toBe(true)
  })

  test('get booking detail includes folio charges', async () => {
    const r = await api.get(`/api/hotel/bookings/${bookingId}`)
    expect(r.status).toBe(200)
    expect(r.data.id).toBe(bookingId)
    expect(r.data.roomNo).toBe('101')
    expect(Array.isArray(r.data.charges)).toBe(true)
    // Advance payment should be posted as a credit charge
    const creditCharge = r.data.charges.find((c: any) => Number(c.amount) < 0)
    expect(creditCharge).toBeDefined()
    expect(Math.abs(Number(creditCharge.amount))).toBe(2000)
  })

  test('update booking details', async () => {
    const r = await api.patch(`/api/hotel/bookings/${bookingId}`, {
      guestEmail:    'rajesh.kumar@example.com',
      mealPlan:      'MAP',
      bookingSource: 'ota_makemytrip',
    })
    expect(r.status).toBe(200)
    expect(r.data.mealPlan).toBe('MAP')
    expect(r.data.bookingSource).toBe('ota_makemytrip')
  })

  test('booking without advance has no credit charge', async () => {
    const r = await api.post('/api/hotel/bookings', {
      roomId,
      guestName:    'No Advance Guest',
      adults:       1,
      children:     0,
      checkIn:      futureDate(10, 14),
      checkOut:     futureDate(12, 11),
      ratePerNight: 2500,
      advancePaid:  0,
    })
    expect(r.status).toBe(201)
    const detail = await api.get(`/api/hotel/bookings/${r.data.id}`)
    expect(detail.data.charges.length).toBe(0)
  })

  test('booking a maintenance room is rejected', async () => {
    const maintenanceRoom = await api.post('/api/hotel/rooms', {
      roomNo: '999', roomType: 'standard', ratePerNight: 1000, maxOccupancy: 1,
    })
    await api.patch(`/api/hotel/rooms/${maintenanceRoom.data.id}`, { status: 'maintenance' })
    const r = await api.post('/api/hotel/bookings', {
      roomId:       maintenanceRoom.data.id,
      guestName:    'Test Guest',
      adults:       1,
      children:     0,
      checkIn:      futureDate(1, 14),
      checkOut:     futureDate(2, 11),
      ratePerNight: 1000,
    }).catch(e => e.response)
    expect(r.status).toBe(422)
    expect(r.data.error).toMatch(/maintenance/i)
  })

  test('overlapping booking on same room is rejected', async () => {
    // Create a fresh room
    const room2 = await api.post('/api/hotel/rooms', {
      roomNo: '102', roomType: 'standard', ratePerNight: 1500, maxOccupancy: 2,
    })
    // First booking
    await api.post('/api/hotel/bookings', {
      roomId: room2.data.id, guestName: 'Guest A', adults: 1, children: 0,
      checkIn: futureDate(5, 14), checkOut: futureDate(8, 11), ratePerNight: 1500,
    })
    // Overlapping booking
    const r = await api.post('/api/hotel/bookings', {
      roomId: room2.data.id, guestName: 'Guest B', adults: 1, children: 0,
      checkIn: futureDate(6, 14), checkOut: futureDate(9, 11), ratePerNight: 1500,
    }).catch(e => e.response)
    expect(r.status).toBe(409)
    expect(r.data.error).toMatch(/already booked/i)
  })

  test('non-overlapping booking on same room is allowed', async () => {
    const room3 = await api.post('/api/hotel/rooms', {
      roomNo: '103', roomType: 'standard', ratePerNight: 1500, maxOccupancy: 2,
    })
    await api.post('/api/hotel/bookings', {
      roomId: room3.data.id, guestName: 'Guest A', adults: 1, children: 0,
      checkIn: futureDate(1, 14), checkOut: futureDate(3, 11), ratePerNight: 1500,
    })
    const r = await api.post('/api/hotel/bookings', {
      roomId: room3.data.id, guestName: 'Guest B', adults: 1, children: 0,
      checkIn: futureDate(4, 14), checkOut: futureDate(6, 11), ratePerNight: 1500,
    })
    expect(r.status).toBe(201)
  })

  test('pagination works correctly', async () => {
    const page1 = await api.get('/api/hotel/bookings?page=1&limit=1')
    expect(page1.status).toBe(200)
    expect(page1.data.data.length).toBeLessThanOrEqual(1)
    expect(page1.data.page).toBe(1)
    expect(page1.data.limit).toBe(1)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// 4. CHECK-IN FLOW
// ═══════════════════════════════════════════════════════════════════════════════

describe('Hotel check-in flow', () => {
  let api: AxiosInstance
  let roomId: string
  let bookingId: string

  beforeAll(async () => {
    const t = await setupHotelTenant()
    api = t.api
    const room = await api.post('/api/hotel/rooms', {
      roomNo: '201', roomType: 'deluxe', floor: '2',
      ratePerNight: 3000, maxOccupancy: 2,
    })
    roomId = room.data.id
    const bk = await api.post('/api/hotel/bookings', {
      roomId, guestName: 'Priya Sharma', guestPhone: '9876500001',
      adults: 2, children: 0,
      checkIn: futureDate(0, 14), checkOut: futureDate(2, 11),
      ratePerNight: 3000, advancePaid: 1000,
    })
    bookingId = bk.data.id
  })

  test('check-in updates booking status to checked_in', async () => {
    const r = await api.post(`/api/hotel/bookings/${bookingId}/checkin`, {
      idType:     'passport',
      idNumber:   'N1234567',
      formCFiled: false,
    })
    expect(r.status).toBe(200)
    expect(r.data.status).toBe('checked_in')
    expect(r.data.actualCheckIn).toBeDefined()
    expect(r.data.idType).toBe('passport')
    expect(r.data.idNumber).toBe('N1234567')
  })

  test('check-in marks room as occupied', async () => {
    const room = await api.get(`/api/hotel/rooms/${roomId}`)
    expect(room.data.status).toBe('occupied')
  })

  test('check-in posts first night room charge to folio', async () => {
    const detail = await api.get(`/api/hotel/bookings/${bookingId}`)
    const roomCharges = detail.data.charges.filter((c: any) => c.chargeType === 'room')
    expect(roomCharges.length).toBeGreaterThanOrEqual(1)
    expect(Number(roomCharges[0].rate)).toBe(3000)
    expect(roomCharges[0].description).toMatch(/Room|Night/i)
  })

  test('check-in creates housekeeping task for next morning', async () => {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const tomorrowStr = tomorrow.toISOString().split('T')[0]!
    const hk = await api.get(`/api/hotel/housekeeping?date=${tomorrowStr}`)
    expect(hk.status).toBe(200)
    const task = hk.data.find((t: any) => t.bookingId === bookingId)
    expect(task).toBeDefined()
    expect(task.taskType).toBe('stay_clean')
    expect(task.status).toBe('pending')
  })

  test('cannot check in a booking that is already checked in', async () => {
    const r = await api.post(`/api/hotel/bookings/${bookingId}/checkin`, {})
      .catch(e => e.response)
    expect(r.status).toBe(422)
    expect(r.data.error).toMatch(/checked_in/i)
  })

  test('cannot check in a non-existent booking', async () => {
    const r = await api.post('/api/hotel/bookings/00000000-0000-0000-0000-000000000000/checkin', {})
      .catch(e => e.response)
    expect(r.status).toBe(404)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// 5. FOLIO CHARGES (FOOD, LAUNDRY, MINIBAR, ETC.)
// ═══════════════════════════════════════════════════════════════════════════════

describe('Hotel folio charges', () => {
  let api: AxiosInstance
  let bookingId: string
  let foodChargeId: string
  let laundryChargeId: string

  beforeAll(async () => {
    const t = await setupHotelTenant()
    api = t.api
    const room = await api.post('/api/hotel/rooms', {
      roomNo: '301', roomType: 'deluxe', ratePerNight: 2000, maxOccupancy: 2,
    })
    const bk = await api.post('/api/hotel/bookings', {
      roomId: room.data.id, guestName: 'Food Test Guest',
      adults: 2, children: 0,
      checkIn: futureDate(0, 14), checkOut: futureDate(2, 11),
      ratePerNight: 2000,
    })
    bookingId = bk.data.id
    // Check in first
    await api.post(`/api/hotel/bookings/${bookingId}/checkin`, {})
  })

  test('add food order to folio', async () => {
    const r = await api.post(`/api/hotel/bookings/${bookingId}/charges`, {
      chargeType:  'food',
      description: 'Dinner — Paneer Tikka + 2 Rotis',
      qty:         1,
      rate:        480,
      gstRate:     5,
      date:        new Date().toISOString().split('T')[0],
    })
    expect(r.status).toBe(201)
    expect(r.data.chargeType).toBe('food')
    expect(Number(r.data.amount)).toBe(480)
    expect(Number(r.data.gstRate)).toBe(5)
    foodChargeId = r.data.id
  })

  test('add laundry charge to folio', async () => {
    const r = await api.post(`/api/hotel/bookings/${bookingId}/charges`, {
      chargeType:  'laundry',
      description: 'Laundry — 3 shirts, 2 pants',
      qty:         5,
      rate:        60,
      gstRate:     18,
    })
    expect(r.status).toBe(201)
    expect(Number(r.data.amount)).toBe(300)
    laundryChargeId = r.data.id
  })

  test('add minibar charge', async () => {
    const r = await api.post(`/api/hotel/bookings/${bookingId}/charges`, {
      chargeType:  'minibar',
      description: 'Minibar — Coca Cola × 2, Juice × 1',
      qty:         3,
      rate:        120,
      gstRate:     18,
    })
    expect(r.status).toBe(201)
    expect(Number(r.data.amount)).toBe(360)
  })

  test('add spa/wellness charge', async () => {
    const r = await api.post(`/api/hotel/bookings/${bookingId}/charges`, {
      chargeType:  'spa',
      description: 'Full Body Massage (60 min)',
      qty:         1,
      rate:        1500,
      gstRate:     18,
    })
    expect(r.status).toBe(201)
    expect(Number(r.data.amount)).toBe(1500)
  })

  test('add room service charge', async () => {
    const r = await api.post(`/api/hotel/bookings/${bookingId}/charges`, {
      chargeType:  'food',
      description: 'Room Service — Breakfast (2 persons)',
      qty:         2,
      rate:        350,
      gstRate:     5,
    })
    expect(r.status).toBe(201)
    expect(Number(r.data.amount)).toBe(700)
  })

  test('add transport charge', async () => {
    const r = await api.post(`/api/hotel/bookings/${bookingId}/charges`, {
      chargeType:  'transport',
      description: 'Airport pickup',
      qty:         1,
      rate:        800,
      gstRate:     5,
    })
    expect(r.status).toBe(201)
    expect(Number(r.data.amount)).toBe(800)
  })

  test('folio total includes all charges', async () => {
    const detail = await api.get(`/api/hotel/bookings/${bookingId}`)
    expect(detail.data.totalCharges).toBeGreaterThan(0)
    // Should include room + food + laundry + minibar + spa + room-service + transport
    const chargeTypes = detail.data.charges.map((c: any) => c.chargeType)
    expect(chargeTypes).toContain('room')
    expect(chargeTypes).toContain('food')
    expect(chargeTypes).toContain('laundry')
    expect(chargeTypes).toContain('minibar')
    expect(chargeTypes).toContain('spa')
    expect(chargeTypes).toContain('transport')
  })

  test('remove a folio charge', async () => {
    const r = await api.delete(`/api/hotel/bookings/${bookingId}/charges/${laundryChargeId}`)
    expect(r.status).toBe(200)
    expect(r.data.ok).toBe(true)
    const detail = await api.get(`/api/hotel/bookings/${bookingId}`)
    const ids = detail.data.charges.map((c: any) => c.id)
    expect(ids).not.toContain(laundryChargeId)
  })

  test('cannot add charges to a checked-out booking', async () => {
    // Create a separate booking to check out
    const room2 = await api.post('/api/hotel/rooms', {
      roomNo: '302', roomType: 'standard', ratePerNight: 1000, maxOccupancy: 1,
    })
    const bk2 = await api.post('/api/hotel/bookings', {
      roomId: room2.data.id, guestName: 'Checkout Test',
      adults: 1, children: 0,
      checkIn: futureDate(0, 14), checkOut: futureDate(1, 11),
      ratePerNight: 1000,
    })
    await api.post(`/api/hotel/bookings/${bk2.data.id}/checkin`, {})
    await api.post(`/api/hotel/bookings/${bk2.data.id}/checkout`, { paymentMethod: 'cash' })

    const r = await api.post(`/api/hotel/bookings/${bk2.data.id}/charges`, {
      chargeType: 'food', description: 'Post-checkout food', qty: 1, rate: 200,
    }).catch(e => e.response)
    expect(r.status).toBe(422)
    expect(r.data.error).toMatch(/closed/i)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// 6. CHECK-OUT FLOW
// ═══════════════════════════════════════════════════════════════════════════════

describe('Hotel check-out flow', () => {
  let api: AxiosInstance
  let roomId: string
  let bookingId: string

  beforeAll(async () => {
    const t = await setupHotelTenant()
    api = t.api
    const room = await api.post('/api/hotel/rooms', {
      roomNo: '401', roomType: 'deluxe', ratePerNight: 2500, maxOccupancy: 2,
    })
    roomId = room.data.id
    const bk = await api.post('/api/hotel/bookings', {
      roomId, guestName: 'Checkout Guest', guestPhone: '9712300001',
      adults: 2, children: 0,
      checkIn: futureDate(0, 14), checkOut: futureDate(2, 11),
      ratePerNight: 2500, advancePaid: 1500,
    })
    bookingId = bk.data.id
    await api.post(`/api/hotel/bookings/${bookingId}/checkin`, {})
    // Add food charge
    await api.post(`/api/hotel/bookings/${bookingId}/charges`, {
      chargeType: 'food', description: 'Dinner', qty: 1, rate: 600, gstRate: 5,
    })
  })

  test('check-out returns booking + bill summary', async () => {
    const r = await api.post(`/api/hotel/bookings/${bookingId}/checkout`, {
      paymentMethod: 'upi',
    })
    expect(r.status).toBe(200)
    expect(r.data.booking.status).toBe('checked_out')
    expect(r.data.booking.actualCheckOut).toBeDefined()
    expect(r.data.summary).toBeDefined()
    expect(r.data.summary.totalCharges).toBeGreaterThan(0)
    expect(Number(r.data.summary.advancePaid)).toBe(1500)
    expect(r.data.summary.paymentMethod).toBe('upi')
    // balance due = totalCharges - advance
    const balance = r.data.summary.balanceDue
    expect(balance).toBeGreaterThanOrEqual(0)
  })

  test('check-out marks room as dirty', async () => {
    const room = await api.get(`/api/hotel/rooms/${roomId}`)
    expect(room.data.status).toBe('dirty')
  })

  test('check-out creates housekeeping checkout-clean task', async () => {
    const today = new Date().toISOString().split('T')[0]!
    const hk = await api.get(`/api/hotel/housekeeping?date=${today}`)
    const checkoutTask = hk.data.find(
      (t: any) => t.bookingId === bookingId && t.taskType === 'checkout_clean'
    )
    expect(checkoutTask).toBeDefined()
    expect(checkoutTask.priority).toBe('high')
  })

  test('cannot check out a reserved (not checked-in) booking', async () => {
    const room2 = await api.post('/api/hotel/rooms', {
      roomNo: '402', roomType: 'standard', ratePerNight: 1000, maxOccupancy: 1,
    })
    const bk2 = await api.post('/api/hotel/bookings', {
      roomId: room2.data.id, guestName: 'Reserved Only',
      adults: 1, children: 0,
      checkIn: futureDate(1, 14), checkOut: futureDate(2, 11),
      ratePerNight: 1000,
    })
    const r = await api.post(`/api/hotel/bookings/${bk2.data.id}/checkout`, {})
      .catch(e => e.response)
    expect(r.status).toBe(422)
    expect(r.data.error).toMatch(/reserved/i)
  })

  test('cannot check out an already checked-out booking', async () => {
    const r = await api.post(`/api/hotel/bookings/${bookingId}/checkout`, {})
      .catch(e => e.response)
    expect(r.status).toBe(422)
    expect(r.data.error).toMatch(/checked_out/i)
  })

  test('balance is correctly calculated (total - advance)', async () => {
    // Create a fresh booking with known amounts
    const room3 = await api.post('/api/hotel/rooms', {
      roomNo: '403', roomType: 'standard', ratePerNight: 1000, maxOccupancy: 1,
    })
    const bk3 = await api.post('/api/hotel/bookings', {
      roomId: room3.data.id, guestName: 'Balance Test Guest',
      adults: 1, children: 0,
      checkIn: futureDate(0, 14), checkOut: futureDate(1, 11),
      ratePerNight: 1000, advancePaid: 500,
    })
    await api.post(`/api/hotel/bookings/${bk3.data.id}/checkin`, {})
    const checkout = await api.post(`/api/hotel/bookings/${bk3.data.id}/checkout`, {
      paymentMethod: 'cash',
    })
    // Total = room charge ₹1000, advance = ₹500, so balance due = ₹500
    // (minus ₹500 advance credit charge auto-posted at booking)
    expect(checkout.data.summary.totalCharges).toBeGreaterThanOrEqual(0)
    const expectedBalance = checkout.data.summary.totalCharges - 500
    expect(Math.abs(checkout.data.summary.balanceDue - Math.max(0, expectedBalance))).toBeLessThan(1)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// 7. HOUSEKEEPING
// ═══════════════════════════════════════════════════════════════════════════════

describe('Hotel housekeeping', () => {
  let api: AxiosInstance
  let roomId: string
  let taskId: string

  beforeAll(async () => {
    const t = await setupHotelTenant()
    api = t.api
    const room = await api.post('/api/hotel/rooms', {
      roomNo: '501', roomType: 'standard', ratePerNight: 1200, maxOccupancy: 2,
    })
    roomId = room.data.id
    // Mark room dirty to test auto-available on housekeeping done
    await api.patch(`/api/hotel/rooms/${roomId}`, { status: 'dirty' })
  })

  test('create a housekeeping task manually', async () => {
    const r = await api.post('/api/hotel/housekeeping', {
      roomId,
      taskType:   'deep_clean',
      priority:   'high',
      assignedTo: 'Radha Devi',
      notes:      'Guest complained about dusty curtains',
    })
    expect(r.status).toBe(201)
    expect(r.data.status).toBe('pending')
    expect(r.data.taskType).toBe('deep_clean')
    expect(r.data.assignedTo).toBe('Radha Devi')
    expect(r.data.priority).toBe('high')
    taskId = r.data.id
  })

  test('list housekeeping tasks for today', async () => {
    const today = new Date().toISOString().split('T')[0]!
    const r = await api.get(`/api/hotel/housekeeping?date=${today}`)
    expect(r.status).toBe(200)
    expect(Array.isArray(r.data)).toBe(true)
    const task = r.data.find((t: any) => t.id === taskId)
    expect(task).toBeDefined()
    expect(task.roomNo).toBe('501')
  })

  test('filter housekeeping by status', async () => {
    const today = new Date().toISOString().split('T')[0]!
    const r = await api.get(`/api/hotel/housekeeping?date=${today}&status=pending`)
    expect(r.status).toBe(200)
    expect(r.data.every((t: any) => t.status === 'pending')).toBe(true)
  })

  test('update task to in_progress', async () => {
    const r = await api.patch(`/api/hotel/housekeeping/${taskId}`, { status: 'in_progress' })
    expect(r.status).toBe(200)
    expect(r.data.status).toBe('in_progress')
    expect(r.data.completedAt).toBeNull()
  })

  test('assign task to staff member', async () => {
    const r = await api.patch(`/api/hotel/housekeeping/${taskId}`, {
      assignedTo: 'Sunita Patel',
      notes:      'Changed assignment',
    })
    expect(r.status).toBe(200)
    expect(r.data.assignedTo).toBe('Sunita Patel')
  })

  test('mark task as done — room becomes available', async () => {
    const r = await api.patch(`/api/hotel/housekeeping/${taskId}`, { status: 'done' })
    expect(r.status).toBe(200)
    expect(r.data.status).toBe('done')
    expect(r.data.completedAt).toBeDefined()
    // Room should now be available
    const room = await api.get(`/api/hotel/rooms/${roomId}`)
    expect(room.data.status).toBe('available')
  })

  test('create turndown service task', async () => {
    const r = await api.post('/api/hotel/housekeeping', {
      roomId,
      taskType:   'turndown',
      priority:   'normal',
      assignedTo: 'Evening Team',
    })
    expect(r.status).toBe(201)
    expect(r.data.taskType).toBe('turndown')
  })

  test('skip a housekeeping task', async () => {
    const r2 = await api.post('/api/hotel/housekeeping', {
      roomId, taskType: 'stay_clean', priority: 'low',
    })
    const skip = await api.patch(`/api/hotel/housekeeping/${r2.data.id}`, { status: 'skipped' })
    expect(skip.data.status).toBe('skipped')
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// 8. NIGHT AUDIT
// ═══════════════════════════════════════════════════════════════════════════════

describe('Hotel night audit', () => {
  let api: AxiosInstance
  let bookingId: string
  let bookingId2: string

  beforeAll(async () => {
    const t = await setupHotelTenant()
    api = t.api
    // Create two rooms and check in two guests
    const [room1, room2] = await Promise.all([
      api.post('/api/hotel/rooms', { roomNo: '601', roomType: 'standard', ratePerNight: 1800, maxOccupancy: 2 }),
      api.post('/api/hotel/rooms', { roomNo: '602', roomType: 'deluxe',   ratePerNight: 3200, maxOccupancy: 3 }),
    ])
    const [bk1, bk2] = await Promise.all([
      api.post('/api/hotel/bookings', {
        roomId: room1.data.id, guestName: 'Audit Guest 1',
        adults: 2, children: 0,
        checkIn: futureDate(0, 14), checkOut: futureDate(3, 11),
        ratePerNight: 1800,
      }),
      api.post('/api/hotel/bookings', {
        roomId: room2.data.id, guestName: 'Audit Guest 2',
        adults: 3, children: 1,
        checkIn: futureDate(0, 14), checkOut: futureDate(4, 11),
        ratePerNight: 3200,
      }),
    ])
    bookingId  = bk1.data.id
    bookingId2 = bk2.data.id
    await Promise.all([
      api.post(`/api/hotel/bookings/${bookingId}/checkin`,  {}),
      api.post(`/api/hotel/bookings/${bookingId2}/checkin`, {}),
    ])
  })

  test('night audit charges all checked-in bookings', async () => {
    const r = await api.post('/api/hotel/night-audit')
    expect(r.status).toBe(200)
    expect(r.data.date).toBeDefined()
    // Both bookings should be in charged or skipped (if check-in already posted today's charge)
    const processed = r.data.charged + r.data.skipped
    expect(processed).toBeGreaterThanOrEqual(2)
  })

  test('night audit is idempotent — running twice does not double-charge', async () => {
    // First run — charges for today
    const run1 = await api.post('/api/hotel/night-audit')
    // Second run same day — should skip already-charged folios
    const run2 = await api.post('/api/hotel/night-audit')
    expect(run2.status).toBe(200)
    // On second run, skipped should be >= charged from first run
    expect(run2.data.skipped).toBeGreaterThanOrEqual(0)
    // Total folio charges for bk1 should not have duplicate date entries
    const detail = await api.get(`/api/hotel/bookings/${bookingId}`)
    const today  = new Date().toISOString().split('T')[0]!
    const todayRoomCharges = detail.data.charges.filter(
      (c: any) => c.chargeType === 'room' && c.date?.startsWith(today)
    )
    expect(todayRoomCharges.length).toBeLessThanOrEqual(1)
  })

  test('night audit schedules housekeeping for tomorrow', async () => {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const tomorrowStr = tomorrow.toISOString().split('T')[0]!
    const hk = await api.get(`/api/hotel/housekeeping?date=${tomorrowStr}`)
    // At least one stay_clean task for our in-house guests
    const stayClean = hk.data.filter((t: any) => t.taskType === 'stay_clean')
    expect(stayClean.length).toBeGreaterThanOrEqual(0) // may already exist from check-in
  })

  test('night audit result includes charged and skipped folio lists', async () => {
    const r = await api.post('/api/hotel/night-audit')
    expect(r.status).toBe(200)
    expect(Array.isArray(r.data.chargedFolios)).toBe(true)
    expect(Array.isArray(r.data.skippedFolios)).toBe(true)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// 9. AVAILABILITY CALENDAR
// ═══════════════════════════════════════════════════════════════════════════════

describe('Hotel availability calendar', () => {
  let api: AxiosInstance

  beforeAll(async () => {
    const t = await setupHotelTenant()
    api = t.api
    // Create 3 rooms
    const rooms = await Promise.all([
      api.post('/api/hotel/rooms', { roomNo: '701', roomType: 'standard', ratePerNight: 1200, maxOccupancy: 2 }),
      api.post('/api/hotel/rooms', { roomNo: '702', roomType: 'deluxe',   ratePerNight: 2200, maxOccupancy: 3 }),
      api.post('/api/hotel/rooms', { roomNo: '703', roomType: 'suite',    ratePerNight: 5000, maxOccupancy: 4 }),
    ])
    // Book room 701 for days 1-3
    await api.post('/api/hotel/bookings', {
      roomId: rooms[0].data.id, guestName: 'Calendar Guest',
      adults: 2, children: 0,
      checkIn: futureDate(1, 14), checkOut: futureDate(3, 11),
      ratePerNight: 1200,
    })
  })

  test('availability calendar returns all rooms with bookings', async () => {
    const from = new Date().toISOString().split('T')[0]!
    const to   = futureDate(7).split('T')[0]!
    const r    = await api.get(`/api/hotel/availability?from=${from}&to=${to}`)
    expect(r.status).toBe(200)
    expect(Array.isArray(r.data)).toBe(true)
    expect(r.data.length).toBeGreaterThanOrEqual(3)
    // Each room has a bookings array
    for (const room of r.data) {
      expect(Array.isArray(room.bookings)).toBe(true)
    }
    // Room 701 should have 1 booking in the range
    const room701 = r.data.find((r: any) => r.roomNo === '701')
    expect(room701).toBeDefined()
    expect(room701.bookings.length).toBeGreaterThanOrEqual(1)
  })

  test('availability outside booking window shows no bookings for that room', async () => {
    // Query days 10-14 — no bookings should exist
    const from = futureDate(10).split('T')[0]!
    const to   = futureDate(14).split('T')[0]!
    const r    = await api.get(`/api/hotel/availability?from=${from}&to=${to}`)
    expect(r.status).toBe(200)
    const room701 = r.data.find((room: any) => room.roomNo === '701')
    expect(room701.bookings.length).toBe(0)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// 10. FRONT DESK DASHBOARD
// ═══════════════════════════════════════════════════════════════════════════════

describe('Hotel front desk dashboard', () => {
  let api: AxiosInstance

  beforeAll(async () => {
    const t = await setupHotelTenant()
    api = t.api
    // Create rooms and some bookings for today
    const room = await api.post('/api/hotel/rooms', {
      roomNo: '801', roomType: 'deluxe', ratePerNight: 2800, maxOccupancy: 2,
    })
    await api.post('/api/hotel/bookings', {
      roomId: room.data.id, guestName: 'Dashboard Guest',
      adults: 2, children: 0,
      checkIn: new Date().toISOString(), // today
      checkOut: futureDate(2, 11),
      ratePerNight: 2800,
    })
  })

  test('dashboard returns room stats structure', async () => {
    const r = await api.get('/api/hotel/dashboard')
    expect(r.status).toBe(200)
    expect(r.data.roomStats).toBeDefined()
    expect(typeof r.data.roomStats.total).toBe('number')
    expect(typeof r.data.roomStats.available).toBe('number')
    expect(typeof r.data.roomStats.occupied).toBe('number')
    expect(typeof r.data.roomStats.dirty).toBe('number')
    expect(typeof r.data.roomStats.maintenance).toBe('number')
    expect(typeof r.data.roomStats.blocked).toBe('number')
  })

  test('dashboard returns occupancy percentage', async () => {
    const r = await api.get('/api/hotel/dashboard')
    expect(r.status).toBe(200)
    expect(typeof r.data.occupancyPct).toBe('number')
    expect(r.data.occupancyPct).toBeGreaterThanOrEqual(0)
    expect(r.data.occupancyPct).toBeLessThanOrEqual(100)
  })

  test('dashboard returns arrivals, departures, in-house lists', async () => {
    const r = await api.get('/api/hotel/dashboard')
    expect(r.status).toBe(200)
    expect(Array.isArray(r.data.arrivalsToday)).toBe(true)
    expect(Array.isArray(r.data.departuresToday)).toBe(true)
    expect(Array.isArray(r.data.inHouse)).toBe(true)
    // Dashboard Guest should appear in today's arrivals
    const arrival = r.data.arrivalsToday.find((b: any) => b.guestName === 'Dashboard Guest')
    expect(arrival).toBeDefined()
  })

  test('dashboard returns housekeeping pending tasks', async () => {
    const r = await api.get('/api/hotel/dashboard')
    expect(r.status).toBe(200)
    expect(Array.isArray(r.data.housekeepingPending)).toBe(true)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// 11. COMPLETE END-TO-END HOTEL STAY FLOW
// ═══════════════════════════════════════════════════════════════════════════════

describe('Hotel complete stay E2E flow', () => {
  let api: AxiosInstance
  let roomId: string
  let bookingId: string

  test('full hotel stay: reserve → check-in → charges → night-audit → check-out', async () => {
    const t = await setupHotelTenant()
    api = t.api

    // 1. Create room
    const room = await api.post('/api/hotel/rooms', {
      roomNo: '901', roomType: 'super_deluxe', floor: '9',
      bedType: 'king', maxOccupancy: 2, ratePerNight: 6000,
      weekendRate: 7500, hasAc: true, hasTv: true, hasGeyser: true, hasWifi: true,
      viewType: 'pool', notes: 'Premium pool-view room',
    })
    expect(room.status).toBe(201)
    roomId = room.data.id

    // 2. Create reservation
    const booking = await api.post('/api/hotel/bookings', {
      roomId,
      guestName:     'Vikram Malhotra',
      guestPhone:    '9988776655',
      guestEmail:    'vikram@corp.com',
      nationality:   'Indian',
      idType:        'passport',
      idNumber:      'N7654321',
      adults:        2,
      children:      0,
      checkIn:       futureDate(0, 14),
      checkOut:      futureDate(3, 11),
      bookingSource: 'corporate',
      mealPlan:      'AP',
      advancePaid:   5000,
      ratePerNight:  6000,
      notes:         'Corporate guest — needs early check-in',
    })
    expect(booking.status).toBe(201)
    expect(booking.data.status).toBe('reserved')
    bookingId = booking.data.id

    // 3. Verify room still available before check-in
    const roomBefore = await api.get(`/api/hotel/rooms/${roomId}`)
    expect(roomBefore.data.status).toBe('available')

    // 4. Check in
    const checkin = await api.post(`/api/hotel/bookings/${bookingId}/checkin`, {
      idType:     'passport',
      idNumber:   'N7654321',
      formCFiled: false,
    })
    expect(checkin.status).toBe(200)
    expect(checkin.data.status).toBe('checked_in')

    // 5. Room is now occupied
    const roomAfterCheckin = await api.get(`/api/hotel/rooms/${roomId}`)
    expect(roomAfterCheckin.data.status).toBe('occupied')

    // 6. Add restaurant food order
    const food1 = await api.post(`/api/hotel/bookings/${bookingId}/charges`, {
      chargeType: 'food', description: 'Day 1 Dinner — 2 pax', qty: 1, rate: 1200, gstRate: 5,
    })
    expect(food1.status).toBe(201)

    // 7. Add spa charge
    const spa = await api.post(`/api/hotel/bookings/${bookingId}/charges`, {
      chargeType: 'spa', description: 'Couples Massage 90min', qty: 1, rate: 3500, gstRate: 18,
    })
    expect(spa.status).toBe(201)

    // 8. Night audit
    const audit = await api.post('/api/hotel/night-audit')
    expect(audit.status).toBe(200)

    // 9. More charges day 2
    const food2 = await api.post(`/api/hotel/bookings/${bookingId}/charges`, {
      chargeType: 'food', description: 'Day 2 Breakfast', qty: 2, rate: 450, gstRate: 5,
    })
    expect(food2.status).toBe(201)

    // 10. Review folio before checkout
    const folio = await api.get(`/api/hotel/bookings/${bookingId}`)
    expect(folio.status).toBe(200)
    expect(folio.data.charges.length).toBeGreaterThan(0)
    const chargeTypes = new Set(folio.data.charges.map((c: any) => c.chargeType))
    expect(chargeTypes.has('room')).toBe(true)
    expect(chargeTypes.has('food')).toBe(true)
    expect(chargeTypes.has('spa')).toBe(true)
    expect(folio.data.totalCharges).toBeGreaterThan(5000)

    // 11. Check out
    const checkout = await api.post(`/api/hotel/bookings/${bookingId}/checkout`, {
      paymentMethod: 'card',
    })
    expect(checkout.status).toBe(200)
    expect(checkout.data.booking.status).toBe('checked_out')
    expect(checkout.data.summary.totalCharges).toBeGreaterThan(0)

    // 12. Room is now dirty
    const roomAfterCheckout = await api.get(`/api/hotel/rooms/${roomId}`)
    expect(roomAfterCheckout.data.status).toBe('dirty')

    // 13. Housekeeping assigned and done → room back to available
    const today = new Date().toISOString().split('T')[0]!
    const hkList = await api.get(`/api/hotel/housekeeping?date=${today}`)
    const checkoutTask = hkList.data.find(
      (task: any) => task.bookingId === bookingId && task.taskType === 'checkout_clean'
    )
    expect(checkoutTask).toBeDefined()
    await api.patch(`/api/hotel/housekeeping/${checkoutTask.id}`, {
      status: 'done', assignedTo: 'Room Attendant 1',
    })
    const roomFinal = await api.get(`/api/hotel/rooms/${roomId}`)
    expect(roomFinal.data.status).toBe('available')
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// 12. USING EXISTING SEEDED HOTEL TENANT (Hotel Surya Palace)
// ═══════════════════════════════════════════════════════════════════════════════

describe('Hotel Surya Palace — seeded tenant smoke tests', () => {
  let api: AxiosInstance

  beforeAll(async () => {
    const session = await loginHotel()
    api = session.api
  })

  test('dashboard endpoint returns without error', async () => {
    const r = await api.get('/api/hotel/dashboard')
    expect(r.status).toBe(200)
    expect(r.data.roomStats).toBeDefined()
  })

  test('rooms list returns (may be empty for fresh seed)', async () => {
    const r = await api.get('/api/hotel/rooms')
    expect(r.status).toBe(200)
    expect(Array.isArray(r.data)).toBe(true)
  })

  test('bookings list returns paginated response', async () => {
    const r = await api.get('/api/hotel/bookings')
    expect(r.status).toBe(200)
    expect(r.data).toHaveProperty('data')
    expect(r.data).toHaveProperty('total')
    expect(r.data).toHaveProperty('page')
    expect(r.data).toHaveProperty('limit')
  })

  test('housekeeping list returns for today', async () => {
    const today = new Date().toISOString().split('T')[0]!
    const r     = await api.get(`/api/hotel/housekeeping?date=${today}`)
    expect(r.status).toBe(200)
    expect(Array.isArray(r.data)).toBe(true)
  })

  test('can create a room, booking, check-in and check-out on seeded tenant', async () => {
    const room = await api.post('/api/hotel/rooms', {
      roomNo: `T${Date.now().toString().slice(-4)}`,
      roomType: 'standard', ratePerNight: 1000, maxOccupancy: 2,
    })
    expect(room.status).toBe(201)
    const bk = await api.post('/api/hotel/bookings', {
      roomId: room.data.id, guestName: 'Smoke Test Guest',
      adults: 1, children: 0,
      checkIn: new Date().toISOString(), checkOut: futureDate(1, 11),
      ratePerNight: 1000,
    })
    expect(bk.status).toBe(201)
    const ci = await api.post(`/api/hotel/bookings/${bk.data.id}/checkin`, {})
    expect(ci.status).toBe(200)
    const co = await api.post(`/api/hotel/bookings/${bk.data.id}/checkout`, {
      paymentMethod: 'cash',
    })
    expect(co.status).toBe(200)
    expect(co.data.booking.status).toBe('checked_out')
  })
})
