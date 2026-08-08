// apps/mobile/src/screens/DraftReviewScreen.tsx
//
// THE SAFETY SCREEN. AI output never becomes an invoice without a human
// looking at exactly what was understood and explicitly confirming it.
//
// Visual language is deliberate:
//   - Green checkmark   = high-confidence match, shown plainly
//   - Amber warning      = needs the cashier's attention (weak match,
//                          ambiguous party, missing rate)
//   - Red "not found"     = AI mentioned something that has no match at all —
//                          cashier must pick a product manually or remove it
//
// The cashier can edit ANY field before confirming. Once confirmed, this
// goes through the exact same createOfflineInvoice() path as a normal
// manually-built sale — there is no special "AI invoice" code path in the
// actual invoice creation logic. AI just pre-fills the cart.

import React, { useState } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, ActivityIndicator, Alert,
} from 'react-native'
import { Q } from '@nozbe/watermelondb'
import { productsCollection, partiesCollection } from '../db'
import { createOfflineInvoice } from '../sync/offlineInvoice'
import { useAuthStore } from '../store/auth.store'
import type { InvoiceDraftDTO, ResolvedLineItemDTO } from '../lib/aiApi'
import type { ProductModel, PartyModel } from '../db/models'

interface ReviewLine {
  key:             string
  raw:             ResolvedLineItemDTO['raw']
  matchedProduct:  ResolvedLineItemDTO['matchedProduct']
  matchConfidence: number
  // The cashier may override the AI's match with a manual product pick
  overrideProduct: ProductModel | null
  removed:         boolean
}

function confidenceLevel(score: number): 'high' | 'medium' | 'low' {
  if (score >= 0.7) return 'high'
  if (score >= 0.4) return 'medium'
  return 'low'
}

export function DraftReviewScreen({
  draft, originalText, onConfirmed, onCancel,
}: {
  draft:        InvoiceDraftDTO
  originalText: string
  onConfirmed:  () => void
  onCancel:     () => void
}) {
  const { userId } = useAuthStore()

  const [lines, setLines] = useState<ReviewLine[]>(
    draft.resolvedItems.map((item, i) => ({
      key: `${i}-${item.raw.name}`,
      raw: item.raw,
      matchedProduct: item.matchedProduct,
      matchConfidence: item.matchConfidence,
      overrideProduct: null,
      removed: false,
    }))
  );

  const [partyOverride, setPartyOverride] = useState<PartyModel | null>(null)
  const [showProductPicker, setShowProductPickerFor] = useState<string | null>(null)
  const [showPartyPicker, setShowPartyPicker]         = useState(false)
  const [isSubmitting, setIsSubmitting]                 = useState(false)

  const activeLines = lines.filter((l) => !l.removed)
  const allResolved  = activeLines.every((l) => l.matchedProduct || l.overrideProduct)

  function effectiveProduct(line: ReviewLine) {
    return line.overrideProduct ?? line.matchedProduct
  }

  function calcLineTotal(line: ReviewLine): number {
    const product = effectiveProduct(line)
    const rate = line.raw.rate ?? (product && 'salePrice' in product ? product.salePrice : 0)
    const gstRate = line.overrideProduct?.gstRate ?? (product && 'gstRate' in product ? product.gstRate : 0)
    const gross = line.raw.qty * (rate ?? 0)
    const discount = gross * (line.raw.discountPct / 100)
    const taxable = gross - discount
    return taxable + taxable * ((gstRate ?? 0) / 100)
  }

  const grandTotal = Math.round(activeLines.reduce((s, l) => s + calcLineTotal(l), 0))

  function removeLine(key: string) {
    setLines((prev) => prev.map((l) => l.key === key ? { ...l, removed: true } : l))
  }

  function updateQty(key: string, qty: number) {
    setLines((prev) => prev.map((l) =>
      l.key === key ? { ...l, raw: { ...l.raw, qty: Math.max(0.01, qty) } } : l
    ))
  }

  function updateRate(key: string, rate: number) {
    setLines((prev) => prev.map((l) =>
      l.key === key ? { ...l, raw: { ...l.raw, rate } } : l
    ))
  }

  function setProductOverride(key: string, product: ProductModel) {
    setLines((prev) => prev.map((l) =>
      l.key === key ? { ...l, overrideProduct: product } : l
    ))
    setShowProductPickerFor(null)
  }

  async function handleConfirm() {
    if (!allResolved) {
      Alert.alert('Some items need attention', 'Pick a product for every highlighted item before confirming.')
      return
    }
    if (activeLines.length === 0) {
      Alert.alert('No items', 'Add at least one item to create an invoice.')
      return
    }

    setIsSubmitting(true)
    try {
      await createOfflineInvoice({
        txnType: 'sale_invoice',
        partyServerId: (partyOverride ?? (draft.resolvedParty ? { serverId: draft.resolvedParty.id } as any : null))?.serverId,
        partyName:      partyOverride?.name ?? draft.resolvedParty?.name,
        items: activeLines.map((line) => {
          const product = effectiveProduct(line)!
          const gstRate = line.overrideProduct?.gstRate ?? ('gstRate' in product ? product.gstRate : 0)
          return {
            productLocalId:  line.overrideProduct?.id,
            productServerId: 'serverId' in product ? product.serverId : undefined,
            description:     line.raw.name,
            qty:             line.raw.qty,
            unit:            line.raw.unit,
            rate:            line.raw.rate ?? ('salePrice' in product ? product.salePrice : 0),
            discountPct:     line.raw.discountPct,
            gstRate:         gstRate ?? 0,
            hsnSacCode:      'hsnSacCode' in product ? product.hsnSacCode ?? undefined : undefined,
          }
        }),
        domainData: { source: 'voice', is_udhaar: false },
        createdByLocal: userId ?? 'unknown',
      })

      Alert.alert('Invoice created', `Total: Rs ${grandTotal}`, [
        { text: 'OK', onPress: onConfirmed },
      ])
    } catch (err: any) {
      Alert.alert('Error', 'Could not save the invoice: ' + err.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Review before confirming</Text>
        <Text style={styles.originalText} numberOfLines={2}>"{originalText}"</Text>
      </View>

      <ScrollView style={styles.scrollArea} contentContainerStyle={{ paddingBottom: 20 }}>

        {/* Overall confidence warning */}
        {draft.needsReview && (
          <View style={styles.warningBanner}>
            <Text style={styles.warningText}>
              ⚠ Please double-check the highlighted items below before confirming
            </Text>
          </View>
        )}

        {/* Customer */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>CUSTOMER</Text>
          <TouchableOpacity
            style={[
              styles.customerRow,
              !draft.resolvedParty && draft.partyHint && styles.customerRowWarning,
            ]}
            onPress={() => setShowPartyPicker(true)}
          >
            <Text style={styles.customerName}>
              {partyOverride?.name ?? draft.resolvedParty?.name ?? 'Walk-in customer'}
            </Text>
            {draft.partyHint && !draft.resolvedParty && !partyOverride && (
              <Text style={styles.customerWarningText}>
                Heard "{draft.partyHint}" — no exact match. Tap to select.
              </Text>
            )}
            {(draft.resolvedParty || partyOverride) && (
              <Text style={styles.changeLink}>Change</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Line items */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>ITEMS</Text>
          {activeLines.map((line) => {
            const product = effectiveProduct(line)
            const level   = product ? confidenceLevel(line.matchConfidence) : 'low'
            const hasOverride = !!line.overrideProduct

            return (
              <View key={line.key} style={[
                styles.itemCard,
                level === 'low' && !hasOverride && styles.itemCardError,
                level === 'medium' && !hasOverride && styles.itemCardWarning,
              ]}>
                <View style={styles.itemHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemRawName}>Heard: "{line.raw.name}"</Text>
                    {product ? (
                      <Text style={styles.itemMatchedName}>
                        {hasOverride ? '✓ ' : level === 'high' ? '✓ ' : ''}
                        {'name' in product ? product.name : ''}
                      </Text>
                    ) : (
                      <Text style={styles.itemNoMatch}>No matching product found</Text>
                    )}
                  </View>
                  <TouchableOpacity onPress={() => removeLine(line.key)}>
                    <Text style={styles.removeIcon}>✕</Text>
                  </TouchableOpacity>
                </View>

                {(level !== 'high' || !product) && (
                  <TouchableOpacity
                    style={styles.pickProductButton}
                    onPress={() => setShowProductPickerFor(line.key)}
                  >
                    <Text style={styles.pickProductText}>
                      {product ? 'Pick a different product' : 'Select the correct product'}
                    </Text>
                  </TouchableOpacity>
                )}

                <View style={styles.itemFieldsRow}>
                  <View style={styles.itemField}>
                    <Text style={styles.itemFieldLabel}>Qty</Text>
                    <TextInput
                      style={styles.itemFieldInput}
                      keyboardType="decimal-pad"
                      value={String(line.raw.qty)}
                      onChangeText={(t) => updateQty(line.key, Number(t) || 0)}
                    />
                  </View>
                  <View style={styles.itemField}>
                    <Text style={styles.itemFieldLabel}>Rate</Text>
                    <TextInput
                      style={styles.itemFieldInput}
                      keyboardType="decimal-pad"
                      value={String(line.raw.rate ?? (product && 'salePrice' in product ? product.salePrice : ''))}
                      onChangeText={(t) => updateRate(line.key, Number(t) || 0)}
                      placeholder={product && 'salePrice' in product ? String(product.salePrice) : '0'}
                    />
                  </View>
                  <View style={styles.itemTotal}>
                    <Text style={styles.itemFieldLabel}>Total</Text>
                    <Text style={styles.itemTotalValue}>Rs {calcLineTotal(line).toFixed(0)}</Text>
                  </View>
                </View>
              </View>
            )
          })}
        </View>

        {/* Product picker inline (simple list — reuses local search) */}
        {showProductPicker && (
          <InlineProductPicker
            onSelect={(p) => setProductOverride(showProductPicker, p)}
            onClose={() => setShowProductPickerFor(null)}
          />
        )}

        {/* Party picker inline */}
        {showPartyPicker && (
          <InlinePartyPicker
            onSelect={(p) => { setPartyOverride(p); setShowPartyPicker(false) }}
            onClose={() => setShowPartyPicker(false)}
          />
        )}
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalValue}>Rs {grandTotal}</Text>
        </View>
        <View style={styles.footerButtons}>
          <TouchableOpacity style={styles.cancelButton} onPress={onCancel}>
            <Text style={styles.cancelButtonText}>Discard</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.confirmButton, !allResolved && styles.confirmButtonDisabled]}
            onPress={handleConfirm}
            disabled={!allResolved || isSubmitting}
          >
            {isSubmitting
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.confirmButtonText}>Confirm & Save</Text>}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  )
}

// ── Inline pickers (simple local search reused from BillingScreen pattern) ──

function InlineProductPicker({ onSelect, onClose }: {
  onSelect: (p: ProductModel) => void; onClose: () => void
}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<ProductModel[]>([])

  async function search(text: string) {
    setQuery(text)
    if (text.trim().length < 2) { setResults([]); return }
    const found = await productsCollection
      .query(Q.where('name', Q.like(`%${Q.sanitizeLikeString(text)}%`)))
      .fetch()
    setResults(found.slice(0, 10))
  }

  return (
    <View style={styles.pickerOverlay}>
      <TextInput
        style={styles.pickerInput}
        placeholder="Search products..."
        value={query}
        onChangeText={search}
        autoFocus
      />
      {results.map((p) => (
        <TouchableOpacity key={p.id} style={styles.pickerRow} onPress={() => onSelect(p)}>
          <Text style={styles.pickerRowText}>{p.name}</Text>
          <Text style={styles.pickerRowPrice}>Rs {p.salePrice}</Text>
        </TouchableOpacity>
      ))}
      <TouchableOpacity onPress={onClose} style={styles.pickerCloseBtn}>
        <Text style={styles.pickerCloseText}>Cancel</Text>
      </TouchableOpacity>
    </View>
  )
}

function InlinePartyPicker({ onSelect, onClose }: {
  onSelect: (p: PartyModel) => void; onClose: () => void
}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<PartyModel[]>([])

  async function search(text: string) {
    setQuery(text)
    if (text.trim().length < 2) { setResults([]); return }
    const found = await partiesCollection
      .query(Q.where('name', Q.like(`%${Q.sanitizeLikeString(text)}%`)))
      .fetch()
    setResults(found.slice(0, 10))
  }

  return (
    <View style={styles.pickerOverlay}>
      <TextInput
        style={styles.pickerInput}
        placeholder="Search customers..."
        value={query}
        onChangeText={search}
        autoFocus
      />
      {results.map((p) => (
        <TouchableOpacity key={p.id} style={styles.pickerRow} onPress={() => onSelect(p)}>
          <Text style={styles.pickerRowText}>{p.name}</Text>
        </TouchableOpacity>
      ))}
      <TouchableOpacity onPress={onClose} style={styles.pickerCloseBtn}>
        <Text style={styles.pickerCloseText}>Cancel</Text>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  header: { padding: 16, paddingTop: 50, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#111827' },
  originalText: { fontSize: 12, color: '#6b7280', marginTop: 4, fontStyle: 'italic' },

  scrollArea: { flex: 1, padding: 14 },

  warningBanner: { backgroundColor: '#fef3c7', borderRadius: 10, padding: 12, marginBottom: 14 },
  warningText: { fontSize: 12, color: '#92400e', fontWeight: '600' },

  section: { marginBottom: 18 },
  sectionLabel: { fontSize: 11, fontWeight: '700', color: '#9ca3af', marginBottom: 8, letterSpacing: 0.5 },

  customerRow: { backgroundColor: '#fff', borderRadius: 10, padding: 14, borderWidth: 1, borderColor: '#e5e7eb' },
  customerRowWarning: { borderColor: '#f59e0b', backgroundColor: '#fffbeb' },
  customerName: { fontSize: 15, fontWeight: '600', color: '#111827' },
  customerWarningText: { fontSize: 12, color: '#92400e', marginTop: 4 },
  changeLink: { fontSize: 12, color: '#2563eb', marginTop: 4, fontWeight: '600' },

  itemCard: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: '#e5e7eb' },
  itemCardWarning: { borderColor: '#f59e0b', backgroundColor: '#fffbeb' },
  itemCardError: { borderColor: '#dc2626', backgroundColor: '#fef2f2' },
  itemHeader: { flexDirection: 'row', alignItems: 'flex-start' },
  itemRawName: { fontSize: 11, color: '#9ca3af', fontStyle: 'italic' },
  itemMatchedName: { fontSize: 15, fontWeight: '600', color: '#111827', marginTop: 2 },
  itemNoMatch: { fontSize: 14, fontWeight: '600', color: '#dc2626', marginTop: 2 },
  removeIcon: { fontSize: 16, color: '#d1d5db', paddingHorizontal: 6 },

  pickProductButton: { backgroundColor: '#eff6ff', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 12, marginTop: 8, alignSelf: 'flex-start' },
  pickProductText: { fontSize: 12, color: '#2563eb', fontWeight: '600' },

  itemFieldsRow: { flexDirection: 'row', gap: 10, marginTop: 10 },
  itemField: { flex: 1 },
  itemFieldLabel: { fontSize: 10, color: '#9ca3af', marginBottom: 4 },
  itemFieldInput: {
    borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 8, fontSize: 14,
  },
  itemTotal: { flex: 1, alignItems: 'flex-end' },
  itemTotalValue: { fontSize: 15, fontWeight: '700', color: '#111827', marginTop: 6 },

  pickerOverlay: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginTop: 8, borderWidth: 1, borderColor: '#e5e7eb' },
  pickerInput: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, padding: 10, fontSize: 14, marginBottom: 8 },
  pickerRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  pickerRowText: { fontSize: 14, color: '#111827' },
  pickerRowPrice: { fontSize: 13, color: '#6b7280' },
  pickerCloseBtn: { paddingVertical: 10, alignItems: 'center' },
  pickerCloseText: { fontSize: 13, color: '#6b7280', fontWeight: '600' },

  footer: { backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#e5e7eb', padding: 16, paddingBottom: 28 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  totalLabel: { fontSize: 14, color: '#6b7280' },
  totalValue: { fontSize: 22, fontWeight: '800', color: '#111827' },
  footerButtons: { flexDirection: 'row', gap: 10 },
  cancelButton: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: 'center', backgroundColor: '#f3f4f6' },
  cancelButtonText: { fontSize: 14, fontWeight: '700', color: '#6b7280' },
  confirmButton: { flex: 2, paddingVertical: 14, borderRadius: 12, alignItems: 'center', backgroundColor: '#16a34a' },
  confirmButtonDisabled: { backgroundColor: '#d1d5db' },
  confirmButtonText: { fontSize: 14, fontWeight: '700', color: '#fff' },
})
