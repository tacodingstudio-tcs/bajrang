import { loginWholesale, loginSalon, loginKirana } from './helpers'

const today = new Date().toISOString().split('T')[0]!
const thisMonth = today.slice(0, 7) // YYYY-MM

describe('Analytics — dashboard', () => {
  let ws: Awaited<ReturnType<typeof loginWholesale>>

  beforeAll(async () => { ws = await loginWholesale() })

  test('dashboard returns kpis array and charts', async () => {
    const r = await ws.api.get('/api/analytics/dashboard')
    expect(r.status).toBe(200)
    expect(Array.isArray(r.data.kpis)).toBe(true)
    expect(r.data.charts).toBeDefined()
    expect(r.data.period).toBeTruthy()
    expect(r.data.domain).toBeTruthy()
    expect(r.data.from).toBeTruthy()
    expect(r.data.to).toBeTruthy()
  })

  test('dashboard with period=30d', async () => {
    const r = await ws.api.get('/api/analytics/dashboard?period=30d')
    expect(r.status).toBe(200)
    expect(r.data.period).toBe('30d')
  })

  test('dashboard with period=90d', async () => {
    const r = await ws.api.get('/api/analytics/dashboard?period=90d')
    expect(r.status).toBe(200)
    expect(r.data.period).toBe('90d')
  })

  test('dashboard with compareWith=prev_period includes prev data', async () => {
    const r = await ws.api.get('/api/analytics/dashboard?compareWith=prev_period')
    expect(r.status).toBe(200)
    expect(r.data.compareWith).toBe('prev_period')
  })

  test('dashboard with compareWith=prev_year', async () => {
    const r = await ws.api.get('/api/analytics/dashboard?compareWith=prev_year')
    expect(r.status).toBe(200)
    expect(r.data.compareWith).toBe('prev_year')
  })

  test('salon analytics returns domain-specific response', async () => {
    const salon = await loginSalon()
    const r = await salon.api.get('/api/analytics/dashboard')
    expect(r.status).toBe(200)
    expect(Array.isArray(r.data.kpis)).toBe(true)
    expect(r.data.domain).toBe('salon')
  })

  test('kirana analytics returns domain-specific response', async () => {
    const kirana = await loginKirana()
    const r = await kirana.api.get('/api/analytics/dashboard')
    expect(r.status).toBe(200)
    expect(r.data.domain).toBe('retail')
  })
})

describe('Analytics — other endpoints', () => {
  let ws: Awaited<ReturnType<typeof loginWholesale>>

  beforeAll(async () => { ws = await loginWholesale() })

  test('revenue-trend returns trend data', async () => {
    const r = await ws.api.get('/api/analytics/revenue-trend')
    expect(r.status).toBe(200)
    expect(r.data).toBeDefined()
  })

  test('revenue-trend with period=30d', async () => {
    const r = await ws.api.get('/api/analytics/revenue-trend?period=30d')
    expect(r.status).toBe(200)
  })

  test('gst-summary returns structured GST data', async () => {
    const r = await ws.api.get(`/api/analytics/gst-summary?month=${thisMonth}`)
    expect(r.status).toBe(200)
    expect(r.data).toBeDefined()
  })

  test('payment-methods returns method breakdown', async () => {
    const r = await ws.api.get('/api/analytics/payment-methods')
    expect(r.status).toBe(200)
    expect(r.data).toBeDefined()
  })

  test('payment-methods with period=30d', async () => {
    const r = await ws.api.get('/api/analytics/payment-methods?period=30d')
    expect(r.status).toBe(200)
  })

  test('top-customers returns array of customers', async () => {
    const r = await ws.api.get('/api/analytics/top-customers')
    expect(r.status).toBe(200)
    expect(r.data).toBeDefined()
  })

  test('top-customers with limit=5', async () => {
    const r = await ws.api.get('/api/analytics/top-customers?limit=5')
    expect(r.status).toBe(200)
  })

  test('margin-report returns margin data', async () => {
    const r = await ws.api.get('/api/analytics/margin-report')
    expect(r.status).toBe(200)
    expect(r.data).toBeDefined()
  })

  test('sales-vs-purchases returns monthly comparison', async () => {
    const r = await ws.api.get('/api/analytics/sales-vs-purchases')
    expect(r.status).toBe(200)
    expect(r.data).toBeDefined()
  })

  test('sales-vs-purchases with months=6', async () => {
    const r = await ws.api.get('/api/analytics/sales-vs-purchases?months=6')
    expect(r.status).toBe(200)
  })
})

describe('Reports — day-book', () => {
  let ws: Awaited<ReturnType<typeof loginWholesale>>

  beforeAll(async () => { ws = await loginWholesale() })

  test('day-book uses ?date= (not from/to) and returns structured response', async () => {
    const r = await ws.api.get(`/api/reports/day-book?date=${today}`)
    expect(r.status).toBe(200)
    expect(r.data.date).toBe(today)
    expect(typeof r.data.opening_cash_balance).toBe('number')
    expect(typeof r.data.closing_cash_balance).toBe('number')
    expect(r.data.summary).toBeDefined()
    expect(typeof r.data.summary.total_sales).toBe('number')
    expect(typeof r.data.summary.total_receipts).toBe('number')
    expect(Array.isArray(r.data.sale_invoices)).toBe(true)
    expect(Array.isArray(r.data.payments)).toBe(true)
    expect(r.data.receipts_by_mode).toBeDefined()
  })

  test('day-book defaults to today when no date provided', async () => {
    const r = await ws.api.get('/api/reports/day-book')
    expect(r.status).toBe(200)
    expect(r.data.date).toBe(today)
  })

  test('day-book for a past date with no transactions returns zero totals', async () => {
    const r = await ws.api.get('/api/reports/day-book?date=2020-01-01')
    expect(r.status).toBe(200)
    expect(r.data.summary.total_sales).toBe(0)
    expect(r.data.summary.total_receipts).toBe(0)
  })
})

describe('Reports — stock-summary', () => {
  let ws: Awaited<ReturnType<typeof loginWholesale>>

  beforeAll(async () => { ws = await loginWholesale() })

  test('stock-summary returns summary, by_category, products', async () => {
    const r = await ws.api.get('/api/reports/stock-summary')
    expect(r.status).toBe(200)
    expect(r.data.as_of).toBeTruthy()
    expect(r.data.summary).toBeDefined()
    expect(typeof r.data.summary.total_products).toBe('number')
    expect(typeof r.data.summary.out_of_stock).toBe('number')
    expect(Array.isArray(r.data.by_category)).toBe(true)
    expect(Array.isArray(r.data.products)).toBe(true)
  })

  test('stock-summary with lowStockOnly filter', async () => {
    const r = await ws.api.get('/api/reports/stock-summary?lowStockOnly=true')
    expect(r.status).toBe(200)
    expect(Array.isArray(r.data.products)).toBe(true)
    // All returned products should be at or below low stock threshold
    expect(r.data.products.every((p: any) => p.qty_on_hand <= p.low_stock_qty)).toBe(true)
  })

  test('stock-summary with zeroStockOnly filter', async () => {
    const r = await ws.api.get('/api/reports/stock-summary?zeroStockOnly=true')
    expect(r.status).toBe(200)
    expect(r.data.products.every((p: any) => p.qty_on_hand <= 0)).toBe(true)
  })
})

describe('Reports — GSTR-1', () => {
  let ws: Awaited<ReturnType<typeof loginWholesale>>

  beforeAll(async () => { ws = await loginWholesale() })

  test('gstr1 returns structured tables and summary', async () => {
    const r = await ws.api.get('/api/reports/gstr1?month=2026-06')
    expect(r.status).toBe(200)
    expect(r.data.month).toBe('2026-06')
    expect(r.data.from).toBeTruthy()
    expect(r.data.to).toBeTruthy()
    expect(r.data.summary).toBeDefined()
    expect(typeof r.data.summary.b2b_invoice_count).toBe('number')
    expect(r.data.tables).toBeDefined()
    expect(Array.isArray(r.data.tables.b2b)).toBe(true)
    expect(Array.isArray(r.data.tables.b2c_large)).toBe(true)
    expect(Array.isArray(r.data.tables.b2c_small)).toBe(true)
    expect(Array.isArray(r.data.tables.hsn)).toBe(true)
    expect(Array.isArray(r.data.tables.cdnr)).toBe(true)
  })

  test('gstr1 with invalid month format returns 400', async () => {
    await expect(ws.api.get('/api/reports/gstr1?month=June-2026'))
      .rejects.toMatchObject({ response: { status: 422 } })
  })
})

describe('Reports — P&L statement', () => {
  let ws: Awaited<ReturnType<typeof loginWholesale>>

  beforeAll(async () => { ws = await loginWholesale() })

  test('pl-statement returns full structure', async () => {
    const r = await ws.api.get('/api/reports/pl-statement?from=2026-04-01&to=2026-06-30')
    expect(r.status).toBe(200)
    expect(r.data.from).toBe('2026-04-01')
    expect(r.data.to).toBe('2026-06-30')
    expect(r.data.statement).toBeDefined()
    expect(typeof r.data.statement.gross_revenue).toBe('number')
    expect(typeof r.data.statement.net_revenue).toBe('number')
    expect(typeof r.data.statement.gross_profit).toBe('number')
    expect(typeof r.data.statement.total_expenses).toBe('number')
    expect(typeof r.data.statement.operating_profit).toBe('number')
    expect(typeof r.data.statement.net_profit).toBe('number')
    expect(Array.isArray(r.data.statement.expense_categories)).toBe(true)
  })

  test('pl-statement defaults to current month when no params given', async () => {
    const r = await ws.api.get('/api/reports/pl-statement')
    expect(r.status).toBe(200)
    expect(r.data.statement).toBeDefined()
  })
})

describe('Reports — cash register', () => {
  let ws: Awaited<ReturnType<typeof loginWholesale>>

  beforeAll(async () => { ws = await loginWholesale() })

  test('GET cash-register returns daily summary structure', async () => {
    const r = await ws.api.get(`/api/reports/cash-register?date=${today}`)
    expect(r.status).toBe(200)
    expect(r.data.date).toBe(today)
    expect(typeof r.data.opening_balance).toBe('number')
    expect(typeof r.data.cash_in).toBe('number')
    expect(typeof r.data.cash_out).toBe('number')
    expect(typeof r.data.system_cash).toBe('number')
    expect(Array.isArray(r.data.cash_transactions)).toBe(true)
    // saved_entry is null if not yet closed
    expect(r.data.saved_entry === null || typeof r.data.saved_entry === 'object').toBe(true)
  })

  test('POST cash-register saves cashier count', async () => {
    const r = await ws.api.post('/api/reports/cash-register', {
      date:        today,
      systemCash:  5000,
      countedCash: 4950,
      notes:       'Shift close test',
      closedBy:    'Test Cashier',
    })
    expect(r.status).toBe(200)
    expect(r.data.ok).toBe(true)
  })

  test('GET cash-register after save shows saved_entry', async () => {
    const r = await ws.api.get(`/api/reports/cash-register?date=${today}`)
    expect(r.status).toBe(200)
    expect(r.data.saved_entry).not.toBeNull()
    expect(Number(r.data.saved_entry.system_cash)).toBe(5000)
    expect(Number(r.data.saved_entry.counted_cash)).toBe(4950)
  })

  test('POST cash-register upsert updates existing entry', async () => {
    const r = await ws.api.post('/api/reports/cash-register', {
      date:        today,
      systemCash:  5000,
      countedCash: 5000, // corrected count
      notes:       'Corrected close',
    })
    expect(r.status).toBe(200)
    expect(r.data.ok).toBe(true)
  })
})

describe('Reports — bank accounts', () => {
  let ws: Awaited<ReturnType<typeof loginWholesale>>
  let bankAccountId: string

  beforeAll(async () => { ws = await loginWholesale() })

  test('GET bank-accounts returns accounts array', async () => {
    const r = await ws.api.get('/api/reports/bank-accounts')
    expect(r.status).toBe(200)
    expect(r.data.accounts).toBeDefined()
    expect(Array.isArray(r.data.accounts)).toBe(true)
  })

  test('POST bank-accounts creates a bank account', async () => {
    const r = await ws.api.post('/api/reports/bank-accounts', {
      name:           'Test Current Account',
      bankName:       'HDFC Bank',
      accountNumber:  '123456789012',
      openingBalance: 50000,
    })
    expect(r.status).toBe(201)
    expect(r.data.id).toBeTruthy()
    bankAccountId = r.data.id
  })

  test('bank-accounts list includes newly created account', async () => {
    const r = await ws.api.get('/api/reports/bank-accounts')
    expect(r.status).toBe(200)
    const ids = r.data.accounts.map((a: any) => a.id)
    expect(ids).toContain(bankAccountId)
  })

  test('bank account has expected fields', async () => {
    const r = await ws.api.get('/api/reports/bank-accounts')
    const account = r.data.accounts.find((a: any) => a.id === bankAccountId)
    expect(account).toBeDefined()
    expect(account.name).toBe('Test Current Account')
    expect(account.bank_name).toBe('HDFC Bank')
    expect(account.account_number).toBe('123456789012')
    expect(Number(account.opening_balance)).toBe(50000)
  })

  test('POST bank-accounts with missing name returns 400', async () => {
    await expect(ws.api.post('/api/reports/bank-accounts', {
      bankName: 'SBI', openingBalance: 1000,
    })).rejects.toMatchObject({ response: { status: 422 } })
  })
})

describe('Reports — bank reconciliation', () => {
  let ws: Awaited<ReturnType<typeof loginWholesale>>

  beforeAll(async () => { ws = await loginWholesale() })

  test('GET bank-reconciliation returns book balance and transactions', async () => {
    const r = await ws.api.get(`/api/reports/bank-reconciliation?month=${thisMonth}`)
    expect(r.status).toBe(200)
    expect(r.data.month).toBe(thisMonth)
    expect(typeof r.data.book_balance).toBe('number')
    expect(typeof r.data.book_in).toBe('number')
    expect(typeof r.data.book_out).toBe('number')
    expect(Array.isArray(r.data.transactions)).toBe(true)
    expect(r.data.saved_entry === null || typeof r.data.saved_entry === 'object').toBe(true)
  })

  test('POST bank-reconciliation saves statement balance', async () => {
    const r = await ws.api.post('/api/reports/bank-reconciliation', {
      month:            thisMonth,
      statementBalance: 45000,
      bookBalance:      44800,
      notes:            'Bank recon test',
    })
    expect(r.status).toBe(200)
    expect(r.data.ok).toBe(true)
  })

  test('GET bank-reconciliation after save shows saved_entry', async () => {
    const r = await ws.api.get(`/api/reports/bank-reconciliation?month=${thisMonth}`)
    expect(r.status).toBe(200)
    expect(r.data.saved_entry).not.toBeNull()
    expect(Number(r.data.saved_entry.statement_balance)).toBe(45000)
  })

  test('POST bank-reconciliation upsert updates existing entry', async () => {
    const r = await ws.api.post('/api/reports/bank-reconciliation', {
      month:            thisMonth,
      statementBalance: 45500,
      bookBalance:      45200,
      notes:            'Revised recon',
    })
    expect(r.status).toBe(200)
    expect(r.data.ok).toBe(true)
  })
})

describe('Reports — monthly comparison', () => {
  let ws: Awaited<ReturnType<typeof loginWholesale>>

  beforeAll(async () => { ws = await loginWholesale() })

  test('monthly-comparison returns this month vs last month', async () => {
    const r = await ws.api.get('/api/reports/monthly-comparison')
    expect(r.status).toBe(200)
    expect(r.data.thisMonth).toBeTruthy()
    expect(r.data.lastMonth).toBeTruthy()
    expect(r.data.revenue).toBeDefined()
    expect(typeof r.data.revenue.this).toBe('number')
    expect(typeof r.data.revenue.last).toBe('number')
    expect(typeof r.data.revenue.delta).toBe('number')
    expect(r.data.expenses).toBeDefined()
    expect(typeof r.data.expenses.this).toBe('number')
    expect(r.data.profit).toBeDefined()
    expect(typeof r.data.profit.this).toBe('number')
  })

  test('monthly-comparison month names are strings like "Jan"/"Feb"/etc', async () => {
    const r = await ws.api.get('/api/reports/monthly-comparison')
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
    expect(months).toContain(r.data.thisMonth)
    expect(months).toContain(r.data.lastMonth)
  })
})
