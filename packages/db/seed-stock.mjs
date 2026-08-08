// Seeds stock_ledger entries for all tenant schemas so Stock Levels page shows real data.
// Strategy: one "opening_stock" purchase entry per product with a realistic qty,
// then a few "sale" outflow entries to show varied stock levels (some low, some healthy).
import { PrismaClient } from '@prisma/client'

const BASE_URL = 'postgresql://billing_app:localdev123@localhost:5432/billing_db'

// Domain-aware stock quantities [openingQty, salesQty] — sales < opening to keep positive stock
// Some products intentionally go low to trigger low-stock alerts
const DOMAIN_STOCK = {
  kirana:        { opening: [50, 80, 120, 200, 30, 150], sales: [35, 72, 40, 60, 28, 90] },
  restaurant:    { opening: [20, 15, 30, 10, 25, 8,  18, 12], sales: [18, 12, 25, 8, 20, 7, 15, 10] },
  pharmacy:      { opening: [200, 150, 100, 300, 80, 60, 250, 90], sales: [180, 140, 85, 120, 75, 55, 100, 80] },
  electronics:   { opening: [15, 25, 10, 30, 20, 8],  sales: [12, 8, 7, 5, 15, 6] },
  salon:         { opening: [20, 15, 30, 10],          sales: [15, 12, 20, 8] },
  jewellery:     { opening: [10, 8, 15, 20, 5],        sales: [8, 6, 10, 5, 4] },
  automobile:    { opening: [25, 40, 15, 30],          sales: [20, 35, 12, 25] },
  hotel:         { opening: [50, 30, 100, 20],         sales: [45, 25, 80, 18] },
  petrol_pump:   { opening: [5000, 8000, 200],         sales: [4500, 7200, 150] },
  coaching:      { opening: [100, 50, 200, 30],        sales: [80, 40, 150, 25] },
  sweet_shop:    { opening: [30, 20, 15, 25],          sales: [28, 18, 12, 20] },
  catering:      { opening: [20, 15, 10, 25],          sales: [18, 12, 8, 20] },
  tiffin:        { opening: [50, 40, 30, 60],          sales: [45, 35, 25, 50] },
  gym:           { opening: [30, 20, 15, 10, 25, 8],   sales: [25, 15, 12, 8, 20, 6] },
  diagnostic:    { opening: [100, 80, 50, 200, 60, 40, 150], sales: [90, 70, 40, 80, 55, 35, 60] },
  repair:        { opening: [40, 30, 20, 50, 15],      sales: [35, 25, 18, 45, 12] },
  wholesale:     { opening: [500, 300, 800, 200],      sales: [400, 250, 600, 150] },
  clinic:        { opening: [100, 60, 80, 50],         sales: [85, 50, 70, 40] },
  textile:       { opening: [200, 150, 300, 100],      sales: [160, 120, 200, 80] },
  default:       { opening: [50, 30, 80, 20, 40, 60], sales: [35, 20, 50, 15, 30, 45] },
}

const SCHEMA_DOMAIN = {
  t_ramesh_kirana:       'kirana',
  t_shree_restaurant:    'restaurant',
  t_lifeline_pharmacy:   'pharmacy',
  t_digismart_electronics: 'electronics',
  t_glamour_salon:       'salon',
  t_shubhlaxmi_jewellers:'jewellery',
  t_shiv_auto_works:     'automobile',
  t_hotel_surya_palace:  'hotel',
  t_om_petroleum:        'petrol_pump',
  t_success_coaching:    'coaching',
  t_madhuram_sweets:     'sweet_shop',
  t_annapurna_catering:  'catering',
  t_ghar_jaisa_tiffin:   'tiffin',
  t_fitzone_gym:         'gym',
  t_apex_diagnostics:    'diagnostic',
  t_techfix_repair:      'repair',
  t_krishna_wholesale:   'wholesale',
  t_sunrise_clinic:      'clinic',
  t_anand_textiles:      'textile',
}

const publicDb = new PrismaClient({ datasources: { db: { url: BASE_URL } } })
const schemas = await publicDb.$queryRawUnsafe(
  `SELECT schema_name FROM information_schema.schemata WHERE schema_name LIKE 't_%' ORDER BY schema_name`
)
await publicDb.$disconnect()

for (const { schema_name } of schemas) {
  const db = new PrismaClient({ datasources: { db: { url: `${BASE_URL}?schema=${schema_name}` } } })

  // Check if stock_ledger already has data
  const existing = await db.$queryRawUnsafe(`SELECT COUNT(*)::int AS cnt FROM stock_ledger`)
  if (existing[0].cnt > 0) {
    console.log(`  - ${schema_name} — already has ${existing[0].cnt} stock entries, skipping`)
    await db.$disconnect()
    continue
  }

  const branch = await db.branch.findFirst({ select: { id: true } })
  const user   = await db.user.findFirst({ select: { id: true } })
  const products = await db.product.findMany({
    where: { trackStock: true },
    select: { id: true, name: true, purchasePrice: true },
  })

  if (!branch || !user || products.length === 0) {
    console.log(`  - ${schema_name} — no branch/user/products found`)
    await db.$disconnect()
    continue
  }

  const domain = SCHEMA_DOMAIN[schema_name] ?? 'default'
  const { opening, sales } = DOMAIN_STOCK[domain] ?? DOMAIN_STOCK.default

  let entries = 0
  for (let i = 0; i < products.length; i++) {
    const product = products[i]
    const openQty  = opening[i % opening.length]
    const saleQty  = Math.min(sales[i % sales.length], openQty - 1) // always leave at least 1
    const rate     = Number(product.purchasePrice ?? 100)

    // Opening stock entry (purchase/GRN)
    await db.$executeRawUnsafe(`
      INSERT INTO stock_ledger (id, "branchId", "productId", "txnType", qty, rate, "refType", notes, "createdBy", "createdAt")
      VALUES (gen_random_uuid(), $1::uuid, $2::uuid, 'purchase', $3, $4, 'grn', 'Opening stock', $5::uuid, NOW() - INTERVAL '30 days')
    `, branch.id, product.id, openQty, rate, user.id)
    entries++

    // Sales outflow
    await db.$executeRawUnsafe(`
      INSERT INTO stock_ledger (id, "branchId", "productId", "txnType", qty, rate, "refType", notes, "createdBy", "createdAt")
      VALUES (gen_random_uuid(), $1::uuid, $2::uuid, 'sale', $3, $4, 'invoice', 'Sales (last 30 days)', $5::uuid, NOW() - INTERVAL '1 day')
    `, branch.id, product.id, -saleQty, rate, user.id)
    entries++
  }

  console.log(`  ✓ ${schema_name} (${domain}) — ${entries} stock entries for ${products.length} products`)
  await db.$disconnect()
}

console.log('Done.')
