// Sync invoice_sequences for the main test tenant using a single connection
import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const { PrismaClient } = require('./node_modules/.prisma/client/index.js')

const db = new PrismaClient({ datasources: { db: { url: 'postgresql://billing_app:localdev123@localhost:5432/billing_db' } } })

// For each main seeded schema, sync ALL txn_type sequences in one query
const schemas = [
  't_ramesh_kirana', 't_shree_restaurant', 't_lifeline_pharmacy', 't_digismart_electronics',
  't_glamour_salon', 't_krishna_wholesale', 't_madhuram_sweets', 't_sunrise_clinic',
  't_vision_plus_optical', 't_shubhlaxmi_jewellers', 't_shiv_auto_works', 't_anand_textiles',
  't_apex_distributors', 't_hotel_surya_palace', 't_annapurna_catering', 't_perfect_printers',
  't_success_coaching', 't_sparkle_laundry',
]

for (const schema of schemas) {
  try {
    // Single query: for each (txnType, fy) in invoices, update corresponding sequence
    const n = await db.$executeRawUnsafe(`
      UPDATE "${schema}".invoice_sequences seq
      SET current_val = GREATEST(seq.current_val, inv_max.max_seq)
      FROM (
        SELECT "txnType" as txn_type,
               SPLIT_PART(number, '-', array_length(regexp_split_to_array(number, '-'), 1) - 1) as fy,
               MAX(CAST(SPLIT_PART(number, '-', array_length(regexp_split_to_array(number, '-'), 1)) AS INTEGER)) as max_seq
        FROM "${schema}".invoices
        WHERE number ~ '^[A-Z]+-[0-9]{2}-[0-9]+$'
        GROUP BY "txnType", fy
      ) inv_max
      WHERE seq.txn_type = inv_max.txn_type AND seq.fy = inv_max.fy
    `)
    if (n > 0) console.log(`  ${schema}: updated ${n} sequences`)
  } catch(e) {
    console.log(`  SKIP ${schema}: ${e.message?.slice(0,100)}`)
  }
}

console.log('Done.')
await db.$disconnect()
