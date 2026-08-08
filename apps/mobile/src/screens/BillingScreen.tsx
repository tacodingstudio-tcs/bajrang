// apps/mobile/src/screens/BillingScreen.tsx
//
// The screen a cashier uses 100+ times a day.
// Search products locally (instant — no network needed), scan barcodes
// with the camera, add to cart, confirm sale — entirely offline-capable.

import React, { useState, useCallback } from 'react'
import {
  View, Text, TextInput, FlatList, TouchableOpacity,
  StyleSheet, Alert, Modal,
} from 'react-native'
import { Q } from '@nozbe/watermelondb'
import { productsCollection, partiesCollection } from '../db'
import { createOfflineInvoice } from '../sync/offlineInvoice'
import { useAuthStore } from '../store/auth.store'
import { SyncStatusBadge } from '../components/SyncStatusBadge'
import { BarcodeScannerModal } from '../components/BarcodeScannerModal'
import type { ProductModel, PartyModel } from '../db/models'

interface CartLine {
  key:             string
  productLocalId?: string
  productServerId?:string
  description:     string
  qty:             number
  rate:            number
  discountPct:     number
  gstRate:         number
  unit:            string
  hsnSacCode?:     string
}

function calcLineTotal(line: CartLine): number {
  const gross    = line.qty * line.rate
  const discount = gross * (line.discountPct / 100)
  const taxable  = gross - discount
  const gst      = taxable * (line.gstRate / 100)
  return taxable + gst
}

export function BillingScreen({ navigation }: any) {
  const { userId, branchName } = useAuthStore()

  const [searchQuery, setSearchQuery]       = useState('')
  const [searchResults, setSearchResults]   = useState<ProductModel[]>([])
  const [cart, setCart]                     = useState<CartLine[]>([])
  const [showScanner, setShowScanner]       = useState(false)
  const [showPartyModal, setShowPartyModal] = useState(false)
  const [selectedParty, setSelectedParty]   = useState<PartyModel | null>(null)
  const [isSubmitting, setIsSubmitting]     = useState(false)

  // ── Local product search — instant, no network ─────────────────────────────
  const handleSearch = useCallback(async (text: string) => {
    setSearchQuery(text)
    if (text.trim().length < 2) {
      setSearchResults([])
      return
    }

    // Exact barcode match first (handles USB scanner "type and enter" input)
    if (/^\d{8,}$/.test(text)) {
      const byBarcode = await productsCollection
        .query(Q.where('barcode', text))
        .fetch()
      if (byBarcode.length > 0) {
        addToCart(byBarcode[0]!)
        setSearchQuery('')
        setSearchResults([])
        return
      }
    }

    // Local SQL LIKE search — fast enough for a few thousand local products
    const results = await productsCollection
      .query(Q.where('name', Q.like(`%${Q.sanitizeLikeString(text)}%`)))
      .fetch()
    setSearchResults(results.slice(0, 15))
  }, [])

  function addToCart(product: ProductModel) {
    setCart((prev) => {
      const existingIdx = prev.findIndex((l) => l.productLocalId === product.id)
      if (existingIdx >= 0) {
        return prev.map((l, i) => i === existingIdx ? { ...l, qty: l.qty + 1 } : l)
      }
      return [...prev, {
        key:             `${product.id}-${Date.now()}`,
        productLocalId:  product.id,
        productServerId: product.serverId,
        description:     product.name,
        qty:             1,
        rate:            product.salePrice,
        discountPct:     0,
        gstRate:         product.gstRate,
        unit:            product.unit,
        hsnSacCode:      product.hsnSacCode,
      }]
    })
    setSearchQuery('')
    setSearchResults([])
  }

  function updateLineQty(key: string, delta: number) {
    setCart((prev) => prev.map((l) =>
      l.key === key ? { ...l, qty: Math.max(0.01, l.qty + delta) } : l
    ))
  }

  function removeLine(key: string) {
    setCart((prev) => prev.filter((l) => l.key !== key))
  }

  function handleBarcodeScanned(code: string) {
    setShowScanner(false)
    productsCollection
      .query(Q.where('barcode', code))
      .fetch()
      .then((results) => {
        if (results.length > 0) {
          addToCart(results[0]!)
        } else {
          Alert.alert('Not found', `No product with barcode ${code}`)
        }
      })
  }

  const grandTotal   = cart.reduce((sum, line) => sum + calcLineTotal(line), 0)
  const roundedTotal = Math.round(grandTotal)

  async function handleConfirmSale() {
    if (cart.length === 0) return
    setIsSubmitting(true)

    try {
      await createOfflineInvoice({
        txnType: 'sale_invoice',
        partyServerId: selectedParty?.serverId,
        partyName:      selectedParty?.name,
        items: cart.map((line) => ({
          productLocalId:  line.productLocalId,
          productServerId: line.productServerId,
          description:     line.description,
          qty:             line.qty,
          unit:            line.unit,
          rate:            line.rate,
          discountPct:     line.discountPct,
          gstRate:         line.gstRate,
          hsnSacCode:      line.hsnSacCode,
        })),
        domainData: { source: 'pos', is_udhaar: false },
        createdByLocal: userId ?? 'unknown',
      })

      setCart([])
      setSelectedParty(null)
      Alert.alert(
        'Sale recorded',
        `Total: Rs ${roundedTotal}\n\nThe invoice will sync automatically when online.`,
        [{ text: 'OK', onPress: () => navigation.navigate('InvoiceHistory') }]
      )
    } catch (err: any) {
      Alert.alert('Error', 'Could not save the invoice locally: ' + err.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <View style={styles.container}>

      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>{branchName}</Text>
          <Text style={styles.headerSubtitle}>New sale</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <TouchableOpacity
            style={styles.aiButton}
            onPress={() => navigation.navigate('AIBilling')}
          >
            <Text style={styles.aiButtonText}>AI Bill</Text>
          </TouchableOpacity>
          <SyncStatusBadge />
        </View>
      </View>

      {/* Search bar with scan button */}
      <View style={styles.searchRow}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search product or scan barcode..."
          value={searchQuery}
          onChangeText={handleSearch}
          autoCapitalize="none"
        />
        <TouchableOpacity style={styles.scanButton} onPress={() => setShowScanner(true)}>
          <Text style={styles.scanButtonText}>Scan</Text>
        </TouchableOpacity>
      </View>

      {/* Search results dropdown */}
      {searchResults.length > 0 && (
        <FlatList
          style={styles.searchResultsList}
          data={searchResults}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.searchResultRow} onPress={() => addToCart(item)}>
              <View style={{ flex: 1 }}>
                <Text style={styles.searchResultName}>{item.name}</Text>
                <Text style={styles.searchResultMeta}>
                  {item.trackStock ? `${item.stockOnHand} ${item.unit} in stock` : item.unit}
                  {item.gstRate > 0 ? ` - GST ${item.gstRate}%` : ''}
                </Text>
              </View>
              <Text style={styles.searchResultPrice}>Rs {item.salePrice}</Text>
            </TouchableOpacity>
          )}
        />
      )}

      {/* Cart */}
      <FlatList
        style={styles.cartList}
        data={cart}
        keyExtractor={(item) => item.key}
        ListEmptyComponent={
          <View style={styles.emptyCart}>
            <Text style={styles.emptyCartText}>Search or scan to add products</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.cartRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.cartItemName}>{item.description}</Text>
              <Text style={styles.cartItemMeta}>
                Rs {item.rate} x {item.qty} {item.unit}
              </Text>
            </View>
            <View style={styles.qtyControl}>
              <TouchableOpacity onPress={() => updateLineQty(item.key, -1)} style={styles.qtyBtn}>
                <Text style={styles.qtyBtnText}>-</Text>
              </TouchableOpacity>
              <Text style={styles.qtyValue}>{item.qty}</Text>
              <TouchableOpacity onPress={() => updateLineQty(item.key, 1)} style={styles.qtyBtn}>
                <Text style={styles.qtyBtnText}>+</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.cartItemTotal}>Rs {calcLineTotal(item).toFixed(0)}</Text>
            <TouchableOpacity onPress={() => removeLine(item.key)}>
              <Text style={styles.removeBtn}>x</Text>
            </TouchableOpacity>
          </View>
        )}
      />

      {/* Footer: party select + total + confirm */}
      <View style={styles.footer}>
        <TouchableOpacity style={styles.partyButton} onPress={() => setShowPartyModal(true)}>
          <Text style={styles.partyButtonText}>
            {selectedParty ? `Customer: ${selectedParty.name}` : 'Walk-in customer'}
          </Text>
        </TouchableOpacity>

        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalValue}>Rs {roundedTotal}</Text>
        </View>

        <TouchableOpacity
          style={[styles.confirmButton, cart.length === 0 && styles.confirmButtonDisabled]}
          onPress={handleConfirmSale}
          disabled={cart.length === 0 || isSubmitting}
        >
          <Text style={styles.confirmButtonText}>
            {isSubmitting ? 'Saving...' : `Confirm Sale - Rs ${roundedTotal}`}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Barcode scanner modal */}
      <Modal visible={showScanner} animationType="slide">
        <BarcodeScannerModal
          onScan={handleBarcodeScanned}
          onClose={() => setShowScanner(false)}
        />
      </Modal>

      {/* Party picker modal */}
      <PartyPickerModal
        visible={showPartyModal}
        onClose={() => setShowPartyModal(false)}
        onSelect={(party) => { setSelectedParty(party); setShowPartyModal(false) }}
      />
    </View>
  )
}

function PartyPickerModal({ visible, onClose, onSelect }: {
  visible: boolean; onClose: () => void; onSelect: (party: PartyModel | null) => void
}) {
  const [query, setQuery]     = useState('')
  const [results, setResults] = useState<PartyModel[]>([])

  async function handleSearch(text: string) {
    setQuery(text)
    if (text.trim().length < 2) { setResults([]); return }
    const found = await partiesCollection
      .query(Q.where('name', Q.like(`%${Q.sanitizeLikeString(text)}%`)))
      .fetch()
    setResults(found.slice(0, 10))
  }

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Select customer</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search customer name..."
            value={query}
            onChangeText={handleSearch}
            autoFocus
          />
          <TouchableOpacity
            style={styles.walkInButton}
            onPress={() => { onSelect(null); setQuery(''); setResults([]) }}
          >
            <Text style={styles.walkInButtonText}>Walk-in customer (no name)</Text>
          </TouchableOpacity>
          <FlatList
            data={results}
            keyExtractor={(p) => p.id}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.searchResultRow}
                onPress={() => { onSelect(item); setQuery(''); setResults([]) }}
              >
                <Text style={styles.searchResultName}>{item.name}</Text>
                {item.balance > 0 && (
                  <Text style={{ color: '#d97706', fontSize: 12 }}>Rs {item.balance} due</Text>
                )}
              </TouchableOpacity>
            )}
          />
          <TouchableOpacity style={styles.closeModalButton} onPress={onClose}>
            <Text style={styles.closeModalText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingTop: 50, paddingBottom: 12,
    backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e5e7eb',
  },
  headerTitle:    { fontSize: 16, fontWeight: '700', color: '#111827' },
  headerSubtitle: { fontSize: 12, color: '#6b7280' },
  aiButton: {
    backgroundColor: '#111827', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14,
  },
  aiButtonText: { color: '#fff', fontSize: 11, fontWeight: '700' },

  searchRow: { flexDirection: 'row', padding: 12, gap: 8 },
  searchInput: {
    flex: 1, backgroundColor: '#fff', borderRadius: 10, paddingHorizontal: 14,
    paddingVertical: 12, fontSize: 15, borderWidth: 1, borderColor: '#e5e7eb',
  },
  scanButton: {
    width: 64, height: 46, borderRadius: 10, backgroundColor: '#16a34a',
    justifyContent: 'center', alignItems: 'center',
  },
  scanButtonText: { fontSize: 13, color: '#fff', fontWeight: '700' },

  searchResultsList: {
    maxHeight: 260, backgroundColor: '#fff', marginHorizontal: 12,
    borderRadius: 10, borderWidth: 1, borderColor: '#e5e7eb',
  },
  searchResultRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f3f4f6',
  },
  searchResultName: { fontSize: 14, fontWeight: '600', color: '#111827' },
  searchResultMeta: { fontSize: 12, color: '#6b7280', marginTop: 1 },
  searchResultPrice:{ fontSize: 14, fontWeight: '700', color: '#111827' },

  cartList: { flex: 1, paddingHorizontal: 12 },
  emptyCart: { padding: 40, alignItems: 'center' },
  emptyCartText: { color: '#9ca3af', fontSize: 14 },

  cartRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff',
    padding: 12, borderRadius: 10, marginBottom: 8, gap: 10,
  },
  cartItemName: { fontSize: 14, fontWeight: '600', color: '#111827' },
  cartItemMeta: { fontSize: 12, color: '#6b7280', marginTop: 1 },
  qtyControl: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  qtyBtn: {
    width: 28, height: 28, borderRadius: 6, backgroundColor: '#f3f4f6',
    justifyContent: 'center', alignItems: 'center',
  },
  qtyBtnText: { fontSize: 16, fontWeight: '700', color: '#374151' },
  qtyValue:   { fontSize: 14, fontWeight: '600', minWidth: 24, textAlign: 'center' },
  cartItemTotal: { fontSize: 14, fontWeight: '700', color: '#111827', minWidth: 60, textAlign: 'right' },
  removeBtn: { fontSize: 16, color: '#d1d5db', paddingHorizontal: 4 },

  footer: {
    backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#e5e7eb',
    padding: 16, paddingBottom: 28,
  },
  partyButton: {
    backgroundColor: '#f3f4f6', borderRadius: 8, paddingVertical: 10,
    paddingHorizontal: 14, marginBottom: 12,
  },
  partyButtonText: { fontSize: 13, fontWeight: '600', color: '#374151' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  totalLabel: { fontSize: 14, color: '#6b7280' },
  totalValue: { fontSize: 22, fontWeight: '800', color: '#111827' },
  confirmButton: {
    backgroundColor: '#16a34a', borderRadius: 12, paddingVertical: 16, alignItems: 'center',
  },
  confirmButtonDisabled: { backgroundColor: '#d1d5db' },
  confirmButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '80%' },
  modalTitle: { fontSize: 16, fontWeight: '700', marginBottom: 12 },
  walkInButton: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  walkInButtonText: { fontSize: 14, color: '#2563eb', fontWeight: '600' },
  closeModalButton: { paddingVertical: 12, alignItems: 'center', marginTop: 8 },
  closeModalText: { fontSize: 14, color: '#6b7280', fontWeight: '600' },
})
