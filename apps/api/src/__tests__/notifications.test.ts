// notifications.test.ts — /api/notifications inbox + mark-read + approve/dismiss

import axios, { AxiosInstance } from 'axios'
import { BASE } from './helpers'

function nextPhone() {
  const ts   = Date.now() % 10000000
  const rand = Math.floor(Math.random() * 90) + 10
  return `8${String(ts).padStart(7, '0')}${rand}`.slice(0, 10)
}

async function setupTenant(): Promise<{ api: AxiosInstance; branchId: string }> {
  const phone = nextPhone()
  const reg   = await axios.post(`${BASE}/api/tenants/register`, {
    businessName: 'Notif Test Biz',
    ownerName: 'Owner',
    phone,
    pin: '1234',
    domainType: 'retail',
  })
  const login = await axios.post(`${BASE}/api/auth/login`, { tenantPhone: phone, phone, pin: '1234' })
  const api = axios.create({
    baseURL: BASE,
    headers: { Authorization: `Bearer ${login.data.accessToken}` },
  })
  return { api, branchId: reg.data.branchId }
}

describe('Notifications — list and counts', () => {
  let api: AxiosInstance

  beforeAll(async () => {
    ({ api } = await setupTenant())
  })

  test('unread-count returns a number', async () => {
    const r = await api.get('/api/notifications/unread-count')
    expect(r.status).toBe(200)
    expect(typeof r.data.count).toBe('number')
  })

  test('list notifications returns paginated structure with meta', async () => {
    const r = await api.get('/api/notifications')
    expect(r.status).toBe(200)
    expect(Array.isArray(r.data.items)).toBe(true)
    // Route returns { total, page, limit, items }
    expect(typeof r.data.total).toBe('number')
    expect(typeof r.data.page).toBe('number')
    expect(typeof r.data.limit).toBe('number')
  })

  test('list with isRead=false returns only unread', async () => {
    const r = await api.get('/api/notifications?isRead=false')
    expect(r.status).toBe(200)
    expect(r.data.items.every((n: any) => n.isRead === false)).toBe(true)
  })

  test('list with approved=pending returns only null-approved items', async () => {
    const r = await api.get('/api/notifications?approved=pending')
    expect(r.status).toBe(200)
    expect(r.data.items.every((n: any) => n.approved === null || n.approved === undefined)).toBe(true)
  })

  test('list with approved=approved filter works', async () => {
    const r = await api.get('/api/notifications?approved=approved')
    expect(r.status).toBe(200)
    expect(Array.isArray(r.data.items)).toBe(true)
  })

  test('list with approved=dismissed filter works', async () => {
    const r = await api.get('/api/notifications?approved=dismissed')
    expect(r.status).toBe(200)
    expect(Array.isArray(r.data.items)).toBe(true)
  })

  test('list with pagination limit works', async () => {
    const r = await api.get('/api/notifications?limit=5&page=1')
    expect(r.status).toBe(200)
    expect(r.data.items.length).toBeLessThanOrEqual(5)
    expect(r.data.limit).toBe(5)
  })
})

describe('Notifications — mark-all-read', () => {
  let api: AxiosInstance

  beforeAll(async () => {
    ({ api } = await setupTenant())
  })

  test('mark-all-read returns markedRead count (not "updated")', async () => {
    const r = await api.post('/api/notifications/mark-all-read')
    expect(r.status).toBe(200)
    // Route returns { markedRead: count } — NOT { updated }
    expect(typeof r.data.markedRead).toBe('number')
    expect(r.data.markedRead).toBeGreaterThanOrEqual(0)
  })

  test('unread-count is 0 after mark-all-read', async () => {
    await api.post('/api/notifications/mark-all-read')
    const r = await api.get('/api/notifications/unread-count')
    expect(r.status).toBe(200)
    expect(r.data.count).toBe(0)
  })
})

describe('Notifications — get by id and mark-read', () => {
  let api: AxiosInstance

  beforeAll(async () => {
    ({ api } = await setupTenant())
  })

  test('get unknown notification returns 404', async () => {
    await expect(
      api.get('/api/notifications/00000000-0000-0000-0000-000000000000')
    ).rejects.toMatchObject({ response: { status: 404 } })
  })

  test('mark unknown notification read returns 404', async () => {
    await expect(
      api.post('/api/notifications/00000000-0000-0000-0000-000000000000/read')
    ).rejects.toMatchObject({ response: { status: 404 } })
  })

  test('approve unknown notification returns 404', async () => {
    await expect(
      api.post('/api/notifications/00000000-0000-0000-0000-000000000000/approve')
    ).rejects.toMatchObject({ response: { status: 404 } })
  })

  test('dismiss unknown notification returns 404', async () => {
    await expect(
      api.post('/api/notifications/00000000-0000-0000-0000-000000000000/dismiss')
    ).rejects.toMatchObject({ response: { status: 404 } })
  })
})
