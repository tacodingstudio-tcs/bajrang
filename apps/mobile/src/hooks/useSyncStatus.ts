// apps/mobile/src/hooks/useSyncStatus.ts
// Reactive hook — WatermelonDB observables update this automatically
// whenever a draft_invoice's sync_status changes. No manual refresh needed.

import { useState, useEffect } from 'react'
import { Q } from '@nozbe/watermelondb'
import { draftInvoicesCollection } from '../db'
import NetInfo from '@react-native-community/netinfo'

export function useSyncStatus() {
  const [pendingCount, setPendingCount] = useState(0)
  const [failedCount, setFailedCount]   = useState(0)
  const [isOnline, setIsOnline]         = useState(true)

  useEffect(() => {
    const subscription = draftInvoicesCollection
      .query(Q.where('sync_status', Q.oneOf(['pending', 'syncing'])))
      .observeCount()
      .subscribe(setPendingCount)

    const failedSub = draftInvoicesCollection
      .query(Q.where('sync_status', 'failed'))
      .observeCount()
      .subscribe(setFailedCount)

    const netSub = NetInfo.addEventListener((state) => {
      setIsOnline(!!state.isConnected)
    })

    return () => {
      subscription.unsubscribe()
      failedSub.unsubscribe()
      netSub()
    }
  }, [])

  return { pendingCount, failedCount, isOnline, hasIssues: failedCount > 0 }
}
