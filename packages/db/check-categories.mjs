import { PrismaClient } from '@prisma/client'
const BASE_URL = 'postgresql://billing_app:localdev123@localhost:5432/billing_db'
const schema = 't_digismart_electronics'

const db = new PrismaClient({ datasources: { db: { url: `${BASE_URL}?schema=${schema}` } } })

const cats = await db.category.findMany({ select: { id: true, name: true } })
console.log('Categories:', cats.length)
cats.forEach(c => console.log(`  ${c.id} — ${c.name}`))

const products = await db.product.findMany({ select: { id: true, name: true, categoryId: true }, take: 5 })
console.log('\nProducts (first 5):')
products.forEach(p => console.log(`  ${p.name} — categoryId: ${p.categoryId}`))

const total = await db.product.count()
console.log('\nTotal products:', total)

await db.$disconnect()
