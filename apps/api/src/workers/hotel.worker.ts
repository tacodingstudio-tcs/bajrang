// apps/api/src/workers/hotel.worker.ts
//
// Runs daily at 8 AM IST. For every active hotel branch in every active tenant:
//   1. Sends a WhatsApp check-in-day reminder to guests with a 'reserved'
//      booking checking in today (once per booking, via reminderSent flag).
//   2. Auto-marks 'reserved' bookings as 'no_show' once their check-in date
//      has fully passed without the guest checking in.
//
// Hotel extension tables aren't in the Prisma schema — raw SQL against the
// tenant schema, same pattern as routes/hotel.ts.

import cron from 'node-cron'
import { db } from '@billing/db'           // public schema — tenants table only
import { getTenantDb } from '../lib/tenant-db.js'
import { whatsappQueue } from '../lib/queues.js'

function tbl(schemaName: string, table: string) {
  return `"${schemaName}"."${table}"`
}

function toE164(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  return digits.length === 10 ? `91${digits}` : digits
}

async function runHotelDailyJob() {
  console.log('[Hotel Worker] Starting daily hotel job...')

  const tenants = await db.tenant.findMany({
    where:  { isActive: true },
    select: { id: true, schemaName: true },
  })

  let remindersSent = 0
  let noShowsMarked = 0

  for (const tenant of tenants) {
    const tenantDb = getTenantDb(tenant.schemaName)

    let branches: Array<{ id: string; name: string; domainType: string | null }>
    try {
      branches = await tenantDb.branch.findMany({
        where:  { isActive: true },
        select: { id: true, name: true, domainType: true },
      })
    } catch (err) {
      console.error(`[Hotel Worker] Cannot read branches for tenant ${tenant.id}:`, (err as Error).message)
      continue
    }

    for (const branch of branches) {
      if (branch.domainType !== 'hotel') continue
      const s = tenant.schemaName

      try {
        // ── Check-in-day reminders ──────────────────────────────────────────
        const arrivingToday = await tenantDb.$queryRawUnsafe<any[]>(
          `SELECT bk.id, bk."guestName", bk."guestPhone", bk."folioNo", r."roomNo"
           FROM ${tbl(s,'hotel_bookings')} bk
           LEFT JOIN ${tbl(s,'hotel_rooms')} r ON r.id = bk."roomId"
           WHERE bk."branchId" = $1::uuid AND bk.status = 'reserved'
             AND DATE(bk."checkIn") = CURRENT_DATE
             AND bk."reminderSent" = false
             AND bk."guestPhone" IS NOT NULL`,
          branch.id
        )

        for (const bk of arrivingToday) {
          await whatsappQueue.add('hotel_message', {
            type:    'hotel_message',
            toPhone: toE164(bk.guestPhone),
            message: `Hi ${bk.guestName}, this is a reminder that you're checking in today at ${branch.name}! 🙏\n` +
              `Folio: ${bk.folioNo}${bk.roomNo ? `\nRoom: ${bk.roomNo}` : ''}\n\n` +
              `We look forward to welcoming you.`,
          })
          await tenantDb.$executeRawUnsafe(
            `UPDATE ${tbl(s,'hotel_bookings')} SET "reminderSent" = true WHERE id = $1::uuid`,
            bk.id
          )
          remindersSent++
        }

        // ── Auto no-show ─────────────────────────────────────────────────────
        // Reserved bookings whose check-in date has fully passed without the
        // guest arriving — free up the room record-keeping-wise. Doesn't
        // touch the room's own status (never occupied, so nothing to free).
        const noShowResult = await tenantDb.$executeRawUnsafe(
          `UPDATE ${tbl(s,'hotel_bookings')}
           SET status = 'no_show', "updatedAt" = NOW()
           WHERE "branchId" = $1::uuid AND status = 'reserved'
             AND DATE("checkIn") < CURRENT_DATE`,
          branch.id
        )
        noShowsMarked += Number(noShowResult ?? 0)

      } catch (err) {
        console.error(`[Hotel Worker] Branch ${branch.id} failed:`, (err as Error).message)
        // Continue to next branch — one failure shouldn't block the whole run
      }
    }
  }

  console.log(`[Hotel Worker] Done. Reminders sent: ${remindersSent}, no-shows marked: ${noShowsMarked}`)
}

// Schedule: every day at 08:00 IST (02:30 UTC)
cron.schedule('30 2 * * *', () => {
  runHotelDailyJob().catch((err) =>
    console.error('[Hotel Worker] Fatal error:', err)
  )
})

console.log('[Hotel Worker] Scheduled — runs daily at 08:00 IST (02:30 UTC)')

// Allow manual trigger for testing: tsx hotel.worker.ts --now
if (process.argv.includes('--now')) {
  runHotelDailyJob().then(() => process.exit(0))
}
