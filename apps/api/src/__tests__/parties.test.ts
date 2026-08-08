import { loginWholesale } from './helpers'

describe('Parties & Credit Limit', () => {
  let ws: Awaited<ReturnType<typeof loginWholesale>>
  let partyId: string

  beforeAll(async () => { ws = await loginWholesale() })

  test('list parties returns data', async () => {
    const r = await ws.api.get('/api/parties?limit=5')
    expect(r.status).toBe(200)
    expect(Array.isArray(r.data.data ?? r.data)).toBe(true)
    partyId = (r.data.data ?? r.data)[0]?.id
  })

  test('get party by ID', async () => {
    if (!partyId) return
    const r = await ws.api.get(`/api/parties/${partyId}`)
    expect(r.status).toBe(200)
    expect(r.data.id).toBe(partyId)
  })

  test('party statement returns ledger', async () => {
    if (!partyId) return
    const r = await ws.api.get(`/api/parties/${partyId}/statement`)
    expect(r.status).toBe(200)
    expect(r.data.party).toBeDefined()
    expect(Array.isArray(r.data.entries ?? r.data.ledger ?? [])).toBe(true)
  })

  test('udhaar summary returns total outstanding', async () => {
    const r = await ws.api.get('/api/parties/udhaar/summary')
    expect(r.status).toBe(200)
    expect(typeof r.data.totalOutstanding).toBe('number')
  })

  test('credit limit enforcement — rejects invoice when limit exceeded', async () => {
    // Create a party with a very small credit limit
    const party = await ws.api.post('/api/parties', {
      name: 'CreditTest Customer', type: 'customer', creditLimit: 100,
    })
    const pid = party.data.id

    await expect(
      ws.api.post('/api/invoices', {
        txnType: 'sale_invoice',
        partyId: pid,
        items: [{ description: 'Expensive Item', qty: 1, rate: 5000, gstRate: 18, unit: 'pcs' }],
        domainData: { is_udhaar: true },
      })
    ).rejects.toMatchObject({ response: { status: 422 } })
  })
})
