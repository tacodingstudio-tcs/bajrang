// apps/mobile/src/db/schema.ts
//
// WatermelonDB schema — defines the local SQLite tables on the device.
// This is intentionally a SUBSET of the backend schema: only what's needed
// for offline billing. Reports, analytics, and admin features always
// require network and read directly from the API.
//
// Key design decision: every local row has a `server_id` (nullable) and
// `_status` field. `server_id` is null until the row syncs to the backend
// and gets a real UUID assigned. `_status` is managed automatically by
// WatermelonDB's sync protocol (created/updated/synced/deleted).

import { appSchema, tableSchema } from '@nozbe/watermelondb'

export const schema = appSchema({
  version: 1,
  tables: [

    // ── products — synced FROM server, read-only on device ─────────────────
    // Products are managed on the web dashboard. Mobile only reads them.
    // Synced down periodically (every app open + manual pull-to-refresh).
    tableSchema({
      name: 'products',
      columns: [
        { name: 'server_id',     type: 'string', isIndexed: true },
        { name: 'name',          type: 'string' },
        { name: 'name_local',    type: 'string', isOptional: true },
        { name: 'barcode',       type: 'string', isOptional: true, isIndexed: true },
        { name: 'sku',           type: 'string', isOptional: true },
        { name: 'hsn_sac_code',  type: 'string', isOptional: true },
        { name: 'gst_rate',      type: 'number' },
        { name: 'unit',          type: 'string' },
        { name: 'sale_price',    type: 'number' },
        { name: 'mrp',           type: 'number', isOptional: true },
        { name: 'track_stock',   type: 'boolean' },
        { name: 'stock_on_hand', type: 'number' },          // last known — refreshed on sync
        { name: 'domain_attrs',  type: 'string' },           // JSON string
        { name: 'updated_at',    type: 'number' },
      ],
    }),

    // ── parties — synced FROM server, read-only on device ───────────────────
    tableSchema({
      name: 'parties',
      columns: [
        { name: 'server_id', type: 'string', isIndexed: true },
        { name: 'type',      type: 'string' },
        { name: 'name',      type: 'string', isIndexed: true },
        { name: 'phone',     type: 'string', isOptional: true, isIndexed: true },
        { name: 'balance',   type: 'number' },
        { name: 'updated_at',type: 'number' },
      ],
    }),

    // ── draft_invoices — created OFFLINE, pushed TO server ──────────────────
    // This is the core offline-write table. Every invoice starts here.
    // sync_status: 'pending' | 'syncing' | 'synced' | 'failed'
    tableSchema({
      name: 'draft_invoices',
      columns: [
        { name: 'local_uuid',     type: 'string', isIndexed: true },  // client-generated, permanent local key
        { name: 'server_id',      type: 'string', isOptional: true, isIndexed: true }, // set after sync
        { name: 'server_number',  type: 'string', isOptional: true }, // "INV-25-00142" — set after sync
        { name: 'txn_type',       type: 'string' },
        { name: 'party_server_id',type: 'string', isOptional: true },
        { name: 'party_name_snapshot', type: 'string', isOptional: true }, // for offline display
        { name: 'subtotal',       type: 'number' },
        { name: 'discount_amt',   type: 'number' },
        { name: 'taxable_amt',    type: 'number' },
        { name: 'cgst_total',     type: 'number' },
        { name: 'sgst_total',     type: 'number' },
        { name: 'igst_total',     type: 'number' },
        { name: 'round_off',      type: 'number' },
        { name: 'grand_total',    type: 'number' },
        { name: 'notes',          type: 'string', isOptional: true },
        { name: 'domain_data',    type: 'string' },   // JSON string
        { name: 'created_by_local', type: 'string' }, // device user id at creation time
        { name: 'sync_status',    type: 'string', isIndexed: true }, // pending|syncing|synced|failed
        { name: 'sync_error',     type: 'string', isOptional: true },
        { name: 'sync_attempts',  type: 'number' },
        { name: 'created_at',     type: 'number' },
      ],
    }),

    // ── draft_invoice_items — line items for offline invoices ───────────────
    tableSchema({
      name: 'draft_invoice_items',
      columns: [
        { name: 'invoice_local_uuid', type: 'string', isIndexed: true },
        { name: 'product_server_id',  type: 'string', isOptional: true },
        { name: 'description',        type: 'string' },
        { name: 'hsn_sac_code',       type: 'string', isOptional: true },
        { name: 'qty',                type: 'number' },
        { name: 'unit',               type: 'string' },
        { name: 'rate',               type: 'number' },
        { name: 'discount_pct',       type: 'number' },
        { name: 'taxable_amt',        type: 'number' },
        { name: 'gst_rate',           type: 'number' },
        { name: 'cgst_amt',           type: 'number' },
        { name: 'sgst_amt',           type: 'number' },
        { name: 'igst_amt',           type: 'number' },
        { name: 'total',              type: 'number' },
      ],
    }),

    // ── sync_queue — generic outbox for any offline mutation ────────────────
    // Used for things beyond invoices: stock adjustments, payment records.
    // Each row is one pending API call to replay when connectivity returns.
    tableSchema({
      name: 'sync_queue',
      columns: [
        { name: 'entity_type',  type: 'string' },       // 'invoice' | 'payment' | 'stock_adjustment'
        { name: 'entity_local_id', type: 'string' },
        { name: 'method',       type: 'string' },        // 'POST' | 'PATCH'
        { name: 'endpoint',     type: 'string' },
        { name: 'payload',      type: 'string' },         // JSON string
        { name: 'status',       type: 'string', isIndexed: true }, // pending|syncing|done|failed
        { name: 'attempts',     type: 'number' },
        { name: 'last_error',   type: 'string', isOptional: true },
        { name: 'created_at',   type: 'number' },
      ],
    }),

  ],
})
