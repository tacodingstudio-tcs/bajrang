// discount-rules.test.ts — /api/discount-rules CRUD + type variants

import { loginWholesale } from './helpers'

describe('Discount Rules', () => {
  let ws: Awaited<ReturnType<typeof loginWholesale>>
  let ruleId: string
  let slabRuleId: string

  beforeAll(async () => {
    ws = await loginWholesale()
  })

  test('list discount rules returns an array', async () => {
    const r = await ws.api.get('/api/discount-rules')
    expect(r.status).toBe(200)
    expect(Array.isArray(r.data)).toBe(true)
  })

  test('create percentage discount rule', async () => {
    const r = await ws.api.post('/api/discount-rules', {
      name:     `Summer Sale ${Date.now()}`,
      type:     'percentage',
      priority: 10,
      action:   { discountPct: 15 },
    })
    expect(r.status).toBe(201)
    expect(r.data.id).toBeTruthy()
    expect(r.data.type).toBe('percentage')
    ruleId = r.data.id
  })

  test('create flat discount rule with date range', async () => {
    const r = await ws.api.post('/api/discount-rules', {
      name:      `Flat Off ${Date.now()}`,
      type:      'flat',
      action:    { discountAmt: 50 },
      validFrom: '2025-01-01',
      validTo:   '2025-12-31',
    })
    expect(r.status).toBe(201)
    expect(r.data.validFrom).toBeTruthy()
    expect(r.data.validTo).toBeTruthy()
  })

  test('create BOGO rule', async () => {
    const r = await ws.api.post('/api/discount-rules', {
      name:   `BOGO ${Date.now()}`,
      type:   'bogo',
      action: { freeQty: 1 },
    })
    expect(r.status).toBe(201)
    expect(r.data.type).toBe('bogo')
  })

  test('create qty_slab rule', async () => {
    const r = await ws.api.post('/api/discount-rules', {
      name: `Slab Rule ${Date.now()}`,
      type: 'qty_slab',
      action: {
        slabs: [
          { minQty: 10, discountPct: 5 },
          { minQty: 50, discountPct: 10 },
        ],
      },
    })
    expect(r.status).toBe(201)
    expect(r.data.type).toBe('qty_slab')
    slabRuleId = r.data.id
  })

  test('list active rules only', async () => {
    const r = await ws.api.get('/api/discount-rules?active=true')
    expect(r.status).toBe(200)
    expect(r.data.every((rule: any) => rule.isActive === true)).toBe(true)
  })

  test('patch rule — update priority and deactivate', async () => {
    const r = await ws.api.patch(`/api/discount-rules/${ruleId}`, {
      priority: 99,
      isActive: false,
    })
    expect(r.status).toBe(200)
    expect(r.data.priority).toBe(99)
    expect(r.data.isActive).toBe(false)
  })

  test('patch unknown rule returns 404', async () => {
    await expect(
      ws.api.patch('/api/discount-rules/00000000-0000-0000-0000-000000000000', { isActive: false })
    ).rejects.toMatchObject({ response: { status: 404 } })
  })

  test('delete slab rule', async () => {
    const r = await ws.api.delete(`/api/discount-rules/${slabRuleId}`)
    expect(r.status).toBe(204)
  })

  test('delete unknown rule returns 404', async () => {
    await expect(
      ws.api.delete('/api/discount-rules/00000000-0000-0000-0000-000000000000')
    ).rejects.toMatchObject({ response: { status: 404 } })
  })

  test('create rule with invalid type returns 400', async () => {
    await expect(
      ws.api.post('/api/discount-rules', { name: 'Bad', type: 'not_a_type' })
    ).rejects.toMatchObject({ response: { status: 422 } })
  })
})
