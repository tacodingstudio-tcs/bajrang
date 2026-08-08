import { PrismaClient } from '@prisma/client'

const BASE_URL = 'postgresql://billing_app:localdev123@localhost:5432/billing_db'

const publicDb = new PrismaClient({ datasources: { db: { url: BASE_URL } } })
const schemas = await publicDb.$queryRawUnsafe(
  `SELECT schema_name FROM information_schema.schemata WHERE schema_name LIKE 't_%' ORDER BY schema_name`
)
await publicDb.$disconnect()

function calcAmounts(qty, rate, gstRate) {
  const taxableAmt = +(qty * rate).toFixed(2)
  const gstAmt     = +(taxableAmt * gstRate / 100).toFixed(2)
  const cgst       = +(gstAmt / 2).toFixed(2)
  const sgst       = cgst
  const total      = +(taxableAmt + gstAmt).toFixed(2)
  return { taxableAmt, cgst, sgst, igst: 0, total }
}

for (const { schema_name } of schemas) {
  const db = new PrismaClient({ datasources: { db: { url: `${BASE_URL}?schema=${schema_name}` } } })

  // Skip if already has POs
  const existing = await db.purchaseOrder.count()
  if (existing > 0) {
    console.log(`  - ${schema_name} — already has ${existing} POs, skipping`)
    await db.$disconnect()
    continue
  }

  const branch    = await db.branch.findFirst({ select: { id: true } })
  const user      = await db.user.findFirst({ select: { id: true } })
  const suppliers = await db.supplier.findMany({ select: { id: true, name: true }, take: 3 })
  const products  = await db.product.findMany({
    select: { id: true, name: true, purchasePrice: true, unit: true, gstRate: true },
    where: { isActive: true },
    take: 8,
  })

  if (!branch || !user || products.length === 0) {
    console.log(`  - ${schema_name} — missing branch/user/products`)
    await db.$disconnect()
    continue
  }

  const supplierId = suppliers[0]?.id ?? null
  const supplier2  = suppliers[1]?.id ?? null

  const today    = new Date()
  const daysAgo  = (n) => new Date(Date.now() - n * 86400000)
  const daysAhead = (n) => new Date(Date.now() + n * 86400000)

  // Build 3 POs per tenant: 1 received, 1 sent/partial, 1 draft
  const poSets = [
    {
      poNo:         `PO-2025-001`,
      poDate:       daysAgo(20),
      expectedDate: daysAgo(10),
      status:       'received',
      supplierId,
      itemCount:    Math.min(3, products.length),
      qtyBase:      20,
      notes:        'Monthly restocking order',
    },
    {
      poNo:         `PO-2025-002`,
      poDate:       daysAgo(5),
      expectedDate: daysAhead(3),
      status:       'sent',
      supplierId:   supplier2 ?? supplierId,
      itemCount:    Math.min(2, products.length),
      qtyBase:      15,
      notes:        'Urgent reorder — low stock alert',
    },
    {
      poNo:         `PO-2025-003`,
      poDate:       today,
      expectedDate: daysAhead(7),
      status:       'draft',
      supplierId,
      itemCount:    Math.min(4, products.length),
      qtyBase:      30,
      notes:        null,
    },
  ]

  let poCount = 0
  for (const po of poSets) {
    const selectedProducts = products.slice(0, po.itemCount)
    const items = selectedProducts.map((p, i) => {
      const qty     = po.qtyBase - i * 3
      const rate    = Number(p.purchasePrice ?? 100)
      const gstRate = Number(p.gstRate ?? 0)
      const { taxableAmt, cgst, sgst, igst, total } = calcAmounts(qty, rate, gstRate)
      return {
        productId:   p.id,
        description: p.name,
        orderedQty:  qty,
        receivedQty: po.status === 'received' ? qty : po.status === 'partial' ? Math.floor(qty / 2) : 0,
        unit:        p.unit,
        rate,
        taxableAmt,
        gstRate,
        cgstAmt:     cgst,
        sgstAmt:     sgst,
        igstAmt:     igst,
        total,
        sortOrder:   i,
      }
    })

    const subtotal   = +items.reduce((s, i) => s + i.taxableAmt, 0).toFixed(2)
    const cgstTotal  = +items.reduce((s, i) => s + i.cgstAmt, 0).toFixed(2)
    const sgstTotal  = +items.reduce((s, i) => s + i.sgstAmt, 0).toFixed(2)
    const grandTotal = +items.reduce((s, i) => s + i.total, 0).toFixed(2)

    await db.purchaseOrder.create({
      data: {
        branchId:    branch.id,
        supplierId:  po.supplierId,
        poNo:        po.poNo,
        poDate:      po.poDate,
        expectedDate: po.expectedDate,
        status:      po.status,
        subtotal,
        taxableAmt:  subtotal,
        cgstTotal,
        sgstTotal,
        igstTotal:   0,
        grandTotal,
        paidAmt:     po.status === 'received' ? grandTotal : 0,
        notes:       po.notes,
        createdBy:   user.id,
        items:       { create: items },
      },
    })
    poCount++
  }

  console.log(`  ✓ ${schema_name} — ${poCount} purchase orders created`)
  await db.$disconnect()
}

console.log('Done.')
