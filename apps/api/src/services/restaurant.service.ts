// apps/api/src/services/restaurant.service.ts
// All restaurant operations: table management, KOT firing, bill aggregation.
// Tables live in the tenant schema — accessed via $queryRawUnsafe with
// schema-qualified names, matching the hotel.ts pattern.

import { z } from 'zod'

export interface RestaurantCtx {
  db:         any       // tenant PrismaClient
  branchId:   string
  userId:     string
  role:       string
  schemaName: string
}

function tbl(schemaName: string, table: string) {
  return `"${schemaName}"."${table}"`
}

// ── Schemas ───────────────────────────────────────────────────────────────────

export const KOTItemSchema = z.object({
  productId:   z.string().uuid().optional(),
  description: z.string().min(1).max(200),
  qty:         z.number().positive(),
  rate:        z.number().nonnegative(),
  notes:       z.string().max(200).optional(),
  modifiers:   z.array(z.object({
    name:  z.string(),
    price: z.number(),
  })).default([]),
  station:     z.string().optional(),
  portion:     z.string().optional(),
})
export type KOTItem = z.infer<typeof KOTItemSchema>

// ── KOT number generator ──────────────────────────────────────────────────────

async function nextKotNo(db: any, schemaName: string, branchId: string): Promise<string> {
  const rows = await db.$queryRawUnsafe<[{ n: bigint }]>(
    `SELECT COUNT(*)::int AS n FROM ${tbl(schemaName,'kot_orders')}
     WHERE "branchId" = $1::uuid AND DATE("createdAt") = CURRENT_DATE`,
    branchId,
  )
  const seq = Number(rows[0]?.n ?? 0) + 1
  const dd  = new Date().toLocaleDateString('en-IN', { day:'2-digit', month:'2-digit' }).replace('/','')
  return `KOT-${dd}-${String(seq).padStart(3,'0')}`
}

// ── Lazy schema migration ────────────────────────────────────────────────────
// Ensures both restaurant extension tables exist in the tenant schema.
// Uses IF NOT EXISTS — safe to call on every listTables request.
async function ensureTables(ctx: RestaurantCtx) {
  const S = ctx.schemaName
  await ctx.db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "${S}"."restaurant_tables" (
      "id"               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      "branchId"         UUID        NOT NULL,
      "tableNo"          TEXT        NOT NULL,
      "capacity"         INTEGER     NOT NULL DEFAULT 4,
      "section"          TEXT,
      "status"           TEXT        NOT NULL DEFAULT 'available'
                                       CHECK (status IN ('available','occupied','reserved','cleaning')),
      "currentInvoiceId" UUID,
      "openedAt"         TIMESTAMPTZ,
      "guestCount"       INTEGER     NOT NULL DEFAULT 0,
      "notes"            TEXT,
      "isActive"         BOOLEAN     DEFAULT true,
      "createdAt"        TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE ("branchId", "tableNo")
    )
  `)
  await ctx.db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "${S}"."kot_orders" (
      "id"        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      "branchId"  UUID        NOT NULL,
      "tableId"   UUID,
      "invoiceId" UUID,
      "kotNo"     TEXT        NOT NULL,
      "station"   TEXT        NOT NULL DEFAULT 'hot_kitchen',
      "status"    TEXT        NOT NULL DEFAULT 'pending'
                                CHECK (status IN ('pending','acknowledged','preparing','ready','served','cancelled')),
      "notes"     TEXT,
      "items"     JSONB       NOT NULL DEFAULT '[]',
      "servedAt"  TIMESTAMPTZ,
      "createdAt" TIMESTAMPTZ DEFAULT NOW(),
      "updatedAt" TIMESTAMPTZ DEFAULT NOW()
    )
  `)
}

// ── Table CRUD ────────────────────────────────────────────────────────────────

export async function listTables(ctx: RestaurantCtx) {
  await ensureTables(ctx)
  return ctx.db.$queryRawUnsafe<any[]>(
    `SELECT * FROM ${tbl(ctx.schemaName,'restaurant_tables')}
     WHERE "branchId" = $1::uuid AND "isActive" = true
     ORDER BY section NULLS LAST, "tableNo"`,
    ctx.branchId,
  )
}

export async function createTable(
  input: { tableNo: string; capacity: number; section?: string; notes?: string },
  ctx: RestaurantCtx,
) {
  const rows = await ctx.db.$queryRawUnsafe<any[]>(
    `INSERT INTO ${tbl(ctx.schemaName,'restaurant_tables')}
       ("branchId","tableNo","capacity","section","notes")
     VALUES ($1::uuid,$2,$3,$4,$5)
     RETURNING *`,
    ctx.branchId, input.tableNo, input.capacity, input.section ?? null, input.notes ?? null,
  )
  return rows[0]
}

export async function updateTable(
  id: string,
  input: { tableNo?: string; capacity?: number; section?: string; notes?: string; isActive?: boolean },
  ctx: RestaurantCtx,
) {
  const current = await getTable(id, ctx)
  if (!current) throw Object.assign(new Error('Table not found'), { statusCode: 404 })
  const rows = await ctx.db.$queryRawUnsafe<any[]>(
    `UPDATE ${tbl(ctx.schemaName,'restaurant_tables')}
     SET "tableNo"  = $3,
         "capacity" = $4,
         "section"  = $5,
         "notes"    = $6,
         "isActive" = $7
     WHERE id = $1::uuid AND "branchId" = $2::uuid
     RETURNING *`,
    id, ctx.branchId,
    input.tableNo  ?? current.tableNo,
    input.capacity ?? current.capacity,
    input.section  ?? current.section,
    input.notes    ?? current.notes,
    input.isActive ?? current.isActive,
  )
  return rows[0]
}

async function getTable(id: string, ctx: RestaurantCtx) {
  const rows = await ctx.db.$queryRawUnsafe<any[]>(
    `SELECT * FROM ${tbl(ctx.schemaName,'restaurant_tables')}
     WHERE id = $1::uuid AND "branchId" = $2::uuid`,
    id, ctx.branchId,
  )
  return rows[0] ?? null
}

// ── Table state machine ────────────────────────────────────────────────────────

export async function openTable(
  id: string,
  guestCount: number,
  ctx: RestaurantCtx,
) {
  const table = await getTable(id, ctx)
  if (!table) throw Object.assign(new Error('Table not found'), { statusCode: 404 })
  if (table.status === 'occupied')
    throw Object.assign(new Error(`Table ${table.tableNo} is already occupied`), { statusCode: 409 })

  const rows = await ctx.db.$queryRawUnsafe<any[]>(
    `UPDATE ${tbl(ctx.schemaName,'restaurant_tables')}
     SET status = 'occupied', "guestCount" = $3, "openedAt" = NOW()
     WHERE id = $1::uuid AND "branchId" = $2::uuid
     RETURNING *`,
    id, ctx.branchId, guestCount,
  )
  return rows[0]
}

export async function freeTable(id: string, ctx: RestaurantCtx) {
  const rows = await ctx.db.$queryRawUnsafe<any[]>(
    `UPDATE ${tbl(ctx.schemaName,'restaurant_tables')}
     SET status = 'available', "guestCount" = 0, "openedAt" = NULL, "currentInvoiceId" = NULL
     WHERE id = $1::uuid AND "branchId" = $2::uuid
     RETURNING *`,
    id, ctx.branchId,
  )
  return rows[0]
}

export async function setTableStatus(
  id: string,
  status: 'available' | 'reserved' | 'cleaning',
  ctx: RestaurantCtx,
) {
  const table = await getTable(id, ctx)
  if (!table) throw Object.assign(new Error('Table not found'), { statusCode: 404 })
  if (table.status === 'occupied' && status !== 'cleaning')
    throw Object.assign(new Error('Cannot change status of occupied table — free it first'), { statusCode: 409 })

  const rows = await ctx.db.$queryRawUnsafe<any[]>(
    `UPDATE ${tbl(ctx.schemaName,'restaurant_tables')}
     SET status = $3
     WHERE id = $1::uuid AND "branchId" = $2::uuid
     RETURNING *`,
    id, ctx.branchId, status,
  )
  return rows[0]
}

export async function transferTable(
  fromId: string,
  toId: string,
  ctx: RestaurantCtx,
) {
  const [from, to] = await Promise.all([getTable(fromId, ctx), getTable(toId, ctx)])
  if (!from) throw Object.assign(new Error('Source table not found'), { statusCode: 404 })
  if (!to)   throw Object.assign(new Error('Target table not found'), { statusCode: 404 })
  if (from.status !== 'occupied')   throw Object.assign(new Error('Source table is not occupied'), { statusCode: 422 })
  if (to.status   !== 'available')  throw Object.assign(new Error('Target table is not available'), { statusCode: 409 })

  // Move all open KOTs
  await ctx.db.$queryRawUnsafe(
    `UPDATE ${tbl(ctx.schemaName,'kot_orders')}
     SET "tableId" = $2::uuid
     WHERE "tableId" = $1::uuid AND "branchId" = $3::uuid
       AND status NOT IN ('served','cancelled')`,
    fromId, toId, ctx.branchId,
  )
  // Copy guest info to destination, clear source
  await ctx.db.$queryRawUnsafe(
    `UPDATE ${tbl(ctx.schemaName,'restaurant_tables')}
     SET status = 'occupied', "guestCount" = $3, "openedAt" = $4, "currentInvoiceId" = $5
     WHERE id = $2::uuid AND "branchId" = $1::uuid`,
    ctx.branchId, toId, from.guestCount, from.openedAt, from.currentInvoiceId,
  )
  await ctx.db.$queryRawUnsafe(
    `UPDATE ${tbl(ctx.schemaName,'restaurant_tables')}
     SET status = 'available', "guestCount" = 0, "openedAt" = NULL, "currentInvoiceId" = NULL
     WHERE id = $2::uuid AND "branchId" = $1::uuid`,
    ctx.branchId, fromId,
  )
  return { transferred: true, from: from.tableNo, to: to.tableNo }
}

// ── KOT operations ────────────────────────────────────────────────────────────

export async function fireKOT(
  input: { tableId: string; items: KOTItem[]; notes?: string; station?: string },
  ctx: RestaurantCtx,
) {
  const validItems = input.items.map(i => KOTItemSchema.parse(i))

  // Group items by station so hot kitchen and bar get separate slips
  const stationGroups = new Map<string, KOTItem[]>()
  for (const item of validItems) {
    const station = item.station ?? input.station ?? 'hot_kitchen'
    const grp = stationGroups.get(station) ?? []
    grp.push(item)
    stationGroups.set(station, grp)
  }

  const created: any[] = []
  for (const [station, items] of stationGroups) {
    const kotNo = await nextKotNo(ctx.db, ctx.schemaName, ctx.branchId)
    const rows = await ctx.db.$queryRawUnsafe<any[]>(
      `INSERT INTO ${tbl(ctx.schemaName,'kot_orders')}
         ("branchId","tableId","kotNo","station","notes","items")
       VALUES ($1::uuid,$2::uuid,$3,$4,$5,$6::jsonb)
       RETURNING *`,
      ctx.branchId, input.tableId, kotNo, station, input.notes ?? null, JSON.stringify(items),
    )
    created.push(rows[0])
  }
  return created
}

export async function getKOT(id: string, ctx: RestaurantCtx) {
  const rows = await ctx.db.$queryRawUnsafe<any[]>(
    `SELECT * FROM ${tbl(ctx.schemaName,'kot_orders')}
     WHERE id = $1::uuid AND "branchId" = $2::uuid`,
    id, ctx.branchId,
  )
  return rows[0] ?? null
}

export async function updateKOTStatus(
  id: string,
  status: 'acknowledged' | 'preparing' | 'ready' | 'served' | 'cancelled',
  ctx: RestaurantCtx,
) {
  const kot = await getKOT(id, ctx)
  if (!kot) throw Object.assign(new Error('KOT not found'), { statusCode: 404 })
  if (kot.status === 'cancelled') throw Object.assign(new Error('KOT already cancelled'), { statusCode: 409 })
  if (kot.status === 'served')    throw Object.assign(new Error('KOT already served'),    { statusCode: 409 })

  const rows = await ctx.db.$queryRawUnsafe<any[]>(
    `UPDATE ${tbl(ctx.schemaName,'kot_orders')}
     SET status = $3,
         "servedAt"  = CASE WHEN $3 = 'served' THEN NOW() ELSE "servedAt" END,
         "updatedAt" = NOW()
     WHERE id = $1::uuid AND "branchId" = $2::uuid
     RETURNING *`,
    id, ctx.branchId, status,
  )
  return rows[0]
}

export async function cancelKOTItem(
  kotId: string,
  itemIndex: number,
  reason: string,
  ctx: RestaurantCtx,
) {
  const kot = await getKOT(kotId, ctx)
  if (!kot) throw Object.assign(new Error('KOT not found'), { statusCode: 404 })
  if (kot.status === 'served') throw Object.assign(new Error('Cannot modify a served KOT'), { statusCode: 409 })

  const items = Array.isArray(kot.items) ? kot.items : JSON.parse(kot.items)
  if (itemIndex < 0 || itemIndex >= items.length)
    throw Object.assign(new Error('Item index out of range'), { statusCode: 422 })

  items[itemIndex] = { ...items[itemIndex], cancelled: true, cancelReason: reason }

  const allCancelled = items.every((i: any) => i.cancelled)
  const rows = await ctx.db.$queryRawUnsafe<any[]>(
    `UPDATE ${tbl(ctx.schemaName,'kot_orders')}
     SET items = $3::jsonb,
         status = CASE WHEN $4 THEN 'cancelled' ELSE status END,
         "updatedAt" = NOW()
     WHERE id = $1::uuid AND "branchId" = $2::uuid
     RETURNING *`,
    kotId, ctx.branchId, JSON.stringify(items), allCancelled,
  )
  return rows[0]
}

// ── Bill aggregation ──────────────────────────────────────────────────────────

export async function getTableBill(tableId: string, ctx: RestaurantCtx) {
  const [tableRows, kots] = await Promise.all([
    ctx.db.$queryRawUnsafe<any[]>(
      `SELECT * FROM ${tbl(ctx.schemaName,'restaurant_tables')}
       WHERE id = $1::uuid AND "branchId" = $2::uuid`,
      tableId, ctx.branchId,
    ),
    ctx.db.$queryRawUnsafe<any[]>(
      `SELECT * FROM ${tbl(ctx.schemaName,'kot_orders')}
       WHERE "tableId" = $1::uuid AND "branchId" = $2::uuid
         AND status NOT IN ('cancelled')
       ORDER BY "createdAt" ASC`,
      tableId, ctx.branchId,
    ),
  ])

  const table = tableRows[0]
  if (!table) throw Object.assign(new Error('Table not found'), { statusCode: 404 })

  // Aggregate all KOT items — group identical description+rate lines
  const lineMap = new Map<string, {
    description: string; qty: number; rate: number
    modifiers: Array<{name:string;price:number}>; kotIds: string[]
    notes: string[]
  }>()

  for (const kot of kots) {
    const items: KOTItem[] = Array.isArray(kot.items) ? kot.items : JSON.parse(kot.items)
    for (const item of items) {
      if ((item as any).cancelled) continue
      const modTotal = item.modifiers.reduce((s, m) => s + m.price, 0)
      const key      = `${item.description}::${item.rate + modTotal}`
      const existing = lineMap.get(key)
      if (existing) {
        existing.qty += item.qty
        if (!existing.kotIds.includes(kot.id)) existing.kotIds.push(kot.id)
        if (item.notes && !existing.notes.includes(item.notes)) existing.notes.push(item.notes)
      } else {
        lineMap.set(key, {
          description: item.description,
          qty:         item.qty,
          rate:        item.rate,
          modifiers:   item.modifiers,
          kotIds:      [kot.id],
          notes:       item.notes ? [item.notes] : [],
        })
      }
    }
  }

  const lines   = [...lineMap.values()]
  const subtotal = lines.reduce((s, l) => {
    const modTotal = l.modifiers.reduce((ms, m) => ms + m.price, 0)
    return s + l.qty * (l.rate + modTotal)
  }, 0)

  return {
    table,
    kots,
    lines,
    subtotal: Math.round(subtotal * 100) / 100,
    gst:      Math.round(subtotal * 0.05 * 100) / 100,   // 5% GST dine-in default
    total:    Math.round(subtotal * 1.05 * 100) / 100,
    openedAt:   table.openedAt,
    guestCount: table.guestCount,
    minutesOpen: table.openedAt
      ? Math.floor((Date.now() - new Date(table.openedAt).getTime()) / 60000)
      : 0,
  }
}

// ── Kitchen Display System feed ───────────────────────────────────────────────

export async function getKitchenQueue(
  station: string | undefined,
  ctx: RestaurantCtx,
) {
  const rows = await ctx.db.$queryRawUnsafe<any[]>(
    `SELECT k.*, t."tableNo", t.section
     FROM ${tbl(ctx.schemaName,'kot_orders')} k
     LEFT JOIN ${tbl(ctx.schemaName,'restaurant_tables')} t ON t.id = k."tableId"
     WHERE k."branchId" = $1::uuid
       AND k.status IN ('pending','acknowledged','preparing')
       ${station ? 'AND k.station = $2' : ''}
     ORDER BY k."createdAt" ASC`,
    ...(station ? [ctx.branchId, station] : [ctx.branchId]),
  )
  return rows
}

// ── Shift report ──────────────────────────────────────────────────────────────

export async function getShiftSummary(date: string, ctx: RestaurantCtx) {
  const [kotRows, tableRows] = await Promise.all([
    ctx.db.$queryRawUnsafe<any[]>(
      `SELECT station, status, COUNT(*)::int as count
       FROM ${tbl(ctx.schemaName,'kot_orders')}
       WHERE "branchId" = $1::uuid AND DATE("createdAt") = $2::date
       GROUP BY station, status`,
      ctx.branchId, date,
    ),
    ctx.db.$queryRawUnsafe<any[]>(
      `SELECT COUNT(*)::int as total_turns,
              AVG(EXTRACT(EPOCH FROM (NOW() - "openedAt"))/60)::int as avg_turn_min
       FROM ${tbl(ctx.schemaName,'restaurant_tables')}
       WHERE "branchId" = $1::uuid AND DATE("openedAt") = $2::date`,
      ctx.branchId, date,
    ),
  ])
  return {
    date,
    kots:       kotRows,
    tableTurns: tableRows[0],
  }
}
