// brands.test.ts — GET / POST / PATCH /api/brands

import { loginWholesale } from './helpers'

describe('Brands', () => {
  let ws: Awaited<ReturnType<typeof loginWholesale>>
  let brandId: string

  beforeAll(async () => {
    ws = await loginWholesale()
  })

  test('list brands returns an array', async () => {
    const r = await ws.api.get('/api/brands')
    expect(r.status).toBe(200)
    expect(Array.isArray(r.data)).toBe(true)
  })

  test('create brand returns 201 with generated slug', async () => {
    const r = await ws.api.post('/api/brands', { name: `TestBrand ${Date.now()}` })
    expect(r.status).toBe(201)
    expect(r.data.id).toBeTruthy()
    expect(r.data.slug).toBeTruthy()
    brandId = r.data.id
  })

  test('create brand with explicit slug uses that slug', async () => {
    const slug = `custom-slug-${Date.now()}`
    const r = await ws.api.post('/api/brands', { name: 'Explicit Slug Brand', slug })
    expect(r.status).toBe(201)
    expect(r.data.slug).toBe(slug)
  })

  test('created brand appears in list', async () => {
    const r = await ws.api.get('/api/brands')
    const ids = r.data.map((b: any) => b.id)
    expect(ids).toContain(brandId)
  })

  test('patch brand name', async () => {
    const newName = `Updated Brand ${Date.now()}`
    const r = await ws.api.patch(`/api/brands/${brandId}`, { name: newName })
    expect(r.status).toBe(200)
    expect(r.data.name).toBe(newName)
  })

  test('deactivate brand (isActive=false)', async () => {
    const r = await ws.api.patch(`/api/brands/${brandId}`, { isActive: false })
    expect(r.status).toBe(200)
    expect(r.data.isActive).toBe(false)
  })

  test('deactivated brand no longer appears in list', async () => {
    const r = await ws.api.get('/api/brands')
    const ids = r.data.map((b: any) => b.id)
    expect(ids).not.toContain(brandId)
  })

  test('create brand without name returns 422', async () => {
    await expect(ws.api.post('/api/brands', {}))
      .rejects.toMatchObject({ response: { status: 422 } })
  })
})
