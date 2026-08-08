// apps/api/src/__tests__/multi-branch.test.ts
//
// Tests: multi-branch creation, isolation, cross-branch features.
//
// Architecture reminder:
//   TENANT-scoped (shared across all branches):  parties, products catalog
//   BRANCH-scoped (isolated per branch):          invoices, stock, GRN, expenses
//
// We register a fresh tenant per test run so state is clean.

import axios, { AxiosInstance } from 'axios'
import { BASE } from './helpers'

// ── helpers ───────────────────────────────────────────────────────────────────

let phoneCounter = Date.now() % 10_000_000
function nextPhone() {
  const n = phoneCounter++
  return `9${String(n).padStart(9, '0')}`.slice(0, 10)
}

interface Session {
  api:      AxiosInstance
  branchId: string
  userId:   string
  token:    string
}

async function registerAndLogin(phone: string, domainType = 'retail'): Promise<Session> {
  await axios.post(`${BASE}/api/tenants/register`, {
    businessName: `Test Biz ${phone}`,
    ownerName:    'Test Owner',
    phone,
    pin:          '1234',
    domainType,
    lang:         'hi',
  })
  const res = await axios.post(`${BASE}/api/auth/login`, {
    tenantPhone: phone, phone, pin: '1234',
  })
  const { accessToken, user, branch } = res.data
  return {
    api:      axios.create({ baseURL: BASE, headers: { Authorization: `Bearer ${accessToken}` } }),
    branchId: branch.id,
    userId:   user.id,
    token:    accessToken,
  }
}

async function switchBranch(session: Session, branchId: string): Promise<Session> {
  const res = await session.api.post('/api/auth/switch-branch', { branchId })
  const { accessToken, branch } = res.data
  return {
    api:      axios.create({ baseURL: BASE, headers: { Authorization: `Bearer ${accessToken}` } }),
    branchId: branch.id,
    userId:   session.userId,
    token:    accessToken,
  }
}

// ── shared state ──────────────────────────────────────────────────────────────

let ownerPhone: string
let sessionA: Session     // owner token scoped to branch A
let sessionB: Session     // owner token scoped to branch B
let branchAId: string
let branchBId: string

let sharedParty:   { id: string }  // parties are tenant-scoped (visible everywhere)
let sharedProduct: { id: string }  // product catalog is tenant-scoped
let invoiceA:      { id: string; invoiceNumber: string }

// ── Suite ─────────────────────────────────────────────────────────────────────

describe('Multi-branch — setup', () => {
  test('registers a new tenant and gets default branch A', async () => {
    ownerPhone = nextPhone()
    sessionA   = await registerAndLogin(ownerPhone)
    branchAId  = sessionA.branchId
    expect(branchAId).toBeTruthy()
  })

  test('creates branch B (owner only)', async () => {
    const res = await sessionA.api.post('/api/branches', {
      name:       'Branch B - City Centre',
      domainType: 'retail',
      city:       'Surat',
    })
    expect(res.status).toBe(201)
    branchBId = res.data.id
    expect(branchBId).not.toBe(branchAId)
  })

  test('lists two active branches', async () => {
    const res = await sessionA.api.get('/api/branches')
    expect(res.status).toBe(200)
    const ids = res.data.map((b: any) => b.id)
    expect(ids).toContain(branchAId)
    expect(ids).toContain(branchBId)
  })

  test('owner can switch token to branch B', async () => {
    sessionB = await switchBranch(sessionA, branchBId)
    expect(sessionB.branchId).toBe(branchBId)
  })

  test('GET /api/branches/:id returns branch detail', async () => {
    const res = await sessionA.api.get(`/api/branches/${branchAId}`)
    expect(res.status).toBe(200)
    expect(res.data.id).toBe(branchAId)
  })

  test('PATCH /api/branches/:id updates branch config', async () => {
    const res = await sessionA.api.patch(`/api/branches/${branchAId}`, {
      domainConfig: { currency: 'INR' },
    })
    expect(res.status).toBe(200)
    expect((res.data.domainConfig as any).currency).toBe('INR')
  })
})

describe('Tenant-scoped resources — parties and products are shared across branches', () => {
  test('creates a party via branch A token', async () => {
    const res = await sessionA.api.post('/api/parties', {
      name:  'Shared Customer',
      type:  'customer',
      phone: nextPhone(),
    })
    expect(res.status).toBe(201)
    sharedParty = { id: res.data.id }
  })

  test('branch B token can also read that party (tenant-scoped)', async () => {
    const res = await sessionB.api.get(`/api/parties/${sharedParty.id}`)
    expect(res.status).toBe(200)
    expect(res.data.id).toBe(sharedParty.id)
  })

  test('creates a product with opening stock via branch A token', async () => {
    const res = await sessionA.api.post('/api/products', {
      name:         'Shared Product',
      unit:         'pcs',
      sellingPrice: 100,
      trackStock:   true,
      openingStock: 50,
      openingRate:  60,
    })
    expect(res.status).toBe(201)
    sharedProduct = { id: res.data.id }
  })

  test('branch B token can see that product in catalog (tenant-scoped)', async () => {
    const res = await sessionB.api.get('/api/products?limit=200')
    const ids = (res.data.data ?? res.data.items ?? res.data).map((p: any) => p.id)
    expect(ids).toContain(sharedProduct.id)
  })
})

describe('Branch-scoped — stock is isolated per branch', () => {
  test('branch A stock shows 50 units (opening stock)', async () => {
    const res  = await sessionA.api.get('/api/stock')
    const rows = res.data.data ?? res.data.items ?? res.data
    const item = rows.find((s: any) => s.productId === sharedProduct.id)
    expect(Number(item?.currentQty ?? 0)).toBe(50)
  })

  test('branch B stock for same product is 0 (branch-isolated)', async () => {
    const res  = await sessionB.api.get('/api/stock')
    const rows = res.data.data ?? res.data.items ?? res.data
    const item = rows.find((s: any) => s.productId === sharedProduct.id)
    expect(Number(item?.currentQty ?? 0)).toBe(0)
  })
})

describe('Branch-scoped — invoices are isolated per branch', () => {
  test('creates a sale invoice in branch A', async () => {
    const res = await sessionA.api.post('/api/invoices', {
      txnType: 'sale_invoice',
      partyId: sharedParty.id,
      date:    new Date().toISOString().slice(0, 10),
      items: [{
        productId:   sharedProduct.id,
        description: 'Shared Product',
        qty:         2,
        rate:        100,
        unit:        'pcs',
      }],
    })
    expect(res.status).toBe(201)
    invoiceA = { id: res.data.id, invoiceNumber: res.data.number }
    expect(invoiceA.invoiceNumber).toBeTruthy()
  })

  // Invoice list is branch-scoped; direct GET by ID is tenant-scoped (design: owner can view any invoice)
  test('branch B invoice LIST does not contain branch A invoice', async () => {
    const res = await sessionB.api.get('/api/invoices?limit=100')
    const ids = (res.data.data ?? []).map((inv: any) => inv.id)
    expect(ids).not.toContain(invoiceA.id)
  })
})

describe('Cross-branch — stock transfer', () => {
  test('owner transfers 10 units from branch A to branch B', async () => {
    const res = await sessionA.api.post(`/api/branches/${branchBId}/stock-transfer`, {
      items:  [{ productId: sharedProduct.id, qty: 10 }],
      reason: 'Test inter-branch transfer',
    })
    expect(res.status).toBe(200)
    expect(res.data.success).toBe(true)
    expect(res.data.fromBranchId).toBe(branchAId)
    expect(res.data.toBranchId).toBe(branchBId)
    expect(res.data.itemsTransferred[0].qty).toBe(10)
  })

  test('branch A stock decremented by transfer (50 opening - 2 sold - 10 transferred = 38)', async () => {
    const res  = await sessionA.api.get('/api/stock')
    const rows = res.data.data ?? res.data.items ?? res.data
    const item = rows.find((s: any) => s.productId === sharedProduct.id)
    expect(Number(item?.currentQty ?? 0)).toBe(38)
  })

  test('branch B stock incremented to 10 after transfer', async () => {
    const res  = await sessionB.api.get('/api/stock')
    const rows = res.data.data ?? res.data.items ?? res.data
    const item = rows.find((s: any) => s.productId === sharedProduct.id)
    expect(Number(item?.currentQty ?? 0)).toBe(10)
  })

  test('branch B creates invoice using transferred stock (own invoice number sequence)', async () => {
    const res = await sessionB.api.post('/api/invoices', {
      txnType: 'sale_invoice',
      partyId: sharedParty.id,
      date:    new Date().toISOString().slice(0, 10),
      items: [{
        productId:   sharedProduct.id,
        description: 'Shared Product',
        qty:         1,
        rate:        100,
        unit:        'pcs',
      }],
    })
    expect(res.status).toBe(201)
    expect(res.data.number).not.toBe(invoiceA.invoiceNumber)
  })

  test('transfer rejected when source has insufficient stock (422)', async () => {
    const res = await sessionA.api.post(`/api/branches/${branchBId}/stock-transfer`, {
      items: [{ productId: sharedProduct.id, qty: 9999 }],
    }).catch(e => e.response)
    expect(res.status).toBe(422)
    expect(res.data.error).toMatch(/insufficient stock/i)
  })

  test('transfer to same branch rejected (422)', async () => {
    const res = await sessionA.api.post(`/api/branches/${branchAId}/stock-transfer`, {
      items: [{ productId: sharedProduct.id, qty: 1 }],
    }).catch(e => e.response)
    expect(res.status).toBe(422)
  })
})

describe('Cross-branch — owner revenue rollup', () => {
  test('GET /branches/summary returns both branches', async () => {
    const res = await sessionA.api.get('/api/branches/summary?period=ytd')
    expect(res.status).toBe(200)
    const ids = res.data.branches.map((b: any) => b.branchId)
    expect(ids).toContain(branchAId)
    expect(ids).toContain(branchBId)
  })

  test('summary totals include sales from both branches', async () => {
    const res = await sessionA.api.get('/api/branches/summary?period=ytd')
    const a   = res.data.branches.find((b: any) => b.branchId === branchAId)
    const bBr = res.data.branches.find((b: any) => b.branchId === branchBId)
    expect(Number(a.totalSales)).toBeGreaterThan(0)
    expect(Number(bBr.totalSales)).toBeGreaterThan(0)
    expect(Number(res.data.totals.invoiceCount)).toBeGreaterThanOrEqual(
      Number(a.invoiceCount) + Number(bBr.invoiceCount)
    )
  })

  test('cashier cannot access cross-branch summary (403)', async () => {
    const cashierPhone = nextPhone()
    await sessionA.api.post('/api/users', {
      name: 'Cashier One', phone: cashierPhone, role: 'cashier', pin: '9999',
    })
    const loginRes   = await axios.post(`${BASE}/api/auth/login`, {
      tenantPhone: ownerPhone, phone: cashierPhone, pin: '9999',
    })
    const cashierApi = axios.create({
      baseURL: BASE,
      headers: { Authorization: `Bearer ${loginRes.data.accessToken}` },
    })
    const res = await cashierApi.get('/api/branches/summary').catch(e => e.response)
    expect(res.status).toBe(403)
  })
})

describe('Branch lifecycle', () => {
  test('cannot deactivate the sole active branch (409)', async () => {
    const phone = nextPhone()
    const solo  = await registerAndLogin(phone)
    const res   = await solo.api.post(`/api/branches/${solo.branchId}/deactivate`, {}).catch(e => e.response)
    expect(res.status).toBe(409)
    expect(res.data.error).toMatch(/last active branch/i)
  })

  test('owner deactivates branch B', async () => {
    const res = await sessionA.api.post(`/api/branches/${branchBId}/deactivate`, {})
    expect(res.status).toBe(200)
    expect(res.data.isActive).toBe(false)
  })

  test('deactivated branch absent from active list', async () => {
    const res = await sessionA.api.get('/api/branches')
    const ids = res.data.filter((b: any) => b.isActive).map((b: any) => b.id)
    expect(ids).not.toContain(branchBId)
  })

  test('stock transfer to inactive branch rejected (409)', async () => {
    const res = await sessionA.api.post(`/api/branches/${branchBId}/stock-transfer`, {
      items: [{ productId: sharedProduct.id, qty: 1 }],
    }).catch(e => e.response)
    expect(res.status).toBe(409)
    expect(res.data.error).toMatch(/not active/i)
  })

  test('owner reactivates branch B', async () => {
    const res = await sessionA.api.post(`/api/branches/${branchBId}/activate`, {})
    expect(res.status).toBe(200)
    expect(res.data.isActive).toBe(true)
  })
})

describe('Cross-branch — staff access control', () => {
  let staffSession: Session
  let staffPhone:   string

  test('owner creates a manager assigned only to branch A', async () => {
    staffPhone = nextPhone()
    const res  = await sessionA.api.post('/api/users', {
      name:      'Branch A Manager',
      phone:     staffPhone,
      role:      'manager',
      pin:       '5678',
      branchIds: [branchAId],
    })
    expect(res.status).toBe(201)
  })

  test('staff logs in and token is scoped to branch A', async () => {
    const res = await axios.post(`${BASE}/api/auth/login`, {
      tenantPhone: ownerPhone, phone: staffPhone, pin: '5678',
    })
    const { accessToken, branch } = res.data
    expect(branch.id).toBe(branchAId)
    staffSession = {
      api:      axios.create({ baseURL: BASE, headers: { Authorization: `Bearer ${accessToken}` } }),
      branchId: branch.id,
      userId:   res.data.user.id,
      token:    accessToken,
    }
  })

  test('staff can read branch A detail', async () => {
    const res = await staffSession.api.get(`/api/branches/${branchAId}`)
    expect(res.status).toBe(200)
  })

  test('staff cannot read branch B detail (403)', async () => {
    const res = await staffSession.api.get(`/api/branches/${branchBId}`).catch(e => e.response)
    expect(res.status).toBe(403)
  })

  test('staff cannot switch to branch B (403)', async () => {
    const res = await staffSession.api.post('/api/auth/switch-branch', { branchId: branchBId }).catch(e => e.response)
    expect(res.status).toBe(403)
  })

  test('staff branch list includes only branch A', async () => {
    const res = await staffSession.api.get('/api/branches')
    const ids = res.data.map((b: any) => b.id)
    expect(ids).toContain(branchAId)
    expect(ids).not.toContain(branchBId)
  })

  test('staff cannot create a new branch (403)', async () => {
    const res = await staffSession.api.post('/api/branches', {
      name: 'Rogue Branch', domainType: 'retail', city: 'Test',
    }).catch(e => e.response)
    expect(res.status).toBe(403)
  })
})
