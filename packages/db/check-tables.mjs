import { PrismaClient } from '@prisma/client'
const db = new PrismaClient({ datasources: { db: { url: 'postgresql://billing_app:localdev123@localhost:5432/billing_db?schema=t_ramesh_kirana' } } })
const rows = await db.$queryRawUnsafe(`SELECT table_name FROM information_schema.tables WHERE table_schema = 't_ramesh_kirana' ORDER BY table_name`)
console.log('Tables in t_ramesh_kirana:')
rows.forEach(r => console.log(' ', r.table_name))
await db.$disconnect()
