// apps/mobile/src/db/index.ts
// Initializes the WatermelonDB database with SQLite adapter.
// Import `database` anywhere you need to read/write local data.

import { Database } from '@nozbe/watermelondb'
import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite'
import { schema } from './schema'
import {
  ProductModel,
  PartyModel,
  DraftInvoiceModel,
  DraftInvoiceItemModel,
  SyncQueueModel,
} from './models'

const adapter = new SQLiteAdapter({
  schema,
  // dbName defaults to a sensible per-app name.
  // jsi: true uses the faster JSI bridge (React Native 0.74+ supports this).
  jsi: true,
  onSetUpError: (error) => {
    // This is critical — if local DB fails to initialize, billing cannot work.
    // In production: send to crash reporting (Sentry) and show a clear error screen.
    console.error('[WatermelonDB] Setup failed:', error)
  },
})

export const database = new Database({
  adapter,
  modelClasses: [
    ProductModel,
    PartyModel,
    DraftInvoiceModel,
    DraftInvoiceItemModel,
    SyncQueueModel,
  ],
})

// Convenience collection accessors
export const productsCollection      = database.get<ProductModel>('products')
export const partiesCollection       = database.get<PartyModel>('parties')
export const draftInvoicesCollection = database.get<DraftInvoiceModel>('draft_invoices')
export const draftItemsCollection    = database.get<DraftInvoiceItemModel>('draft_invoice_items')
export const syncQueueCollection     = database.get<SyncQueueModel>('sync_queue')
