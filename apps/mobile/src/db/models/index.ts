// apps/mobile/src/db/models/index.ts
//
// WatermelonDB model classes. Each maps to one table in schema.ts.
// Models provide typed field access and computed properties.

import { Model } from '@nozbe/watermelondb'
import { field, text, json, readonly, date, children } from '@nozbe/watermelondb/decorators'

const sanitizeJson = (raw: unknown) => raw // pass-through, JSON.parse happens at read time

// =============================================================================
// Product — read-only mirror of server products
// =============================================================================
export class ProductModel extends Model {
  static table = 'products'

  @text('server_id')     serverId!:     string
  @text('name')          name!:         string
  @text('name_local')    nameLocal?:    string
  @text('barcode')       barcode?:      string
  @text('sku')           sku?:          string
  @text('hsn_sac_code')  hsnSacCode?:   string
  @field('gst_rate')     gstRate!:      number
  @text('unit')          unit!:         string
  @field('sale_price')   salePrice!:    number
  @field('mrp')          mrp?:          number
  @field('track_stock')  trackStock!:   boolean
  @field('stock_on_hand')stockOnHand!:  number
  @json('domain_attrs', sanitizeJson) domainAttrs!: Record<string, unknown>
  @field('updated_at')   updatedAt!:    number

  get isLowStock(): boolean {
    return this.trackStock && this.stockOnHand <= 0
  }
}

// =============================================================================
// Party — read-only mirror of server parties (customers/suppliers)
// =============================================================================
export class PartyModel extends Model {
  static table = 'parties'

  @text('server_id') serverId!:  string
  @text('type')       type!:      string
  @text('name')        name!:      string
  @text('phone')        phone?:     string
  @field('balance')      balance!:   number
  @field('updated_at')    updatedAt!: number
}

// =============================================================================
// DraftInvoice — the core offline-write entity
// =============================================================================
export class DraftInvoiceModel extends Model {
  static table = 'draft_invoices'
  static associations = {
    draft_invoice_items: { type: 'has_many' as const, foreignKey: 'invoice_local_uuid' },
  }

  @text('local_uuid')        localUuid!:        string
  @text('server_id')         serverId?:         string
  @text('server_number')     serverNumber?:     string
  @text('txn_type')          txnType!:          string
  @text('party_server_id')   partyServerId?:    string
  @text('party_name_snapshot') partyNameSnapshot?: string
  @field('subtotal')         subtotal!:         number
  @field('discount_amt')     discountAmt!:      number
  @field('taxable_amt')      taxableAmt!:       number
  @field('cgst_total')       cgstTotal!:        number
  @field('sgst_total')       sgstTotal!:        number
  @field('igst_total')       igstTotal!:        number
  @field('round_off')        roundOff!:         number
  @field('grand_total')      grandTotal!:       number
  @text('notes')             notes?:            string
  @json('domain_data', sanitizeJson) domainData!: Record<string, unknown>
  @text('created_by_local')  createdByLocal!:   string
  @text('sync_status')       syncStatus!:       'pending' | 'syncing' | 'synced' | 'failed'
  @text('sync_error')        syncError?:        string
  @field('sync_attempts')    syncAttempts!:     number
  @field('created_at')       createdAt!:        number

  @children('draft_invoice_items') items!: any  // Query<DraftInvoiceItemModel>

  get isSynced(): boolean { return this.syncStatus === 'synced' }
  get displayNumber(): string {
    return this.serverNumber ?? `DRAFT-${this.localUuid.slice(0, 8).toUpperCase()}`
  }
}

// =============================================================================
// DraftInvoiceItem
// =============================================================================
export class DraftInvoiceItemModel extends Model {
  static table = 'draft_invoice_items'

  @text('invoice_local_uuid') invoiceLocalUuid!: string
  @text('product_server_id')  productServerId?:  string
  @text('description')        description!:      string
  @text('hsn_sac_code')       hsnSacCode?:        string
  @field('qty')                qty!:               number
  @text('unit')                 unit!:              string
  @field('rate')                 rate!:              number
  @field('discount_pct')          discountPct!:       number
  @field('taxable_amt')            taxableAmt!:        number
  @field('gst_rate')                gstRate!:           number
  @field('cgst_amt')                 cgstAmt!:           number
  @field('sgst_amt')                  sgstAmt!:           number
  @field('igst_amt')                   igstAmt!:           number
  @field('total')                       total!:             number
}

// =============================================================================
// SyncQueueItem — generic outbox entry
// =============================================================================
export class SyncQueueModel extends Model {
  static table = 'sync_queue'

  @text('entity_type')     entityType!:    string
  @text('entity_local_id') entityLocalId!: string
  @text('method')          method!:        string
  @text('endpoint')        endpoint!:      string
  @json('payload', sanitizeJson) payload!: Record<string, unknown>
  @text('status')          status!:        'pending' | 'syncing' | 'done' | 'failed'
  @field('attempts')       attempts!:      number
  @text('last_error')      lastError?:     string
  @field('created_at')     createdAt!:     number
}
