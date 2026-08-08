// apps/mobile/src/components/BarcodeScannerModal.tsx
//
// Camera-based barcode scanner using react-native-camera-kit.
// Falls back gracefully if camera permission is denied — cashier
// can always type the barcode manually in the search box instead.

import React, { useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native'
import { Camera, CameraType } from 'react-native-camera-kit'

interface Props {
  onScan:  (code: string) => void
  onClose: () => void
}

export function BarcodeScannerModal({ onScan, onClose }: Props) {
  const [hasScanned, setHasScanned] = useState(false)

  function handleReadCode(event: any) {
    // Debounce: camera fires multiple read events for the same code rapidly
    if (hasScanned) return
    setHasScanned(true)

    const code = event?.nativeEvent?.codeStringValue
    if (code) {
      onScan(code)
    }

    // Reset after a short delay in case onScan doesn't close the modal
    setTimeout(() => setHasScanned(false), 1500)
  }

  return (
    <View style={styles.container}>
      <Camera
        style={StyleSheet.absoluteFill}
        cameraType={CameraType.Back}
        scanBarcode
        onReadCode={handleReadCode}
        showFrame
        laserColor="#16a34a"
        frameColor="#ffffff"
      />

      <View style={styles.overlay}>
        <View style={styles.scanBox} />
        <Text style={styles.hint}>Point camera at barcode</Text>
      </View>

      <TouchableOpacity style={styles.closeButton} onPress={onClose}>
        <Text style={styles.closeButtonText}>Cancel</Text>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanBox: {
    width: 250,
    height: 150,
    borderWidth: 2,
    borderColor: '#16a34a',
    borderRadius: 12,
    backgroundColor: 'transparent',
  },
  hint: {
    color: '#fff',
    fontSize: 14,
    marginTop: 16,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  closeButton: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 50 : 30,
    alignSelf: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 30,
  },
  closeButtonText: { fontSize: 15, fontWeight: '700', color: '#111827' },
})
