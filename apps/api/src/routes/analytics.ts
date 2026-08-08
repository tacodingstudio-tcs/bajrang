// apps/api/src/routes/analytics.ts
//
// Domain-aware analytics endpoints.
//
//  GET /api/analytics/dashboard?period=7d|30d|90d&compareWith=prev_period|prev_year
//  GET /api/analytics/revenue-trend?period=7d|30d|90d&groupBy=day|week|month
//  GET /api/analytics/gst-summary?month=YYYY-MM
//  GET /api/analytics/payment-methods?period=7d|30d|90d
//  GET /api/analytics/top-customers?period=7d|30d|90d&limit=10
//  GET /api/analytics/margin-report?period=7d|30d|90d

import type { FastifyPluginAsync } from 'fastify'
import { Prisma } from '@prisma/client'
import { z } from 'zod'
import { cacheKey, getOrSet } from '../lib/cache.js'

// ── Types ──────────────────────────────────────────────────────────────────────

interface KPI {
  key:        string
  label:      string
  value:      number | string
  unit?:      string           // '₹' | 'count' | '%' | 'L' | 'days'
  prev?:      number           // value in comparison period
  delta?:     number           // % change
  trend?:     'up' | 'down' | 'neutral'
  highlight?: 'good' | 'warn' | 'danger'
}

interface ChartPoint  { x: string; y: number }
interface ChartSeries { label: string; data: ChartPoint[] }

interface Chart {
  key:    string
  title:  string
  type:   'line' | 'bar' | 'donut' | 'stacked_bar'
  unit?:  string
  series: ChartSeries[]
}

interface DashboardResponse {
  period:      string
  compareWith: string | null
  from:        string
  to:          string
  domain:      string
  kpis:        KPI[]
  charts:      Chart[]
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const periodDays = (p: string) => p === '30d' ? 30 : p === '90d' ? 90 : 7
const iso        = (d: Date)   => {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function dateRange(days: number, anchor = new Date()): { from: Date; to: Date } {
  const to   = new Date(anchor)
  const from = new Date(anchor)
  from.setDate(from.getDate() - days)
  return { from, to }
}

function pctDelta(cur: number, prev: number): number | undefined {
  return prev === 0 ? undefined : Math.round(((cur - prev) / prev) * 100)
}

function trend(delta: number | undefined, higherIsBetter = true): 'up' | 'down' | 'neutral' {
  if (delta === undefined) return 'neutral'
  if (delta === 0) return 'neutral'
  return (delta > 0) === higherIsBetter ? 'up' : 'down'
}

// ── Shared SQL fragments (parameterised — no raw string injection) ─────────────

// Returns { total, count, collected, outstanding } for a date range + branchId
async function revenueStats(
  db: any,
  branchId: string,
  from: string,
  to: string,
): Promise<{ total: number; count: number; collected: number; outstanding: number }> {
  const rows = await db.$queryRaw<[{ total: number; count: number; collected: number; outstanding: number }]>`
    SELECT
      COALESCE(SUM("grandTotal"),0)::float             AS total,
      COUNT(*)::int                                     AS count,
      COALESCE(SUM("paidAmt"),0)::float                AS collected,
      COALESCE(SUM("grandTotal" - "paidAmt"),0)::float AS outstanding
    FROM invoices
    WHERE "branchId" = ${branchId}::uuid
      AND "txnType"  = 'sale_invoice'
      AND "date"    >= ${from}::date
      AND "date"    <= ${to}::date
  `
  return rows[0]!
}

// Daily revenue bars — used by every domain
async function dailyRevenueSeries(
  db: any,
  branchId: string,
  from: string,
  to: string,
): Promise<Array<{ day: string; revenue: number; invoices: number }>> {
  return db.$queryRaw`
    SELECT
      DATE("date")::text                   AS day,
      COALESCE(SUM("grandTotal"),0)::float AS revenue,
      COUNT(*)::int                         AS invoices
    FROM invoices
    WHERE "branchId" = ${branchId}::uuid
      AND "txnType"  = 'sale_invoice'
      AND "date"    >= ${from}::date
      AND "date"    <= ${to}::date
    GROUP BY DATE("date")
    ORDER BY day ASC
  `
}

// Payment method breakdown from the payments table (source of truth for method)
async function paymentMethodBreakdown(
  db: any,
  branchId: string,
  from: string,
  to: string,
): Promise<Array<{ method: string; amount: number; count: number }>> {
  return db.$queryRaw`
    SELECT
      method,
      COALESCE(SUM(amount),0)::float AS amount,
      COUNT(*)::int                   AS count
    FROM payments
    WHERE "branchId" = ${branchId}::uuid
      AND "paymentDate" >= ${from}::date
      AND "paymentDate" <= ${to}::date
    GROUP BY method
    ORDER BY amount DESC
  `
}

// Top products/services by revenue
async function topProductsSeries(
  db: any,
  branchId: string,
  from: string,
  to: string,
  limit = 8,
): Promise<Array<{ name: string; qty: number; revenue: number }>> {
  return db.$queryRaw`
    SELECT p.name,
           SUM(ii.qty)::float   AS qty,
           SUM(ii.total)::float AS revenue
    FROM invoice_items ii
    JOIN products p ON p.id = ii."productId"
    JOIN invoices  i ON i.id = ii."invoiceId"
    WHERE i."branchId" = ${branchId}::uuid
      AND i."txnType"  = 'sale_invoice'
      AND i."date"    >= ${from}::date
      AND i."date"    <= ${to}::date
    GROUP BY p.name
    ORDER BY revenue DESC
    LIMIT ${limit}
  `
}

// Gross margin per product (requires purchasePrice on product)
async function grossMarginData(
  db: any,
  branchId: string,
  from: string,
  to: string,
): Promise<{ totalRevenue: number; totalCOGS: number; marginPct: number; rows: Array<{ name: string; revenue: number; cogs: number; margin_pct: number }> }> {
  const rows = await db.$queryRaw<Array<{ name: string; revenue: number; cogs: number; margin_pct: number }>>`
    SELECT
      p.name,
      COALESCE(SUM(ii.total),0)::float                                          AS revenue,
      COALESCE(SUM(ii.qty * COALESCE(p."purchasePrice",0)),0)::float           AS cogs,
      CASE
        WHEN SUM(ii.total) > 0
        THEN ROUND(((SUM(ii.total) - SUM(ii.qty * COALESCE(p."purchasePrice",0))) / SUM(ii.total) * 100)::numeric, 1)::float
        ELSE 0
      END AS margin_pct
    FROM invoice_items ii
    JOIN products p ON p.id = ii."productId"
    JOIN invoices  i ON i.id = ii."invoiceId"
    WHERE i."branchId" = ${branchId}::uuid
      AND i."txnType"  = 'sale_invoice'
      AND i."date"    >= ${from}::date
      AND i."date"    <= ${to}::date
      AND p."purchasePrice" IS NOT NULL
      AND p."purchasePrice" > 0
    GROUP BY p.name
    ORDER BY revenue DESC
    LIMIT 10
  `
  const totalRevenue = rows.reduce((s: number, r: { revenue: number; cogs: number }) => s + r.revenue, 0)
  const totalCOGS    = rows.reduce((s: number, r: { revenue: number; cogs: number }) => s + r.cogs, 0)
  const marginPct    = totalRevenue > 0 ? Math.round(((totalRevenue - totalCOGS) / totalRevenue) * 100) : 0
  return { totalRevenue, totalCOGS, marginPct, rows }
}

// ── Route plugin ──────────────────────────────────────────────────────────────

export const analyticsRoutes: FastifyPluginAsync = async (app) => {

  // ── GET /api/analytics/dashboard ─────────────────────────────────────────────
  app.get('/dashboard', async (req, reply) => {
    const q = z.object({
      period:      z.enum(['7d', '30d', '90d']).default('7d'),
      compareWith: z.enum(['prev_period', 'prev_year']).optional(),
    }).parse(req.query)

    const key = cacheKey(req.schemaName, req.branchId, 'dash', q.period, q.compareWith ?? 'none')
    const result = await getOrSet(key, 300, async () => {
    const db        = req.db
    const branchId  = req.branchId
    const days      = periodDays(q.period)
    const now       = new Date()
    const { from }  = dateRange(days, now)

    const fromStr = iso(from)
    const toStr   = iso(now)

    // Comparison range
    let prevFromStr: string | null = null
    let prevToStr:   string | null = null
    if (q.compareWith === 'prev_period') {
      const pTo   = new Date(from); pTo.setDate(pTo.getDate() - 1)
      const pFrom = new Date(pTo);  pFrom.setDate(pFrom.getDate() - days)
      prevFromStr = iso(pFrom)
      prevToStr   = iso(pTo)
    } else if (q.compareWith === 'prev_year') {
      const pFrom = new Date(from); pFrom.setFullYear(pFrom.getFullYear() - 1)
      const pTo   = new Date(now);  pTo.setFullYear(pTo.getFullYear() - 1)
      prevFromStr = iso(pFrom)
      prevToStr   = iso(pTo)
    }

    // Always fetch branch domain
    const branch = await db.branch.findUnique({
      where: { id: branchId }, select: { domainType: true },
    })
    if (!branch) return reply.status(404).send({ error: 'Branch not found' })
    const domainType = branch.domainType

    // Parallel base fetches
    const [rev, prevRev, daily, payMethods, margin] = await Promise.all([
      revenueStats(db, branchId, fromStr, toStr),
      prevFromStr && prevToStr
        ? revenueStats(db, branchId, prevFromStr, prevToStr)
        : Promise.resolve(null),
      dailyRevenueSeries(db, branchId, fromStr, toStr),
      paymentMethodBreakdown(db, branchId, fromStr, toStr),
      grossMarginData(db, branchId, fromStr, toStr),
    ])

    const revDelta = prevRev ? pctDelta(rev.total, prevRev.total) : undefined

    // Universal charts present on every domain
    const universalCharts: Chart[] = [
      {
        key: 'daily_revenue', title: 'Daily Revenue', type: 'bar', unit: '₹',
        series: [
          { label: 'Revenue',  data: daily.map(r => ({ x: r.day, y: r.revenue  })) },
          { label: 'Invoices', data: daily.map(r => ({ x: r.day, y: r.invoices })) },
        ],
      },
      ...(payMethods.length > 0 ? [{
        key: 'payment_methods', title: 'Collections by Payment Mode', type: 'donut' as const, unit: '₹',
        series: payMethods.map(r => ({
          label: r.method,
          data:  [{ x: r.method, y: r.amount }],
        })),
      }] : []),
      ...(margin.rows.length > 0 ? [{
        key: 'margin', title: 'Gross Margin by Product', type: 'bar' as const, unit: '%',
        series: [{
          label: 'Margin %',
          data: margin.rows.map(r => ({ x: r.name, y: r.margin_pct })),
        }],
      }] : []),
    ]

    // Universal KPI always present
    const universalMarginKpi: KPI | null = margin.marginPct > 0 ? {
      key: 'gross_margin', label: 'Gross Margin', value: margin.marginPct, unit: '%',
      highlight: margin.marginPct >= 30 ? 'good' : margin.marginPct >= 15 ? 'warn' : 'danger',
    } : null

    let domainKpis:   KPI[]   = []
    let domainCharts: Chart[] = []

    // ── PETROL PUMP ───────────────────────────────────────────────────────────
    if (domainType === 'petrol_pump') {
      const [fuelBreakdown, shiftBreakdown, nozzleTotalsRaw, prevFuel] = await Promise.all([
        db.$queryRaw<Array<{ fuel_type: string; litres: number; amount: number }>>`
          SELECT p."domainAttrs"->>'fuel_type' AS fuel_type,
                 COALESCE(SUM(ii.qty),0)::float   AS litres,
                 COALESCE(SUM(ii.total),0)::float AS amount
          FROM invoice_items ii
          JOIN products p ON p.id = ii."productId"
          JOIN invoices  i ON i.id = ii."invoiceId"
          WHERE i."branchId" = ${branchId}::uuid
            AND i."date" >= ${fromStr}::date AND i."date" <= ${toStr}::date
          GROUP BY p."domainAttrs"->>'fuel_type'
        `,
        db.$queryRaw<Array<{ shift: string; amount: number }>>`
          SELECT i."domainData"->>'shift'           AS shift,
                 COALESCE(SUM(i."grandTotal"),0)::float AS amount
          FROM invoices i
          WHERE i."branchId" = ${branchId}::uuid AND i."txnType" = 'sale_invoice'
            AND i."date" >= ${fromStr}::date AND i."date" <= ${toStr}::date
          GROUP BY i."domainData"->>'shift'
        `,
        db.$queryRaw<Array<{ nozzle_no: string; sold_litres: number; sale_amount: number }>>`
          SELECT "nozzleNo" AS nozzle_no,
                 COALESCE(SUM("soldLitres"),0)::float  AS sold_litres,
                 COALESCE(SUM("saleAmount"),0)::float  AS sale_amount
          FROM nozzle_readings
          WHERE "branchId" = ${branchId}::uuid
            AND "readingDate" >= ${fromStr}::date AND "readingDate" <= ${toStr}::date
          GROUP BY "nozzleNo" ORDER BY nozzle_no
        `.catch(() => [] as Array<{ nozzle_no: string; sold_litres: number; sale_amount: number }>),
        prevFromStr && prevToStr
          ? db.$queryRaw<[{ litres: number }]>`
              SELECT COALESCE(SUM(ii.qty),0)::float AS litres
              FROM invoice_items ii
              JOIN products p ON p.id = ii."productId"
              JOIN invoices  i ON i.id = ii."invoiceId"
              WHERE i."branchId" = ${branchId}::uuid
                AND i."date" >= ${prevFromStr}::date AND i."date" <= ${prevToStr}::date
            `
          : Promise.resolve(null),
      ])

      const nozzleTotals = nozzleTotalsRaw ?? []
      const totalLitres = fuelBreakdown.reduce((s, r) => s + r.litres, 0)
      const prevLitres  = prevFuel?.[0]?.litres ?? undefined
      const litresDelta = prevLitres !== undefined ? pctDelta(totalLitres, prevLitres) : undefined

      domainKpis = [
        { key: 'revenue',     label: 'Total Revenue',    value: rev.total,       unit: '₹',    delta: revDelta,   trend: trend(revDelta), prev: prevRev?.total },
        { key: 'litres_sold', label: 'Litres Sold',      value: totalLitres,     unit: 'L',    delta: litresDelta, trend: trend(litresDelta), prev: prevLitres },
        { key: 'transactions',label: 'Transactions',     value: rev.count,       unit: 'count' },
        { key: 'outstanding', label: 'Fleet Outstanding', value: rev.outstanding, unit: '₹',   highlight: rev.outstanding > 0 ? 'warn' : 'good' },
      ]
      domainCharts = [
        { key: 'fuel_revenue', title: 'Revenue by Fuel Type', type: 'donut', unit: '₹',
          series: fuelBreakdown.map(r => ({ label: r.fuel_type ?? 'unknown', data: [{ x: r.fuel_type ?? 'unknown', y: r.amount }] })) },
        { key: 'fuel_volume',  title: 'Volume by Fuel (Litres)', type: 'donut', unit: 'L',
          series: fuelBreakdown.map(r => ({ label: r.fuel_type ?? 'unknown', data: [{ x: r.fuel_type ?? 'unknown', y: r.litres }] })) },
        { key: 'shift_revenue',title: 'Revenue by Shift', type: 'donut', unit: '₹',
          series: shiftBreakdown.map(r => ({ label: r.shift ?? 'unknown', data: [{ x: r.shift ?? 'unknown', y: r.amount }] })) },
        { key: 'nozzle_volume',title: 'Nozzle-wise Volume', type: 'bar', unit: 'L',
          series: [{ label: 'Litres Sold', data: nozzleTotals.map(r => ({ x: `Nozzle ${r.nozzle_no}`, y: r.sold_litres })) }] },
      ]
    }

    // ── RESTAURANT ────────────────────────────────────────────────────────────
    else if (domainType === 'restaurant') {
      const orderTypes = await db.$queryRaw<Array<{ order_type: string; revenue: number; count: number }>>`
        SELECT i."domainData"->>'order_type'          AS order_type,
               COALESCE(SUM(i."grandTotal"),0)::float AS revenue,
               COUNT(*)::int                          AS count
        FROM invoices i
        WHERE i."branchId" = ${branchId}::uuid AND i."txnType" = 'sale_invoice'
          AND i."date" >= ${fromStr}::date AND i."date" <= ${toStr}::date
        GROUP BY i."domainData"->>'order_type'
      `
      const topItems = await topProductsSeries(db, branchId, fromStr, toStr)
      const avgBill  = rev.count > 0 ? Math.round(rev.total / rev.count) : 0
      const prevAvg  = prevRev && prevRev.count > 0 ? Math.round(prevRev.total / prevRev.count) : undefined

      domainKpis = [
        { key: 'revenue',  label: 'Revenue',       value: rev.total,  unit: '₹',    delta: revDelta,                   trend: trend(revDelta),                   prev: prevRev?.total },
        { key: 'orders',   label: 'Orders',         value: rev.count,  unit: 'count', delta: pctDelta(rev.count, prevRev?.count ?? 0), trend: trend(pctDelta(rev.count, prevRev?.count ?? 0)) },
        { key: 'avg_bill', label: 'Avg Bill Value', value: avgBill,    unit: '₹',    delta: prevAvg ? pctDelta(avgBill, prevAvg) : undefined, trend: trend(prevAvg ? pctDelta(avgBill, prevAvg) : undefined) },
        { key: 'outstanding', label: 'Unpaid / Tab', value: rev.outstanding, unit: '₹', highlight: rev.outstanding > 5000 ? 'warn' : 'good' },
      ]
      domainCharts = [
        { key: 'order_type', title: 'Orders by Channel', type: 'donut', unit: '₹',
          series: orderTypes.map(r => ({ label: r.order_type ?? 'unknown', data: [{ x: r.order_type ?? 'unknown', y: r.revenue }] })) },
        { key: 'top_items', title: 'Top Menu Items', type: 'bar', unit: '₹',
          series: [{ label: 'Revenue', data: topItems.map(p => ({ x: p.name, y: p.revenue })) }] },
      ]
    }

    // ── PHARMACY ──────────────────────────────────────────────────────────────
    else if (domainType === 'pharmacy') {
      const [scheduleBreakdown, expiryRisk] = await Promise.all([
        db.$queryRaw<Array<{ schedule: string; revenue: number }>>`
          SELECT p."domainAttrs"->>'schedule' AS schedule,
                 COALESCE(SUM(ii.total),0)::float AS revenue
          FROM invoice_items ii
          JOIN products p ON p.id = ii."productId"
          JOIN invoices  i ON i.id = ii."invoiceId"
          WHERE i."branchId" = ${branchId}::uuid
            AND i."date" >= ${fromStr}::date AND i."date" <= ${toStr}::date
          GROUP BY p."domainAttrs"->>'schedule'
        `,
        db.$queryRaw<[{ count: number; value: number }]>`
          SELECT COUNT(*)::int AS count,
                 COALESCE(SUM(b."qtyRemaining" * b."purchaseRate"),0)::float AS value
          FROM batches b JOIN products p ON p.id = b."productId"
          WHERE p."branchId" = ${branchId}::uuid
            AND b."expDate" IS NOT NULL
            AND b."expDate" <= (CURRENT_DATE + INTERVAL '30 days')
            AND b."qtyRemaining" > 0
        `,
      ])
      const topMeds = await topProductsSeries(db, branchId, fromStr, toStr)
      const expRisk = expiryRisk[0]!

      domainKpis = [
        { key: 'revenue',     label: 'Revenue',                value: rev.total,      unit: '₹', delta: revDelta, trend: trend(revDelta), prev: prevRev?.total },
        { key: 'bills',       label: 'Bills',                  value: rev.count,      unit: 'count' },
        { key: 'outstanding', label: 'Outstanding Dues',       value: rev.outstanding, unit: '₹', highlight: rev.outstanding > 0 ? 'warn' : 'good' },
        { key: 'expiry_risk', label: 'Expiring Stock (30 days)', value: expRisk.value, unit: '₹', highlight: expRisk.count > 0 ? 'danger' : 'good' },
        ...(universalMarginKpi ? [universalMarginKpi] : []),
      ]
      domainCharts = [
        { key: 'schedule_mix', title: 'Revenue by Drug Schedule', type: 'donut', unit: '₹',
          series: scheduleBreakdown.map(r => ({ label: r.schedule ?? 'OTC', data: [{ x: r.schedule ?? 'OTC', y: r.revenue }] })) },
        { key: 'top_medicines', title: 'Top Medicines', type: 'bar', unit: '₹',
          series: [{ label: 'Revenue', data: topMeds.map(p => ({ x: p.name, y: p.revenue })) }] },
      ]
    }

    // ── GYM / FITNESS ─────────────────────────────────────────────────────────
    else if (domainType === 'gym') {
      const [memberStats, planBreakdown, renewalsDue, prevMemberStats] = await Promise.all([
        db.$queryRaw<[{ active: number; expiring_soon: number; new_this_period: number; lapsed: number }]>`
          SELECT
            COUNT(*) FILTER (WHERE status = 'active')::int                                    AS active,
            COUNT(*) FILTER (WHERE status = 'active' AND "endDate" <= CURRENT_DATE + 15)::int AS expiring_soon,
            COUNT(*) FILTER (WHERE "createdAt" >= ${fromStr}::timestamp)::int                 AS new_this_period,
            COUNT(*) FILTER (WHERE status = 'expired')::int                                   AS lapsed
          FROM memberships WHERE "branchId" = ${branchId}::uuid
        `,
        db.$queryRaw<Array<{ plan_name: string; count: number; revenue: number }>>`
          SELECT m."planName" AS plan_name, COUNT(*)::int AS count,
                 COALESCE(SUM(m."feeAmount"),0)::float AS revenue
          FROM memberships m
          WHERE m."branchId" = ${branchId}::uuid AND m."createdAt" >= ${fromStr}::timestamp
          GROUP BY m."planName" ORDER BY revenue DESC
        `,
        db.$queryRaw<[{ count: number }]>`
          SELECT COUNT(*)::int AS count FROM memberships
          WHERE "branchId" = ${branchId}::uuid AND status = 'active'
            AND "endDate" BETWEEN CURRENT_DATE AND CURRENT_DATE + 15
        `,
        prevFromStr && prevToStr
          ? db.$queryRaw<[{ active: number }]>`
              SELECT COUNT(*) FILTER (WHERE status = 'active')::int AS active
              FROM memberships WHERE "branchId" = ${branchId}::uuid
                AND "createdAt" < ${prevToStr}::timestamp
            `
          : Promise.resolve(null),
      ])

      const ms          = memberStats[0]!
      const prevActive  = prevMemberStats?.[0]?.active
      const activeDelta = prevActive !== undefined ? pctDelta(ms.active, prevActive) : undefined

      domainKpis = [
        { key: 'active_members',  label: 'Active Members',      value: ms.active,              unit: 'count', delta: activeDelta, trend: trend(activeDelta), prev: prevActive },
        { key: 'new_members',     label: 'New Joins',            value: ms.new_this_period,     unit: 'count' },
        { key: 'lapsed_members',  label: 'Lapsed Members',      value: ms.lapsed,              unit: 'count', highlight: ms.lapsed > 5 ? 'warn' : 'good' },
        { key: 'revenue',         label: 'Fee Collected',        value: rev.total,              unit: '₹',    delta: revDelta, trend: trend(revDelta), prev: prevRev?.total },
        { key: 'renewals_due',    label: 'Renewals Due (15d)',   value: renewalsDue[0]!.count,  unit: 'count', highlight: renewalsDue[0]!.count > 0 ? 'warn' : 'good' },
      ]
      domainCharts = [
        { key: 'plan_breakdown', title: 'Members by Plan', type: 'donut', unit: 'count',
          series: planBreakdown.map(r => ({ label: r.plan_name, data: [{ x: r.plan_name, y: r.count }] })) },
        { key: 'plan_revenue', title: 'Revenue by Plan', type: 'bar', unit: '₹',
          series: [{ label: 'Revenue', data: planBreakdown.map(r => ({ x: r.plan_name, y: r.revenue })) }] },
      ]
    }

    // ── TIFFIN ────────────────────────────────────────────────────────────────
    else if (domainType === 'tiffin') {
      const [subStats, deliveryStats, routeBreakdown, dailyDeliveries] = await Promise.all([
        db.$queryRaw<[{ active: number; paused: number; cancelled: number; new_this_period: number }]>`
          SELECT COUNT(*) FILTER (WHERE status = 'active')::int          AS active,
                 COUNT(*) FILTER (WHERE status = 'paused')::int          AS paused,
                 COUNT(*) FILTER (WHERE status = 'cancelled')::int       AS cancelled,
                 COUNT(*) FILTER (WHERE "createdAt" >= ${fromStr}::timestamp)::int AS new_this_period
          FROM subscriptions WHERE "branchId" = ${branchId}::uuid
        `,
        db.$queryRaw<[{ delivered: number; skipped: number }]>`
          SELECT COUNT(*) FILTER (WHERE status = 'delivered')::int AS delivered,
                 COUNT(*) FILTER (WHERE status = 'skipped')::int   AS skipped
          FROM delivery_logs dl
          JOIN subscriptions s ON s.id = dl."subscriptionId"
          WHERE s."branchId" = ${branchId}::uuid
            AND dl."deliveryDate" >= ${fromStr}::date AND dl."deliveryDate" <= ${toStr}::date
        `,
        db.$queryRaw<Array<{ route_area: string; count: number }>>`
          SELECT "routeArea" AS route_area, COUNT(*)::int AS count
          FROM subscriptions
          WHERE "branchId" = ${branchId}::uuid AND status = 'active'
          GROUP BY "routeArea" ORDER BY count DESC
        `,
        db.$queryRaw<Array<{ day: string; delivered: number; skipped: number }>>`
          SELECT dl."deliveryDate"::text AS day,
                 COUNT(*) FILTER (WHERE status = 'delivered')::int AS delivered,
                 COUNT(*) FILTER (WHERE status = 'skipped')::int   AS skipped
          FROM delivery_logs dl
          JOIN subscriptions s ON s.id = dl."subscriptionId"
          WHERE s."branchId" = ${branchId}::uuid
            AND dl."deliveryDate" >= ${fromStr}::date AND dl."deliveryDate" <= ${toStr}::date
          GROUP BY dl."deliveryDate" ORDER BY day ASC
        `,
      ])

      const ss = subStats[0]!; const ds = deliveryStats[0]!
      const deliveryRate = (ds.delivered + ds.skipped) > 0
        ? Math.round(ds.delivered / (ds.delivered + ds.skipped) * 100) : 100

      domainKpis = [
        { key: 'active_subs',   label: 'Active Subscriptions', value: ss.active,       unit: 'count' },
        { key: 'paused',        label: 'Paused',               value: ss.paused,       unit: 'count' },
        { key: 'revenue',       label: 'Revenue Collected',    value: rev.total,        unit: '₹', delta: revDelta, trend: trend(revDelta), prev: prevRev?.total },
        { key: 'delivered',     label: 'Deliveries Done',      value: ds.delivered,     unit: 'count' },
        { key: 'delivery_rate', label: 'Delivery Rate',        value: deliveryRate,     unit: '%', highlight: deliveryRate >= 95 ? 'good' : deliveryRate >= 85 ? 'warn' : 'danger' },
      ]
      domainCharts = [
        { key: 'sub_status', title: 'Subscription Status', type: 'donut', unit: 'count',
          series: [
            { label: 'Active',    data: [{ x: 'Active',    y: ss.active }] },
            { label: 'Paused',    data: [{ x: 'Paused',    y: ss.paused }] },
            { label: 'Cancelled', data: [{ x: 'Cancelled', y: ss.cancelled }] },
          ] },
        { key: 'delivery_trend', title: 'Daily Deliveries vs Skips', type: 'stacked_bar', unit: 'count',
          series: [
            { label: 'Delivered', data: dailyDeliveries.map(r => ({ x: r.day, y: r.delivered })) },
            { label: 'Skipped',   data: dailyDeliveries.map(r => ({ x: r.day, y: r.skipped   })) },
          ] },
        { key: 'route_distribution', title: 'Active Subs by Route Area', type: 'bar', unit: 'count',
          series: [{ label: 'Subscriptions', data: routeBreakdown.map(r => ({ x: r.route_area ?? 'Unassigned', y: r.count })) }] },
      ]
    }

    // ── DIAGNOSTIC LAB ────────────────────────────────────────────────────────
    else if (domainType === 'diagnostic_lab') {
      const [reportStats, categoryBreakdown, collectionMode, tatStats] = await Promise.all([
        db.$queryRaw<[{ total: number; pending: number; ready: number; urgent: number }]>`
          SELECT COUNT(*)::int AS total,
                 COUNT(*) FILTER (WHERE status = 'pending')::int AS pending,
                 COUNT(*) FILTER (WHERE status = 'ready')::int   AS ready,
                 COUNT(*) FILTER (WHERE urgent = true)::int      AS urgent
          FROM lab_reports WHERE "branchId" = ${branchId}::uuid
            AND "createdAt" >= ${fromStr}::timestamp
        `,
        db.$queryRaw<Array<{ category: string; count: number; revenue: number }>>`
          SELECT p."domainAttrs"->>'test_category' AS category,
                 COUNT(*)::int AS count, COALESCE(SUM(ii.total),0)::float AS revenue
          FROM invoice_items ii JOIN products p ON p.id = ii."productId"
          JOIN invoices i ON i.id = ii."invoiceId"
          WHERE i."branchId" = ${branchId}::uuid
            AND i."date" >= ${fromStr}::date AND i."date" <= ${toStr}::date
          GROUP BY p."domainAttrs"->>'test_category' ORDER BY revenue DESC
        `,
        db.$queryRaw<[{ home: number; walkin: number }]>`
          SELECT COUNT(*) FILTER (WHERE "homeCollection" = true)::int  AS home,
                 COUNT(*) FILTER (WHERE "homeCollection" = false)::int AS walkin
          FROM lab_reports WHERE "branchId" = ${branchId}::uuid
            AND "createdAt" >= ${fromStr}::timestamp
        `,
        // Avg turnaround time in hours for completed reports
        db.$queryRaw<[{ avg_tat_hours: number }]>`
          SELECT COALESCE(AVG(
            EXTRACT(EPOCH FROM ("reportReadyAt" - "collectedAt")) / 3600
          ),0)::float AS avg_tat_hours
          FROM lab_reports
          WHERE "branchId" = ${branchId}::uuid
            AND "reportReadyAt" IS NOT NULL AND "collectedAt" IS NOT NULL
            AND "createdAt" >= ${fromStr}::timestamp
        `,
      ])

      const rs = reportStats[0]!; const cm = collectionMode[0]!

      domainKpis = [
        { key: 'revenue',         label: 'Revenue',            value: rev.total,      unit: '₹', delta: revDelta, trend: trend(revDelta), prev: prevRev?.total },
        { key: 'total_tests',     label: 'Tests Processed',    value: rs.total,       unit: 'count' },
        { key: 'pending_reports', label: 'Reports Pending',    value: rs.pending,     unit: 'count', highlight: rs.pending > 10 ? 'warn' : 'good' },
        { key: 'urgent',          label: 'Urgent Tests',       value: rs.urgent,      unit: 'count', highlight: rs.urgent > 0 ? 'danger' : 'good' },
        { key: 'avg_tat',         label: 'Avg TAT (hours)',    value: Math.round(tatStats[0]!.avg_tat_hours), unit: 'hours' },
      ]
      domainCharts = [
        { key: 'test_category', title: 'Tests by Category', type: 'donut', unit: 'count',
          series: categoryBreakdown.map(r => ({ label: r.category ?? 'other', data: [{ x: r.category ?? 'other', y: r.count }] })) },
        { key: 'collection_mode', title: 'Walk-in vs Home Collection', type: 'donut', unit: 'count',
          series: [
            { label: 'Home Collection', data: [{ x: 'Home',    y: cm.home   }] },
            { label: 'Walk-in',         data: [{ x: 'Walk-in', y: cm.walkin }] },
          ] },
        { key: 'top_tests', title: 'Top Tests by Revenue', type: 'bar', unit: '₹',
          series: [{ label: 'Revenue', data: (await topProductsSeries(db, branchId, fromStr, toStr)).map(p => ({ x: p.name, y: p.revenue })) }] },
      ]
    }

    // ── REPAIR SHOP ───────────────────────────────────────────────────────────
    else if (domainType === 'repair') {
      const [jobStats, brandBreakdown, statusFunnel, deviceTypes] = await Promise.all([
        db.$queryRaw<[{ total: number; pending: number; ready: number; avg_value: number; avg_days: number }]>`
          SELECT COUNT(*)::int AS total,
                 COUNT(*) FILTER (WHERE status NOT IN ('delivered','cancelled'))::int AS pending,
                 COUNT(*) FILTER (WHERE status = 'ready')::int                       AS ready,
                 COALESCE(AVG(NULLIF("estimatedCost",0)),0)::float                   AS avg_value,
                 COALESCE(AVG(
                   CASE WHEN status = 'delivered'
                   THEN EXTRACT(DAY FROM "updatedAt" - "createdAt") END
                 ),0)::float AS avg_days
          FROM job_cards WHERE "branchId" = ${branchId}::uuid
        `,
        db.$queryRaw<Array<{ brand: string; count: number }>>`
          SELECT "deviceBrand" AS brand, COUNT(*)::int AS count
          FROM job_cards
          WHERE "branchId" = ${branchId}::uuid AND "createdAt" >= ${fromStr}::timestamp
            AND "deviceBrand" IS NOT NULL
          GROUP BY "deviceBrand" ORDER BY count DESC LIMIT 8
        `,
        db.$queryRaw<Array<{ status: string; count: number }>>`
          SELECT status, COUNT(*)::int AS count FROM job_cards
          WHERE "branchId" = ${branchId}::uuid GROUP BY status
        `,
        db.$queryRaw<Array<{ device_type: string; count: number }>>`
          SELECT "deviceType" AS device_type, COUNT(*)::int AS count
          FROM job_cards WHERE "branchId" = ${branchId}::uuid
            AND "createdAt" >= ${fromStr}::timestamp
          GROUP BY "deviceType" ORDER BY count DESC
        `,
      ])

      const js = jobStats[0]!

      domainKpis = [
        { key: 'revenue',       label: 'Revenue',             value: rev.total,                unit: '₹', delta: revDelta, trend: trend(revDelta), prev: prevRev?.total },
        { key: 'jobs_active',   label: 'Active Jobs',         value: js.pending,               unit: 'count' },
        { key: 'ready',         label: 'Ready for Pickup',    value: js.ready,                 unit: 'count', highlight: js.ready > 0 ? 'warn' : 'good' },
        { key: 'avg_job_value', label: 'Avg Job Value',       value: Math.round(js.avg_value), unit: '₹' },
        { key: 'avg_turnaround',label: 'Avg Repair Days',     value: Math.round(js.avg_days),  unit: 'days' },
      ]
      domainCharts = [
        { key: 'job_funnel', title: 'Job Card Status Funnel', type: 'bar', unit: 'count',
          series: [{ label: 'Jobs', data: statusFunnel.map(r => ({ x: r.status, y: r.count })) }] },
        { key: 'brand_mix', title: 'Devices by Brand', type: 'donut', unit: 'count',
          series: brandBreakdown.map(r => ({ label: r.brand, data: [{ x: r.brand, y: r.count }] })) },
        { key: 'device_type', title: 'Device Types', type: 'donut', unit: 'count',
          series: deviceTypes.map(r => ({ label: r.device_type ?? 'other', data: [{ x: r.device_type ?? 'other', y: r.count }] })) },
      ]
    }

    // ── PEST CONTROL ──────────────────────────────────────────────────────────
    else if (domainType === 'pest_control') {
      const [visitStats, serviceTypeBreakdown, propertyTypes] = await Promise.all([
        db.$queryRaw<[{ scheduled: number; completed: number; overdue: number }]>`
          SELECT COUNT(*)::int AS scheduled,
                 COUNT(*) FILTER (WHERE status = 'completed')::int AS completed,
                 COUNT(*) FILTER (WHERE status = 'scheduled' AND "scheduledDate" < CURRENT_DATE)::int AS overdue
          FROM service_visits WHERE "branchId" = ${branchId}::uuid
            AND "scheduledDate" >= ${fromStr}::date AND "scheduledDate" <= ${toStr}::date
        `,
        db.$queryRaw<Array<{ service_type: string; count: number; revenue: number }>>`
          SELECT p."domainAttrs"->>'service_type' AS service_type,
                 COUNT(*)::int AS count, COALESCE(SUM(ii.total),0)::float AS revenue
          FROM invoice_items ii JOIN products p ON p.id = ii."productId"
          JOIN invoices i ON i.id = ii."invoiceId"
          WHERE i."branchId" = ${branchId}::uuid
            AND i."date" >= ${fromStr}::date AND i."date" <= ${toStr}::date
          GROUP BY p."domainAttrs"->>'service_type' ORDER BY revenue DESC
        `,
        db.$queryRaw<Array<{ property_type: string; count: number }>>`
          SELECT i."domainData"->>'property_type' AS property_type, COUNT(*)::int AS count
          FROM invoices i WHERE i."branchId" = ${branchId}::uuid AND i."txnType" = 'sale_invoice'
            AND i."date" >= ${fromStr}::date AND i."date" <= ${toStr}::date
          GROUP BY i."domainData"->>'property_type' ORDER BY count DESC
        `,
      ])

      const vs = visitStats[0]!

      domainKpis = [
        { key: 'revenue',        label: 'Revenue',           value: rev.total,    unit: '₹', delta: revDelta, trend: trend(revDelta), prev: prevRev?.total },
        { key: 'visits_done',    label: 'Visits Completed',  value: vs.completed, unit: 'count' },
        { key: 'visits_overdue', label: 'Overdue Visits',    value: vs.overdue,   unit: 'count', highlight: vs.overdue > 0 ? 'danger' : 'good' },
        { key: 'outstanding',    label: 'Outstanding Dues',  value: rev.outstanding, unit: '₹', highlight: rev.outstanding > 0 ? 'warn' : 'good' },
      ]
      domainCharts = [
        { key: 'service_type',   title: 'Revenue by Service Type', type: 'donut', unit: '₹',
          series: serviceTypeBreakdown.map(r => ({ label: r.service_type ?? 'general', data: [{ x: r.service_type ?? 'general', y: r.revenue }] })) },
        { key: 'property_type',  title: 'Jobs by Property Type', type: 'donut', unit: 'count',
          series: propertyTypes.map(r => ({ label: r.property_type ?? 'other', data: [{ x: r.property_type ?? 'other', y: r.count }] })) },
      ]
    }

    // ── SALON / SPA ───────────────────────────────────────────────────────────
    else if (domainType === 'salon') {
      const [staffBreakdown, topServices] = await Promise.all([
        db.$queryRaw<Array<{ staff: string; revenue: number; services: number }>>`
          SELECT i."domainData"->>'staff_name' AS staff,
                 COALESCE(SUM(i."grandTotal"),0)::float AS revenue,
                 COUNT(*)::int AS services
          FROM invoices i WHERE i."branchId" = ${branchId}::uuid AND i."txnType" = 'sale_invoice'
            AND i."date" >= ${fromStr}::date AND i."date" <= ${toStr}::date
            AND i."domainData"->>'staff_name' IS NOT NULL
          GROUP BY i."domainData"->>'staff_name' ORDER BY revenue DESC
        `,
        topProductsSeries(db, branchId, fromStr, toStr),
      ])

      const avgBill = rev.count > 0 ? Math.round(rev.total / rev.count) : 0

      domainKpis = [
        { key: 'revenue',     label: 'Revenue',        value: rev.total,       unit: '₹', delta: revDelta, trend: trend(revDelta), prev: prevRev?.total },
        { key: 'services',    label: 'Services Done',  value: rev.count,       unit: 'count' },
        { key: 'avg_bill',    label: 'Avg Bill',       value: avgBill,         unit: '₹' },
        { key: 'outstanding', label: 'Unpaid',         value: rev.outstanding, unit: '₹', highlight: rev.outstanding > 0 ? 'warn' : 'good' },
        ...(universalMarginKpi ? [universalMarginKpi] : []),
      ]
      domainCharts = [
        { key: 'top_services',  title: 'Top Services', type: 'bar', unit: '₹',
          series: [{ label: 'Revenue', data: topServices.map(p => ({ x: p.name, y: p.revenue })) }] },
        { key: 'staff_revenue', title: 'Revenue by Staff', type: 'bar', unit: '₹',
          series: [{ label: 'Revenue', data: staffBreakdown.map(r => ({ x: r.staff ?? 'Unassigned', y: r.revenue })) }] },
        { key: 'staff_services', title: 'Services by Staff', type: 'bar', unit: 'count',
          series: [{ label: 'Services', data: staffBreakdown.map(r => ({ x: r.staff ?? 'Unassigned', y: r.services })) }] },
      ]
    }

    // ── WHOLESALE / ENTERPRISE ────────────────────────────────────────────────
    else if (domainType === 'wholesale' || domainType === 'enterprise') {
      const [agingBuckets, topCustomers] = await Promise.all([
        db.$queryRaw<Array<{ bucket: string; amount: number; count: number }>>`
          SELECT
            CASE
              WHEN EXTRACT(DAY FROM NOW() - "date") <= 30 THEN '0-30 days'
              WHEN EXTRACT(DAY FROM NOW() - "date") <= 60 THEN '31-60 days'
              WHEN EXTRACT(DAY FROM NOW() - "date") <= 90 THEN '61-90 days'
              ELSE '90+ days'
            END AS bucket,
            COALESCE(SUM("grandTotal" - "paidAmt"),0)::float AS amount,
            COUNT(*)::int AS count
          FROM invoices
          WHERE "branchId" = ${branchId}::uuid AND "txnType" = 'sale_invoice'
            AND status IN ('confirmed','partial') AND "grandTotal" > "paidAmt"
          GROUP BY bucket ORDER BY bucket
        `,
        db.$queryRaw<Array<{ name: string; revenue: number; outstanding: number }>>`
          SELECT p.name,
                 COALESCE(SUM(i."grandTotal"),0)::float        AS revenue,
                 COALESCE(p.balance,0)::float                  AS outstanding
          FROM parties p
          LEFT JOIN invoices i ON i."partyId" = p.id AND i."txnType" = 'sale_invoice'
            AND i."date" >= ${fromStr}::date AND i."date" <= ${toStr}::date
          WHERE p."branchId" = ${branchId}::uuid AND p.type = 'customer'
          GROUP BY p.id, p.name, p.balance ORDER BY revenue DESC LIMIT 8
        `,
      ])

      const totalOutstanding = agingBuckets.reduce((s, r) => s + r.amount, 0)
      const overdue90        = agingBuckets.find(b => b.bucket === '90+ days')?.amount ?? 0

      domainKpis = [
        { key: 'revenue',      label: 'Revenue',            value: rev.total,        unit: '₹', delta: revDelta, trend: trend(revDelta), prev: prevRev?.total },
        { key: 'outstanding',  label: 'Total Outstanding',  value: totalOutstanding, unit: '₹', highlight: totalOutstanding > 0 ? 'warn' : 'good' },
        { key: 'overdue_90',   label: 'Overdue >90 Days',  value: overdue90,        unit: '₹', highlight: overdue90 > 0 ? 'danger' : 'good' },
        { key: 'invoices',     label: 'Invoices Issued',    value: rev.count,        unit: 'count', delta: pctDelta(rev.count, prevRev?.count ?? 0), trend: trend(pctDelta(rev.count, prevRev?.count ?? 0)) },
        ...(universalMarginKpi ? [universalMarginKpi] : []),
      ]
      domainCharts = [
        { key: 'aging', title: 'Receivables Aging', type: 'stacked_bar', unit: '₹',
          series: agingBuckets.map(r => ({ label: r.bucket, data: [{ x: r.bucket, y: r.amount }] })) },
        { key: 'top_customers', title: 'Top Customers by Revenue', type: 'bar', unit: '₹',
          series: [{ label: 'Revenue', data: topCustomers.map(r => ({ x: r.name, y: r.revenue })) }] },
        { key: 'customer_outstanding', title: 'Customer Outstanding Balances', type: 'bar', unit: '₹',
          series: [{ label: 'Outstanding', data: topCustomers.filter(r => r.outstanding > 0).map(r => ({ x: r.name, y: r.outstanding })) }] },
      ]
    }

    // ── JEWELLERY ─────────────────────────────────────────────────────────────
    else if (domainType === 'jewellery') {
      const [metalBreakdown, oldGoldValue] = await Promise.all([
        db.$queryRaw<Array<{ metal: string; revenue: number; weight: number }>>`
          SELECT p."domainAttrs"->>'metal' AS metal,
                 COALESCE(SUM(ii.total),0)::float AS revenue,
                 COALESCE(SUM(ii.qty),0)::float   AS weight
          FROM invoice_items ii JOIN products p ON p.id = ii."productId"
          JOIN invoices i ON i.id = ii."invoiceId"
          WHERE i."branchId" = ${branchId}::uuid
            AND i."date" >= ${fromStr}::date AND i."date" <= ${toStr}::date
          GROUP BY p."domainAttrs"->>'metal' ORDER BY revenue DESC
        `,
        // Old gold exchange total (negative invoice items or domainData)
        db.$queryRaw<[{ value: number }]>`
          SELECT COALESCE(SUM(
            ((i."domainData"->'old_gold_exchange'->>'amount')::numeric)
          ),0)::float AS value
          FROM invoices i
          WHERE i."branchId" = ${branchId}::uuid AND i."txnType" = 'sale_invoice'
            AND i."date" >= ${fromStr}::date AND i."date" <= ${toStr}::date
            AND i."domainData"->'old_gold_exchange' IS NOT NULL
        `,
      ])

      domainKpis = [
        { key: 'revenue',       label: 'Revenue',           value: rev.total,       unit: '₹', delta: revDelta, trend: trend(revDelta), prev: prevRev?.total },
        { key: 'bills',         label: 'Bills',             value: rev.count,       unit: 'count' },
        { key: 'avg_bill',      label: 'Avg Bill Value',    value: rev.count > 0 ? Math.round(rev.total / rev.count) : 0, unit: '₹' },
        { key: 'old_gold',      label: 'Old Gold Exchanged',value: oldGoldValue[0]?.value ?? 0, unit: '₹' },
        { key: 'outstanding',   label: 'Credit Dues',       value: rev.outstanding, unit: '₹', highlight: rev.outstanding > 0 ? 'warn' : 'good' },
      ]
      domainCharts = [
        { key: 'metal_mix', title: 'Revenue by Metal', type: 'donut', unit: '₹',
          series: metalBreakdown.map(r => ({ label: r.metal ?? 'other', data: [{ x: r.metal ?? 'other', y: r.revenue }] })) },
        { key: 'metal_weight', title: 'Weight Sold by Metal (g)', type: 'bar', unit: 'g',
          series: [{ label: 'Weight (g)', data: metalBreakdown.map(r => ({ x: r.metal ?? 'other', y: r.weight })) }] },
        { key: 'top_items', title: 'Top Items', type: 'bar', unit: '₹',
          series: [{ label: 'Revenue', data: (await topProductsSeries(db, branchId, fromStr, toStr)).map(p => ({ x: p.name, y: p.revenue })) }] },
      ]
    }

    // ── AUTOMOBILE ────────────────────────────────────────────────────────────
    else if (domainType === 'automobile') {
      const [jobStats, partsVsLabour, serviceTypes] = await Promise.all([
        db.$queryRaw<[{ total: number; open: number; avg_value: number; avg_days: number }]>`
          SELECT COUNT(*)::int AS total,
                 COUNT(*) FILTER (WHERE status NOT IN ('delivered'))::int AS open,
                 COALESCE(AVG(NULLIF("estimatedCost",0)),0)::float AS avg_value,
                 COALESCE(AVG(
                   CASE WHEN status = 'delivered'
                   THEN EXTRACT(DAY FROM "updatedAt" - "createdAt") END
                 ),0)::float AS avg_days
          FROM job_cards WHERE "branchId" = ${branchId}::uuid
            AND "createdAt" >= ${fromStr}::timestamp
        `,
        db.$queryRaw<Array<{ item_type: string; revenue: number }>>`
          SELECT p."itemType" AS item_type, COALESCE(SUM(ii.total),0)::float AS revenue
          FROM invoice_items ii JOIN products p ON p.id = ii."productId"
          JOIN invoices i ON i.id = ii."invoiceId"
          WHERE i."branchId" = ${branchId}::uuid
            AND i."date" >= ${fromStr}::date AND i."date" <= ${toStr}::date
          GROUP BY p."itemType"
        `,
        db.$queryRaw<Array<{ service_type: string; revenue: number }>>`
          SELECT i."domainData"->>'service_type' AS service_type,
                 COALESCE(SUM(i."grandTotal"),0)::float AS revenue
          FROM invoices i WHERE i."branchId" = ${branchId}::uuid AND i."txnType" = 'sale_invoice'
            AND i."date" >= ${fromStr}::date AND i."date" <= ${toStr}::date
            AND i."domainData"->>'service_type' IS NOT NULL
          GROUP BY i."domainData"->>'service_type' ORDER BY revenue DESC
        `,
      ])

      const js = jobStats[0]!

      domainKpis = [
        { key: 'revenue',       label: 'Revenue',        value: rev.total,                unit: '₹', delta: revDelta, trend: trend(revDelta), prev: prevRev?.total },
        { key: 'jobs_open',     label: 'Open Job Cards', value: js.open,                  unit: 'count', highlight: js.open > 0 ? 'warn' : 'good' },
        { key: 'avg_job_value', label: 'Avg Job Value',  value: Math.round(js.avg_value), unit: '₹' },
        { key: 'avg_days',      label: 'Avg Job Days',   value: Math.round(js.avg_days),  unit: 'days' },
        { key: 'outstanding',   label: 'Outstanding',    value: rev.outstanding,          unit: '₹', highlight: rev.outstanding > 0 ? 'warn' : 'good' },
      ]
      domainCharts = [
        { key: 'parts_vs_labour', title: 'Parts vs Labour Split', type: 'donut', unit: '₹',
          series: partsVsLabour.map(r => ({ label: r.item_type, data: [{ x: r.item_type, y: r.revenue }] })) },
        { key: 'service_type', title: 'Revenue by Service Type', type: 'bar', unit: '₹',
          series: [{ label: 'Revenue', data: serviceTypes.map(r => ({ x: r.service_type ?? 'general', y: r.revenue })) }] },
      ]
    }

    // ── HOTEL ─────────────────────────────────────────────────────────────────
    else if (domainType === 'hotel') {
      const [channelBreakdown, mealPlanBreakdown] = await Promise.all([
        db.$queryRaw<Array<{ channel: string; revenue: number; count: number }>>`
          SELECT i."domainData"->>'booking_source' AS channel,
                 COALESCE(SUM(i."grandTotal"),0)::float AS revenue, COUNT(*)::int AS count
          FROM invoices i WHERE i."branchId" = ${branchId}::uuid AND i."txnType" = 'sale_invoice'
            AND i."date" >= ${fromStr}::date AND i."date" <= ${toStr}::date
          GROUP BY i."domainData"->>'booking_source' ORDER BY revenue DESC
        `,
        db.$queryRaw<Array<{ meal_plan: string; count: number }>>`
          SELECT i."domainData"->>'meal_plan' AS meal_plan, COUNT(*)::int AS count
          FROM invoices i WHERE i."branchId" = ${branchId}::uuid AND i."txnType" = 'sale_invoice'
            AND i."date" >= ${fromStr}::date AND i."date" <= ${toStr}::date
          GROUP BY i."domainData"->>'meal_plan'
        `,
      ])

      const avgBill = rev.count > 0 ? Math.round(rev.total / rev.count) : 0

      domainKpis = [
        { key: 'revenue',      label: 'Revenue',        value: rev.total,       unit: '₹', delta: revDelta, trend: trend(revDelta), prev: prevRev?.total },
        { key: 'checkins',     label: 'Check-ins',      value: rev.count,       unit: 'count' },
        { key: 'avg_bill',     label: 'Avg Room Bill',  value: avgBill,         unit: '₹' },
        { key: 'outstanding',  label: 'Unpaid Folios',  value: rev.outstanding, unit: '₹', highlight: rev.outstanding > 0 ? 'warn' : 'good' },
      ]
      domainCharts = [
        { key: 'booking_channel', title: 'Revenue by Booking Channel', type: 'donut', unit: '₹',
          series: channelBreakdown.map(r => ({ label: r.channel ?? 'walk-in', data: [{ x: r.channel ?? 'walk-in', y: r.revenue }] })) },
        { key: 'meal_plan', title: 'Bookings by Meal Plan', type: 'donut', unit: 'count',
          series: mealPlanBreakdown.map(r => ({ label: r.meal_plan ?? 'EP', data: [{ x: r.meal_plan ?? 'EP', y: r.count }] })) },
      ]
    }

    // ── AGRI / FERTILIZER ─────────────────────────────────────────────────────
    else if (domainType === 'agri') {
      const [productTypeBreakdown, seasonBreakdown, subsidyStats] = await Promise.all([
        db.$queryRaw<Array<{ product_type: string; revenue: number }>>`
          SELECT p."domainAttrs"->>'product_type' AS product_type,
                 COALESCE(SUM(ii.total),0)::float AS revenue
          FROM invoice_items ii JOIN products p ON p.id = ii."productId"
          JOIN invoices i ON i.id = ii."invoiceId"
          WHERE i."branchId" = ${branchId}::uuid
            AND i."date" >= ${fromStr}::date AND i."date" <= ${toStr}::date
          GROUP BY p."domainAttrs"->>'product_type' ORDER BY revenue DESC
        `,
        db.$queryRaw<Array<{ season: string; revenue: number; count: number }>>`
          SELECT i."domainData"->>'season' AS season,
                 COALESCE(SUM(i."grandTotal"),0)::float AS revenue, COUNT(*)::int AS count
          FROM invoices i WHERE i."branchId" = ${branchId}::uuid AND i."txnType" = 'sale_invoice'
            AND i."date" >= ${fromStr}::date AND i."date" <= ${toStr}::date
          GROUP BY i."domainData"->>'season'
        `,
        db.$queryRaw<[{ total_bills: number; subsidy_bills: number; subsidy_revenue: number }]>`
          SELECT COUNT(*)::int AS total_bills,
                 COUNT(*) FILTER (WHERE (i."domainData"->>'subsidy_applied')::boolean = true)::int AS subsidy_bills,
                 COALESCE(SUM(i."grandTotal") FILTER (WHERE (i."domainData"->>'subsidy_applied')::boolean = true),0)::float AS subsidy_revenue
          FROM invoices i WHERE i."branchId" = ${branchId}::uuid AND i."txnType" = 'sale_invoice'
            AND i."date" >= ${fromStr}::date AND i."date" <= ${toStr}::date
        `,
      ])

      const ss = subsidyStats[0]!

      domainKpis = [
        { key: 'revenue',          label: 'Revenue',           value: rev.total,         unit: '₹', delta: revDelta, trend: trend(revDelta), prev: prevRev?.total },
        { key: 'subsidy_sales',    label: 'Subsidised Sales',  value: ss.subsidy_revenue, unit: '₹' },
        { key: 'outstanding',      label: 'Kisan Khata Dues',  value: rev.outstanding,   unit: '₹', highlight: rev.outstanding > 0 ? 'warn' : 'good' },
        { key: 'bills',            label: 'Bills',             value: rev.count,         unit: 'count' },
      ]
      domainCharts = [
        { key: 'product_type', title: 'Revenue by Product Type', type: 'donut', unit: '₹',
          series: productTypeBreakdown.map(r => ({ label: r.product_type ?? 'other', data: [{ x: r.product_type ?? 'other', y: r.revenue }] })) },
        { key: 'season_split', title: 'Revenue by Season', type: 'donut', unit: '₹',
          series: seasonBreakdown.filter(r => r.season).map(r => ({ label: r.season!, data: [{ x: r.season!, y: r.revenue }] })) },
        { key: 'top_products', title: 'Top Products', type: 'bar', unit: '₹',
          series: [{ label: 'Revenue', data: (await topProductsSeries(db, branchId, fromStr, toStr)).map(p => ({ x: p.name, y: p.revenue })) }] },
      ]
    }

    // ── PHOTOGRAPHY ───────────────────────────────────────────────────────────
    else if (domainType === 'photography') {
      const [eventTypes, advancePending] = await Promise.all([
        db.$queryRaw<Array<{ event_type: string; count: number; revenue: number }>>`
          SELECT p."domainAttrs"->>'event_type' AS event_type,
                 COUNT(*)::int AS count, COALESCE(SUM(ii.total),0)::float AS revenue
          FROM invoice_items ii JOIN products p ON p.id = ii."productId"
          JOIN invoices i ON i.id = ii."invoiceId"
          WHERE i."branchId" = ${branchId}::uuid
            AND i."date" >= ${fromStr}::date AND i."date" <= ${toStr}::date
          GROUP BY p."domainAttrs"->>'event_type' ORDER BY revenue DESC
        `,
        db.$queryRaw<[{ count: number; value: number }]>`
          SELECT COUNT(*)::int AS count,
                 COALESCE(SUM("grandTotal" - "paidAmt"),0)::float AS value
          FROM invoices WHERE "branchId" = ${branchId}::uuid AND "txnType" = 'sale_invoice'
            AND status IN ('confirmed','partial') AND "grandTotal" > "paidAmt"
        `,
      ])

      domainKpis = [
        { key: 'revenue',         label: 'Revenue',         value: rev.total,                unit: '₹', delta: revDelta, trend: trend(revDelta), prev: prevRev?.total },
        { key: 'shoots',          label: 'Shoots Invoiced', value: rev.count,                unit: 'count' },
        { key: 'balance_pending', label: 'Balance Pending', value: advancePending[0]!.value, unit: '₹', highlight: advancePending[0]!.count > 0 ? 'warn' : 'good' },
        { key: 'avg_shoot',       label: 'Avg Shoot Value', value: rev.count > 0 ? Math.round(rev.total / rev.count) : 0, unit: '₹' },
      ]
      domainCharts = [
        { key: 'event_type', title: 'Revenue by Event Type', type: 'donut', unit: '₹',
          series: eventTypes.map(r => ({ label: r.event_type ?? 'other', data: [{ x: r.event_type ?? 'other', y: r.revenue }] })) },
        { key: 'top_packages', title: 'Top Packages', type: 'bar', unit: '₹',
          series: [{ label: 'Revenue', data: (await topProductsSeries(db, branchId, fromStr, toStr)).map(p => ({ x: p.name, y: p.revenue })) }] },
      ]
    }

    // ── COACHING ─────────────────────────────────────────────────────────────
    else if (domainType === 'coaching') {
      const pendingFees = await db.$queryRaw<[{ pending_invoices: number; pending_amount: number }]>`
        SELECT COUNT(*) FILTER (WHERE status IN ('confirmed','partial'))::int       AS pending_invoices,
               COALESCE(SUM("grandTotal" - "paidAmt") FILTER (WHERE status IN ('confirmed','partial')),0)::float AS pending_amount
        FROM invoices WHERE "branchId" = ${branchId}::uuid AND "txnType" = 'sale_invoice'
      `
      const pf = pendingFees[0]!
      const topCourses = await topProductsSeries(db, branchId, fromStr, toStr)

      domainKpis = [
        { key: 'revenue',           label: 'Fees Collected',       value: rev.total,          unit: '₹', delta: revDelta, trend: trend(revDelta), prev: prevRev?.total },
        { key: 'outstanding',       label: 'Fees Outstanding',     value: rev.outstanding,    unit: '₹', highlight: rev.outstanding > 0 ? 'warn' : 'good' },
        { key: 'pending_invoices',  label: 'Pending Fee Invoices', value: pf.pending_invoices, unit: 'count', highlight: pf.pending_invoices > 0 ? 'warn' : 'good' },
        { key: 'recovery_rate',     label: 'Fee Recovery Rate',    value: (rev.total + rev.outstanding) > 0 ? Math.round(rev.total / (rev.total + rev.outstanding) * 100) : 100, unit: '%' },
      ]
      domainCharts = [
        { key: 'top_courses', title: 'Top Courses / Batches', type: 'bar', unit: '₹',
          series: [{ label: 'Revenue', data: topCourses.map(p => ({ x: p.name, y: p.revenue })) }] },
      ]
    }

    // ── OPTICAL ───────────────────────────────────────────────────────────────
    else if (domainType === 'optical') {
      const ordersPending = await db.$queryRaw<[{ count: number; value: number }]>`
        SELECT COUNT(*)::int AS count,
               COALESCE(SUM("grandTotal" - "paidAmt"),0)::float AS value
        FROM invoices WHERE "branchId" = ${branchId}::uuid AND "txnType" = 'sale_invoice'
          AND status IN ('confirmed','partial') AND "grandTotal" > "paidAmt"
      `
      const topFrames = await topProductsSeries(db, branchId, fromStr, toStr)

      domainKpis = [
        { key: 'revenue',         label: 'Revenue',           value: rev.total,              unit: '₹', delta: revDelta, trend: trend(revDelta), prev: prevRev?.total },
        { key: 'orders',          label: 'Orders',            value: rev.count,              unit: 'count' },
        { key: 'balance_pending', label: 'Balance Pending',   value: ordersPending[0]!.value, unit: '₹', highlight: ordersPending[0]!.count > 0 ? 'warn' : 'good' },
        { key: 'avg_order',       label: 'Avg Order Value',   value: rev.count > 0 ? Math.round(rev.total / rev.count) : 0, unit: '₹' },
        ...(universalMarginKpi ? [universalMarginKpi] : []),
      ]
      domainCharts = [
        { key: 'top_frames', title: 'Top Products', type: 'bar', unit: '₹',
          series: [{ label: 'Revenue', data: topFrames.map(p => ({ x: p.name, y: p.revenue })) }] },
      ]
    }

    // ── CLINIC ────────────────────────────────────────────────────────────────
    else if (domainType === 'clinic') {
      const [apptStats, pendingBills, topServices] = await Promise.all([
        db.$queryRaw<[{ patients: number; avg_bill: number }]>`
          SELECT COUNT(DISTINCT "partyId")::int        AS patients,
                 COALESCE(AVG("grandTotal"),0)::float  AS avg_bill
          FROM invoices
          WHERE "branchId" = ${branchId}::uuid AND "txnType" = 'sale_invoice'
            AND status != 'cancelled'
            AND date >= ${fromStr}::date AND date <= ${toStr}::date
        `,
        db.$queryRaw<[{ count: number; amount: number }]>`
          SELECT COUNT(*)::int AS count,
                 COALESCE(SUM("grandTotal" - "paidAmt"),0)::float AS amount
          FROM invoices
          WHERE "branchId" = ${branchId}::uuid AND "txnType" = 'sale_invoice'
            AND status IN ('confirmed','partial')
        `,
        topProductsSeries(db, branchId, fromStr, toStr),
      ])

      const appt = apptStats[0]!
      const pb   = pendingBills[0]!
      const recoveryRate = (rev.total + rev.outstanding) > 0
        ? Math.round(rev.total / (rev.total + rev.outstanding) * 100) : 100

      domainKpis = [
        { key: 'revenue',       label: 'Fees Collected',    value: rev.total,        unit: '₹',     delta: revDelta, trend: trend(revDelta), prev: prevRev?.total },
        { key: 'patients',      label: 'Patients',          value: appt.patients,    unit: 'count'  },
        { key: 'avg_bill',      label: 'Avg Consultation',  value: Math.round(appt.avg_bill), unit: '₹' },
        { key: 'outstanding',   label: 'Pending Bills',     value: pb.amount,        unit: '₹',     highlight: pb.count > 0 ? 'warn' : 'good' },
        { key: 'recovery_rate', label: 'Collection Rate',   value: recoveryRate,     unit: '%',     highlight: recoveryRate >= 90 ? 'good' : recoveryRate >= 70 ? 'warn' : 'danger' },
      ]
      domainCharts = [
        { key: 'top_services', title: 'Top Services / Treatments', type: 'bar', unit: '₹',
          series: [{ label: 'Revenue', data: topServices.map(p => ({ x: p.name, y: p.revenue })) }] },
      ]
    }

    // ── LAUNDRY ───────────────────────────────────────────────────────────────
    else if (domainType === 'laundry') {
      const [serviceBreakdown, topItems] = await Promise.all([
        db.$queryRaw<Array<{ service_type: string; revenue: number; count: number }>>`
          SELECT p."domainAttrs"->>'service_type' AS service_type,
                 COALESCE(SUM(ii."total"),0)::float AS revenue,
                 COUNT(DISTINCT i.id)::int AS count
          FROM invoices i
          JOIN invoice_items ii ON ii."invoiceId" = i.id
          JOIN products p ON p.id = ii."productId"
          WHERE i."branchId" = ${branchId}::uuid AND i."txnType" = 'sale_invoice'
            AND i."date" >= ${fromStr}::date AND i."date" <= ${toStr}::date
          GROUP BY p."domainAttrs"->>'service_type' ORDER BY revenue DESC
        `,
        topProductsSeries(db, branchId, fromStr, toStr),
      ])
      const avgBill = rev.count > 0 ? Math.round(rev.total / rev.count) : 0
      domainKpis = [
        { key: 'revenue',       label: 'Revenue',          value: rev.total,       unit: '₹', delta: revDelta, trend: trend(revDelta), prev: prevRev?.total },
        { key: 'orders',        label: 'Orders',           value: rev.count,       unit: 'count' },
        { key: 'avg_order',     label: 'Avg Order Value',  value: avgBill,         unit: '₹' },
        { key: 'outstanding',   label: 'Unpaid',           value: rev.outstanding, unit: '₹', highlight: rev.outstanding > 0 ? 'warn' : 'good' },
        ...(universalMarginKpi ? [universalMarginKpi] : []),
      ]
      domainCharts = [
        { key: 'service_mix', title: 'Revenue by Service Type', type: 'donut', unit: '₹',
          series: serviceBreakdown.map(r => ({ label: r.service_type ?? 'other', data: [{ x: r.service_type ?? 'other', y: r.revenue }] })) },
        { key: 'top_items', title: 'Top Garment Types', type: 'bar', unit: '₹',
          series: [{ label: 'Revenue', data: topItems.map(p => ({ x: p.name, y: p.revenue })) }] },
      ]
    }

    // ── PRINTING ──────────────────────────────────────────────────────────────
    else if (domainType === 'printing') {
      const [printTypeBreakdown, topItems] = await Promise.all([
        db.$queryRaw<Array<{ print_type: string; revenue: number; count: number }>>`
          SELECT p."domainAttrs"->>'print_type' AS print_type,
                 COALESCE(SUM(ii."total"),0)::float AS revenue,
                 COUNT(DISTINCT i.id)::int AS count
          FROM invoices i
          JOIN invoice_items ii ON ii."invoiceId" = i.id
          JOIN products p ON p.id = ii."productId"
          WHERE i."branchId" = ${branchId}::uuid AND i."txnType" = 'sale_invoice'
            AND i."date" >= ${fromStr}::date AND i."date" <= ${toStr}::date
          GROUP BY p."domainAttrs"->>'print_type' ORDER BY revenue DESC
        `,
        topProductsSeries(db, branchId, fromStr, toStr),
      ])
      const avgBill = rev.count > 0 ? Math.round(rev.total / rev.count) : 0
      domainKpis = [
        { key: 'revenue',     label: 'Revenue',        value: rev.total,       unit: '₹', delta: revDelta, trend: trend(revDelta), prev: prevRev?.total },
        { key: 'orders',      label: 'Orders',         value: rev.count,       unit: 'count' },
        { key: 'avg_order',   label: 'Avg Order Value',value: avgBill,         unit: '₹' },
        { key: 'outstanding', label: 'Pending Payment',value: rev.outstanding, unit: '₹', highlight: rev.outstanding > 0 ? 'warn' : 'good' },
        ...(universalMarginKpi ? [universalMarginKpi] : []),
      ]
      domainCharts = [
        { key: 'print_type_mix', title: 'Revenue by Print Type', type: 'donut', unit: '₹',
          series: printTypeBreakdown.map(r => ({ label: r.print_type ?? 'other', data: [{ x: r.print_type ?? 'other', y: r.revenue }] })) },
        { key: 'top_products', title: 'Top Print Jobs', type: 'bar', unit: '₹',
          series: [{ label: 'Revenue', data: topItems.map(p => ({ x: p.name, y: p.revenue })) }] },
      ]
    }

    // ── SWEET SHOP ────────────────────────────────────────────────────────────
    else if (domainType === 'sweet') {
      const [categoryBreakdown, topItems] = await Promise.all([
        db.$queryRaw<Array<{ category: string; revenue: number; qty: number }>>`
          SELECT COALESCE(cat.name, 'Uncategorised') AS category,
                 COALESCE(SUM(ii."total"),0)::float AS revenue,
                 COALESCE(SUM(ii.qty),0)::float AS qty
          FROM invoices i
          JOIN invoice_items ii ON ii."invoiceId" = i.id
          JOIN products p ON p.id = ii."productId"
          LEFT JOIN categories cat ON cat.id = p."categoryId"
          WHERE i."branchId" = ${branchId}::uuid AND i."txnType" = 'sale_invoice'
            AND i."date" >= ${fromStr}::date AND i."date" <= ${toStr}::date
          GROUP BY cat.name ORDER BY revenue DESC
        `,
        topProductsSeries(db, branchId, fromStr, toStr),
      ])
      const avgBill = rev.count > 0 ? Math.round(rev.total / rev.count) : 0
      domainKpis = [
        { key: 'revenue',     label: 'Revenue',        value: rev.total,       unit: '₹', delta: revDelta, trend: trend(revDelta), prev: prevRev?.total },
        { key: 'bills',       label: 'Bills',          value: rev.count,       unit: 'count' },
        { key: 'avg_bill',    label: 'Avg Bill',       value: avgBill,         unit: '₹' },
        { key: 'outstanding', label: 'Outstanding',    value: rev.outstanding, unit: '₹', highlight: rev.outstanding > 0 ? 'warn' : 'good' },
        ...(universalMarginKpi ? [universalMarginKpi] : []),
      ]
      domainCharts = [
        { key: 'category_mix', title: 'Revenue by Category', type: 'donut', unit: '₹',
          series: categoryBreakdown.map(r => ({ label: r.category, data: [{ x: r.category, y: r.revenue }] })) },
        { key: 'top_sweets', title: 'Top Selling Sweets', type: 'bar', unit: '₹',
          series: [{ label: 'Revenue', data: topItems.map(p => ({ x: p.name, y: p.revenue })) }] },
      ]
    }

    // ── CATERING ──────────────────────────────────────────────────────────────
    else if (domainType === 'catering') {
      const [menuTypeBreakdown, topItems] = await Promise.all([
        db.$queryRaw<Array<{ menu_type: string; revenue: number; covers: number }>>`
          SELECT p."domainAttrs"->>'menu_type' AS menu_type,
                 COALESCE(SUM(ii."total"),0)::float AS revenue,
                 COALESCE(SUM(ii.qty),0)::float AS covers
          FROM invoices i
          JOIN invoice_items ii ON ii."invoiceId" = i.id
          JOIN products p ON p.id = ii."productId"
          WHERE i."branchId" = ${branchId}::uuid AND i."txnType" = 'sale_invoice'
            AND i."date" >= ${fromStr}::date AND i."date" <= ${toStr}::date
          GROUP BY p."domainAttrs"->>'menu_type' ORDER BY revenue DESC
        `,
        topProductsSeries(db, branchId, fromStr, toStr),
      ])
      const totalCovers = menuTypeBreakdown.reduce((s, r) => s + r.covers, 0)
      const avgBill = rev.count > 0 ? Math.round(rev.total / rev.count) : 0
      domainKpis = [
        { key: 'revenue',     label: 'Revenue',        value: rev.total,       unit: '₹', delta: revDelta, trend: trend(revDelta), prev: prevRev?.total },
        { key: 'events',      label: 'Events Billed',  value: rev.count,       unit: 'count' },
        { key: 'covers',      label: 'Total Covers',   value: totalCovers,     unit: 'pax' },
        { key: 'avg_event',   label: 'Avg Event Value',value: avgBill,         unit: '₹' },
        { key: 'outstanding', label: 'Pending Payment',value: rev.outstanding, unit: '₹', highlight: rev.outstanding > 0 ? 'warn' : 'good' },
      ]
      domainCharts = [
        { key: 'menu_mix', title: 'Revenue by Menu Type', type: 'donut', unit: '₹',
          series: menuTypeBreakdown.map(r => ({ label: r.menu_type ?? 'other', data: [{ x: r.menu_type ?? 'other', y: r.revenue }] })) },
        { key: 'top_packages', title: 'Top Catering Packages', type: 'bar', unit: '₹',
          series: [{ label: 'Revenue', data: topItems.map(p => ({ x: p.name, y: p.revenue })) }] },
      ]
    }

    // ── DEFAULT (retail, hardware, textile etc.) ──────────────────────────────
    else {
      const topProds = await topProductsSeries(db, branchId, fromStr, toStr)
      const avgBill  = rev.count > 0 ? Math.round(rev.total / rev.count) : 0

      domainKpis = [
        { key: 'revenue',     label: 'Revenue',       value: rev.total,       unit: '₹', delta: revDelta, trend: trend(revDelta), prev: prevRev?.total },
        { key: 'invoices',    label: 'Bills',         value: rev.count,       unit: 'count' },
        { key: 'collected',   label: 'Collected',     value: rev.collected,   unit: '₹' },
        { key: 'outstanding', label: 'Outstanding',   value: rev.outstanding, unit: '₹', highlight: rev.outstanding > 0 ? 'warn' : 'good' },
        { key: 'avg_bill',    label: 'Avg Bill',      value: avgBill,         unit: '₹' },
        ...(universalMarginKpi ? [universalMarginKpi] : []),
      ]
      domainCharts = [
        { key: 'top_products', title: 'Top Products / Services', type: 'bar', unit: '₹',
          series: [{ label: 'Revenue', data: topProds.map(p => ({ x: p.name, y: p.revenue })) }] },
      ]
    }

    return {
      period:      q.period,
      compareWith: q.compareWith ?? null,
      from:        fromStr,
      to:          toStr,
      domain:      domainType,
      kpis:        domainKpis,
      charts:      [...universalCharts, ...domainCharts],
    } as DashboardResponse
    }) // end getOrSet
    return reply.send(result)
  })

  // ── GET /api/analytics/gst-summary?month=YYYY-MM ──────────────────────────
  // Returns GSTR-1 structured totals for a calendar month.
  app.get('/gst-summary', async (req, reply) => {
    const q = z.object({
      month: z.string().regex(/^\d{4}-\d{2}$/, 'Format: YYYY-MM'),
    }).parse(req.query)

    const key = cacheKey(req.schemaName, req.branchId, 'gst', q.month)
    const result = await getOrSet(key, 900, async () => {
    const [year, mon] = q.month.split('-').map(Number) as [number, number]
    const from = `${q.month}-01`
    const to   = iso(new Date(year, mon, 0))   // last day of month
    const branchId = req.branchId
    const db       = req.db

    const [gstTotals, hsnSummary, b2bVsB2c, rateWise] = await Promise.all([

      // Overall GST totals for the month
      db.$queryRaw<[{
        taxable_amt: number; cgst: number; sgst: number; igst: number; cess: number
        total_invoice_value: number; invoice_count: number
      }]>`
        SELECT
          COALESCE(SUM("taxableAmt"),0)::float   AS taxable_amt,
          COALESCE(SUM("cgstTotal"),0)::float    AS cgst,
          COALESCE(SUM("sgstTotal"),0)::float    AS sgst,
          COALESCE(SUM("igstTotal"),0)::float    AS igst,
          COALESCE(SUM("cessTotal"),0)::float    AS cess,
          COALESCE(SUM("grandTotal"),0)::float   AS total_invoice_value,
          COUNT(*)::int                          AS invoice_count
        FROM invoices
        WHERE "branchId" = ${branchId}::uuid
          AND "txnType"  = 'sale_invoice'
          AND "date"    >= ${from}::date
          AND "date"    <= ${to}::date
          AND status   != 'draft'
      `,

      // HSN-wise summary (GSTR-1 Table 12)
      db.$queryRaw<Array<{
        hsn: string; description: string; uqc: string
        qty: number; taxable_value: number; cgst: number; sgst: number; igst: number
      }>>`
        SELECT
          COALESCE(ii."hsnSacCode", p."hsnSacCode", 'NA')  AS hsn,
          MIN(ii.description)                               AS description,
          MIN(ii.unit)                                      AS uqc,
          SUM(ii.qty)::float                                AS qty,
          COALESCE(SUM(ii."taxableAmt"),0)::float           AS taxable_value,
          COALESCE(SUM(ii."cgstAmt"),0)::float              AS cgst,
          COALESCE(SUM(ii."sgstAmt"),0)::float              AS sgst,
          COALESCE(SUM(ii."igstAmt"),0)::float              AS igst
        FROM invoice_items ii
        LEFT JOIN products p ON p.id = ii."productId"
        JOIN invoices i ON i.id = ii."invoiceId"
        WHERE i."branchId" = ${branchId}::uuid
          AND i."txnType"  = 'sale_invoice'
          AND i."date"    >= ${from}::date
          AND i."date"    <= ${to}::date
          AND i.status   != 'draft'
        GROUP BY COALESCE(ii."hsnSacCode", p."hsnSacCode", 'NA')
        ORDER BY taxable_value DESC
      `,

      // B2B (party has GSTIN) vs B2C breakdown
      db.$queryRaw<Array<{ type: string; count: number; taxable: number; tax: number }>>`
        SELECT
          CASE WHEN p.gstin IS NOT NULL AND p.gstin != '' THEN 'B2B' ELSE 'B2C' END AS type,
          COUNT(*)::int                                                  AS count,
          COALESCE(SUM(i."taxableAmt"),0)::float                        AS taxable,
          COALESCE(SUM(i."cgstTotal" + i."sgstTotal" + i."igstTotal"),0)::float AS tax
        FROM invoices i
        LEFT JOIN parties p ON p.id = i."partyId"
        WHERE i."branchId" = ${branchId}::uuid AND i."txnType" = 'sale_invoice'
          AND i."date" >= ${from}::date AND i."date" <= ${to}::date AND i.status != 'draft'
        GROUP BY (CASE WHEN p.gstin IS NOT NULL AND p.gstin != '' THEN 'B2B' ELSE 'B2C' END)
      `,

      // GST rate-wise breakup
      db.$queryRaw<Array<{ gst_rate: number; taxable_value: number; tax_amount: number }>>`
        SELECT
          ii."gstRate"::float                               AS gst_rate,
          COALESCE(SUM(ii."taxableAmt"),0)::float           AS taxable_value,
          COALESCE(SUM(ii."cgstAmt" + ii."sgstAmt" + ii."igstAmt"),0)::float AS tax_amount
        FROM invoice_items ii
        JOIN invoices i ON i.id = ii."invoiceId"
        WHERE i."branchId" = ${branchId}::uuid AND i."txnType" = 'sale_invoice'
          AND i."date" >= ${from}::date AND i."date" <= ${to}::date AND i.status != 'draft'
        GROUP BY ii."gstRate"
        ORDER BY ii."gstRate"
      `,
    ])

    return {
      month:   q.month,
      from,
      to,
      summary: gstTotals[0],
      b2b_vs_b2c:  b2bVsB2c,
      rate_wise:   rateWise,
      hsn_summary: hsnSummary,
    }
    }) // end getOrSet
    return reply.send(result)
  })

  // ── GET /api/analytics/payment-methods?period=7d|30d|90d ─────────────────
  app.get('/payment-methods', async (req, reply) => {
    const q = z.object({
      period: z.enum(['7d', '30d', '90d']).default('30d'),
    }).parse(req.query)

    const key = cacheKey(req.schemaName, req.branchId, 'pay', q.period)
    const result = await getOrSet(key, 300, async () => {
    const days     = periodDays(q.period)
    const now      = new Date()
    const { from } = dateRange(days, now)
    const fromStr  = iso(from)
    const toStr    = iso(now)
    const branchId = req.branchId
    const db       = req.db

    const [byMethod, daily, cashVsDigital] = await Promise.all([
      db.$queryRaw<Array<{ method: string; amount: number; count: number }>>`
        SELECT method,
               COALESCE(SUM(amount),0)::float AS amount,
               COUNT(*)::int AS count
        FROM payments WHERE "branchId" = ${branchId}::uuid
          AND "paymentDate" >= ${fromStr}::date AND "paymentDate" <= ${toStr}::date
        GROUP BY method ORDER BY amount DESC
      `,
      db.$queryRaw<Array<{ day: string; cash: number; digital: number }>>`
        SELECT "paymentDate"::text AS day,
               COALESCE(SUM(amount) FILTER (WHERE method = 'cash'),0)::float    AS cash,
               COALESCE(SUM(amount) FILTER (WHERE method != 'cash'),0)::float   AS digital
        FROM payments WHERE "branchId" = ${branchId}::uuid
          AND "paymentDate" >= ${fromStr}::date AND "paymentDate" <= ${toStr}::date
        GROUP BY "paymentDate" ORDER BY day ASC
      `,
      db.$queryRaw<[{ cash: number; digital: number; total: number }]>`
        SELECT
          COALESCE(SUM(amount) FILTER (WHERE method = 'cash'),0)::float    AS cash,
          COALESCE(SUM(amount) FILTER (WHERE method != 'cash'),0)::float   AS digital,
          COALESCE(SUM(amount),0)::float                                    AS total
        FROM payments WHERE "branchId" = ${branchId}::uuid
          AND "paymentDate" >= ${fromStr}::date AND "paymentDate" <= ${toStr}::date
      `,
    ])

    const cv = cashVsDigital[0]!
    const digitalPct = cv.total > 0 ? Math.round(cv.digital / cv.total * 100) : 0

    return {
      period: q.period, from: fromStr, to: toStr,
      summary: { ...cv, digital_pct: digitalPct },
      by_method: byMethod,
      daily_cash_vs_digital: daily,
    }
    }) // end getOrSet
    return reply.send(result)
  })

  // ── GET /api/analytics/revenue-trend ──────────────────────────────────────
  app.get('/revenue-trend', async (req, reply) => {
    const q = z.object({
      period:  z.enum(['7d', '30d', '90d']).default('30d'),
      groupBy: z.enum(['day', 'week', 'month']).default('day'),
    }).parse(req.query)

    const key = cacheKey(req.schemaName, req.branchId, 'trend', q.period, q.groupBy)
    const result = await getOrSet(key, 300, async () => {
    const days     = periodDays(q.period)
    const now      = new Date()
    const { from } = dateRange(days, now)
    const fromStr  = iso(from)
    const toStr    = iso(now)
    const branchId = req.branchId
    const db       = req.db

    // Use Prisma.raw only for the validated enum — prevents injection
    const truncFn = q.groupBy === 'month' ? Prisma.raw("'month'")
                  : q.groupBy === 'week'  ? Prisma.raw("'week'")
                  : Prisma.raw("'day'")

    const rows = await db.$queryRaw<Array<{
      period: string; revenue: number; invoices: number; collected: number
    }>>`
      SELECT
        DATE_TRUNC(${truncFn}, "date")::date::text   AS period,
        COALESCE(SUM("grandTotal"),0)::float          AS revenue,
        COUNT(*)::int                                 AS invoices,
        COALESCE(SUM("paidAmt"),0)::float             AS collected
      FROM invoices
      WHERE "branchId" = ${branchId}::uuid
        AND "txnType"  = 'sale_invoice'
        AND "date"    >= ${fromStr}::date
        AND "date"    <= ${toStr}::date
      GROUP BY DATE_TRUNC(${truncFn}, "date")
      ORDER BY period ASC
    `

    return { from: fromStr, to: toStr, groupBy: q.groupBy, rows }
    }) // end getOrSet
    return reply.send(result)
  })

  // ── GET /api/analytics/margin-report?period=7d|30d|90d ───────────────────
  app.get('/margin-report', async (req, reply) => {
    const q = z.object({
      period: z.enum(['7d', '30d', '90d']).default('30d'),
    }).parse(req.query)

    const key = cacheKey(req.schemaName, req.branchId, 'margin', q.period)
    const result = await getOrSet(key, 600, async () => {
    const days     = periodDays(q.period)
    const now      = new Date()
    const { from } = dateRange(days, now)
    const fromStr  = iso(from)
    const toStr    = iso(now)
    const branchId = req.branchId
    const db       = req.db

    const { totalRevenue, totalCOGS, marginPct, rows } =
      await grossMarginData(db, branchId, fromStr, toStr)

    // Category-wise margin (uses product category if available)
    const categoryMargin = await db.$queryRaw<Array<{
      category: string; revenue: number; cogs: number; margin_pct: number
    }>>`
      SELECT
        COALESCE(cat.name, 'Uncategorised')          AS category,
        COALESCE(SUM(ii.total),0)::float             AS revenue,
        COALESCE(SUM(ii.qty * COALESCE(p."purchasePrice",0)),0)::float AS cogs,
        CASE WHEN SUM(ii.total) > 0
          THEN ROUND(((SUM(ii.total) - SUM(ii.qty * COALESCE(p."purchasePrice",0))) / SUM(ii.total) * 100)::numeric, 1)::float
          ELSE 0
        END AS margin_pct
      FROM invoice_items ii
      JOIN products p ON p.id = ii."productId"
      LEFT JOIN categories cat ON cat.id = p."categoryId"
      JOIN invoices i ON i.id = ii."invoiceId"
      WHERE i."branchId" = ${branchId}::uuid AND i."txnType" = 'sale_invoice'
        AND i."date" >= ${fromStr}::date AND i."date" <= ${toStr}::date
        AND p."purchasePrice" IS NOT NULL AND p."purchasePrice" > 0
      GROUP BY cat.name ORDER BY revenue DESC
    `

    return {
      period: q.period, from: fromStr, to: toStr,
      summary: { totalRevenue, totalCOGS, grossProfit: totalRevenue - totalCOGS, marginPct },
      by_product:  rows,
      by_category: categoryMargin,
    }
    }) // end getOrSet
    return reply.send(result)
  })

  // ── GET /api/analytics/top-customers?period=7d|30d|90d&limit=10 ──────────
  app.get('/top-customers', async (req, reply) => {
    const q = z.object({
      period: z.enum(['7d', '30d', '90d']).default('30d'),
      limit:  z.coerce.number().int().min(1).max(50).default(10),
    }).parse(req.query)

    const key = cacheKey(req.schemaName, req.branchId, 'topcust', q.period, String(q.limit))
    const result = await getOrSet(key, 600, async () => {
    const days     = periodDays(q.period)
    const now      = new Date()
    const { from } = dateRange(days, now)
    const fromStr  = iso(from)
    const toStr    = iso(now)
    const branchId = req.branchId
    const db       = req.db

    const rows = await db.$queryRaw<Array<{
      party_id: string; name: string; phone: string
      revenue: number; invoices: number; outstanding: number
    }>>`
      SELECT p.id::text AS party_id, p.name, COALESCE(p.phone,'') AS phone,
             COALESCE(SUM(i."grandTotal"),0)::float AS revenue,
             COUNT(i.id)::int AS invoices,
             p.balance::float AS outstanding
      FROM parties p
      LEFT JOIN invoices i ON i."partyId" = p.id
        AND i."txnType" = 'sale_invoice'
        AND i."date" >= ${fromStr}::date AND i."date" <= ${toStr}::date
      WHERE p."branchId" = ${branchId}::uuid AND p.type = 'customer'
      GROUP BY p.id, p.name, p.phone, p.balance
      ORDER BY revenue DESC
      LIMIT ${q.limit}
    `

    return { from: fromStr, to: toStr, customers: rows }
    }) // end getOrSet
    return reply.send(result)
  })

  // ── GET /api/analytics/sales-vs-purchases?months=6 ───────────────────────
  app.get('/sales-vs-purchases', async (req, reply) => {
    const q = z.object({
      months: z.coerce.number().int().min(1).max(12).default(6),
    }).parse(req.query)

    const key = cacheKey(req.schemaName, req.branchId, 'svsp', String(q.months))
    const result = await getOrSet(key, 600, async () => {
    const branchId = req.branchId
    const db = req.db
    const now = new Date()
    const fromDate = new Date(now.getFullYear(), now.getMonth() - q.months + 1, 1)
    const fromStr = iso(fromDate)
    const toStr   = iso(now)

    const salesByMonth = await db.$queryRaw<Array<{ month: string; revenue: number; invoices: number }>>`
      SELECT TO_CHAR(DATE_TRUNC('month', "date"), 'YYYY-MM') AS month,
             COALESCE(SUM("grandTotal"), 0)::float AS revenue,
             COUNT(*)::int AS invoices
      FROM invoices
      WHERE "branchId" = ${branchId}::uuid AND "txnType" = 'sale_invoice'
        AND "date" >= ${fromStr}::date AND "date" <= ${toStr}::date
        AND status != 'cancelled'
      GROUP BY DATE_TRUNC('month', "date") ORDER BY month ASC
    `.catch((e: any) => { req.log.error({ err: e.message }, 'sales-vs-purchases: sales query failed'); return [] })

    const purchasesByMonth = await db.$queryRaw<Array<{ month: string; amount: number }>>`
      SELECT TO_CHAR(DATE_TRUNC('month', "poDate"), 'YYYY-MM') AS month,
             COALESCE(SUM("grandTotal"), 0)::float AS amount
      FROM purchase_orders
      WHERE "branchId" = ${branchId}::uuid
        AND "poDate" >= ${fromStr}::date AND "poDate" <= ${toStr}::date AND status != 'cancelled'
      GROUP BY DATE_TRUNC('month', "poDate") ORDER BY month ASC
    `.catch((e: any) => { req.log.error({ err: e.message }, 'sales-vs-purchases: purchases query failed'); return [] })

    const expensesByMonth = await db.$queryRaw<Array<{ month: string; amount: number }>>`
      SELECT TO_CHAR(DATE_TRUNC('month', "date"), 'YYYY-MM') AS month,
             COALESCE(SUM(amount), 0)::float AS amount
      FROM expenses
      WHERE "branchId" = ${branchId}::uuid
        AND "date" >= ${fromStr}::date AND "date" <= ${toStr}::date
      GROUP BY DATE_TRUNC('month', "date") ORDER BY month ASC
    `.catch((e: any) => { req.log.error({ err: e.message }, 'sales-vs-purchases: expenses query failed'); return [] })

    // Build full month list (fill gaps with 0)
    const months: string[] = []
    for (let i = 0; i < q.months; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - q.months + 1 + i, 1)
      months.push(iso(d).slice(0, 7))
    }
    const sMap = new Map(salesByMonth.map(r => [r.month, r]))
    const pMap = new Map(purchasesByMonth.map(r => [r.month, r]))
    const eMap = new Map(expensesByMonth.map(r => [r.month, r]))

    const rows = months.map(month => {
      const sales    = sMap.get(month)?.revenue  ?? 0
      const purchases = pMap.get(month)?.amount  ?? 0
      const expenses  = eMap.get(month)?.amount  ?? 0
      return { month, sales, purchases, expenses, profit: sales - expenses }
    })

    const totals = rows.reduce(
      (acc, r) => ({ sales: acc.sales + r.sales, purchases: acc.purchases + r.purchases, expenses: acc.expenses + r.expenses, profit: acc.profit + r.profit }),
      { sales: 0, purchases: 0, expenses: 0, profit: 0 }
    )

    return { months: q.months, from: fromStr, to: toStr, rows, totals }
    }) // end getOrSet
    return reply.send(result)
  })
}
