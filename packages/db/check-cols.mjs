import { PrismaClient } from '@prisma/client'
const p = new PrismaClient()
const r = await p.$queryRawUnsafe(`SELECT column_name FROM information_schema.columns WHERE table_schema='t_krishna_wholesale' AND table_name='invoice_sequences'`)
console.log(r)
await p.$disconnect()
