// apps/mobile/src/screens/LoginScreen.tsx
import React, { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, KeyboardAvoidingView, Platform, Alert,
} from 'react-native'
import { useAuthStore } from '../store/auth.store'
import { apiClient } from '../lib/apiClient'
import { runFullSync } from '../sync/syncEngine'

export function LoginScreen() {
  const login = useAuthStore((s) => s.login)
  const [phone, setPhone] = useState('')
  const [pin, setPin]     = useState('')
  const [loading, setLoading] = useState(false)

  async function handleLogin() {
    if (phone.length < 10 || pin.length !== 4) return
    setLoading(true)
    try {
      const res = await apiClient.post('/auth/login', { phone, pin })
      const data = res.data

      await login({
        accessToken:           data.accessToken,
        refreshToken:          data.refreshToken,
        accessTokenExpiresIn:  data.accessTokenExpiresIn,
        userId:     data.user.id,
        userName:   data.user.name,
        branchId:   data.branch.id,
        branchName: data.branch.name,
        domainType: data.branch.domainType,
      })

      // Pull initial product/party data immediately after login
      runFullSync().catch(() => {})
    } catch (err: any) {
      Alert.alert('Login failed', 'Check your phone number and PIN')
    } finally {
      setLoading(false)
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.content}>
        <View style={styles.logoCircle}>
          <Text style={styles.logoText}>B</Text>
        </View>
        <Text style={styles.title}>Welcome back</Text>
        <Text style={styles.subtitle}>Sign in to start billing</Text>

        <View style={styles.form}>
          <Text style={styles.label}>Phone number</Text>
          <TextInput
            style={styles.input}
            keyboardType="number-pad"
            maxLength={10}
            placeholder="9876543210"
            value={phone}
            onChangeText={(t) => setPhone(t.replace(/\D/g, ''))}
          />

          <Text style={styles.label}>4-digit PIN</Text>
          <TextInput
            style={[styles.input, styles.pinInput]}
            keyboardType="number-pad"
            maxLength={4}
            secureTextEntry
            placeholder="----"
            value={pin}
            onChangeText={(t) => setPin(t.replace(/\D/g, ''))}
          />

          <TouchableOpacity
            style={[styles.button, (phone.length < 10 || pin.length !== 4) && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={phone.length < 10 || pin.length !== 4 || loading}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.buttonText}>Sign in</Text>}
          </TouchableOpacity>
        </View>

        <Text style={styles.testHint}>Test login: 9876543210 / PIN 1111</Text>
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { flex: 1, justifyContent: 'center', paddingHorizontal: 28 },
  logoCircle: {
    width: 64, height: 64, borderRadius: 18, backgroundColor: '#16a34a',
    justifyContent: 'center', alignItems: 'center', alignSelf: 'center', marginBottom: 20,
  },
  logoText: { fontSize: 28, fontWeight: '800', color: '#fff' },
  title: { fontSize: 24, fontWeight: '800', textAlign: 'center', color: '#111827' },
  subtitle: { fontSize: 14, color: '#6b7280', textAlign: 'center', marginTop: 6, marginBottom: 32 },
  form: { gap: 4 },
  label: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6, marginTop: 14 },
  input: {
    borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 13, fontSize: 16,
  },
  pinInput: { textAlign: 'center', fontSize: 24, letterSpacing: 12, fontWeight: '700' },
  button: {
    backgroundColor: '#16a34a', borderRadius: 12, paddingVertical: 15,
    alignItems: 'center', marginTop: 24,
  },
  buttonDisabled: { backgroundColor: '#d1d5db' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  testHint: { textAlign: 'center', fontSize: 11, color: '#9ca3af', marginTop: 24 },
})
