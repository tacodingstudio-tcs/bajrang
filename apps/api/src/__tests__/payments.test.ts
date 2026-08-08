import { loginWholesale, loginKirana } from './helpers'

const today = new Date().toISOString().split('T')[0]

describe('Payments — invoice-level payments', () => {
  let ws: Awaited<ReturnType<typeof loginWholesale>>
  let invoiceId: string

  beforeAll(async () => {
    ws = await loginWholesale()
    const r = await ws.api.post('/api/invoices', {
      txnType: 'sale_invoice',
      items: [{ description: 'Payment Test Item', qty: 1, rate: 1000, gstRate: 0, unit: 'pcs' }],
    })
    invoiceId = r.data.id
  })

  test('record cash payment against invoice marks partial', async () => {
    const r = await ws.api.post(`/api/invoices/${invoiceId}/payment`, {
      amount: 500, method: 'cash',
    })
    expect(r.status).toBe(201)
    expect(r.data.invoiceStatus).toBe('partial')
    expect(Number(r.data.remainingBalance)).toBeCloseTo(500, 0)
  })

  test('record cheque/PDC payment that completes payment marks paid', async () => {
    const r = await ws.api.post(`/api/invoices/${invoiceId}/payment`, {
      amount: 500, method: 'cheque',
      refNo: 'CHQ-001', chequeNo: '123456', chequeDueDate: '2026-07-15', bankName: 'SBI',
    })
    expect(r.status).toBe(201)
    expect(r.data.invoiceStatus).toBe('paid')
  })

  test('overpayment is rejected', async () => {
    const inv = await ws.api.post('/api/invoices', {
      txnType: 'sale_invoice',
      items: [{ description: 'Overpay Test', qty: 1, rate: 100, gstRate: 0, unit: 'pcs' }],
    })
    await expect(
      ws.api.post(`/api/invoices/${inv.data.id}/payment`, { amount: 9999, method: 'cash' })
    ).rejects.toMatchObject({ response: { status: expect.any(Number) } })
  })
})

describe('Payments — standalone /api/payments CRUD', () => {
  let ws: Awaited<ReturnType<typeof loginWholesale>>
  let partyId: string
  let paymentId: string

  beforeAll(async () => {
    ws = await loginWholesale()
    const parties = await ws.api.get('/api/parties?limit=1&type=customer')
    partyId = (parties.data.data ?? parties.data)?.[0]?.id
    if (!partyId) {
      // create a party if none exists
      const p = await ws.api.post('/api/parties', {
        name: 'Payment Test Party', type: 'customer',
        phone: `7${Date.now().toString().slice(-9)}`,
      })
      partyId = p.data.id
    }
  })

  test('list payments returns paginated structure', async () => {
    const r = await ws.api.get('/api/payments?limit=10')
    expect(r.status).toBe(200)
    expect(Array.isArray(r.data.items)).toBe(true)
    expect(typeof r.data.total).toBe('number')
    expect(r.data.page).toBe(1)
  })

  test('create standalone advance payment', async () => {
    const r = await ws.api.post('/api/payments', {
      partyId,
      amount:      3000,
      method:      'upi',
      type:        'advance',
      paymentDate: today,
      notes:       'Standalone advance test',
    })
    expect(r.status).toBe(201)
    expect(r.data.id).toBeTruthy()
    expect(r.data.type).toBe('advance')
    expect(Number(r.data.amount)).toBe(3000)
    paymentId = r.data.id
  })

  test('create standalone receipt payment', async () => {
    const r = await ws.api.post('/api/payments', {
      partyId,
      amount:      1500,
      method:      'cash',
      type:        'receipt',
      paymentDate: today,
    })
    expect(r.status).toBe(201)
    expect(r.data.type).toBe('receipt')
  })

  test('create standalone expense payment without partyId', async () => {
    const r = await ws.api.post('/api/payments', {
      amount:      500,
      method:      'cash',
      type:        'expense',
      paymentDate: today,
      notes:       'Office supplies',
    })
    expect(r.status).toBe(201)
    expect(r.data.type).toBe('expense')
  })

  test('create payment with unknown partyId returns 422', async () => {
    await expect(ws.api.post('/api/payments', {
      partyId: '00000000-0000-0000-0000-000000000000',
      amount:  100,
      method:  'cash',
    })).rejects.toMatchObject({ response: { status: 422 } })
  })

  test('create payment with zero/negative amount returns 422', async () => {
    await expect(ws.api.post('/api/payments', {
      partyId, amount: -50, method: 'cash',
    })).rejects.toMatchObject({ response: { status: 422 } })
  })

  test('GET /payments/:id returns payment with allocations', async () => {
    const r = await ws.api.get(`/api/payments/${paymentId}`)
    expect(r.status).toBe(200)
    expect(r.data.id).toBe(paymentId)
    expect(Array.isArray(r.data.allocations)).toBe(true)
    expect(typeof r.data.allocated).toBe('number')
    expect(typeof r.data.unallocated).toBe('number')
    expect(r.data.unallocated).toBeCloseTo(3000, 0)
  })

  test('GET /payments/:id returns 404 for unknown id', async () => {
    await expect(ws.api.get('/api/payments/00000000-0000-0000-0000-000000000000'))
      .rejects.toMatchObject({ response: { status: 404 } })
  })

  test('filter payments by method', async () => {
    const r = await ws.api.get('/api/payments?method=upi&limit=20')
    expect(r.status).toBe(200)
    expect(r.data.items.every((p: any) => p.method === 'upi')).toBe(true)
  })

  test('filter payments by type=advance', async () => {
    const r = await ws.api.get('/api/payments?type=advance&limit=20')
    expect(r.status).toBe(200)
    expect(r.data.items.every((p: any) => p.type === 'advance')).toBe(true)
  })

  test('filter payments by partyId', async () => {
    const r = await ws.api.get(`/api/payments?partyId=${partyId}&limit=20`)
    expect(r.status).toBe(200)
    expect(r.data.items.every((p: any) => p.partyId === partyId)).toBe(true)
  })

  test('filter payments by date range', async () => {
    const r = await ws.api.get(`/api/payments?fromDate=${today}&toDate=${today}&limit=20`)
    expect(r.status).toBe(200)
    expect(Array.isArray(r.data.items)).toBe(true)
  })
})

describe('Payments — allocate advance to invoice', () => {
  let ws: Awaited<ReturnType<typeof loginWholesale>>
  let partyId: string
  let invoiceId: string
  let paymentId: string

  beforeAll(async () => {
    ws = await loginWholesale()
    // Create party, invoice, then advance payment
    const p = await ws.api.post('/api/parties', {
      name: 'Alloc Test Party', type: 'customer',
      phone: `7${Date.now().toString().slice(-9)}`,
    })
    partyId = p.data.id

    const inv = await ws.api.post('/api/invoices', {
      txnType: 'sale_invoice', partyId,
      items: [{ description: 'Alloc Test', qty: 1, rate: 2000, gstRate: 0, unit: 'pcs' }],
    })
    invoiceId = inv.data.id

    const pay = await ws.api.post('/api/payments', {
      partyId, amount: 2000, method: 'upi', type: 'advance', paymentDate: today,
    })
    paymentId = pay.data.id
  })

  test('allocate advance to invoice marks invoice paid', async () => {
    const r = await ws.api.post(`/api/payments/${paymentId}/allocate`, {
      allocations: [{ invoiceId, amount: 2000 }],
    })
    expect(r.status).toBe(200)
    expect(r.data.paymentId).toBe(paymentId)
    expect(r.data.totalAllocated).toBe(2000)
    expect(r.data.allocatedInvoices[0].newStatus).toBe('paid')
  })

  test('over-allocation returns 422', async () => {
    // paymentId is already fully allocated
    await expect(ws.api.post(`/api/payments/${paymentId}/allocate`, {
      allocations: [{ invoiceId, amount: 9999 }],
    })).rejects.toMatchObject({ response: { status: 422 } })
  })

  test('allocate to voided payment returns 409', async () => {
    // Create a fresh payment, void it, then try to allocate
    const pay2 = await ws.api.post('/api/payments', {
      partyId, amount: 500, method: 'cash', type: 'advance', paymentDate: today,
    })
    await ws.api.post(`/api/payments/${pay2.data.id}/void`, { reason: 'Test void' })
    await expect(ws.api.post(`/api/payments/${pay2.data.id}/allocate`, {
      allocations: [{ invoiceId, amount: 100 }],
    })).rejects.toMatchObject({ response: { status: 409 } })
  })
})

describe('Payments — void', () => {
  let ws: Awaited<ReturnType<typeof loginWholesale>>
  let partyId: string
  let paymentId: string

  beforeAll(async () => {
    ws = await loginWholesale()
    const p = await ws.api.post('/api/parties', {
      name: 'Void Test Party', type: 'customer',
      phone: `7${Date.now().toString().slice(-9)}`,
    })
    partyId = p.data.id
    const pay = await ws.api.post('/api/payments', {
      partyId, amount: 1000, method: 'cash', type: 'receipt', paymentDate: today,
    })
    paymentId = pay.data.id
  })

  test('void payment returns success', async () => {
    const r = await ws.api.post(`/api/payments/${paymentId}/void`, {
      reason: 'Test cancellation',
    })
    expect(r.status).toBe(200)
    expect(r.data.success).toBe(true)
    expect(r.data.paymentId).toBe(paymentId)
  })

  test('double-void returns 409', async () => {
    await expect(ws.api.post(`/api/payments/${paymentId}/void`, {
      reason: 'Second void attempt',
    })).rejects.toMatchObject({ response: { status: 409 } })
  })

  test('void with missing reason returns 422', async () => {
    const pay2 = await ws.api.post('/api/payments', {
      partyId, amount: 200, method: 'upi', type: 'receipt', paymentDate: today,
    })
    await expect(ws.api.post(`/api/payments/${pay2.data.id}/void`, {}))
      .rejects.toMatchObject({ response: { status: 422 } })
  })

  test('void unknown payment returns 404', async () => {
    await expect(ws.api.post('/api/payments/00000000-0000-0000-0000-000000000000/void', {
      reason: 'Noop',
    })).rejects.toMatchObject({ response: { status: 404 } })
  })
})

describe('Payments — summary and outstanding', () => {
  let ws: Awaited<ReturnType<typeof loginWholesale>>

  beforeAll(async () => { ws = await loginWholesale() })

  test('payment summary groupBy=method returns byMethod array', async () => {
    const r = await ws.api.get('/api/payments/summary')
    expect(r.status).toBe(200)
    expect(Array.isArray(r.data.byMethod)).toBe(true)
    expect(typeof r.data.total).toBe('number')
    expect(r.data.fromDate).toBeTruthy()
    expect(r.data.toDate).toBeTruthy()
  })

  test('payment summary groupBy=day returns days array', async () => {
    const r = await ws.api.get(`/api/payments/summary?groupBy=day&fromDate=${today}&toDate=${today}`)
    expect(r.status).toBe(200)
    expect(Array.isArray(r.data.days)).toBe(true)
    expect(typeof r.data.total).toBe('number')
  })

  test('payment summary with date range filter', async () => {
    const r = await ws.api.get(`/api/payments/summary?fromDate=2026-01-01&toDate=${today}`)
    expect(r.status).toBe(200)
    expect(Array.isArray(r.data.byMethod)).toBe(true)
  })

  test('outstanding aging returns receivables', async () => {
    const r = await ws.api.get('/api/payments/outstanding?type=customer')
    expect(r.status).toBe(200)
    expect(r.data.type).toBe('customer')
    expect(r.data.aging).toBeDefined()
    expect(typeof r.data.aging['0_30']).toBe('number')
    expect(typeof r.data.aging['31_60']).toBe('number')
    expect(typeof r.data.aging['61_90']).toBe('number')
    expect(typeof r.data.aging['90plus']).toBe('number')
    expect(Array.isArray(r.data.parties)).toBe(true)
  })

  test('outstanding aging returns payables', async () => {
    const r = await ws.api.get('/api/payments/outstanding?type=supplier')
    expect(r.status).toBe(200)
    expect(r.data.type).toBe('supplier')
  })

  test('outstanding with type=all returns mixed', async () => {
    const r = await ws.api.get('/api/payments/outstanding?type=all')
    expect(r.status).toBe(200)
    expect(r.data.type).toBe('all')
  })
})

describe('Advances (invoice-level)', () => {
  let ws: Awaited<ReturnType<typeof loginWholesale>>

  beforeAll(async () => { ws = await loginWholesale() })

  test('create advance payment via invoices/advances endpoint', async () => {
    const parties = await ws.api.get('/api/parties?limit=1')
    const partyId = (parties.data.data ?? parties.data)[0]?.id
    if (!partyId) { console.warn('No party found — skipping advance test'); return }
    const r = await ws.api.post('/api/invoices/advances', {
      partyId, amount: 2000, method: 'upi',
      paymentDate: today,
      notes: 'Test advance',
    })
    expect(r.status).toBe(201)
    expect(Number(r.data.amount)).toBe(2000)
  })

  test('list advances returns paginated list', async () => {
    const r = await ws.api.get('/api/invoices/advances')
    expect(r.status).toBe(200)
    const list = r.data.items ?? r.data
    expect(Array.isArray(list)).toBe(true)
  })
})
