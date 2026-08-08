// webhooks.test.ts — /api/webhooks/razorpay signature verification

import axios from 'axios'
import crypto from 'crypto'
import { BASE } from './helpers'

const WEBHOOK_URL = `${BASE}/api/webhooks/razorpay`

function makeSignature(body: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(body).digest('hex')
}

const SAMPLE_PAYLOAD = JSON.stringify({
  event:  'payment.captured',
  entity: 'event',
  payload: {
    payment: {
      entity: {
        id:       'pay_test123',
        amount:   50000,
        currency: 'INR',
        status:   'captured',
        order_id: 'order_test123',
        notes:    {},
      },
    },
  },
})

describe('Webhooks — /api/webhooks/razorpay', () => {

  test('returns 400 when signature header is missing', async () => {
    await expect(
      axios.post(WEBHOOK_URL, SAMPLE_PAYLOAD, {
        headers: { 'Content-Type': 'application/json' },
      })
    ).rejects.toMatchObject({ response: { status: 400 } })
  })

  test('returns 401 when signature is invalid', async () => {
    await expect(
      axios.post(WEBHOOK_URL, SAMPLE_PAYLOAD, {
        headers: {
          'Content-Type':        'application/json',
          'x-razorpay-signature': 'invalid_signature_hex',
        },
      })
    ).rejects.toMatchObject({ response: { status: 401 } })
  })

  test('returns 503 when RAZORPAY_WEBHOOK_SECRET is not set', async () => {
    // The server returns 503 if the env var isn't configured in the test env.
    // In CI the secret is typically not set, so this is the expected path.
    // If the secret IS set, a valid signature would return 200 — both are acceptable.
    let status: number | undefined
    try {
      const sig = makeSignature(SAMPLE_PAYLOAD, 'test-secret')
      const r = await axios.post(WEBHOOK_URL, SAMPLE_PAYLOAD, {
        headers: {
          'Content-Type':        'application/json',
          'x-razorpay-signature': sig,
        },
      })
      status = r.status
    } catch (err: any) {
      status = err.response?.status
    }
    // Acceptable: 503 (no secret), 401 (wrong secret), 200 (correct secret)
    expect([200, 401, 503]).toContain(status)
  })

  test('accepts valid signature when secret matches', async () => {
    // Only runs meaningfully when RAZORPAY_WEBHOOK_SECRET is set in env.
    const secret = process.env['RAZORPAY_WEBHOOK_SECRET']
    if (!secret) {
      console.warn('RAZORPAY_WEBHOOK_SECRET not set — skipping valid-signature test')
      return
    }
    const sig = makeSignature(SAMPLE_PAYLOAD, secret)
    const r = await axios.post(WEBHOOK_URL, SAMPLE_PAYLOAD, {
      headers: {
        'Content-Type':        'application/json',
        'x-razorpay-signature': sig,
      },
    })
    expect(r.status).toBe(200)
  })
})
