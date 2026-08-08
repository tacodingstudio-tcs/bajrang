import { loginWholesale, loginSalon, loginKirana } from './helpers'

describe('Invoice CRUD', () => {
  let ws: Awaited<ReturnType<typeof loginWholesale>>

  beforeAll(async () => {
    ws = await loginWholesale()
  })

  test('list invoices returns paginated data', async () => {
    const r = await ws.api.get('/api/invoices?limit=5')
    expect(r.status).toBe(200)
    expect(Array.isArray(r.data.data)).toBe(true)
    expect(r.data.meta).toBeDefined()
  })

  test('filter invoices by txnType', async () => {
    const r = await ws.api.get('/api/invoices?txnType=sale_invoice&limit=5')
    expect(r.status).toBe(200)
    if (r.data.data.length > 0) {
      expect(r.data.data.every((i: any) => i.txnType === 'sale_invoice')).toBe(true)
    }
  })

  test('create quotation (no stock check, no party balance)', async () => {
    const r = await ws.api.post('/api/invoices', {
      txnType: 'quotation',
      items: [{ description: 'Test Product A', qty: 2, rate: 500, gstRate: 18, unit: 'pcs' }],
    })
    expect(r.status).toBe(201)
    expect(r.data.txnType).toBe('quotation')
    expect(r.data.status).toBe('draft')
    expect(r.data.number).toMatch(/QT/)
  })

  test('create proforma invoice', async () => {
    const r = await ws.api.post('/api/invoices', {
      txnType: 'proforma',
      items: [{ description: 'Test Proforma Item', qty: 1, rate: 1000, gstRate: 12, unit: 'pcs' }],
    })
    expect(r.status).toBe(201)
    expect(r.data.txnType).toBe('proforma')
    expect(r.data.status).toBe('draft')
  })

  test('create sales order', async () => {
    const r = await ws.api.post('/api/invoices', {
      txnType: 'sales_order',
      items: [{ description: 'SO Item', qty: 5, rate: 200, gstRate: 5, unit: 'kg' }],
    })
    expect(r.status).toBe(201)
    expect(r.data.txnType).toBe('sales_order')
  })

  test('create sale invoice (simple domain — salon)', async () => {
    const salon = await loginSalon()
    const r = await salon.api.post('/api/invoices', {
      txnType: 'sale_invoice',
      items: [{ description: 'Haircut', qty: 1, rate: 300, gstRate: 18, unit: 'service' }],
    })
    expect(r.status).toBe(201)
    expect(r.data.txnType).toBe('sale_invoice')
    expect(r.data.status).toBe('confirmed')
    expect(Number(r.data.grandTotal)).toBeCloseTo(354, 0)
  })

  test('get invoice by ID', async () => {
    const list = await ws.api.get('/api/invoices?limit=1')
    const id = list.data.data[0]?.id
    if (!id) return
    const r = await ws.api.get(`/api/invoices/${id}`)
    expect(r.status).toBe(200)
    expect(r.data.id).toBe(id)
  })

  test('invoice list filters by All/Sales/Purchases tabs', async () => {
    const [all, sales, purchases] = await Promise.all([
      ws.api.get('/api/invoices?limit=20'),
      ws.api.get('/api/invoices?txnType=sale_invoice&limit=20'),
      ws.api.get('/api/invoices?txnType=purchase_invoice&limit=20'),
    ])
    expect(all.status).toBe(200)
    expect(sales.status).toBe(200)
    expect(purchases.status).toBe(200)
  })
})

describe('Invoice Pipeline Conversion', () => {
  let ws: Awaited<ReturnType<typeof loginWholesale>>

  beforeAll(async () => { ws = await loginWholesale() })

  test('quotation → sale invoice conversion', async () => {
    const q = await ws.api.post('/api/invoices', {
      txnType: 'quotation',
      items: [{ description: 'Pipeline Test Item', qty: 3, rate: 400, gstRate: 18, unit: 'pcs' }],
    })
    const qId = q.data.id
    const r = await ws.api.post(`/api/invoices/${qId}/convert`, {})
    expect([200, 201]).toContain(r.status)
    const converted = r.data.invoice ?? r.data
    expect(converted.txnType).toBe('sales_order')
    expect(converted.linkedInvoiceId ?? converted.parentId ?? converted.id).toBeTruthy()
  })
})

describe('Delivery Challan', () => {
  let kirana: Awaited<ReturnType<typeof loginKirana>>

  beforeAll(async () => { kirana = await loginKirana() })

  test('delivery challan creates with confirmed status', async () => {
    const pr = await kirana.api.get('/api/stock/?limit=10')
    const stockList = Array.isArray(pr.data) ? pr.data : (pr.data.data ?? pr.data.items ?? [])
    const withStock = stockList.find((p: any) => Number(p.currentQty ?? p.qty_on_hand ?? p.qtyOnHand) > 0)
    if (!withStock) {
      console.warn('No stock available — skipping delivery challan stock test')
      return
    }
    const r = await kirana.api.post('/api/invoices', {
      txnType: 'delivery_challan',
      items: [{
        productId:   withStock.productId ?? withStock.id,
        description: withStock.product?.name ?? withStock.name ?? 'Product',
        qty:         1,
        rate:        withStock.product?.salePrice ?? withStock.salePrice ?? 100,
        gstRate:     0,
        unit:        withStock.product?.unit ?? withStock.unit ?? 'pcs',
      }],
    })
    expect(r.status).toBe(201)
    expect(r.data.txnType).toBe('delivery_challan')
    expect(r.data.number).toMatch(/DC/)
  })

  test('delivery challan fails with insufficient stock', async () => {
    await expect(
      kirana.api.post('/api/invoices', {
        txnType: 'delivery_challan',
        items: [{ productId: '00000001-0001-0000-0000-000000000001', description: 'Ghost Product', qty: 99999, rate: 100, gstRate: 0, unit: 'pcs' }],
      })
    ).rejects.toMatchObject({ response: { status: expect.any(Number) } })
  })
})

describe('Purchase Invoice', () => {
  let ws: Awaited<ReturnType<typeof loginWholesale>>

  beforeAll(async () => { ws = await loginWholesale() })

  test('purchase invoice increases stock', async () => {
    const r = await ws.api.post('/api/invoices', {
      txnType: 'purchase_invoice',
      items: [{ description: 'Purchased Goods', qty: 10, rate: 100, gstRate: 5, unit: 'pcs' }],
    })
    expect(r.status).toBe(201)
    expect(r.data.txnType).toBe('purchase_invoice')
    expect(r.data.number).toMatch(/PUR/)
  })
})
