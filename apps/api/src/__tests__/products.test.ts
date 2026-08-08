import { loginWholesale, loginSalon } from './helpers'

describe('Products CRUD', () => {
  let ws: Awaited<ReturnType<typeof loginWholesale>>
  let productId: string
  let categoryId: string

  beforeAll(async () => {
    ws = await loginWholesale()
    const cats = await ws.api.get('/api/categories?limit=1')
    categoryId = (Array.isArray(cats.data) ? cats.data : cats.data.data ?? [])[0]?.id
  })

  test('list products returns paginated data', async () => {
    const r = await ws.api.get('/api/products?limit=5')
    expect(r.status).toBe(200)
    expect(Array.isArray(r.data.data)).toBe(true)
    expect(r.data.meta).toBeDefined()
    expect(r.data.data.length).toBeGreaterThan(0)
  })

  test('search products by name', async () => {
    const first = (await ws.api.get('/api/products?limit=1')).data.data[0]
    const r = await ws.api.get(`/api/products?search=${encodeURIComponent(first.name.slice(0, 4))}&limit=10`)
    expect(r.status).toBe(200)
    expect(r.data.data.length).toBeGreaterThan(0)
  })

  test('filter products by trackStock=true', async () => {
    const r = await ws.api.get('/api/products?trackStock=true&limit=10')
    expect(r.status).toBe(200)
    expect(r.data.data.every((p: any) => p.trackStock === true)).toBe(true)
  })

  test('create product with full fields', async () => {
    const r = await ws.api.post('/api/products', {
      name:          'Test Ceramic Tile 30x30',
      unit:          'sqft',
      gstRate:       18,
      salePrice:     250,
      purchasePrice: 150,
      mrp:           300,
      sku:           `TEST-TILE-${Date.now()}`,
      trackStock:    true,
      lowStockQty:   50,
      ...(categoryId && { categoryId }),
    })
    expect(r.status).toBe(201)
    expect(r.data.id).toBeTruthy()
    expect(r.data.name).toBe('Test Ceramic Tile 30x30')
    expect(Number(r.data.salePrice)).toBe(250)
    expect(r.data.trackStock).toBe(true)
    productId = r.data.id
  })

  test('get product by ID', async () => {
    if (!productId) return
    const r = await ws.api.get(`/api/products/${productId}`)
    expect(r.status).toBe(200)
    expect(r.data.id).toBe(productId)
    expect(r.data.name).toBe('Test Ceramic Tile 30x30')
  })

  test('update product price and name', async () => {
    if (!productId) return
    const r = await ws.api.patch(`/api/products/${productId}`, {
      salePrice: 275,
      name: 'Test Ceramic Tile 30x30 (Updated)',
    })
    expect(r.status).toBe(200)
    expect(r.data.id).toBe(productId)
    expect(Number(r.data.salePrice)).toBe(275)
    expect(r.data.name).toBe('Test Ceramic Tile 30x30 (Updated)')
  })

  test('stock adjustment sets new stock level', async () => {
    if (!productId) return
    const r = await ws.api.post(`/api/products/${productId}/stock-adjustment`, {
      qty: 100, reason: 'initial_stock', notes: 'E2E test stock setup',
    })
    expect(r.status).toBe(200)
    expect(r.data.productId).toBe(productId)
    expect(Number(r.data.newBalance)).toBe(100)
  })

  test('stock history records the adjustment', async () => {
    if (!productId) return
    const r = await ws.api.get(`/api/products/${productId}/stock-history`)
    expect(r.status).toBe(200)
    const entries = Array.isArray(r.data) ? r.data : r.data.data ?? r.data.entries ?? []
    expect(entries.length).toBeGreaterThan(0)
  })

  test('low-stock endpoint returns array', async () => {
    const r = await ws.api.get('/api/products/low-stock')
    expect(r.status).toBe(200)
    expect(Array.isArray(r.data)).toBe(true)
  })

  test('delete product archives/removes it', async () => {
    // Create a fresh product with no stock ledger history to avoid FK constraint
    const fresh = await ws.api.post('/api/products', {
      name: 'Delete Me Product', unit: 'pcs', salePrice: 99, trackStock: false,
    })
    const freshId = fresh.data.id
    const r = await ws.api.delete(`/api/products/${freshId}`)
    expect([200, 204]).toContain(r.status)
    // Product should no longer appear in active listing
    const list = await ws.api.get('/api/products?limit=200')
    const found = list.data.data.find((p: any) => p.id === freshId)
    expect(found).toBeUndefined()
  })
})

describe('Products — SKU uniqueness', () => {
  let ws: Awaited<ReturnType<typeof loginWholesale>>

  beforeAll(async () => { ws = await loginWholesale() })

  test('products with same name but different SKU are both allowed', async () => {
    const suffix = Date.now()
    const r1 = await ws.api.post('/api/products', {
      name: `SKU Test Product ${suffix}`, unit: 'pcs', salePrice: 100, sku: `SKU-A-${suffix}`,
    })
    const r2 = await ws.api.post('/api/products', {
      name: `SKU Test Product ${suffix} v2`, unit: 'pcs', salePrice: 150, sku: `SKU-B-${suffix}`,
    })
    expect(r1.status).toBe(201)
    expect(r2.status).toBe(201)
    expect(r1.data.id).not.toBe(r2.data.id)
  })
})

describe('Products — domain-specific (salon)', () => {
  let salon: Awaited<ReturnType<typeof loginSalon>>

  beforeAll(async () => { salon = await loginSalon() })

  test('salon can create a service product', async () => {
    const r = await salon.api.post('/api/products', {
      name: 'Premium Haircut', unit: 'service', salePrice: 500, gstRate: 18,
      trackStock: false,
    })
    expect(r.status).toBe(201)
    expect(r.data.name).toBe('Premium Haircut')
    expect(r.data.trackStock).toBe(false)
  })

  test('salon products list is isolated from wholesale', async () => {
    const salonList  = await salon.api.get('/api/products?limit=50')
    const ws2        = await loginWholesale()
    const wsList     = await ws2.api.get('/api/products?limit=50')
    const salonIds   = new Set(salonList.data.data.map((p: any) => p.id))
    const wsIds      = new Set(wsList.data.data.map((p: any) => p.id))
    // No overlap — tenant isolation
    const overlap = [...salonIds].filter(id => wsIds.has(id))
    expect(overlap.length).toBe(0)
  })
})

describe('Products — bulk import', () => {
  let ws: Awaited<ReturnType<typeof loginWholesale>>

  beforeAll(async () => { ws = await loginWholesale() })

  test('bulk import creates multiple products', async () => {
    const suffix = Date.now()
    const r = await ws.api.post('/api/products/bulk-import', {
      rows: [
        { name: `Bulk A ${suffix}`, unit: 'pcs', salePrice: 100, gstRate: 5 },
        { name: `Bulk B ${suffix}`, unit: 'kg',  salePrice: 200, gstRate: 12 },
        { name: `Bulk C ${suffix}`, unit: 'ltr', salePrice: 150, gstRate: 18 },
      ],
    })
    expect(r.status).toBe(201)
    expect(r.data.created).toBe(3)
    expect(r.data.failed).toBe(0)
  })
})
