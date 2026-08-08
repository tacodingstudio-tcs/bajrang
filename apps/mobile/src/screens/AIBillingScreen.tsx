// apps/mobile/src/screens/AIBillingScreen.tsx
//
// Voice or text input -> AI-extracted invoice draft -> review screen.
// This screen REQUIRES network (the Claude API call happens server-side).
// If offline, it clearly tells the cashier to use regular billing instead
// rather than silently failing or queuing something that can't work offline.

import React, { useState, useRef } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, ScrollView, Alert, Animated,
} from 'react-native'
import NetInfo from '@react-native-community/netinfo'
import Voice from '@react-native-voice/voice'
import { aiApi, type InvoiceDraftDTO } from '../lib/aiApi'
import { DraftReviewScreen } from './DraftReviewScreen'

const EXAMPLE_PROMPTS = [
  'Ramesh ko 10 kilo chawal becha 50 rupaye kilo',
  'Suresh ne 2 packet Amul butter liya',
  'Aaj Priya ko 5 kg atta diya 200 rupaye mein',
]

export function AIBillingScreen({ navigation }: any) {
  const [text, setText]           = useState('')
  const [isListening, setIsListening] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [draft, setDraft]         = useState<InvoiceDraftDTO | null>(null)
  const pulseAnim = useRef(new Animated.Value(1)).current

  // ── Voice input setup ─────────────────────────────────────────────────────
  React.useEffect(() => {
    Voice.onSpeechResults = (event) => {
      const spoken = event.value?.[0]
      if (spoken) setText(spoken)
    }
    Voice.onSpeechEnd = () => setIsListening(false)
    Voice.onSpeechError = () => {
      setIsListening(false)
      Alert.alert('Could not hear that', 'Please try again or type instead')
    }

    return () => {
      Voice.destroy().then(Voice.removeAllListeners)
    }
  }, [])

  React.useEffect(() => {
    if (isListening) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.15, duration: 600, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        ])
      ).start()
    } else {
      pulseAnim.setValue(1)
    }
  }, [isListening, pulseAnim])

  async function startListening() {
    try {
      // Default to Hindi recognition — most common for kirana store billing.
      // Could be made configurable per-user language preference (auth store has `lang`)
      await Voice.start('hi-IN')
      setIsListening(true)
    } catch {
      Alert.alert('Microphone unavailable', 'Please type your request instead')
    }
  }

  async function stopListening() {
    await Voice.stop()
    setIsListening(false)
  }

  // ── Submit to AI extraction ───────────────────────────────────────────────
  async function handleSubmit() {
    if (text.trim().length < 3) return

    const netState = await NetInfo.fetch()
    if (!netState.isConnected) {
      Alert.alert(
        'Internet required',
        'AI billing needs an internet connection. Use regular billing to work offline.',
        [{ text: 'OK' }]
      )
      return
    }

    setIsProcessing(true)
    try {
      const result = await aiApi.extractInvoice(text.trim())

      if (result.intent !== 'CREATE_INVOICE') {
        Alert.alert(
          'Could not understand',
          "This doesn't look like a sale. Try something like:\n\n" +
          '"Ramesh ko 10 kilo chawal becha 50 rupaye kilo"'
        )
        setIsProcessing(false)
        return
      }

      setDraft(result)
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.error ?? 'Could not process your request. Try again.')
    } finally {
      setIsProcessing(false)
    }
  }

  function handleReset() {
    setDraft(null)
    setText('')
  }

  // ── Show the review screen once we have a draft ──────────────────────────
  if (draft) {
    return (
      <DraftReviewScreen
        draft={draft}
        originalText={text}
        onConfirmed={() => {
          handleReset()
          navigation.navigate('InvoiceHistory')
        }}
        onCancel={handleReset}
      />
    )
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>AI Billing</Text>
        <Text style={styles.headerSubtitle}>Speak or type your sale in your own words</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

        {/* Mic button */}
        <View style={styles.micSection}>
          <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
            <TouchableOpacity
              style={[styles.micButton, isListening && styles.micButtonActive]}
              onPress={isListening ? stopListening : startListening}
            >
              <Text style={styles.micIcon}>{isListening ? '●' : 'Mic'}</Text>
            </TouchableOpacity>
          </Animated.View>
          <Text style={styles.micHint}>
            {isListening ? 'Listening... tap to stop' : 'Tap to speak'}
          </Text>
        </View>

        {/* Text input */}
        <TextInput
          style={styles.textInput}
          placeholder="Or type here, e.g. Ramesh ko 10 kilo chawal becha..."
          value={text}
          onChangeText={setText}
          multiline
          numberOfLines={3}
        />

        <TouchableOpacity
          style={[styles.submitButton, text.trim().length < 3 && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={text.trim().length < 3 || isProcessing}
        >
          {isProcessing
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.submitButtonText}>Create Invoice</Text>}
        </TouchableOpacity>

        {/* Example prompts */}
        <View style={styles.examplesSection}>
          <Text style={styles.examplesTitle}>Try saying something like:</Text>
          {EXAMPLE_PROMPTS.map((example) => (
            <TouchableOpacity
              key={example}
              style={styles.exampleChip}
              onPress={() => setText(example)}
            >
              <Text style={styles.exampleText}>{example}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  header: {
    padding: 16, paddingTop: 50, backgroundColor: '#fff',
    borderBottomWidth: 1, borderBottomColor: '#e5e7eb',
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },
  headerSubtitle: { fontSize: 13, color: '#6b7280', marginTop: 2 },
  content: { padding: 20, paddingBottom: 40 },

  micSection: { alignItems: 'center', marginVertical: 24 },
  micButton: {
    width: 88, height: 88, borderRadius: 44, backgroundColor: '#16a34a',
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#16a34a', shadowOpacity: 0.3, shadowRadius: 12, elevation: 6,
  },
  micButtonActive: { backgroundColor: '#dc2626' },
  micIcon: { fontSize: 16, color: '#fff', fontWeight: '700' },
  micHint: { marginTop: 12, fontSize: 13, color: '#6b7280' },

  textInput: {
    backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#e5e7eb',
    padding: 14, fontSize: 15, minHeight: 90, textAlignVertical: 'top',
  },
  submitButton: {
    backgroundColor: '#111827', borderRadius: 12, paddingVertical: 15,
    alignItems: 'center', marginTop: 14,
  },
  submitButtonDisabled: { backgroundColor: '#d1d5db' },
  submitButtonText: { color: '#fff', fontSize: 15, fontWeight: '700' },

  examplesSection: { marginTop: 32 },
  examplesTitle: { fontSize: 12, fontWeight: '600', color: '#9ca3af', marginBottom: 10, textTransform: 'uppercase' },
  exampleChip: {
    backgroundColor: '#fff', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12,
    marginBottom: 8, borderWidth: 1, borderColor: '#e5e7eb',
  },
  exampleText: { fontSize: 13, color: '#4b5563', fontStyle: 'italic' },
})
