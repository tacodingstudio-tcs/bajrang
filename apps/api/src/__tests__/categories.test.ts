// categories.test.ts — full CRUD coverage for /api/categories

import { loginWholesale } from './helpers'

describe('Categories', () => {
  let ws: Awaited<ReturnType<typeof loginWholesale>>
  let catId: string
  let childId: string

  beforeAll(async () => {
    ws = await loginWholesale()
  })

  test('list categories returns an array (seeds domain defaults on first call)', async () => {
    const r = await ws.api.get('/api/categories')
    expect(r.status).toBe(200)
    const items = Array.isArray(r.data) ? r.data : r.data?.data ?? []
    expect(items.length).toBeGreaterThan(0)
  })

  test('create category returns 201', async () => {
    const r = await ws.api.post('/api/categories', { name: `Test Cat ${Date.now()}`, sortOrder: 99 })
    expect(r.status).toBe(201)
    expect(r.data.id).toBeTruthy()
    catId = r.data.id
  })

  test('create child category with parentId', async () => {
    const r = await ws.api.post('/api/categories', {
      name: `Child Cat ${Date.now()}`,
      parentId: catId,
      sortOrder: 0,
    })
    expect(r.status).toBe(201)
    expect(r.data.parentId).toBe(catId)
    childId = r.data.id
  })

  test('create category with icon and color', async () => {
    const r = await ws.api.post('/api/categories', {
      name:     `Styled Cat ${Date.now()}`,
      icon:     '🏠',
      color:    '#FF5733',
      sortOrder: 10,
    })
    expect(r.status).toBe(201)
    expect(r.data.icon).toBe('🏠')
    expect(r.data.color).toBe('#FF5733')
  })

  test('patch category name and sortOrder', async () => {
    const r = await ws.api.patch(`/api/categories/${catId}`, {
      name:      'Updated Cat Name',
      sortOrder: 50,
    })
    expect(r.status).toBe(200)
    expect(r.data.name).toBe('Updated Cat Name')
    expect(r.data.sortOrder).toBe(50)
  })

  test('soft-delete category (isActive=false via DELETE)', async () => {
    const r = await ws.api.delete(`/api/categories/${childId}`)
    expect(r.status).toBe(204)
  })

  test('deleted category no longer in list', async () => {
    const r = await ws.api.get('/api/categories')
    const items: any[] = Array.isArray(r.data) ? r.data : r.data?.data ?? []
    expect(items.find((c: any) => c.id === childId)).toBeUndefined()
  })

  test('create category without name returns 422', async () => {
    await expect(ws.api.post('/api/categories', {}))
      .rejects.toMatchObject({ response: { status: 422 } })
  })
})
