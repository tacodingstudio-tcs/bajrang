import { loginWholesale, loginSalon } from './helpers'

describe('Expenses CRUD', () => {
  let ws: Awaited<ReturnType<typeof loginWholesale>>
  let expenseId: string
  const today = new Date().toISOString().split('T')[0]

  beforeAll(async () => { ws = await loginWholesale() })

  test('list expenses returns paginated data', async () => {
    const r = await ws.api.get('/api/expenses?limit=5')
    expect(r.status).toBe(200)
    expect(Array.isArray(r.data.data)).toBe(true)
    expect(r.data.meta).toBeDefined()
  })

  test('create expense — cash payment', async () => {
    const r = await ws.api.post('/api/expenses', {
      amount:      1200,
      category:    'rent',
      description: 'Monthly office rent June 2026',
      date:        today,
      paymentMode: 'cash',
    })
    expect(r.status).toBe(201)
    expect(r.data.id).toBeTruthy()
    expect(Number(r.data.amount)).toBe(1200)
    expect(r.data.category).toBe('rent')
    expect(r.data.paymentMode).toBe('cash')
    expenseId = r.data.id
  })

  test('create expense — bank transfer with GST', async () => {
    const r = await ws.api.post('/api/expenses', {
      amount:      5000,
      gstRate:     18,
      category:    'freight',
      description: 'Courier charges with GST',
      date:        today,
      paymentMode: 'bank',
      referenceNo: 'TXN-12345',
    })
    expect(r.status).toBe(201)
    // gstAmount is auto-calculated from amount (tax-inclusive)
    expect(Number(r.data.gstAmount)).toBeGreaterThan(0)
    expect(Number(r.data.gstRate)).toBe(18)
  })

  test('create expense — UPI with notes', async () => {
    const r = await ws.api.post('/api/expenses', {
      amount:      350,
      category:    'utilities',
      description: 'Internet bill',
      date:        today,
      paymentMode: 'upi',
      notes:       'Jio Fiber monthly',
    })
    expect(r.status).toBe(201)
    expect(r.data.notes).toBe('Jio Fiber monthly')
  })

  test('update expense amount and description', async () => {
    if (!expenseId) return
    const r = await ws.api.patch(`/api/expenses/${expenseId}`, {
      amount:      1500,
      description: 'Monthly office rent June 2026 (revised)',
    })
    expect(r.status).toBe(200)
    expect(Number(r.data.amount)).toBe(1500)
    expect(r.data.description).toBe('Monthly office rent June 2026 (revised)')
  })

  test('filter expenses by category', async () => {
    const r = await ws.api.get('/api/expenses?category=rent&limit=10')
    expect(r.status).toBe(200)
    expect(r.data.data.every((e: any) => e.category === 'rent')).toBe(true)
  })

  test('filter expenses by date range', async () => {
    const from = '2026-06-01'
    const to   = today
    const r = await ws.api.get(`/api/expenses?from=${from}&to=${to}&limit=20`)
    expect(r.status).toBe(200)
    expect(Array.isArray(r.data.data)).toBe(true)
  })

  test('filter expenses by payment mode', async () => {
    const r = await ws.api.get('/api/expenses?paymentMode=cash&limit=10')
    expect(r.status).toBe(200)
    expect(r.data.data.every((e: any) => e.paymentMode === 'cash')).toBe(true)
  })

  test('delete expense removes it', async () => {
    if (!expenseId) return
    const r = await ws.api.delete(`/api/expenses/${expenseId}`)
    expect([200, 204]).toContain(r.status)
    // Confirm it no longer appears in list
    const list = await ws.api.get('/api/expenses?limit=100')
    const found = list.data.data.find((e: any) => e.id === expenseId)
    expect(found).toBeUndefined()
  })
})

describe('Expenses — Summary & Analytics', () => {
  let ws: Awaited<ReturnType<typeof loginWholesale>>
  const from = '2026-04-01'
  const to   = new Date().toISOString().split('T')[0]

  beforeAll(async () => {
    ws = await loginWholesale()
    // Ensure at least one expense exists for aggregation
    await ws.api.post('/api/expenses', {
      amount: 2000, category: 'salaries', description: 'Staff salary',
      date: to, paymentMode: 'bank',
    })
  })

  test('summary returns total amount and breakdown', async () => {
    const r = await ws.api.get(`/api/expenses/summary?from=${from}&to=${to}`)
    expect(r.status).toBe(200)
    expect(typeof r.data.totalAmount).toBe('number')
    expect(typeof r.data.totalCount).toBe('number')
    expect(Array.isArray(r.data.byCategory)).toBe(true)
    // byPaymentMode can be array or object keyed by mode
    expect(r.data.byPaymentMode).toBeDefined()
    expect(r.data.totalAmount).toBeGreaterThan(0)
  })

  test('summary byCategory entries have code and total', async () => {
    const r = await ws.api.get(`/api/expenses/summary?from=${from}&to=${to}`)
    if (r.data.byCategory.length > 0) {
      const cat = r.data.byCategory[0]
      expect(cat.category ?? cat.code).toBeTruthy()
      expect(typeof (cat.total ?? cat.amount)).toBe('number')
    }
  })

  test('categories endpoint returns all expense categories', async () => {
    const r = await ws.api.get('/api/expenses/categories')
    expect(r.status).toBe(200)
    expect(Array.isArray(r.data)).toBe(true)
    expect(r.data.length).toBeGreaterThan(0)
    expect(r.data[0].code).toBeTruthy()
    expect(r.data[0].label).toBeTruthy()
  })
})

describe('Expenses — Tenant Isolation', () => {
  test('salon expenses are isolated from wholesale', async () => {
    const [ws, salon] = await Promise.all([loginWholesale(), loginSalon()])
    const suffix = Date.now()
    // Create expense in each tenant
    await ws.api.post('/api/expenses', {
      amount: 999, category: 'rent', description: `Isolation test WS ${suffix}`,
      date: new Date().toISOString().split('T')[0], paymentMode: 'cash',
    })
    const salonList = await salon.api.get('/api/expenses?limit=100')
    const found = salonList.data.data.find((e: any) => e.description === `Isolation test WS ${suffix}`)
    expect(found).toBeUndefined()
  })
})

describe('Expenses — Validation', () => {
  let ws: Awaited<ReturnType<typeof loginWholesale>>

  beforeAll(async () => { ws = await loginWholesale() })

  test('expense with negative amount is rejected', async () => {
    await expect(
      ws.api.post('/api/expenses', {
        amount: -100, category: 'rent',
        date: new Date().toISOString().split('T')[0], paymentMode: 'cash',
      })
    ).rejects.toMatchObject({ response: { status: 422 } })
  })

  test('expense with zero amount is rejected', async () => {
    await expect(
      ws.api.post('/api/expenses', {
        amount: 0, category: 'rent',
        date: new Date().toISOString().split('T')[0], paymentMode: 'cash',
      })
    ).rejects.toMatchObject({ response: { status: 422 } })
  })

  test('expense without category is rejected', async () => {
    await expect(
      ws.api.post('/api/expenses', {
        amount: 500, paymentMode: 'cash',
        date: new Date().toISOString().split('T')[0],
      })
    ).rejects.toMatchObject({ response: { status: 422 } })
  })

  test('PATCH unknown expense id returns 404', async () => {
    await expect(
      ws.api.patch('/api/expenses/00000000-0000-0000-0000-000000000000', { amount: 100 })
    ).rejects.toMatchObject({ response: { status: 404 } })
  })

  test('DELETE unknown expense id returns 404', async () => {
    await expect(
      ws.api.delete('/api/expenses/00000000-0000-0000-0000-000000000000')
    ).rejects.toMatchObject({ response: { status: 404 } })
  })
})
