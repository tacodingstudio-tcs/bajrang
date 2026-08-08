// apps/mobile/src/lib/aiApi.ts
// Thin wrapper around the AI endpoints. AI billing REQUIRES network —
// it's the one feature in the app that cannot work offline, since it
// needs the Claude API call on the backend. The UI must make this
// limitation obvious rather than silently failing.

import { apiClient } from './apiClient'

export interface ResolvedLineItemDTO {
  raw: { name: string; qty: number; unit: string; rate: number | null; discountPct: number }
  matchedProduct: {
    id: string; name: string; salePrice: number; gstRate: number
    unit: string; hsnSacCode: string | null
  } | null
  matchConfidence: number
  needsConfirmation: boolean
}

export interface InvoiceDraftDTO {
  intent: 'CREATE_INVOICE' | 'ADD_PAYMENT' | 'CHECK_STOCK' | 'QUERY_REPORT' | 'CREATE_PARTY' | 'UNKNOWN'
  resolvedParty: { id: string; name: string; matchConfidence: number } | null
  partyHint: string | null
  resolvedItems: ResolvedLineItemDTO[]
  calculatedTotals: {
    subtotal: number; discountTotal: number; taxableTotal: number
    cgstTotal: number; sgstTotal: number; igstTotal: number
    roundOff: number; grandTotal: number
  } | null
  dateResolved: string
  notes: string | null
  overallConfidence: number
  needsReview: boolean
  ambiguities: string[]
}

export const aiApi = {
  extractInvoice: (text: string): Promise<InvoiceDraftDTO> =>
    apiClient.post('/ai/extract-invoice', { text }).then((r) => r.data),
}
