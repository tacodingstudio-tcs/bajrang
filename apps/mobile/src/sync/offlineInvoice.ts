// apps/mobile/src/sync/offlineInvoice.ts
//
// THE MOST IMPORTANT FILE IN THE MOBILE APP.
//
// Creates an invoice entirely offline:
//   1. Calculate GST locally (same formula as backend gst-engine)
//   2. Write to WatermelonDB (draft_invoices + draft_invoice_items)
//   3. Mark sync_status = 'pending'
//   4. Decrement local product stock_on_hand optimistically (UI feedback only —
//      the server is the source of truth once synced)
//
// CRITICAL DESIGN RULE: the cashier NEVER waits for network.
// The invoice is "created" the instant it's written to SQLite.
// The UI shows a small "syncing..." badge until the background sync
// engine successfully pushes it and receives a server-assigned number.
//
// Why local_uuid, not server number, as the primary key:
//   Two devices can create invoices simultaneously while both offline.
//   If we used sequential numbers locally, device A might create "INV-001"
//   and device B might also create "INV-001" — a collision when both sync.
//   Instead, every device generates a random UUID locally. The SERVER
//   assigns the final sequential invoice number at sync time using the
//   advisory-lock mechanism in invoice-number.ts. No collisions, ever.

import { database, draftInvoicesCollection, draftItemsCollection, productsCollection } from '../db'
import { Q } from '@nozbe/watermelondb'
import 'react-native-get-random-values'  // polyfill for crypto.randomUUID on RN
import { v4 as uuidv4 } from 'uuid'

export interface OfflineLineItemInput {
  productLocalId?: string   // WatermelonDB local id (not server_id)
  productServerId?: string
  description:      string
  qty:               number
  unit:              string
  rate:              number
  discountPct:       number
  gstRate:           number
  hsnSacCode?:       string
}

export interface CreateOfflineInvoiceInput {
  txnType:        'sale_invoice'
  partyServerId?: string
  partyName?:     string   // snapshot for display while offline
  items:          OfflineLineItemInput[]
  domainData:     Record<string, unknown>
  notes?:         string
  createdByLocal: string   // device user id (from auth store)
}

// ── GST calculation — MUST match packages/gst-engine/src/calculator.ts exactly ──
// Duplicated here intentionally: the mobile app has no network dependency,
// so it cannot import from the backend package. Any change to GST rules
// must be applied in BOTH places. A shared package (e.g. @billing/gst-engine
// published to a private npm registry or git submodule) is the long-term fix.

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

function calcLine(item: OfflineLineItemInput) {
  const gross    = round2(item.qty * item.rate)
  const discount = round2(gross * (item.discountPct / 100))
  const taxable  = round2(gross - discount)
  const gstAmt   = round2(taxable * (item.gstRate / 100))
  // Mobile always assumes intra-state (CGST+SGST) — inter-state sales
  // are rare for POS billing and can be corrected on sync if needed.
  const cgst = round2(gstAmt / 2)
  const sgst = round2(gstAmt - cgst)
  return {
    grossAmt: gross, discountAmt: discount, taxableAmt: taxable,
    cgstAmt: cgst, sgstAmt: sgst, igstAmt: 0,
    total: round2(taxable + cgst + sgst),
  }
}

// =============================================================================
// createOfflineInvoice
// =============================================================================
export async function createOfflineInvoice(
  input: CreateOfflineInvoiceInput
): Promise<{ localUuid: string }> {
  const localUuid = uuidv4()
  const now = Date.now()

  const lines = input.items.map(calcLine)
  const subtotal     = round2(lines.reduce((s, l) => s + l.grossAmt, 0))
  const discountTotal= round2(lines.reduce((s, l) => s + l.discountAmt, 0))
  const taxableTotal = round2(lines.reduce((s, l) => s + l.taxableAmt, 0))
  const cgstTotal     = round2(lines.reduce((s, l) => s + l.cgstAmt, 0))
  const sgstTotal      = round2(lines.reduce((s, l) => s + l.sgstAmt, 0))
  const beforeRound      = round2(taxableTotal + cgstTotal + sgstTotal)
  const grandTotal         = Math.round(beforeRound)
  const roundOff             = round2(grandTotal - beforeRound)

  await database.write(async () => {
    // 1. Create the draft invoice header
    await draftInvoicesCollection.create((inv) => {
      inv.localUuid          = localUuid
      inv.txnType             = input.txnType
      inv.partyServerId        = input.partyServerId
      inv.partyNameSnapshot     = input.partyName
      inv.subtotal               = subtotal
      inv.discountAmt             = discountTotal
      inv.taxableAmt                = taxableTotal
      inv.cgstTotal                   = cgstTotal
      inv.sgstTotal                     = sgstTotal
      inv.igstTotal                      = 0
      inv.roundOff                         = roundOff
      inv.grandTotal                         = grandTotal
      inv.notes                                = input.notes
      inv.domainData                             = input.domainData
      inv.createdByLocal                           = input.createdByLocal
      inv.syncStatus                                 = 'pending'
      inv.syncAttempts                                 = 0
      inv.createdAt                                      = now
    })

    // 2. Create line items
    for (const [idx, item] of input.items.entries()) {
      const calc = lines[idx]!
      await draftItemsCollection.create((li) => {
        li.invoiceLocalUuid = localUuid
        li.productServerId  = item.productServerId
        li.description       = item.description
        li.hsnSacCode          = item.hsnSacCode
        li.qty                   = item.qty
        li.unit                    = item.unit
        li.rate                      = item.rate
        li.discountPct                 = item.discountPct
        li.taxableAmt                    = calc.taxableAmt
        li.gstRate                         = item.gstRate
        li.cgstAmt                           = calc.cgstAmt
        li.sgstAmt                             = calc.sgstAmt
        li.igstAmt                               = 0
        li.total                                   = calc.total
      })

      // 3. Optimistically decrement local stock display (UI feedback only)
      if (item.productLocalId) {
        const product = await productsCollection.find(item.productLocalId)
        await product.update((p) => {
          p.stockOnHand = Math.max(0, p.stockOnHand - item.qty)
        })
      }
    }
  })

  return { localUuid }
}

// =============================================================================
// getPendingInvoices — for the "syncing" badge / queue screen
// =============================================================================
export async function getPendingInvoices() {
  return draftInvoicesCollection
    .query(Q.where('sync_status', Q.oneOf(['pending', 'syncing', 'failed'])))
    .fetch()
}

export async function getFailedInvoices() {
  return draftInvoicesCollection
    .query(Q.where('sync_status', 'failed'))
    .fetch()
}
