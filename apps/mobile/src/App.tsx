// apps/mobile/src/App.tsx
// Root component: navigation, auth gate, and background sync lifecycle.

import React, { useEffect, useState } from 'react'
import { NavigationContainer } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { useAuthStore } from './store/auth.store'
import { startBackgroundSync } from './sync/syncEngine'
import { LoginScreen } from './screens/LoginScreen'
import { BillingScreen } from './screens/BillingScreen'
import { AIBillingScreen } from './screens/AIBillingScreen'
import { InvoiceHistoryScreen } from './screens/InvoiceHistoryScreen'

const Stack = createNativeStackNavigator()

export default function App() {
  const { accessToken, isHydrated, hydrate } = useAuthStore()
  const [syncStarted, setSyncStarted] = useState(false)

  // Load persisted auth on app start
  useEffect(() => {
    hydrate()
  }, [hydrate])

  // Start background sync once logged in — runs for the lifetime of the app session.
  // Note: this gates on accessToken being present at all, not on whether it's
  // currently expired — an expired-but-present access token still means
  // "this device has a session"; apiClient.ts transparently refreshes it
  // on the next API call. Only a fully cleared auth store (after failed
  // refresh, or explicit logout) drops the user back to LoginScreen.
  useEffect(() => {
    if (accessToken && !syncStarted) {
      const stopSync = startBackgroundSync(30_000)
      setSyncStarted(true)
      return stopSync
    }
    return undefined
  }, [accessToken, syncStarted])

  if (!isHydrated) {
    return null // Could show a splash screen here
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          {!accessToken ? (
            <Stack.Screen name="Login" component={LoginScreen} />
          ) : (
            <>
              <Stack.Screen name="Billing" component={BillingScreen} />
              <Stack.Screen name="AIBilling" component={AIBillingScreen} />
              <Stack.Screen name="InvoiceHistory" component={InvoiceHistoryScreen} />
            </>
          )}
        </Stack.Navigator>
      </NavigationContainer>
    </GestureHandlerRootView>
  )
}
