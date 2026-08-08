import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const B2B_SCHEMAS = [
  't_krishna_wholesale',
  't_apex_distributors',
  't_digismart_electronics',
  't_anand_textiles',
  't_shubhlaxmi_jewellers',
  't_shiv_auto_works',
  't_annapurna_catering',
  't_perfect_printers',
]

const ALL_B2B_TYPES = ['sale_invoice','purchase_invoice','quotation','proforma','sales_order','delivery_challan']

const fy = new Date().getMonth() >= 3
  ? String(new Date().getFullYear()).slice(-2)
  : String(new Date().getFullYear() - 1).slice(-2)

async function run() {
  for (const schema of B2B_SCHEMAS) {
    try {
      const branches = await prisma.$queryRawUnsafe(`SELECT id FROM "${schema}".branches LIMIT 1`)
      const branchId = branches[0]?.id
      if (!branchId) { console.log(`⚠ no branch: ${schema}`); continue }

      for (const txnType of ALL_B2B_TYPES) {
        await prisma.$executeRawUnsafe(
          `INSERT INTO "${schema}".invoice_sequences (branch_id, txn_type, fy, current_val)
           VALUES ('${branchId}','${txnType}','${fy}',0)
           ON CONFLICT (branch_id, txn_type, fy) DO NOTHING`
        )
      }
      console.log(`✓ ${schema}`)
    } catch (err) {
      console.error(`✗ ${schema}:`, err.message)
    }
  }
  console.log('B2B invoice_sequences seeded')
  await prisma.$disconnect()
}

run().catch(console.error)
