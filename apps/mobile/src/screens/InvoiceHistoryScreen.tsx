// apps/mobile/src/screens/InvoiceHistoryScreen.tsx
//
// Shows all locally-created invoices with their sync status.
// This is how a cashier verifies "did my sale actually get recorded?"
// even while completely offline — everything reads from local SQLite.

import React, { useState, useEffect, useCallback } from 'react'
import { View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl } from 'react-native'
import { Q } from '@nozbe/watermelondb'
import { draftInvoicesCollection } from '../db'
import { runFullSync } from '../sync/syncEngine'
import type { DraftInvoiceModel } from '../db/models'

function formatTime(ts: number): string {
  return new Date(ts).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  })
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: 'Waiting to sync', color: '#92400e', bg: '#fef3c7' },
  syncing: { label: 'Syncing...',      color: '#1e40af', bg: '#dbeafe' },
  synced:  { label: 'Synced',          color: '#166534', bg: '#dcfce7' },
  failed:  { label: 'Sync failed',     color: '#991b1b', bg: '#fee2e2' },
}

export function InvoiceHistoryScreen() {
  const [invoices, setInvoices]   = useState<DraftInvoiceModel[]>([])
  const [refreshing, setRefreshing] = useState(false)

  const loadInvoices = useCallback(() => {
    draftInvoicesCollection
      .query(Q.sortBy('created_at', Q.desc))
      .fetch()
      .then(setInvoices)
  }, [])

  useEffect(() => {
    loadInvoices()
    // Re-observe whenever any draft_invoice changes (sync status updates live)
    const subscription = draftInvoicesCollection
      .query(Q.sortBy('created_at', Q.desc))
      .observe()
      .subscribe(setInvoices)
    return () => subscription.unsubscribe()
  }, [loadInvoices])

  async function handleRefresh() {
    setRefreshing(true)
    await runFullSync()
    loadInvoices()
    setRefreshing(false)
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Today's Sales</Text>
        <Text style={styles.headerSubtitle}>{invoices.length} invoices</Text>
      </View>

      <FlatList
        data={invoices}
        keyExtractor={(item) => item.localUuid}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No sales yet today</Text>
          </View>
        }
        renderItem={({ item }) => {
          const statusCfg = STATUS_CONFIG[item.syncStatus] ?? STATUS_CONFIG['pending']!
          return (
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.invoiceNumber}>{item.displayNumber}</Text>
                <Text style={styles.invoiceMeta}>
                  {item.partyNameSnapshot ?? 'Walk-in'} · {formatTime(item.createdAt)}
                </Text>
                {item.syncStatus === 'failed' && item.syncError && (
                  <Text style={styles.errorText} numberOfLines={1}>{item.syncError}</Text>
                )}
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.amount}>Rs {item.grandTotal.toFixed(0)}</Text>
                <View style={[styles.statusBadge, { backgroundColor: statusCfg.bg }]}>
                  <Text style={[styles.statusText, { color: statusCfg.color }]}>
                    {statusCfg.label}
                  </Text>
                </View>
              </View>
            </View>
          )
        }}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  header: { padding: 16, paddingTop: 50, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },
  headerSubtitle: { fontSize: 13, color: '#6b7280', marginTop: 2 },
  empty: { padding: 60, alignItems: 'center' },
  emptyText: { color: '#9ca3af', fontSize: 14 },
  row: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 14, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f3f4f6',
  },
  invoiceNumber: { fontSize: 14, fontWeight: '600', color: '#111827' },
  invoiceMeta: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  errorText: { fontSize: 11, color: '#dc2626', marginTop: 2 },
  amount: { fontSize: 15, fontWeight: '700', color: '#111827' },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, marginTop: 4 },
  statusText: { fontSize: 10, fontWeight: '600' },
})
