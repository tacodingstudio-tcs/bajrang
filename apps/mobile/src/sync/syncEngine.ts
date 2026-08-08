// apps/mobile/src/sync/syncEngine.ts
//
// The sync engine runs in two directions:
//
//   PUSH (device → server): every pending draft_invoice gets POSTed to
//   /api/invoices. On success, the local row is updated with the
//   server-assigned id and invoice number, and sync_status becomes 'synced'.
//
//   PULL (server → device): products and parties are re-fetched periodically
//   so the device has current prices, stock levels, and customer balances.
//
// Triggers:
//   - App foreground (NetInfo listener fires on connectivity change)
//   - Manual pull-to-refresh
//   - Every 30 seconds while app is active and online (safety net)
//
// Conflict handling:
//   There are NO update conflicts for invoices — they are immutable once
//   created (matching the backend's append-only design). The only failure
//   mode is a PUSH that the server rejects (e.g. insufficient stock found
//   server-side). That invoice is marked 'failed' with the server's error
//   message, and the cashier is shown a clear retry/edit option.

import NetInfo from '@react-native-community/netinfo'
import { Q } from '@nozbe/watermelondb'
import {
  database,
  draftInvoicesCollection,
  draftItemsCollection,
  productsCollection,
  partiesCollection,
} from '../db'
import { apiClient } from '../lib/apiClient'
import type { DraftInvoiceModel } from '../db/models'

let isSyncing = false
let syncIntervalHandle: ReturnType<typeof setInterval> | null = null

// =============================================================================
// pushPendingInvoices
// Sends every 'pending' or 'failed' (retry) invoice to the server.
// Processes one at a time — sequential, not parallel — to respect the
// backend's per-branch advisory lock and avoid overwhelming a slow connection.
// =============================================================================
export async function pushPendingInvoices(): Promise<{ succeeded: number; failed: number }> {
  const pending = await draftInvoicesCollection
    .query(Q.where('sync_status', Q.oneOf(['pending', 'failed'])))
    .fetch()

  let succeeded = 0
  let failed    = 0

  for (const invoice of pending) {
    const result = await pushOneInvoice(invoice)
    if (result) succeeded++; else failed++
  }

  return { succeeded, failed }
}

async function pushOneInvoice(invoice: DraftInvoiceModel): Promise<boolean> {
  // Mark as syncing so the UI shows the right state during the request
  await database.write(async () => {
    await invoice.update((inv) => { inv.syncStatus = 'syncing' })
  })

  try {
    const items = await invoice.items.fetch() as any[]

    const payload = {
      txnType:    invoice.txnType,
      partyId:    invoice.partyServerId ?? undefined,
      domainData: invoice.domainData,
      notes:      invoice.notes ?? undefined,
      // Tag every offline-created invoice so the backend ai_meta records its origin —
      // useful for support debugging ("why does this invoice show old prices?")
      aiMeta: { source: 'mobile_offline', localUuid: invoice.localUuid, createdAt: invoice.createdAt },
      items: items.map((item) => ({
        productId:   item.productServerId ?? undefined,
        description: item.description,
        qty:         item.qty,
        unit:        item.unit,
        rate:        item.rate,
        discountPct: item.discountPct,
        gstRate:     item.gstRate,
        hsnSacCode:  item.hsnSacCode ?? undefined,
      })),
    }

    const response = await apiClient.post('/invoices', payload, {
      headers: {
        // Use the invoice's local UUID as the idempotency key. This is
        // generated once when the invoice is created offline (see
        // offlineInvoice.ts) and never changes — so retrying a sync push
        // after a timeout, a dropped connection, or an app restart mid-sync
        // always reuses the SAME key. The server returns the original
        // invoice instead of creating a duplicate, even if the first push
        // actually succeeded but the response never reached this device.
        'Idempotency-Key': invoice.localUuid,
      },
    })
    const serverInvoice = response.data

    // Success — update local record with server-assigned data
    await database.write(async () => {
      await invoice.update((inv) => {
        inv.serverId      = serverInvoice.id
        inv.serverNumber  = serverInvoice.number
        inv.syncStatus    = 'synced'
        inv.syncError     = undefined
      })
    })

    return true
  } catch (err: any) {
    const errorMessage =
      err.response?.data?.error ??
      err.response?.data?.message ??
      err.message ??
      'Unknown sync error'

    await database.write(async () => {
      await invoice.update((inv) => {
        inv.syncStatus    = 'failed'
        inv.syncError     = errorMessage
        inv.syncAttempts  = (inv.syncAttempts ?? 0) + 1
      })
    })

    console.warn(`[Sync] Invoice ${invoice.localUuid} failed:`, errorMessage)
    return false
  }
}

// =============================================================================
// pullProducts / pullParties
// Refreshes the local read-only mirror tables from the server.
// Uses a simple "replace if updated_at is newer" strategy — products and
// parties are small enough datasets (a few thousand rows max) to fully
// re-sync rather than implementing incremental diffing.
// =============================================================================
export async function pullProducts(): Promise<number> {
  const response = await apiClient.get('/products', { params: { limit: 1000 } })
  const products = response.data.data as any[]

  await database.write(async () => {
    for (const p of products) {
      const existing = await productsCollection
        .query(Q.where('server_id', p.id))
        .fetch()

      if (existing.length > 0) {
        await existing[0]!.update((local) => {
          local.name          = p.name
          local.nameLocal      = p.nameLocal
          local.barcode          = p.barcode
          local.sku                = p.sku
          local.hsnSacCode           = p.hsnSacCode
          local.gstRate                 = Number(p.gstRate)
          local.unit                      = p.unit
          local.salePrice                   = Number(p.salePrice)
          local.mrp                           = p.mrp ? Number(p.mrp) : undefined
          local.trackStock                      = p.trackStock
          local.stockOnHand                       = p.stockOnHand ?? 0
          local.domainAttrs                         = p.domainAttrs ?? {}
          local.updatedAt                             = Date.now()
        })
      } else {
        await productsCollection.create((local) => {
          local.serverId   = p.id
          local.name        = p.name
          local.nameLocal     = p.nameLocal
          local.barcode          = p.barcode
          local.sku                = p.sku
          local.hsnSacCode           = p.hsnSacCode
          local.gstRate                 = Number(p.gstRate)
          local.unit                      = p.unit
          local.salePrice                   = Number(p.salePrice)
          local.mrp                           = p.mrp ? Number(p.mrp) : undefined
          local.trackStock                      = p.trackStock
          local.stockOnHand                       = p.stockOnHand ?? 0
          local.domainAttrs                         = p.domainAttrs ?? {}
          local.updatedAt                             = Date.now()
        })
      }
    }
  })

  return products.length
}

export async function pullParties(): Promise<number> {
  const response = await apiClient.get('/parties', { params: { limit: 1000 } })
  const parties = response.data.data as any[]

  await database.write(async () => {
    for (const p of parties) {
      const existing = await partiesCollection
        .query(Q.where('server_id', p.id))
        .fetch()

      if (existing.length > 0) {
        await existing[0]!.update((local) => {
          local.type      = p.type
          local.name        = p.name
          local.phone         = p.phone
          local.balance          = Number(p.balance)
          local.updatedAt          = Date.now()
        })
      } else {
        await partiesCollection.create((local) => {
          local.serverId  = p.id
          local.type        = p.type
          local.name           = p.name
          local.phone             = p.phone
          local.balance              = Number(p.balance)
          local.updatedAt              = Date.now()
        })
      }
    }
  })

  return parties.length
}

// =============================================================================
// runFullSync — the main entry point called by the app
// =============================================================================
export interface SyncResult {
  pushedSucceeded: number
  pushedFailed:    number
  productsCount:   number
  partiesCount:    number
  ranAt:           number
}

export async function runFullSync(): Promise<SyncResult | null> {
  if (isSyncing) {
    console.log('[Sync] Already syncing — skipping')
    return null
  }

  const netState = await NetInfo.fetch()
  if (!netState.isConnected) {
    console.log('[Sync] No network — skipping')
    return null
  }

  isSyncing = true
  try {
    const { succeeded, failed } = await pushPendingInvoices()
    const productsCount = await pullProducts()
    const partiesCount  = await pullParties()

    return {
      pushedSucceeded: succeeded,
      pushedFailed:    failed,
      productsCount,
      partiesCount,
      ranAt: Date.now(),
    }
  } finally {
    isSyncing = false
  }
}

// =============================================================================
// Lifecycle: start/stop background sync
// =============================================================================
export function startBackgroundSync(intervalMs = 30_000) {
  // Run immediately on start
  runFullSync().catch((err) => console.warn('[Sync] Initial sync failed:', err))

  // Re-run whenever connectivity is restored
  const unsubscribe = NetInfo.addEventListener((state) => {
    if (state.isConnected) {
      runFullSync().catch((err) => console.warn('[Sync] Reconnect sync failed:', err))
    }
  })

  // Periodic safety-net sync while app is foregrounded
  syncIntervalHandle = setInterval(() => {
    runFullSync().catch((err) => console.warn('[Sync] Periodic sync failed:', err))
  }, intervalMs)

  return () => {
    unsubscribe()
    if (syncIntervalHandle) clearInterval(syncIntervalHandle)
  }
}
