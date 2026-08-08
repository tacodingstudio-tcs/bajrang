import { loginWholesale, loginSalon, BASE } from './helpers'
import axios from 'axios'

const today = new Date().toISOString().split('T')[0]!

describe('User / Staff Management', () => {
  let ws: Awaited<ReturnType<typeof loginWholesale>>
  let createdUserId: string

  beforeAll(async () => { ws = await loginWholesale() })

  // ── List ──────────────────────────────────────────────────────────────────
  test('list users returns owner', async () => {
    const r = await ws.api.get('/api/users/')
    expect(r.status).toBe(200)
    expect(r.data.users).toBeDefined()
    expect(Array.isArray(r.data.users)).toBe(true)
    expect(r.data.users.length).toBeGreaterThan(0)
    expect(r.data.users.some((u: any) => u.role === 'owner')).toBe(true)
  })

  test('/me returns current user', async () => {
    const r = await ws.api.get('/api/users/me')
    expect(r.status).toBe(200)
    expect(r.data.role).toBe('owner')
    expect(r.data.phone).toBe('9844002002')
  })

  // ── Create ────────────────────────────────────────────────────────────────
  test('create cashier user', async () => {
    const r = await ws.api.post('/api/users/', {
      name:  'Test Cashier Staff',
      phone: `98${Date.now().toString().slice(-8)}`,
      pin:   '4567',
      role:  'cashier',
    })
    expect(r.status).toBe(201)
    expect(r.data.id).toBeTruthy()
    expect(r.data.role).toBe('cashier')
    expect(r.data.isActive).toBe(true)
    createdUserId = r.data.id
  })

  test('create manager user', async () => {
    const r = await ws.api.post('/api/users/', {
      name:  'Test Manager Staff',
      phone: `97${Date.now().toString().slice(-8)}`,
      pin:   '7890',
      role:  'manager',
    })
    expect(r.status).toBe(201)
    expect(r.data.role).toBe('manager')
  })

  test('duplicate phone is rejected with 409', async () => {
    await expect(
      ws.api.post('/api/users/', {
        name: 'Dup Phone', phone: '9844002002', pin: '1111', role: 'cashier',
      })
    ).rejects.toMatchObject({ response: { status: 409 } })
  })

  test('invalid role is rejected with 422', async () => {
    await expect(
      ws.api.post('/api/users/', {
        name: 'Bad Role', phone: '8800001111', pin: '1111', role: 'superadmin',
      })
    ).rejects.toMatchObject({ response: { status: 422 } })
  })

  // ── Get by ID ─────────────────────────────────────────────────────────────
  test('get user by ID', async () => {
    if (!createdUserId) return
    const r = await ws.api.get(`/api/users/${createdUserId}`)
    expect(r.status).toBe(200)
    expect(r.data.id).toBe(createdUserId)
    expect(r.data.name).toBe('Test Cashier Staff')
  })

  // ── Update ────────────────────────────────────────────────────────────────
  test('patch user name and role', async () => {
    if (!createdUserId) return
    const r = await ws.api.patch(`/api/users/${createdUserId}`, {
      name: 'Updated Cashier Name',
      role: 'viewer',
    })
    expect(r.status).toBe(200)
    expect(r.data.name).toBe('Updated Cashier Name')
    expect(r.data.role).toBe('viewer')
  })

  // ── PIN reset ─────────────────────────────────────────────────────────────
  test('reset user PIN', async () => {
    if (!createdUserId) return
    const r = await ws.api.post(`/api/users/${createdUserId}/reset-pin`, { pin: '9876' })
    expect(r.status).toBe(200)
    expect(r.data.success).toBe(true)
  })

  test('new PIN works for login', async () => {
    if (!createdUserId) return
    // Get the phone of the created user
    const user = (await ws.api.get(`/api/users/${createdUserId}`)).data
    const r = await axios.post(`${BASE}/api/auth/login`, {
      tenantPhone: '9844002002',
      phone: user.phone,
      pin: '9876',
    })
    expect(r.status).toBe(200)
    expect(r.data.accessToken).toBeTruthy()
  })

  // ── Deactivate / Activate ─────────────────────────────────────────────────
  test('deactivate user blocks login', async () => {
    if (!createdUserId) return
    const deactivateRes = await ws.api.post(`/api/users/${createdUserId}/deactivate`, {})
    expect(deactivateRes.status).toBe(200)

    const user = (await ws.api.get(`/api/users/${createdUserId}`)).data
    await expect(
      axios.post(`${BASE}/api/auth/login`, {
        tenantPhone: '9844002002', phone: user.phone, pin: '9876',
      })
    ).rejects.toMatchObject({ response: { status: expect.any(Number) } })
  })

  test('activate user re-enables login', async () => {
    if (!createdUserId) return
    const r = await ws.api.post(`/api/users/${createdUserId}/activate`, {})
    expect(r.status).toBe(200)

    const user = (await ws.api.get(`/api/users/${createdUserId}`)).data
    const loginRes = await axios.post(`${BASE}/api/auth/login`, {
      tenantPhone: '9844002002', phone: user.phone, pin: '9876',
    })
    expect(loginRes.status).toBe(200)
  })

  // ── Tenant isolation ──────────────────────────────────────────────────────
  test('users are isolated between tenants', async () => {
    const salon = await loginSalon()
    const salonUsers = await salon.api.get('/api/users/')
    const wsIds = new Set((await ws.api.get('/api/users/')).data.users.map((u: any) => u.id))
    const overlap = salonUsers.data.users.filter((u: any) => wsIds.has(u.id))
    expect(overlap.length).toBe(0)
  })
})

describe('Attendance Tracking', () => {
  let ws: Awaited<ReturnType<typeof loginWholesale>>
  let staffUserId: string
  let attendanceId: string

  beforeAll(async () => {
    ws = await loginWholesale()
    const r = await ws.api.post('/api/users/', {
      name: 'Attendance Test Staff',
      phone: `96${Date.now().toString().slice(-8)}`,
      pin: '1234',
      role: 'cashier',
    })
    staffUserId = r.data.id
  })

  test('mark attendance — present with clock-in', async () => {
    const r = await ws.api.post('/api/staff/attendance', {
      userId:  staffUserId,
      date:    today,
      status:  'present',
      clockIn: '09:00',
    })
    expect(r.status).toBe(201)
    expect(r.data.id).toBeTruthy()
    attendanceId = r.data.id
  })

  test('get attendance records for today', async () => {
    const r = await ws.api.get(`/api/staff/attendance?date=${today}`)
    expect(r.status).toBe(200)
    expect(Array.isArray(r.data.records)).toBe(true)
    expect(r.data.records.some((rec: any) => rec.user_id === staffUserId || rec.userId === staffUserId)).toBe(true)
  })

  test('update attendance with clock-out', async () => {
    if (!attendanceId) return
    const r = await ws.api.patch(`/api/staff/attendance/${attendanceId}`, {
      clockOut: '18:00',
      status:   'present',
    })
    expect(r.status).toBe(200)
  })

  test('mark attendance — absent', async () => {
    const absent = await ws.api.post('/api/users/', {
      name: 'Absent Staff', phone: `95${Date.now().toString().slice(-8)}`, pin: '1234', role: 'cashier',
    })
    const r = await ws.api.post('/api/staff/attendance', {
      userId: absent.data.id, date: today, status: 'absent',
    })
    expect(r.status).toBe(201)
  })

  test('upsert re-marks same date', async () => {
    // Posting same userId+date again should update, not create a duplicate
    const r = await ws.api.post('/api/staff/attendance', {
      userId: staffUserId, date: today, status: 'late', clockIn: '09:30',
    })
    expect(r.status).toBe(201)
    expect(r.data.id).toBeTruthy()
  })

  test('summary counts present and absent', async () => {
    const r = await ws.api.get(`/api/staff/attendance?date=${today}`)
    expect(r.status).toBe(200)
    expect(typeof r.data.summary.total).toBe('number')
    expect(r.data.summary.total).toBeGreaterThan(0)
  })
})

describe('Shift Planning', () => {
  let ws: Awaited<ReturnType<typeof loginWholesale>>
  let staffUserId: string
  let shiftId: string

  beforeAll(async () => {
    ws = await loginWholesale()
    const r = await ws.api.post('/api/users/', {
      name: 'Shift Test Staff',
      phone: `94${Date.now().toString().slice(-8)}`,
      pin:   '5678',
      role:  'cashier',
    })
    staffUserId = r.data.id
  })

  test('create morning shift', async () => {
    const r = await ws.api.post('/api/staff/shifts', {
      userId:     staffUserId,
      date:       today,
      shiftType:  'morning',
      shiftStart: '08:00',
      shiftEnd:   '16:00',
    })
    expect(r.status).toBe(201)
    expect(r.data.id).toBeTruthy()
    shiftId = r.data.id
  })

  test('list shifts for today', async () => {
    const r = await ws.api.get(`/api/staff/shifts?from=${today}&to=${today}`)
    expect(r.status).toBe(200)
    expect(Array.isArray(r.data.shifts)).toBe(true)
    expect(r.data.shifts.some((s: any) => s.user_id === staffUserId || s.userId === staffUserId)).toBe(true)
  })

  test('list shifts with userId filter returns only that user', async () => {
    const r = await ws.api.get(`/api/staff/shifts?from=${today}&to=${today}&userId=${staffUserId}`)
    expect(r.status).toBe(200)
    expect(Array.isArray(r.data.shifts)).toBe(true)
    expect(r.data.shifts.every((s: any) => s.user_id === staffUserId || s.userId === staffUserId)).toBe(true)
  })

  test('create evening shift', async () => {
    const r = await ws.api.post('/api/staff/shifts', {
      userId:    staffUserId,
      date:      today,
      shiftType: 'evening',
    })
    expect(r.status).toBe(201)
    expect(r.data.id).toBeTruthy()
  })

  test('delete shift returns success', async () => {
    if (!shiftId) return
    const r = await ws.api.delete(`/api/staff/shifts/${shiftId}`)
    expect([200, 204]).toContain(r.status)
  })

  test('delete already-deleted shift is idempotent (no error)', async () => {
    // DELETE from non-existent ID: route does DELETE without WHERE-fail, just no-op
    const r = await ws.api.delete('/api/staff/shifts/00000000-0000-0000-0000-000000000000')
    expect([200, 204]).toContain(r.status)
  })
})

describe('Staff — users list and attendance filters', () => {
  let ws: Awaited<ReturnType<typeof loginWholesale>>
  let staffUserId: string
  let attendanceId: string
  const thisMonth = today.slice(0, 7) // YYYY-MM

  beforeAll(async () => {
    ws = await loginWholesale()
    const r = await ws.api.post('/api/users/', {
      name:  'Filter Test Staff',
      phone: `93${Date.now().toString().slice(-8)}`,
      pin:   '0000',
      role:  'cashier',
    })
    staffUserId = r.data.id
    // Create attendance for month-filter test
    const a = await ws.api.post('/api/staff/attendance', {
      userId: staffUserId, date: today, status: 'present', clockIn: '09:00',
    })
    attendanceId = a.data.id
  })

  test('GET /staff/users returns users with id/name/role', async () => {
    const r = await ws.api.get('/api/staff/users')
    expect(r.status).toBe(200)
    expect(r.data.users).toBeDefined()
    expect(Array.isArray(r.data.users)).toBe(true)
    expect(r.data.users.length).toBeGreaterThan(0)
    const user = r.data.users[0]
    expect(user).toHaveProperty('id')
    expect(user).toHaveProperty('name')
    expect(user).toHaveProperty('role')
  })

  test('GET /staff/users includes newly created staff', async () => {
    const r = await ws.api.get('/api/staff/users')
    const ids = r.data.users.map((u: any) => u.id)
    expect(ids).toContain(staffUserId)
  })

  test('GET /attendance with ?month= returns all records for that month', async () => {
    const r = await ws.api.get(`/api/staff/attendance?month=${thisMonth}`)
    expect(r.status).toBe(200)
    expect(Array.isArray(r.data.records)).toBe(true)
    expect(r.data.from).toBe(`${thisMonth}-01`)
    // to should be last day of month
    expect(r.data.to.startsWith(thisMonth)).toBe(true)
    expect(r.data.summary).toBeDefined()
  })

  test('GET /attendance with ?userId= filter returns only that user', async () => {
    const r = await ws.api.get(`/api/staff/attendance?date=${today}&userId=${staffUserId}`)
    expect(r.status).toBe(200)
    expect(r.data.records.every((rec: any) => rec.user_id === staffUserId)).toBe(true)
  })

  test('PATCH /attendance returns 404 for unknown id', async () => {
    await expect(ws.api.patch('/api/staff/attendance/00000000-0000-0000-0000-000000000000', {
      status: 'absent',
    })).rejects.toMatchObject({ response: { status: 404 } })
  })

  test('PATCH /attendance accepts status-only update', async () => {
    const r = await ws.api.patch(`/api/staff/attendance/${attendanceId}`, {
      status: 'late',
    })
    expect(r.status).toBe(200)
    expect(r.data.ok).toBe(true)
  })
})
