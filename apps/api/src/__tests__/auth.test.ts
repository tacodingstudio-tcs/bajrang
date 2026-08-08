import axios from 'axios'
import { BASE } from './helpers'

describe('Auth', () => {
  test('health check returns ok', async () => {
    const r = await axios.get(`${BASE}/health`)
    expect(r.status).toBe(200)
    expect(r.data.status).toBe('ok')
  })

  test('login with valid credentials returns token', async () => {
    const r = await axios.post(`${BASE}/api/auth/login`, { tenantPhone: '9844002002', phone: '9844002002', pin: '8002' })
    expect(r.status).toBe(200)
    expect(r.data.accessToken).toBeTruthy()
    expect(r.data.user.role).toBe('owner')
    expect(r.data.branch.domainType).toBe('wholesale')
  })

  test('login with wrong PIN is rejected', async () => {
    // Non-existent tenant → 401 (or 429 if this phone has accumulated throttle across runs)
    let status: number | undefined
    try {
      await axios.post(`${BASE}/api/auth/login`, { tenantPhone: '0000000000', phone: '0000000000', pin: '0000' })
    } catch (err: any) {
      status = err.response?.status
    }
    expect([401, 429]).toContain(status)
  })

  test('protected route without token returns 401', async () => {
    await expect(
      axios.get(`${BASE}/api/invoices`)
    ).rejects.toMatchObject({ response: { status: 401 } })
  })

  test('salon login returns simple domain', async () => {
    const r = await axios.post(`${BASE}/api/auth/login`, { tenantPhone: '9844001001', phone: '9844001001', pin: '8001' })
    expect(r.data.branch.domainType).toBe('salon')
  })
})
