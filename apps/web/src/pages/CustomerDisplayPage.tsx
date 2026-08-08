// src/pages/CustomerDisplayPage.tsx
// Customer-facing display window — opened by cashier via window.open('/customer-display')
// Subscribes to BroadcastChannel('pos_display') for live cart updates.
// No auth required — this page is excluded from the ProtectedRoute.

import { useState, useEffect } from 'react'

interface CartItem {
  key: string
  description: string
  qty: number
  rate: number
  discountPct: number
  gstRate: number
  unit: string
}

interface DisplayMessage {
  items: CartItem[]
  grandTotal: number
  party: { name: string } | null
}

function calcItemTotal(item: CartItem) {
  const gross   = item.qty * item.rate
  const disc    = gross * (item.discountPct / 100)
  const taxable = gross - disc
  const gst     = taxable * (item.gstRate / 100)
  return taxable + gst
}

export function CustomerDisplayPage() {
  const [cart, setCart] = useState<DisplayMessage | null>(null)
  const [cleared, setCleared] = useState(false)

  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return
    const ch = new BroadcastChannel('pos_display')
    ch.onmessage = (e: MessageEvent<DisplayMessage>) => {
      const data = e.data
      if (!data.items || data.items.length === 0) {
        setCleared(true)
        setCart(null)
      } else {
        setCleared(false)
        setCart(data)
      }
    }
    return () => ch.close()
  }, [])

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #1e3a5f 0%, #0f2340 100%)',
      color: '#fff',
      fontFamily: 'system-ui, sans-serif',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Header */}
      <div style={{
        padding: '20px 32px',
        borderBottom: '1px solid rgba(255,255,255,0.1)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div style={{ fontSize: '22px', fontWeight: 700 }}>
          {cart?.party?.name ? `Welcome, ${cart.party.name}!` : 'Welcome!'}
        </div>
        <div style={{ fontSize: '13px', opacity: 0.6 }}>Customer Display</div>
      </div>

      {/* Body */}
      <div style={{ flex: 1, padding: '32px', display: 'flex', flexDirection: 'column' }}>
        {cleared ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ fontSize: '80px' }}>🙏</div>
            <div style={{ fontSize: '36px', fontWeight: 700, marginTop: '16px' }}>Thank you!</div>
            <div style={{ fontSize: '18px', opacity: 0.7, marginTop: '8px' }}>Please visit again</div>
          </div>
        ) : !cart ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', opacity: 0.4 }}>
            <div style={{ fontSize: '60px' }}>🛒</div>
            <div style={{ fontSize: '20px', marginTop: '16px' }}>Waiting for items…</div>
          </div>
        ) : (
          <>
            {/* Items table */}
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '16px' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid rgba(255,255,255,0.2)' }}>
                  <th style={{ textAlign: 'left', padding: '8px 0', opacity: 0.7, fontWeight: 500 }}>Item</th>
                  <th style={{ textAlign: 'center', padding: '8px 16px', opacity: 0.7, fontWeight: 500 }}>Qty</th>
                  <th style={{ textAlign: 'right', padding: '8px 0', opacity: 0.7, fontWeight: 500 }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {cart.items.map(item => (
                  <tr key={item.key} style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                    <td style={{ padding: '12px 0' }}>
                      <div style={{ fontWeight: 600 }}>{item.description}</div>
                      {item.discountPct > 0 && (
                        <div style={{ fontSize: '13px', opacity: 0.6, marginTop: '2px' }}>
                          {item.discountPct}% discount applied
                        </div>
                      )}
                    </td>
                    <td style={{ textAlign: 'center', padding: '12px 16px' }}>
                      {item.qty} {item.unit}
                    </td>
                    <td style={{ textAlign: 'right', padding: '12px 0', fontWeight: 600 }}>
                      ₹{calcItemTotal(item).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Grand total */}
            <div style={{
              marginTop: 'auto',
              paddingTop: '24px',
              borderTop: '2px solid rgba(255,255,255,0.2)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}>
              <div style={{ fontSize: '22px', opacity: 0.8 }}>Total Amount</div>
              <div style={{
                fontSize: '48px',
                fontWeight: 800,
                color: '#4ade80',
                letterSpacing: '-1px',
              }}>
                ₹{cart.grandTotal.toFixed(0)}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
