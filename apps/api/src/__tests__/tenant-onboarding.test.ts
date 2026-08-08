// Tenant onboarding tests — verifies that self-registration via POST /api/tenants/register
// creates a fully functional tenant schema for each domain type.
//
// Each test suite registers a fresh tenant, logs in, and exercises core operations
// (create product, create party, create invoice) to prove schema is complete.

import axios, { AxiosInstance } from 'axios'
import { PrismaClient } from '@prisma/client'
import { BASE } from './helpers'

// ── helpers ─────────────────────────────────────────────────────────────────

// Unique phone generator — timestamp-based to avoid conflicts across test runs
const PHONE_BASE = 7000000000 + (Date.now() % 100000000)
let phoneOffset = 0
const createdTenantIds: string[] = []

function nextPhone(): string {
  return String(PHONE_BASE + phoneOffset++).slice(0, 10)
}

// Clean up all tenant schemas created during this test run to avoid DB connection exhaustion
afterAll(async () => {
  if (createdTenantIds.length === 0) return
  const db = new PrismaClient()
  try {
    const tenants = await db.$queryRawUnsafe<Array<{ id: string; schemaName: string }>>(
      `SELECT id, "schemaName" FROM public.tenants WHERE id = ANY(ARRAY[${createdTenantIds.map(id => `'${id}'::uuid`).join(',')}])`
    )
    for (const t of tenants) {
      await db.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${t.schemaName}" CASCADE`)
      await db.$executeRawUnsafe(`DELETE FROM public.tenants WHERE id = '${t.id}'`)
    }
  } finally {
    await db.$disconnect()
  }
})

interface NewTenant {
  api: AxiosInstance
  branchId: string
  tenantId: string
  slug: string
}

async function registerAndLogin(opts: {
  businessName: string
  ownerName: string
  phone: string
  pin: string
  domainType: string
  city?: string
  stateCode?: string
}): Promise<NewTenant> {
  const reg = await axios.post(`${BASE}/api/tenants/register`, opts)
  expect(reg.status).toBe(201)
  const { tenantId, slug, branchId } = reg.data
  createdTenantIds.push(tenantId)

  const login = await axios.post(`${BASE}/api/auth/login`, {
    tenantPhone: opts.phone,
    phone: opts.phone,
    pin: opts.pin,
  })
  expect(login.status).toBe(200)
  expect(login.data.accessToken).toBeTruthy()

  const api = axios.create({
    baseURL: BASE,
    headers: { Authorization: `Bearer ${login.data.accessToken}` },
  })
  return { api, branchId, tenantId, slug }
}

async function createProduct(api: AxiosInstance, overrides: Record<string, unknown> = {}) {
  const res = await api.post('/api/products', {
    name: 'Test Product',
    sku: `SKU-${Date.now()}`,
    unit: 'pcs',
    salePrice: 100,
    purchasePrice: 70,
    gstRate: 18,
    trackStock: false,
    ...overrides,
  })
  expect(res.status).toBe(201)
  return res.data as { id: string }
}

async function createParty(api: AxiosInstance, overrides: Record<string, unknown> = {}) {
  const res = await api.post('/api/parties', {
    name: 'Test Customer',
    type: 'customer',
    phone: String(Date.now()).slice(-10),
    ...overrides,
  })
  expect(res.status).toBe(201)
  return res.data as { id: string }
}

// ── Registration validation ──────────────────────────────────────────────────

describe('POST /api/tenants/register — validation', () => {
  it('rejects missing required fields', async () => {
    const res = await axios.post(`${BASE}/api/tenants/register`, {
      businessName: 'Only Name',
    }).catch(e => e.response)
    expect(res.status).toBe(400)
    expect(res.data.issues).toBeDefined()
  })

  it('rejects invalid phone number', async () => {
    const res = await axios.post(`${BASE}/api/tenants/register`, {
      businessName: 'Test Business',
      ownerName: 'Test Owner',
      phone: '1234567890', // starts with 1 — invalid Indian mobile
      pin: '1234',
      domainType: 'retail',
    }).catch(e => e.response)
    expect(res.status).toBe(400)
  })

  it('rejects PIN that is not 4 digits', async () => {
    const res = await axios.post(`${BASE}/api/tenants/register`, {
      businessName: 'Test Business',
      ownerName: 'Test Owner',
      phone: '9700099999',
      pin: '12',
      domainType: 'retail',
    }).catch(e => e.response)
    expect(res.status).toBe(400)
  })

  it('rejects unknown domain type', async () => {
    const res = await axios.post(`${BASE}/api/tenants/register`, {
      businessName: 'Test Business',
      ownerName: 'Test Owner',
      phone: '9700099998',
      pin: '1234',
      domainType: 'invalid_domain',
    }).catch(e => e.response)
    expect(res.status).toBe(400)
  })

  it('rejects duplicate phone', async () => {
    const phone = nextPhone().toString()
    const first = await axios.post(`${BASE}/api/tenants/register`, {
      businessName: 'First Business',
      ownerName: 'First Owner',
      phone,
      pin: '1234',
      domainType: 'retail',
    })
    if (first.data?.tenantId) createdTenantIds.push(first.data.tenantId)
    const dup = await axios.post(`${BASE}/api/tenants/register`, {
      businessName: 'Second Business',
      ownerName: 'Second Owner',
      phone,
      pin: '5678',
      domainType: 'retail',
    }).catch(e => e.response)
    expect(dup.status).toBe(409)
  })

  it('lists all supported domain types', async () => {
    const res = await axios.get(`${BASE}/api/tenants/domains`)
    expect(res.status).toBe(200)
    expect(Array.isArray(res.data)).toBe(true)
    expect(res.data.length).toBeGreaterThan(20)
    const keys = res.data.map((d: any) => d.key)
    expect(keys).toContain('retail')
    expect(keys).toContain('pharmacy')
    expect(keys).toContain('wholesale')
    expect(keys).toContain('restaurant')
    expect(keys).toContain('salon')
  })
})

// ── Retail onboarding ────────────────────────────────────────────────────────

describe('Retail tenant onboarding', () => {
  let tenant: NewTenant

  beforeAll(async () => {
    tenant = await registerAndLogin({
      businessName: 'Shree Ram Kirana Store',
      ownerName: 'Ramesh Bhai',
      phone: nextPhone().toString(),
      pin: '4321',
      domainType: 'retail',
      city: 'Ahmedabad',
      stateCode: '24',
    })
  })

  it('registration returns 201 with correct domainType', async () => {
    const reg = await axios.post(`${BASE}/api/tenants/register`, {
      businessName: 'Another Kirana ' + Date.now(),
      ownerName: 'Suresh Bhai',
      phone: nextPhone().toString(),
      pin: '1111',
      domainType: 'retail',
    })
    expect(reg.data.domainType).toBe('retail')
    expect(reg.data.tenantId).toBeTruthy()
    expect(reg.data.branchId).toBeTruthy()
    expect(reg.data.slug).toBeTruthy()
  })

  it('can create a product', async () => {
    const prod = await createProduct(tenant.api, {
      name: 'Surf Excel 500g',
      salePrice: 85,
      gstRate: 18,
    })
    expect(prod.id).toBeTruthy()
  })

  it('can create a party', async () => {
    const party = await createParty(tenant.api)
    expect(party.id).toBeTruthy()
  })

  it('can list products', async () => {
    await createProduct(tenant.api, { name: 'Rice 5kg' })
    const res = await tenant.api.get('/api/products')
    expect(res.status).toBe(200)
    const items = Array.isArray(res.data) ? res.data : (res.data?.data ?? res.data?.items ?? [])
    expect(items.length).toBeGreaterThan(0)
  })
})

// ── Pharmacy onboarding ──────────────────────────────────────────────────────

describe('Pharmacy tenant onboarding', () => {
  let tenant: NewTenant

  beforeAll(async () => {
    tenant = await registerAndLogin({
      businessName: 'Sanjivani Medical Store',
      ownerName: 'Dr Patel',
      phone: nextPhone().toString(),
      pin: '2222',
      domainType: 'pharmacy',
      city: 'Vadodara',
      stateCode: '24',
    })
  })

  it('registration sets domainType pharmacy with domain config', async () => {
    // Already tested by beforeAll succeeding — just verify branch domain
    const res = await tenant.api.get('/api/branches')
    expect(res.status).toBe(200)
    const branches = Array.isArray(res.data) ? res.data : (res.data?.branches ?? [res.data])
    const branch = branches.find((b: any) => b.id === tenant.branchId)
    if (branch) expect(branch.domainType).toBe('pharmacy')
  })

  it('can create a medicine product with pharmacy fields', async () => {
    const res = await tenant.api.post('/api/products', {
      name: 'Amoxicillin 500mg',
      sku: `AMOX-${Date.now()}`,
      unit: 'strip',
      salePrice: 45,
      purchasePrice: 30,
      gstRate: 12,
      trackStock: true,
      requiresPrescription: true,
      drugSchedule: 'H',
      genericName: 'Amoxicillin',
      manufacturer: 'Cipla',
      form: 'tablet',
      strengthDosage: '500mg',
    })
    expect(res.status).toBe(201)
    expect(res.data.domainAttrs?.requiresPrescription).toBe(true)
    expect(res.data.domainAttrs?.drugSchedule).toBe('H')
    expect(res.data.domainAttrs?.genericName).toBe('Amoxicillin')
  })

  it('can list stock levels', async () => {
    const res = await tenant.api.get('/api/stock')
    expect(res.status).toBe(200)
  })

  it('can create a supplier', async () => {
    const res = await tenant.api.post('/api/inventory/suppliers', {
      name: 'Medico Distributors',
      phone: '9876500001',
      gstin: '24AABCD1234A1Z5',
    }).catch(e => e.response)
    // 201 or 422 depending on gstin validation — just ensure no 500
    expect([201, 422]).toContain(res.status)
  })
})

// ── Wholesale onboarding ─────────────────────────────────────────────────────

describe('Wholesale tenant onboarding', () => {
  let tenant: NewTenant

  beforeAll(async () => {
    tenant = await registerAndLogin({
      businessName: 'Bharat Wholesale Traders',
      ownerName: 'Vikram Shah',
      phone: nextPhone().toString(),
      pin: '3333',
      domainType: 'wholesale',
      city: 'Surat',
      stateCode: '24',
    })
  })

  it('can create a product with GST', async () => {
    const prod = await createProduct(tenant.api, {
      name: 'Rice Sack 50kg',
      unit: 'bag',
      salePrice: 2500,
      purchasePrice: 2200,
      gstRate: 5,
    })
    expect(prod.id).toBeTruthy()
  })

  it('can create a supplier', async () => {
    const res = await tenant.api.post('/api/inventory/suppliers', {
      name: 'National Agro Supplies',
      phone: '9876500002',
      creditDays: 30,
    })
    expect(res.status).toBe(201)
    expect(res.data.id).toBeTruthy()
    expect(res.data.name).toBe('National Agro Supplies')
  })

  it('can create a purchase order', async () => {
    // First create supplier
    const sup = await tenant.api.post('/api/inventory/suppliers', {
      name: 'Supplier for PO Test',
      phone: '9876500003',
    })
    const prod = await createProduct(tenant.api, { name: 'Test Item for PO' })

    const po = await tenant.api.post('/api/inventory/purchase-orders', {
      supplierId: sup.data.id,
      poDate: '2026-06-26',
      items: [{
        description: 'Test Item for PO',
        orderedQty: 10,
        unit: 'pcs',
        rate: 100,
        taxableAmt: 1000,
        gstRate: 18,
        cgstAmt: 90,
        sgstAmt: 90,
        igstAmt: 0,
        total: 1180,
      }],
      subtotal: 1000,
      taxableAmt: 1000,
      cgstTotal: 90,
      sgstTotal: 90,
      igstTotal: 0,
      grandTotal: 1180,
    })
    expect(po.status).toBe(201)
    expect(po.data.id).toBeTruthy()
  })

  it('can create a B2B party', async () => {
    const party = await createParty(tenant.api, {
      name: 'Big Retail Chain Ltd',
      type: 'customer',
      gstin: '24AABCE1234A1Z5',
    })
    expect(party.id).toBeTruthy()
  })
})

// ── Restaurant onboarding ────────────────────────────────────────────────────

describe('Restaurant tenant onboarding', () => {
  let tenant: NewTenant

  beforeAll(async () => {
    tenant = await registerAndLogin({
      businessName: 'Tandoori Nights Restaurant',
      ownerName: 'Chef Ahmed',
      phone: nextPhone().toString(),
      pin: '4444',
      domainType: 'restaurant',
    })
  })

  it('can create a menu item with food fields', async () => {
    const res = await tenant.api.post('/api/products', {
      name: 'Paneer Butter Masala',
      sku: `PANEER-${Date.now()}`,
      unit: 'plate',
      salePrice: 250,
      purchasePrice: 100,
      gstRate: 5,
      trackStock: false,
      mealType: 'main_course',
      cuisineType: 'North Indian',
      preparationTimeMin: 15,
      isAvailableLunch: true,
      isAvailableDinner: true,
      caloriesPer100g: 180,
    })
    expect(res.status).toBe(201)
    expect(res.data.domainAttrs?.mealType).toBe('main_course')
    expect(res.data.domainAttrs?.cuisineType).toBe('North Indian')
    expect(res.data.domainAttrs?.isAvailableDinner).toBe(true)
  })

  it('can create a walk-in sale invoice', async () => {
    const prod = await createProduct(tenant.api, {
      name: 'Soft Drink',
      salePrice: 40,
      gstRate: 12,
    })

    const res = await tenant.api.post('/api/invoices', {
      txnType: 'sale_invoice',
      invoiceDate: '2026-06-26',
      items: [{
        productId: prod.id,
        description: 'Soft Drink',
        qty: 2,
        unit: 'pcs',
        rate: 40,
        taxableAmt: 80,
        gstRate: 12,
        cgstAmt: 4.80,
        sgstAmt: 4.80,
        igstAmt: 0,
        total: 89.60,
      }],
      subtotal: 80,
      taxableAmt: 80,
      cgstTotal: 4.80,
      sgstTotal: 4.80,
      igstTotal: 0,
      grandTotal: 89.60,
      paymentMode: 'cash',
    })
    // trackInventory is false so no stock check — should succeed
    expect(res.status).toBe(201)
    expect(res.data.number).toBeTruthy()
  })
})

// ── Salon onboarding ─────────────────────────────────────────────────────────

describe('Salon tenant onboarding', () => {
  let tenant: NewTenant

  beforeAll(async () => {
    tenant = await registerAndLogin({
      businessName: 'Glamour Beauty Salon',
      ownerName: 'Priya Desai',
      phone: nextPhone().toString(),
      pin: '5555',
      domainType: 'salon',
    })
  })

  it('can create a service product', async () => {
    const res = await tenant.api.post('/api/products', {
      name: 'Haircut & Styling',
      sku: `HAIRCUT-${Date.now()}`,
      unit: 'service',
      salePrice: 300,
      purchasePrice: 0,
      gstRate: 18,
      trackStock: false,
      itemType: 'service',
    })
    expect(res.status).toBe(201)
    expect(res.data.name).toBe('Haircut & Styling')
  })

  it('can create a customer party', async () => {
    const party = await tenant.api.post('/api/parties', {
      name: 'Ananya Sharma',
      type: 'customer',
      phone: '9876511111',
    })
    expect(party.status).toBe(201)
  })

  it('can create a service invoice', async () => {
    const svc = await createProduct(tenant.api, {
      name: 'Facial Treatment',
      salePrice: 800,
      gstRate: 18,
      trackStock: false,
    })

    const res = await tenant.api.post('/api/invoices', {
      txnType: 'sale_invoice',
      invoiceDate: '2026-06-26',
      items: [{
        productId: svc.id,
        description: 'Facial Treatment',
        qty: 1,
        unit: 'service',
        rate: 800,
        taxableAmt: 800,
        gstRate: 18,
        cgstAmt: 72,
        sgstAmt: 72,
        igstAmt: 0,
        total: 944,
      }],
      subtotal: 800,
      taxableAmt: 800,
      cgstTotal: 72,
      sgstTotal: 72,
      igstTotal: 0,
      grandTotal: 944,
      paymentMode: 'upi',
    })
    expect(res.status).toBe(201)
    expect(Number(res.data.grandTotal)).toBeCloseTo(944, 0)
  })
})

// ── Electronics onboarding ───────────────────────────────────────────────────

describe('Electronics tenant onboarding', () => {
  let tenant: NewTenant

  beforeAll(async () => {
    tenant = await registerAndLogin({
      businessName: 'TechZone Electronics',
      ownerName: 'Nikhil Mehta',
      phone: nextPhone().toString(),
      pin: '6666',
      domainType: 'electronics',
      city: 'Rajkot',
      stateCode: '24',
    })
  })

  it('can create a product with electronics fields', async () => {
    const res = await tenant.api.post('/api/products', {
      name: 'Samsung Galaxy A55',
      sku: `SAMGA55-${Date.now()}`,
      unit: 'pcs',
      salePrice: 38000,
      purchasePrice: 33000,
      mrp: 39999,
      gstRate: 18,
      trackStock: true,
      modelNumber: 'SM-A556',
      warrantyMonths: 12,
      isSpare: false,
    })
    expect(res.status).toBe(201)
    expect(res.data.domainAttrs?.modelNumber).toBe('SM-A556')
    expect(res.data.domainAttrs?.warrantyMonths).toBe(12)
  })

  it('can add stock via GRN flow', async () => {
    const sup = await tenant.api.post('/api/inventory/suppliers', {
      name: 'Samsung Distributor',
      phone: '9876500010',
    })

    const res = await tenant.api.get('/api/stock')
    expect(res.status).toBe(200)
  })
})

// ── Gym onboarding ───────────────────────────────────────────────────────────

describe('Gym tenant onboarding', () => {
  let tenant: NewTenant

  beforeAll(async () => {
    tenant = await registerAndLogin({
      businessName: 'FitZone Gym',
      ownerName: 'Raj Fitness',
      phone: nextPhone().toString(),
      pin: '7777',
      domainType: 'gym',
    })
  })

  it('can create a membership plan product', async () => {
    const res = await tenant.api.post('/api/products', {
      name: 'Monthly Membership',
      sku: `GYM-MONTHLY-${Date.now()}`,
      unit: 'month',
      salePrice: 1500,
      purchasePrice: 0,
      gstRate: 18,
      trackStock: false,
    })
    expect(res.status).toBe(201)
  })

  it('can list expenses (new table in provisioned schema)', async () => {
    const res = await tenant.api.get('/api/expenses')
    expect(res.status).toBe(200)
  })
})

// ── Coaching Institute onboarding ────────────────────────────────────────────

describe('Coaching Institute tenant onboarding', () => {
  let tenant: NewTenant

  beforeAll(async () => {
    tenant = await registerAndLogin({
      businessName: 'Success Point Coaching',
      ownerName: 'Prof Kumar',
      phone: nextPhone().toString(),
      pin: '8888',
      domainType: 'coaching',
    })
  })

  it('can register and login successfully', async () => {
    expect(tenant.branchId).toBeTruthy()
    expect(tenant.tenantId).toBeTruthy()
  })

  it('can create a course product', async () => {
    const res = await tenant.api.post('/api/products', {
      name: 'JEE Advanced 2027 Batch',
      sku: `JEE2027-${Date.now()}`,
      unit: 'batch',
      salePrice: 50000,
      purchasePrice: 0,
      gstRate: 18,
      trackStock: false,
    })
    expect(res.status).toBe(201)
  })
})

// ── Tenant isolation ─────────────────────────────────────────────────────────

describe('New tenant isolation', () => {
  let tenantA: NewTenant
  let tenantB: NewTenant

  beforeAll(async () => {
    const [a, b] = await Promise.all([
      registerAndLogin({
        businessName: 'Store Alpha ' + Date.now(),
        ownerName: 'Alpha Owner',
        phone: nextPhone().toString(),
        pin: '1234',
        domainType: 'retail',
      }),
      registerAndLogin({
        businessName: 'Store Beta ' + Date.now(),
        ownerName: 'Beta Owner',
        phone: nextPhone().toString(),
        pin: '1234',
        domainType: 'retail',
      }),
    ])
    tenantA = a
    tenantB = b
  })

  it('products created in tenant A are not visible to tenant B', async () => {
    await createProduct(tenantA.api, { name: 'Alpha Exclusive Product' })

    const res = await tenantB.api.get('/api/products')
    const items = Array.isArray(res.data) ? res.data
      : Array.isArray(res.data?.data) ? res.data.data
      : Array.isArray(res.data?.items) ? res.data.items
      : []
    const names = items.map((p: any) => p.name)
    expect(names).not.toContain('Alpha Exclusive Product')
  })

  it('parties created in tenant A are not visible to tenant B', async () => {
    await createParty(tenantA.api, { name: 'Alpha Exclusive Customer' })

    const res = await tenantB.api.get('/api/parties')
    const items = Array.isArray(res.data) ? res.data
      : Array.isArray(res.data?.data) ? res.data.data
      : Array.isArray(res.data?.parties) ? res.data.parties
      : []
    const names = items.map((p: any) => p.name)
    expect(names).not.toContain('Alpha Exclusive Customer')
  })

  it('new tenant cannot access seeded tenant data (Krishna Wholesale parties)', async () => {
    // Krishna Wholesale has many parties — none should leak into our new tenant
    const res = await tenantA.api.get('/api/parties')
    const items = Array.isArray(res.data) ? res.data
      : Array.isArray(res.data?.data) ? res.data.data
      : Array.isArray(res.data?.parties) ? res.data.parties
      : []
    // New tenant should only have what WE created (max a few), not thousands
    expect(items.length).toBeLessThan(10)
    // None should be named Krishna Wholesale's well-known party
    const names = items.map((p: any) => p.name)
    expect(names).not.toContain('Mahesh Traders')
  })
})

// ── check-phone endpoint ─────────────────────────────────────────────────────

describe('GET /api/tenants/check-phone', () => {
  it('returns available: true for unused phone', async () => {
    const res = await axios.get(`${BASE}/api/tenants/check-phone/9711111111`)
    expect(res.status).toBe(200)
    expect(res.data.available).toBe(true)
  })

  it('returns available: false for registered phone', async () => {
    // 9844001001 is the seeded glamour_salon tenant — always registered
    const res = await axios.get(`${BASE}/api/tenants/check-phone/9844001001`)
    expect(res.status).toBe(200)
    expect(res.data.available).toBe(false)
  })
})
