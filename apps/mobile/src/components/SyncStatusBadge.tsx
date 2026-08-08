// apps/mobile/src/components/SyncStatusBadge.tsx
import React from 'react'
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native'
import { useSyncStatus } from '../hooks/useSyncStatus'

export function SyncStatusBadge() {
  const { pendingCount, failedCount, isOnline } = useSyncStatus()

  if (!isOnline) {
    return (
      <View style={[styles.badge, styles.offline]}>
        <View style={styles.dot} />
        <Text style={styles.text}>Offline{pendingCount > 0 ? ` - ${pendingCount} to sync` : ''}</Text>
      </View>
    )
  }

  if (failedCount > 0) {
    return (
      <View style={[styles.badge, styles.failed]}>
        <Text style={styles.text}>{failedCount} sync failed - tap to retry</Text>
      </View>
    )
  }

  if (pendingCount > 0) {
    return (
      <View style={[styles.badge, styles.syncing]}>
        <ActivityIndicator size="small" color="#fff" style={{ marginRight: 6 }} />
        <Text style={styles.text}>Syncing {pendingCount}...</Text>
      </View>
    )
  }

  return (
    <View style={[styles.badge, styles.synced]}>
      <Text style={styles.text}>All synced</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
  },
  offline: { backgroundColor: '#6b7280' },
  failed:  { backgroundColor: '#dc2626' },
  syncing: { backgroundColor: '#2563eb' },
  synced:  { backgroundColor: '#16a34a' },
  dot: {
    width: 6, height: 6, borderRadius: 3,
    backgroundColor: '#fff', marginRight: 6,
  },
  text: { color: '#fff', fontSize: 11, fontWeight: '600' },
})
