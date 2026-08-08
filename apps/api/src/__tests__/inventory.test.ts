import { loginWholesale, loginKirana } from './helpers'

describe('Stock & Inventory', () => {
  let ws: Awaited<ReturnType<typeof loginWholesale>>

  beforeAll(async () => { ws = await loginWholesale() })

  test('stock levels returns product list', async () => {
    const r = await ws.api.get('/api/stock/?limit=10')
    expect(r.status).toBe(200)
    expect(Array.isArray(r.data.data ?? r.data.items ?? r.data)).toBe(true)
  })

  test('low stock alerts endpoint works', async () => {
    const r = await ws.api.get('/api/stock/low')
    expect(r.status).toBe(200)
    expect(Array.isArray(r.data.data ?? r.data)).toBe(true)
  })

  test('expiry alerts endpoint works', async () => {
    const r = await ws.api.get('/api/stock/expiry-alerts')
    expect(r.status).toBe(200)
    // response: { batches: { expired, critical, warning, notice }, ... }
    expect(r.data.batches ?? r.data).toBeDefined()
  })
})

describe('GRN — Goods Receipt', () => {
  let ws: Awaited<ReturnType<typeof loginWholesale>>
  let grnId: string

  beforeAll(async () => { ws = await loginWholesale() })

  test('list GRNs returns array', async () => {
    const r = await ws.api.get('/api/grn')
    expect(r.status).toBe(200)
    expect(Array.isArray(r.data.data ?? r.data)).toBe(true)
  })

  test('create GRN without PO (unplanned receipt)', async () => {
    const r = await ws.api.post('/api/grn', {
      grnDate: new Date().toISOString().split('T')[0],
      invoiceNo: 'SUPP-INV-001',
      notes: 'Test receipt',
      items: [
        { description: 'Raw Material A', receivedQty: 50, unit: 'kg', rate: 80 },
        { description: 'Raw Material B', receivedQty: 20, unit: 'pcs', rate: 150 },
      ],
    })
    expect(r.status).toBe(201)
    expect(r.data.grnNo).toBeTruthy()
    expect(r.data.status).toBe('posted')
    expect(r.data.items.length).toBe(2)
    grnId = r.data.id
  })

  test('get GRN by ID', async () => {
    if (!grnId) return
    const r = await ws.api.get(`/api/grn/${grnId}`)
    expect(r.status).toBe(200)
    expect(r.data.id).toBe(grnId)
  })

  test('cancel GRN', async () => {
    if (!grnId) return
    const r = await ws.api.post(`/api/grn/${grnId}/cancel`, {})
    expect([200, 204]).toContain(r.status)
  })
})

describe('Purchase Orders', () => {
  let ws: Awaited<ReturnType<typeof loginWholesale>>

  beforeAll(async () => { ws = await loginWholesale() })

  test('list purchase orders', async () => {
    const r = await ws.api.get('/api/inventory/purchase-orders?limit=5')
    expect(r.status).toBe(200)
  })
})
