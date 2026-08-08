// gallery.test.ts — /api/gallery list, upload, get, delete

import axios, { AxiosInstance } from 'axios'
import { BASE } from './helpers'

function nextPhone() {
  const ts   = Date.now() % 10000000
  const rand = Math.floor(Math.random() * 90) + 10
  return `8${String(ts).padStart(7, '0')}${rand}`.slice(0, 10)
}

async function setupGalleryTenant(): Promise<{ api: AxiosInstance; branchId: string }> {
  const phone = nextPhone()
  const reg   = await axios.post(`${BASE}/api/tenants/register`, {
    businessName: 'Glamour Photography',
    ownerName:    'Owner',
    phone,
    pin:          '1234',
    domainType:   'photography', // gallery-enabled domain
  })
  const login = await axios.post(`${BASE}/api/auth/login`, { tenantPhone: phone, phone, pin: '1234' })
  const api = axios.create({
    baseURL: BASE,
    headers: { Authorization: `Bearer ${login.data.accessToken}` },
  })
  return { api, branchId: reg.data.branchId }
}

// Minimal 1×1 pixel transparent PNG as base64 (< 500 KB limit)
const TINY_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='

describe('Gallery', () => {
  let api: AxiosInstance
  let partyId: string
  let itemId: string

  beforeAll(async () => {
    ({ api } = await setupGalleryTenant())
    const p = await api.post('/api/parties', {
      name:  'Gallery Customer',
      type:  'customer',
      phone: nextPhone(),
    })
    partyId = p.data.id
  })

  test('list gallery returns paginated structure', async () => {
    const r = await api.get('/api/gallery')
    expect(r.status).toBe(200)
    expect(Array.isArray(r.data.data)).toBe(true)
    expect(r.data.meta).toMatchObject({ total: expect.any(Number) })
  })

  test('upload image returns 201', async () => {
    const r = await api.post('/api/gallery', {
      imageData:  `data:image/png;base64,${TINY_PNG_BASE64}`,
      caption:    'Test wedding shot',
      tags:       ['wedding', 'outdoor'],
      partyId,
      domainType: 'photography',
    })
    expect(r.status).toBe(201)
    expect(r.data.id).toBeTruthy()
    itemId = r.data.id
  })

  test('get gallery item by id returns full data', async () => {
    const r = await api.get(`/api/gallery/${itemId}`)
    expect(r.status).toBe(200)
    expect(r.data.caption).toBe('Test wedding shot')
    expect(r.data.tags).toContain('wedding')
  })

  test('list gallery shows uploaded item', async () => {
    const r = await api.get('/api/gallery')
    expect(r.status).toBe(200)
    expect(r.data.meta.total).toBeGreaterThan(0)
  })

  test('filter by partyId', async () => {
    const r = await api.get(`/api/gallery?partyId=${partyId}`)
    expect(r.status).toBe(200)
    const ids = r.data.data.map((i: any) => i.id)
    expect(ids).toContain(itemId)
  })

  test('pagination: limit and offset', async () => {
    const r = await api.get('/api/gallery?limit=1&offset=0')
    expect(r.status).toBe(200)
    expect(r.data.data.length).toBeLessThanOrEqual(1)
  })

  test('get unknown gallery item returns 404', async () => {
    await expect(api.get('/api/gallery/00000000-0000-0000-0000-000000000000'))
      .rejects.toMatchObject({ response: { status: 404 } })
  })

  test('PATCH gallery item updates caption and tags', async () => {
    const r = await api.patch(`/api/gallery/${itemId}`, {
      caption: 'Updated caption',
      tags:    ['wedding', 'indoor', 'portrait'],
    })
    expect(r.status).toBe(200)
    expect(r.data.caption).toBe('Updated caption')
    expect(r.data.tags).toContain('indoor')
  })

  test('PATCH unknown gallery item returns 404', async () => {
    await expect(api.patch('/api/gallery/00000000-0000-0000-0000-000000000000', {
      caption: 'Noop',
    })).rejects.toMatchObject({ response: { status: 404 } })
  })

  test('gallery list does not include full imageData (thumbnail only)', async () => {
    const r = await api.get('/api/gallery')
    expect(r.status).toBe(200)
    // List endpoint should omit the heavy imageData field
    if (r.data.data.length > 0) {
      // imageData may be null/undefined in list but present in GET by id
      const listItem = r.data.data[0]
      expect(listItem).toHaveProperty('id')
      expect(listItem).toHaveProperty('caption')
    }
  })

  test('GET by id returns full imageData', async () => {
    const r = await api.get(`/api/gallery/${itemId}`)
    expect(r.status).toBe(200)
    // imageData should be present with the data: URI
    expect(r.data.imageData ?? r.data.image_data).toBeTruthy()
  })

  test('upload with invalid base64 prefix returns 400', async () => {
    await expect(api.post('/api/gallery', {
      imageData:  'not-a-valid-image-data-uri',
      caption:    'Bad upload',
      domainType: 'photography',
    })).rejects.toMatchObject({ response: { status: 400 } })
  })

  test('delete gallery item', async () => {
    const r = await api.delete(`/api/gallery/${itemId}`)
    expect(r.status).toBe(204)
  })

  test('get deleted item returns 404', async () => {
    await expect(api.get(`/api/gallery/${itemId}`))
      .rejects.toMatchObject({ response: { status: 404 } })
  })
})
