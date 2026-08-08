// =============================================================================
// packages/db/prisma/seed.ts
//
// Per-schema multi-tenant seed.
// Each tenant gets its own PostgreSQL schema created via create_tenant_schema().
// The public-schema `db` client is used only for tenant registry rows.
// Per-tenant `tdb` clients are used for branches, users, products, etc.
// =============================================================================

import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcrypt'

// Public-schema client (tenants table)
const db = new PrismaClient()

function hashPin(pin: string): Promise<string> { return bcrypt.hash(pin, 10) }

function schemaFromSlug(slug: string) { return `t_${slug.replace(/-/g, '_')}` }

function tenantDb(schemaName: string) {
  const base = process.env.DATABASE_URL!
  const url  = base.includes('?') ? `${base}&schema=${schemaName}` : `${base}?schema=${schemaName}`
  return new PrismaClient({ datasources: { db: { url } } })
}

// Fetch a deterministic placeholder image for a product using its name as seed.
// Uses picsum.photos with a text-derived seed so the same product always gets
// the same image. Falls back silently — missing images are not fatal.
async function fetchProductImage(productName: string): Promise<{ data: Buffer; mime: string } | null> {
  try {
    const seed = encodeURIComponent(productName.slice(0, 30).toLowerCase().replace(/\s+/g, '-'))
    const res  = await fetch(`https://picsum.photos/seed/${seed}/200/200`)
    if (!res.ok) return null
    const buf  = Buffer.from(await res.arrayBuffer())
    return { data: buf, mime: 'image/jpeg' }
  } catch {
    return null
  }
}

function uid(a: number, b: number, c: number, d: number): string {
  const hex = (n: number, len: number) => n.toString(16).padStart(len, '0')
  return `${hex(a,8)}-${hex(b,4)}-${hex(c,4)}-${hex(d,4)}-${'0'.repeat(12)}`
}

function daysAgo(n: number): Date {
  const d = new Date(); d.setDate(d.getDate() - n); d.setHours(0,0,0,0); return d
}

function futureDate(n: number): Date {
  const d = new Date(); d.setDate(d.getDate() + n); d.setHours(0,0,0,0); return d
}

function lineItem(
  description: string, productId: string | null,
  qty: number, rate: number, gstRate: number,
  hsnSacCode: string | null = null, unit = 'pcs', discountPct = 0,
) {
  const gross   = qty * rate
  const discAmt = +(gross * discountPct / 100).toFixed(2)
  const taxable = +(gross - discAmt).toFixed(2)
  const cgst    = +(taxable * gstRate / 200).toFixed(2)
  const sgst    = +(taxable * gstRate / 200).toFixed(2)
  const total   = +(taxable + cgst + sgst).toFixed(2)
  return { description, productId, qty, rate, unit, hsnSacCode,
           discountPct, discountAmt: discAmt, taxableAmt: taxable,
           gstRate, cgstAmt: cgst, sgstAmt: sgst, igstAmt: 0, total }
}

function invoiceTotals(items: ReturnType<typeof lineItem>[]) {
  const subtotal    = +items.reduce((s,i) => s + i.qty * i.rate, 0).toFixed(2)
  const discountAmt = +items.reduce((s,i) => s + i.discountAmt, 0).toFixed(2)
  const taxableAmt  = +items.reduce((s,i) => s + i.taxableAmt, 0).toFixed(2)
  const cgstTotal   = +items.reduce((s,i) => s + i.cgstAmt, 0).toFixed(2)
  const sgstTotal   = +items.reduce((s,i) => s + i.sgstAmt, 0).toFixed(2)
  const grandTotal  = +(taxableAmt + cgstTotal + sgstTotal).toFixed(2)
  return { subtotal, discountAmt, taxableAmt, cgstTotal, sgstTotal, igstTotal: 0, cessTotal: 0, roundOff: 0, grandTotal }
}

// Creates schema via SQL function, returns a connected tdb client
async function provisionSchema(schemaName: string) {
  await db.$executeRawUnsafe(`SELECT public.create_tenant_schema('${schemaName}')`)
  // create_tenant_schema predates categories/brands — ensure they exist
  await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "${schemaName}".categories (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "branchId"  UUID,
      name        TEXT NOT NULL,
      slug        TEXT NOT NULL,
      icon        TEXT,
      color       TEXT,
      "parentId"  UUID,
      "sortOrder" INTEGER DEFAULT 0,
      "isActive"  BOOLEAN DEFAULT TRUE,
      "createdAt" TIMESTAMPTZ DEFAULT NOW()
    )`)
  await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "${schemaName}".brands (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "branchId"  UUID,
      name        TEXT NOT NULL,
      slug        TEXT NOT NULL,
      "isActive"  BOOLEAN DEFAULT TRUE,
      "createdAt" TIMESTAMPTZ DEFAULT NOW()
    )`)
  // Add columns that create_tenant_schema predates — all IF NOT EXISTS, safe to re-run
  // products
  await db.$executeRawUnsafe(`ALTER TABLE "${schemaName}".products ADD COLUMN IF NOT EXISTS "brandId" UUID`)
  await db.$executeRawUnsafe(`ALTER TABLE "${schemaName}".products ADD COLUMN IF NOT EXISTS "image" BYTEA`)
  await db.$executeRawUnsafe(`ALTER TABLE "${schemaName}".products ADD COLUMN IF NOT EXISTS "imageMime" TEXT`)
  await db.$executeRawUnsafe(`ALTER TABLE "${schemaName}".products ADD COLUMN IF NOT EXISTS "hasVariants" BOOLEAN NOT NULL DEFAULT false`)
  // invoices — approval workflow + e-invoice + e-way bill + linked invoice
  await db.$executeRawUnsafe(`ALTER TABLE "${schemaName}".invoices ADD COLUMN IF NOT EXISTS "linkedInvoiceId" UUID`)
  await db.$executeRawUnsafe(`ALTER TABLE "${schemaName}".invoices ADD COLUMN IF NOT EXISTS "approvalStatus" TEXT NOT NULL DEFAULT 'not_required'`)
  await db.$executeRawUnsafe(`ALTER TABLE "${schemaName}".invoices ADD COLUMN IF NOT EXISTS "approvedBy" UUID`)
  await db.$executeRawUnsafe(`ALTER TABLE "${schemaName}".invoices ADD COLUMN IF NOT EXISTS "approvedAt" TIMESTAMPTZ`)
  await db.$executeRawUnsafe(`ALTER TABLE "${schemaName}".invoices ADD COLUMN IF NOT EXISTS "approvalNote" TEXT`)
  await db.$executeRawUnsafe(`ALTER TABLE "${schemaName}".invoices ADD COLUMN IF NOT EXISTS "irnNo" TEXT`)
  await db.$executeRawUnsafe(`ALTER TABLE "${schemaName}".invoices ADD COLUMN IF NOT EXISTS "irnAckDate" TIMESTAMPTZ`)
  await db.$executeRawUnsafe(`ALTER TABLE "${schemaName}".invoices ADD COLUMN IF NOT EXISTS "irnQrCode" TEXT`)
  await db.$executeRawUnsafe(`ALTER TABLE "${schemaName}".invoices ADD COLUMN IF NOT EXISTS "eWayBillNo" TEXT`)
  await db.$executeRawUnsafe(`ALTER TABLE "${schemaName}".invoices ADD COLUMN IF NOT EXISTS "eWayBillDate" TIMESTAMPTZ`)
  await db.$executeRawUnsafe(`ALTER TABLE "${schemaName}".invoices ADD COLUMN IF NOT EXISTS "eWayBillValidTo" TIMESTAMPTZ`)
  await db.$executeRawUnsafe(`ALTER TABLE "${schemaName}".invoices ADD COLUMN IF NOT EXISTS "cancelledBy" UUID`)
  await db.$executeRawUnsafe(`ALTER TABLE "${schemaName}".invoices ADD COLUMN IF NOT EXISTS "cancelledAt" TIMESTAMPTZ`)
  // payments — void + cheque + status
  await db.$executeRawUnsafe(`ALTER TABLE "${schemaName}".payments ADD COLUMN IF NOT EXISTS "type" TEXT NOT NULL DEFAULT 'receipt'`)
  await db.$executeRawUnsafe(`ALTER TABLE "${schemaName}".payments ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'success'`)
  await db.$executeRawUnsafe(`ALTER TABLE "${schemaName}".payments ADD COLUMN IF NOT EXISTS "voidedAt" TIMESTAMPTZ`)
  await db.$executeRawUnsafe(`ALTER TABLE "${schemaName}".payments ADD COLUMN IF NOT EXISTS "voidReason" TEXT`)
  await db.$executeRawUnsafe(`ALTER TABLE "${schemaName}".payments ADD COLUMN IF NOT EXISTS "chequeNo" TEXT`)
  await db.$executeRawUnsafe(`ALTER TABLE "${schemaName}".payments ADD COLUMN IF NOT EXISTS "chequeDueDate" DATE`)
  await db.$executeRawUnsafe(`ALTER TABLE "${schemaName}".payments ADD COLUMN IF NOT EXISTS "bankName" TEXT`)
  await db.$executeRawUnsafe(`ALTER TABLE "${schemaName}".payments ADD COLUMN IF NOT EXISTS "clearingStatus" TEXT`)
  await db.$executeRawUnsafe(`ALTER TABLE "${schemaName}".payments ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMPTZ`)
  // stock_ledger — variant + notes + createdBy
  await db.$executeRawUnsafe(`ALTER TABLE "${schemaName}".stock_ledger ADD COLUMN IF NOT EXISTS "variantId" UUID`)
  await db.$executeRawUnsafe(`ALTER TABLE "${schemaName}".stock_ledger ADD COLUMN IF NOT EXISTS "notes" TEXT`)
  await db.$executeRawUnsafe(`ALTER TABLE "${schemaName}".stock_ledger ADD COLUMN IF NOT EXISTS "createdBy" TEXT`)
  // invoice_sequences — create_tenant_schema uses wrong camelCase columns without fy.
  // Drop and recreate with the snake_case schema that invoice-number.ts expects.
  await db.$executeRawUnsafe(`DROP TABLE IF EXISTS "${schemaName}".invoice_sequences`)
  await db.$executeRawUnsafe(`
    CREATE TABLE "${schemaName}".invoice_sequences (
      branch_id   UUID   NOT NULL,
      txn_type    TEXT   NOT NULL,
      fy          TEXT   NOT NULL,
      current_val BIGINT NOT NULL DEFAULT 1,
      PRIMARY KEY (branch_id, txn_type, fy)
    )`)
  await db.$executeRawUnsafe(`GRANT SELECT, INSERT, UPDATE ON "${schemaName}".invoice_sequences TO billing_app`)
  // expenses table (added after create_tenant_schema was written)
  await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "${schemaName}".expenses (
      id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
      "branchId"     UUID         NOT NULL,
      date           DATE         NOT NULL DEFAULT CURRENT_DATE,
      category       TEXT         NOT NULL,
      description    TEXT,
      amount         NUMERIC      NOT NULL,
      "gstAmount"    NUMERIC      NOT NULL DEFAULT 0,
      "gstRate"      INTEGER      NOT NULL DEFAULT 0,
      "paymentMode"  TEXT         NOT NULL DEFAULT 'cash',
      "partyId"      UUID,
      "referenceNo"  TEXT,
      notes          TEXT,
      "attachmentUrl" TEXT,
      "isRecurring"  BOOLEAN      NOT NULL DEFAULT false,
      recurrence     TEXT,
      "createdBy"    UUID         NOT NULL,
      "createdAt"    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
      "updatedAt"    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
    )`)
  return tenantDb(schemaName)
}

// ─────────────────────────────────────────────────────────────────────────────
// Generic domain seeder — branch + user + products + parties + invoices
// ─────────────────────────────────────────────────────────────────────────────
async function seedDomain(cfg: {
  o: number; slug: string; name: string; phone: string
  ownerName: string; pin: string; branchName: string
  domainType: string; domainConfig: Record<string, unknown>; prefix: string
  gstin?: string
  categories?: Array<{ slug:string; name:string; icon?:string; color?:string; sortOrder?:number }>
  brands?: Array<{ slug:string; name:string }>
  prods: Array<{ i:number; name:string; sku:string; hsn:string; gst:number; unit:string; pp:number; sp:number; mrp:number; low:number; stock:number; attrs:Record<string,unknown>; cat?:string; brand?:string }>
  parties: Array<{ i:number; type:string; name:string; phone:string; bal:number; limit?:number; gstin?:string }>
  invs: Array<{ n:number; pi:number|null; status:'paid'|'partial'|'confirmed'; method:string|null; ago:number; items:ReturnType<typeof lineItem>[]; domainData?:Record<string,unknown> }>
}) {
  const schemaName = schemaFromSlug(cfg.slug)

  // Register in public.tenants
  const tenant = await db.tenant.upsert({
    where:  { slug: cfg.slug }, update: {},
    create: { name: cfg.name, slug: cfg.slug, schemaName, plan: 'free',
              ownerPhone: cfg.phone, gstin: cfg.gstin ?? null,
              settings: { currency: 'INR', lang: 'en', timezone: 'Asia/Kolkata' } },
  })

  // Provision schema + tables
  const tdb = await provisionSchema(schemaName)

  // Branch
  const branch = await tdb.branch.upsert({
    where:  { id: uid(cfg.o, 9, 0, 0) }, update: {},
    create: { id: uid(cfg.o, 9, 0, 0), name: cfg.branchName, gstin: cfg.gstin ?? null,
              stateCode: '24', domainType: cfg.domainType,
              domainConfig: { ...cfg.domainConfig, invoice_prefix: cfg.prefix } },
  })

  // Owner user
  const user = await tdb.user.upsert({
    where:  { phone: cfg.phone }, update: {},
    create: { name: cfg.ownerName, phone: cfg.phone, role: 'owner',
              branchIds: [], pin: await hashPin(cfg.pin) },
  })

  // Categories
  const catMap: Record<string, string> = {}
  for (let ci = 0; ci < (cfg.categories ?? []).length; ci++) {
    const c = cfg.categories![ci]!
    const catId = uid(cfg.o, 15, ci + 1, 0)
    await tdb.category.upsert({
      where:  { id: catId },
      update: {},
      create: { id: catId, branch: { connect: { id: branch.id } }, name: c.name, slug: c.slug,
                icon: c.icon ?? null, color: c.color ?? null, sortOrder: c.sortOrder ?? ci },
    })
    catMap[c.slug] = catId
  }

  // Brands
  const brandMap: Record<string, string> = {}
  for (let bi = 0; bi < (cfg.brands ?? []).length; bi++) {
    const b = cfg.brands![bi]!
    const brandId = uid(cfg.o, 16, bi + 1, 0)
    await tdb.brand.upsert({
      where:  { id: brandId },
      update: {},
      create: { id: brandId, branch: { connect: { id: branch.id } }, name: b.name, slug: b.slug },
    })
    brandMap[b.slug] = brandId
  }

  // Products + opening stock
  for (const p of cfg.prods) {
    const pid = uid(cfg.o, 2, p.i, 0)
    const img = await fetchProductImage(p.name)
    const categoryId = p.cat ? (catMap[p.cat] ?? null) : null
    const brandId    = p.brand ? (brandMap[p.brand] ?? null) : null
    await tdb.product.upsert({
      where:  { id: pid }, update: {},
      create: { id: pid, branch: { connect: { id: branch.id } }, name: p.name, sku: p.sku,
                hsnSacCode: p.hsn, gstRate: p.gst, unit: p.unit,
                purchasePrice: p.pp, salePrice: p.sp, mrp: p.mrp,
                trackStock: p.trackStock ?? true, lowStockQty: p.low,
                domainAttrs: p.attrs,
                ...(categoryId ? { category: { connect: { id: categoryId } } } : {}),
                ...(brandId    ? { brand:    { connect: { id: brandId } } }    : {}),
                ...(img ? { image: img.data, imageMime: img.mime } : {}) },
    })
    if (p.stock > 0) {
      await tdb.stockLedger.upsert({
        where:  { id: uid(cfg.o, 7, p.i, 0) }, update: {},
        create: { id: uid(cfg.o, 7, p.i, 0), branchId: branch.id, product: { connect: { id: pid } },
                  txnType: 'opening', qty: p.stock, rate: p.pp,
                  refType: 'opening_stock', refId: pid },
      })
    }
  }

  // Parties
  for (const p of cfg.parties) {
    await tdb.party.upsert({
      where:  { id: uid(cfg.o, 0, 0, p.i) }, update: {},
      create: { id: uid(cfg.o, 0, 0, p.i), branch: { connect: { id: branch.id } },
                type: p.type, name: p.name, phone: p.phone,
                balance: p.bal, creditLimit: p.limit ?? 0, gstin: p.gstin ?? null },
    })
  }

  // Invoices
  for (const inv of cfg.invs) {
    const totals    = invoiceTotals(inv.items)
    const paidAmt   = inv.status === 'paid'    ? totals.grandTotal
                    : inv.status === 'partial' ? +(totals.grandTotal * 0.5).toFixed(2) : 0
    const invoiceId = uid(cfg.o, 1, inv.n, 0)
    const partyId   = inv.pi != null ? uid(cfg.o, 0, 0, inv.pi) : null

    await tdb.invoice.upsert({
      where:  { id: invoiceId }, update: {},
      create: { id: invoiceId, branch: { connect: { id: branch.id } },
                ...(partyId ? { party: { connect: { id: partyId } } } : {}),
                createdByUser: { connect: { id: user.id } }, txnType: 'sale_invoice',
                number: `${cfg.prefix}-2025-${String(inv.n).padStart(5,'0')}`,
                date: daysAgo(inv.ago), status: inv.status, paidAmt, ...totals,
                ...(inv.domainData ? { domainData: inv.domainData } : {}) },
    })

    for (let li = 0; li < inv.items.length; li++) {
      const it = inv.items[li]!
      await tdb.invoiceItem.upsert({
        where:  { id: uid(cfg.o * 100 + inv.n, 6, li + 1, 0) }, update: {},
        create: { id: uid(cfg.o * 100 + inv.n, 6, li + 1, 0),
                  invoice: { connect: { id: invoiceId } },
                  ...(it.productId ? { product: { connect: { id: it.productId } } } : {}),
                  description: it.description,
                  hsnSacCode: it.hsnSacCode, qty: it.qty, unit: it.unit, rate: it.rate,
                  discountPct: it.discountPct, discountAmt: it.discountAmt,
                  taxableAmt: it.taxableAmt, gstRate: it.gstRate,
                  cgstAmt: it.cgstAmt, sgstAmt: it.sgstAmt, igstAmt: 0,
                  total: it.total, sortOrder: li },
      })
      if (it.productId) {
        await tdb.stockLedger.upsert({
          where:  { id: uid(cfg.o * 100 + inv.n, 8, li + 1, 0) }, update: {},
          create: { id: uid(cfg.o * 100 + inv.n, 8, li + 1, 0), branchId: branch.id,
                    product: { connect: { id: it.productId } }, txnType: 'sale',
                    qty: -it.qty, rate: it.rate, refType: 'invoice', refId: invoiceId },
        })
      }
    }

    if (inv.method && paidAmt > 0) {
      const paymentId = uid(cfg.o, 3, inv.n, 0)
      await tdb.payment.upsert({
        where:  { id: paymentId }, update: {},
        create: { id: paymentId, branchId: branch.id,
                  ...(partyId ? { party: { connect: { id: partyId } } } : {}),
                  amount: paidAmt,
                  method: inv.method, paymentDate: daysAgo(inv.ago), createdBy: user.id },
      })
      await tdb.paymentAllocation.upsert({
        where:  { id: uid(cfg.o, 4, inv.n, 0) }, update: {},
        create: { id: uid(cfg.o, 4, inv.n, 0),
                  payment: { connect: { id: paymentId } },
                  invoice: { connect: { id: invoiceId } },
                  amount: paidAmt },
      })
    }
  }

  console.log(`  ✓ ${cfg.domainType.padEnd(14)} ${cfg.name}  (login: tenantPhone=${cfg.phone} phone=${cfg.phone} PIN=${cfg.pin})`)
  await tdb.$disconnect()
  return tenant
}

// =============================================================================
// seedExpenses — realistic expenses for every tenant, reflecting their domain
// =============================================================================
async function seedExpenses() {
  type ExpRow = {
    daysAgoN: number
    category: string
    description: string
    amount: number
    gstRate?: number
    paymentMode: string
    referenceNo?: string
    isRecurring?: boolean
    recurrence?: string
  }

  async function insertExpenses(schema: string, branchId: string, userId: string, rows: ExpRow[]) {
    const edb = tenantDb(schema)
    for (const r of rows) {
      const gstRate   = r.gstRate ?? 0
      const gstAmount = +(r.amount * gstRate / (100 + gstRate)).toFixed(2)
      const date      = daysAgo(r.daysAgoN).toISOString().slice(0, 10)
      await edb.$executeRawUnsafe(`
        INSERT INTO expenses (id,"branchId",date,category,description,amount,"gstAmount","gstRate","paymentMode","referenceNo","isRecurring",recurrence,"createdBy","createdAt","updatedAt")
        VALUES (
          gen_random_uuid(),
          '${branchId}'::uuid,
          '${date}'::date,
          '${r.category}',
          ${r.description ? `'${r.description.replace(/'/g, "''")}'` : 'NULL'},
          ${r.amount},
          ${gstAmount},
          ${gstRate},
          '${r.paymentMode}',
          ${r.referenceNo ? `'${r.referenceNo}'` : 'NULL'},
          ${r.isRecurring ? 'true' : 'false'},
          ${r.recurrence  ? `'${r.recurrence}'` : 'NULL'},
          '${userId}'::uuid,
          NOW(), NOW()
        )
      `)
    }
    await edb.$disconnect()
  }

  // helper to get branch + first user for a schema
  async function getBranchUser(schema: string) {
    const edb  = tenantDb(schema)
    const b    = await edb.branch.findFirst({ select: { id: true } })
    const u    = await edb.user.findFirst({ select: { id: true } })
    await edb.$disconnect()
    return { branchId: b!.id, userId: u!.id }
  }

  // ── Kirana / Retail ──────────────────────────────────────────────────────────
  const kirana = await getBranchUser('t_ramesh_kirana')
  await insertExpenses('t_ramesh_kirana', kirana.branchId, kirana.userId, [
    { daysAgoN:1,  category:'purchases',   description:'Amul dairy products — monthly stock',    amount:18500, gstRate:5,  paymentMode:'bank',   referenceNo:'PUR-2025-341' },
    { daysAgoN:2,  category:'purchases',   description:'HUL products bulk order',                 amount:24000, gstRate:18, paymentMode:'bank',   referenceNo:'PUR-2025-340' },
    { daysAgoN:3,  category:'electricity', description:'DGVCL electricity bill — June',          amount:3200,  gstRate:0,  paymentMode:'upi',    isRecurring:true, recurrence:'monthly' },
    { daysAgoN:5,  category:'rent',        description:'Shop rent — June 2025',                  amount:12000, gstRate:0,  paymentMode:'bank',   isRecurring:true, recurrence:'monthly' },
    { daysAgoN:7,  category:'purchases',   description:'Britannia biscuits & confectionery',     amount:9800,  gstRate:18, paymentMode:'cash',   referenceNo:'PUR-2025-335' },
    { daysAgoN:10, category:'staff',       description:'Helper salary — June',                   amount:8000,  gstRate:0,  paymentMode:'cash',   isRecurring:true, recurrence:'monthly' },
    { daysAgoN:12, category:'packaging',   description:'Carry bags and polythene covers',        amount:1200,  gstRate:12, paymentMode:'cash' },
    { daysAgoN:15, category:'purchases',   description:'ITC cigarettes & tobacco purchase',      amount:14200, gstRate:28, paymentMode:'bank',   referenceNo:'PUR-2025-328' },
    { daysAgoN:20, category:'maintenance', description:'AC servicing and gas top-up',            amount:2500,  gstRate:18, paymentMode:'cash' },
    { daysAgoN:25, category:'transport',   description:'Goods auto-rickshaw charges',            amount:800,   gstRate:0,  paymentMode:'cash' },
    { daysAgoN:30, category:'internet',    description:'Jio Fiber broadband — June',             amount:999,   gstRate:18, paymentMode:'upi',    isRecurring:true, recurrence:'monthly' },
    { daysAgoN:32, category:'misc',        description:'Diwali decoration supplies',              amount:2200,  gstRate:12, paymentMode:'cash' },
  ])

  // ── Restaurant ────────────────────────────────────────────────────────────────
  const rest = await getBranchUser('t_shree_restaurant')
  await insertExpenses('t_shree_restaurant', rest.branchId, rest.userId, [
    { daysAgoN:1,  category:'raw_material',description:'Vegetables & grocery — daily market',   amount:4500,  gstRate:0,  paymentMode:'cash' },
    { daysAgoN:1,  category:'raw_material',description:'Chicken & mutton purchase',             amount:6200,  gstRate:5,  paymentMode:'cash' },
    { daysAgoN:2,  category:'raw_material',description:'Rice, dal, spices bulk',                amount:8000,  gstRate:5,  paymentMode:'bank',   referenceNo:'SUP-221' },
    { daysAgoN:3,  category:'gas_lpg',     description:'Commercial LPG cylinder × 4',          amount:3600,  gstRate:5,  paymentMode:'cash' },
    { daysAgoN:5,  category:'rent',        description:'Restaurant rent — June',                amount:35000, gstRate:18, paymentMode:'bank',   isRecurring:true, recurrence:'monthly' },
    { daysAgoN:7,  category:'staff',       description:'Chef & waiter salaries — June',         amount:45000, gstRate:0,  paymentMode:'bank',   isRecurring:true, recurrence:'monthly' },
    { daysAgoN:8,  category:'aggregator',  description:'Zomato commission — May settlement',   amount:12400, gstRate:18, paymentMode:'bank',   referenceNo:'ZOM-MAY-2025' },
    { daysAgoN:10, category:'aggregator',  description:'Swiggy commission — May settlement',   amount:8900,  gstRate:18, paymentMode:'bank',   referenceNo:'SWI-MAY-2025' },
    { daysAgoN:12, category:'packaging',   description:'Takeaway boxes, parcel bags',           amount:2200,  gstRate:12, paymentMode:'cash' },
    { daysAgoN:15, category:'electricity', description:'Electricity bill — June',               amount:8500,  gstRate:0,  paymentMode:'upi',    isRecurring:true, recurrence:'monthly' },
    { daysAgoN:20, category:'equipment',   description:'Exhaust fan replacement',               amount:3800,  gstRate:18, paymentMode:'cash' },
    { daysAgoN:22, category:'raw_material',description:'Paneer, curd, dairy purchase',          amount:3100,  gstRate:5,  paymentMode:'cash' },
  ])

  // ── Pharmacy ──────────────────────────────────────────────────────────────────
  const pharma = await getBranchUser('t_lifeline_pharmacy')
  await insertExpenses('t_lifeline_pharmacy', pharma.branchId, pharma.userId, [
    { daysAgoN:1,  category:'drug_purchase',description:'Cipla medicines — monthly order',      amount:48000, gstRate:12, paymentMode:'bank',   referenceNo:'CIP-2025-1441' },
    { daysAgoN:3,  category:'drug_purchase',description:'Sun Pharma purchase',                  amount:32000, gstRate:12, paymentMode:'bank',   referenceNo:'SUN-2025-889' },
    { daysAgoN:5,  category:'rent',         description:'Shop rent — June',                     amount:18000, gstRate:18, paymentMode:'bank',   isRecurring:true, recurrence:'monthly' },
    { daysAgoN:7,  category:'staff',        description:'Pharmacist salary — June',             amount:22000, gstRate:0,  paymentMode:'bank',   isRecurring:true, recurrence:'monthly' },
    { daysAgoN:10, category:'cold_storage', description:'Cold chain electricity & maintenance', amount:2800,  gstRate:0,  paymentMode:'upi' },
    { daysAgoN:12, category:'drug_purchase',description:'Mankind generics purchase',            amount:15000, gstRate:5,  paymentMode:'bank',   referenceNo:'MAN-2025-567' },
    { daysAgoN:15, category:'licence',      description:'Drug licence renewal fee',             amount:5000,  gstRate:0,  paymentMode:'bank',   isRecurring:true, recurrence:'yearly' },
    { daysAgoN:18, category:'electricity',  description:'DGVCL bill — June',                   amount:4200,  gstRate:0,  paymentMode:'upi',    isRecurring:true, recurrence:'monthly' },
    { daysAgoN:22, category:'wastage',      description:'Expired batch disposal — OMP2025',    amount:3300,  gstRate:0,  paymentMode:'cash' },
    { daysAgoN:28, category:'misc',         description:'POS machine paper rolls',              amount:450,   gstRate:18, paymentMode:'cash' },
  ])

  // ── Electronics ────────────────────────────────────────────────────────────────
  const elec = await getBranchUser('t_digismart_electronics')
  await insertExpenses('t_digismart_electronics', elec.branchId, elec.userId, [
    { daysAgoN:2,  category:'purchases',   description:'Samsung India — stock replenishment',  amount:180000,gstRate:18, paymentMode:'bank',   referenceNo:'SAM-2025-7821' },
    { daysAgoN:4,  category:'purchases',   description:'Apple authorised distributor — iPhones',amount:250000,gstRate:18,paymentMode:'bank',   referenceNo:'APL-2025-441' },
    { daysAgoN:5,  category:'rent',        description:'Showroom rent — June',                 amount:45000, gstRate:18, paymentMode:'bank',   isRecurring:true, recurrence:'monthly' },
    { daysAgoN:7,  category:'staff',       description:'Sales staff salaries — June',          amount:55000, gstRate:0,  paymentMode:'bank',   isRecurring:true, recurrence:'monthly' },
    { daysAgoN:10, category:'electricity', description:'Electricity bill — showroom',          amount:9800,  gstRate:0,  paymentMode:'upi',    isRecurring:true, recurrence:'monthly' },
    { daysAgoN:14, category:'warranty',    description:'Warranty claim service charges',       amount:3500,  gstRate:18, paymentMode:'bank' },
    { daysAgoN:20, category:'demo_units',  description:'Demo unit write-off — OnePlus display',amount:8000, gstRate:18, paymentMode:'bank' },
    { daysAgoN:25, category:'internet',    description:'Broadband + security camera plan',     amount:2499,  gstRate:18, paymentMode:'upi',    isRecurring:true, recurrence:'monthly' },
  ])

  // ── Salon ──────────────────────────────────────────────────────────────────────
  const salon = await getBranchUser('t_glamour_salon')
  await insertExpenses('t_glamour_salon', salon.branchId, salon.userId, [
    { daysAgoN:1,  category:'product_purchase',description:'Loreal professional products',     amount:12000, gstRate:18, paymentMode:'bank',   referenceNo:'LOR-2025-221' },
    { daysAgoN:3,  category:'product_purchase',description:'Wella hair colour & toners',       amount:8500,  gstRate:18, paymentMode:'bank' },
    { daysAgoN:5,  category:'rent',            description:'Salon rent — June',                amount:20000, gstRate:18, paymentMode:'bank',   isRecurring:true, recurrence:'monthly' },
    { daysAgoN:7,  category:'staff',           description:'Stylist salaries — June',          amount:38000, gstRate:0,  paymentMode:'bank',   isRecurring:true, recurrence:'monthly' },
    { daysAgoN:10, category:'commission',      description:'Senior stylist commission payout', amount:6200,  gstRate:0,  paymentMode:'cash' },
    { daysAgoN:12, category:'electricity',     description:'Electricity bill — June',          amount:5500,  gstRate:0,  paymentMode:'upi',    isRecurring:true, recurrence:'monthly' },
    { daysAgoN:15, category:'equipment',       description:'New hair dryer + clippers set',   amount:9800,  gstRate:18, paymentMode:'card' },
    { daysAgoN:20, category:'misc',            description:'Disposable towels & gloves stock', amount:1800,  gstRate:18, paymentMode:'cash' },
  ])

  // ── Jewellery ──────────────────────────────────────────────────────────────────
  const jwl = await getBranchUser('t_shubhlaxmi_jewellers')
  await insertExpenses('t_shubhlaxmi_jewellers', jwl.branchId, jwl.userId, [
    { daysAgoN:2,  category:'gold_purchase',  description:'Gold purchase — 100g @₹7200/g',    amount:720000,gstRate:3,  paymentMode:'bank',   referenceNo:'GOLD-2025-081' },
    { daysAgoN:5,  category:'making_charges', description:'Karigar charges — June batch',     amount:18000, gstRate:5,  paymentMode:'cash' },
    { daysAgoN:7,  category:'rent',           description:'Showroom rent — June',              amount:40000, gstRate:18, paymentMode:'bank',   isRecurring:true, recurrence:'monthly' },
    { daysAgoN:10, category:'hallmark',       description:'BIS hallmarking — 22 pieces',      amount:2200,  gstRate:0,  paymentMode:'cash',   referenceNo:'HUID-BATCH-062025' },
    { daysAgoN:12, category:'insurance',      description:'Jewellery stock insurance premium',amount:15000, gstRate:18, paymentMode:'bank',   isRecurring:true, recurrence:'yearly' },
    { daysAgoN:15, category:'staff',          description:'Staff salaries — June',             amount:30000, gstRate:0,  paymentMode:'bank',   isRecurring:true, recurrence:'monthly' },
    { daysAgoN:20, category:'electricity',    description:'Electricity bill — June',           amount:6200,  gstRate:0,  paymentMode:'upi',    isRecurring:true, recurrence:'monthly' },
  ])

  // ── Automobile Workshop ────────────────────────────────────────────────────────
  const auto = await getBranchUser('t_shiv_auto_works')
  await insertExpenses('t_shiv_auto_works', auto.branchId, auto.userId, [
    { daysAgoN:1,  category:'parts_purchase', description:'Bosch spare parts order',           amount:22000, gstRate:28, paymentMode:'bank',   referenceNo:'BOS-2025-1120' },
    { daysAgoN:3,  category:'consumables',    description:'Engine oils & lubricants stock',    amount:8500,  gstRate:18, paymentMode:'cash' },
    { daysAgoN:5,  category:'rent',           description:'Workshop rent — June',              amount:15000, gstRate:18, paymentMode:'bank',   isRecurring:true, recurrence:'monthly' },
    { daysAgoN:7,  category:'staff',          description:'Technician salaries — June',        amount:42000, gstRate:0,  paymentMode:'bank',   isRecurring:true, recurrence:'monthly' },
    { daysAgoN:10, category:'equipment',      description:'Hydraulic lift servicing',          amount:4500,  gstRate:18, paymentMode:'cash' },
    { daysAgoN:15, category:'electricity',    description:'Electricity bill — June',           amount:7200,  gstRate:0,  paymentMode:'upi',    isRecurring:true, recurrence:'monthly' },
    { daysAgoN:18, category:'technician',     description:'Contract technician payment',       amount:8000,  gstRate:0,  paymentMode:'cash' },
  ])

  // ── Hotel ──────────────────────────────────────────────────────────────────────
  const hotel = await getBranchUser('t_hotel_surya_palace')
  await insertExpenses('t_hotel_surya_palace', hotel.branchId, hotel.userId, [
    { daysAgoN:1,  category:'food_purchase',  description:'F&B purchase — daily vendor',       amount:12000, gstRate:5,  paymentMode:'cash' },
    { daysAgoN:3,  category:'housekeeping',   description:'Housekeeping chemicals & supplies', amount:4500,  gstRate:18, paymentMode:'cash' },
    { daysAgoN:5,  category:'rent',           description:'Hotel building EMI — June',         amount:85000, gstRate:0,  paymentMode:'bank',   isRecurring:true, recurrence:'monthly' },
    { daysAgoN:7,  category:'staff',          description:'Staff salaries — June',             amount:120000,gstRate:0,  paymentMode:'bank',   isRecurring:true, recurrence:'monthly' },
    { daysAgoN:10, category:'ota_commission', description:'MakeMyTrip commission — May',       amount:18000, gstRate:18, paymentMode:'bank',   referenceNo:'MMT-MAY2025' },
    { daysAgoN:12, category:'laundry',        description:'Linen washing — outsourced',        amount:6800,  gstRate:5,  paymentMode:'bank' },
    { daysAgoN:15, category:'electricity',    description:'Electricity bill — June',           amount:42000, gstRate:0,  paymentMode:'bank',   isRecurring:true, recurrence:'monthly' },
    { daysAgoN:18, category:'amenities',      description:'Guest toiletries restock',          amount:3200,  gstRate:18, paymentMode:'cash' },
  ])

  // ── Petrol Pump ────────────────────────────────────────────────────────────────
  const pump = await getBranchUser('t_om_petroleum')
  await insertExpenses('t_om_petroleum', pump.branchId, pump.userId, [
    { daysAgoN:1,  category:'fuel_purchase',  description:'HPCL petrol supply — 8000L',       amount:773760,gstRate:0,  paymentMode:'bank',   referenceNo:'HPCL-ORD-20250623' },
    { daysAgoN:2,  category:'fuel_purchase',  description:'HPCL diesel supply — 12000L',      amount:1075440,gstRate:0, paymentMode:'bank',   referenceNo:'HPCL-ORD-20250622' },
    { daysAgoN:5,  category:'dso_charges',    description:'DSO charges & dealer margin deduct',amount:12000, gstRate:18, paymentMode:'bank' },
    { daysAgoN:7,  category:'staff',          description:'Pump attendant salaries — June',   amount:28000, gstRate:0,  paymentMode:'cash',   isRecurring:true, recurrence:'monthly' },
    { daysAgoN:10, category:'calibration',    description:'Weights & measures nozzle check',  amount:2500,  gstRate:18, paymentMode:'cash',   isRecurring:true, recurrence:'yearly' },
    { daysAgoN:12, category:'lube_purchase',  description:'Castrol & Shell lubricants stock', amount:18000, gstRate:18, paymentMode:'bank' },
    { daysAgoN:15, category:'electricity',    description:'Electricity — pumps + canopy',     amount:14000, gstRate:0,  paymentMode:'bank',   isRecurring:true, recurrence:'monthly' },
    { daysAgoN:20, category:'maintenance',    description:'Canopy light & signage repair',    amount:3500,  gstRate:18, paymentMode:'cash' },
  ])

  // ── Coaching Center ────────────────────────────────────────────────────────────
  const coaching = await getBranchUser('t_success_coaching')
  await insertExpenses('t_success_coaching', coaching.branchId, coaching.userId, [
    { daysAgoN:1,  category:'faculty',        description:'Faculty payment — June (3 teachers)',amount:45000,gstRate:0,  paymentMode:'bank',   isRecurring:true, recurrence:'monthly' },
    { daysAgoN:3,  category:'study_material', description:'Printed notes printing charges',   amount:8500,  gstRate:12, paymentMode:'cash' },
    { daysAgoN:5,  category:'rent',           description:'Institute rent — June',             amount:25000, gstRate:18, paymentMode:'bank',   isRecurring:true, recurrence:'monthly' },
    { daysAgoN:7,  category:'online_tools',   description:'Zoom + Google Workspace plan',     amount:3999,  gstRate:18, paymentMode:'upi',    isRecurring:true, recurrence:'monthly' },
    { daysAgoN:10, category:'electricity',    description:'Electricity bill — June',           amount:5800,  gstRate:0,  paymentMode:'upi',    isRecurring:true, recurrence:'monthly' },
    { daysAgoN:15, category:'exam_fees',      description:'CBSE affiliation renewal',          amount:12000, gstRate:0,  paymentMode:'bank',   isRecurring:true, recurrence:'yearly' },
    { daysAgoN:20, category:'misc',           description:'Whiteboard markers & stationery',  amount:1200,  gstRate:18, paymentMode:'cash' },
  ])

  // ── Sweet Shop ─────────────────────────────────────────────────────────────────
  const sweet = await getBranchUser('t_madhuram_sweets')
  await insertExpenses('t_madhuram_sweets', sweet.branchId, sweet.userId, [
    { daysAgoN:1,  category:'raw_material',   description:'Milk, khoya & dairy — daily',      amount:8000,  gstRate:5,  paymentMode:'cash' },
    { daysAgoN:2,  category:'raw_material',   description:'Sugar, maida, ghee — weekly stock',amount:12000, gstRate:5,  paymentMode:'cash' },
    { daysAgoN:3,  category:'gas_lpg',        description:'Commercial LPG cylinder × 6',      amount:5400,  gstRate:5,  paymentMode:'cash' },
    { daysAgoN:5,  category:'rent',           description:'Shop rent — June',                  amount:22000, gstRate:18, paymentMode:'bank',   isRecurring:true, recurrence:'monthly' },
    { daysAgoN:7,  category:'staff',          description:'Halwai & helper salaries — June',  amount:32000, gstRate:0,  paymentMode:'cash',   isRecurring:true, recurrence:'monthly' },
    { daysAgoN:10, category:'packaging',      description:'Boxes & decorative packaging',     amount:4500,  gstRate:12, paymentMode:'cash' },
    { daysAgoN:15, category:'wastage',        description:'Unsold perishable write-off',      amount:2200,  gstRate:0,  paymentMode:'cash' },
    { daysAgoN:20, category:'electricity',    description:'Electricity bill — June',           amount:6800,  gstRate:0,  paymentMode:'upi',    isRecurring:true, recurrence:'monthly' },
  ])

  // ── Catering ───────────────────────────────────────────────────────────────────
  const catering = await getBranchUser('t_annapurna_catering')
  await insertExpenses('t_annapurna_catering', catering.branchId, catering.userId, [
    { daysAgoN:1,  category:'raw_material',   description:'Vegetables & grocery — event prep',amount:15000, gstRate:0,  paymentMode:'cash' },
    { daysAgoN:2,  category:'raw_material',   description:'Paneer, ghee, dairy',              amount:9000,  gstRate:5,  paymentMode:'cash' },
    { daysAgoN:3,  category:'gas_lpg',        description:'LPG cylinders × 10 for events',   amount:9000,  gstRate:5,  paymentMode:'cash' },
    { daysAgoN:5,  category:'staff_wages',    description:'Event staff wages — 2 events',     amount:18000, gstRate:0,  paymentMode:'cash' },
    { daysAgoN:7,  category:'equipment_hire', description:'Utensils & tent hire — wedding',   amount:8500,  gstRate:18, paymentMode:'cash' },
    { daysAgoN:10, category:'transport',      description:'Truck transport to event venue',   amount:3500,  gstRate:5,  paymentMode:'cash' },
    { daysAgoN:15, category:'rent',           description:'Kitchen space rent — June',        amount:12000, gstRate:18, paymentMode:'bank',   isRecurring:true, recurrence:'monthly' },
    { daysAgoN:20, category:'packaging',      description:'Disposable plates & containers',   amount:2800,  gstRate:18, paymentMode:'cash' },
  ])

  // ── Tiffin ─────────────────────────────────────────────────────────────────────
  const tiffin = await getBranchUser('t_ghar_jaisa_tiffin')
  await insertExpenses('t_ghar_jaisa_tiffin', tiffin.branchId, tiffin.userId, [
    { daysAgoN:1,  category:'raw_material',   description:'Daily sabzi & grocery market',     amount:3200,  gstRate:0,  paymentMode:'cash' },
    { daysAgoN:2,  category:'raw_material',   description:'Dal, rice, atta — weekly bulk',    amount:5500,  gstRate:5,  paymentMode:'cash' },
    { daysAgoN:3,  category:'gas_lpg',        description:'LPG cylinder × 2',                amount:1800,  gstRate:5,  paymentMode:'cash' },
    { daysAgoN:5,  category:'containers',     description:'Steel tiffin containers (20 pcs)', amount:3000,  gstRate:12, paymentMode:'cash' },
    { daysAgoN:7,  category:'delivery',       description:'Delivery boy salary — June',       amount:10000, gstRate:0,  paymentMode:'cash',   isRecurring:true, recurrence:'monthly' },
    { daysAgoN:10, category:'rent',           description:'Kitchen rent — June',              amount:8000,  gstRate:18, paymentMode:'bank',   isRecurring:true, recurrence:'monthly' },
    { daysAgoN:15, category:'electricity',    description:'Electricity bill — June',           amount:2200,  gstRate:0,  paymentMode:'upi',    isRecurring:true, recurrence:'monthly' },
  ])

  // ── Gym ─────────────────────────────────────────────────────────────────────────
  const gym = await getBranchUser('t_fitzone_gym')
  await insertExpenses('t_fitzone_gym', gym.branchId, gym.userId, [
    { daysAgoN:2,  category:'equipment',      description:'Treadmill annual maintenance',      amount:8000,  gstRate:18, paymentMode:'bank' },
    { daysAgoN:5,  category:'rent',           description:'Gym rent — June',                  amount:40000, gstRate:18, paymentMode:'bank',   isRecurring:true, recurrence:'monthly' },
    { daysAgoN:7,  category:'staff',          description:'Staff & trainer salaries — June',  amount:55000, gstRate:0,  paymentMode:'bank',   isRecurring:true, recurrence:'monthly' },
    { daysAgoN:10, category:'supplements',    description:'Protein & supplement stock',       amount:22000, gstRate:18, paymentMode:'bank' },
    { daysAgoN:12, category:'electricity',    description:'Electricity bill — June (AC+equip)',amount:18000,gstRate:0,  paymentMode:'bank',   isRecurring:true, recurrence:'monthly' },
    { daysAgoN:15, category:'software',       description:'Gym management software sub',      amount:2999,  gstRate:18, paymentMode:'upi',    isRecurring:true, recurrence:'monthly' },
    { daysAgoN:20, category:'trainer',        description:'Guest trainer session fee',         amount:5000,  gstRate:0,  paymentMode:'cash' },
  ])

  // ── Diagnostic Lab ─────────────────────────────────────────────────────────────
  const lab = await getBranchUser('t_apex_diagnostics')
  await insertExpenses('t_apex_diagnostics', lab.branchId, lab.userId, [
    { daysAgoN:1,  category:'reagents',       description:'Abbott reagents monthly kit',       amount:35000, gstRate:12, paymentMode:'bank',   referenceNo:'ABB-2025-0623' },
    { daysAgoN:3,  category:'collection',     description:'Home collection phlebotomist wages',amount:12000,gstRate:0,  paymentMode:'cash',   isRecurring:true, recurrence:'monthly' },
    { daysAgoN:5,  category:'rent',           description:'Lab premises rent — June',          amount:28000, gstRate:18, paymentMode:'bank',   isRecurring:true, recurrence:'monthly' },
    { daysAgoN:7,  category:'outsource',      description:'MRI outsource partner — May settl.',amount:22000,gstRate:18, paymentMode:'bank',   referenceNo:'MRI-MAY-2025' },
    { daysAgoN:10, category:'equipment',      description:'Analyser calibration & service',   amount:6500,  gstRate:18, paymentMode:'bank' },
    { daysAgoN:12, category:'staff',          description:'Lab staff salaries — June',        amount:48000, gstRate:0,  paymentMode:'bank',   isRecurring:true, recurrence:'monthly' },
    { daysAgoN:15, category:'licence',        description:'NABL accreditation renewal fee',   amount:25000, gstRate:0,  paymentMode:'bank',   isRecurring:true, recurrence:'yearly' },
    { daysAgoN:18, category:'electricity',    description:'Electricity bill — June',           amount:12000, gstRate:0,  paymentMode:'bank',   isRecurring:true, recurrence:'monthly' },
  ])

  // ── Repair Shop ────────────────────────────────────────────────────────────────
  const repair = await getBranchUser('t_techfix_repair')
  await insertExpenses('t_techfix_repair', repair.branchId, repair.userId, [
    { daysAgoN:1,  category:'parts_purchase', description:'iPhone display & battery stock',   amount:28000, gstRate:18, paymentMode:'bank' },
    { daysAgoN:3,  category:'parts_purchase', description:'Samsung & Redmi spare parts',      amount:15000, gstRate:18, paymentMode:'bank' },
    { daysAgoN:5,  category:'rent',           description:'Shop rent — June',                 amount:12000, gstRate:18, paymentMode:'bank',   isRecurring:true, recurrence:'monthly' },
    { daysAgoN:7,  category:'technician',     description:'Contract technician payment',       amount:15000, gstRate:0,  paymentMode:'cash' },
    { daysAgoN:10, category:'tools',          description:'Soldering station + hot gun',      amount:4500,  gstRate:18, paymentMode:'cash' },
    { daysAgoN:15, category:'electricity',    description:'Electricity bill — June',           amount:2800,  gstRate:0,  paymentMode:'upi',    isRecurring:true, recurrence:'monthly' },
  ])

  // ── Wholesale ─────────────────────────────────────────────────────────────────
  const ws = await getBranchUser('t_krishna_wholesale')
  await insertExpenses('t_krishna_wholesale', ws.branchId, ws.userId, [
    { daysAgoN:1,  category:'purchases',      description:'Basmati rice bulk order — 5MT',   amount:140000,gstRate:5,  paymentMode:'bank',   referenceNo:'PO-2025-WS-221' },
    { daysAgoN:3,  category:'freight',        description:'Truck freight charges',             amount:8500,  gstRate:5,  paymentMode:'cash' },
    { daysAgoN:5,  category:'rent',           description:'Godown rent — June',               amount:22000, gstRate:18, paymentMode:'bank',   isRecurring:true, recurrence:'monthly' },
    { daysAgoN:7,  category:'staff',          description:'Salesman + helper salaries',       amount:35000, gstRate:0,  paymentMode:'bank',   isRecurring:true, recurrence:'monthly' },
    { daysAgoN:10, category:'loading',        description:'Loading/unloading labour',          amount:3200,  gstRate:0,  paymentMode:'cash' },
    { daysAgoN:12, category:'eway_bill',      description:'E-way bill portal charges',        amount:500,   gstRate:18, paymentMode:'upi' },
    { daysAgoN:15, category:'electricity',    description:'Electricity bill — godown',        amount:7500,  gstRate:0,  paymentMode:'upi',    isRecurring:true, recurrence:'monthly' },
  ])

  // ── Clinic ────────────────────────────────────────────────────────────────────
  const clinic = await getBranchUser('t_sunrise_clinic')
  await insertExpenses('t_sunrise_clinic', clinic.branchId, clinic.userId, [
    { daysAgoN:1,  category:'medical_supplies',description:'Disposable syringes & gloves',   amount:5500,  gstRate:12, paymentMode:'cash' },
    { daysAgoN:3,  category:'lab_outsource',   description:'ECG & X-ray outsource — May',    amount:12000, gstRate:0,  paymentMode:'bank' },
    { daysAgoN:5,  category:'rent',            description:'Clinic rent — June',              amount:25000, gstRate:18, paymentMode:'bank',   isRecurring:true, recurrence:'monthly' },
    { daysAgoN:7,  category:'staff',           description:'Nurse & receptionist salaries',  amount:30000, gstRate:0,  paymentMode:'bank',   isRecurring:true, recurrence:'monthly' },
    { daysAgoN:10, category:'equipment',       description:'Stethoscope + BP apparatus',     amount:3800,  gstRate:12, paymentMode:'cash' },
    { daysAgoN:12, category:'licence',         description:'PCPNDT registration renewal',    amount:8000,  gstRate:0,  paymentMode:'bank',   isRecurring:true, recurrence:'yearly' },
    { daysAgoN:15, category:'electricity',     description:'Electricity bill — June',         amount:6500,  gstRate:0,  paymentMode:'upi',    isRecurring:true, recurrence:'monthly' },
  ])

  // ── Textile ───────────────────────────────────────────────────────────────────
  const textile = await getBranchUser('t_anand_textiles')
  await insertExpenses('t_anand_textiles', textile.branchId, textile.userId, [
    { daysAgoN:1,  category:'fabric_purchase', description:'Surat cotton fabric — 500m',      amount:45000, gstRate:5,  paymentMode:'bank',   referenceNo:'FAB-2025-SS441' },
    { daysAgoN:3,  category:'fabric_purchase', description:'Silk fabric purchase',             amount:28000, gstRate:5,  paymentMode:'bank' },
    { daysAgoN:5,  category:'rent',            description:'Shop rent — June',                 amount:18000, gstRate:18, paymentMode:'bank',   isRecurring:true, recurrence:'monthly' },
    { daysAgoN:7,  category:'staff',           description:'Staff salaries — June',           amount:22000, gstRate:0,  paymentMode:'bank',   isRecurring:true, recurrence:'monthly' },
    { daysAgoN:10, category:'job_work',        description:'Stitching job work — 50 pieces',  amount:5000,  gstRate:5,  paymentMode:'cash' },
    { daysAgoN:15, category:'electricity',     description:'Electricity bill — June',          amount:4800,  gstRate:0,  paymentMode:'upi',    isRecurring:true, recurrence:'monthly' },
  ])

  // ── Tailoring ─────────────────────────────────────────────────────────────
  const tailoring = await getBranchUser('t_sharma_tailors')
  await insertExpenses('t_sharma_tailors', tailoring.branchId, tailoring.userId, [
    { daysAgoN:1,  category:'fabric_purchase', description:'Surat fabric — cotton & polyester blend', amount:8500,  gstRate:5,  paymentMode:'bank' },
    { daysAgoN:3,  category:'buttons_zip',    description:'Buttons, zippers, lining material',     amount:1200,  gstRate:18, paymentMode:'cash' },
    { daysAgoN:5,  category:'rent',           description:'Shop rent — June',                       amount:8000,  gstRate:0,  paymentMode:'bank', isRecurring:true, recurrence:'monthly' },
    { daysAgoN:7,  category:'staff',          description:'Helper tailor salary — June',            amount:10000, gstRate:0,  paymentMode:'cash', isRecurring:true, recurrence:'monthly' },
    { daysAgoN:10, category:'machine',        description:'Industrial sewing machine service',      amount:1800,  gstRate:18, paymentMode:'cash' },
    { daysAgoN:15, category:'electricity',    description:'Electricity bill — June',                amount:2200,  gstRate:0,  paymentMode:'upi',  isRecurring:true, recurrence:'monthly' },
  ])

  // ── CA Firm ───────────────────────────────────────────────────────────────
  const caFirm = await getBranchUser('t_mehta_associates_ca')
  await insertExpenses('t_mehta_associates_ca', caFirm.branchId, caFirm.userId, [
    { daysAgoN:1,  category:'software',       description:'Tally Prime + GST filing software',     amount:12000, gstRate:18, paymentMode:'bank', isRecurring:true, recurrence:'yearly' },
    { daysAgoN:3,  category:'govt_fees',      description:'MCA portal fees — ROC filing',          amount:5000,  gstRate:0,  paymentMode:'bank' },
    { daysAgoN:5,  category:'rent',           description:'Office rent — June',                    amount:15000, gstRate:18, paymentMode:'bank', isRecurring:true, recurrence:'monthly' },
    { daysAgoN:7,  category:'staff',          description:'Article clerk stipend — June',          amount:8000,  gstRate:0,  paymentMode:'bank', isRecurring:true, recurrence:'monthly' },
    { daysAgoN:10, category:'professional',   description:'Outsourced advocate fees — litigation', amount:5000,  gstRate:18, paymentMode:'bank' },
    { daysAgoN:15, category:'stationery',     description:'Printing & stationery — client reports',amount:1500,  gstRate:18, paymentMode:'cash' },
    { daysAgoN:20, category:'electricity',    description:'Electricity bill — June',               amount:2800,  gstRate:0,  paymentMode:'upi',  isRecurring:true, recurrence:'monthly' },
  ])

  // ── Gas Agency ────────────────────────────────────────────────────────────
  const gasAgency = await getBranchUser('t_om_gas_agency')
  await insertExpenses('t_om_gas_agency', gasAgency.branchId, gasAgency.userId, [
    { daysAgoN:1,  category:'cylinder_purchase',description:'BPCL cylinder stock — monthly',      amount:280000,gstRate:5,  paymentMode:'bank', referenceNo:'BPCL-JUN-2025' },
    { daysAgoN:3,  category:'delivery',         description:'Delivery vehicle diesel — June',     amount:12000, gstRate:5,  paymentMode:'cash' },
    { daysAgoN:5,  category:'omc_charges',      description:'OMC depot handling charges',         amount:3500,  gstRate:18, paymentMode:'bank' },
    { daysAgoN:7,  category:'staff',            description:'Delivery staff salaries — June',     amount:18000, gstRate:0,  paymentMode:'cash', isRecurring:true, recurrence:'monthly' },
    { daysAgoN:10, category:'cylinder_repair',  description:'Cylinder safety check & valve fix',  amount:2200,  gstRate:18, paymentMode:'cash' },
    { daysAgoN:15, category:'electricity',      description:'Electricity bill — godown',          amount:1800,  gstRate:0,  paymentMode:'upi',  isRecurring:true, recurrence:'monthly' },
  ])

  // ── Event Management ──────────────────────────────────────────────────────
  const eventMgmt = await getBranchUser('t_celebrations_events')
  await insertExpenses('t_celebrations_events', eventMgmt.branchId, eventMgmt.userId, [
    { daysAgoN:1,  category:'rental_inventory',description:'Rental décor items purchase',          amount:25000, gstRate:18, paymentMode:'bank' },
    { daysAgoN:3,  category:'vendor_payment',  description:'DJ vendor payment — June events',      amount:18000, gstRate:18, paymentMode:'cash' },
    { daysAgoN:5,  category:'transport',       description:'Transport / truck loading — events',   amount:8500,  gstRate:5,  paymentMode:'cash' },
    { daysAgoN:7,  category:'labour',          description:'Setup crew wages — 3 events',          amount:22000, gstRate:0,  paymentMode:'cash' },
    { daysAgoN:10, category:'rent',            description:'Storage godown rent — June',           amount:12000, gstRate:18, paymentMode:'bank', isRecurring:true, recurrence:'monthly' },
    { daysAgoN:12, category:'equipment_repair',description:'Generator repair',                     amount:3500,  gstRate:18, paymentMode:'cash' },
    { daysAgoN:15, category:'electricity',     description:'Electricity bill — office',            amount:3200,  gstRate:0,  paymentMode:'upi',  isRecurring:true, recurrence:'monthly' },
  ])

  // ── Veterinary ────────────────────────────────────────────────────────────
  const vet = await getBranchUser('t_petcare_vet_clinic')
  await insertExpenses('t_petcare_vet_clinic', vet.branchId, vet.userId, [
    { daysAgoN:1,  category:'medicine_purchase',description:'Virbac vaccines & medicines monthly', amount:18000, gstRate:12, paymentMode:'bank' },
    { daysAgoN:3,  category:'pet_food',         description:'Hill\'s pet food stock',              amount:6500,  gstRate:18, paymentMode:'bank' },
    { daysAgoN:5,  category:'rent',             description:'Clinic rent — June',                  amount:14000, gstRate:18, paymentMode:'bank', isRecurring:true, recurrence:'monthly' },
    { daysAgoN:7,  category:'staff',            description:'Vet assistant salary — June',         amount:12000, gstRate:0,  paymentMode:'bank', isRecurring:true, recurrence:'monthly' },
    { daysAgoN:10, category:'equipment',        description:'Stethoscope & thermometer set',       amount:3800,  gstRate:12, paymentMode:'cash' },
    { daysAgoN:15, category:'licence',          description:'VCI registration renewal',             amount:5000,  gstRate:0,  paymentMode:'bank', isRecurring:true, recurrence:'yearly' },
    { daysAgoN:20, category:'electricity',      description:'Electricity bill — June',              amount:2500,  gstRate:0,  paymentMode:'upi',  isRecurring:true, recurrence:'monthly' },
  ])

  // ── Milk Dairy ────────────────────────────────────────────────────────────
  const milkDairy = await getBranchUser('t_gokul_milk_dairy')
  await insertExpenses('t_gokul_milk_dairy', milkDairy.branchId, milkDairy.userId, [
    { daysAgoN:1,  category:'milk_purchase',  description:'Raw milk procurement — 500L/day × 30', amount:57000, gstRate:0,  paymentMode:'bank', referenceNo:'GCMMF-JUN-25' },
    { daysAgoN:3,  category:'packaging',      description:'Pouches & HDPE bottles — monthly stock',amount:8500, gstRate:12, paymentMode:'cash' },
    { daysAgoN:5,  category:'delivery',       description:'Delivery route expenses — 4 routes',    amount:6000,  gstRate:5,  paymentMode:'cash' },
    { daysAgoN:7,  category:'chilling',       description:'Cold room electricity & maintenance',    amount:4500,  gstRate:0,  paymentMode:'upi' },
    { daysAgoN:10, category:'testing',        description:'Fat-SNF testing lab charges',            amount:1200,  gstRate:12, paymentMode:'cash' },
    { daysAgoN:15, category:'staff',          description:'Staff salaries — June',                  amount:22000, gstRate:0,  paymentMode:'bank', isRecurring:true, recurrence:'monthly' },
  ])

  // ── Banquet Hall ──────────────────────────────────────────────────────────
  const banquet = await getBranchUser('t_shree_banquet_hall')
  await insertExpenses('t_shree_banquet_hall', banquet.branchId, banquet.userId, [
    { daysAgoN:1,  category:'maintenance',    description:'Hall AC servicing — pre-season',        amount:8500,  gstRate:18, paymentMode:'cash' },
    { daysAgoN:3,  category:'electricity',    description:'Electricity + DG diesel — June',        amount:28000, gstRate:0,  paymentMode:'bank', isRecurring:true, recurrence:'monthly' },
    { daysAgoN:5,  category:'housekeeping',   description:'Cleaning chemicals & housekeeping',     amount:4500,  gstRate:18, paymentMode:'cash' },
    { daysAgoN:7,  category:'furniture',      description:'New banquet chairs (50 pcs)',            amount:22000, gstRate:18, paymentMode:'bank' },
    { daysAgoN:10, category:'catering_outside',description:'Outside caterer commission — May',    amount:12000, gstRate:5,  paymentMode:'bank' },
    { daysAgoN:15, category:'staff',          description:'Hall staff salaries — June',            amount:35000, gstRate:0,  paymentMode:'bank', isRecurring:true, recurrence:'monthly' },
    { daysAgoN:20, category:'rent',           description:'Property EMI — June',                   amount:55000, gstRate:0,  paymentMode:'bank', isRecurring:true, recurrence:'monthly' },
  ])

  // ── Real Estate ───────────────────────────────────────────────────────────
  const realEstate = await getBranchUser('t_prime_property_baroda')
  await insertExpenses('t_prime_property_baroda', realEstate.branchId, realEstate.userId, [
    { daysAgoN:1,  category:'property_tax',   description:'Municipal property tax — Q2',          amount:12000, gstRate:0,  paymentMode:'bank' },
    { daysAgoN:3,  category:'maintenance',    description:'Managed property plumbing repair',      amount:5500,  gstRate:18, paymentMode:'cash' },
    { daysAgoN:5,  category:'brokerage_paid', description:'Sub-broker commission — May',           amount:8000,  gstRate:18, paymentMode:'bank' },
    { daysAgoN:7,  category:'rent',           description:'Office rent — June',                    amount:10000, gstRate:18, paymentMode:'bank', isRecurring:true, recurrence:'monthly' },
    { daysAgoN:10, category:'legal',          description:'Sale deed registration assistance fee', amount:3000,  gstRate:18, paymentMode:'bank' },
    { daysAgoN:15, category:'staff',          description:'Staff salary — June',                   amount:18000, gstRate:0,  paymentMode:'bank', isRecurring:true, recurrence:'monthly' },
  ])

  // ── Water Supplier ────────────────────────────────────────────────────────
  const waterSupplier = await getBranchUser('t_jal_ro_water_supply')
  await insertExpenses('t_jal_ro_water_supply', waterSupplier.branchId, waterSupplier.userId, [
    { daysAgoN:1,  category:'ro_filter',      description:'RO membrane & filter replacement',      amount:5500,  gstRate:18, paymentMode:'bank' },
    { daysAgoN:3,  category:'can_purchase',   description:'New 20L water cans (50 pcs)',            amount:7500,  gstRate:18, paymentMode:'cash' },
    { daysAgoN:5,  category:'delivery',       description:'Delivery vehicle diesel — June',        amount:4000,  gstRate:5,  paymentMode:'cash' },
    { daysAgoN:7,  category:'maintenance',    description:'RO plant servicing — annual',           amount:3000,  gstRate:18, paymentMode:'bank' },
    { daysAgoN:10, category:'staff',          description:'Delivery staff wages — June',            amount:8000,  gstRate:0,  paymentMode:'cash', isRecurring:true, recurrence:'monthly' },
    { daysAgoN:15, category:'electricity',    description:'Electricity bill — plant',              amount:2200,  gstRate:0,  paymentMode:'upi',  isRecurring:true, recurrence:'monthly' },
  ])

  // ── Driving School ────────────────────────────────────────────────────────
  const drivingSchool = await getBranchUser('t_national_driving_school')
  await insertExpenses('t_national_driving_school', drivingSchool.branchId, drivingSchool.userId, [
    { daysAgoN:1,  category:'fuel',           description:'Fuel — training vehicles × 3',         amount:8500,  gstRate:5,  paymentMode:'cash' },
    { daysAgoN:3,  category:'vehicle_service',description:'Car service & oil change',              amount:4500,  gstRate:18, paymentMode:'cash' },
    { daysAgoN:5,  category:'vehicle_insurance',description:'Vehicle insurance premium',           amount:22000, gstRate:18, paymentMode:'bank', isRecurring:true, recurrence:'yearly' },
    { daysAgoN:7,  category:'instructor',     description:'Instructor salary — June',              amount:15000, gstRate:0,  paymentMode:'bank', isRecurring:true, recurrence:'monthly' },
    { daysAgoN:10, category:'rto_fees',       description:'RTO licence batch fees',               amount:3200,  gstRate:0,  paymentMode:'bank' },
    { daysAgoN:15, category:'rent',           description:'Office rent — June',                    amount:6000,  gstRate:18, paymentMode:'bank', isRecurring:true, recurrence:'monthly' },
  ])

  // ── Interior Contractor ───────────────────────────────────────────────────
  const interiorContractor = await getBranchUser('t_aakruti_interior_works')
  await insertExpenses('t_aakruti_interior_works', interiorContractor.branchId, interiorContractor.userId, [
    { daysAgoN:1,  category:'material',       description:'Kajaria tiles purchase — site stock',   amount:45000, gstRate:18, paymentMode:'bank', referenceNo:'KAJ-2025-1121' },
    { daysAgoN:3,  category:'labour',         description:'Labour wages — June',                   amount:32000, gstRate:0,  paymentMode:'cash' },
    { daysAgoN:5,  category:'subcontractor',  description:'Electrical subcontractor — phase 1',    amount:18000, gstRate:18, paymentMode:'bank' },
    { daysAgoN:7,  category:'tool_hire',      description:'Drill machine & cutter hire',            amount:2500,  gstRate:18, paymentMode:'cash' },
    { daysAgoN:10, category:'site_transport', description:'Site material transport — truck',        amount:4500,  gstRate:5,  paymentMode:'cash' },
    { daysAgoN:15, category:'rent',           description:'Office rent — June',                    amount:8000,  gstRate:18, paymentMode:'bank', isRecurring:true, recurrence:'monthly' },
  ])

  // ── Packers & Movers ──────────────────────────────────────────────────────
  const packersMovers = await getBranchUser('t_safemove_packers_movers')
  await insertExpenses('t_safemove_packers_movers', packersMovers.branchId, packersMovers.userId, [
    { daysAgoN:1,  category:'packing_material',description:'Corrugated boxes & bubble wrap — stock',amount:8500,gstRate:18, paymentMode:'bank' },
    { daysAgoN:3,  category:'vehicle_hire',   description:'Truck hire — 3 intercity moves',        amount:28000, gstRate:5,  paymentMode:'cash' },
    { daysAgoN:5,  category:'labour',         description:'Loading/unloading crew wages — June',   amount:15000, gstRate:0,  paymentMode:'cash' },
    { daysAgoN:7,  category:'insurance',      description:'Transit insurance premium — monthly',    amount:5000,  gstRate:18, paymentMode:'bank' },
    { daysAgoN:10, category:'rent',           description:'Office / godown rent — June',           amount:10000, gstRate:18, paymentMode:'bank', isRecurring:true, recurrence:'monthly' },
    { daysAgoN:15, category:'staff',          description:'Staff salaries — June',                  amount:18000, gstRate:0,  paymentMode:'bank', isRecurring:true, recurrence:'monthly' },
  ])

  // ── Security Agency ───────────────────────────────────────────────────────
  const securityAgency = await getBranchUser('t_shieldguard_security')
  await insertExpenses('t_shieldguard_security', securityAgency.branchId, securityAgency.userId, [
    { daysAgoN:1,  category:'guard_salary',   description:'Guard salaries (12 guards) — June',    amount:120000,gstRate:0,  paymentMode:'bank', isRecurring:true, recurrence:'monthly' },
    { daysAgoN:3,  category:'pf_esic',        description:'PF + ESIC employer contribution — June',amount:18000,gstRate:0,  paymentMode:'bank', isRecurring:true, recurrence:'monthly' },
    { daysAgoN:5,  category:'uniform',        description:'Uniform + belt + boots — 4 new guards', amount:9600, gstRate:12, paymentMode:'bank' },
    { daysAgoN:7,  category:'training',       description:'PSAR Act refresher training',           amount:3000,  gstRate:18, paymentMode:'cash' },
    { daysAgoN:10, category:'background_check',description:'Antecedent verification — 4 guards',  amount:2000,  gstRate:18, paymentMode:'bank' },
    { daysAgoN:15, category:'rent',           description:'Office rent — June',                    amount:8000,  gstRate:18, paymentMode:'bank', isRecurring:true, recurrence:'monthly' },
  ])

  // ── Crèche / Daycare ──────────────────────────────────────────────────────
  const crèche = await getBranchUser('t_tiny_tots_daycare')
  await insertExpenses('t_tiny_tots_daycare', crèche.branchId, crèche.userId, [
    { daysAgoN:1,  category:'meals',          description:'Daily meal & snack purchase — June',    amount:12000, gstRate:0,  paymentMode:'cash' },
    { daysAgoN:3,  category:'toys_supplies',  description:'Activity toys & craft supplies',        amount:3500,  gstRate:18, paymentMode:'bank' },
    { daysAgoN:5,  category:'staff_salary',   description:'Caretaker & staff salaries — June',    amount:28000, gstRate:0,  paymentMode:'bank', isRecurring:true, recurrence:'monthly' },
    { daysAgoN:7,  category:'rent',           description:'Premises rent — June',                  amount:18000, gstRate:18, paymentMode:'bank', isRecurring:true, recurrence:'monthly' },
    { daysAgoN:10, category:'hygiene',        description:'Diapers, sanitisers, cleaning supplies',amount:4200, gstRate:18, paymentMode:'cash' },
    { daysAgoN:15, category:'electricity',    description:'Electricity bill — June',               amount:3800,  gstRate:0,  paymentMode:'upi',  isRecurring:true, recurrence:'monthly' },
  ])

  // ── Dance / Music School ──────────────────────────────────────────────────
  const danceMusic = await getBranchUser('t_rhythm_academy_baroda')
  await insertExpenses('t_rhythm_academy_baroda', danceMusic.branchId, danceMusic.userId, [
    { daysAgoN:1,  category:'faculty',        description:'Faculty payments — June (3 teachers)',  amount:30000, gstRate:0,  paymentMode:'bank', isRecurring:true, recurrence:'monthly' },
    { daysAgoN:3,  category:'instruments',    description:'Guitar strings & accessories restock',  amount:2500,  gstRate:18, paymentMode:'cash' },
    { daysAgoN:5,  category:'studio_rent',    description:'Studio / hall rent — June',             amount:15000, gstRate:18, paymentMode:'bank', isRecurring:true, recurrence:'monthly' },
    { daysAgoN:7,  category:'costume',        description:'Bharatanatyam costumes (3 pcs)',         amount:21000, gstRate:5,  paymentMode:'bank' },
    { daysAgoN:10, category:'competition',    description:'State dance competition registration',   amount:5000,  gstRate:18, paymentMode:'bank' },
    { daysAgoN:15, category:'electricity',    description:'Electricity bill — June',               amount:2800,  gstRate:0,  paymentMode:'upi',  isRecurring:true, recurrence:'monthly' },
  ])

  // ── Footwear ──────────────────────────────────────────────────────────────
  const footwear = await getBranchUser('t_stepright_shoe_store')
  await insertExpenses('t_stepright_shoe_store', footwear.branchId, footwear.userId, [
    { daysAgoN:1,  category:'stock_purchase', description:'Bata distributor order — summer stock',  amount:55000, gstRate:18, paymentMode:'bank', referenceNo:'BATA-2025-0623' },
    { daysAgoN:3,  category:'stock_purchase', description:'Sparx sports shoes order',              amount:28000, gstRate:18, paymentMode:'bank' },
    { daysAgoN:5,  category:'display',        description:'New shoe racks & display fittings',      amount:12000, gstRate:18, paymentMode:'bank' },
    { daysAgoN:7,  category:'rent',           description:'Shop rent — June',                       amount:18000, gstRate:18, paymentMode:'bank', isRecurring:true, recurrence:'monthly' },
    { daysAgoN:10, category:'staff',          description:'Staff salary — June',                    amount:12000, gstRate:0,  paymentMode:'bank', isRecurring:true, recurrence:'monthly' },
    { daysAgoN:15, category:'electricity',    description:'Electricity bill — June',               amount:3200,  gstRate:0,  paymentMode:'upi',  isRecurring:true, recurrence:'monthly' },
  ])

  // ── Tent House ────────────────────────────────────────────────────────────
  const tentHouse = await getBranchUser('t_shubh_tent_house')
  await insertExpenses('t_shubh_tent_house', tentHouse.branchId, tentHouse.userId, [
    { daysAgoN:1,  category:'inventory_purchase',description:'New plastic chairs (200 pcs) purchase',amount:18000,gstRate:18,paymentMode:'bank' },
    { daysAgoN:3,  category:'labour',           description:'Setup & dismantling crew — June events',amount:12000,gstRate:0, paymentMode:'cash' },
    { daysAgoN:5,  category:'transport',        description:'Truck hire for delivery — June',        amount:6500,  gstRate:5,  paymentMode:'cash' },
    { daysAgoN:7,  category:'repair',           description:'Torn canopy stitching repair',           amount:2200,  gstRate:18, paymentMode:'cash' },
    { daysAgoN:10, category:'storage',          description:'Storage godown rent — June',             amount:6000,  gstRate:18, paymentMode:'bank', isRecurring:true, recurrence:'monthly' },
    { daysAgoN:15, category:'staff',            description:'Staff wages — June',                    amount:14000, gstRate:0,  paymentMode:'cash', isRecurring:true, recurrence:'monthly' },
  ])

  console.log('  ✓ expenses     seeded for 16 tenants (retail, restaurant, pharmacy, electronics, salon, jewellery, auto, hotel, petrol, coaching, sweets, catering, tiffin, gym, lab, repair, wholesale, clinic, textile)')
  console.log('  ✓ expenses     seeded for 17 new tenants (tailoring, ca_firm, gas_agency, event_mgmt, veterinary, milk_dairy, banquet_hall, real_estate, water_supplier, driving_school, interior_contractor, packers_movers, security_agency, creche_daycare, dance_music_school, footwear, tent_house)')
}

// =============================================================================
// seedExtraTables — populates batches, invoice_sequences, ai_suggestions,
// razorpay_orders across selected tenant schemas
// =============================================================================
async function seedExtraTables() {
  // ── Pharmacy: batch tracking (exp dates, lot numbers) ──────────────────────
  const pharmDb = tenantDb('t_lifeline_pharmacy')
  const PH = (i: number) => uid(34,2,i,0)
  const batchDefs = [
    { i:1, productId:PH(1), batchNo:'PCT2025A', mfgDate:daysAgo(180), expDate:futureDate(540), qtyReceived:1000, qtyRemaining:497, purchaseRate:12 },
    { i:2, productId:PH(1), batchNo:'PCT2025B', mfgDate:daysAgo(60),  expDate:futureDate(720), qtyReceived:500,  qtyRemaining:500, purchaseRate:12 },
    { i:3, productId:PH(2), batchNo:'AMX2025A', mfgDate:daysAgo(90),  expDate:futureDate(270), qtyReceived:300,  qtyRemaining:142, purchaseRate:45 },
    { i:4, productId:PH(3), batchNo:'CRN2025A', mfgDate:daysAgo(120), expDate:futureDate(600), qtyReceived:400,  qtyRemaining:196, purchaseRate:38 },
    { i:5, productId:PH(4), batchNo:'BEC2025A', mfgDate:daysAgo(30),  expDate:futureDate(730), qtyReceived:200,  qtyRemaining:98,  purchaseRate:65 },
    { i:6, productId:PH(5), batchNo:'OMP2025A', mfgDate:daysAgo(150), expDate:futureDate(215), qtyReceived:500,  qtyRemaining:294, purchaseRate:22 },
    { i:7, productId:PH(6), batchNo:'BTD2025A', mfgDate:daysAgo(45),  expDate:futureDate(680), qtyReceived:150,  qtyRemaining:79,  purchaseRate:55 },
    { i:8, productId:PH(7), batchNo:'CTZ2025A', mfgDate:daysAgo(200), expDate:futureDate(165), qtyReceived:400,  qtyRemaining:244, purchaseRate:18 },
    { i:9, productId:PH(8), batchNo:'DOL2025A', mfgDate:daysAgo(10),  expDate:futureDate(720), qtyReceived:600,  qtyRemaining:396, purchaseRate:24 },
  ]
  const pharmBranchId = uid(34,9,0,0)
  for (const b of batchDefs) {
    await pharmDb.batch.upsert({
      where: { id: uid(34,5,b.i,0) }, update: {},
      create: { id: uid(34,5,b.i,0), branchId: pharmBranchId, productId: b.productId, batchNo: b.batchNo,
                mfgDate: b.mfgDate, expDate: b.expDate,
                qtyReceived: b.qtyReceived, qtyRemaining: b.qtyRemaining,
                purchaseRate: b.purchaseRate },
    })
  }
  await pharmDb.$disconnect()

  // ── Wholesale: batches for lot tracking ────────────────────────────────────
  const wsDb = tenantDb('t_krishna_wholesale')
  const WS = (i: number) => uid(21,2,i,0)
  const wsBatches = [
    { i:1, productId:WS(1), batchNo:'RICE-LOT-JUN25', mfgDate:daysAgo(20), expDate:futureDate(365), qtyReceived:500, qtyRemaining:470, purchaseRate:1400 },
    { i:2, productId:WS(2), batchNo:'SUG-LOT-JUN25',  mfgDate:daysAgo(5),  expDate:futureDate(730), qtyReceived:300, qtyRemaining:295, purchaseRate:1900 },
    { i:3, productId:WS(3), batchNo:'ATT-LOT-JUN25',  mfgDate:daysAgo(15), expDate:futureDate(180), qtyReceived:600, qtyRemaining:585, purchaseRate:800  },
  ]
  const wsBranchId = uid(21,9,0,0)
  for (const b of wsBatches) {
    await wsDb.batch.upsert({
      where: { id: uid(21,5,b.i,0) }, update: {},
      create: { id: uid(21,5,b.i,0), branchId: wsBranchId, productId: b.productId, batchNo: b.batchNo,
                mfgDate: b.mfgDate, expDate: b.expDate,
                qtyReceived: b.qtyReceived, qtyRemaining: b.qtyRemaining,
                purchaseRate: b.purchaseRate },
    })
  }
  await wsDb.$disconnect()

  // ── Invoice sequences — all tenants ────────────────────────────────────────
  // Uses actual runtime table columns: branch_id, txn_type, fy, current_val
  const fy = new Date().getMonth() >= 3
    ? String(new Date().getFullYear()).slice(-2)
    : String(new Date().getFullYear() - 1).slice(-2)

  const tenantSeqDefs: Array<{ schema: string; branchId: string; txnType: string; currentVal: number }> = [
    // Simple domains — sale_invoice only
    { schema:'t_ramesh_kirana',        branchId:'00000001-0000-0000-0000-000000000001', txnType:'sale_invoice',     currentVal:14 },
    { schema:'t_shree_restaurant',     branchId:uid(33,9,0,0), txnType:'sale_invoice',     currentVal:6  },
    { schema:'t_lifeline_pharmacy',    branchId:uid(34,9,0,0), txnType:'sale_invoice',     currentVal:5  },
    { schema:'t_glamour_salon',        branchId:uid(20,9,0,0), txnType:'sale_invoice',     currentVal:3  },
    { schema:'t_madhuram_sweets',      branchId:uid(22,9,0,0), txnType:'sale_invoice',     currentVal:3  },
    { schema:'t_sunrise_clinic',       branchId:uid(23,9,0,0), txnType:'sale_invoice',     currentVal:3  },
    { schema:'t_hotel_surya_palace',   branchId:uid(28,9,0,0), txnType:'sale_invoice',     currentVal:3  },
    { schema:'t_success_coaching',     branchId:uid(30,9,0,0), txnType:'sale_invoice',     currentVal:3  },
    { schema:'t_sparkle_laundry',      branchId:uid(32,9,0,0), txnType:'sale_invoice',     currentVal:3  },
    // B2B domains — sale_invoice + purchase_invoice + quotation + delivery_challan
    { schema:'t_digismart_electronics',branchId:uid(35,9,0,0), txnType:'sale_invoice',     currentVal:5  },
    { schema:'t_digismart_electronics',branchId:uid(35,9,0,0), txnType:'purchase_invoice', currentVal:2  },
    { schema:'t_digismart_electronics',branchId:uid(35,9,0,0), txnType:'quotation',         currentVal:2  },
    { schema:'t_apex_distributors',    branchId:uid(36,9,0,0), txnType:'sale_invoice',     currentVal:4  },
    { schema:'t_apex_distributors',    branchId:uid(36,9,0,0), txnType:'purchase_invoice', currentVal:3  },
    { schema:'t_apex_distributors',    branchId:uid(36,9,0,0), txnType:'quotation',         currentVal:2  },
    { schema:'t_apex_distributors',    branchId:uid(36,9,0,0), txnType:'delivery_challan', currentVal:1  },
    { schema:'t_krishna_wholesale',    branchId:uid(21,9,0,0), txnType:'sale_invoice',     currentVal:3  },
    { schema:'t_krishna_wholesale',    branchId:uid(21,9,0,0), txnType:'purchase_invoice', currentVal:2  },
    { schema:'t_krishna_wholesale',    branchId:uid(21,9,0,0), txnType:'quotation',         currentVal:1  },
    { schema:'t_krishna_wholesale',    branchId:uid(21,9,0,0), txnType:'delivery_challan', currentVal:1  },
    { schema:'t_anand_textiles',       branchId:uid(27,9,0,0), txnType:'sale_invoice',     currentVal:3  },
    { schema:'t_anand_textiles',       branchId:uid(27,9,0,0), txnType:'purchase_invoice', currentVal:2  },
    { schema:'t_shubhlaxmi_jewellers', branchId:uid(25,9,0,0), txnType:'sale_invoice',     currentVal:3  },
    { schema:'t_shubhlaxmi_jewellers', branchId:uid(25,9,0,0), txnType:'purchase_invoice', currentVal:1  },
    { schema:'t_shiv_auto_works',      branchId:uid(26,9,0,0), txnType:'sale_invoice',     currentVal:3  },
    { schema:'t_shiv_auto_works',      branchId:uid(26,9,0,0), txnType:'purchase_invoice', currentVal:2  },
    { schema:'t_annapurna_catering',   branchId:uid(29,9,0,0), txnType:'sale_invoice',     currentVal:3  },
    { schema:'t_annapurna_catering',   branchId:uid(29,9,0,0), txnType:'quotation',         currentVal:1  },
    { schema:'t_perfect_printers',     branchId:uid(31,9,0,0), txnType:'sale_invoice',     currentVal:3  },
    { schema:'t_perfect_printers',     branchId:uid(31,9,0,0), txnType:'purchase_invoice', currentVal:1  },
    // purchase invoices for simple domains that buy stock
    { schema:'t_ramesh_kirana',        branchId:'00000001-0000-0000-0000-000000000001', txnType:'purchase_invoice', currentVal:3  },
    { schema:'t_lifeline_pharmacy',    branchId:uid(34,9,0,0), txnType:'purchase_invoice', currentVal:2  },
    { schema:'t_vision_plus_optical',  branchId:uid(24,9,0,0), txnType:'sale_invoice',     currentVal:3  },
  ]
  for (const s of tenantSeqDefs) {
    const sdb = tenantDb(s.schema)
    await sdb.$executeRawUnsafe(
      `INSERT INTO invoice_sequences (branch_id, txn_type, fy, current_val)
       VALUES ('${s.branchId}','${s.txnType}','${fy}',${s.currentVal})
       ON CONFLICT (branch_id, txn_type, fy) DO UPDATE SET current_val = GREATEST(invoice_sequences.current_val, EXCLUDED.current_val)`
    )
    await sdb.$disconnect()
  }

  // ── AI suggestions — a few tenants ─────────────────────────────────────────
  const aiDefs = [
    {
      schema:'t_ramesh_kirana', branchId:'00000001-0000-0000-0000-000000000001',
      hash:'low_stock_alert_20250623', suggestion:{
        type:'low_stock_alert', generated_at: new Date().toISOString(),
        items:[
          { product:'Parle-G Biscuits 800g',  current_stock:7,  low_stock_qty:15, recommended_order:50 },
          { product:'Surf Excel Easy Wash 500g',current_stock:3,low_stock_qty:10, recommended_order:30 },
          { product:'Colgate Strong Teeth 200g',current_stock:4,low_stock_qty:8,  recommended_order:20 },
        ],
        message:'3 items are below reorder level. Place purchase order soon.'
      }
    },
    {
      schema:'t_ramesh_kirana', branchId:'00000001-0000-0000-0000-000000000001',
      hash:'sales_insight_20250622', suggestion:{
        type:'sales_insight', generated_at: new Date(Date.now()-86400000).toISOString(),
        top_products:['Amul Butter 100g','Horlicks Original 500g','Fortune Sunflower Oil 1L'],
        slow_movers:['Ariel Powder 1kg','Surf Excel Easy Wash 500g'],
        message:'Amul Butter is your best-seller this week. Consider stocking Ariel in smaller variants.'
      }
    },
    {
      schema:'t_lifeline_pharmacy', branchId:uid(34,9,0,0),
      hash:'expiry_alert_20250623', suggestion:{
        type:'expiry_alert', generated_at: new Date().toISOString(),
        items:[
          { product:'Omeprazole 20mg (strip/10)', batch:'OMP2025A', expDate: futureDate(215).toISOString().split('T')[0], qty_remaining:294 },
          { product:'Cetrizine 10mg (strip/10)',  batch:'CTZ2025A', expDate: futureDate(165).toISOString().split('T')[0], qty_remaining:244 },
        ],
        message:'2 batches expire within 6 months. Run promotions or return to distributor.'
      }
    },
    {
      schema:'t_digismart_electronics', branchId:uid(35,9,0,0),
      hash:'upsell_suggestion_20250623', suggestion:{
        type:'upsell_suggestion', generated_at: new Date().toISOString(),
        trigger:'customer Arpit Desai browsed HP Laptop',
        suggestions:['Logitech MX Master 3 Mouse — frequently bought with laptops','boAt Airdopes 141 — popular add-on'],
        message:'Customer looking at HP Laptop — suggest peripherals for higher cart value.'
      }
    },
    {
      schema:'t_shree_restaurant', branchId:uid(33,9,0,0),
      hash:'menu_insight_20250622', suggestion:{
        type:'menu_insight', generated_at: new Date(Date.now()-86400000).toISOString(),
        top_dishes:['Chicken Biryani','Veg Thali','Masala Dosa'],
        low_ordered:['Gulab Jamun','Lassi (Sweet)'],
        message:'Chicken Biryani drives 35% of revenue. Bundle Gulab Jamun as a meal combo to increase average order value.'
      }
    },
  ]
  for (const a of aiDefs) {
    const adb = tenantDb(a.schema)
    await adb.$executeRawUnsafe(
      `INSERT INTO ai_suggestions (id,"branchId","inputHash",suggestion) VALUES (gen_random_uuid(),'${a.branchId}','${a.hash}','${JSON.stringify(a.suggestion).replace(/'/g,"''")}') ON CONFLICT ("branchId","inputHash") DO NOTHING`
    )
    await adb.$disconnect()
  }

  // ── Serial numbers — electronics inventory ─────────────────────────────────
  const elDb2 = tenantDb('t_digismart_electronics')
  const ELP   = (i: number) => uid(35,2,i,0)
  const elBranch = uid(35,9,0,0)

  // Find the invoice item IDs for the sold units (inv n=2 is the TV+AC order, n=3 is iPhone)
  const inv2ItemIds = await elDb2.$queryRaw<{id:string; description:string}[]>`
    SELECT id, description FROM invoice_items WHERE "invoiceId" = ${uid(35,1,2,0)}::uuid`
  const inv3ItemIds = await elDb2.$queryRaw<{id:string; description:string}[]>`
    SELECT id, description FROM invoice_items WHERE "invoiceId" = ${uid(35,1,3,0)}::uuid`

  const tvItemId   = inv2ItemIds.find(i => i.description.includes('Samsung 65'))?.id ?? null
  const acItemId   = inv2ItemIds.find(i => i.description.includes('AC'))?.id ?? null
  const iphoneItemId = inv3ItemIds.find(i => i.description.includes('iPhone'))?.id ?? null

  const serialDefs: Array<{
    productId: string; serialNo: string; imei?: string; imei2?: string
    status: string; invoiceItemId: string | null; soldAt: Date | null
    warrantyMonths: number; warrantyExpiresAt: Date | null
    customerName: string | null; customerPhone: string | null; notes: string | null
  }> = [
    // Samsung TV units — 2 sold, 6 in stock
    { productId:ELP(1), serialNo:'SAM-TV-SN-001', status:'sold',     invoiceItemId:tvItemId,  soldAt:daysAgo(5), warrantyMonths:12, warrantyExpiresAt:futureDate(360), customerName:'Arpit Desai',     customerPhone:'9712343002', imei:null, imei2:null, notes:null },
    { productId:ELP(1), serialNo:'SAM-TV-SN-002', status:'in_stock', invoiceItemId:null,      soldAt:null,       warrantyMonths:12, warrantyExpiresAt:null,            customerName:null,             customerPhone:null,         imei:null, imei2:null, notes:null },
    { productId:ELP(1), serialNo:'SAM-TV-SN-003', status:'in_stock', invoiceItemId:null,      soldAt:null,       warrantyMonths:12, warrantyExpiresAt:null,            customerName:null,             customerPhone:null,         imei:null, imei2:null, notes:null },

    // iPhone units — 1 partial (awaiting full payment), 11 in stock
    { productId:ELP(2), serialNo:'APL-15-IMEI-356901101234567', imei:'356901101234567', imei2:'356901101234568', status:'sold', invoiceItemId:iphoneItemId, soldAt:daysAgo(3), warrantyMonths:12, warrantyExpiresAt:futureDate(362), customerName:'Jayesh Shah', customerPhone:'9712343001', notes:null },
    { productId:ELP(2), serialNo:'APL-15-IMEI-356901109876543', imei:'356901109876543', imei2:null,              status:'in_stock', invoiceItemId:null, soldAt:null, warrantyMonths:12, warrantyExpiresAt:null, customerName:null, customerPhone:null, notes:null },
    { productId:ELP(2), serialNo:'APL-15-IMEI-356901105551234', imei:'356901105551234', imei2:null,              status:'in_stock', invoiceItemId:null, soldAt:null, warrantyMonths:12, warrantyExpiresAt:null, customerName:null, customerPhone:null, notes:null },

    // HP Laptop units
    { productId:ELP(3), serialNo:'HP-LAP-SN-5CG2034XTB', status:'in_stock', invoiceItemId:null, soldAt:null, warrantyMonths:12, warrantyExpiresAt:null, customerName:null, customerPhone:null, imei:null, imei2:null, notes:null },
    { productId:ELP(3), serialNo:'HP-LAP-SN-5CG2034XTC', status:'in_stock', invoiceItemId:null, soldAt:null, warrantyMonths:12, warrantyExpiresAt:null, customerName:null, customerPhone:null, imei:null, imei2:null, notes:null },

    // Samsung AC — 1 sold with the TV order, 4 in stock
    { productId:ELP(6), serialNo:'SAM-AC-SN-A4G8T001',  status:'sold',     invoiceItemId:acItemId, soldAt:daysAgo(5), warrantyMonths:60, warrantyExpiresAt:futureDate(1820), customerName:'Arpit Desai', customerPhone:'9712343002', imei:null, imei2:null, notes:'Includes 5-year Samsung warranty' },
    { productId:ELP(6), serialNo:'SAM-AC-SN-A4G8T002',  status:'in_stock', invoiceItemId:null,     soldAt:null,       warrantyMonths:60, warrantyExpiresAt:null,             customerName:null,         customerPhone:null,         imei:null, imei2:null, notes:null },

    // Old unit marked defective (returned)
    { productId:ELP(2), serialNo:'APL-15-IMEI-DEFECTIVE001', imei:'356901100000001', imei2:null, status:'defective', invoiceItemId:null, soldAt:null, warrantyMonths:12, warrantyExpiresAt:null, customerName:null, customerPhone:null, notes:'Dead on arrival — returned to Ingram Micro' },
  ]

  for (const s of serialDefs) {
    await elDb2.$executeRawUnsafe(`
      INSERT INTO serial_numbers (id,"branchId","productId","serialNo",imei,imei2,status,"invoiceItemId","soldAt","warrantyMonths","warrantyExpiresAt","customerName","customerPhone",notes)
      VALUES (
        gen_random_uuid(),
        '${elBranch}',
        '${s.productId}',
        '${s.serialNo}',
        ${s.imei       ? `'${s.imei}'`               : 'NULL'},
        ${s.imei2      ? `'${s.imei2}'`              : 'NULL'},
        '${s.status}',
        ${s.invoiceItemId ? `'${s.invoiceItemId}'`   : 'NULL'},
        ${s.soldAt        ? `'${s.soldAt.toISOString().split('T')[0]}'::date` : 'NULL'},
        ${s.warrantyMonths ?? 'NULL'},
        ${s.warrantyExpiresAt ? `'${s.warrantyExpiresAt.toISOString().split('T')[0]}'::date` : 'NULL'},
        ${s.customerName  ? `'${s.customerName.replace(/'/g,"''")}'`  : 'NULL'},
        ${s.customerPhone ? `'${s.customerPhone}'`                   : 'NULL'},
        ${s.notes         ? `'${s.notes.replace(/'/g,"''")}'`        : 'NULL'}
      ) ON CONFLICT ("serialNo") DO NOTHING
    `)
  }
  await elDb2.$disconnect()

  // ── Razorpay orders — electronics (paid online) ────────────────────────────
  const rzpDb = tenantDb('t_digismart_electronics')
  const elUser = await rzpDb.user.findFirst({ where: { phone: '9933445566' }, select: { id: true } })
  if (elUser) {
    const inv2Id = uid(35,1,2,0)
    const inv3Id = uid(35,1,3,0)
    await rzpDb.$executeRawUnsafe(`
      INSERT INTO razorpay_orders (id,"branchId","invoiceId","razorpayOrderId",amount,status,"shortUrl","razorpayPaymentId","paidAt","createdBy","createdAt","updatedAt")
      VALUES
        (gen_random_uuid(),'${uid(35,9,0,0)}','${inv2Id}','order_QVR4X2S8K1ABCD',110000,'paid','https://rzp.io/l/DSE-ORDER-2','pay_QVS1A1B2C3D4E5','${new Date(Date.now()-5*86400000).toISOString()}','${elUser.id}',NOW(),NOW()),
        (gen_random_uuid(),'${uid(35,9,0,0)}','${inv3Id}','order_QWR5Y3T9L2BCDE', 79000,'created','https://rzp.io/l/DSE-ORDER-3',NULL,NULL,'${elUser.id}',NOW(),NOW())
      ON CONFLICT ("razorpayOrderId") DO NOTHING
    `)
  }
  await rzpDb.$disconnect()

  console.log('  ✓ extra tables  batches(pharmacy+wholesale), invoice_sequences(all), ai_suggestions(5), razorpay_orders(electronics), serial_numbers(electronics)')

  // ── Job cards — repair shop ────────────────────────────────────────────────
  const repairDb = tenantDb('t_techfix_repair')
  const repairBranch = await repairDb.branch.findFirst({ select: { id: true } })
  const repairParty1 = await repairDb.party.findFirst({ where: { phone: '9712345030' }, select: { id: true } })
  const repairParty2 = await repairDb.party.findFirst({ where: { phone: '9712345031' }, select: { id: true } })
  if (repairBranch) {
    const brId = repairBranch.id
    await repairDb.$executeRawUnsafe(`
      INSERT INTO job_cards (id,"branchId","jobNo",status,"deviceType","deviceBrand","deviceModel",imei,"problemReported",diagnosis,"estimatedCost","advanceReceived","partyId","warrantyDays","warrantyExpiresAt","deliveredAt",accessories,"createdAt","updatedAt")
      VALUES
        ('${uid(43,8,1,0)}','${brId}','JC-2026-0001','delivered','mobile','Apple','iPhone 14','357001234560001','Screen cracked badly','LCD damaged, Touch ID cable torn. Replaced display module.',3500,500,'${repairParty1?.id ?? null}',90,'${futureDate(85).toISOString().slice(0,10)}','${daysAgo(2).toISOString()}','["Original charger","Case"]',NOW(),NOW()),
        ('${uid(43,8,2,0)}','${brId}','JC-2026-0002','in_progress','mobile','Samsung','Galaxy A53','357001234560002','Battery draining fast, phone hot',NULL,NULL,0,'${repairParty2?.id ?? null}',0,NULL,NULL,'[]',NOW(),NOW()),
        ('${uid(43,8,3,0)}','${brId}','JC-2026-0003','estimated','laptop','HP','Pavilion 15',NULL,'Charging not working','DC jack bent and loose. Needs replacement.',450,200,NULL,30,NULL,NULL,'["Charger cable"]',NOW(),NOW()),
        ('${uid(43,8,4,0)}','${brId}','JC-2026-0004','received','mobile','Redmi','Note 12',NULL,'Phone fell in water, not turning on',NULL,NULL,0,NULL,0,NULL,NULL,'["SIM tray ejector"]',NOW(),NOW())
      ON CONFLICT ("branchId","jobNo") DO NOTHING
    `)
    // Add parts for JC-0001 and JC-0003
    const jc1Id = uid(43,8,1,0), jc3Id = uid(43,8,3,0)
    const dispProd = await repairDb.product.findFirst({ where: { sku: 'REP-DISP-I14' }, select: { id: true } })
    await repairDb.$executeRawUnsafe(`
      INSERT INTO job_card_parts (id,"jobCardId","productId",description,qty,rate,total)
      VALUES
        (gen_random_uuid(),'${jc1Id}','${dispProd?.id ?? null}','iPhone 14 Display Module (OEM Compatible)',1,2800,2800),
        (gen_random_uuid(),'${jc1Id}',NULL,'Repair Labour',1,700,700),
        (gen_random_uuid(),'${jc3Id}',NULL,'HP Pavilion DC Jack Replacement Part',1,250,250),
        (gen_random_uuid(),'${jc3Id}',NULL,'Soldering Labour',1,200,200)
      ON CONFLICT DO NOTHING
    `)
  }
  await repairDb.$disconnect()

  // ── Subscriptions + delivery logs — tiffin ─────────────────────────────────
  const tiffinDb = tenantDb('t_ghar_jaisa_tiffin')
  const tiffinBranch = await tiffinDb.branch.findFirst({ select: { id: true } })
  if (tiffinBranch) {
    const brId = tiffinBranch.id
    const p1 = await tiffinDb.party.findFirst({ where: { phone: '9712345040' }, select: { id: true } })
    const p2 = await tiffinDb.party.findFirst({ where: { phone: '9712345041' }, select: { id: true } })
    const p3 = await tiffinDb.party.findFirst({ where: { phone: '9712345042' }, select: { id: true } })
    const p4 = await tiffinDb.party.findFirst({ where: { phone: '9712345043' }, select: { id: true } })
    const sub1Id = uid(44,8,1,0), sub2Id = uid(44,8,2,0), sub3Id = uid(44,8,3,0), sub4Id = uid(44,8,4,0)
    if (p1 && p2 && p3 && p4) {
      await tiffinDb.$executeRawUnsafe(`
        INSERT INTO subscriptions (id,"branchId","subNo","partyId","planName","mealType","tiffinSize","deliveriesPerDay","pricePerDay","pricePerMonth","startDate","endDate",status,"routeArea","deliveryAddress","createdAt","updatedAt")
        VALUES
          ('${sub1Id}','${brId}','SUB-2026-0001','${p1.id}','Full Veg Lunch Tiffin','veg','full',1,100,2800,'${daysAgo(32).toISOString().slice(0,10)}',NULL,'active','Zone A - Manjalpur','12, Shanti Nagar, Manjalpur, Vadodara',NOW(),NOW()),
          ('${sub2Id}','${brId}','SUB-2026-0002','${p2.id}','Full Veg Lunch Tiffin','veg','full',1,100,2800,'${daysAgo(32).toISOString().slice(0,10)}',NULL,'active','Zone A - Manjalpur','34, Garden View Society, Manjalpur',NOW(),NOW()),
          ('${sub3Id}','${brId}','SUB-2026-0003','${p3.id}','Jain Tiffin Lunch','jain','full',1,120,3300,'${daysAgo(10).toISOString().slice(0,10)}',NULL,'active','Zone B - Fatehgunj','78, Fatehgunj Road, Vadodara',NOW(),NOW()),
          ('${sub4Id}','${brId}','SUB-2026-0004','${p4.id}','Full Veg Lunch Tiffin','veg','full',1,100,2800,'${daysAgo(60).toISOString().slice(0,10)}','${daysAgo(1).toISOString().slice(0,10)}','cancelled','Zone B - Fatehgunj','5, Vishwas Colony, Fatehgunj',NOW(),NOW())
        ON CONFLICT ("branchId","subNo") DO NOTHING
      `)
      // Last 5 delivery logs for sub1 and sub2
      for (let d = 5; d >= 1; d--) {
        const date = daysAgo(d).toISOString().slice(0,10)
        await tiffinDb.$executeRawUnsafe(`
          INSERT INTO delivery_logs (id,"branchId","subscriptionId","deliveryDate","mealSlot",status,"createdAt")
          VALUES
            (gen_random_uuid(),'${brId}','${sub1Id}','${date}','lunch','delivered',NOW()),
            (gen_random_uuid(),'${brId}','${sub2Id}','${date}','lunch','${d === 2 ? 'skipped' : 'delivered'}',NOW())
          ON CONFLICT ("subscriptionId","deliveryDate","mealSlot") DO NOTHING
        `)
      }
    }
  }
  await tiffinDb.$disconnect()

  // ── Nozzle readings — petrol pump ──────────────────────────────────────────
  const pumpDb = tenantDb('t_om_petroleum')
  const pumpBranch = await pumpDb.branch.findFirst({ select: { id: true } })
  if (pumpBranch) {
    const brId = pumpBranch.id
    // 3 days of readings, 2 shifts each, 4 nozzles
    const readings = [
      // Day 3 ago — day shift
      { d:3, shift:'day',   n:'N1', fuel:'petrol', open:12450.3, close:12732.8, test:2.0, rate:96.72, cash:26125, card:680,    credit:0 },
      { d:3, shift:'day',   n:'N2', fuel:'petrol', open:9820.1,  close:10095.5, test:1.5, rate:96.72, cash:24100, card:0,      credit:2400 },
      { d:3, shift:'day',   n:'N3', fuel:'diesel',  open:22100.0, close:22480.6, test:3.0, rate:89.62, cash:28000, card:5000,   credit:8000 },
      { d:3, shift:'day',   n:'N4', fuel:'diesel',  open:18350.2, close:18680.5, test:2.5, rate:89.62, cash:19500, card:7000,   credit:3000 },
      // Day 3 ago — night shift
      { d:3, shift:'night', n:'N1', fuel:'petrol', open:12732.8, close:12950.1, test:1.0, rate:96.72, cash:19200, card:1500,   credit:0 },
      { d:3, shift:'night', n:'N3', fuel:'diesel',  open:22480.6, close:22720.0, test:1.5, rate:89.62, cash:18000, card:3000,   credit:0 },
      // Day 2 ago — day shift
      { d:2, shift:'day',   n:'N1', fuel:'petrol', open:12950.1, close:13240.5, test:2.0, rate:96.72, cash:27500, card:1000,   credit:0 },
      { d:2, shift:'day',   n:'N3', fuel:'diesel',  open:22720.0, close:23110.0, test:3.0, rate:89.62, cash:29000, card:4500,   credit:6000 },
      // Day 1 ago — day shift
      { d:1, shift:'day',   n:'N1', fuel:'petrol', open:13240.5, close:13510.0, test:1.5, rate:96.72, cash:24500, card:2100,   credit:0 },
      { d:1, shift:'day',   n:'N3', fuel:'diesel',  open:23110.0, close:23490.8, test:2.5, rate:89.62, cash:28000, card:6000,   credit:6000 },
    ]
    for (const r of readings) {
      const sold   = Math.max(r.close - r.open - r.test, 0)
      const sale   = +(sold * r.rate).toFixed(2)
      const recvd  = r.cash + r.card + r.credit
      const shortage = +(recvd - sale).toFixed(2)
      const date   = daysAgo(r.d).toISOString().slice(0, 10)
      await pumpDb.$executeRawUnsafe(`
        INSERT INTO nozzle_readings (id,"branchId","readingDate",shift,"nozzleNo","fuelType","openingReading","closingReading","testLitres","soldLitres","ratePerLitre","saleAmount","cashReceived","cardReceived","creditAmount","shortageExcess","createdAt","updatedAt")
        VALUES (gen_random_uuid(),'${brId}','${date}','${r.shift}','${r.n}','${r.fuel}',${r.open},${r.close},${r.test},${sold},${r.rate},${sale},${r.cash},${r.card},${r.credit},${shortage},NOW(),NOW())
        ON CONFLICT ("branchId","readingDate",shift,"nozzleNo") DO NOTHING
      `)
    }
  }
  await pumpDb.$disconnect()

  // ── Agri batches — kisan agro center ─────────────────────────────────────
  const agriDb = tenantDb('t_kisan_agro_center')
  const coragenProd = await agriDb.product.findFirst({ where: { sku: 'AG-COR-150' }, select: { id: true } })
  const agriSeedProd = await agriDb.product.findFirst({ where: { sku: 'AG-SEED-MZ' }, select: { id: true } })
  const agriBranchId = uid(42,9,0,0)
  if (coragenProd && agriSeedProd) {
    await agriDb.batch.upsert({ where: { id: uid(42,5,1,0) }, update: {}, create: { id: uid(42,5,1,0), branchId: agriBranchId, productId: coragenProd.id, batchNo:'COR-2025-KH1', mfgDate:new Date('2025-09-01'), expDate:futureDate(120), qtyReceived:100, qtyRemaining:80, purchaseRate:680 } })
    await agriDb.batch.upsert({ where: { id: uid(42,5,2,0) }, update: {}, create: { id: uid(42,5,2,0), branchId: agriBranchId, productId: coragenProd.id, batchNo:'COR-2024-OLD', mfgDate:new Date('2024-03-01'), expDate:futureDate(10),  qtyReceived:20,  qtyRemaining:5,  purchaseRate:650 } })
    await agriDb.batch.upsert({ where: { id: uid(42,5,3,0) }, update: {}, create: { id: uid(42,5,3,0), branchId: agriBranchId, productId: agriSeedProd.id, batchNo:'SEED-2025-KH', mfgDate:new Date('2025-10-01'), expDate:futureDate(180), qtyReceived:200, qtyRemaining:200, purchaseRate:280 } })
  }
  await agriDb.$disconnect()

  console.log('  ✓ new domain extension tables: job_cards(repair), subscriptions+delivery_logs(tiffin), nozzle_readings(petrol_pump), batches(agri)')

  // ── Gym memberships + attendance ───────────────────────────────────────────
  const gymDb = tenantDb('t_fitzone_gym')
  const gymBranch = await gymDb.branch.findFirst({ select: { id: true } })
  if (gymBranch) {
    const brId = gymBranch.id
    const gp1 = await gymDb.party.findFirst({ where: { phone: '9712346001' }, select: { id: true } })
    const gp2 = await gymDb.party.findFirst({ where: { phone: '9712346002' }, select: { id: true } })
    const gp3 = await gymDb.party.findFirst({ where: { phone: '9712346003' }, select: { id: true } })
    const inv1 = uid(45,1,1,0)
    const inv2 = uid(45,1,2,0)
    if (gp1 && gp2 && gp3) {
      const m1Id = uid(45,8,1,0), m2Id = uid(45,8,2,0), m3Id = uid(45,8,3,0)
      await gymDb.$executeRawUnsafe(`
        INSERT INTO memberships (id,"branchId","memberId","partyId","planName","planType","startDate","endDate",status,"feeAmount","admissionFee","lockerNo","trainerName","createdAt","updatedAt")
        VALUES
          ('${m1Id}','${brId}','MEM-2026-0001','${gp1.id}','Annual Membership','annual','${daysAgo(60).toISOString().slice(0,10)}','${futureDate(305).toISOString().slice(0,10)}','active',9000,500,'L-12',NULL,NOW(),NOW()),
          ('${m2Id}','${brId}','MEM-2026-0002','${gp2.id}','Monthly Membership','monthly','${daysAgo(30).toISOString().slice(0,10)}','${futureDate(1).toISOString().slice(0,10)}','active',1200,500,'L-07',NULL,NOW(),NOW()),
          ('${m3Id}','${brId}','MEM-2026-0003','${gp3.id}','Personal Training (12 sessions)','pt_package','${daysAgo(10).toISOString().slice(0,10)}','${futureDate(80).toISOString().slice(0,10)}','active',5000,0,NULL,'Raj Fitness',NOW(),NOW())
        ON CONFLICT ("branchId","memberId") DO NOTHING
      `)
      // 5 attendance logs for each of last 5 days for member 1
      for (let d = 5; d >= 1; d--) {
        const cin = new Date(daysAgo(d)); cin.setHours(6,30,0,0)
        const cout = new Date(cin); cout.setHours(8,0,0,0)
        await gymDb.$executeRawUnsafe(`
          INSERT INTO attendance_logs (id,"branchId","partyId","membershipId","checkinAt","checkoutAt",source,"createdAt")
          VALUES (gen_random_uuid(),'${brId}','${gp1.id}','${m1Id}','${cin.toISOString()}','${cout.toISOString()}','biometric',NOW())
          ON CONFLICT DO NOTHING
        `)
      }
    }
  }
  await gymDb.$disconnect()

  // ── Lab reports — diagnostic lab ───────────────────────────────────────────
  const labDb = tenantDb('t_apex_diagnostics')
  const labBranch = await labDb.branch.findFirst({ select: { id: true } })
  if (labBranch) {
    const brId = labBranch.id
    const inv1Id = uid(46,1,1,0)
    const inv2Id = uid(46,1,2,0)
    const inv4Id = uid(46,1,4,0)
    const lp1 = await labDb.party.findFirst({ where: { phone: '9712346010' }, select: { id: true } })
    const lp2 = await labDb.party.findFirst({ where: { phone: '9712346011' }, select: { id: true } })
    if (lp1 && lp2) {
      await labDb.$executeRawUnsafe(`
        INSERT INTO lab_reports (id,"branchId","invoiceId","sampleId","patientName","patientAge","patientGender","testName",status,"collectedAt","reportExpectedAt","reportReadyAt","homeCollection","urgent","createdAt","updatedAt")
        VALUES
          (gen_random_uuid(),'${brId}','${inv1Id}','LB-2026-00001','Ramesh Patel',45,'M','CBC (Complete Blood Count)','delivered','${daysAgo(5).toISOString()}','${daysAgo(5).toISOString()}','${daysAgo(4).toISOString()}',TRUE,FALSE,NOW(),NOW()),
          (gen_random_uuid(),'${brId}','${inv1Id}','LB-2026-00002','Ramesh Patel',45,'M','Lipid Profile','delivered','${daysAgo(5).toISOString()}','${daysAgo(4).toISOString()}','${daysAgo(4).toISOString()}',TRUE,FALSE,NOW(),NOW()),
          (gen_random_uuid(),'${brId}','${inv2Id}','LB-2026-00003','Sunita Desai',38,'F','HbA1c (Diabetes)','delivered','${daysAgo(3).toISOString()}','${daysAgo(3).toISOString()}','${daysAgo(2).toISOString()}',FALSE,FALSE,NOW(),NOW()),
          (gen_random_uuid(),'${brId}','${inv2Id}','LB-2026-00004','Sunita Desai',38,'F','Thyroid Profile (T3/T4/TSH)','delivered','${daysAgo(3).toISOString()}','${daysAgo(2).toISOString()}','${daysAgo(2).toISOString()}',FALSE,FALSE,NOW(),NOW()),
          (gen_random_uuid(),'${brId}','${inv4Id}','LB-2026-00005','Walk-in Patient',28,'M','Dengue NS1 Antigen','ready','${daysAgo(1).toISOString()}','${daysAgo(1).toISOString()}','${daysAgo(1).toISOString()}',FALSE,TRUE,NOW(),NOW()),
          (gen_random_uuid(),'${brId}','${inv4Id}','LB-2026-00006','Walk-in Patient',28,'M','CBC (Complete Blood Count)','ready','${daysAgo(1).toISOString()}','${daysAgo(1).toISOString()}','${daysAgo(1).toISOString()}',FALSE,FALSE,NOW(),NOW())
        ON CONFLICT DO NOTHING
      `)
    }
  }
  await labDb.$disconnect()

  // ── Service visits — pest control AMC ─────────────────────────────────────
  const pestDb = tenantDb('t_shieldpest_solutions')
  const pestBranch = await pestDb.branch.findFirst({ select: { id: true } })
  if (pestBranch) {
    const brId = pestBranch.id
    const pp1 = await pestDb.party.findFirst({ where: { phone: '9712346020' }, select: { id: true } })
    const pp2 = await pestDb.party.findFirst({ where: { phone: '9712346021' }, select: { id: true } })
    const invAmc = uid(47,1,2,0)
    if (pp1 && pp2) {
      await pestDb.$executeRawUnsafe(`
        INSERT INTO service_visits (id,"branchId","invoiceId","partyId","visitNo","serviceType","serviceAddress","scheduledDate","completedAt",status,"technicianName","chemicalUsed","chemicalQtyMl","areaSqft","nextVisitDate","warrantyCardNo","createdAt","updatedAt")
        VALUES
          (gen_random_uuid(),'${brId}',NULL,'${pp1.id}',1,'general_pest','42, Shanti Nagar, Alkapuri, Vadodara','${daysAgo(6).toISOString().slice(0,10)}','${daysAgo(6).toISOString()}','completed','Rakesh Solanki','Fipronil 0.3% SC',150,850,'${futureDate(30).toISOString().slice(0,10)}','WRN-2026-001',NOW(),NOW()),
          (gen_random_uuid(),'${brId}','${invAmc}','${pp2.id}',1,'rodent','Mehta Residency, RC Dutt Road, Vadodara','${daysAgo(4).toISOString().slice(0,10)}','${daysAgo(4).toISOString()}','completed','Vijay Parmar','Bromadialone Bait Blocks',200,3200,'${futureDate(90).toISOString().slice(0,10)}','AMC-2026-MH01',NOW(),NOW()),
          (gen_random_uuid(),'${brId}','${invAmc}','${pp2.id}',2,'mosquito','Mehta Residency, RC Dutt Road, Vadodara','${futureDate(86).toISOString().slice(0,10)}',NULL,'scheduled',NULL,NULL,NULL,NULL,'${futureDate(176).toISOString().slice(0,10)}',NULL,NOW(),NOW()),
          (gen_random_uuid(),'${brId}','${invAmc}','${pp2.id}',3,'rodent','Mehta Residency, RC Dutt Road, Vadodara','${futureDate(176).toISOString().slice(0,10)}',NULL,'scheduled',NULL,NULL,NULL,NULL,NULL,NULL,NOW(),NOW())
        ON CONFLICT DO NOTHING
      `)
    }
  }
  await pestDb.$disconnect()

  console.log('  ✓ new 4-domain extension tables: memberships+attendance(gym), lab_reports(diagnostic), service_visits(pest_control)')
}

// =============================================================================
async function main() {
  console.log('🌱 Seeding per-schema multi-tenant database...\n')

  // ── Tenant 1: Kirana / Retail ───────────────────────────────────────────
  const RETAIL_SLUG   = 'ramesh-kirana'
  const RETAIL_SCHEMA = schemaFromSlug(RETAIL_SLUG)

  const ramesh = await db.tenant.upsert({
    where:  { slug: RETAIL_SLUG }, update: {},
    create: { name: 'Ramesh Enterprises', slug: RETAIL_SLUG, schemaName: RETAIL_SCHEMA,
              plan: 'free', gstin: '24AABCR1234A1Z5', ownerPhone: '9876543210',
              settings: { currency: 'INR', lang: 'hi', timezone: 'Asia/Kolkata' } },
  })
  const rtdb = await provisionSchema(RETAIL_SCHEMA)

  const branch = await rtdb.branch.upsert({
    where: { id: '00000001-0000-0000-0000-000000000001' }, update: {},
    create: { id: '00000001-0000-0000-0000-000000000001', name: 'Ramesh Kirana - Alkapuri',
              gstin: '24AABCR1234A1Z5', stateCode: '24', domainType: 'retail',
              domainConfig: { udhaar_enabled: true, barcode_scan_first: true,
                              quick_billing_mode: true, low_stock_alert: true, invoice_prefix: 'RK-ALK' },
              address: { line1: 'Shop 12, Alkapuri', city: 'Vadodara', state: 'Gujarat', pincode: '390007' } },
  })

  const owner = await rtdb.user.upsert({
    where: { phone: '9876543210' }, update: {},
    create: { name: 'Ramesh Patel', phone: '9876543210', role: 'owner',
              branchIds: [], pin: await hashPin('1111'), lang: 'gu' },
  })
  await rtdb.user.upsert({
    where: { phone: '9876500001' }, update: {},
    create: { name: 'Suresh (Cashier)', phone: '9876500001', role: 'cashier',
              branchIds: [branch.id], pin: await hashPin('2222') },
  })

  // Retail categories and brands
  const retailCats = [
    {slug:'staples',     name:'Staples',      icon:'🌾',color:'#f59e0b'},
    {slug:'beverages',   name:'Beverages',    icon:'🥤',color:'#3b82f6'},
    {slug:'dairy',       name:'Dairy',        icon:'🥛',color:'#ffffff'},
    {slug:'snacks',      name:'Snacks',       icon:'🍿',color:'#f97316'},
    {slug:'personal_care',name:'Personal Care',icon:'🧴',color:'#ec4899'},
    {slug:'cleaning',    name:'Cleaning',     icon:'🧹',color:'#10b981'},
  ]
  const retailBrands = [
    {slug:'amul',     name:'Amul'},
    {slug:'nestle',   name:'Nestlé'},
    {slug:'britannia',name:'Britannia'},
    {slug:'colgate',  name:'Colgate'},
    {slug:'hul',      name:'HUL'},
  ]
  const rtCatMap: Record<string, string> = {}
  for (let ci = 0; ci < retailCats.length; ci++) {
    const c = retailCats[ci]!
    const catId = uid(0, 15, ci + 1, 0)
    await rtdb.category.upsert({
      where:  { id: catId },
      update: {},
      create: { id: catId, branch: { connect: { id: branch.id } }, name: c.name, slug: c.slug,
                icon: c.icon, color: c.color, sortOrder: ci },
    })
    rtCatMap[c.slug] = catId
  }
  const rtBrandMap: Record<string, string> = {}
  for (let bi = 0; bi < retailBrands.length; bi++) {
    const b = retailBrands[bi]!
    const brandId = uid(0, 16, bi + 1, 0)
    await rtdb.brand.upsert({
      where:  { id: brandId },
      update: {},
      create: { id: brandId, branch: { connect: { id: branch.id } }, name: b.name, slug: b.slug },
    })
    rtBrandMap[b.slug] = brandId
  }

  // 10 products
  const retailProds = [
    { idx:1,  name:'Amul Butter 100g',         sku:'AMB-100', barcode:'8901030000001', hsn:'04051000', gst:12, unit:'pcs', pp:48,  sp:55,  mrp:57,  low:10, stock:45, cat:'dairy',        brand:'amul' },
    { idx:2,  name:'Tata Salt 1kg',             sku:'TTS-1KG', barcode:'8901234000002', hsn:'25010000', gst:0,  unit:'pcs', pp:18,  sp:22,  mrp:24,  low:20, stock:60, cat:'staples',      brand:null },
    { idx:3,  name:'Fortune Sunflower Oil 1L',  sku:'FSO-1L',  barcode:'8901098000003', hsn:'15121100', gst:5,  unit:'pcs', pp:115, sp:130, mrp:135, low:8,  stock:24, cat:'staples',      brand:null },
    { idx:4,  name:'Aashirvaad Atta 5kg',       sku:'ASH-5KG', barcode:'8901058000004', hsn:'11010000', gst:0,  unit:'pcs', pp:185, sp:210, mrp:220, low:10, stock:30, cat:'staples',      brand:null },
    { idx:5,  name:'Ariel Powder 1kg',          sku:'ARP-1KG', barcode:'8901477000005', hsn:'34022090', gst:18, unit:'pcs', pp:190, sp:230, mrp:240, low:5,  stock:18, cat:'cleaning',     brand:'hul' },
    { idx:6,  name:'Parle-G Biscuits 800g',     sku:'PLG-800', barcode:'8901719000006', hsn:'19059090', gst:18, unit:'pcs', pp:38,  sp:45,  mrp:50,  low:15, stock:7,  cat:'snacks',       brand:null },
    { idx:7,  name:'Surf Excel Easy Wash 500g', sku:'SFE-500', barcode:'8901030000007', hsn:'34022090', gst:18, unit:'pcs', pp:60,  sp:75,  mrp:80,  low:10, stock:3,  cat:'cleaning',     brand:'hul' },
    { idx:8,  name:'Britannia Brown Bread',     sku:'BRB-400', barcode:'8901063000008', hsn:'19051090', gst:0,  unit:'pcs', pp:35,  sp:42,  mrp:45,  low:12, stock:20, cat:'staples',      brand:'britannia' },
    { idx:9,  name:'Horlicks Original 500g',    sku:'HOR-500', barcode:'8901058000009', hsn:'19011000', gst:18, unit:'pcs', pp:155, sp:185, mrp:200, low:5,  stock:12, cat:'beverages',    brand:null },
    { idx:10, name:'Colgate Strong Teeth 200g', sku:'CLG-200', barcode:'8901314000010', hsn:'33061000', gst:18, unit:'pcs', pp:58,  sp:72,  mrp:75,  low:8,  stock:4,  cat:'personal_care',brand:'colgate' },
  ]
  for (const p of retailProds) {
    const pid = uid(0, 2, p.idx, 0)
    const categoryId = p.cat ? (rtCatMap[p.cat] ?? null) : null
    const brandId    = p.brand ? (rtBrandMap[p.brand] ?? null) : null
    await rtdb.product.upsert({
      where: { id: pid }, update: {},
      create: { id: pid, branch: { connect: { id: branch.id } }, name: p.name, sku: p.sku, barcode: p.barcode,
                hsnSacCode: p.hsn, gstRate: p.gst, unit: p.unit,
                purchasePrice: p.pp, salePrice: p.sp, mrp: p.mrp,
                trackStock: true, lowStockQty: p.low, domainAttrs: {},
                ...(categoryId ? { category: { connect: { id: categoryId } } } : {}),
                ...(brandId ? { brand: { connect: { id: brandId } } } : {}) },
    })
    await rtdb.stockLedger.upsert({
      where: { id: uid(0, 7, p.idx, 0) }, update: {},
      create: { id: uid(0, 7, p.idx, 0), branchId: branch.id, product: { connect: { id: pid } },
                txnType: 'opening', qty: p.stock, rate: p.pp,
                refType: 'opening_stock', refId: pid },
    })
  }

  // 7 parties
  const P   = (n: number) => uid(0, 2, n, 0)
  const PA  = (n: number) => uid(0, 0, 0, n)
  const partyDefs = [
    { idx:10, type:'customer', name:'Mukesh Sharma',        phone:'9712345678', balance:450,    creditLimit:2000 },
    { idx:11, type:'supplier', name:'Metro Cash & Carry',   phone:'9800001234', balance:-12000, creditLimit:0,    gstin:'24AAACC5678B1Z1' },
    { idx:12, type:'customer', name:'Kishore Mehta',        phone:'9898001122', balance:1200,   creditLimit:3000 },
    { idx:13, type:'customer', name:'Anita Verma',          phone:'9723344556', balance:850,    creditLimit:1500 },
    { idx:14, type:'customer', name:'Jayesh Patel',         phone:'9978112233', balance:0,      creditLimit:1000 },
    { idx:15, type:'both',     name:'Bhavesh Distributors', phone:'9925556677', balance:-8000,  creditLimit:0,    gstin:'24BBBBD9012E2Z3' },
    { idx:16, type:'customer', name:'Sunita Desai',         phone:'9824123456', balance:320,    creditLimit:1000 },
  ]
  for (const p of partyDefs) {
    await rtdb.party.upsert({
      where: { id: PA(p.idx) }, update: {},
      create: { id: PA(p.idx), branch: { connect: { id: branch.id } }, type: p.type, name: p.name,
                phone: p.phone, balance: p.balance, creditLimit: p.creditLimit,
                gstin: (p as any).gstin ?? null },
    })
  }

  // 14 invoices
  const invoiceDefs = [
    { n:1,  ago:6, party:PA(14), status:'paid',      method:'cash', items:[lineItem('Amul Butter 100g',P(1),2,55,12,'04051000'),lineItem('Tata Salt 1kg',P(2),3,22,0,'25010000'),lineItem('Britannia Brown Bread',P(8),1,42,0,'19051090')] },
    { n:2,  ago:6, party:PA(10), status:'partial',   method:'upi',  items:[lineItem('Aashirvaad Atta 5kg',P(4),2,210,0,'11010000'),lineItem('Fortune Sunflower Oil 1L',P(3),2,130,5,'15121100'),lineItem('Horlicks Original 500g',P(9),1,185,18,'19011000')] },
    { n:3,  ago:5, party:null,   status:'paid',      method:'cash', items:[lineItem('Parle-G Biscuits 800g',P(6),3,45,18,'19059090'),lineItem('Colgate Strong Teeth 200g',P(10),2,72,18,'33061000'),lineItem('Surf Excel Easy Wash 500g',P(7),2,75,18,'34022090')] },
    { n:4,  ago:5, party:PA(12), status:'confirmed', method:null,   items:[lineItem('Amul Butter 100g',P(1),3,55,12,'04051000'),lineItem('Ariel Powder 1kg',P(5),1,230,18,'34022090'),lineItem('Tata Salt 1kg',P(2),2,22,0,'25010000')] },
    { n:5,  ago:4, party:PA(13), status:'partial',   method:'upi',  items:[lineItem('Horlicks Original 500g',P(9),2,185,18,'19011000'),lineItem('Britannia Brown Bread',P(8),2,42,0,'19051090'),lineItem('Fortune Sunflower Oil 1L',P(3),1,130,5,'15121100')] },
    { n:6,  ago:4, party:null,   status:'paid',      method:'card', items:[lineItem('Aashirvaad Atta 5kg',P(4),1,210,0,'11010000'),lineItem('Tata Salt 1kg',P(2),4,22,0,'25010000'),lineItem('Amul Butter 100g',P(1),1,55,12,'04051000')] },
    { n:7,  ago:3, party:PA(16), status:'paid',      method:'upi',  items:[lineItem('Parle-G Biscuits 800g',P(6),2,45,18,'19059090'),lineItem('Colgate Strong Teeth 200g',P(10),1,72,18,'33061000'),lineItem('Horlicks Original 500g',P(9),1,185,18,'19011000')] },
    { n:8,  ago:3, party:PA(10), status:'confirmed', method:null,   items:[lineItem('Aashirvaad Atta 5kg',P(4),3,210,0,'11010000'),lineItem('Fortune Sunflower Oil 1L',P(3),3,130,5,'15121100')] },
    { n:9,  ago:2, party:PA(14), status:'paid',      method:'cash', items:[lineItem('Surf Excel Easy Wash 500g',P(7),1,75,18,'34022090'),lineItem('Ariel Powder 1kg',P(5),1,230,18,'34022090'),lineItem('Britannia Brown Bread',P(8),3,42,0,'19051090')] },
    { n:10, ago:2, party:PA(12), status:'paid',      method:'upi',  items:[lineItem('Amul Butter 100g',P(1),4,55,12,'04051000'),lineItem('Tata Salt 1kg',P(2),2,22,0,'25010000'),lineItem('Horlicks Original 500g',P(9),2,185,18,'19011000')] },
    { n:11, ago:1, party:null,   status:'paid',      method:'cash', items:[lineItem('Fortune Sunflower Oil 1L',P(3),2,130,5,'15121100'),lineItem('Aashirvaad Atta 5kg',P(4),2,210,0,'11010000'),lineItem('Parle-G Biscuits 800g',P(6),1,45,18,'19059090'),lineItem('Tata Salt 1kg',P(2),3,22,0,'25010000')] },
    { n:12, ago:1, party:PA(13), status:'partial',   method:'card', items:[lineItem('Ariel Powder 1kg',P(5),2,230,18,'34022090'),lineItem('Colgate Strong Teeth 200g',P(10),1,72,18,'33061000'),lineItem('Surf Excel Easy Wash 500g',P(7),1,75,18,'34022090')] },
    { n:13, ago:0, party:PA(16), status:'paid',      method:'upi',  items:[lineItem('Amul Butter 100g',P(1),2,55,12,'04051000'),lineItem('Britannia Brown Bread',P(8),2,42,0,'19051090'),lineItem('Horlicks Original 500g',P(9),1,185,18,'19011000')] },
    { n:14, ago:0, party:null,   status:'paid',      method:'cash', items:[lineItem('Tata Salt 1kg',P(2),5,22,0,'25010000'),lineItem('Fortune Sunflower Oil 1L',P(3),2,130,5,'15121100'),lineItem('Parle-G Biscuits 800g',P(6),2,45,18,'19059090')] },
  ]
  for (const inv of invoiceDefs) {
    const totals    = invoiceTotals(inv.items)
    const paidAmt   = inv.status === 'paid' ? totals.grandTotal : inv.status === 'partial' ? +(totals.grandTotal*0.5).toFixed(2) : 0
    const invoiceId = uid(0, 1, inv.n, 0)
    await rtdb.invoice.upsert({
      where: { id: invoiceId }, update: {},
      create: { id: invoiceId, branch: { connect: { id: branch.id } },
                ...(inv.party ? { party: { connect: { id: inv.party } } } : {}),
                createdByUser: { connect: { id: owner.id } }, txnType: 'sale_invoice',
                number: `RK-ALK-2025-${String(inv.n).padStart(5,'0')}`,
                date: daysAgo(inv.ago), status: inv.status, paidAmt, ...totals },
    })
    for (let li = 0; li < inv.items.length; li++) {
      const it = inv.items[li]!
      await rtdb.invoiceItem.upsert({
        where: { id: uid(inv.n, 6, li+1, 0) }, update: {},
        create: { id: uid(inv.n, 6, li+1, 0),
                  invoice: { connect: { id: invoiceId } },
                  ...(it.productId ? { product: { connect: { id: it.productId } } } : {}),
                  description: it.description, hsnSacCode: it.hsnSacCode,
                  qty: it.qty, unit: it.unit, rate: it.rate,
                  discountPct: it.discountPct, discountAmt: it.discountAmt,
                  taxableAmt: it.taxableAmt, gstRate: it.gstRate,
                  cgstAmt: it.cgstAmt, sgstAmt: it.sgstAmt, igstAmt: 0,
                  total: it.total, sortOrder: li },
      })
      if (it.productId) {
        await rtdb.stockLedger.upsert({
          where: { id: uid(inv.n, 8, li+1, 0) }, update: {},
          create: { id: uid(inv.n, 8, li+1, 0), branchId: branch.id,
                    product: { connect: { id: it.productId } },
                    txnType: 'sale', qty: -it.qty, rate: it.rate, refType: 'invoice', refId: invoiceId },
        })
      }
    }
    if (inv.method && paidAmt > 0) {
      const paymentId = uid(0, 3, inv.n, 0)
      await rtdb.payment.upsert({
        where: { id: paymentId }, update: {},
        create: { id: paymentId, branchId: branch.id,
                  ...(inv.party ? { party: { connect: { id: inv.party } } } : {}),
                  amount: paidAmt, method: inv.method, paymentDate: daysAgo(inv.ago), createdBy: owner.id },
      })
      await rtdb.paymentAllocation.upsert({
        where: { id: uid(0, 4, inv.n, 0) }, update: {},
        create: { id: uid(0, 4, inv.n, 0),
                  payment: { connect: { id: paymentId } },
                  invoice: { connect: { id: invoiceId } },
                  amount: paidAmt },
      })
    }
  }
  console.log(`  ✓ retail         Ramesh Enterprises  (login: tenantPhone=9876543210 phone=9876543210 PIN=1111)`)
  await rtdb.$disconnect()

  // ── Restaurant ───────────────────────────────────────────────────────────────
  const RS=(i:number)=>uid(33,2,i,0), RSP=(i:number)=>uid(33,0,0,i)
  await seedDomain({ o:33, slug:'shree-restaurant', name:'Shree Restaurant', phone:'9898765432', ownerName:'Shailesh Joshi', pin:'3333', branchName:'Shree Restaurant - Alkapuri', domainType:'restaurant', prefix:'SR', domainConfig:{ table_billing:true, kot_enabled:true, parcel_enabled:true },
    categories:[
      {slug:'south_indian',name:'South Indian',icon:'🥘',color:'#f59e0b',sortOrder:0},
      {slug:'north_indian',name:'North Indian',icon:'🍛',color:'#ef4444',sortOrder:1},
      {slug:'biryani',     name:'Biryani',     icon:'🍚',color:'#f97316',sortOrder:2},
      {slug:'thali',       name:'Thali',       icon:'🍽️',color:'#10b981',sortOrder:3},
      {slug:'beverages',   name:'Beverages',   icon:'🥤',color:'#3b82f6',sortOrder:4},
      {slug:'desserts',    name:'Desserts',    icon:'🍮',color:'#ec4899',sortOrder:5},
      {slug:'breads',      name:'Breads',      icon:'🫓',color:'#a78bfa',sortOrder:6},
    ],
    prods:[
      {i:1,name:'Masala Dosa',          sku:'FD-MDOSA', hsn:'996331',gst:5, unit:'plate',pp:45, sp:80, mrp:80, low:0,stock:0,trackStock:false,consumable:false,attrs:{category:'south_indian',veg:true,  prep_min:10},cat:'south_indian'},
      {i:2,name:'Paneer Butter Masala', sku:'FD-PBM',   hsn:'996331',gst:5, unit:'plate',pp:90, sp:180,mrp:180,low:0,stock:0,trackStock:false,consumable:false,attrs:{category:'north_indian',veg:true,  prep_min:15},cat:'north_indian'},
      {i:3,name:'Chicken Biryani',      sku:'FD-CBR',   hsn:'996331',gst:5, unit:'plate',pp:120,sp:220,mrp:220,low:0,stock:0,trackStock:false,consumable:false,attrs:{category:'biryani',     veg:false, prep_min:20},cat:'biryani'},
      {i:4,name:'Veg Thali',            sku:'FD-VTHL',  hsn:'996331',gst:5, unit:'plate',pp:100,sp:180,mrp:180,low:0,stock:0,trackStock:false,consumable:false,attrs:{category:'thali',       veg:true,  prep_min:12},cat:'thali'},
      {i:5,name:'Cold Coffee',          sku:'BV-CC',    hsn:'996331',gst:5, unit:'glass',pp:25, sp:60, mrp:60, low:0,stock:0,trackStock:false,consumable:false,attrs:{category:'beverages',   veg:true,  prep_min:5 },cat:'beverages'},
      {i:6,name:'Gulab Jamun',          sku:'DS-GJ',    hsn:'996331',gst:5, unit:'plate',pp:20, sp:45, mrp:45, low:0,stock:0,trackStock:false,consumable:false,attrs:{category:'desserts',    veg:true,  prep_min:2 },cat:'desserts'},
      {i:7,name:'Tandoori Roti',        sku:'BR-TR',    hsn:'996331',gst:5, unit:'pcs',  pp:5,  sp:15, mrp:15, low:0,stock:0,trackStock:false,consumable:false,attrs:{category:'breads',      veg:true,  prep_min:5 },cat:'breads'},
      {i:8,name:'Lassi (Sweet)',        sku:'BV-LSSI',  hsn:'996331',gst:5, unit:'glass',pp:20, sp:50, mrp:50, low:0,stock:0,trackStock:false,consumable:false,attrs:{category:'beverages',   veg:true,  prep_min:3 },cat:'beverages'},
    ],
    parties:[
      {i:1,type:'customer',name:'Ajay Mehta',        phone:'9712341001',bal:0},
      {i:2,type:'customer',name:'Corporate Catering (Zydus)',phone:'9712341002',bal:0,limit:20000,gstin:'24AABCZ1234C1Z1'},
      {i:3,type:'supplier',name:'Fresh Veggies Supply Co',phone:'9800501001',bal:-8000},
    ],
    invs:[
      {n:1,pi:1,  status:'paid',    method:'cash',ago:4,domainData:{order_type:'dine_in', table_no:'T-3'},items:[lineItem('Masala Dosa',RS(1),2,80,5,'996331','plate'),lineItem('Veg Thali',RS(4),1,180,5,'996331','plate'),lineItem('Cold Coffee',RS(5),2,60,5,'996331','glass')]},
      {n:2,pi:null,status:'paid',   method:'upi', ago:3,domainData:{order_type:'takeaway'},items:[lineItem('Chicken Biryani',RS(3),3,220,5,'996331','plate'),lineItem('Lassi (Sweet)',RS(8),3,50,5,'996331','glass')]},
      {n:3,pi:2,  status:'confirmed',method:null, ago:3,domainData:{order_type:'delivery'},items:[lineItem('Veg Thali',RS(4),20,180,5,'996331','plate'),lineItem('Paneer Butter Masala',RS(2),10,180,5,'996331','plate'),lineItem('Tandoori Roti',RS(7),30,15,5,'996331','pcs')]},
      {n:4,pi:1,  status:'paid',    method:'card',ago:2,domainData:{order_type:'dine_in', table_no:'T-7'},items:[lineItem('Paneer Butter Masala',RS(2),1,180,5,'996331','plate'),lineItem('Tandoori Roti',RS(7),4,15,5,'996331','pcs'),lineItem('Gulab Jamun',RS(6),1,45,5,'996331','plate')]},
      {n:5,pi:null,status:'paid',   method:'upi', ago:1,domainData:{order_type:'zomato'},items:[lineItem('Masala Dosa',RS(1),3,80,5,'996331','plate'),lineItem('Cold Coffee',RS(5),3,60,5,'996331','glass'),lineItem('Gulab Jamun',RS(6),2,45,5,'996331','plate')]},
      {n:6,pi:2,  status:'paid',    method:'bank_transfer',ago:1,domainData:{order_type:'delivery'},items:[lineItem('Veg Thali',RS(4),30,180,5,'996331','plate'),lineItem('Cold Coffee',RS(5),30,60,5,'996331','glass')]},
    ]})

  // ── Pharmacy ──────────────────────────────────────────────────────────────
  const PH=(i:number)=>uid(34,2,i,0), PHP=(i:number)=>uid(34,0,0,i), PHB=(i:number)=>uid(34,5,i,0)
  await seedDomain({ o:34, slug:'lifeline-pharmacy', name:'Lifeline Medical Store', phone:'9925123456', ownerName:'Dr. Amit Shah', pin:'4444', branchName:'Lifeline Pharmacy - Manjalpur', domainType:'pharmacy', prefix:'LPH', domainConfig:{ batch_tracking:true, expiry_alerts:true, schedule_h:true },
    categories:[
      {slug:'antibiotics',name:'Antibiotics', icon:'💊',color:'#ef4444',sortOrder:0},
      {slug:'vitamins',   name:'Vitamins',    icon:'🌟',color:'#f59e0b',sortOrder:1},
      {slug:'pain_relief',name:'Pain Relief', icon:'🩹',color:'#f97316',sortOrder:2},
      {slug:'digestive',  name:'Digestive',   icon:'🫃',color:'#10b981',sortOrder:3},
      {slug:'cold_flu',   name:'Cold & Flu',  icon:'🤧',color:'#3b82f6',sortOrder:4},
    ],
    brands:[
      {slug:'cipla',    name:'Cipla'},
      {slug:'sun_pharma',name:'Sun Pharma'},
      {slug:'abbott',   name:'Abbott'},
      {slug:'himalaya', name:'Himalaya'},
    ],
    prods:[
      {i:1,name:'Paracetamol 500mg (strip/10)',sku:'MED-PCT-500', hsn:'30049099',gst:12,unit:'strip',pp:12, sp:18, mrp:20, low:20,stock:500,attrs:{drug_type:'tablet',schedule:'OTC', requires_rx:false,composition:'Paracetamol 500mg'},cat:'pain_relief',brand:'cipla'},
      {i:2,name:'Amoxicillin 250mg (strip/10)',sku:'MED-AMX-250', hsn:'30041020',gst:12,unit:'strip',pp:45, sp:65, mrp:72, low:10,stock:150,attrs:{drug_type:'tablet',schedule:'H',   requires_rx:true, composition:'Amoxicillin 250mg'},cat:'antibiotics',brand:'cipla'},
      {i:3,name:'Crocin Cold & Flu (strip/10)',sku:'MED-CRN-CF',  hsn:'30049099',gst:12,unit:'strip',pp:38, sp:55, mrp:60, low:15,stock:200,attrs:{drug_type:'tablet',schedule:'OTC', requires_rx:false,composition:'Paracetamol+Phenylephrine'},cat:'cold_flu',brand:'abbott'},
      {i:4,name:'Becosules Capsules (30)',     sku:'MED-BEC-30',  hsn:'30049099',gst:12,unit:'box',  pp:65, sp:90, mrp:98, low:10,stock:100,attrs:{drug_type:'capsule',schedule:'OTC',requires_rx:false,composition:'Vitamins B-complex'},cat:'vitamins',brand:'abbott'},
      {i:5,name:'Omeprazole 20mg (strip/10)',  sku:'MED-OMP-20',  hsn:'30049099',gst:12,unit:'strip',pp:22, sp:35, mrp:40, low:15,stock:300,attrs:{drug_type:'tablet',schedule:'H',   requires_rx:true, composition:'Omeprazole 20mg'},cat:'digestive',brand:'sun_pharma'},
      {i:6,name:'Betadine Solution 100ml',     sku:'MED-BTD-100', hsn:'30059090',gst:12,unit:'bottle',pp:55,sp:80, mrp:88, low:8, stock:80, attrs:{drug_type:'topical',schedule:'OTC',requires_rx:false,composition:'Povidone-Iodine 10%'},cat:'pain_relief'},
      {i:7,name:'Cetrizine 10mg (strip/10)',   sku:'MED-CTZ-10',  hsn:'30049099',gst:12,unit:'strip',pp:18, sp:28, mrp:32, low:20,stock:250,attrs:{drug_type:'tablet',schedule:'H',   requires_rx:true, composition:'Cetrizine HCl 10mg'},cat:'cold_flu',brand:'cipla'},
      {i:8,name:'Dolo 650 (strip/15)',         sku:'MED-DOL-650', hsn:'30049099',gst:12,unit:'strip',pp:24, sp:35, mrp:38, low:25,stock:400,attrs:{drug_type:'tablet',schedule:'OTC', requires_rx:false,composition:'Paracetamol 650mg'},cat:'pain_relief',brand:'sun_pharma'},
    ],
    parties:[
      {i:1,type:'customer',name:'Ramesh Kumar',   phone:'9712342001',bal:0},
      {i:2,type:'customer',name:'Sunita Patel',   phone:'9712342002',bal:250,limit:1000},
      {i:3,type:'supplier',name:'Medico Pharma Distributors',phone:'9800502001',bal:-25000,gstin:'24AABCM2001P1Z5'},
    ],
    invs:[
      {n:1,pi:1,  status:'paid',   method:'cash',ago:5,domainData:{patient_name:'Ramesh Patel',patient_age:45,doctor_name:'Dr. Mehul Shah',prescription_id:'RX-2026-001'},items:[lineItem('Paracetamol 500mg (strip/10)',PH(1),3,18,12,'30049099','strip'),lineItem('Crocin Cold & Flu (strip/10)',PH(3),2,55,12,'30049099','strip')]},
      {n:2,pi:2,  status:'paid',   method:'upi', ago:4,domainData:{patient_name:'Sunita Patel',patient_age:38,doctor_name:'Dr. Priya Joshi',prescription_id:'RX-2026-002'},items:[lineItem('Amoxicillin 250mg (strip/10)',PH(2),2,65,12,'30041020','strip'),lineItem('Omeprazole 20mg (strip/10)',PH(5),2,35,12,'30049099','strip'),lineItem('Becosules Capsules (30)',PH(4),1,90,12,'30049099','box')]},
      {n:3,pi:1,  status:'paid',   method:'cash',ago:3,domainData:{patient_name:'Ramesh Patel',patient_age:45,doctor_name:'Dr. Mehul Shah'},items:[lineItem('Dolo 650 (strip/15)',PH(8),4,35,12,'30049099','strip'),lineItem('Cetrizine 10mg (strip/10)',PH(7),2,28,12,'30049099','strip')]},
      {n:4,pi:null,status:'paid',  method:'cash',ago:2,domainData:{patient_name:'Walk-in Customer'},items:[lineItem('Betadine Solution 100ml',PH(6),1,80,12,'30059090','bottle'),lineItem('Paracetamol 500mg (strip/10)',PH(1),5,18,12,'30049099','strip')]},
      {n:5,pi:2,  status:'partial',method:'upi', ago:1,domainData:{patient_name:'Sunita Patel',patient_age:38,doctor_name:'Dr. Priya Joshi',prescription_id:'RX-2026-003'},items:[lineItem('Omeprazole 20mg (strip/10)',PH(5),3,35,12,'30049099','strip'),lineItem('Amoxicillin 250mg (strip/10)',PH(2),3,65,12,'30041020','strip'),lineItem('Becosules Capsules (30)',PH(4),2,90,12,'30049099','box')]},
    ]})

  // ── Electronics ───────────────────────────────────────────────────────────
  const EL=(i:number)=>uid(35,2,i,0)
  await seedDomain({ o:35, slug:'digismart-electronics', name:'DigiSmart Electronics', phone:'9933445566', ownerName:'Nirav Patel', pin:'7777', branchName:'DigiSmart Electronics - RC Dutt Road', domainType:'electronics', prefix:'DSE', gstin:'24AABCD1234C1Z9', domainConfig:{ warranty_tracking:true, serial_no_required:true },
    categories:[
      {slug:'tv',         name:'TV & Display',    icon:'📺',color:'#1e40af',sortOrder:0},
      {slug:'mobile',     name:'Mobile & Tablets',icon:'📱',color:'#7c3aed',sortOrder:1},
      {slug:'laptop',     name:'Laptops & PCs',   icon:'💻',color:'#0f766e',sortOrder:2},
      {slug:'audio',      name:'Audio',           icon:'🎧',color:'#b91c1c',sortOrder:3},
      {slug:'peripherals',name:'Peripherals',     icon:'🖱️',color:'#374151',sortOrder:4},
      {slug:'ac',         name:'AC & Cooling',    icon:'❄️',color:'#0284c7',sortOrder:5},
    ],
    brands:[
      {slug:'samsung', name:'Samsung'},
      {slug:'apple',   name:'Apple'},
      {slug:'hp',      name:'HP'},
      {slug:'sony',    name:'Sony'},
      {slug:'lg',      name:'LG'},
      {slug:'boat',    name:'boAt'},
      {slug:'logitech',name:'Logitech'},
    ],
    prods:[
      {i:1,name:'Samsung 65" 4K QLED TV',  sku:'TV-SAM-65-4K', hsn:'85287200',gst:28,unit:'pcs',pp:55000,sp:72000,mrp:75000,low:2,stock:8, attrs:{brand:'Samsung',warranty_months:12,serial_required:true,category:'tv'},         cat:'tv',         brand:'samsung'},
      {i:2,name:'iPhone 15 128GB',          sku:'PH-APL-15-128',hsn:'85171300',gst:18,unit:'pcs',pp:62000,sp:79000,mrp:79900,low:3,stock:12,attrs:{brand:'Apple',  warranty_months:12,serial_required:true,category:'mobile'},       cat:'mobile',     brand:'apple'},
      {i:3,name:'HP Laptop 15s-fq5007TU',  sku:'LP-HP-15S',    hsn:'84713010',gst:18,unit:'pcs',pp:38000,sp:48000,mrp:50000,low:2,stock:6, attrs:{brand:'HP',     warranty_months:12,serial_required:true,category:'laptop'},       cat:'laptop',     brand:'hp'},
      {i:4,name:'boAt Airdopes 141',        sku:'AU-BOA-141',   hsn:'85183000',gst:18,unit:'pcs',pp:700,  sp:1200, mrp:1299, low:5,stock:40,attrs:{brand:'boAt',   warranty_months:12,serial_required:false,category:'audio'},       cat:'audio',      brand:'boat'},
      {i:5,name:'Logitech MX Master 3 Mouse',sku:'PC-LGI-MX3',  hsn:'84716060',gst:18,unit:'pcs',pp:4500,sp:6500, mrp:6995, low:3,stock:15,attrs:{brand:'Logitech',warranty_months:24,serial_required:false,category:'peripherals'},cat:'peripherals',brand:'logitech'},
      {i:6,name:'Samsung 1.5T AC (Inverter)',sku:'AC-SAM-15T',  hsn:'84151010',gst:28,unit:'pcs',pp:28000,sp:38000,mrp:40000,low:1,stock:5, attrs:{brand:'Samsung',warranty_months:60,serial_required:true,category:'ac'},         cat:'ac',         brand:'samsung'},
    ],
    parties:[
      {i:1,type:'customer',name:'Jayesh Shah',   phone:'9712343001',bal:0,  limit:50000},
      {i:2,type:'customer',name:'Arpit Desai',   phone:'9712343002',bal:5000,limit:100000},
      {i:3,type:'supplier',name:'Ingram Micro India',phone:'9800503001',bal:-150000,gstin:'27AABCI5001M1Z3'},
    ],
    invs:[
      {n:1,pi:1,  status:'paid',   method:'card',ago:6,items:[lineItem('boAt Airdopes 141',EL(4),2,1200,18,'85183000'),lineItem('Logitech MX Master 3 Mouse',EL(5),1,6500,18,'84716060')]},
      {n:2,pi:2,  status:'paid',   method:'bank_transfer',ago:5,items:[lineItem('Samsung 65" 4K QLED TV',EL(1),1,72000,28,'85287200'),lineItem('Samsung 1.5T AC (Inverter)',EL(6),1,38000,28,'84151010')]},
      {n:3,pi:1,  status:'partial',method:'card',ago:3,items:[lineItem('iPhone 15 128GB',EL(2),1,79000,18,'85171300')]},
      {n:4,pi:null,status:'paid',  method:'upi', ago:2,items:[lineItem('boAt Airdopes 141',EL(4),3,1200,18,'85183000'),lineItem('Logitech MX Master 3 Mouse',EL(5),2,6500,18,'84716060')]},
      {n:5,pi:2,  status:'confirmed',method:null,ago:0,items:[lineItem('HP Laptop 15s-fq5007TU',EL(3),2,48000,18,'84713010')]},
    ]})

  // ── Enterprise / B2B Distributor ──────────────────────────────────────────
  const EN=(i:number)=>uid(36,2,i,0)
  await seedDomain({ o:36, slug:'apex-distributors', name:'Apex Distributors Pvt Ltd', phone:'9911223344', ownerName:'Mahendra Agrawal', pin:'5555', branchName:'Apex Distributors - Waghodia Road', domainType:'enterprise', prefix:'APX', gstin:'24AABCA5678B1Z2', domainConfig:{ eway_bill:true, credit_terms:true, multi_branch:true },
    categories:[
      {slug:'staples',     name:'Staples',      icon:'🌾',color:'#f59e0b',sortOrder:0},
      {slug:'beverages',   name:'Beverages',    icon:'🥤',color:'#3b82f6',sortOrder:1},
      {slug:'personal_care',name:'Personal Care',icon:'🧴',color:'#ec4899',sortOrder:2},
      {slug:'cleaning',    name:'Cleaning',     icon:'🧹',color:'#10b981',sortOrder:3},
    ],
    brands:[
      {slug:'colgate',    name:'Colgate'},
      {slug:'hul',        name:'HUL'},
      {slug:'britannia',  name:'Britannia'},
      {slug:'dettol',     name:'Dettol'},
      {slug:'surf_excel', name:'Surf Excel'},
    ],
    prods:[
      {i:1,name:'Colgate Total SF Paste 200g (case/24)',sku:'EN-CLG-200-C', hsn:'33061000',gst:18,unit:'case',pp:1200,sp:1500,mrp:1600,low:10,stock:80, attrs:{case_qty:24,min_order_qty:5,brand:'Colgate'},   cat:'personal_care',brand:'colgate'},
      {i:2,name:'Vim Bar 250g (case/48)',               sku:'EN-VIM-250-C', hsn:'34022090',gst:18,unit:'case',pp:480, sp:600, mrp:650, low:15,stock:120,attrs:{case_qty:48,min_order_qty:10,brand:'Vim'},      cat:'cleaning',    brand:'hul'},
      {i:3,name:'Surf Excel Easy Wash 1kg (case/12)',   sku:'EN-SFX-1K-C',  hsn:'34022090',gst:18,unit:'case',pp:1800,sp:2200,mrp:2400,low:8, stock:60, attrs:{case_qty:12,min_order_qty:4,brand:'Surf Excel'},cat:'cleaning',    brand:'surf_excel'},
      {i:4,name:'Lux Soap 100g (case/36)',              sku:'EN-LUX-100-C', hsn:'34011100',gst:18,unit:'case',pp:900, sp:1100,mrp:1200,low:12,stock:90, attrs:{case_qty:36,min_order_qty:5,brand:'Lux'},       cat:'personal_care',brand:'hul'},
      {i:5,name:'Dettol Handwash 250ml (case/24)',      sku:'EN-DTL-250-C', hsn:'34012010',gst:18,unit:'case',pp:2400,sp:3000,mrp:3200,low:6, stock:40, attrs:{case_qty:24,min_order_qty:3,brand:'Dettol'},    cat:'personal_care',brand:'dettol'},
      {i:6,name:'Britannia Good Day 200g (case/24)',    sku:'EN-BRT-GD-C',  hsn:'19059090',gst:18,unit:'case',pp:840, sp:1050,mrp:1100,low:10,stock:70, attrs:{case_qty:24,min_order_qty:5,brand:'Britannia'},  cat:'staples',     brand:'britannia'},
    ],
    parties:[
      {i:1,type:'customer',name:'Metro Retail Chain',   phone:'9712344001',bal:45000,limit:200000,gstin:'24AABCM4001R1Z2'},
      {i:2,type:'customer',name:'Big Bazaar Baroda',    phone:'9712344002',bal:80000,limit:500000,gstin:'24AABCB4001Z1Z9'},
      {i:3,type:'supplier',name:'HUL Direct Sales',     phone:'9800504001',bal:-200000,gstin:'27AABCH0001L1Z5'},
    ],
    invs:[
      {n:1,pi:1,status:'paid',   method:'bank_transfer',ago:7,items:[lineItem('Colgate Total SF Paste 200g (case/24)',EN(1),20,1500,18,'33061000','case'),lineItem('Vim Bar 250g (case/48)',EN(2),30,600,18,'34022090','case'),lineItem('Lux Soap 100g (case/36)',EN(4),25,1100,18,'34011100','case')]},
      {n:2,pi:2,status:'partial',method:'bank_transfer',ago:5,items:[lineItem('Surf Excel Easy Wash 1kg (case/12)',EN(3),15,2200,18,'34022090','case'),lineItem('Dettol Handwash 250ml (case/24)',EN(5),10,3000,18,'34012010','case'),lineItem('Britannia Good Day 200g (case/24)',EN(6),20,1050,18,'19059090','case')]},
      {n:3,pi:1,status:'confirmed',method:null,ago:2,items:[lineItem('Vim Bar 250g (case/48)',EN(2),50,600,18,'34022090','case'),lineItem('Colgate Total SF Paste 200g (case/24)',EN(1),30,1500,18,'33061000','case')]},
      {n:4,pi:2,status:'paid',   method:'bank_transfer',ago:1,items:[lineItem('Lux Soap 100g (case/36)',EN(4),40,1100,18,'34011100','case'),lineItem('Dettol Handwash 250ml (case/24)',EN(5),15,3000,18,'34012010','case')]},
    ]})

  // ── All new domain tenants ────────────────────────────────────────────────
  const SL=(i:number)=>uid(20,2,i,0), WS=(i:number)=>uid(21,2,i,0), SW=(i:number)=>uid(22,2,i,0)
  const CL=(i:number)=>uid(23,2,i,0), OP=(i:number)=>uid(24,2,i,0), JW=(i:number)=>uid(25,2,i,0)
  const AU=(i:number)=>uid(26,2,i,0), TX=(i:number)=>uid(27,2,i,0), HT=(i:number)=>uid(28,2,i,0)
  const CA=(i:number)=>uid(29,2,i,0), CO=(i:number)=>uid(30,2,i,0), PR=(i:number)=>uid(31,2,i,0)
  const LA=(i:number)=>uid(32,2,i,0)

  await seedDomain({ o:20, slug:'glamour-salon', name:'Glamour Salon & Spa', phone:'9844001001', ownerName:'Pooja Iyer', pin:'8001', branchName:'Glamour Salon - Alkapuri', domainType:'salon', prefix:'GL', domainConfig:{ has_appointments:true, commission_enabled:true },
    categories:[
      {slug:'hair_care', name:'Hair Care', icon:'💇',color:'#ec4899',sortOrder:0},
      {slug:'skin_care', name:'Skin Care', icon:'✨',color:'#f59e0b',sortOrder:1},
      {slug:'nail_care', name:'Nail Care', icon:'💅',color:'#a78bfa',sortOrder:2},
      {slug:'waxing',    name:'Waxing',    icon:'🪮',color:'#f97316',sortOrder:3},
      {slug:'threading', name:'Threading', icon:'🧵',color:'#10b981',sortOrder:4},
    ],
    prods:[
      // Services — not stocked, not consumable
      {i:1,name:'Haircut (Male)',    sku:'SVC-HC-M',hsn:'999721',gst:18,unit:'svc',pp:100,sp:150,mrp:150,low:0,stock:0,trackStock:false,consumable:false,attrs:{duration_min:30,gender:'male',commission_type:'pct',commission_value:10},cat:'hair_care'},
      {i:2,name:'Facial (Basic)',    sku:'SVC-FAC', hsn:'999721',gst:18,unit:'svc',pp:250,sp:399,mrp:399,low:0,stock:0,trackStock:false,consumable:false,attrs:{duration_min:45,gender:'female',commission_type:'pct',commission_value:15},cat:'skin_care'},
      {i:3,name:'Head Massage',      sku:'SVC-HM',  hsn:'999721',gst:18,unit:'svc',pp:120,sp:199,mrp:199,low:0,stock:0,trackStock:false,consumable:false,attrs:{duration_min:30,gender:'unisex',commission_type:'pct',commission_value:10},cat:'hair_care'},
      {i:4,name:'Waxing (Full Arms)',sku:'SVC-WAX', hsn:'999721',gst:18,unit:'svc',pp:100,sp:180,mrp:180,low:0,stock:0,trackStock:false,consumable:false,attrs:{duration_min:20,gender:'female',commission_type:'pct',commission_value:12},cat:'waxing'},
      // Consumables — stocked internally, used during service delivery
      {i:5,name:'Rica Wax (500g)',     sku:'CON-RICA',  hsn:'34051000',gst:18,unit:'g',  pp:180,sp:0,mrp:0,low:100,stock:500, trackStock:true,consumable:true,attrs:{},cat:'waxing'},
      {i:6,name:'Shampoo Sachet (8ml)',sku:'CON-SHP',   hsn:'33051000',gst:18,unit:'pcs',pp:3,  sp:0,mrp:0,low:20, stock:80,  trackStock:true,consumable:true,attrs:{},cat:'hair_care'},
      {i:7,name:'Facial Cream (50ml)', sku:'CON-FCR',   hsn:'33049900',gst:18,unit:'ml', pp:120,sp:0,mrp:0,low:50, stock:200, trackStock:true,consumable:true,attrs:{},cat:'skin_care'},
      {i:8,name:'Threading Thread (spool)',sku:'CON-THD',hsn:'52052000',gst:5, unit:'pcs',pp:25, sp:0,mrp:0,low:2,  stock:10,  trackStock:true,consumable:true,attrs:{},cat:'threading'},
    ],
    parties:[{i:1,type:'customer',name:'Priya Shah',phone:'9712340001',bal:0,limit:500},{i:2,type:'supplier',name:'Lotus Beauty Supplies',phone:'9800100001',bal:-4500}],
    invs:[
      {n:1,pi:1,status:'paid',method:'cash',ago:3,domainData:{staff_name:'Priya'},items:[lineItem('Haircut (Male)',SL(1),1,150,18,'999721','svc'),lineItem('Head Massage',SL(3),1,199,18,'999721','svc')]},
      {n:2,pi:null,status:'paid',method:'upi',ago:1,domainData:{staff_name:'Kavita'},items:[lineItem('Facial (Basic)',SL(2),1,399,18,'999721','svc'),lineItem('Waxing (Full Arms)',SL(4),1,180,18,'999721','svc')]},
      {n:3,pi:1,status:'confirmed',method:null,ago:0,domainData:{staff_name:'Priya'},items:[lineItem('Head Massage',SL(3),1,199,18,'999721','svc')]},
    ]})

  await seedDomain({ o:21, slug:'krishna-wholesale', name:'Krishna Wholesale Traders', phone:'9844002002', ownerName:'Krishna Agrawal', pin:'8002', branchName:'Krishna Wholesale - Main', domainType:'wholesale', prefix:'KW', gstin:'24AABCK5001W1Z4', domainConfig:{ eway_bill:true, credit_terms:true },
    categories:[
      {slug:'staples',  name:'Staples',  icon:'🌾',color:'#f59e0b',sortOrder:0},
      {slug:'beverages',name:'Beverages',icon:'🥤',color:'#3b82f6',sortOrder:1},
      {slug:'cleaning', name:'Cleaning', icon:'🧹',color:'#10b981',sortOrder:2},
    ],
    brands:[
      {slug:'colgate',   name:'Colgate'},
      {slug:'hul',       name:'HUL'},
      {slug:'britannia', name:'Britannia'},
      {slug:'dettol',    name:'Dettol'},
      {slug:'surf_excel',name:'Surf Excel'},
    ],
    prods:[
      {i:1,name:'Basmati Rice 25kg',sku:'WS-RICE-25',hsn:'10063000',gst:5, unit:'bag',pp:1400,sp:1600,mrp:1650,low:20,stock:200,attrs:{case_qty:1,min_order_qty:10},cat:'staples'},
      {i:2,name:'Sugar 50kg',       sku:'WS-SUG-50', hsn:'17011200',gst:5, unit:'bag',pp:1900,sp:2050,mrp:2100,low:15,stock:150,attrs:{case_qty:1,min_order_qty:5}, cat:'staples'},
      {i:3,name:'Wheat Atta 30kg',  sku:'WS-ATT-30', hsn:'11010000',gst:0, unit:'bag',pp:800, sp:900, mrp:950, low:25,stock:300,attrs:{case_qty:1,min_order_qty:10},cat:'staples'},
      {i:4,name:'Refined Oil 15L',  sku:'WS-OIL-15', hsn:'15121100',gst:5, unit:'tin',pp:1550,sp:1700,mrp:1750,low:10,stock:80, attrs:{case_qty:4,min_order_qty:4}, cat:'staples'},
    ],
    parties:[{i:1,type:'customer',name:'Ganesh Retail Store',phone:'9712340010',bal:8500,limit:25000,gstin:'24AABCG1111B1Z0'},{i:2,type:'customer',name:'Raj General Stores',phone:'9712340011',bal:12000,limit:30000}],
    invs:[
      {n:1,pi:1,status:'paid',method:'bank_transfer',ago:5,items:[lineItem('Basmati Rice 25kg',WS(1),10,1600,5,'10063000','bag'),lineItem('Sugar 50kg',WS(2),5,2050,5,'17011200','bag')]},
      {n:2,pi:2,status:'confirmed',method:null,ago:2,items:[lineItem('Wheat Atta 30kg',WS(3),15,900,0,'11010000','bag'),lineItem('Refined Oil 15L',WS(4),8,1700,5,'15121100','tin')]},
      {n:3,pi:1,status:'partial',method:'bank_transfer',ago:1,items:[lineItem('Basmati Rice 25kg',WS(1),20,1600,5,'10063000','bag'),lineItem('Refined Oil 15L',WS(4),5,1700,5,'15121100','tin')]},
    ]})

  await seedDomain({ o:22, slug:'madhuram-sweets', name:'Madhuram Sweets & Farsan', phone:'9844003003', ownerName:'Hasmukh Patel', pin:'8003', branchName:'Madhuram Sweets - Main', domainType:'sweet', prefix:'MS', domainConfig:{ sold_by_weight:true, has_advance_orders:true },
    categories:[
      {slug:'traditional',name:'Traditional',icon:'🍬',color:'#f59e0b',sortOrder:0},
      {slug:'chocolate',  name:'Chocolate',  icon:'🍫',color:'#92400e',sortOrder:1},
      {slug:'dry_fruits', name:'Dry Fruits', icon:'🥜',color:'#78350f',sortOrder:2},
      {slug:'seasonal',   name:'Seasonal',   icon:'🪔',color:'#dc2626',sortOrder:3},
    ],
    prods:[
      {i:1,name:'Kaju Katli',       sku:'SW-KK',hsn:'21069099',gst:5,unit:'kg',  pp:550,sp:700,mrp:700,low:2,stock:15,attrs:{sold_by:'weight',shelf_life_hrs:72,box_eligible:true}},
      {i:2,name:'Motichoor Ladoo',  sku:'SW-ML',hsn:'21069099',gst:5,unit:'kg',  pp:280,sp:380,mrp:380,low:2,stock:20,attrs:{sold_by:'weight',shelf_life_hrs:48,box_eligible:true}},
      {i:3,name:'Gulab Jamun 500g', sku:'SW-GJ',hsn:'21069099',gst:5,unit:'box', pp:80, sp:110,mrp:110,low:5,stock:30,attrs:{sold_by:'piece',shelf_life_hrs:36}},
      {i:4,name:'Besan Chakli 250g',sku:'SW-BC',hsn:'21069099',gst:5,unit:'pkt', pp:45, sp:60, mrp:65, low:8,stock:40,attrs:{sold_by:'piece',shelf_life_hrs:168}},
    ],
    parties:[{i:1,type:'customer',name:'Santosh Mehta',phone:'9712340020',bal:680,limit:1000},{i:2,type:'customer',name:'Celebrations Events',phone:'9712340021',bal:0,limit:5000}],
    invs:[
      {n:1,pi:1,status:'paid',method:'cash',ago:2,items:[lineItem('Kaju Katli',SW(1),2,700,5,'21069099','kg'),lineItem('Motichoor Ladoo',SW(2),1.5,380,5,'21069099','kg')]},
      {n:2,pi:2,status:'partial',method:'upi',ago:1,items:[lineItem('Kaju Katli',SW(1),5,700,5,'21069099','kg'),lineItem('Gulab Jamun 500g',SW(3),10,110,5,'21069099','box')]},
      {n:3,pi:1,status:'paid',method:'cash',ago:0,items:[lineItem('Gulab Jamun 500g',SW(3),2,110,5,'21069099','box'),lineItem('Besan Chakli 250g',SW(4),3,60,5,'21069099','pkt')]},
    ]})

  await seedDomain({ o:23, slug:'sunrise-clinic', name:'Sunrise Multi-Speciality Clinic', phone:'9844004004', ownerName:'Dr. Rajesh Mehta', pin:'8004', branchName:'Sunrise Clinic - Sayaji Gunj', domainType:'clinic', prefix:'SC', domainConfig:{ has_patients:true, has_appointments:true },
    categories:[
      {slug:'consultation',name:'Consultation',icon:'👨‍⚕️',color:'#3b82f6',sortOrder:0},
      {slug:'medicines',   name:'Medicines',   icon:'💊',color:'#ef4444',sortOrder:1},
      {slug:'procedures',  name:'Procedures',  icon:'🩺',color:'#f97316',sortOrder:2},
      {slug:'tests',       name:'Tests',       icon:'🧪',color:'#10b981',sortOrder:3},
    ],
    prods:[
      {i:1,name:'OPD Consultation',     sku:'SVC-OPD',hsn:'999319',gst:0,unit:'svc',pp:200,sp:300,mrp:300,low:0,stock:0,trackStock:false,consumable:false,attrs:{service_type:'consultation',duration_min:15,department:'general'}},
      {i:2,name:'CBC Blood Test',        sku:'LAB-CBC',hsn:'999319',gst:0,unit:'svc',pp:150,sp:250,mrp:250,low:0,stock:0,trackStock:false,consumable:false,attrs:{service_type:'lab_test',lab_report_hrs:4}},
      {i:3,name:'Lipid Profile',         sku:'LAB-LIP',hsn:'999319',gst:0,unit:'svc',pp:200,sp:350,mrp:350,low:0,stock:0,trackStock:false,consumable:false,attrs:{service_type:'lab_test',lab_report_hrs:8,fasting_required:true}},
      {i:4,name:'X-Ray Chest (PA view)', sku:'IMG-XRC',hsn:'999319',gst:0,unit:'svc',pp:180,sp:300,mrp:300,low:0,stock:0,trackStock:false,consumable:false,attrs:{service_type:'imaging',department:'ortho'}},
    ],
    parties:[{i:1,type:'customer',name:'Ramesh Kumar',phone:'9712340030',bal:0},{i:2,type:'customer',name:'Asha Trivedi',phone:'9712340031',bal:350}],
    invs:[
      {n:1,pi:1,status:'paid',method:'cash',ago:4,domainData:{visit_type:'opd',patient_name:'Ramesh Kumar',patient_age:52,patient_gender:'M',referral_doctor:'Dr. Arun Bhatt'},items:[lineItem('OPD Consultation',CL(1),1,300,0,'999319','svc'),lineItem('CBC Blood Test',CL(2),1,250,0,'999319','svc')]},
      {n:2,pi:2,status:'paid',method:'upi',ago:2,domainData:{visit_type:'follow_up',patient_name:'Asha Trivedi',patient_age:45,patient_gender:'F'},items:[lineItem('OPD Consultation',CL(1),1,300,0,'999319','svc'),lineItem('Lipid Profile',CL(3),1,350,0,'999319','svc'),lineItem('X-Ray Chest (PA view)',CL(4),1,300,0,'999319','svc')]},
      {n:3,pi:1,status:'confirmed',method:null,ago:0,domainData:{visit_type:'opd',patient_name:'Ramesh Kumar',patient_age:52,patient_gender:'M'},items:[lineItem('CBC Blood Test',CL(2),1,250,0,'999319','svc'),lineItem('Lipid Profile',CL(3),1,350,0,'999319','svc')]},
    ]})

  await seedDomain({ o:24, slug:'vision-plus-optical', name:'Vision Plus Optical', phone:'9844005005', ownerName:'Nilesh Shah', pin:'8005', branchName:'Vision Plus - Main', domainType:'optical', prefix:'VP', domainConfig:{ has_prescriptions:true, warranty_tracking:true },
    categories:[
      {slug:'frames',       name:'Frames',        icon:'🕶️',color:'#374151',sortOrder:0},
      {slug:'lenses',       name:'Lenses',        icon:'🔍',color:'#3b82f6',sortOrder:1},
      {slug:'sunglasses',   name:'Sunglasses',    icon:'😎',color:'#f59e0b',sortOrder:2},
      {slug:'contact_lenses',name:'Contact Lenses',icon:'👁️',color:'#10b981',sortOrder:3},
    ],
    brands:[
      {slug:'ray_ban',   name:'Ray-Ban'},
      {slug:'titan_eye', name:'Titan Eye'},
      {slug:'bausch',    name:'Bausch & Lomb'},
    ],
    prods:[
      {i:1,name:'Titan Eye+ Frame',              sku:'FR-TIT-001',hsn:'90049000',gst:12,unit:'pcs', pp:800, sp:1200,mrp:1299,low:3,stock:20,attrs:{product_type:'frame',brand:'Titan Eye+',warranty_months:12},cat:'frames',brand:'titan_eye'},
      {i:2,name:'Rayban Wayfarer Frame',          sku:'FR-RB-002', hsn:'90049000',gst:12,unit:'pcs', pp:2000,sp:3200,mrp:3500,low:2,stock:8, attrs:{product_type:'frame',brand:'Rayban',warranty_months:12},cat:'frames',brand:'ray_ban'},
      {i:3,name:'Single Vision CR39 Lens (pair)', sku:'LN-SV-CR39',hsn:'90015000',gst:12,unit:'pair',pp:300, sp:600, mrp:650, low:5,stock:50,attrs:{product_type:'lens',lens_type:'single_vision',coating:['AR','UV400']},cat:'lenses',brand:'bausch'},
      {i:4,name:'Acuvue Contact Lens (monthly)',  sku:'CL-ACU-M',  hsn:'90021900',gst:12,unit:'pair',pp:250, sp:400, mrp:450, low:10,stock:30,attrs:{product_type:'contact_lens',brand:'Acuvue'},cat:'contact_lenses'},
    ],
    parties:[{i:1,type:'customer',name:'Meena Patel',phone:'9712340040',bal:600,limit:2000},{i:2,type:'supplier',name:'Essilor India',phone:'9800200001',bal:-8000}],
    invs:[
      {n:1,pi:1,status:'paid',method:'card',ago:3,domainData:{patient_name:'Meena Patel',patient_age:34,re_sph:'-1.50',re_cyl:'-0.50',re_axis:'90',le_sph:'-1.25',le_cyl:'0.00',le_axis:'0',add_power:''},items:[lineItem('Titan Eye+ Frame',OP(1),1,1200,12,'90049000','pcs'),lineItem('Single Vision CR39 Lens (pair)',OP(3),1,600,12,'90015000','pair')]},
      {n:2,pi:1,status:'partial',method:'cash',ago:1,domainData:{patient_name:'Meena Patel',patient_age:34,re_sph:'-2.00',re_cyl:'-0.75',re_axis:'180',le_sph:'-1.75',le_cyl:'-0.50',le_axis:'175'},items:[lineItem('Rayban Wayfarer Frame',OP(2),1,3200,12,'90049000','pcs'),lineItem('Single Vision CR39 Lens (pair)',OP(3),1,600,12,'90015000','pair')]},
      {n:3,pi:null,status:'paid',method:'upi',ago:0,domainData:{patient_name:'Walk-in Customer'},items:[lineItem('Acuvue Contact Lens (monthly)',OP(4),2,400,12,'90021900','pair')]},
    ]})

  await seedDomain({ o:25, slug:'shubhlaxmi-jewellers', name:'Shubhlaxmi Jewellers', phone:'9844006006', ownerName:'Suresh Zaveri', pin:'8006', branchName:'Shubhlaxmi Jewellers - Main', domainType:'jewellery', prefix:'SJ', gstin:'24AABCS7001J1Z8', domainConfig:{ live_gold_rate:true, hallmark_required:true, old_gold_exchange:true },
    categories:[
      {slug:'gold',       name:'Gold',       icon:'🥇',color:'#f59e0b',sortOrder:0},
      {slug:'silver',     name:'Silver',     icon:'🥈',color:'#9ca3af',sortOrder:1},
      {slug:'diamond',    name:'Diamond',    icon:'💎',color:'#67e8f9',sortOrder:2},
      {slug:'accessories',name:'Accessories',icon:'✨',color:'#a78bfa',sortOrder:3},
    ],
    brands:[
      {slug:'tanishq',name:'Tanishq'},
      {slug:'kalyan',  name:'Kalyan'},
      {slug:'malabar', name:'Malabar'},
    ],
    prods:[
      {i:1,name:'Gold Ring 22K (per gram)',        sku:'JW-GR-22K',hsn:'71131900',gst:3,unit:'gm', pp:5800,sp:6200,mrp:6200,low:0,stock:100,attrs:{metal:'gold',purity:'22K',category:'ring',making_charge_type:'per_gram',making_charge_value:400},cat:'gold'},
      {i:2,name:'Silver Bracelet 925 (per gram)',  sku:'JW-SB-925', hsn:'71131100',gst:3,unit:'gm', pp:70,  sp:90,  mrp:90,  low:0,stock:500,attrs:{metal:'silver',purity:'925',category:'bracelet',making_charge_type:'per_gram',making_charge_value:50},cat:'silver'},
      {i:3,name:'Diamond Pendant',                sku:'JW-DP-001', hsn:'71131900',gst:3,unit:'pcs',pp:12000,sp:18000,mrp:18000,low:0,stock:5,attrs:{metal:'diamond',category:'pendant',is_studded:true,making_charge_type:'fixed',making_charge_value:2000},cat:'diamond'},
      {i:4,name:'Making Charges',                 sku:'JW-MC',     hsn:'71131900',gst:5,unit:'svc',pp:0,   sp:1,   mrp:1,   low:0,stock:0,trackStock:false,consumable:false,  attrs:{metal:'gold',making_charge_type:'fixed',making_charge_value:0}},
    ],
    parties:[{i:1,type:'customer',name:'Jyoti Sharma',phone:'9712340050',bal:5000,limit:10000},{i:2,type:'supplier',name:'Mehta Gold Refinery',phone:'9800300001',bal:-50000,gstin:'24AABCM9001G1Z2'}],
    invs:[
      {n:1,pi:1,status:'paid',method:'cash',ago:4,items:[lineItem('Gold Ring 22K (per gram)',JW(1),5,6200,3,'71131900','gm'),lineItem('Making Charges',JW(4),2000,1,5,'71131900','svc')]},
      {n:2,pi:null,status:'paid',method:'upi',ago:2,items:[lineItem('Silver Bracelet 925 (per gram)',JW(2),20,90,3,'71131100','gm')]},
      {n:3,pi:1,status:'partial',method:'cash',ago:1,items:[lineItem('Diamond Pendant',JW(3),1,18000,3,'71131900','pcs'),lineItem('Making Charges',JW(4),2000,1,5,'71131900','svc')]},
    ]})

  await seedDomain({ o:26, slug:'shiv-auto-works', name:'Shiv Auto Works', phone:'9844007007', ownerName:'Bharat Parmar', pin:'8007', branchName:'Shiv Auto Works - Waghodia Road', domainType:'automobile', prefix:'SAW', domainConfig:{ job_card_enabled:true, vehicle_tracking:true, spare_parts_stock:true },
    categories:[
      {slug:'engine_parts',name:'Engine Parts',icon:'⚙️',color:'#374151',sortOrder:0},
      {slug:'body_parts',  name:'Body Parts',  icon:'🚗',color:'#3b82f6',sortOrder:1},
      {slug:'electrical',  name:'Electrical',  icon:'⚡',color:'#f59e0b',sortOrder:2},
      {slug:'tyres',       name:'Tyres',       icon:'🛞',color:'#111827',sortOrder:3},
      {slug:'accessories', name:'Accessories', icon:'🔧',color:'#10b981',sortOrder:4},
    ],
    brands:[
      {slug:'bosch',   name:'Bosch'},
      {slug:'exide',   name:'Exide'},
      {slug:'mrf',     name:'MRF'},
      {slug:'castrol', name:'Castrol'},
    ],
    prods:[
      {i:1,name:'Castrol GTX Engine Oil 4L',  sku:'AU-OIL-4L', hsn:'27101980',gst:18,unit:'can',pp:600,sp:780,mrp:800,low:5,stock:30,attrs:{part_type:'oil',brand:'Castrol',vehicle_type:'car',is_labour:false},cat:'engine_parts',brand:'castrol'},
      {i:2,name:'Bosch Brake Pads (set of 4)',sku:'AU-BP-BOH',  hsn:'87083000',gst:28,unit:'set',pp:800,sp:1100,mrp:1200,low:3,stock:15,attrs:{part_type:'spare_part',brand:'Bosch',warranty_months:6,is_labour:false},cat:'body_parts',brand:'bosch'},
      {i:3,name:'General Service Labour',     sku:'SVC-GEN',    hsn:'998714',  gst:18,unit:'svc',pp:0,  sp:500,mrp:500, low:0,stock:0,trackStock:false,consumable:false, attrs:{part_type:'labour',is_labour:true}},
      {i:4,name:'MRF Tyre 165/70R14',         sku:'AU-TYR-MRF', hsn:'40111000',gst:28,unit:'pcs',pp:2800,sp:3400,mrp:3600,low:4,stock:20,attrs:{part_type:'tyre',brand:'MRF',warranty_months:12},cat:'tyres',brand:'mrf'},
    ],
    parties:[{i:1,type:'customer',name:'Rajesh Shah',phone:'9712340060',bal:0,limit:5000},{i:2,type:'supplier',name:'Jai Auto Parts',phone:'9800400001',bal:-15000}],
    invs:[
      {n:1,pi:1,status:'paid',method:'upi',ago:3,items:[lineItem('Castrol GTX Engine Oil 4L',AU(1),1,780,18,'27101980','can'),lineItem('General Service Labour',AU(3),1,500,18,'998714','svc')]},
      {n:2,pi:1,status:'paid',method:'cash',ago:1,items:[lineItem('Bosch Brake Pads (set of 4)',AU(2),1,1100,28,'87083000','set'),lineItem('General Service Labour',AU(3),1,500,18,'998714','svc')]},
      {n:3,pi:null,status:'confirmed',method:null,ago:0,items:[lineItem('MRF Tyre 165/70R14',AU(4),4,3400,28,'40111000','pcs'),lineItem('General Service Labour',AU(3),1,500,18,'998714','svc')]},
    ]})

  await seedDomain({ o:27, slug:'anand-textiles', name:'Anand Textiles', phone:'9844008008', ownerName:'Anand Desai', pin:'8008', branchName:'Anand Textiles - Mangalpura', domainType:'textile', prefix:'AT', domainConfig:{ sold_by_meter:true, lot_tracking:true },
    categories:[
      {slug:'mens',   name:'Mens',    icon:'👔',color:'#1e40af',sortOrder:0},
      {slug:'womens', name:'Womens',  icon:'👗',color:'#ec4899',sortOrder:1},
      {slug:'kids',   name:'Kids',    icon:'👶',color:'#f97316',sortOrder:2},
      {slug:'fabrics',name:'Fabrics', icon:'🧵',color:'#10b981',sortOrder:3},
    ],
    brands:[
      {slug:'raymond',     name:'Raymond'},
      {slug:'arvind',      name:'Arvind'},
      {slug:'allen_solly', name:'Allen Solly'},
    ],
    prods:[
      {i:1,name:'Cotton Shirting (per meter)',  sku:'TX-COT-SH',hsn:'52081900',gst:5, unit:'mtr',pp:60, sp:85, mrp:90, low:20,stock:500,attrs:{fabric_type:'cotton',sold_by:'meter',width_cm:110,gsm:150,pattern:'plain'},cat:'fabrics',brand:'arvind'},
      {i:2,name:'Silk Saree (Bandhani)',        sku:'TX-SLK-BN',hsn:'54074200',gst:5, unit:'pcs',pp:800,sp:1200,mrp:1300,low:5,stock:30,attrs:{fabric_type:'silk',sold_by:'piece',pattern:'printed'},cat:'womens'},
      {i:3,name:'Polyester Suiting (per meter)',sku:'TX-POL-SU',hsn:'55151100',gst:12,unit:'mtr',pp:90, sp:130,mrp:140,low:15,stock:300,attrs:{fabric_type:'polyester',sold_by:'meter',width_cm:60,gsm:200},cat:'fabrics',brand:'raymond'},
      {i:4,name:'Linen Fabric (per meter)',     sku:'TX-LIN-CA',hsn:'53091900',gst:5, unit:'mtr',pp:120,sp:180,mrp:190,low:10,stock:200,attrs:{fabric_type:'linen',sold_by:'meter',width_cm:114},cat:'fabrics'},
    ],
    parties:[{i:1,type:'customer',name:'Suresh Tailors',phone:'9712340070',bal:2400,limit:10000},{i:2,type:'supplier',name:'Bombay Dyeing Ltd',phone:'9800500001',bal:-25000,gstin:'27AABCB1001D1Z5'}],
    invs:[
      {n:1,pi:1,status:'paid',method:'cash',ago:5,items:[lineItem('Cotton Shirting (per meter)',TX(1),20,85,5,'52081900','mtr'),lineItem('Polyester Suiting (per meter)',TX(3),8,130,12,'55151100','mtr')]},
      {n:2,pi:1,status:'confirmed',method:null,ago:2,items:[lineItem('Silk Saree (Bandhani)',TX(2),5,1200,5,'54074200','pcs')]},
      {n:3,pi:null,status:'partial',method:'upi',ago:1,items:[lineItem('Cotton Shirting (per meter)',TX(1),30,85,5,'52081900','mtr'),lineItem('Linen Fabric (per meter)',TX(4),15,180,5,'53091900','mtr')]},
    ]})

  await seedDomain({ o:28, slug:'hotel-surya-palace', name:'Hotel Surya Palace', phone:'9844009009', ownerName:'Suryakant Joshi', pin:'8009', branchName:'Hotel Surya Palace - Baroda', domainType:'hotel', prefix:'HSP', gstin:'24AABCH8001P1Z3', domainConfig:{ has_rooms:true, has_folio:true, checkout_time:'11:00' },
    categories:[
      {slug:'rooms',        name:'Rooms',         icon:'🛏️',color:'#3b82f6',sortOrder:0},
      {slug:'food_beverage',name:'Food & Beverage',icon:'🍽️',color:'#f59e0b',sortOrder:1},
      {slug:'services',     name:'Services',      icon:'🛎️',color:'#10b981',sortOrder:2},
      {slug:'amenities',    name:'Amenities',     icon:'🏊',color:'#a78bfa',sortOrder:3},
    ],
    prods:[
      {i:1,name:'Standard Room (per night)',  sku:'RM-STD',    hsn:'996311',gst:0, unit:'night',pp:700, sp:999, mrp:999, low:0,stock:0,trackStock:false,consumable:false,attrs:{service_type:'room',room_category:'standard',has_ac:false,max_occupancy:2}},
      {i:2,name:'AC Deluxe Room (per night)', sku:'RM-DLX-AC', hsn:'996311',gst:12,unit:'night',pp:1200,sp:1799,mrp:1799,low:0,stock:0,trackStock:false,consumable:false,attrs:{service_type:'room',room_category:'deluxe',has_ac:true,max_occupancy:2}},
      {i:3,name:'Breakfast (per person)',     sku:'FB-BRK',    hsn:'996331',gst:5, unit:'pax',  pp:80,  sp:150, mrp:150, low:0,stock:0,trackStock:false,consumable:false,attrs:{service_type:'restaurant'}},
      {i:4,name:'Airport Transfer',          sku:'TRF-ARPT',  hsn:'996413',gst:5, unit:'trip', pp:400, sp:600, mrp:600, low:0,stock:0,trackStock:false,consumable:false,attrs:{service_type:'other'}},
    ],
    parties:[{i:1,type:'customer',name:'Vikram Singh',phone:'9712340080',bal:0,limit:5000},{i:2,type:'customer',name:'Infosys Ltd (Corp)',phone:'9712340081',bal:0,limit:50000,gstin:'29AABCI1234B1Z1'}],
    invs:[
      {n:1,pi:1,status:'paid',method:'card',ago:4,domainData:{guest_name:'Vikram Singh',room_no:'201',check_in:'2026-06-22',check_out:'2026-06-24',pax_count:2},items:[lineItem('AC Deluxe Room (per night)',HT(2),2,1799,12,'996311','night'),lineItem('Breakfast (per person)',HT(3),4,150,5,'996331','pax'),lineItem('Airport Transfer',HT(4),1,600,5,'996413','trip')]},
      {n:2,pi:1,status:'confirmed',method:null,ago:0,domainData:{guest_name:'Vikram Singh',room_no:'105',check_in:'2026-06-26',check_out:'2026-06-29',pax_count:1},items:[lineItem('Standard Room (per night)',HT(1),3,999,0,'996311','night')]},
      {n:3,pi:2,status:'paid',method:'bank_transfer',ago:2,domainData:{guest_name:'Infosys Ltd (Corp)',room_no:'301,302',check_in:'2026-06-24',check_out:'2026-06-28',pax_count:4},items:[lineItem('AC Deluxe Room (per night)',HT(2),4,1799,12,'996311','night'),lineItem('Breakfast (per person)',HT(3),8,150,5,'996331','pax')]},
    ]})

  await seedDomain({ o:29, slug:'annapurna-catering', name:'Annapurna Catering Services', phone:'9844010010', ownerName:'Ramila Patel', pin:'8010', branchName:'Annapurna Catering - Main', domainType:'catering', prefix:'ACS', domainConfig:{ has_advance_orders:true, pax_based_billing:true },
    categories:[
      {slug:'starters',   name:'Starters',    icon:'🥗',color:'#10b981',sortOrder:0},
      {slug:'main_course',name:'Main Course',  icon:'🍛',color:'#f59e0b',sortOrder:1},
      {slug:'desserts',   name:'Desserts',     icon:'🍮',color:'#ec4899',sortOrder:2},
      {slug:'beverages',  name:'Beverages',    icon:'🥤',color:'#3b82f6',sortOrder:3},
    ],
    prods:[
      {i:1,name:'Veg Thali (per head)',      sku:'CAT-VT', hsn:'996331',gst:5, unit:'pax',  pp:180,sp:300,mrp:300,low:0,stock:0,trackStock:false,consumable:false,attrs:{service_type:'full_catering',menu_type:'veg',min_plates:50}},
      {i:2,name:'Non-Veg Thali (per head)', sku:'CAT-NVT',hsn:'996331',gst:5, unit:'pax',  pp:250,sp:400,mrp:400,low:0,stock:0,trackStock:false,consumable:false,attrs:{service_type:'full_catering',menu_type:'non_veg',min_plates:50}},
      {i:3,name:'Stage Decoration',         sku:'CAT-DEC',hsn:'999619',gst:18,unit:'event',pp:5000,sp:8000,mrp:8000,low:0,stock:0,trackStock:false,consumable:false,attrs:{service_type:'decoration'}},
      {i:4,name:'Corporate Lunch (per pax)',sku:'CAT-CL', hsn:'996331',gst:5, unit:'pax',  pp:120,sp:200,mrp:200,low:0,stock:0,trackStock:false,consumable:false,attrs:{service_type:'full_catering',menu_type:'veg',min_plates:20}},
    ],
    parties:[{i:1,type:'customer',name:'Patel Wedding House',phone:'9712340090',bal:15000,limit:100000},{i:2,type:'customer',name:'TechMahindra Baroda',phone:'9712340091',bal:0,limit:50000}],
    invs:[
      {n:1,pi:1,status:'partial',method:'bank_transfer',ago:3,domainData:{event_type:'wedding',event_date:'2026-06-23',pax_count:200,venue:'Sarthak Banquet Hall'},items:[lineItem('Veg Thali (per head)',CA(1),200,300,5,'996331','pax'),lineItem('Stage Decoration',CA(3),1,8000,18,'999619','event')]},
      {n:2,pi:2,status:'paid',method:'bank_transfer',ago:1,domainData:{event_type:'corporate',event_date:'2026-06-25',pax_count:60,venue:'TechMahindra Office'},items:[lineItem('Corporate Lunch (per pax)',CA(4),60,200,5,'996331','pax')]},
      {n:3,pi:1,status:'confirmed',method:null,ago:0,domainData:{event_type:'birthday',event_date:'2026-07-05',pax_count:100,is_advance_order:true},items:[lineItem('Non-Veg Thali (per head)',CA(2),100,400,5,'996331','pax'),lineItem('Stage Decoration',CA(3),1,8000,18,'999619','event')]},
    ]})

  await seedDomain({ o:30, slug:'success-coaching', name:'Success Coaching Institute', phone:'9844011011', ownerName:'Mahesh Trivedi', pin:'8011', branchName:'Success Coaching - Alkapuri', domainType:'coaching', prefix:'SCI', domainConfig:{ has_students:true, installment_billing:true },
    categories:[
      {slug:'science',   name:'Science',    icon:'🔬',color:'#3b82f6',sortOrder:0},
      {slug:'maths',     name:'Maths',      icon:'📐',color:'#f59e0b',sortOrder:1},
      {slug:'commerce',  name:'Commerce',   icon:'📊',color:'#10b981',sortOrder:2},
      {slug:'test_prep', name:'Test Prep',  icon:'📝',color:'#ef4444',sortOrder:3},
    ],
    prods:[
      {i:1,name:'JEE Physics Batch (monthly)',      sku:'CRS-JEE-PHY', hsn:'999293',gst:18,unit:'month',pp:1500,sp:2500,mrp:2500,low:0,stock:0,trackStock:false,consumable:false,attrs:{course_type:'tuition',subject:'Physics',standard:'JEE',sessions_per_week:5}},
      {i:2,name:'CBSE Class 10 Complete (monthly)', sku:'CRS-CBSE-10',  hsn:'999293',gst:18,unit:'month',pp:1200,sp:1800,mrp:1800,low:0,stock:0,trackStock:false,consumable:false,attrs:{course_type:'tuition',subject:'All Subjects',standard:'Class 10',board:'CBSE'}},
      {i:3,name:'JEE Test Series (60 tests)',       sku:'CRS-JEE-TS',   hsn:'999293',gst:18,unit:'batch',pp:2000,sp:3500,mrp:3500,low:0,stock:0,trackStock:false,consumable:false,attrs:{course_type:'test_series',standard:'JEE'}},
      {i:4,name:'NEET Biology Batch (monthly)',     sku:'CRS-NEET-BIO', hsn:'999293',gst:18,unit:'month',pp:1500,sp:2500,mrp:2500,low:0,stock:0,trackStock:false,consumable:false,attrs:{course_type:'tuition',subject:'Biology',standard:'NEET',sessions_per_week:5}},
    ],
    parties:[{i:1,type:'customer',name:'Arjun Mehta',phone:'9712340100',bal:0},{i:2,type:'customer',name:'Priya Sharma',phone:'9712340101',bal:1800}],
    invs:[
      {n:1,pi:1,status:'paid',method:'upi',ago:30,domainData:{student_name:'Arjun Mehta',batch_name:'JEE Morning Batch A',fee_month:'May 2026',installment_no:1},items:[lineItem('JEE Physics Batch (monthly)',CO(1),1,2500,18,'999293','month')]},
      {n:2,pi:2,status:'partial',method:'cash',ago:15,domainData:{student_name:'Priya Sharma',batch_name:'CBSE Class 10 Evening',fee_month:'June 2026',installment_no:1},items:[lineItem('CBSE Class 10 Complete (monthly)',CO(2),1,1800,18,'999293','month')]},
      {n:3,pi:1,status:'paid',method:'upi',ago:1,domainData:{student_name:'Arjun Mehta',batch_name:'JEE Test Series 2026',fee_month:'June 2026',installment_no:2},items:[lineItem('JEE Test Series (60 tests)',CO(3),1,3500,18,'999293','batch')]},
    ]})

  await seedDomain({ o:31, slug:'perfect-printers', name:'Perfect Printers & Stationers', phone:'9844012012', ownerName:'Dinesh Solanki', pin:'8012', branchName:'Perfect Printers - Main', domainType:'printing', prefix:'PP', domainConfig:{ job_order_enabled:true, artwork_approval:true },
    categories:[
      {slug:'business_cards',name:'Business Cards',icon:'🪪',color:'#374151',sortOrder:0},
      {slug:'banners',       name:'Banners',       icon:'🏷️',color:'#3b82f6',sortOrder:1},
      {slug:'brochures',     name:'Brochures',     icon:'📄',color:'#10b981',sortOrder:2},
      {slug:'stationery',    name:'Stationery',    icon:'📋',color:'#f59e0b',sortOrder:3},
    ],
    prods:[
      {i:1,name:'Business Cards (500 pcs)',    sku:'PRT-BC-500', hsn:'48175000',gst:12,unit:'set', pp:150,sp:300, mrp:300, low:0,stock:0,attrs:{print_type:'digital',paper_gsm:350,color_mode:'full_color',finish:'matte',min_quantity:100}},
      {i:2,name:'Flex Banner (per sq.ft.)',    sku:'PRT-FLEX',   hsn:'48239090',gst:18,unit:'sqft',pp:12, sp:20,  mrp:20,  low:0,stock:0,attrs:{print_type:'flex',color_mode:'full_color'}},
      {i:3,name:'Wedding Invitation (200 pcs)',sku:'PRT-WED-200',hsn:'49019900',gst:12,unit:'set', pp:500,sp:1000,mrp:1000,low:0,stock:0,attrs:{print_type:'offset',paper_gsm:250,finish:'glossy',binding:'saddle',min_quantity:100}},
      {i:4,name:'A4 Letterhead (1000 pcs)',    sku:'PRT-LH-1K',  hsn:'48175000',gst:12,unit:'set', pp:350,sp:600, mrp:600, low:0,stock:0,attrs:{print_type:'offset',paper_gsm:90,color_mode:'four_color',min_quantity:500}},
    ],
    parties:[{i:1,type:'customer',name:'ABC Enterprises',phone:'9712340110',bal:1200,limit:5000},{i:2,type:'customer',name:'Mehta Events Co.',phone:'9712340111',bal:5000,limit:20000}],
    invs:[
      {n:1,pi:1,status:'paid',method:'cash',ago:4,domainData:{job_order_no:'JO-2026-041',urgency:'normal',delivery_date:'2026-06-23'},items:[lineItem('Business Cards (500 pcs)',PR(1),2,300,12,'48175000','set'),lineItem('A4 Letterhead (1000 pcs)',PR(4),1,600,12,'48175000','set')]},
      {n:2,pi:2,status:'partial',method:'upi',ago:2,domainData:{job_order_no:'JO-2026-042',urgency:'express',delivery_date:'2026-06-26'},items:[lineItem('Wedding Invitation (200 pcs)',PR(3),3,1000,12,'49019900','set')]},
      {n:3,pi:1,status:'confirmed',method:null,ago:0,domainData:{job_order_no:'JO-2026-043',urgency:'normal',delivery_date:'2026-06-30'},items:[lineItem('Flex Banner (per sq.ft.)',PR(2),80,20,18,'48239090','sqft')]},
    ]})

  await seedDomain({ o:32, slug:'sparkle-laundry', name:'Sparkle Laundry & Dry Cleaning', phone:'9844013013', ownerName:'Navin Rathod', pin:'8013', branchName:'Sparkle Laundry - Main', domainType:'laundry', prefix:'SLD', domainConfig:{ has_pickup_delivery:true, garment_tagging:true },
    categories:[
      {slug:'wash',      name:'Wash',       icon:'🫧',color:'#3b82f6',sortOrder:0},
      {slug:'dry_clean', name:'Dry Clean',  icon:'👔',color:'#374151',sortOrder:1},
      {slug:'iron',      name:'Iron',       icon:'♨️',color:'#f59e0b',sortOrder:2},
      {slug:'premium',   name:'Premium',    icon:'✨',color:'#a78bfa',sortOrder:3},
    ],
    prods:[
      {i:1,name:'Shirt - Wash & Iron',sku:'LDY-SHI',hsn:'999711',gst:18,unit:'pcs',pp:15,sp:30, mrp:30, low:0,stock:0,trackStock:false,consumable:false,attrs:{service_type:'wash_iron',garment_category:'shirt',pricing_mode:'per_piece'}},
      {i:2,name:'Suit - Dry Clean',   sku:'LDY-SUT',hsn:'999711',gst:18,unit:'pcs',pp:100,sp:200,mrp:200,low:0,stock:0,trackStock:false,consumable:false,attrs:{service_type:'dry_clean',garment_category:'suit',pricing_mode:'per_piece'}},
      {i:3,name:'Saree - Dry Clean',  sku:'LDY-SAR',hsn:'999711',gst:18,unit:'pcs',pp:60, sp:120,mrp:120,low:0,stock:0,trackStock:false,consumable:false,attrs:{service_type:'dry_clean',garment_category:'saree',pricing_mode:'per_piece'}},
      {i:4,name:'Washing (per kg)',   sku:'LDY-KG', hsn:'999711',gst:18,unit:'kg', pp:30, sp:60, mrp:60, low:0,stock:0,trackStock:false,consumable:false,attrs:{service_type:'wash',pricing_mode:'per_kg'}},
    ],
    parties:[{i:1,type:'customer',name:'Rohan Desai',phone:'9712340120',bal:180,limit:500},{i:2,type:'customer',name:'Hotel Rajmahal',phone:'9712340121',bal:0,limit:20000}],
    invs:[
      {n:1,pi:1,status:'paid',method:'cash',ago:3,domainData:{bag_no:'BAG-061',pickup_date:'2026-06-23',delivery_date:'2026-06-25',is_express:false},items:[lineItem('Shirt - Wash & Iron',LA(1),5,30,18,'999711','pcs'),lineItem('Suit - Dry Clean',LA(2),1,200,18,'999711','pcs')]},
      {n:2,pi:2,status:'paid',method:'bank_transfer',ago:2,domainData:{bag_no:'BAG-062',pickup_date:'2026-06-24',delivery_date:'2026-06-26',is_express:false},items:[lineItem('Washing (per kg)',LA(4),20,60,18,'999711','kg')]},
      {n:3,pi:1,status:'confirmed',method:null,ago:0,domainData:{bag_no:'BAG-063',pickup_date:'2026-06-26',delivery_date:'2026-06-28',is_express:true},items:[lineItem('Saree - Dry Clean',LA(3),3,120,18,'999711','pcs')]},
    ]})

  // ── Hardware store ────────────────────────────────────────────────────────
  const HW=(i:number)=>uid(40,2,i,0)
  await seedDomain({ o:40, slug:'bharat-hardware', name:'Bharat Hardware & Sanitary Store', phone:'9845001001', ownerName:'Bharat Patel', pin:'9001', branchName:'Bharat Hardware - Main Market', domainType:'hardware', prefix:'BHS', domainConfig:{ udhaar_enabled:true, contractor_credit:true, unit_conversion:true, delivery_challan:true },
    categories:[
      {slug:'tools',     name:'Tools',     icon:'🔨',color:'#374151',sortOrder:0},
      {slug:'plumbing',  name:'Plumbing',  icon:'🚿',color:'#3b82f6',sortOrder:1},
      {slug:'electrical',name:'Electrical',icon:'⚡',color:'#f59e0b',sortOrder:2},
      {slug:'paint',     name:'Paint',     icon:'🎨',color:'#ec4899',sortOrder:3},
    ],
    brands:[
      {slug:'stanley',     name:'Stanley'},
      {slug:'havells',     name:'Havells'},
      {slug:'asian_paints',name:'Asian Paints'},
    ],
    prods:[
      {i:1,name:'Tata Tiscon 10mm TMT Bar (per kg)', sku:'HW-TMT-10',  hsn:'72142000',gst:18,unit:'kg',  pp:58, sp:68, mrp:70, low:100,stock:1000,attrs:{brand:'Tata Tiscon',material:'steel',size:'10mm',grade:'Fe500D',sold_by:'weight'},cat:'tools'},
      {i:2,name:'Astral CPVC Pipe 1" (per foot)',    sku:'HW-CPV-1',   hsn:'39172100',gst:18,unit:'ft',  pp:22, sp:30, mrp:32, low:50, stock:500, attrs:{brand:'Astral',material:'cpvc',size:'1 inch',sold_by:'length'},cat:'plumbing'},
      {i:3,name:'Pidilite Fevicol 1kg',              sku:'HW-FEV-1KG', hsn:'35061000',gst:18,unit:'kg',  pp:115,sp:145,mrp:150,low:10, stock:80,  attrs:{brand:'Pidilite',material:'adhesive',sold_by:'weight'},cat:'tools'},
      {i:4,name:'Asian Paints Tractor Emulsion 4L',  sku:'HW-PNT-4L',  hsn:'32081010',gst:18,unit:'can', pp:420,sp:520,mrp:545,low:5,  stock:60,  attrs:{brand:'Asian Paints',material:'emulsion_paint',sold_by:'piece'},cat:'paint',brand:'asian_paints'},
      {i:5,name:'Harpic 500ml',                      sku:'HW-HRP-500', hsn:'34022090',gst:18,unit:'pcs', pp:90, sp:115,mrp:120,low:15, stock:100, attrs:{brand:'Harpic',material:'chemical',sold_by:'piece'},cat:'plumbing'},
      {i:6,name:'Hindustan Wire 1.5mm (90m coil)',   sku:'HW-WIR-1.5', hsn:'85444999',gst:18,unit:'coil',pp:450,sp:560,mrp:580,low:8,  stock:40,  attrs:{brand:'Hindustan',material:'copper',size:'1.5mm',sold_by:'piece'},cat:'electrical',brand:'havells'},
    ],
    parties:[
      {i:1,type:'customer',name:'Ramesh Contractor',  phone:'9712345001',bal:18000,limit:100000},
      {i:2,type:'customer',name:'Praful Builders',    phone:'9712345002',bal:45000,limit:300000},
      {i:3,type:'supplier',name:'Shree Steel & Iron', phone:'9800601001',bal:-80000,gstin:'24AABCS0001S1Z4'},
    ],
    invs:[
      {n:1,pi:1,status:'paid',   method:'bank_transfer',ago:5,items:[lineItem('Tata Tiscon 10mm TMT Bar (per kg)',HW(1),500,68,18,'72142000','kg'),lineItem('Asian Paints Tractor Emulsion 4L',HW(4),10,520,18,'32081010','can')]},
      {n:2,pi:2,status:'partial',method:'bank_transfer',ago:3,items:[lineItem('Astral CPVC Pipe 1" (per foot)',HW(2),200,30,18,'39172100','ft'),lineItem('Hindustan Wire 1.5mm (90m coil)',HW(6),20,560,18,'85444999','coil')]},
      {n:3,pi:1,status:'confirmed',method:null,ago:1,items:[lineItem('Pidilite Fevicol 1kg',HW(3),30,145,18,'35061000','kg'),lineItem('Harpic 500ml',HW(5),50,115,18,'34022090','pcs')]},
    ]})

  // ── Petrol pump ───────────────────────────────────────────────────────────
  const PP2=(i:number)=>uid(41,2,i,0)
  await seedDomain({ o:41, slug:'om-petroleum', name:'Om Petroleum (HPCL Dealer)', phone:'9845002002', ownerName:'Om Prakash Sharma', pin:'9002', branchName:'Om Petroleum - Gotri Road', domainType:'petrol_pump', prefix:'OMP', gstin:'24AABCO9001P1Z7', domainConfig:{ daily_meter_reading:true, shift_management:true, fleet_accounts:true, shift_report:true },
    categories:[
      {slug:'fuel',      name:'Fuel',       icon:'⛽',color:'#ef4444',sortOrder:0},
      {slug:'lubricants',name:'Lubricants', icon:'🛢️',color:'#f59e0b',sortOrder:1},
      {slug:'additives', name:'Additives',  icon:'🧪',color:'#10b981',sortOrder:2},
    ],
    brands:[
      {slug:'indian_oil',name:'Indian Oil'},
      {slug:'hpcl',      name:'HPCL'},
      {slug:'bpcl',      name:'BPCL'},
      {slug:'castrol',   name:'Castrol'},
    ],
    prods:[
      {i:1,name:'Petrol',         sku:'FUEL-PET',hsn:'27101240',gst:0, unit:'litre',pp:93,  sp:96.72,mrp:96.72,low:0,stock:0,attrs:{fuel_type:'petrol',no_itc:true,nozzle_nos:['N1','N2']}},
      {i:2,name:'Diesel',         sku:'FUEL-DSL',hsn:'27101940',gst:0, unit:'litre',pp:84,  sp:89.62,mrp:89.62,low:0,stock:0,attrs:{fuel_type:'diesel',no_itc:true,nozzle_nos:['N3','N4']}},
      {i:3,name:'SERVO 20W40 Engine Oil (1L)',sku:'SERV-20W40',hsn:'27101980',gst:18,unit:'pcs',pp:220,sp:280,mrp:295,low:10,stock:50,attrs:{fuel_type:'petrol',no_itc:false}},
    ],
    parties:[
      {i:1,type:'customer',name:'Ravi Transport Fleet', phone:'9712345010',bal:25000,limit:500000,gstin:'24AABCR0001T1Z6'},
      {i:2,type:'customer',name:'Amit Travels',         phone:'9712345011',bal:8000, limit:100000},
      {i:3,type:'supplier',name:'HPCL Terminal Baroda', phone:'9800602001',bal:-250000,gstin:'27AABCH0001C1Z4'},
    ],
    invs:[
      {n:1,pi:1,status:'paid',   method:'bank_transfer',ago:4,items:[lineItem('Diesel',PP2(2),500,89.62,0,'27101940','litre')]},
      {n:2,pi:2,status:'paid',   method:'card',         ago:2,items:[lineItem('Petrol',PP2(1),30,96.72,0,'27101240','litre')]},
      {n:3,pi:1,status:'partial',method:'bank_transfer',ago:1,items:[lineItem('Diesel',PP2(2),1000,89.62,0,'27101940','litre'),lineItem('SERVO 20W40 Engine Oil (1L)',PP2(3),5,280,18,'27101980','pcs')]},
    ]})

  // ── Agri inputs / Fertilizer ──────────────────────────────────────────────
  const AG=(i:number)=>uid(42,2,i,0)
  await seedDomain({ o:42, slug:'kisan-agro-center', name:'Kisan Agro Center', phone:'9845003003', ownerName:'Kishor Patel', pin:'9003', branchName:'Kisan Agro Center - Anand', domainType:'agri', prefix:'KAC', domainConfig:{ kisan_khata:true, seasonal_alerts:true, licence_check:true, batch_tracking:true, expiry_alert_days:60 },
    categories:[
      {slug:'seeds',      name:'Seeds',      icon:'🌱',color:'#10b981',sortOrder:0},
      {slug:'fertilizers',name:'Fertilizers',icon:'🌾',color:'#f59e0b',sortOrder:1},
      {slug:'pesticides', name:'Pesticides', icon:'🐛',color:'#ef4444',sortOrder:2},
      {slug:'equipment',  name:'Equipment',  icon:'🚜',color:'#374151',sortOrder:3},
    ],
    brands:[
      {slug:'mahyco',name:'Mahyco'},
      {slug:'iffco', name:'IFFCO'},
      {slug:'bayer', name:'Bayer'},
      {slug:'syngenta',name:'Syngenta'},
    ],
    prods:[
      {i:1,name:'DAP Fertilizer 50kg (IFFCO)',     sku:'AG-DAP-50',  hsn:'31052000',gst:5, unit:'bag',  pp:1200,sp:1350,mrp:1360,low:50, stock:300,attrs:{product_type:'fertilizer',subsidy_eligible:true,subsidy_rate_pct:0,season:'kharif',crop_suitability:['wheat','cotton','rice']},cat:'fertilizers',brand:'iffco'},
      {i:2,name:'Urea 50kg (IFFCO)',               sku:'AG-URE-50',  hsn:'31021000',gst:5, unit:'bag',  pp:242, sp:266, mrp:266, low:100,stock:500,attrs:{product_type:'fertilizer',subsidy_eligible:true,season:'all',crop_suitability:['all']},cat:'fertilizers',brand:'iffco'},
      {i:3,name:'Coragen Insecticide 150ml',        sku:'AG-COR-150', hsn:'38089180',gst:18,unit:'btl',  pp:680, sp:850, mrp:900, low:10, stock:80, attrs:{product_type:'pesticide',active_ingredient:'Chlorantraniliprole 18.5%',licence_required:true,season:'kharif',crop_suitability:['cotton','rice']},cat:'pesticides',brand:'syngenta'},
      {i:4,name:'Maize Seeds (Hybrid Kaveri) 1kg', sku:'AG-SEED-MZ',  hsn:'12090000',gst:0, unit:'pkt',  pp:280, sp:360, mrp:380, low:20, stock:200,attrs:{product_type:'seed',season:'kharif',crop_suitability:['maize']},cat:'seeds',brand:'mahyco'},
      {i:5,name:'Potash (MOP) 50kg',               sku:'AG-MOP-50',  hsn:'31042010',gst:5, unit:'bag',  pp:800, sp:920, mrp:930, low:30, stock:200,attrs:{product_type:'fertilizer',season:'all',crop_suitability:['all']},cat:'fertilizers',brand:'iffco'},
    ],
    parties:[
      {i:1,type:'customer',name:'Raju Patel (Farmer)',  phone:'9712345020',bal:3500,limit:25000},
      {i:2,type:'customer',name:'Mangaldas Chaudhary',  phone:'9712345021',bal:8000,limit:50000},
      {i:3,type:'supplier',name:'IFFCO Regional Office',phone:'9800603001',bal:-120000,gstin:'07AABCI0001R1Z1'},
    ],
    invs:[
      {n:1,pi:1,status:'paid',   method:'cash',ago:6,items:[lineItem('Urea 50kg (IFFCO)',AG(2),10,266,5,'31021000','bag'),lineItem('DAP Fertilizer 50kg (IFFCO)',AG(1),5,1350,5,'31052000','bag')]},
      {n:2,pi:2,status:'partial',method:'cash',ago:4,items:[lineItem('DAP Fertilizer 50kg (IFFCO)',AG(1),20,1350,5,'31052000','bag'),lineItem('Coragen Insecticide 150ml',AG(3),10,850,18,'38089180','btl')]},
      {n:3,pi:1,status:'confirmed',method:null,ago:1,items:[lineItem('Maize Seeds (Hybrid Kaveri) 1kg',AG(4),50,360,0,'12090000','pkt'),lineItem('Potash (MOP) 50kg',AG(5),8,920,5,'31042010','bag')]},
    ]})

  // ── Mobile / laptop repair shop ───────────────────────────────────────────
  const RF=(i:number)=>uid(43,2,i,0)
  const repairBranchId = uid(43,9,0,0)
  await seedDomain({ o:43, slug:'techfix-repair', name:'TechFix Repair Center', phone:'9845004004', ownerName:'Nikhil Shah', pin:'9004', branchName:'TechFix Repair - FC Road', domainType:'repair', prefix:'TFR', domainConfig:{ job_card_enabled:true, imei_capture:true, warranty_on_repair:true, default_warranty_days:30, advance_collection:true },
    categories:[
      {slug:'parts',       name:'Parts',       icon:'🔩',color:'#374151',sortOrder:0},
      {slug:'accessories', name:'Accessories', icon:'🛡️',color:'#3b82f6',sortOrder:1},
      {slug:'consumables', name:'Consumables', icon:'🧰',color:'#f59e0b',sortOrder:2},
    ],
    brands:[
      {slug:'bosch',   name:'Bosch'},
      {slug:'philips', name:'Philips'},
      {slug:'samsung', name:'Samsung'},
      {slug:'apple',   name:'Apple'},
    ],
    prods:[
      {i:1,name:'Mobile Display Replacement (iPhone 14)', sku:'REP-DISP-I14',hsn:'85177090',gst:18,unit:'svc',pp:2200,sp:3500,mrp:3500,low:0,stock:0,trackStock:false,consumable:false,attrs:{part_type:'display',compatible_models:['iPhone 14','iPhone 14 Plus'],is_oem:false,warranty_days:90,is_labour:false}},
      {i:2,name:'Battery Replacement (Android)',           sku:'REP-BAT-AND', hsn:'85076000',gst:18,unit:'svc',pp:350, sp:600, mrp:600, low:0,stock:3,  attrs:{part_type:'battery',compatible_models:['Samsung Galaxy A53','Redmi Note 12'],is_oem:false,warranty_days:60,is_labour:false}},
      {i:3,name:'Laptop Charging Port Repair',            sku:'REP-CHG-LAP', hsn:'85177090',gst:18,unit:'svc',pp:200, sp:500, mrp:500, low:0,stock:0,trackStock:false,consumable:false,  attrs:{part_type:'charging_port',compatible_models:['Dell','HP','Lenovo'],is_labour:true,warranty_days:30}},
      {i:4,name:'Screen Guard Fitting (any device)',       sku:'ACC-SG-ANY',  hsn:'70191200',gst:18,unit:'svc',pp:30,  sp:100, mrp:100, low:5,stock:50, attrs:{part_type:'other',is_labour:false,warranty_days:0}},
      {i:5,name:'Software Formatting / OS Install',       sku:'SVC-FMT',     hsn:'998314',  gst:18,unit:'svc',pp:0,   sp:399, mrp:399, low:0,stock:0,trackStock:false,consumable:false,  attrs:{part_type:'other',is_labour:true,warranty_days:7}},
    ],
    parties:[
      {i:1,type:'customer',name:'Harsh Mehta',     phone:'9712345030',bal:0,    limit:5000},
      {i:2,type:'customer',name:'Pooja Verma',     phone:'9712345031',bal:500,  limit:2000},
      {i:3,type:'supplier',name:'Mobile Parts Hub',phone:'9800604001',bal:-8000},
    ],
    invs:[
      {n:1,pi:1,status:'paid',   method:'upi', ago:5,domainData:{device_type:'mobile',device_brand:'Apple',device_model:'iPhone 14',problem_reported:'Screen cracked and unresponsive',technician_name:'Nikhil Shah',advance_amount:1000},items:[lineItem('Mobile Display Replacement (iPhone 14)',RF(1),1,3500,18,'85177090','svc')]},
      {n:2,pi:2,status:'paid',   method:'cash',ago:3,domainData:{device_type:'mobile',device_brand:'Samsung',device_model:'Galaxy A53',problem_reported:'Battery draining fast, overheating',technician_name:'Ravi Kumar',advance_amount:200},items:[lineItem('Battery Replacement (Android)',RF(2),1,600,18,'85076000','svc'),lineItem('Screen Guard Fitting (any device)',RF(4),1,100,18,'70191200','svc')]},
      {n:3,pi:null,status:'paid',method:'upi', ago:1,domainData:{device_type:'laptop',device_brand:'Dell',device_model:'Inspiron 15',problem_reported:'Not charging, port damaged',technician_name:'Nikhil Shah',advance_amount:0},items:[lineItem('Software Formatting / OS Install',RF(5),1,399,18,'998314','svc'),lineItem('Laptop Charging Port Repair',RF(3),1,500,18,'85177090','svc')]},
    ]})

  // ── Tiffin / meal subscription ────────────────────────────────────────────
  const TF=(i:number)=>uid(44,2,i,0)
  await seedDomain({ o:44, slug:'ghar-jaisa-tiffin', name:'Ghar Jaisa Tiffin Service', phone:'9845005005', ownerName:'Kavita Ben', pin:'9005', branchName:'Ghar Jaisa Tiffin - Manjalpur', domainType:'tiffin', prefix:'GJT', domainConfig:{ subscription_billing:true, pause_resume:true, route_management:true, monthly_invoice:true, delivery_tracking:true },
    categories:[
      {slug:'veg_thali',    name:'Veg Thali',    icon:'🍱',color:'#10b981',sortOrder:0},
      {slug:'non_veg_thali',name:'Non-Veg Thali',icon:'🍖',color:'#ef4444',sortOrder:1},
      {slug:'snacks',       name:'Snacks',       icon:'🥙',color:'#f59e0b',sortOrder:2},
      {slug:'beverages',    name:'Beverages',    icon:'🥤',color:'#3b82f6',sortOrder:3},
    ],
    prods:[
      {i:1,name:'Full Veg Tiffin (Lunch)',      sku:'TF-VEG-LNC',hsn:'996331',gst:5,unit:'day',  pp:60, sp:100,mrp:100,low:0,stock:0,trackStock:false,consumable:false,attrs:{meal_type:'veg',tiffin_size:'full',available_slots:['lunch'],items_included:['dal','sabji','roti','rice','achaar'],price_per_day:100,is_subscription:true}},
      {i:2,name:'Full Veg Tiffin (Dinner)',     sku:'TF-VEG-DIN',hsn:'996331',gst:5,unit:'day',  pp:60, sp:100,mrp:100,low:0,stock:0,trackStock:false,consumable:false,attrs:{meal_type:'veg',tiffin_size:'full',available_slots:['dinner'],items_included:['dal','sabji','roti','rice','chaas'],price_per_day:100,is_subscription:true}},
      {i:3,name:'Jain Tiffin (Lunch)',          sku:'TF-JAI-LNC',hsn:'996331',gst:5,unit:'day',  pp:70, sp:120,mrp:120,low:0,stock:0,trackStock:false,consumable:false,attrs:{meal_type:'jain',tiffin_size:'full',available_slots:['lunch'],items_included:['jain_dal','jeera_sabji','roti','rice'],price_per_day:120,is_subscription:true}},
      {i:4,name:'Monthly Tiffin Pack (30 days)',sku:'TF-MON-30', hsn:'996331',gst:5,unit:'month',pp:1700,sp:2800,mrp:2800,low:0,stock:0,trackStock:false,consumable:false,attrs:{meal_type:'veg',tiffin_size:'full',available_slots:['lunch'],price_per_day:93,min_days:30,is_subscription:true}},
    ],
    parties:[
      {i:1,type:'customer',name:'Rohan Patel',    phone:'9712345040',bal:0,   limit:5000},
      {i:2,type:'customer',name:'Neha Sharma',    phone:'9712345041',bal:200, limit:3000},
      {i:3,type:'customer',name:'Vikas Agrawal',  phone:'9712345042',bal:0,   limit:3000},
      {i:4,type:'customer',name:'Sunita Mehta',   phone:'9712345043',bal:400, limit:3000},
    ],
    invs:[
      {n:1,pi:1,status:'paid',   method:'upi', ago:32,domainData:{billing_period_from:'2026-05-01',billing_period_to:'2026-05-31',delivered_days:30},items:[lineItem('Monthly Tiffin Pack (30 days)',TF(4),1,2800,5,'996331','month')]},
      {n:2,pi:2,status:'paid',   method:'cash',ago:32,domainData:{billing_period_from:'2026-05-01',billing_period_to:'2026-05-31',delivered_days:28},items:[lineItem('Monthly Tiffin Pack (30 days)',TF(4),1,2800,5,'996331','month')]},
      {n:3,pi:1,status:'partial',method:'upi', ago:1, domainData:{billing_period_from:'2026-06-01',billing_period_to:'2026-06-30',delivered_days:25},items:[lineItem('Monthly Tiffin Pack (30 days)',TF(4),1,2800,5,'996331','month')]},
      {n:4,pi:3,status:'paid',   method:'upi', ago:32,domainData:{billing_period_from:'2026-05-01',billing_period_to:'2026-05-31',delivered_days:30},items:[lineItem('Monthly Tiffin Pack (30 days)',TF(4),1,2800,5,'996331','month')]},
    ]})

  // ── Gym / Fitness center ─────────────────────────────────────────────────
  const GM=(i:number)=>uid(45,2,i,0)
  await seedDomain({ o:45, slug:'fitzone-gym', name:'FitZone Gym & Fitness Center', phone:'9846001001', ownerName:'Sanjay Rathod', pin:'9101', branchName:'FitZone Gym - Alkapuri', domainType:'gym', prefix:'FZG', domainConfig:{ membership_billing:true, attendance_tracking:true, locker_management:true, pt_session_tracking:true, auto_renewal_alerts:true },
    categories:[
      {slug:'membership',       name:'Membership',        icon:'🏋️',color:'#3b82f6',sortOrder:0},
      {slug:'personal_training',name:'Personal Training', icon:'💪',color:'#ef4444',sortOrder:1},
      {slug:'supplements',      name:'Supplements',       icon:'💊',color:'#f59e0b',sortOrder:2},
      {slug:'equipment',        name:'Equipment',         icon:'🥊',color:'#374151',sortOrder:3},
    ],
    prods:[
      {i:1,name:'Monthly Membership',         sku:'GYM-MON',  hsn:'999721',gst:18,unit:'month',pp:700, sp:1200,mrp:1200,low:0,stock:0,trackStock:false,consumable:false,attrs:{service_type:'membership',duration_months:1,is_renewable:true,gender:'unisex'}},
      {i:2,name:'Quarterly Membership (3M)',  sku:'GYM-QTR',  hsn:'999721',gst:18,unit:'qtr',  pp:1800,sp:3000,mrp:3000,low:0,stock:0,trackStock:false,consumable:false,attrs:{service_type:'membership',duration_months:3,is_renewable:true,gender:'unisex'}},
      {i:3,name:'Annual Membership (12M)',    sku:'GYM-ANN',  hsn:'999721',gst:18,unit:'year', pp:5000,sp:9000,mrp:9000,low:0,stock:0,trackStock:false,consumable:false,attrs:{service_type:'membership',duration_months:12,is_renewable:true,gender:'unisex'}},
      {i:4,name:'Personal Training (12 sessions)', sku:'GYM-PT12',hsn:'999721',gst:18,unit:'pkg',pp:3000,sp:5000,mrp:5000,low:0,stock:0,trackStock:false,consumable:false,attrs:{service_type:'personal_training',sessions_total:12,trainer_name:'Raj Fitness',gender:'unisex'}},
      {i:5,name:'Zumba Group Class (monthly)',sku:'GYM-ZUM',  hsn:'999721',gst:18,unit:'month',pp:400, sp:800, mrp:800, low:0,stock:0,trackStock:false,consumable:false,attrs:{service_type:'group_class',batch_time:'7:00 AM',gender:'female',is_renewable:true}},
      {i:6,name:'Whey Protein 1kg (MuscleBlaze)',sku:'SUP-WP-1K',hsn:'21069099',gst:18,unit:'pcs',pp:1200,sp:1699,mrp:1799,low:5,stock:30,trackStock:true,consumable:true,attrs:{service_type:'supplements',brand:'MuscleBlaze'}}
    ],
    parties:[
      {i:1,type:'customer',name:'Rohan Mehta',    phone:'9712346001',bal:0,   limit:5000},
      {i:2,type:'customer',name:'Priya Joshi',    phone:'9712346002',bal:0,   limit:5000},
      {i:3,type:'customer',name:'Vikram Thakor',  phone:'9712346003',bal:1200,limit:5000},
    ],
    invs:[
      {n:1,pi:1,status:'paid',   method:'upi', ago:60,domainData:{member_id:'MEM-001',membership_from:'2026-04-27',membership_to:'2027-04-26'},items:[lineItem('Annual Membership (12M)',GM(3),1,9000,18,'999721','year')]},
      {n:2,pi:2,status:'paid',   method:'cash',ago:30,domainData:{member_id:'MEM-002',membership_from:'2026-05-27',membership_to:'2026-06-26'},items:[lineItem('Monthly Membership',GM(1),1,1200,18,'999721','month'),lineItem('Zumba Group Class (monthly)',GM(5),1,800,18,'999721','month')]},
      {n:3,pi:3,status:'partial',method:'upi', ago:10,domainData:{member_id:'MEM-003',membership_from:'2026-06-16',membership_to:'2026-07-15'},items:[lineItem('Personal Training (12 sessions)',GM(4),1,5000,18,'999721','pkg')]},
      {n:4,pi:1,status:'paid',   method:'upi', ago:5,domainData:{member_id:'MEM-001'},items:[lineItem('Whey Protein 1kg (MuscleBlaze)',GM(6),1,1699,18,'21069099','pcs')]},
    ]})

  // ── Diagnostic lab ────────────────────────────────────────────────────────
  const DL=(i:number)=>uid(46,2,i,0)
  await seedDomain({ o:46, slug:'apex-diagnostics', name:'Apex Diagnostics & Pathology Lab', phone:'9846002002', ownerName:'Dr. Kavita Shah', pin:'9102', branchName:'Apex Diagnostics - Fatehgunj', domainType:'diagnostic_lab', prefix:'ADL', domainConfig:{ sample_tracking:true, home_collection:true, report_sms_notify:true, referring_doctor_ledger:true, daily_collection_report:true },
    categories:[
      {slug:'blood_tests', name:'Blood Tests', icon:'🩸',color:'#ef4444',sortOrder:0},
      {slug:'urine_tests', name:'Urine Tests', icon:'🧪',color:'#f59e0b',sortOrder:1},
      {slug:'imaging',     name:'Imaging',     icon:'📷',color:'#3b82f6',sortOrder:2},
      {slug:'packages',    name:'Packages',    icon:'📦',color:'#10b981',sortOrder:3},
    ],
    prods:[
      {i:1,name:'CBC (Complete Blood Count)',    sku:'LAB-CBC',  hsn:'999319',gst:0,unit:'test',pp:80, sp:150,mrp:150,low:0,stock:0,trackStock:false,consumable:false,attrs:{test_category:'blood',sample_type:'blood',report_tat_hours:4,fasting_required:false,home_collection:true}},
      {i:2,name:'Lipid Profile',                 sku:'LAB-LIP',  hsn:'999319',gst:0,unit:'test',pp:120,sp:250,mrp:250,low:0,stock:0,trackStock:false,consumable:false,attrs:{test_category:'blood',sample_type:'blood',report_tat_hours:8,fasting_required:true,home_collection:true}},
      {i:3,name:'HbA1c (Diabetes)',              sku:'LAB-HBA1', hsn:'999319',gst:0,unit:'test',pp:150,sp:299,mrp:299,low:0,stock:0,trackStock:false,consumable:false,attrs:{test_category:'blood',sample_type:'blood',report_tat_hours:6,fasting_required:false}},
      {i:4,name:'Urine Routine & Microscopy',    sku:'LAB-URM',  hsn:'999319',gst:0,unit:'test',pp:30, sp:80, mrp:80, low:0,stock:0,trackStock:false,consumable:false,attrs:{test_category:'urine',sample_type:'urine',report_tat_hours:2,fasting_required:false}},
      {i:5,name:'Thyroid Profile (T3/T4/TSH)',   sku:'LAB-THY',  hsn:'999319',gst:0,unit:'test',pp:200,sp:399,mrp:399,low:0,stock:0,trackStock:false,consumable:false,attrs:{test_category:'blood',sample_type:'blood',report_tat_hours:8,fasting_required:false}},
      {i:6,name:'Home Collection Charges',       sku:'LAB-HC',   hsn:'999319',gst:0,unit:'visit',pp:0, sp:100,mrp:100,low:0,stock:0,trackStock:false,consumable:false,attrs:{test_category:'other',home_collection:true}},
      {i:7,name:'Dengue NS1 Antigen',            sku:'LAB-DNG',  hsn:'999319',gst:0,unit:'test',pp:250,sp:500,mrp:500,low:0,stock:0,trackStock:false,consumable:false,attrs:{test_category:'blood',sample_type:'blood',report_tat_hours:4,fasting_required:false,urgent:true}},
    ],
    parties:[
      {i:1,type:'customer',name:'Ramesh Patel',  phone:'9712346010',bal:0},
      {i:2,type:'customer',name:'Sunita Desai',  phone:'9712346011',bal:150},
      {i:3,type:'supplier',name:'Agappe Diagnostics',phone:'9800700001',bal:-8000,gstin:'32AABCA2001D1Z9'},
    ],
    invs:[
      {n:1,pi:1,status:'paid',method:'cash',ago:5,domainData:{patient_name:'Ramesh Patel',patient_age:55,patient_gender:'M',ref_doctor:'Dr. Mehul Shah',home_collection:true,sample_collected_at:'home'},items:[lineItem('CBC (Complete Blood Count)',DL(1),1,150,0,'999319','test'),lineItem('Lipid Profile',DL(2),1,250,0,'999319','test'),lineItem('Home Collection Charges',DL(6),1,100,0,'999319','visit')]},
      {n:2,pi:2,status:'paid',method:'upi', ago:3,domainData:{patient_name:'Sunita Desai',patient_age:48,patient_gender:'F',ref_doctor:'Dr. Priya Joshi',home_collection:false},items:[lineItem('HbA1c (Diabetes)',DL(3),1,299,0,'999319','test'),lineItem('Thyroid Profile (T3/T4/TSH)',DL(5),1,399,0,'999319','test')]},
      {n:3,pi:1,status:'paid',method:'cash',ago:2,domainData:{patient_name:'Ramesh Patel',patient_age:55,patient_gender:'M',home_collection:false},items:[lineItem('Urine Routine & Microscopy',DL(4),1,80,0,'999319','test')]},
      {n:4,pi:null,status:'paid',method:'upi',ago:1,domainData:{patient_name:'Walk-in Patient',urgent:true,home_collection:false},items:[lineItem('Dengue NS1 Antigen',DL(7),1,500,0,'999319','test'),lineItem('CBC (Complete Blood Count)',DL(1),1,150,0,'999319','test')]},
    ]})

  // ── Pest control ──────────────────────────────────────────────────────────
  const PC=(i:number)=>uid(47,2,i,0)
  await seedDomain({ o:47, slug:'shieldpest-solutions', name:'ShieldPest Solutions', phone:'9846003003', ownerName:'Manish Verma', pin:'9103', branchName:'ShieldPest Solutions - Main', domainType:'pest_control', prefix:'SPS', domainConfig:{ amc_tracking:true, warranty_management:true, technician_assignment:true, service_report:true, chemical_consumption:true, next_visit_reminder:true },
    categories:[
      {slug:'residential',name:'Residential',icon:'🏠',color:'#3b82f6',sortOrder:0},
      {slug:'commercial', name:'Commercial', icon:'🏢',color:'#374151',sortOrder:1},
      {slug:'termite',    name:'Termite',    icon:'🐜',color:'#f59e0b',sortOrder:2},
      {slug:'mosquito',   name:'Mosquito',   icon:'🦟',color:'#ef4444',sortOrder:3},
    ],
    prods:[
      {i:1,name:'General Pest Control (1 BHK)',  sku:'PC-GEN-1BHK',hsn:'999729',gst:18,unit:'svc',pp:300, sp:599, mrp:599, low:0,stock:0,trackStock:false,consumable:false,attrs:{service_type:'general_pest',is_amc:false,warranty_months:1,chemical_used:'Fipronil 0.3% SC',application_method:'spray'}},
      {i:2,name:'General Pest Control (2 BHK)',  sku:'PC-GEN-2BHK',hsn:'999729',gst:18,unit:'svc',pp:450, sp:799, mrp:799, low:0,stock:0,trackStock:false,consumable:false,attrs:{service_type:'general_pest',is_amc:false,warranty_months:1,application_method:'spray'}},
      {i:3,name:'Termite Treatment (per sq.ft.)',sku:'PC-TRM-SQFT',hsn:'999729',gst:18,unit:'sqft',pp:3, sp:6,   mrp:6,   low:0,stock:0,trackStock:false,consumable:false,attrs:{service_type:'termite',is_amc:false,warranty_months:60,application_method:'baiting'}},
      {i:4,name:'Rodent Control AMC (1 year)',   sku:'PC-ROD-AMC', hsn:'999729',gst:18,unit:'year',pp:2000,sp:3500,mrp:3500,low:0,stock:0,trackStock:false,consumable:false,attrs:{service_type:'amc',is_amc:true,amc_visits:4,warranty_months:12,application_method:'baiting'}},
      {i:5,name:'Mosquito Fogging (500 sqft)',   sku:'PC-MOS-500', hsn:'999729',gst:18,unit:'svc',pp:200, sp:399, mrp:399, low:0,stock:0,trackStock:false,consumable:false,attrs:{service_type:'mosquito',is_amc:false,warranty_months:0,application_method:'fumigation'}},
      {i:6,name:'Bedbug Treatment (per room)',   sku:'PC-BED-RM',  hsn:'999729',gst:18,unit:'room',pp:400, sp:799, mrp:799, low:0,stock:0,trackStock:false,consumable:false,attrs:{service_type:'bedbug',is_amc:false,warranty_months:3,application_method:'gel'}},
      // Pest control consumables — chemicals stocked internally
      {i:7,name:'Fipronil 0.3% SC (500ml)',  sku:'CON-FIP',  hsn:'38089199',gst:18,unit:'ml',  pp:280, sp:0,mrp:0,low:200,stock:1000,trackStock:true,consumable:true,attrs:{}},
      {i:8,name:'Cypermethrin 25% EC (1L)',  sku:'CON-CYP',  hsn:'38089199',gst:18,unit:'ml',  pp:320, sp:0,mrp:0,low:200,stock:1000,trackStock:true,consumable:true,attrs:{}},
    ],
    parties:[
      {i:1,type:'customer',name:'Suresh Agrawal',  phone:'9712346020',bal:0,   limit:5000},
      {i:2,type:'customer',name:'Mehta Residency (Hotel)',phone:'9712346021',bal:5000,limit:50000},
      {i:3,type:'supplier',name:'UPL Chemicals',  phone:'9800800001',bal:-12000,gstin:'24AABCU0001P1Z3'},
    ],
    invs:[
      {n:1,pi:1,status:'paid',   method:'upi', ago:6,domainData:{service_address:'12, Shyam Society, Gorwa, Baroda',property_type:'residential_2bhk',technician_name:'Manish Verma',next_visit_date:'2026-07-20'},items:[lineItem('General Pest Control (2 BHK)',PC(2),1,799,18,'999729','svc')]},
      {n:2,pi:2,status:'partial',method:'bank_transfer',ago:4,domainData:{service_address:'Mehta Residency, Sayajigunj, Baroda',property_type:'commercial_hotel',technician_name:'Rakesh Patel',next_visit_date:'2026-09-22'},items:[lineItem('Rodent Control AMC (1 year)',PC(4),3,3500,18,'999729','year'),lineItem('Mosquito Fogging (500 sqft)',PC(5),6,399,18,'999729','svc')]},
      {n:3,pi:1,status:'paid',   method:'cash',ago:2,domainData:{service_address:'12, Shyam Society, Gorwa, Baroda',property_type:'residential_2bhk',technician_name:'Manish Verma'},items:[lineItem('Bedbug Treatment (per room)',PC(6),2,799,18,'999729','room')]},
      {n:4,pi:2,status:'confirmed',method:null,ago:0,domainData:{service_address:'Mehta Residency, Sayajigunj, Baroda',property_type:'commercial_hotel',technician_name:'Rakesh Patel'},items:[lineItem('General Pest Control (2 BHK)',PC(2),10,799,18,'999729','svc')]},
    ]})

  // ── Photography studio ────────────────────────────────────────────────────
  const PH2=(i:number)=>uid(48,2,i,0)
  await seedDomain({ o:48, slug:'lens-craft-studio', name:'LensCraft Photography Studio', phone:'9846004004', ownerName:'Niraj Dave', pin:'9104', branchName:'LensCraft Studio - Race Course', domainType:'photography', prefix:'LCS', domainConfig:{ advance_booking:true, advance_pct:50, event_scheduling:true, delivery_tracking:true, package_billing:true },
    categories:[
      {slug:'wedding',   name:'Wedding',   icon:'💍',color:'#ec4899',sortOrder:0},
      {slug:'portrait',  name:'Portrait',  icon:'🤳',color:'#3b82f6',sortOrder:1},
      {slug:'commercial',name:'Commercial',icon:'🏢',color:'#374151',sortOrder:2},
      {slug:'events',    name:'Events',    icon:'🎉',color:'#f59e0b',sortOrder:3},
    ],
    prods:[
      {i:1,name:'Wedding Photography Package',   sku:'PHO-WED-PKG',hsn:'998392',gst:18,unit:'event',pp:20000,sp:35000,mrp:35000,low:0,stock:0,trackStock:false,consumable:false,attrs:{service_type:'event_photography',event_type:'wedding',delivery_days:21,photos_count:500,includes_album:true,includes_drone:false}},
      {i:2,name:'Pre-Wedding Shoot (half day)',   sku:'PHO-PRE-HD', hsn:'998392',gst:18,unit:'event',pp:5000, sp:10000,mrp:10000,low:0,stock:0,trackStock:false,consumable:false,attrs:{service_type:'event_photography',event_type:'pre_wedding',delivery_days:7,photos_count:150,includes_album:false,includes_drone:false}},
      {i:3,name:'Studio Birthday Shoot',         sku:'PHO-STU-BD', hsn:'998392',gst:18,unit:'session',pp:1500,sp:3000,mrp:3000,low:0,stock:0,trackStock:false,consumable:false,attrs:{service_type:'studio_shoot',event_type:'birthday',delivery_days:3,photos_count:50}},
      {i:4,name:'Corporate Event Videography',   sku:'PHO-VID-CRP',hsn:'998392',gst:18,unit:'event',pp:8000, sp:15000,mrp:15000,low:0,stock:0,trackStock:false,consumable:false,attrs:{service_type:'videography',event_type:'corporate',delivery_days:14,video_duration_min:10}},
      {i:5,name:'Passport / ID Photo (set of 4)',sku:'PHO-PAS-4',  hsn:'998392',gst:18,unit:'set', pp:30,   sp:80,  mrp:80,  low:0,stock:0,trackStock:false,consumable:false,attrs:{service_type:'studio_shoot',event_type:'passport',delivery_days:0}},
      {i:6,name:'Photo Printing 5x7 (glossy)',   sku:'PHO-PRT-5X7',hsn:'49119990',gst:12,unit:'pcs',pp:10,  sp:25,  mrp:25,  low:0,stock:0,trackStock:false,consumable:false,attrs:{service_type:'photo_printing',photos_count:1}},
    ],
    parties:[
      {i:1,type:'customer',name:'Ankit & Ritu (Wedding)',phone:'9712346030',bal:17500,limit:50000},
      {i:2,type:'customer',name:'Parekh Family',         phone:'9712346031',bal:0,   limit:10000},
      {i:3,type:'customer',name:'Infosys Ltd (Event)',   phone:'9712346032',bal:7500, limit:100000,gstin:'29AABCI1234B1Z1'},
    ],
    invs:[
      {n:1,pi:1,status:'partial',method:'upi', ago:10,domainData:{event_type:'wedding',event_date:'2026-11-20',photographer_name:'Niraj Dave',shoot_hours:10,advance_paid:17500},items:[lineItem('Wedding Photography Package',PH2(1),1,35000,18,'998392','event')]},
      {n:2,pi:2,status:'paid',   method:'cash',ago:5,domainData:{event_type:'birthday',event_date:'2026-06-21',photographer_name:'Ankit Joshi',shoot_hours:2},items:[lineItem('Studio Birthday Shoot',PH2(3),1,3000,18,'998392','session'),lineItem('Photo Printing 5x7 (glossy)',PH2(6),20,25,12,'49119990','pcs')]},
      {n:3,pi:3,status:'partial',method:'bank_transfer',ago:3,domainData:{event_type:'corporate',event_date:'2026-06-23',photographer_name:'Niraj Dave',shoot_hours:4,advance_paid:7500},items:[lineItem('Corporate Event Videography',PH2(4),1,15000,18,'998392','event')]},
      {n:4,pi:null,status:'paid',method:'cash',ago:1,domainData:{event_type:'passport',photographer_name:'Ankit Joshi',shoot_hours:0.5},items:[lineItem('Passport / ID Photo (set of 4)',PH2(5),3,80,18,'998392','set')]},
    ]})

  // ── Tailoring ─────────────────────────────────────────────────────────────
  const TL=(i:number)=>uid(49,2,i,0)
  await seedDomain({ o:49, slug:'sharma-tailors', name:'Sharma Tailors', phone:'9847001001', ownerName:'Rajesh Sharma', pin:'9201', branchName:'Sharma Tailors - Main', domainType:'tailoring', prefix:'SHT', domainConfig:{ measurement_tracking:true, trial_alerts:true, delivery_calendar:true },
    categories:[
      {slug:'shirts',   name:'Shirts',    icon:'👔',color:'#3b82f6',sortOrder:0},
      {slug:'trousers', name:'Trousers',  icon:'👖',color:'#374151',sortOrder:1},
      {slug:'suits',    name:'Suits',     icon:'🤵',color:'#1e293b',sortOrder:2},
      {slug:'blouse',   name:'Blouse / Saree',icon:'👗',color:'#ec4899',sortOrder:3},
    ],
    prods:[
      {i:1,name:'Shirt Stitching',     sku:'TL-SHIRT', hsn:'998812',gst:5,unit:'pcs',pp:200,sp:400, mrp:400, low:0,stock:0,trackStock:false,consumable:false,attrs:{garment_type:'shirt',  complexity:'standard'}},
      {i:2,name:'Trouser Stitching',   sku:'TL-TRSR',  hsn:'998812',gst:5,unit:'pcs',pp:150,sp:350, mrp:350, low:0,stock:0,trackStock:false,consumable:false,attrs:{garment_type:'trouser',complexity:'standard'}},
      {i:3,name:'Full Suit (2-piece)', sku:'TL-SUIT',  hsn:'998812',gst:5,unit:'pcs',pp:800,sp:1800,mrp:1800,low:0,stock:0,trackStock:false,consumable:false,attrs:{garment_type:'suit',   complexity:'premium'}},
      {i:4,name:'Blouse Stitching',    sku:'TL-BLOUS', hsn:'998812',gst:5,unit:'pcs',pp:120,sp:280, mrp:280, low:0,stock:0,trackStock:false,consumable:false,attrs:{garment_type:'blouse', complexity:'standard'}},
      {i:5,name:'Alteration (basic)',  sku:'TL-ALT-B', hsn:'998812',gst:5,unit:'pcs',pp:50, sp:120, mrp:120, low:0,stock:0,trackStock:false,consumable:false,attrs:{garment_type:'other',  complexity:'alteration'}},
      {i:6,name:'Alteration (zipper / lining)',sku:'TL-ALT-Z',hsn:'998812',gst:5,unit:'pcs',pp:80,sp:200,mrp:200,low:0,stock:0,trackStock:false,consumable:false,attrs:{garment_type:'other',complexity:'alteration'}},
    ],
    parties:[
      {i:1,type:'customer',name:'Ankit Mehta',    phone:'9712347001',bal:0},
      {i:2,type:'customer',name:'Priya Shah',     phone:'9712347002',bal:280},
      {i:3,type:'supplier',name:'Surat Fabric Hub',phone:'9800110001',bal:-4500},
    ],
    invs:[
      {n:1,pi:1,status:'paid',   method:'cash',ago:8, domainData:{order_type:'stitching',trial_date:'2026-06-25',delivery_date:'2026-06-28',garment_count:2}, items:[lineItem('Shirt Stitching',TL(1),2,400,5,'998812','pcs'),lineItem('Trouser Stitching',TL(2),1,350,5,'998812','pcs')]},
      {n:2,pi:2,status:'partial',method:'upi', ago:5, domainData:{order_type:'stitching',trial_date:'2026-07-02',delivery_date:'2026-07-05',garment_count:3}, items:[lineItem('Blouse Stitching',TL(4),3,280,5,'998812','pcs')]},
      {n:3,pi:1,status:'paid',   method:'cash',ago:2, domainData:{order_type:'alteration',delivery_date:'2026-06-27',garment_count:2},items:[lineItem('Alteration (basic)',TL(5),2,120,5,'998812','pcs')]},
      {n:4,pi:null,status:'confirmed',method:null,ago:0,domainData:{order_type:'stitching',trial_date:'2026-07-05',delivery_date:'2026-07-10',garment_count:1},items:[lineItem('Full Suit (2-piece)',TL(3),1,1800,5,'998812','pcs')]},
    ]})

  // ── CA Firm ───────────────────────────────────────────────────────────────
  const CF=(i:number)=>uid(50,2,i,0)
  await seedDomain({ o:50, slug:'mehta-associates-ca', name:'Mehta & Associates (CA Firm)', phone:'9847002002', ownerName:'Kamlesh Mehta', pin:'9202', branchName:'Mehta & Associates - Vadodara', domainType:'ca_firm', prefix:'MAF', gstin:'24ABCPM1234C1Z5', domainConfig:{ tds_tracking:true, retainer_billing:true, gst_filing:true, it_filing:true },
    categories:[
      {slug:'audit',  name:'Audit & Assurance',icon:'📋',color:'#374151',sortOrder:0},
      {slug:'gst',    name:'GST Services',     icon:'🏛️',color:'#3b82f6',sortOrder:1},
      {slug:'itr',    name:'ITR Filing',       icon:'📄',color:'#10b981',sortOrder:2},
      {slug:'retainer',name:'Retainer',        icon:'🔄',color:'#f59e0b',sortOrder:3},
    ],
    prods:[
      {i:1,name:'GST Return Filing (monthly)',  sku:'CA-GST-M', hsn:'998215',gst:18,unit:'month',pp:500, sp:1500, mrp:1500, low:0,stock:0,trackStock:false,consumable:false,attrs:{service_type:'gst_filing',applicable_form:'GSTR-1/3B'}},
      {i:2,name:'ITR Filing (Salaried)',        sku:'CA-ITR-S', hsn:'998215',gst:18,unit:'return',pp:800, sp:2000, mrp:2000, low:0,stock:0,trackStock:false,consumable:false,attrs:{service_type:'itr_filing',applicable_form:'ITR-1'}},
      {i:3,name:'ITR Filing (Business / Pvt Ltd)',sku:'CA-ITR-B',hsn:'998215',gst:18,unit:'return',pp:3000,sp:8000, mrp:8000, low:0,stock:0,trackStock:false,consumable:false,attrs:{service_type:'itr_filing',applicable_form:'ITR-6'}},
      {i:4,name:'Statutory Audit',              sku:'CA-AUD-S', hsn:'998215',gst:18,unit:'year', pp:8000,sp:25000,mrp:25000,low:0,stock:0,trackStock:false,consumable:false,attrs:{service_type:'audit',applicable_form:'Form 3CA'}},
      {i:5,name:'Monthly Retainer (bookkeeping+GST)',sku:'CA-RET-M',hsn:'998215',gst:18,unit:'month',pp:2000,sp:5000,mrp:5000,low:0,stock:0,trackStock:false,consumable:false,attrs:{service_type:'retainer'}},
      {i:6,name:'TDS Return Filing (quarterly)',sku:'CA-TDS-Q', hsn:'998215',gst:18,unit:'qtr',  pp:500, sp:1200, mrp:1200, low:0,stock:0,trackStock:false,consumable:false,attrs:{service_type:'tds_filing',applicable_form:'26Q'}},
    ],
    parties:[
      {i:1,type:'customer',name:'Patel Enterprises Pvt Ltd',phone:'9712348001',bal:8000,limit:100000,gstin:'24AABCP1234D1Z2'},
      {i:2,type:'customer',name:'Rakesh Kumar (Salaried)',  phone:'9712348002',bal:0},
      {i:3,type:'customer',name:'Shah Textiles',           phone:'9712348003',bal:5000,limit:50000,gstin:'24AADCS1234E1Z8'},
    ],
    invs:[
      {n:1,pi:1,status:'paid',   method:'bank_transfer',ago:10,domainData:{service_fy:'2025-26',period_from:'2025-04-01',period_to:'2025-06-30',tds_applicable:true,tds_rate_pct:10,client_pan:'AABCP1234D',client_gstin:'24AABCP1234D1Z2'},items:[lineItem('Monthly Retainer (bookkeeping+GST)',CF(5),3,5000,18,'998215','month')]},
      {n:2,pi:2,status:'paid',   method:'upi',          ago:5, domainData:{service_fy:'2025-26',tds_applicable:false,client_pan:'BKRKU1234F'},items:[lineItem('ITR Filing (Salaried)',CF(2),1,2000,18,'998215','return')]},
      {n:3,pi:3,status:'partial',method:'bank_transfer',ago:3, domainData:{service_fy:'2025-26',period_from:'2025-04-01',period_to:'2025-06-30',tds_applicable:true,tds_rate_pct:10,client_pan:'AADCS1234E',client_gstin:'24AADCS1234E1Z8'},items:[lineItem('GST Return Filing (monthly)',CF(1),3,1500,18,'998215','month'),lineItem('TDS Return Filing (quarterly)',CF(6),1,1200,18,'998215','qtr')]},
      {n:4,pi:1,status:'confirmed',method:null,ago:0,domainData:{service_fy:'2025-26',tds_applicable:true,tds_rate_pct:10,client_gstin:'24AABCP1234D1Z2'},items:[lineItem('Statutory Audit',CF(4),1,25000,18,'998215','year')]},
    ]})

  // ── Gas Agency ────────────────────────────────────────────────────────────
  const GA=(i:number)=>uid(51,2,i,0)
  await seedDomain({ o:51, slug:'om-gas-agency', name:'Om Gas Agency (BPCL)', phone:'9847003003', ownerName:'Suresh Patel', pin:'9203', branchName:'Om Gas Agency - Baroda', domainType:'gas_agency', prefix:'OGA', domainConfig:{ cylinder_tracking:true, route_management:true, advance_collection:true, commercial_cylinders:true },
    categories:[
      {slug:'domestic', name:'Domestic Cylinders',  icon:'🔴',color:'#ef4444',sortOrder:0},
      {slug:'commercial',name:'Commercial Cylinders',icon:'🟡',color:'#f59e0b',sortOrder:1},
      {slug:'accessories',name:'Accessories',        icon:'🔧',color:'#374151',sortOrder:2},
    ],
    prods:[
      {i:1,name:'Domestic LPG Cylinder 14.2kg (refill)', sku:'LPG-DOM-14',  hsn:'27111900',gst:5,unit:'cyl',pp:750, sp:896, mrp:896, low:50,stock:200,trackStock:true,consumable:false,attrs:{cylinder_type:'domestic',  weight_kg:14.2,omc:'BPCL'}},
      {i:2,name:'Commercial LPG Cylinder 19kg (refill)', sku:'LPG-COM-19',  hsn:'27111900',gst:5,unit:'cyl',pp:1400,sp:1680,mrp:1680,low:20,stock:80, trackStock:true,consumable:false,attrs:{cylinder_type:'commercial',weight_kg:19,  omc:'BPCL'}},
      {i:3,name:'Commercial LPG Cylinder 47.5kg (refill)',sku:'LPG-COM-47', hsn:'27111900',gst:5,unit:'cyl',pp:3500,sp:4200,mrp:4200,low:5, stock:20, trackStock:true,consumable:false,attrs:{cylinder_type:'commercial',weight_kg:47.5, omc:'BPCL'}},
      {i:4,name:'New Domestic Connection (deposit + cylinder)',sku:'LPG-NEW-DOM',hsn:'27111900',gst:5,unit:'set',pp:0,sp:2150,mrp:2150,low:0,stock:0,trackStock:false,consumable:false,attrs:{cylinder_type:'domestic',is_new_connection:true}},
      {i:5,name:'Gas Regulator (ISI marked)',           sku:'LPG-REG-ISI', hsn:'84818090',gst:18,unit:'pcs',pp:180,sp:350, mrp:350, low:10,stock:30, trackStock:true,consumable:false,attrs:{cylinder_type:'domestic'}},
    ],
    parties:[
      {i:1,type:'customer',name:'Ramesh Patel (Domestic)',phone:'9712349001',bal:0},
      {i:2,type:'customer',name:'Hotel Surya Commercial',  phone:'9712349002',bal:3360,limit:20000},
      {i:3,type:'supplier',name:'BPCL Depot - Vadodara',  phone:'9800120001',bal:-85000,gstin:'27AAACB2884M1Z5'},
    ],
    invs:[
      {n:1,pi:2,status:'paid',   method:'upi', ago:7, domainData:{delivery_type:'commercial',cylinders_delivered:4,empty_returned:4,driver_name:'Ramesh'},items:[lineItem('Commercial LPG Cylinder 19kg (refill)',GA(2),4,1680,5,'27111900','cyl')]},
      {n:2,pi:1,status:'paid',   method:'cash',ago:5, domainData:{delivery_type:'domestic', cylinders_delivered:1,empty_returned:1},items:[lineItem('Domestic LPG Cylinder 14.2kg (refill)',GA(1),1,896,5,'27111900','cyl')]},
      {n:3,pi:2,status:'partial',method:'bank_transfer',ago:2,domainData:{delivery_type:'commercial',cylinders_delivered:6,empty_returned:5,driver_name:'Suresh'},items:[lineItem('Commercial LPG Cylinder 19kg (refill)',GA(2),6,1680,5,'27111900','cyl')]},
      {n:4,pi:null,status:'paid',method:'cash',ago:1,domainData:{delivery_type:'domestic',cylinders_delivered:1,empty_returned:0},items:[lineItem('New Domestic Connection (deposit + cylinder)',GA(4),1,2150,5,'27111900','set')]},
    ]})

  // ── Event Management ──────────────────────────────────────────────────────
  const EV=(i:number)=>uid(52,2,i,0)
  await seedDomain({ o:52, slug:'celebrations-events', name:'Celebrations Event Management', phone:'9847004004', ownerName:'Neha Joshi', pin:'9204', branchName:'Celebrations Events - Vadodara', domainType:'event_management', prefix:'CEV', gstin:'24AABPN1234F1Z3', domainConfig:{ advance_required:true, advance_pct:30, vendor_management:true, timeline_management:true },
    categories:[
      {slug:'wedding',   name:'Wedding Events',   icon:'💍',color:'#ec4899',sortOrder:0},
      {slug:'corporate', name:'Corporate Events',  icon:'🏢',color:'#374151',sortOrder:1},
      {slug:'birthday',  name:'Birthday / Social', icon:'🎂',color:'#f59e0b',sortOrder:2},
      {slug:'decoration',name:'Decoration',        icon:'🎊',color:'#8b5cf6',sortOrder:3},
    ],
    prods:[
      {i:1,name:'Wedding Management (full)',    sku:'EV-WED-FULL',hsn:'998596',gst:18,unit:'event',pp:80000,sp:200000,mrp:200000,low:0,stock:0,trackStock:false,consumable:false,attrs:{event_type:'wedding',  team_size:15,includes_decor:true, includes_catering_mgmt:true}},
      {i:2,name:'Corporate Event (half day)',   sku:'EV-CRP-HD',  hsn:'998596',gst:18,unit:'event',pp:15000,sp:40000, mrp:40000, low:0,stock:0,trackStock:false,consumable:false,attrs:{event_type:'corporate', team_size:5, includes_decor:false,includes_av:true}},
      {i:3,name:'Birthday Party (up to 50 pax)',sku:'EV-BD-50',   hsn:'998596',gst:18,unit:'event',pp:8000, sp:20000, mrp:20000, low:0,stock:0,trackStock:false,consumable:false,attrs:{event_type:'birthday',  team_size:4, includes_decor:true}},
      {i:4,name:'Stage & Floral Decoration',   sku:'EV-DEC-STG', hsn:'998596',gst:18,unit:'event',pp:12000,sp:30000, mrp:30000, low:0,stock:0,trackStock:false,consumable:false,attrs:{event_type:'decoration', team_size:6}},
      {i:5,name:'DJ + Sound System',           sku:'EV-DJ-FULL', hsn:'998596',gst:18,unit:'night',pp:8000, sp:18000, mrp:18000, low:0,stock:0,trackStock:false,consumable:false,attrs:{event_type:'entertainment'}},
      {i:6,name:'Catering Management (per head)',sku:'EV-CAT-PH', hsn:'996334',gst:5, unit:'person',pp:250,  sp:550,   mrp:550,   low:0,stock:0,trackStock:false,consumable:false,attrs:{event_type:'catering_coordination'}},
    ],
    parties:[
      {i:1,type:'customer',name:'Ankit Patel (Wedding)',  phone:'9712350001',bal:60000,limit:300000},
      {i:2,type:'customer',name:'Torrent Power Ltd',      phone:'9712350002',bal:0,    limit:200000,gstin:'24AABCT1234G1Z1'},
      {i:3,type:'supplier',name:'Sai Tent House',         phone:'9800130001',bal:-18000},
    ],
    invs:[
      {n:1,pi:1,status:'partial',method:'bank_transfer',ago:15,domainData:{event_type:'wedding',event_date:'2026-12-05',venue:'Hotel Surya, Vadodara',guest_count:400,advance_paid:60000,coordinator:'Neha Joshi'},items:[lineItem('Wedding Management (full)',EV(1),1,200000,18,'998596','event')]},
      {n:2,pi:2,status:'paid',   method:'bank_transfer',ago:7, domainData:{event_type:'corporate',event_date:'2026-06-22',venue:'Torrent House Conf Room',guest_count:80,coordinator:'Ravi Patel'},items:[lineItem('Corporate Event (half day)',EV(2),1,40000,18,'998596','event')]},
      {n:3,pi:null,status:'paid',method:'upi',           ago:3, domainData:{event_type:'birthday',event_date:'2026-06-26',venue:'Home venue, Alkapuri',guest_count:50,coordinator:'Priya Shah'},items:[lineItem('Birthday Party (up to 50 pax)',EV(3),1,20000,18,'998596','event')]},
      {n:4,pi:1,status:'confirmed',method:null,          ago:0, domainData:{event_type:'decoration',event_date:'2026-12-05',venue:'Hotel Surya, Vadodara',coordinator:'Neha Joshi'},items:[lineItem('Stage & Floral Decoration',EV(4),1,30000,18,'998596','event'),lineItem('DJ + Sound System',EV(5),2,18000,18,'998596','night')]},
    ]})

  // ── Veterinary ────────────────────────────────────────────────────────────
  const VT=(i:number)=>uid(53,2,i,0)
  await seedDomain({ o:53, slug:'petcare-vet-clinic', name:'PetCare Veterinary Clinic', phone:'9847005005', ownerName:'Dr. Priya Rao', pin:'9205', branchName:'PetCare Clinic - Baroda', domainType:'veterinary', prefix:'PVC', domainConfig:{ vaccination_tracking:true, prescription_required:true, appointment_system:true },
    categories:[
      {slug:'consultation',name:'Consultation',    icon:'🩺',color:'#3b82f6',sortOrder:0},
      {slug:'vaccines',    name:'Vaccines',        icon:'💉',color:'#ef4444',sortOrder:1},
      {slug:'medicines',   name:'Medicines',       icon:'💊',color:'#10b981',sortOrder:2},
      {slug:'grooming',    name:'Grooming',        icon:'✂️',color:'#f59e0b',sortOrder:3},
    ],
    prods:[
      {i:1,name:'Consultation (OPD)',          sku:'VT-CONS',  hsn:'999312',gst:0,unit:'visit',pp:0,  sp:300, mrp:300, low:0,stock:0, trackStock:false,consumable:false,attrs:{service_type:'consultation',animal_type:'any'}},
      {i:2,name:'Rabies Vaccine (dog/cat)',    sku:'VT-VAC-R', hsn:'999312',gst:12,unit:'dose',pp:180,sp:350, mrp:350, low:10,stock:30,trackStock:true, consumable:true, attrs:{service_type:'vaccination',vaccine_name:'Rabipur',animal_type:'dog_cat'}},
      {i:3,name:'7-in-1 Vaccine (dog)',        sku:'VT-VAC-7', hsn:'999312',gst:12,unit:'dose',pp:400,sp:700, mrp:700, low:5, stock:20,trackStock:true, consumable:true, attrs:{service_type:'vaccination',vaccine_name:'Nobivac DHPPiL',animal_type:'dog'}},
      {i:4,name:'Deworming Tablet (per kg)',   sku:'VT-DEWM',  hsn:'30049090',gst:12,unit:'tab',pp:8, sp:20,  mrp:20,  low:50,stock:200,trackStock:true,consumable:true, attrs:{service_type:'medicine',animal_type:'any'}},
      {i:5,name:'Full Grooming (dog < 10kg)',  sku:'VT-GRM-S', hsn:'999312',gst:18,unit:'session',pp:300,sp:600,mrp:600,low:0,stock:0,trackStock:false,consumable:false,attrs:{service_type:'grooming',animal_type:'dog'}},
      {i:6,name:'X-Ray (digital)',             sku:'VT-XRAY',  hsn:'999312',gst:12,unit:'plate',pp:150,sp:400, mrp:400, low:0,stock:0, trackStock:false,consumable:false,attrs:{service_type:'diagnostic',animal_type:'any'}},
    ],
    parties:[
      {i:1,type:'customer',name:'Ketan Shah (Labrador - Bruno)',phone:'9712351001',bal:0},
      {i:2,type:'customer',name:'Riddhi Desai (Cat - Mochi)',  phone:'9712351002',bal:350},
      {i:3,type:'supplier',name:'Virbac India Pvt Ltd',        phone:'9800140001',bal:-12000,gstin:'08AABCV1234H1Z7'},
    ],
    invs:[
      {n:1,pi:1,status:'paid',  method:'upi', ago:6, domainData:{patient_name:'Bruno',species:'dog',breed:'Labrador',age_years:3,owner_name:'Ketan Shah',diagnosis:'Annual vaccination',prescription_given:true},items:[lineItem('Consultation (OPD)',VT(1),1,300,0,'999312','visit'),lineItem('7-in-1 Vaccine (dog)',VT(3),1,700,12,'999312','dose'),lineItem('Rabies Vaccine (dog/cat)',VT(2),1,350,12,'999312','dose')]},
      {n:2,pi:2,status:'partial',method:'cash',ago:3,domainData:{patient_name:'Mochi',species:'cat',breed:'Persian',age_years:2,owner_name:'Riddhi Desai',diagnosis:'Deworming + grooming',prescription_given:false},items:[lineItem('Deworming Tablet (per kg)',VT(4),4,20,12,'30049090','tab'),lineItem('Consultation (OPD)',VT(1),1,300,0,'999312','visit')]},
      {n:3,pi:1,status:'paid',  method:'cash',ago:1,domainData:{patient_name:'Bruno',species:'dog',breed:'Labrador',age_years:3,owner_name:'Ketan Shah',diagnosis:'Grooming'},items:[lineItem('Full Grooming (dog < 10kg)',VT(5),1,600,18,'999312','session')]},
      {n:4,pi:null,status:'paid',method:'upi',ago:0,domainData:{patient_name:'Walk-in dog',species:'dog',diagnosis:'X-ray'},items:[lineItem('X-Ray (digital)',VT(6),1,400,12,'999312','plate')]},
    ]})

  // ── Milk Dairy ────────────────────────────────────────────────────────────
  const MD=(i:number)=>uid(54,2,i,0)
  await seedDomain({ o:54, slug:'gokul-milk-dairy', name:'Gokul Milk Dairy', phone:'9847006006', ownerName:'Bharat Patel', pin:'9206', branchName:'Gokul Milk Dairy - Main', domainType:'milk_dairy', prefix:'GMD', domainConfig:{ can_deposit_tracking:true, subscription_billing:true, daily_delivery:true, fat_snf_testing:true },
    categories:[
      {slug:'milk',     name:'Milk',     icon:'🥛',color:'#3b82f6',sortOrder:0},
      {slug:'products', name:'Products', icon:'🧈',color:'#f59e0b',sortOrder:1},
    ],
    prods:[
      {i:1,name:'Full Cream Milk (per litre)',  sku:'MD-FCM-L',  hsn:'04011000',gst:0,unit:'ltr',pp:38,sp:52, mrp:52, low:100,stock:500,trackStock:true,consumable:true, attrs:{milk_type:'full_cream',fat_pct:6.0,snf_pct:9.0}},
      {i:2,name:'Toned Milk (per litre)',       sku:'MD-TND-L',  hsn:'04011000',gst:0,unit:'ltr',pp:32,sp:44, mrp:44, low:100,stock:400,trackStock:true,consumable:true, attrs:{milk_type:'toned',    fat_pct:3.0,snf_pct:8.5}},
      {i:3,name:'Standardised Milk (per litre)',sku:'MD-STD-L',  hsn:'04011000',gst:0,unit:'ltr',pp:35,sp:48, mrp:48, low:50, stock:200,trackStock:true,consumable:true, attrs:{milk_type:'standardised',fat_pct:4.5,snf_pct:8.5}},
      {i:4,name:'Paneer (200g pack)',           sku:'MD-PNR-200',hsn:'04061000',gst:5,unit:'pcs',pp:55,sp:80, mrp:80, low:10, stock:50, trackStock:true,consumable:false,attrs:{milk_type:'paneer'}},
      {i:5,name:'Dahi / Curd (500g)',           sku:'MD-DAH-500',hsn:'04039090',gst:5,unit:'pcs',pp:25,sp:40, mrp:40, low:20, stock:80, trackStock:true,consumable:false,attrs:{milk_type:'curd'}},
      {i:6,name:'Milk Can Deposit (10L)',       sku:'MD-CAN-DEP',hsn:'',       gst:0,unit:'can',pp:0, sp:300, mrp:300, low:0, stock:0, trackStock:false,consumable:false,attrs:{milk_type:'deposit',is_deposit:true}},
    ],
    parties:[
      {i:1,type:'customer',name:'Ramesh Patel (Home subscription)',phone:'9712352001',bal:0},
      {i:2,type:'customer',name:'Green Leaf Hotel',               phone:'9712352002',bal:2400, limit:15000},
      {i:3,type:'supplier',name:'Gujarat Cooperative Milk Fed',   phone:'9800150001',bal:-28000,gstin:'24AAACG1234I1Z6'},
    ],
    invs:[
      {n:1,pi:2,status:'paid',   method:'bank_transfer',ago:5, domainData:{billing_period_from:'2026-06-01',billing_period_to:'2026-06-30',delivery_days:30,total_litres:90,is_subscription:true},items:[lineItem('Full Cream Milk (per litre)',MD(1),90,52,0,'04011000','ltr')]},
      {n:2,pi:1,status:'paid',   method:'upi',          ago:3, domainData:{billing_period_from:'2026-06-01',billing_period_to:'2026-06-30',delivery_days:30,total_litres:60,is_subscription:true},items:[lineItem('Toned Milk (per litre)',MD(2),60,44,0,'04011000','ltr')]},
      {n:3,pi:2,status:'partial',method:'bank_transfer',ago:1, domainData:{billing_period_from:'2026-07-01',billing_period_to:'2026-07-31',delivery_days:31,total_litres:93,is_subscription:true},items:[lineItem('Full Cream Milk (per litre)',MD(1),93,52,0,'04011000','ltr')]},
      {n:4,pi:null,status:'paid',method:'cash',         ago:2, domainData:{is_subscription:false},items:[lineItem('Paneer (200g pack)',MD(4),5,80,5,'04061000','pcs'),lineItem('Dahi / Curd (500g)',MD(5),4,40,5,'04039090','pcs')]},
    ]})

  // ── Banquet Hall ──────────────────────────────────────────────────────────
  const BQ=(i:number)=>uid(55,2,i,0)
  await seedDomain({ o:55, slug:'shree-banquet-hall', name:'Shree Banquet Hall & Party Plot', phone:'9847007007', ownerName:'Mahesh Shah', pin:'9207', branchName:'Shree Banquet Hall - Baroda', domainType:'banquet_hall', prefix:'SBH', gstin:'24AABMS1234J1Z4', domainConfig:{ advance_required:true, advance_pct:50, slot_blocking:true, catering_tie_up:true },
    categories:[
      {slug:'hall_booking',name:'Hall Booking',icon:'🏛️',color:'#374151',sortOrder:0},
      {slug:'add_ons',     name:'Add-ons',    icon:'🎊',color:'#8b5cf6',sortOrder:1},
      {slug:'catering',    name:'Catering',   icon:'🍽️',color:'#f59e0b',sortOrder:2},
    ],
    prods:[
      {i:1,name:'Full Day Hall Booking (up to 500 pax)', sku:'BQ-HALL-FD',hsn:'996311',gst:18,unit:'day', pp:20000,sp:50000,mrp:50000,low:0,stock:0,trackStock:false,consumable:false,attrs:{hall_capacity:500,slot:'full_day'}},
      {i:2,name:'Morning Slot (8am–2pm)',                sku:'BQ-HALL-AM',hsn:'996311',gst:18,unit:'slot',pp:12000,sp:30000,mrp:30000,low:0,stock:0,trackStock:false,consumable:false,attrs:{hall_capacity:500,slot:'morning'}},
      {i:3,name:'Evening Slot (4pm–11pm)',               sku:'BQ-HALL-PM',hsn:'996311',gst:18,unit:'slot',pp:15000,sp:35000,mrp:35000,low:0,stock:0,trackStock:false,consumable:false,attrs:{hall_capacity:500,slot:'evening'}},
      {i:4,name:'Catering (veg thali per head)',         sku:'BQ-CAT-VEG',hsn:'996334',gst:5, unit:'person',pp:250,sp:450,mrp:450,low:0,stock:0,trackStock:false,consumable:false,attrs:{hall_capacity:0}},
      {i:5,name:'Decoration Package (basic flowers)',    sku:'BQ-DEC-BAS',hsn:'998596',gst:18,unit:'event',pp:8000,sp:18000,mrp:18000,low:0,stock:0,trackStock:false,consumable:false,attrs:{hall_capacity:0}},
      {i:6,name:'Generator Backup (per hour)',           sku:'BQ-GEN-HR', hsn:'996311',gst:18,unit:'hr',  pp:500, sp:1000, mrp:1000, low:0,stock:0,trackStock:false,consumable:false,attrs:{hall_capacity:0}},
    ],
    parties:[
      {i:1,type:'customer',name:'Kiran Patel (Wedding)',  phone:'9712353001',bal:25000,limit:200000},
      {i:2,type:'customer',name:'Sunrise Coaching (Annual Day)',phone:'9712353002',bal:0,limit:100000,gstin:'24AABCS1234K1Z3'},
      {i:3,type:'supplier',name:'Fresh Caterers',          phone:'9800160001',bal:-15000},
    ],
    invs:[
      {n:1,pi:1,status:'partial',method:'bank_transfer',ago:20,domainData:{event_date:'2026-12-01',slot:'full_day',event_type:'wedding',guest_count:350,security_deposit:10000,advance_paid:25000,add_ons:[{name:'Decoration',price:18000},{name:'Generator 4hr',price:4000}]},items:[lineItem('Full Day Hall Booking (up to 500 pax)',BQ(1),1,50000,18,'996311','day'),lineItem('Decoration Package (basic flowers)',BQ(5),1,18000,18,'998596','event'),lineItem('Generator Backup (per hour)',BQ(6),4,1000,18,'996311','hr'),lineItem('Catering (veg thali per head)',BQ(4),350,450,5,'996334','person')]},
      {n:2,pi:2,status:'paid',   method:'bank_transfer',ago:8, domainData:{event_date:'2026-06-21',slot:'morning',event_type:'corporate',guest_count:120,security_deposit:5000,add_ons:[]},items:[lineItem('Morning Slot (8am–2pm)',BQ(2),1,30000,18,'996311','slot'),lineItem('Catering (veg thali per head)',BQ(4),120,450,5,'996334','person')]},
      {n:3,pi:null,status:'paid',method:'upi',           ago:3, domainData:{event_date:'2026-06-26',slot:'evening',event_type:'birthday',guest_count:80,security_deposit:5000,add_ons:[]},items:[lineItem('Evening Slot (4pm–11pm)',BQ(3),1,35000,18,'996311','slot')]},
    ]})

  // ── Real Estate ───────────────────────────────────────────────────────────
  const RE=(i:number)=>uid(56,2,i,0)
  await seedDomain({ o:56, slug:'prime-property-baroda', name:'Prime Property & Brokers', phone:'9847008008', ownerName:'Jayesh Desai', pin:'9208', branchName:'Prime Property - Vadodara', domainType:'real_estate', prefix:'PPB', gstin:'24AABPD1234L1Z2', domainConfig:{ rental_management:true, tds_tracking:true, property_register:true },
    categories:[
      {slug:'brokerage', name:'Brokerage',     icon:'🤝',color:'#374151',sortOrder:0},
      {slug:'rental',    name:'Rental Income', icon:'🏘️',color:'#3b82f6',sortOrder:1},
      {slug:'maintenance',name:'Maintenance',  icon:'🔧',color:'#f59e0b',sortOrder:2},
    ],
    prods:[
      {i:1,name:'Residential Rental Brokerage (1 month rent)', sku:'RE-BRK-RES',hsn:'997212',gst:18,unit:'txn',pp:0,sp:0,mrp:0,low:0,stock:0,trackStock:false,consumable:false,attrs:{property_type:'residential',transaction_type:'brokerage'}},
      {i:2,name:'Commercial Rental Brokerage (1 month rent)',   sku:'RE-BRK-COM',hsn:'997212',gst:18,unit:'txn',pp:0,sp:0,mrp:0,low:0,stock:0,trackStock:false,consumable:false,attrs:{property_type:'commercial', transaction_type:'brokerage'}},
      {i:3,name:'Monthly Rental Collection (residential)',      sku:'RE-RENT-M', hsn:'997212',gst:18,unit:'month',pp:0,sp:0,mrp:0,low:0,stock:0,trackStock:false,consumable:false,attrs:{property_type:'residential',transaction_type:'rental_collection'}},
      {i:4,name:'Property Management Fee (monthly)',            sku:'RE-MGMT-M', hsn:'997212',gst:18,unit:'month',pp:0,sp:0,mrp:0,low:0,stock:0,trackStock:false,consumable:false,attrs:{property_type:'any',       transaction_type:'management'}},
      {i:5,name:'Sale Transaction Brokerage (residential)',     sku:'RE-SALE-R', hsn:'997212',gst:18,unit:'txn',pp:0,sp:0,mrp:0,low:0,stock:0,trackStock:false,consumable:false,attrs:{property_type:'residential',transaction_type:'sale'}},
    ],
    parties:[
      {i:1,type:'customer',name:'Anand Mehta (Tenant)',   phone:'9712354001',bal:0},
      {i:2,type:'customer',name:'Patel Exports (Office)', phone:'9712354002',bal:18000,limit:200000,gstin:'24AABPE1234M1Z8'},
      {i:3,type:'customer',name:'Sonal Patel (Owner — managed property)',phone:'9712354003',bal:0},
    ],
    invs:[
      {n:1,pi:2,status:'paid',   method:'bank_transfer',ago:10,domainData:{billing_mode:'brokerage',property_address:'B-12, Alkapuri, Vadodara',rent_amount:45000,tds_applicable:true,tds_rate_pct:10,tds_amount:4500,security_deposit:90000,security_deposit_returned:false},items:[lineItem('Commercial Rental Brokerage (1 month rent)',RE(2),1,45000,18,'997212','txn')]},
      {n:2,pi:1,status:'paid',   method:'upi',          ago:5, domainData:{billing_mode:'rent',property_address:'A-4, Vasna, Vadodara',rent_amount:18000,tds_applicable:false,security_deposit:36000,security_deposit_returned:false},items:[lineItem('Monthly Rental Collection (residential)',RE(3),1,18000,18,'997212','month')]},
      {n:3,pi:3,status:'partial',method:'bank_transfer',ago:3, domainData:{billing_mode:'maintenance',property_address:'C-22, Race Course, Vadodara',tds_applicable:false,security_deposit:0},items:[lineItem('Property Management Fee (monthly)',RE(4),3,4000,18,'997212','month')]},
      {n:4,pi:2,status:'confirmed',method:null,          ago:0, domainData:{billing_mode:'rent',property_address:'B-12, Alkapuri, Vadodara',rent_amount:45000,tds_applicable:true,tds_rate_pct:10,tds_amount:4500,security_deposit:90000,security_deposit_returned:false},items:[lineItem('Monthly Rental Collection (residential)',RE(3),1,45000,18,'997212','month')]},
    ]})

  // ── Water Supplier ────────────────────────────────────────────────────────
  const WS2=(i:number)=>uid(57,2,i,0)
  await seedDomain({ o:57, slug:'jal-ro-water-supply', name:'Jal RO Water Supply', phone:'9848001001', ownerName:'Dilip Patel', pin:'9301', branchName:'Jal RO Water - Main', domainType:'water_supplier', prefix:'JAL', domainConfig:{ can_deposit_tracking:true, subscription_billing:true, route_management:true },
    categories:[
      {slug:'water_cans', name:'Water Cans',  icon:'💧',color:'#3b82f6',sortOrder:0},
      {slug:'accessories',name:'Accessories', icon:'🔧',color:'#374151',sortOrder:1},
    ],
    prods:[
      {i:1,name:'RO Water Can 20L (refill)',   sku:'WS-CAN-20R', hsn:'22011000',gst:18,unit:'can',pp:20,sp:40, mrp:40, low:50,stock:0,  trackStock:false,consumable:false,attrs:{can_size_litres:20,water_type:'ro'}},
      {i:2,name:'Water Can 20L (new + deposit)',sku:'WS-CAN-20N',hsn:'22011000',gst:18,unit:'can',pp:300,sp:500,mrp:500,low:10,stock:50, trackStock:true, consumable:false,attrs:{can_size_litres:20,water_type:'ro',is_new_can:true}},
      {i:3,name:'Water Can 10L (refill)',       sku:'WS-CAN-10R', hsn:'22011000',gst:18,unit:'can',pp:10,sp:25, mrp:25, low:20,stock:0,  trackStock:false,consumable:false,attrs:{can_size_litres:10,water_type:'ro'}},
      {i:4,name:'Water Tanker 1000L (delivery)',sku:'WS-TNK-1K', hsn:'22011000',gst:18,unit:'tanker',pp:300,sp:700,mrp:700,low:0,stock:0,trackStock:false,consumable:false,attrs:{can_size_litres:1000,water_type:'tanker'}},
      {i:5,name:'Tap Adaptor / Dispenser Tap', sku:'WS-DISP-TAP',hsn:'84818090',gst:18,unit:'pcs',pp:80, sp:150, mrp:150, low:5, stock:20, trackStock:true, consumable:false,attrs:{can_size_litres:0,water_type:'ro'}},
    ],
    parties:[
      {i:1,type:'customer',name:'Shri Ram Society (subscription)',phone:'9712355001',bal:0},
      {i:2,type:'customer',name:'Hotel Surya Palace',            phone:'9712355002',bal:280, limit:5000},
      {i:3,type:'supplier',name:'Aqua Minerals Pvt Ltd',         phone:'9800170001',bal:-8000},
    ],
    invs:[
      {n:1,pi:1,status:'paid',  method:'upi', ago:5, domainData:{billing_period_from:'2026-06-01',billing_period_to:'2026-06-30',total_cans:60,subscription_plan:'monthly',driver_name:'Ramesh'},items:[lineItem('RO Water Can 20L (refill)',WS2(1),60,40,18,'22011000','can')]},
      {n:2,pi:2,status:'paid',  method:'cash',ago:3, domainData:{total_cans:7,driver_name:'Dilip'},items:[lineItem('RO Water Can 20L (refill)',WS2(1),7,40,18,'22011000','can')]},
      {n:3,pi:null,status:'paid',method:'upi',ago:2,domainData:{total_cans:1},items:[lineItem('Water Can 20L (new + deposit)',WS2(2),1,500,18,'22011000','can')]},
      {n:4,pi:2,status:'partial',method:'cash',ago:0,domainData:{total_cans:0,driver_name:'Dilip'},items:[lineItem('Water Tanker 1000L (delivery)',WS2(4),1,700,18,'22011000','tanker')]},
    ]})

  // ── Driving School ────────────────────────────────────────────────────────
  const DS=(i:number)=>uid(58,2,i,0)
  await seedDomain({ o:58, slug:'national-driving-school', name:'National Motor Driving School', phone:'9848002002', ownerName:'Ramesh Solanki', pin:'9302', branchName:'National Driving School - Baroda', domainType:'driving_school', prefix:'NDS', domainConfig:{ student_register:true, session_tracking:true, dl_tracking:true },
    categories:[
      {slug:'two_wheeler',name:'Two-Wheeler',icon:'🛵',color:'#3b82f6',sortOrder:0},
      {slug:'four_wheeler',name:'Four-Wheeler',icon:'🚗',color:'#374151',sortOrder:1},
      {slug:'heavy',name:'Heavy Vehicle',icon:'🚛',color:'#ef4444',sortOrder:2},
    ],
    prods:[
      {i:1,name:'4-Wheeler Basic Course (15 days)',  sku:'DS-4W-BAS',hsn:'999292',gst:18,unit:'course',pp:2000,sp:5000,mrp:5000,low:0,stock:0,trackStock:false,consumable:false,attrs:{vehicle_class:'LMV',sessions:15,includes_rto_assist:false}},
      {i:2,name:'4-Wheeler Full Course (30 days)',   sku:'DS-4W-FULL',hsn:'999292',gst:18,unit:'course',pp:3500,sp:8000,mrp:8000,low:0,stock:0,trackStock:false,consumable:false,attrs:{vehicle_class:'LMV',sessions:30,includes_rto_assist:true}},
      {i:3,name:'2-Wheeler Course (10 days)',         sku:'DS-2W-BAS', hsn:'999292',gst:18,unit:'course',pp:800, sp:2000,mrp:2000,low:0,stock:0,trackStock:false,consumable:false,attrs:{vehicle_class:'MCWOG',sessions:10,includes_rto_assist:false}},
      {i:4,name:'RTO Licence Assistance (LMV)',      sku:'DS-RTO-LMV',hsn:'999292',gst:18,unit:'application',pp:300,sp:800,mrp:800,low:0,stock:0,trackStock:false,consumable:false,attrs:{vehicle_class:'LMV',sessions:0,includes_rto_assist:true}},
      {i:5,name:'Refresher Course (5 sessions)',     sku:'DS-4W-REF', hsn:'999292',gst:18,unit:'course',pp:600, sp:1500,mrp:1500,low:0,stock:0,trackStock:false,consumable:false,attrs:{vehicle_class:'LMV',sessions:5,includes_rto_assist:false}},
    ],
    parties:[
      {i:1,type:'customer',name:'Ankit Pandya',   phone:'9712356001',bal:0},
      {i:2,type:'customer',name:'Meera Joshi',    phone:'9712356002',bal:2000},
      {i:3,type:'customer',name:'Rohit Trivedi',  phone:'9712356003',bal:0},
    ],
    invs:[
      {n:1,pi:1,status:'paid',  method:'upi', ago:10,domainData:{student_name:'Ankit Pandya',vehicle_class:'LMV',course_start_date:'2026-06-15',course_end_date:'2026-07-15',sessions_completed:18,dl_number:'GJ06-20260001',dl_issued:true},items:[lineItem('4-Wheeler Full Course (30 days)',DS(2),1,8000,18,'999292','course')]},
      {n:2,pi:2,status:'partial',method:'cash',ago:5,domainData:{student_name:'Meera Joshi',vehicle_class:'LMV',course_start_date:'2026-06-20',course_end_date:'2026-07-05',sessions_completed:6,dl_issued:false},items:[lineItem('4-Wheeler Basic Course (15 days)',DS(1),1,5000,18,'999292','course')]},
      {n:3,pi:3,status:'paid',  method:'upi', ago:3, domainData:{student_name:'Rohit Trivedi',vehicle_class:'MCWOG',course_start_date:'2026-06-22',course_end_date:'2026-07-02',sessions_completed:10,dl_issued:false},items:[lineItem('2-Wheeler Course (10 days)',DS(3),1,2000,18,'999292','course')]},
      {n:4,pi:1,status:'paid',  method:'upi', ago:1, domainData:{student_name:'Ankit Pandya',vehicle_class:'LMV',dl_issued:true},items:[lineItem('RTO Licence Assistance (LMV)',DS(4),1,800,18,'999292','application')]},
    ]})

  // ── Interior Contractor ───────────────────────────────────────────────────
  const IC=(i:number)=>uid(59,2,i,0)
  await seedDomain({ o:59, slug:'aakruti-interior-works', name:'Aakruti Interior & Renovation Works', phone:'9848003003', ownerName:'Nilesh Contractor', pin:'9303', branchName:'Aakruti Interior - Vadodara', domainType:'interior_contractor', prefix:'AIW', gstin:'24AABPN2345G1Z1', domainConfig:{ milestone_billing:true, boq_support:true, tds_applicable:true, project_tracking:true },
    categories:[
      {slug:'modular',   name:'Modular Works',   icon:'🪵',color:'#374151',sortOrder:0},
      {slug:'civil',     name:'Civil / Painting',icon:'🏗️',color:'#f59e0b',sortOrder:1},
      {slug:'electrical',name:'Electrical',      icon:'⚡',color:'#3b82f6',sortOrder:2},
    ],
    prods:[
      {i:1,name:'Modular Kitchen (per sqft, laminates)', sku:'IC-MK-LAM',  hsn:'940340',gst:18,unit:'sqft',pp:800, sp:1800, mrp:1800, low:0,stock:0,trackStock:false,consumable:false,attrs:{work_type:'modular_kitchen',material:'laminate',unit_of_measure:'sqft'}},
      {i:2,name:'Modular Wardrobe (per sqft)',            sku:'IC-MW-LAM',  hsn:'940340',gst:18,unit:'sqft',pp:600, sp:1400, mrp:1400, low:0,stock:0,trackStock:false,consumable:false,attrs:{work_type:'modular_wardrobe',material:'laminate',unit_of_measure:'sqft'}},
      {i:3,name:'False Ceiling (POP / gypsum per sqft)',  sku:'IC-FC-POP',  hsn:'940390',gst:18,unit:'sqft',pp:55,  sp:110,  mrp:110,  low:0,stock:0,trackStock:false,consumable:false,attrs:{work_type:'false_ceiling',material:'pop',unit_of_measure:'sqft'}},
      {i:4,name:'Interior Painting (2-coat emulsion)',   sku:'IC-PAINT-2C',hsn:'998719',gst:18,unit:'sqft',pp:12,  sp:25,   mrp:25,   low:0,stock:0,trackStock:false,consumable:false,attrs:{work_type:'painting',material:'emulsion',unit_of_measure:'sqft'}},
      {i:5,name:'Tile Fixing (floor, per sqft)',         sku:'IC-TILE-FLR',hsn:'998719',gst:18,unit:'sqft',pp:30,  sp:65,   mrp:65,   low:0,stock:0,trackStock:false,consumable:false,attrs:{work_type:'tile_fixing',material:'tiles',unit_of_measure:'sqft'}},
      {i:6,name:'Project Management / Supervision',      sku:'IC-MGMT',    hsn:'998719',gst:18,unit:'project',pp:0,sp:0,mrp:0,low:0,stock:0,trackStock:false,consumable:false,attrs:{work_type:'management'}},
    ],
    parties:[
      {i:1,type:'customer',name:'Shri Ram Builders Pvt Ltd',  phone:'9712357001',bal:50000,limit:1000000,gstin:'24AABPS1234N1Z3'},
      {i:2,type:'customer',name:'Ketan Shah (Residential)',   phone:'9712357002',bal:0},
      {i:3,type:'supplier',name:'Kajaria Tiles Distributor',  phone:'9800180001',bal:-25000,gstin:'24AABCK1234O1Z5'},
    ],
    invs:[
      {n:1,pi:1,status:'partial',method:'bank_transfer',ago:30,domainData:{project_id:'PRJ-2026-001',project_name:'Shri Ram Villa Interiors',milestone:'Foundation & Civil Work (40%)',tds_applicable:true,tds_rate_pct:1,tds_amount:8000,retention_pct:5},items:[lineItem('Interior Painting (2-coat emulsion)',IC(4),2000,25,18,'998719','sqft'),lineItem('Tile Fixing (floor, per sqft)',IC(5),800,65,18,'998719','sqft')]},
      {n:2,pi:2,status:'paid',   method:'upi',          ago:10,domainData:{project_id:'PRJ-2026-002',project_name:'Ketan Shah Home Renovation',tds_applicable:false},items:[lineItem('Modular Kitchen (per sqft, laminates)',IC(1),35,1800,18,'940340','sqft'),lineItem('False Ceiling (POP / gypsum per sqft)',IC(3),400,110,18,'940390','sqft')]},
      {n:3,pi:1,status:'confirmed',method:null,          ago:0, domainData:{project_id:'PRJ-2026-001',project_name:'Shri Ram Villa Interiors',milestone:'Modular Works (60%)',tds_applicable:true,tds_rate_pct:1,tds_amount:15120,retention_pct:5},items:[lineItem('Modular Kitchen (per sqft, laminates)',IC(1),80,1800,18,'940340','sqft'),lineItem('Modular Wardrobe (per sqft)',IC(2),120,1400,18,'940340','sqft')]},
    ]})

  // ── Packers & Movers ──────────────────────────────────────────────────────
  const PM=(i:number)=>uid(60,2,i,0)
  await seedDomain({ o:60, slug:'safemove-packers-movers', name:'SafeMove Packers & Movers', phone:'9848004004', ownerName:'Sunil Maurya', pin:'9304', branchName:'SafeMove - Vadodara', domainType:'packers_movers', prefix:'SPM', gstin:'24AABPS2345H1Z7', domainConfig:{ transit_insurance:true, advance_required:true, default_advance_pct:50 },
    categories:[
      {slug:'local',     name:'Local Shifting',  icon:'🏘️',color:'#3b82f6',sortOrder:0},
      {slug:'intercity', name:'Inter-city',       icon:'🚛',color:'#374151',sortOrder:1},
      {slug:'packing',   name:'Packing Services', icon:'📦',color:'#f59e0b',sortOrder:2},
    ],
    prods:[
      {i:1,name:'Local Shifting (1 BHK within city)',  sku:'PM-LOC-1BHK',hsn:'996713',gst:18,unit:'move',pp:3000,sp:6000,mrp:6000,low:0,stock:0,trackStock:false,consumable:false,attrs:{move_type:'local',   vehicle_type:'mini_truck',includes_packing:true}},
      {i:2,name:'Local Shifting (2/3 BHK within city)',sku:'PM-LOC-3BHK',hsn:'996713',gst:18,unit:'move',pp:5000,sp:10000,mrp:10000,low:0,stock:0,trackStock:false,consumable:false,attrs:{move_type:'local',   vehicle_type:'14ft_truck',includes_packing:true}},
      {i:3,name:'Intercity Move (Vadodara–Ahmedabad)', sku:'PM-ITC-AMD', hsn:'996713',gst:18,unit:'move',pp:8000,sp:18000,mrp:18000,low:0,stock:0,trackStock:false,consumable:false,attrs:{move_type:'intercity',vehicle_type:'20ft_truck',includes_packing:true,distance_km:110}},
      {i:4,name:'Intercity Move (Vadodara–Mumbai)',    sku:'PM-ITC-MUM', hsn:'996713',gst:18,unit:'move',pp:15000,sp:32000,mrp:32000,low:0,stock:0,trackStock:false,consumable:false,attrs:{move_type:'intercity',vehicle_type:'20ft_truck',includes_packing:true,distance_km:400}},
      {i:5,name:'Transit Insurance (per ₹1 lakh goods)',sku:'PM-INS-1L', hsn:'997134',gst:18,unit:'policy',pp:200,sp:500,mrp:500,low:0,stock:0,trackStock:false,consumable:false,attrs:{move_type:'insurance'}},
      {i:6,name:'Packing Only (no transport)',          sku:'PM-PACK-ONL',hsn:'996713',gst:18,unit:'job',pp:1500,sp:3500,mrp:3500,low:0,stock:0,trackStock:false,consumable:false,attrs:{move_type:'packing_only',includes_packing:true}},
    ],
    parties:[
      {i:1,type:'customer',name:'Anand Mehta (family shift)',phone:'9712358001',bal:9000, limit:50000},
      {i:2,type:'customer',name:'Infosys Baroda (office reloc)',phone:'9712358002',bal:0,limit:500000,gstin:'29AABCI1234B1Z1'},
      {i:3,type:'supplier',name:'Truck Owners Association',   phone:'9800190001',bal:-12000},
    ],
    invs:[
      {n:1,pi:1,status:'partial',method:'upi',          ago:7, domainData:{move_type:'intercity',from_city:'Vadodara',to_city:'Mumbai',move_date:'2026-06-22',advance_paid:16000,transit_insurance:true,insurance_value:300000,vehicle_no:'GJ06-BT1234'},items:[lineItem('Intercity Move (Vadodara–Mumbai)',PM(4),1,32000,18,'996713','move'),lineItem('Transit Insurance (per ₹1 lakh goods)',PM(5),3,500,18,'997134','policy')]},
      {n:2,pi:null,status:'paid',  method:'cash',        ago:4, domainData:{move_type:'local',from_city:'Vadodara',to_city:'Vadodara',move_date:'2026-06-25',advance_paid:3000,vehicle_no:'GJ06-AT5678'},items:[lineItem('Local Shifting (1 BHK within city)',PM(1),1,6000,18,'996713','move')]},
      {n:3,pi:2,status:'confirmed',method:null,          ago:0, domainData:{move_type:'intercity',from_city:'Vadodara',to_city:'Ahmedabad',move_date:'2026-07-05',advance_paid:9000},items:[lineItem('Intercity Move (Vadodara–Ahmedabad)',PM(3),1,18000,18,'996713','move')]},
    ]})

  // ── Security Agency ───────────────────────────────────────────────────────
  const SGA=(i:number)=>uid(61,2,i,0)
  await seedDomain({ o:61, slug:'shieldguard-security', name:'ShieldGuard Security Services', phone:'9848005005', ownerName:'Col. Rajendra Singh (Retd)', pin:'9305', branchName:'ShieldGuard - Vadodara', domainType:'security_agency', prefix:'SGS', gstin:'24AABPS3456I1Z4', domainConfig:{ monthly_billing:true, attendance_tracking:true, esic_pf_compliance:true },
    categories:[
      {slug:'residential',name:'Residential',  icon:'🏘️',color:'#3b82f6',sortOrder:0},
      {slug:'commercial', name:'Commercial',   icon:'🏢',color:'#374151',sortOrder:1},
      {slug:'event',      name:'Event Security',icon:'🎪',color:'#f59e0b',sortOrder:2},
    ],
    prods:[
      {i:1,name:'Armed Guard (8-hr shift, per day)',    sku:'SGA-ARD-8H', hsn:'998523',gst:18,unit:'guard-day',pp:700, sp:1200, mrp:1200, low:0,stock:0,trackStock:false,consumable:false,attrs:{guard_type:'armed',  shift_hours:8, includes_mgmt_fee:false}},
      {i:2,name:'Unarmed Guard (8-hr shift, per day)',  sku:'SGA-UNA-8H', hsn:'998523',gst:18,unit:'guard-day',pp:500, sp:900,  mrp:900,  low:0,stock:0,trackStock:false,consumable:false,attrs:{guard_type:'unarmed',shift_hours:8, includes_mgmt_fee:false}},
      {i:3,name:'Security Supervisor (12-hr shift)',    sku:'SGA-SUP-12H',hsn:'998523',gst:18,unit:'guard-day',pp:900, sp:1600, mrp:1600, low:0,stock:0,trackStock:false,consumable:false,attrs:{guard_type:'supervisor',shift_hours:12,includes_mgmt_fee:false}},
      {i:4,name:'Monthly Contract (1 armed guard, 26d)',sku:'SGA-MON-ARM',hsn:'998523',gst:18,unit:'month',pp:18000,sp:28000,mrp:28000,low:0,stock:0,trackStock:false,consumable:false,attrs:{guard_type:'armed',  shift_hours:8, includes_mgmt_fee:true}},
      {i:5,name:'Event Security Package (1-day)',       sku:'SGA-EVT-1D', hsn:'998523',gst:18,unit:'event',pp:5000, sp:10000,mrp:10000,low:0,stock:0,trackStock:false,consumable:false,attrs:{guard_type:'unarmed',shift_hours:12,includes_mgmt_fee:true}},
    ],
    parties:[
      {i:1,type:'customer',name:'Torrent Power (Factory)',   phone:'9712359001',bal:28000,limit:500000,gstin:'24AABCT1234G1Z1'},
      {i:2,type:'customer',name:'Akshar Society (Residential)',phone:'9712359002',bal:0,   limit:100000},
      {i:3,type:'customer',name:'Celebrations Events',       phone:'9712359003',bal:0},
    ],
    invs:[
      {n:1,pi:1,status:'partial',method:'bank_transfer',ago:5, domainData:{contract_type:'monthly',deployment_start:'2026-06-01',deployment_end:'2026-06-30',guards_deployed:2,shift:'day',client_site:'Torrent Factory Gate',management_charges_pct:15,esic_pf_included:true},items:[lineItem('Monthly Contract (1 armed guard, 26d)',SGA(4),2,28000,18,'998523','month')]},
      {n:2,pi:2,status:'paid',  method:'upi',          ago:3, domainData:{contract_type:'monthly',deployment_start:'2026-06-01',deployment_end:'2026-06-30',guards_deployed:3,shift:'day',client_site:'Akshar Society Gate',management_charges_pct:15,esic_pf_included:true},items:[lineItem('Monthly Contract (1 armed guard, 26d)',SGA(4),3,28000,18,'998523','month')]},
      {n:3,pi:3,status:'paid',  method:'cash',         ago:1, domainData:{contract_type:'event',deployment_start:'2026-06-28',deployment_end:'2026-06-28',guards_deployed:8,shift:'custom',client_site:'Celebrations Wedding Venue'},items:[lineItem('Event Security Package (1-day)',SGA(5),2,10000,18,'998523','event'),lineItem('Unarmed Guard (8-hr shift, per day)',SGA(2),6,900,18,'998523','guard-day')]},
    ]})

  // ── Crèche / Daycare ──────────────────────────────────────────────────────
  const CC=(i:number)=>uid(62,2,i,0)
  await seedDomain({ o:62, slug:'tiny-tots-daycare', name:'Tiny Tots Daycare & Play School', phone:'9848006006', ownerName:'Sonal Mehta', pin:'9306', branchName:'Tiny Tots Daycare - Alkapuri', domainType:'creche_daycare', prefix:'TTD', domainConfig:{ child_profiles:true, attendance_tracking:true, monthly_billing:true, meal_tracking:true },
    categories:[
      {slug:'monthly',   name:'Monthly Plans', icon:'📅',color:'#3b82f6',sortOrder:0},
      {slug:'daily',     name:'Day Care',      icon:'☀️',color:'#f59e0b',sortOrder:1},
      {slug:'activity',  name:'Activity',      icon:'🎨',color:'#8b5cf6',sortOrder:2},
    ],
    prods:[
      {i:1,name:'Full Day Care (monthly, 8am–7pm)',   sku:'CC-FDC-M',  hsn:'999211',gst:0,unit:'month',pp:3000,sp:5500,mrp:5500,low:0,stock:0,trackStock:false,consumable:false,attrs:{age_group:'infant',care_type:'full_day',meals_included:true}},
      {i:2,name:'Half Day Care (monthly, 8am–1pm)',   sku:'CC-HDC-M',  hsn:'999211',gst:0,unit:'month',pp:1800,sp:3500,mrp:3500,low:0,stock:0,trackStock:false,consumable:false,attrs:{age_group:'toddler',care_type:'half_day',meals_included:false}},
      {i:3,name:'Drop-in Day Care (per day)',          sku:'CC-DROP-D', hsn:'999211',gst:0,unit:'day',  pp:150, sp:350, mrp:350, low:0,stock:0,trackStock:false,consumable:false,attrs:{age_group:'any',care_type:'drop_in',meals_included:true}},
      {i:4,name:'Play School (monthly, 3hrs/day)',     sku:'CC-PLAY-M', hsn:'999211',gst:0,unit:'month',pp:2000,sp:4000,mrp:4000,low:0,stock:0,trackStock:false,consumable:false,attrs:{age_group:'preschool',care_type:'play_school',meals_included:false}},
      {i:5,name:'Meal Plan Add-on (monthly)',          sku:'CC-MEAL-M', hsn:'996334',gst:5,unit:'month',pp:600, sp:1200,mrp:1200,low:0,stock:0,trackStock:false,consumable:false,attrs:{age_group:'any',care_type:'meal_plan',meals_included:true}},
    ],
    parties:[
      {i:1,type:'customer',name:'Rohit & Priya Shah (daughter Aanya)', phone:'9712360001',bal:0},
      {i:2,type:'customer',name:'Anand Patel (son Dev)',                phone:'9712360002',bal:350},
      {i:3,type:'customer',name:'Meera Joshi (son Arjun)',              phone:'9712360003',bal:0},
    ],
    invs:[
      {n:1,pi:1,status:'paid',  method:'upi', ago:5, domainData:{child_name:'Aanya Shah',child_age_months:18,billing_month:'June 2026',attendance_days:22,meals_provided:22},items:[lineItem('Full Day Care (monthly, 8am–7pm)',CC(1),1,5500,0,'999211','month'),lineItem('Meal Plan Add-on (monthly)',CC(5),1,1200,5,'996334','month')]},
      {n:2,pi:2,status:'partial',method:'cash',ago:4,domainData:{child_name:'Dev Patel',child_age_months:36,billing_month:'June 2026',attendance_days:20,meals_provided:0},items:[lineItem('Half Day Care (monthly, 8am–1pm)',CC(2),1,3500,0,'999211','month')]},
      {n:3,pi:3,status:'paid',  method:'upi', ago:3, domainData:{child_name:'Arjun Joshi',child_age_months:48,billing_month:'June 2026',attendance_days:18,meals_provided:0},items:[lineItem('Play School (monthly, 3hrs/day)',CC(4),1,4000,0,'999211','month')]},
      {n:4,pi:null,status:'paid',method:'cash',ago:1,domainData:{child_name:'Walk-in child',billing_month:'June 2026',attendance_days:1,meals_provided:1},items:[lineItem('Drop-in Day Care (per day)',CC(3),2,350,0,'999211','day')]},
    ]})

  // ── Dance / Music School ──────────────────────────────────────────────────
  const DM=(i:number)=>uid(63,2,i,0)
  await seedDomain({ o:63, slug:'rhythm-academy-baroda', name:'Rhythm Dance & Music Academy', phone:'9848007007', ownerName:'Kavita Nair', pin:'9307', branchName:'Rhythm Academy - Baroda', domainType:'dance_music_school', prefix:'RDA', domainConfig:{ student_register:true, batch_management:true, exam_tracking:true, installment_billing:true },
    categories:[
      {slug:'dance',    name:'Dance',        icon:'💃',color:'#ec4899',sortOrder:0},
      {slug:'music',    name:'Music',        icon:'🎵',color:'#8b5cf6',sortOrder:1},
      {slug:'costume',  name:'Costume / Props',icon:'👗',color:'#f59e0b',sortOrder:2},
    ],
    prods:[
      {i:1,name:'Bharatanatyam (monthly)',      sku:'DM-BNAT-M',hsn:'999311',gst:0,unit:'month',pp:1200,sp:2500,mrp:2500,low:0,stock:0,trackStock:false,consumable:false,attrs:{art_form:'bharatanatyam',level:'beginner',sessions_per_week:3,exam_board:'BharataMuni'}},
      {i:2,name:'Classical Vocal (monthly)',    sku:'DM-VOCAL-M',hsn:'999311',gst:0,unit:'month',pp:1000,sp:2000,mrp:2000,low:0,stock:0,trackStock:false,consumable:false,attrs:{art_form:'hindustani_vocal',level:'beginner',sessions_per_week:2}},
      {i:3,name:'Western Dance (monthly)',      sku:'DM-WDNC-M',hsn:'999311',gst:0,unit:'month',pp:1000,sp:2000,mrp:2000,low:0,stock:0,trackStock:false,consumable:false,attrs:{art_form:'western_dance',level:'beginner',sessions_per_week:3}},
      {i:4,name:'Guitar Lessons (monthly)',     sku:'DM-GTR-M', hsn:'999311',gst:0,unit:'month',pp:1200,sp:2500,mrp:2500,low:0,stock:0,trackStock:false,consumable:false,attrs:{art_form:'guitar',level:'beginner',sessions_per_week:2,instrument:'acoustic_guitar'}},
      {i:5,name:'Annual Exam Fee (Bharatanatyam)',sku:'DM-EXAM-BN',hsn:'999311',gst:18,unit:'exam',pp:1000,sp:2000,mrp:2000,low:0,stock:0,trackStock:false,consumable:false,attrs:{art_form:'bharatanatyam',level:'grade_exam'}},
      {i:6,name:'Costume — Bharatanatyam Set',  sku:'DM-CST-BN',hsn:'61149090',gst:5, unit:'set',pp:4000,sp:7000,mrp:7000,low:2, stock:5, trackStock:true, consumable:false,attrs:{art_form:'bharatanatyam'}},
    ],
    parties:[
      {i:1,type:'customer',name:'Anita Patel (daughter Riya)',  phone:'9712361001',bal:0},
      {i:2,type:'customer',name:'Suresh Nair (son Aryan)',      phone:'9712361002',bal:500},
      {i:3,type:'customer',name:'Priya Joshi (self, adult)',    phone:'9712361003',bal:0},
    ],
    invs:[
      {n:1,pi:1,status:'paid',  method:'upi', ago:5, domainData:{student_name:'Riya Patel',art_form:'bharatanatyam',batch:'Morning Batch',billing_month:'June 2026',exam_registered:true},items:[lineItem('Bharatanatyam (monthly)',DM(1),1,2500,0,'999311','month')]},
      {n:2,pi:2,status:'partial',method:'cash',ago:4,domainData:{student_name:'Aryan Nair',art_form:'guitar',batch:'Evening Batch',billing_month:'June 2026',exam_registered:false},items:[lineItem('Guitar Lessons (monthly)',DM(4),1,2500,0,'999311','month')]},
      {n:3,pi:3,status:'paid',  method:'upi', ago:3, domainData:{student_name:'Priya Joshi',art_form:'western_dance',batch:'Weekend Batch',billing_month:'June 2026',exam_registered:false},items:[lineItem('Western Dance (monthly)',DM(3),1,2000,0,'999311','month')]},
      {n:4,pi:1,status:'paid',  method:'upi', ago:1, domainData:{student_name:'Riya Patel',art_form:'bharatanatyam',exam_registered:true},items:[lineItem('Annual Exam Fee (Bharatanatyam)',DM(5),1,2000,18,'999311','exam'),lineItem('Costume — Bharatanatyam Set',DM(6),1,7000,5,'61149090','set')]},
    ]})

  // ── Footwear Store ────────────────────────────────────────────────────────
  const FW=(i:number)=>uid(64,2,i,0)
  await seedDomain({ o:64, slug:'stepright-shoe-store', name:'StepRight Shoe Store', phone:'9848008008', ownerName:'Maulik Patel', pin:'9308', branchName:'StepRight Shoes - Baroda', domainType:'footwear', prefix:'SRS', domainConfig:{ size_variant_billing:true, exchange_policy:true, low_stock_alert:true },
    categories:[
      {slug:'mens',     name:"Men's Footwear",   icon:'👞',color:'#374151',sortOrder:0},
      {slug:'womens',   name:"Women's Footwear", icon:'👠',color:'#ec4899',sortOrder:1},
      {slug:'kids',     name:"Kids' Footwear",   icon:'👟',color:'#3b82f6',sortOrder:2},
      {slug:'sports',   name:'Sports / Casual',  icon:'👟',color:'#10b981',sortOrder:3},
    ],
    brands:[
      {slug:'bata',     name:'Bata'},
      {slug:'action',   name:'Action'},
      {slug:'sparx',    name:'Sparx'},
      {slug:'red-tape', name:'Red Tape'},
    ],
    prods:[
      {i:1,name:"Men's Formal Shoe (leather)",  sku:'FW-MEN-FRM',hsn:'64051000',gst:18,unit:'pair',pp:700, sp:1499,mrp:1499,low:3,stock:20,trackStock:true,consumable:false,attrs:{gender:'mens',sole_type:'leather',closure:'lace',sizes_available:[6,7,8,9,10,11]},cat:'mens',   brand:'red-tape'},
      {i:2,name:"Men's Casual Sneaker",         sku:'FW-MEN-CSN',hsn:'64041100',gst:18,unit:'pair',pp:500, sp:999, mrp:999, low:5,stock:30,trackStock:true,consumable:false,attrs:{gender:'mens',sole_type:'rubber',closure:'lace',sizes_available:[6,7,8,9,10]},cat:'sports',   brand:'sparx'},
      {i:3,name:"Women's Sandal (block heel)",  sku:'FW-WOM-SND',hsn:'64035100',gst:18,unit:'pair',pp:400, sp:849, mrp:849, low:3,stock:25,trackStock:true,consumable:false,attrs:{gender:'womens',sole_type:'synthetic',closure:'strap',sizes_available:[3,4,5,6,7,8]},cat:'womens',brand:'bata'},
      {i:4,name:"Women's Flat Footwear (juttis)",sku:'FW-WOM-JUT',hsn:'64035100',gst:18,unit:'pair',pp:300, sp:599, mrp:599, low:5,stock:40,trackStock:true,consumable:false,attrs:{gender:'womens',sole_type:'synthetic',closure:'slip_on',sizes_available:[3,4,5,6,7]},cat:'womens',brand:'action'},
      {i:5,name:"Kids' School Shoe",            sku:'FW-KID-SCH',hsn:'64051000',gst:18,unit:'pair',pp:350, sp:699, mrp:699, low:5,stock:35,trackStock:true,consumable:false,attrs:{gender:'kids',sole_type:'rubber',closure:'velcro',sizes_available:[1,2,3,4,5]},cat:'kids',   brand:'bata'},
      {i:6,name:'Sports Running Shoe',          sku:'FW-SPT-RUN',hsn:'64041100',gst:18,unit:'pair',pp:800, sp:1699,mrp:1699,low:3,stock:15,trackStock:true,consumable:false,attrs:{gender:'unisex',sole_type:'EVA',closure:'lace',sizes_available:[5,6,7,8,9,10,11]},cat:'sports',brand:'sparx'},
    ],
    parties:[
      {i:1,type:'customer',name:'Ankit Shah',    phone:'9712362001',bal:0},
      {i:2,type:'customer',name:'Priya Patel',   phone:'9712362002',bal:699},
      {i:3,type:'supplier',name:'Bata India Ltd (Distributor)',phone:'9800200001',bal:-22000,gstin:'03AABCB1234P1Z7'},
    ],
    invs:[
      {n:1,pi:1,status:'paid',  method:'upi', ago:5, domainData:{size_sold:'9',exchange_within_days:7},items:[lineItem("Men's Formal Shoe (leather)",FW(1),1,1499,18,'64051000','pair'),lineItem("Men's Casual Sneaker",FW(2),1,999,18,'64041100','pair')]},
      {n:2,pi:2,status:'partial',method:'cash',ago:3,domainData:{size_sold:'5',exchange_within_days:7},items:[lineItem("Women's Sandal (block heel)",FW(3),2,849,18,'64035100','pair')]},
      {n:3,pi:null,status:'paid',method:'cash',ago:2,domainData:{size_sold:'3',exchange_within_days:7},items:[lineItem("Kids' School Shoe",FW(5),2,699,18,'64051000','pair')]},
      {n:4,pi:1,status:'paid',  method:'card',ago:1,domainData:{size_sold:'8',exchange_within_days:7},items:[lineItem('Sports Running Shoe',FW(6),1,1699,18,'64041100','pair')]},
    ]})

  // ── Tent House ────────────────────────────────────────────────────────────
  const TH=(i:number)=>uid(65,2,i,0)
  await seedDomain({ o:65, slug:'shubh-tent-house', name:'Shubh Tent House & Party Supplies', phone:'9848009009', ownerName:'Kailash Prajapati', pin:'9309', branchName:'Shubh Tent House - Baroda', domainType:'tent_house', prefix:'STH', domainConfig:{ rental_tracking:true, damage_deposit:true, advance_required:true, default_advance_pct:50 },
    categories:[
      {slug:'furniture', name:'Furniture',   icon:'🪑',color:'#374151',sortOrder:0},
      {slug:'tents',     name:'Tents / Shamiyana',icon:'⛺',color:'#f59e0b',sortOrder:1},
      {slug:'decor',     name:'Décor Items', icon:'🌸',color:'#ec4899',sortOrder:2},
      {slug:'crockery',  name:'Crockery',    icon:'🍽️',color:'#3b82f6',sortOrder:3},
    ],
    prods:[
      {i:1,name:'Plastic Chair (per day per piece)',  sku:'TH-CHAIR-PD',hsn:'940179',gst:18,unit:'pcs-day',pp:5,  sp:15,  mrp:15,  low:50,stock:500,trackStock:true,consumable:false,attrs:{item_category:'furniture',returnable:true, rental_unit:'per_day'}},
      {i:2,name:'Round Table 4-seater (per day)',     sku:'TH-TBL-4S',  hsn:'940360',gst:18,unit:'pcs-day',pp:30, sp:80,  mrp:80,  low:10,stock:100,trackStock:true,consumable:false,attrs:{item_category:'furniture',returnable:true, rental_unit:'per_day'}},
      {i:3,name:'Shamiyana / Canopy 20x30 (per day)',sku:'TH-SHAM-20',  hsn:'630612',gst:5, unit:'pcs-day',pp:500,sp:1500,mrp:1500,low:2, stock:10, trackStock:true,consumable:false,attrs:{item_category:'tent',    returnable:true, rental_unit:'per_day',size_sqft:600}},
      {i:4,name:'Rajasthani Tent Set-up (per day)',  sku:'TH-RTENT-PD',hsn:'630612',gst:5, unit:'event',  pp:3000,sp:8000,mrp:8000,low:1, stock:3,  trackStock:true,consumable:false,attrs:{item_category:'tent',    returnable:true, rental_unit:'per_event'}},
      {i:5,name:'Stainless Steel Plate (per day)',   sku:'TH-PLATE-SD',hsn:'732393',gst:18,unit:'pcs-day',pp:2,  sp:5,   mrp:5,   low:100,stock:2000,trackStock:true,consumable:false,attrs:{item_category:'crockery',returnable:true, rental_unit:'per_day'}},
      {i:6,name:'Glass / Tumbler (per day)',         sku:'TH-GLASS-PD',hsn:'701320',gst:18,unit:'pcs-day',pp:1,  sp:3,   mrp:3,   low:100,stock:1500,trackStock:true,consumable:false,attrs:{item_category:'crockery',returnable:true, rental_unit:'per_day'}},
      {i:7,name:'Labour / Setup Charges (per event)',sku:'TH-LABOUR-EV',hsn:'998523',gst:18,unit:'event',  pp:2000,sp:5000,mrp:5000,low:0,stock:0,   trackStock:false,consumable:false,attrs:{item_category:'service', returnable:false,rental_unit:'per_event'}},
    ],
    parties:[
      {i:1,type:'customer',name:'Mehta Family (wedding)',  phone:'9712363001',bal:15000,limit:100000},
      {i:2,type:'customer',name:'Shree Ram Society (event)',phone:'9712363002',bal:0},
      {i:3,type:'supplier',name:'Bhavani Furniture Manufacturers',phone:'9800210001',bal:-18000},
    ],
    invs:[
      {n:1,pi:1,status:'partial',method:'bank_transfer',ago:10,domainData:{event_date:'2026-12-10',event_type:'wedding',venue:'Mehta Bungalow, Vasna',security_deposit:10000,advance_paid:15000,return_date:'2026-12-11',items_out:['400 chairs','50 tables','2 shamiyana']},items:[lineItem('Plastic Chair (per day per piece)',TH(1),400,15,18,'940179','pcs-day'),lineItem('Round Table 4-seater (per day)',TH(2),50,80,18,'940360','pcs-day'),lineItem('Shamiyana / Canopy 20x30 (per day)',TH(3),2,1500,5,'630612','pcs-day'),lineItem('Labour / Setup Charges (per event)',TH(7),1,5000,18,'998523','event')]},
      {n:2,pi:2,status:'paid',  method:'upi',          ago:5,domainData:{event_date:'2026-06-24',event_type:'community_function',venue:'Shree Ram Society Garden',security_deposit:3000,advance_paid:5000,return_date:'2026-06-25',items_out:['100 chairs','10 tables']},items:[lineItem('Plastic Chair (per day per piece)',TH(1),100,15,18,'940179','pcs-day'),lineItem('Round Table 4-seater (per day)',TH(2),10,80,18,'940360','pcs-day'),lineItem('Stainless Steel Plate (per day)',TH(5),200,5,18,'732393','pcs-day'),lineItem('Labour / Setup Charges (per event)',TH(7),1,5000,18,'998523','event')]},
      {n:3,pi:null,status:'paid',method:'cash',         ago:2,domainData:{event_date:'2026-06-27',event_type:'birthday',venue:'Home',security_deposit:2000,advance_paid:2000,return_date:'2026-06-28',items_out:['50 chairs']},items:[lineItem('Plastic Chair (per day per piece)',TH(1),50,15,18,'940179','pcs-day'),lineItem('Glass / Tumbler (per day)',TH(6),100,3,18,'701320','pcs-day')]},
    ]})

  // ── Iron & Steel Trading ──────────────────────────────────────────────────
  const IS=(i:number)=>uid(66,2,i,0)
  await seedDomain({ o:66, slug:'shree-steel-traders', name:'Shree Steel Traders', phone:'9849001001', ownerName:'Mahesh Agrawal', pin:'9401', branchName:'Shree Steel Traders - Baroda', domainType:'iron_steel', prefix:'SST', gstin:'24AABCS1234A1Z8', domainConfig:{ eway_bill:true, weight_billing:true, credit_terms:true, default_credit_days:15, do_number_required:true, vehicle_capture:true },
    categories:[
      {slug:'tmt_bars',   name:'TMT Bars',         icon:'🔩',color:'#ef4444',sortOrder:0},
      {slug:'structural', name:'Structural Steel',  icon:'🏗️',color:'#374151',sortOrder:1},
      {slug:'sheets',     name:'Sheets & Plates',   icon:'📋',color:'#6b7280',sortOrder:2},
      {slug:'pipes',      name:'Pipes & Sections',  icon:'🔧',color:'#3b82f6',sortOrder:3},
    ],
    brands:[
      {slug:'tata_tiscon',name:'Tata Tiscon'},
      {slug:'jsw',        name:'JSW Steel'},
      {slug:'sail',       name:'SAIL'},
      {slug:'jindal',     name:'Jindal Steel'},
    ],
    prods:[
      {i:1,name:'Tata Tiscon 10mm TMT Bar Fe500D', sku:'SST-TMT-10',hsn:'72142000',gst:18,unit:'kg', pp:57, sp:67, mrp:70, low:500, stock:5000,attrs:{grade:'Fe500D',shape:'tmt_bar',diameter_mm:'10mm',length_ft:'40 ft',weight_per_unit_kg:6.17,mill:'Tata Tiscon',sold_by:'Per Kg',finish:'Hot Rolled (HR)'},cat:'tmt_bars',brand:'tata_tiscon'},
      {i:2,name:'Tata Tiscon 12mm TMT Bar Fe500D', sku:'SST-TMT-12',hsn:'72142000',gst:18,unit:'kg', pp:57, sp:67, mrp:70, low:500, stock:4000,attrs:{grade:'Fe500D',shape:'tmt_bar',diameter_mm:'12mm',length_ft:'40 ft',weight_per_unit_kg:8.89,mill:'Tata Tiscon',sold_by:'Per Kg',finish:'Hot Rolled (HR)'},cat:'tmt_bars',brand:'tata_tiscon'},
      {i:3,name:'JSW 16mm TMT Bar Fe500',          sku:'SST-TMT-16',hsn:'72142000',gst:18,unit:'kg', pp:55, sp:65, mrp:68, low:300, stock:3000,attrs:{grade:'Fe500',shape:'tmt_bar',diameter_mm:'16mm',length_ft:'40 ft',weight_per_unit_kg:15.8,mill:'JSW Steel',sold_by:'Per Kg',finish:'Hot Rolled (HR)'},cat:'tmt_bars',brand:'jsw'},
      {i:4,name:'JSW 20mm TMT Bar Fe500',          sku:'SST-TMT-20',hsn:'72142000',gst:18,unit:'kg', pp:55, sp:65, mrp:68, low:200, stock:2000,attrs:{grade:'Fe500',shape:'tmt_bar',diameter_mm:'20mm',length_ft:'40 ft',weight_per_unit_kg:24.7,mill:'JSW Steel',sold_by:'Per Kg',finish:'Hot Rolled (HR)'},cat:'tmt_bars',brand:'jsw'},
      {i:5,name:'SAIL IS2062 Angle 50x50x5mm',     sku:'SST-ANG-50',hsn:'72162100',gst:18,unit:'kg', pp:60, sp:71, mrp:74, low:200, stock:1500,attrs:{grade:'IS2062 E250',shape:'angle',diameter_mm:'Custom',mill:'SAIL',sold_by:'Per Kg',finish:'Hot Rolled (HR)'},cat:'structural',brand:'sail'},
      {i:6,name:'SAIL MS Flat Bar 50x6mm',         sku:'SST-FLT-50',hsn:'72162900',gst:18,unit:'kg', pp:59, sp:70, mrp:73, low:100, stock:800, attrs:{grade:'IS2062 E250',shape:'flat_bar',mill:'SAIL',sold_by:'Per Kg',finish:'Hot Rolled (HR)'},cat:'structural',brand:'sail'},
      {i:7,name:'HR Sheet 2mm IS513',               sku:'SST-SHT-2',  hsn:'72082700',gst:18,unit:'kg', pp:62, sp:73, mrp:76, low:100, stock:600, attrs:{grade:'IS513 CR2',shape:'sheet_hr',thickness_mm:2,width_mm:1250,mill:'JSW Steel',sold_by:'Per Kg',finish:'Hot Rolled (HR)'},cat:'sheets',brand:'jsw'},
      {i:8,name:'ERW MS Pipe 1.5" (per kg)',        sku:'SST-PIP-1.5',hsn:'73063010',gst:18,unit:'kg', pp:64, sp:76, mrp:79, low:100, stock:500, attrs:{grade:'IS1239',shape:'pipe_round',mill:'Jindal Steel',sold_by:'Per Kg',finish:'Hot Rolled (HR)'},cat:'pipes',brand:'jindal'},
    ],
    parties:[
      {i:1,type:'customer',name:'Patel Construction',     phone:'9712346001',bal:125000, limit:1000000,gstin:'24AABCP5001B1Z3'},
      {i:2,type:'customer',name:'Modi Infra Projects',    phone:'9712346002',bal:230000, limit:2000000,gstin:'24AABCM5002I1Z7'},
      {i:3,type:'customer',name:'Rajesh Contractor',      phone:'9712346003',bal:48000,  limit:500000},
      {i:4,type:'supplier',name:'SAIL Distribution (BRD)',phone:'9800700001',bal:-450000,gstin:'12AABCS1000A1ZA'},
      {i:5,type:'supplier',name:'JSW Steel Dealer',       phone:'9800700002',bal:-280000,gstin:'27AABCJ1234B1Z5'},
    ],
    invs:[
      {n:1,pi:1,status:'paid',   method:'bank_transfer',ago:10,domainData:{vehicle_no:'GJ06AB1234',do_number:'DO-2026-0512',lr_number:'LR-ABT-0124',transporter_name:'Agarwal Transport',loading_weight_kg:5170,tare_weight_kg:4200,net_weight_kg:5170,site_name:'Patel Villa Phase 2',payment_terms:'15_days',credit_days:15},items:[lineItem('Tata Tiscon 10mm TMT Bar Fe500D',IS(1),500,67,18,'72142000','kg'),lineItem('Tata Tiscon 12mm TMT Bar Fe500D',IS(2),170,67,18,'72142000','kg')]},
      {n:2,pi:2,status:'partial',method:'bank_transfer',ago:5, domainData:{vehicle_no:'GJ06CD5678',do_number:'DO-2026-0528',transporter_name:'Shree Transport',loading_weight_kg:8000,net_weight_kg:7950,site_name:'Modi Bridge Contract',payment_terms:'30_days',credit_days:30},items:[lineItem('JSW 16mm TMT Bar Fe500',IS(3),300,65,18,'72142000','kg'),lineItem('JSW 20mm TMT Bar Fe500',IS(4),200,65,18,'72142000','kg'),lineItem('SAIL IS2062 Angle 50x50x5mm',IS(5),250,71,18,'72162100','kg')]},
      {n:3,pi:3,status:'confirmed',method:null,ago:1,domainData:{vehicle_no:'GJ06EF9012',do_number:'DO-2026-0601',site_name:'Rajesh New House'},items:[lineItem('Tata Tiscon 10mm TMT Bar Fe500D',IS(1),120,67,18,'72142000','kg'),lineItem('HR Sheet 2mm IS513',IS(7),50,73,18,'72082700','kg')]},
    ]})

  // ── Expenses ────────────────────────────────────────────────────────────────
  await seedExpenses()

  // ── Extra tables: batches, invoice_sequences, ai_suggestions, razorpay_orders ──
  await seedExtraTables()

  console.log('\n✅ Seed complete!\n')
  console.log('Architecture: each tenant has its own PostgreSQL schema (t_{slug})')
  console.log('Login: POST /api/auth/login  { tenantPhone, phone, pin }\n')
  console.log('Accounts:')
  console.log('  Kirana       tenantPhone=9876543210  phone=9876543210  PIN=1111')
  console.log('  Kirana staff tenantPhone=9876543210  phone=9876500001  PIN=2222')
  console.log('  Restaurant   tenantPhone=9898765432  phone=9898765432  PIN=3333')
  console.log('  Pharmacy     tenantPhone=9925123456  phone=9925123456  PIN=4444')
  console.log('  Electronics  tenantPhone=9933445566  phone=9933445566  PIN=7777')
  console.log('  Enterprise   tenantPhone=9911223344  phone=9911223344  PIN=5555')
  console.log('  Salon        tenantPhone=9844001001  phone=9844001001  PIN=8001')
  console.log('  Wholesale    tenantPhone=9844002002  phone=9844002002  PIN=8002')
  console.log('  Sweets       tenantPhone=9844003003  phone=9844003003  PIN=8003')
  console.log('  Clinic       tenantPhone=9844004004  phone=9844004004  PIN=8004')
  console.log('  Optical      tenantPhone=9844005005  phone=9844005005  PIN=8005')
  console.log('  Jewellery    tenantPhone=9844006006  phone=9844006006  PIN=8006')
  console.log('  Automobile   tenantPhone=9844007007  phone=9844007007  PIN=8007')
  console.log('  Textile      tenantPhone=9844008008  phone=9844008008  PIN=8008')
  console.log('  Hotel        tenantPhone=9844009009  phone=9844009009  PIN=8009')
  console.log('  Catering     tenantPhone=9844010010  phone=9844010010  PIN=8010')
  console.log('  Coaching     tenantPhone=9844011011  phone=9844011011  PIN=8011')
  console.log('  Printing     tenantPhone=9844012012  phone=9844012012  PIN=8012')
  console.log('  Laundry      tenantPhone=9844013013  phone=9844013013  PIN=8013')
  console.log('  Hardware     tenantPhone=9845001001  phone=9845001001  PIN=9001')
  console.log('  Petrol Pump  tenantPhone=9845002002  phone=9845002002  PIN=9002')
  console.log('  Agri Inputs  tenantPhone=9845003003  phone=9845003003  PIN=9003')
  console.log('  Repair Shop  tenantPhone=9845004004  phone=9845004004  PIN=9004')
  console.log('  Tiffin Svc   tenantPhone=9845005005  phone=9845005005  PIN=9005')
  console.log('  Gym          tenantPhone=9846001001  phone=9846001001  PIN=9101')
  console.log('  Diag Lab     tenantPhone=9846002002  phone=9846002002  PIN=9102')
  console.log('  Pest Control tenantPhone=9846003003  phone=9846003003  PIN=9103')
  console.log('  Photography  tenantPhone=9846004004  phone=9846004004  PIN=9104')
  console.log('  Tailoring    tenantPhone=9847001001  phone=9847001001  PIN=9201')
  console.log('  CA Firm      tenantPhone=9847002002  phone=9847002002  PIN=9202')
  console.log('  Gas Agency   tenantPhone=9847003003  phone=9847003003  PIN=9203')
  console.log('  Event Mgmt   tenantPhone=9847004004  phone=9847004004  PIN=9204')
  console.log('  Veterinary   tenantPhone=9847005005  phone=9847005005  PIN=9205')
  console.log('  Milk Dairy   tenantPhone=9847006006  phone=9847006006  PIN=9206')
  console.log('  Banquet Hall tenantPhone=9847007007  phone=9847007007  PIN=9207')
  console.log('  Real Estate  tenantPhone=9847008008  phone=9847008008  PIN=9208')
  console.log('  Water Supply tenantPhone=9848001001  phone=9848001001  PIN=9301')
  console.log('  Driving Schl tenantPhone=9848002002  phone=9848002002  PIN=9302')
  console.log('  Interior Con tenantPhone=9848003003  phone=9848003003  PIN=9303')
  console.log('  Pack & Move  tenantPhone=9848004004  phone=9848004004  PIN=9304')
  console.log('  Security Agn tenantPhone=9848005005  phone=9848005005  PIN=9305')
  console.log('  Daycare      tenantPhone=9848006006  phone=9848006006  PIN=9306')
  console.log('  Dance/Music  tenantPhone=9848007007  phone=9848007007  PIN=9307')
  console.log('  Footwear     tenantPhone=9848008008  phone=9848008008  PIN=9308')
  console.log('  Tent House   tenantPhone=9848009009  phone=9848009009  PIN=9309')
  console.log('  Iron & Steel tenantPhone=9849001001  phone=9849001001  PIN=9401')
}

main()
  .catch(err => { console.error('❌ Seed failed:', err); process.exit(1) })
  .finally(() => db.$disconnect())
