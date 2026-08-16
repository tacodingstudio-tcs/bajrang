// src/lib/api.ts
// Axios instance with JWT auth interceptor.
// All API calls go through this — never use fetch() directly.

import axios, { type AxiosError } from 'axios'
import toast from 'react-hot-toast'
import { useAuthStore } from '@/store/auth.store'

export const api = axios.create({
  baseURL: '/api',          // proxied to localhost:3000 by Vite in dev
  timeout: 15_000,
  headers: { 'Content-Type': 'application/json' },
})

// ── Request interceptor: attach JWT token ─────────────────────────────────────
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken
  if (token) {
    config.headers['Authorization'] = `Bearer ${token}`
  }
  return config
})

// ── Silent refresh on 401 (mirrors apps/mobile/src/lib/apiClient.ts) ──────────
// An owner/manager often keeps the dashboard open in a browser tab for an
// entire workday. Without this, every 15 minutes their next click would
// bounce them to /login with no warning — refreshing transparently in the
// background means the access token's short lifetime is invisible to them.
let isRefreshing = false
let refreshSubscribers: Array<(token: string) => void> = []

function subscribeToRefresh(cb: (token: string) => void) {
  refreshSubscribers.push(cb)
}
function notifyRefreshSubscribers(token: string) {
  refreshSubscribers.forEach((cb) => cb(token))
  refreshSubscribers = []
}

async function performRefresh(): Promise<string | null> {
  const refreshToken = useAuthStore.getState().refreshToken
  if (!refreshToken) return null

  try {
    // Plain axios, not `api` — avoids re-entering this same interceptor
    // chain if /auth/refresh itself ever returns a 401.
    const response = await axios.post('/api/auth/refresh', { refreshToken })
    const { accessToken, refreshToken: newRefreshToken, accessTokenExpiresIn } = response.data

    // Update Zustand store so components reading from the store get the new token immediately.
    // The persist middleware will sync this back to localStorage automatically.
    useAuthStore.getState().setTokens(accessToken, newRefreshToken, accessTokenExpiresIn)

    return accessToken
  } catch {
    useAuthStore.getState().logout()
    return null
  }
}

// ── Response interceptor: handle errors globally ──────────────────────────────
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<{ error?: string; message?: string; issues?: Record<string, string[]> }>) => {
    const originalRequest = error.config as (typeof error.config & { _retry?: boolean }) | undefined

    if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
      originalRequest._retry = true

      if (isRefreshing) {
        return new Promise((resolve) => {
          subscribeToRefresh((newToken) => {
            if (!newToken) { window.location.href = '/login'; return }
            originalRequest.headers!['Authorization'] = `Bearer ${newToken}`
            resolve(api(originalRequest))
          })
        })
      }

      isRefreshing = true
      const newToken = await performRefresh()
      isRefreshing = false

      if (newToken) {
        notifyRefreshSubscribers(newToken)
        originalRequest.headers!['Authorization'] = `Bearer ${newToken}`
        return api(originalRequest)
      }

      // Refresh token itself is invalid/expired — no way to recover silently.
      notifyRefreshSubscribers('')
      window.location.href = '/login'
      return Promise.reject(error)
    }

    if (error.response?.status === 422) {
      // Zod validation errors — show field-level messages
      const issues = error.response.data?.issues
      if (issues) {
        const msgs = Object.entries(issues)
          .map(([field, errs]) => `${field}: ${errs.join(', ')}`)
          .join('\n')
        toast.error(`Validation error:\n${msgs}`, { duration: 5000 })
      }
      return Promise.reject(error)
    }

    if (error.response?.status === 409) {
      toast.error(error.response.data?.error ?? 'Duplicate entry')
      return Promise.reject(error)
    }

    if (error.response?.status === 404) {
      // Let individual queries handle 404 — don't show global toast
      return Promise.reject(error)
    }

    if (!error.response || error.code === 'ERR_NETWORK') {
      toast.error('Connection error — check your internet')
      return Promise.reject(error)
    }

    // Generic server error
    const msg = error.response.data?.error ?? error.response.data?.message ?? 'Something went wrong'
    toast.error(msg)
    return Promise.reject(error)
  }
)

// ── Typed API helpers ──────────────────────────────────────────────────────────
// Each function corresponds to one API endpoint.
// Return types are inferred — add explicit interfaces as needed.

export const authApi = {
  login: (tenantPhone: string, phone: string, pin: string) =>
    api.post('/auth/login', { tenantPhone, phone, pin }).then((r) => r.data),

  // Dev-only — powers the Login page's "Dev credentials" panel so newly
  // created test users show up automatically. Backend returns 404 outside
  // NODE_ENV !== 'production'.
  devUsers: (): Promise<{ tenantPhone: string | null; users: { name: string; phone: string; role: string; pin: string }[] }> =>
    api.get('/admin/dev-users').then((r) => r.data),

  refresh: (refreshToken: string) =>
    api.post('/auth/refresh', { refreshToken }).then((r) => r.data),

  logout: (refreshToken: string) =>
    api.post('/auth/logout', { refreshToken }).then((r) => r.data),

  logoutAllDevices: () =>
    api.post('/auth/logout-all-devices').then((r) => r.data),

  switchBranch: (branchId: string) =>
    api.post('/auth/switch-branch', { branchId }).then((r) => r.data),
}

export const invoiceApi = {
  list: (params?: Record<string, unknown>) =>
    api.get('/invoices', { params }).then((r) => r.data),

  get: (id: string) =>
    api.get(`/invoices/${id}`).then((r) => r.data),

  create: (data: unknown) =>
    api.post('/invoices', data, {
      headers: { 'Idempotency-Key': crypto.randomUUID() },
    }).then((r) => r.data),

  cancel: (id: string) =>
    api.post(`/invoices/${id}/cancel`).then((r) => r.data),

  recordPayment: (id: string, data: unknown) =>
    api.post(`/invoices/${id}/payment`, data, {
      headers: { 'Idempotency-Key': crypto.randomUUID() },
    }).then((r) => r.data),

  dailySummary: () =>
    api.get('/invoices/summary/daily').then((r) => r.data),

  weeklySummary: () =>
    api.get('/invoices/summary/weekly').then((r) => r.data),

  pdfUrl: (id: string) => `/api/invoices/${id}/pdf`,

  sendReceipt: (id: string, data: { channel: 'whatsapp' | 'email'; to?: string; businessName?: string }) =>
    api.post(`/invoices/${id}/send-receipt`, data).then((r) => r.data),

  createReturn: (id: string, data?: unknown) =>
    api.post(`/invoices/${id}/return`, data ?? {}).then((r) => r.data),

  createDebitNote: (id: string, data?: unknown) =>
    api.post(`/invoices/${id}/debit-note`, data ?? {}).then((r) => r.data),

  generateIrn: (id: string) =>
    api.post(`/invoices/${id}/generate-irn`).then((r) => r.data),

  generateEway: (id: string, data: unknown) =>
    api.post(`/invoices/${id}/generate-eway`, data).then((r) => r.data),

  linkedDocs: (id: string) =>
    api.get(`/invoices/${id}/linked-docs`).then((r) => r.data),
}

export const tenantApi = {
  gstinLookup: (gstin: string) =>
    api.get(`/tenants/gstin/${encodeURIComponent(gstin)}`).then((r) => r.data),
}

export const productApi = {
  list: (params?: Record<string, unknown>) =>
    api.get('/products', { params }).then((r) => r.data),

  get: (id: string) =>
    api.get(`/products/${id}`).then((r) => r.data),

  create: (data: unknown) =>
    api.post('/products', data).then((r) => r.data),

  update: (id: string, data: unknown) =>
    api.patch(`/products/${id}`, data).then((r) => r.data),

  delete: (id: string) =>
    api.delete(`/products/${id}`).then((r) => r.data),

  byBarcode: (code: string) =>
    api.get(`/products/barcode/${code}`).then((r) => r.data),

  imageUrl: (id: string) => {
    const token = (JSON.parse(localStorage.getItem('billing-auth') ?? '{}')?.state?.accessToken ?? '') as string
    return `/api/products/${id}/image${token ? `?token=${token}` : ''}`
  },

  uploadImage: (id: string, imageBase64: string, imageMime: string) =>
    api.put(`/products/${id}/image`, { imageBase64, imageMime }).then((r) => r.data),

  suggestHSN: (id: string) =>
    api.post(`/products/${id}/suggest-hsn`).then((r) => r.data),

  confirmHSN: (id: string, hsnCode: string, gstRate: number) =>
    api.post(`/products/${id}/confirm-hsn`, { hsnCode, gstRate }).then((r) => r.data),

  adjustStock: (id: string, qty: number, reason: string) =>
    api.post(`/products/${id}/stock-adjustment`, { qty, reason }).then((r) => r.data),

  lowStock: () =>
    api.get('/products/low-stock').then((r) => r.data),

  bulkImport: (rows: unknown[]) =>
    api.post('/products/bulk-import', { rows }).then((r) => r.data),
}

export const expenseApi = {
  list: (params?: Record<string, unknown>) =>
    api.get('/expenses', { params }).then((r) => r.data),

  get: (id: string) =>
    api.get(`/expenses/${id}`).then((r) => r.data),

  create: (data: unknown) =>
    api.post('/expenses', data).then((r) => r.data),

  update: (id: string, data: unknown) =>
    api.patch(`/expenses/${id}`, data).then((r) => r.data),

  delete: (id: string) =>
    api.delete(`/expenses/${id}`).then((r) => r.data),

  summary: (params?: { from?: string; to?: string; branchId?: string }) =>
    api.get('/expenses/summary', { params }).then((r) => r.data),

  categories: () =>
    api.get('/expenses/categories').then((r) => r.data),
}

export const partyApi = {
  list: (params?: Record<string, unknown>) =>
    api.get('/parties', { params }).then((r) => r.data),

  get: (id: string) =>
    api.get(`/parties/${id}`).then((r) => r.data),

  create: (data: unknown) =>
    api.post('/parties', data).then((r) => r.data),

  update: (id: string, data: unknown) =>
    api.patch(`/parties/${id}`, data).then((r) => r.data),

  statement: (id: string, params?: Record<string, unknown>) =>
    api.get(`/parties/${id}/statement`, { params }).then((r) => r.data),

  udhaarSummary: () =>
    api.get('/parties/udhaar/summary').then((r) => r.data),
}

export const stockApi = {
  all: () => api.get('/stock').then((r) => r.data),
}

export const supplierApi = {
  list: (params?: Record<string, unknown>) =>
    api.get('/inventory/suppliers', { params }).then((r) => r.data),

  get: (id: string) =>
    api.get(`/inventory/suppliers/${id}`).then((r) => r.data),

  create: (data: unknown) =>
    api.post('/inventory/suppliers', data).then((r) => r.data),

  update: (id: string, data: unknown) =>
    api.patch(`/inventory/suppliers/${id}`, data).then((r) => r.data),

  delete: (id: string) =>
    api.delete(`/inventory/suppliers/${id}`).then((r) => r.data),
}

export const purchaseOrderApi = {
  list: (params?: Record<string, unknown>) =>
    api.get('/inventory/purchase-orders', { params }).then((r) => r.data),

  get: (id: string) =>
    api.get(`/inventory/purchase-orders/${id}`).then((r) => r.data),

  create: (data: unknown) =>
    api.post('/inventory/purchase-orders', data).then((r) => r.data),

  update: (id: string, data: unknown) =>
    api.patch(`/inventory/purchase-orders/${id}`, data).then((r) => r.data),

  cancel: (id: string) =>
    api.post(`/inventory/purchase-orders/${id}/cancel`).then((r) => r.data),

  recordPayment: (id: string, data: unknown) =>
    api.post(`/inventory/purchase-orders/${id}/payment`, data).then((r) => r.data),
}

export const grnApi = {
  list: (params?: Record<string, unknown>) =>
    api.get('/grn', { params }).then((r) => r.data),

  get: (id: string) =>
    api.get(`/grn/${id}`).then((r) => r.data),

  create: (data: unknown) =>
    api.post('/grn', data).then((r) => r.data),

  cancel: (id: string) =>
    api.post(`/grn/${id}/cancel`).then((r) => r.data),

  matchCheck: (invoiceId: string) =>
    api.get(`/grn/match/${invoiceId}`).then((r) => r.data),
}

export const stockAdjustmentApi = {
  list: (params?: Record<string, unknown>) =>
    api.get('/inventory/adjustments', { params }).then((r) => r.data),

  get: (id: string) =>
    api.get(`/inventory/adjustments/${id}`).then((r) => r.data),

  create: (data: unknown) =>
    api.post('/inventory/adjustments', data).then((r) => r.data),

  post: (id: string) =>
    api.post(`/inventory/adjustments/${id}/post`).then((r) => r.data),

  cancel: (id: string) =>
    api.post(`/inventory/adjustments/${id}/cancel`).then((r) => r.data),
}

export const stockTransferApi = {
  list: (params?: Record<string, unknown>) =>
    api.get('/inventory/transfers', { params }).then((r) => r.data),

  get: (id: string) =>
    api.get(`/inventory/transfers/${id}`).then((r) => r.data),

  create: (data: unknown) =>
    api.post('/inventory/transfers', data).then((r) => r.data),

  dispatch: (id: string) =>
    api.post(`/inventory/transfers/${id}/dispatch`).then((r) => r.data),

  receive: (id: string, data: unknown) =>
    api.post(`/inventory/transfers/${id}/receive`, data).then((r) => r.data),
}

export const stockSummaryApi = {
  list: (params?: Record<string, unknown>) =>
    api.get('/stock', { params }).then((r) => r.data),

  ledger: (productId: string, params?: Record<string, unknown>) =>
    api.get(`/stock/ledger/${productId}`, { params }).then((r) => r.data),

  expiryAlerts: (days = 90) =>
    api.get('/stock/expiry-alerts', { params: { days } }).then((r) => r.data),
}

export const branchApi = {
  list: () =>
    api.get('/branches').then((r) => r.data),

  create: (data: unknown) =>
    api.post('/branches', data).then((r) => r.data),

  update: (id: string, data: unknown) =>
    api.patch(`/branches/${id}`, data).then((r) => r.data),

  deactivate: (id: string) =>
    api.post(`/branches/${id}/deactivate`).then((r) => r.data),

  activate: (id: string) =>
    api.post(`/branches/${id}/activate`).then((r) => r.data),
}

export const featuresApi = {
  get: () =>
    api.get('/features').then((r) => r.data),

  update: (data: { contractsEnabled?: boolean; deliveriesEnabled?: boolean }) =>
    api.patch('/features', data).then((r) => r.data),
}

export const websiteApi = {
  get: () =>
    api.get('/website').then((r) => r.data),

  updateSection: (section: string, data: unknown) =>
    api.patch(`/website/${section}`, data).then((r) => r.data),
}

export const aiApi = {
  extractInvoice: (text: string) =>
    api.post('/ai/extract-invoice', { text }).then((r) => r.data),

  scanBill: (imageBase64: string, mediaType = 'image/jpeg') =>
    api.post('/ai/scan-bill', { imageBase64, mediaType }).then((r) => r.data),

  generateReminders: () =>
    api.post('/ai/reminders/generate').then((r) => r.data),

  pendingReminders: () =>
    api.get('/ai/reminders/pending').then((r) => r.data),

  approveReminder: (id: string) =>
    api.post(`/ai/reminders/${id}/approve`).then((r) => r.data),

  rejectReminder: (id: string) =>
    api.post(`/ai/reminders/${id}/reject`).then((r) => r.data),

  insight: () =>
    api.get('/ai/insight').then((r) => r.data),

  reorder: () =>
    api.get('/ai/reorder').then((r) => r.data),

  checkInvoice: (data: { partyId: string | null; grandTotal: number; items: any[] }) =>
    api.post('/ai/check-invoice', data).then((r) => r.data),

  creditRisk: (partyId: string) =>
    api.get(`/ai/credit-risk/${partyId}`).then((r) => r.data),

  extractSupplierBill: (imageBase64: string, mediaType = 'image/jpeg') =>
    api.post('/ai/extract-supplier-bill', { imageBase64, mediaType }).then((r) => r.data),

  categorizeExpense: (description: string, amount: number) =>
    api.post('/ai/categorize-expense', { description, amount }).then((r) => r.data),

  cashflowForecast: (horizon: 7 | 30 = 7) =>
    api.get('/ai/cashflow-forecast', { params: { horizon } }).then((r) => r.data),

  partyDuplicates: () =>
    api.get('/ai/party-duplicates').then((r) => r.data),

  priceAnomaly: (items: Array<{ productId: string; rate: number }>) =>
    api.post('/ai/price-anomaly', { items }).then((r) => r.data),

  gstSummaryAI: (month: string) =>
    api.get('/ai/gst-summary', { params: { month } }).then((r) => r.data),

  demandForecast: () =>
    api.get('/ai/demand-forecast').then((r) => r.data),

  chat: (question: string, history: Array<{ role: 'user' | 'assistant'; content: string }>) =>
    api.post('/ai/chat', { question, history }).then((r) => r.data),
}

export const analyticsApi = {
  dashboard: (params?: { period?: string; compareWith?: string }) =>
    api.get('/analytics/dashboard', { params }).then((r) => r.data),

  revenueTrend: (params?: { period?: string; groupBy?: string }) =>
    api.get('/analytics/revenue-trend', { params }).then((r) => r.data),

  marginReport: (params?: { period?: string }) =>
    api.get('/analytics/margin-report', { params }).then((r) => r.data),

  topCustomers: (params?: { period?: string; limit?: number }) =>
    api.get('/analytics/top-customers', { params }).then((r) => r.data),

  gstSummary: (params?: { month?: string }) =>
    api.get('/analytics/gst-summary', { params }).then((r) => r.data),

  salesVsPurchases: (params?: { months?: number }) =>
    api.get('/analytics/sales-vs-purchases', { params }).then((r) => r.data),
}

export const reportsApi = {
  gstr1: (params?: { month?: string }) =>
    api.get('/reports/gstr1', { params }).then((r) => r.data),

  dayBook: (params?: { date?: string }) =>
    api.get('/reports/day-book', { params }).then((r) => r.data),

  stockSummary: (params?: { categoryId?: string; lowStockOnly?: boolean }) =>
    api.get('/reports/stock-summary', { params }).then((r) => r.data),

  plStatement: (params?: { from?: string; to?: string }) =>
    api.get('/reports/pl-statement', { params }).then((r) => r.data),

  monthlyComparison: () =>
    api.get('/reports/monthly-comparison').then((r) => r.data),

  cashRegisterGet: (params?: { date?: string }) =>
    api.get('/reports/cash-register', { params }).then((r) => r.data),

  cashRegisterSave: (data: {
    date: string; systemCash: number; countedCash: number
    notes?: string; closedBy?: string
  }) => api.post('/reports/cash-register', data).then((r) => r.data),

  bankAccounts: () =>
    api.get('/reports/bank-accounts').then((r) => r.data),

  bankAccountCreate: (data: {
    name: string; bankName?: string; accountNumber?: string; openingBalance?: number
  }) => api.post('/reports/bank-accounts', data).then((r) => r.data),

  bankReconGet: (params: { month: string; bankAccountId?: string }) =>
    api.get('/reports/bank-reconciliation', { params }).then((r) => r.data),

  bankReconSave: (data: {
    month: string; bankAccountId?: string
    statementBalance: number; bookBalance: number; notes?: string
  }) => api.post('/reports/bank-reconciliation', data).then((r) => r.data),

  hotelOccupancy: (params: { from: string; to: string }) =>
    api.get('/reports/hotel-occupancy', { params }).then((r) => r.data),
}

export const staffApi = {
  users: () =>
    api.get('/staff/users').then((r) => r.data),

  getAttendance: (params: { date?: string; month?: string; userId?: string }) =>
    api.get('/staff/attendance', { params }).then((r) => r.data),

  recordAttendance: (data: {
    userId: string; date: string; clockIn?: string; clockOut?: string
    status?: string; notes?: string
  }) => api.post('/staff/attendance', data).then((r) => r.data),

  updateAttendance: (id: string, data: { clockOut?: string; status?: string; notes?: string }) =>
    api.patch(`/staff/attendance/${id}`, data).then((r) => r.data),

  getShifts: (params: { from?: string; to?: string; userId?: string }) =>
    api.get('/staff/shifts', { params }).then((r) => r.data),

  createShift: (data: {
    userId: string; date: string; shiftType?: string
    shiftStart?: string; shiftEnd?: string; notes?: string
  }) => api.post('/staff/shifts', data).then((r) => r.data),

  deleteShift: (id: string) =>
    api.delete(`/staff/shifts/${id}`).then((r) => r.data),
}

export const deliveryApi = {
  list: (params?: { status?: string; date?: string; page?: number }) =>
    api.get('/deliveries', { params }).then((r) => r.data),

  get: (id: string) =>
    api.get(`/deliveries/${id}`).then((r) => r.data),

  create: (data: {
    invoiceId?: string; partyId?: string
    deliveryAddress?: { line1?: string; city?: string; pincode?: string; landmark?: string }
    deliveryPersonName?: string; deliveryPersonPhone?: string
    notes?: string; scheduledAt?: string
  }) => api.post('/deliveries', data).then((r) => r.data),

  update: (id: string, data: {
    status?: string; deliveryPersonName?: string; deliveryPersonPhone?: string
    notes?: string; deliveryAddress?: object
  }) => api.patch(`/deliveries/${id}`, data).then((r) => r.data),

  summaryToday: () =>
    api.get('/deliveries/summary/today').then((r) => r.data),
}

export const categoryApi = {
  list: () =>
    api.get('/categories').then((r) => r.data),

  create: (data: { name: string; slug?: string; icon?: string; color?: string; parentId?: string; sortOrder?: number }) =>
    api.post('/categories', data).then((r) => r.data),

  update: (id: string, data: { name?: string; icon?: string; color?: string; sortOrder?: number; isActive?: boolean }) =>
    api.patch(`/categories/${id}`, data).then((r) => r.data),

  remove: (id: string) =>
    api.delete(`/categories/${id}`).then((r) => r.data),
}

export const usersApi = {
  list: (params?: { role?: string; isActive?: boolean; search?: string }) =>
    api.get('/users', { params }).then((r) => r.data),

  create: (data: {
    name: string; phone: string; pin: string;
    role?: string; branchIds?: string[]; email?: string; lang?: string
  }) => api.post('/users', data).then((r) => r.data),

  resetPin: (id: string, pin: string) =>
    api.post(`/users/${id}/reset-pin`, { pin }).then((r) => r.data),

  deactivate: (id: string) =>
    api.post(`/users/${id}/deactivate`).then((r) => r.data),

  activate: (id: string) =>
    api.post(`/users/${id}/activate`).then((r) => r.data),

  update: (id: string, data: { name?: string; email?: string; role?: string; branchIds?: string[]; lang?: string }) =>
    api.patch(`/users/${id}`, data).then((r) => r.data),

  setAiAccess: (id: string, aiEnabled: boolean) =>
    api.patch(`/users/${id}/ai-access`, { aiEnabled }).then((r) => r.data),
}

export const broadcastApi = {
  getContacts: (params?: { type?: string; minSpend?: number; minLoyalty?: number; search?: string }) =>
    api.get('/broadcasts/contacts', { params }).then((r) => r.data),

  getCelebrations: (days = 7) =>
    api.get('/broadcasts/celebrations', { params: { days } }).then((r) => r.data),
}

export const brandApi = {
  list: () =>
    api.get('/brands').then((r) => r.data),

  create: (data: { name: string; slug?: string }) =>
    api.post('/brands', data).then((r) => r.data),

  update: (id: string, data: { name?: string; isActive?: boolean }) =>
    api.patch(`/brands/${id}`, data).then((r) => r.data),
}

export const galleryApi = {
  list: (params?: Record<string, unknown>) =>
    api.get('/gallery', { params }).then((r) => r.data),

  get: (id: string) =>
    api.get(`/gallery/${id}`).then((r) => r.data),

  upload: (data: {
    imageData:  string
    thumbData?: string
    caption?:   string
    tags?:      string[]
    partyId?:   string
    invoiceId?: string
    domainType: string
  }) => api.post('/gallery', data).then((r) => r.data),

  update: (id: string, data: { caption?: string; tags?: string[] }) =>
    api.patch(`/gallery/${id}`, data).then((r) => r.data),

  remove: (id: string) =>
    api.delete(`/gallery/${id}`).then((r) => r.data),
}

export const contractApi = {
  list: (params?: Record<string, unknown>) =>
    api.get('/contracts', { params }).then((r) => r.data),

  get: (id: string) =>
    api.get(`/contracts/${id}`).then((r) => r.data),

  create: (data: unknown) =>
    api.post('/contracts', data).then((r) => r.data),

  update: (id: string, data: unknown) =>
    api.patch(`/contracts/${id}`, data).then((r) => r.data),

  pause: (id: string) =>
    api.post(`/contracts/${id}/pause`).then((r) => r.data),

  resume: (id: string) =>
    api.post(`/contracts/${id}/resume`).then((r) => r.data),

  cancel: (id: string) =>
    api.delete(`/contracts/${id}`).then((r) => r.data),

  generateInvoice: (id: string) =>
    api.post(`/contracts/${id}/generate-invoice`).then((r) => r.data),
}

export const advanceApi = {
  list: (params?: Record<string, unknown>) =>
    api.get('/invoices/advances', { params }).then((r) => r.data),

  create: (data: unknown) =>
    api.post('/invoices/advances', data).then((r) => r.data),

  allocate: (id: string, allocations: Array<{ invoiceId: string; amount: number }>) =>
    api.post(`/invoices/advances/${id}/allocate`, { allocations }).then((r) => r.data),
}

export const approvalApi = {
  pending: () =>
    api.get('/invoices/pending-approvals').then((r) => r.data),

  requestApproval: (id: string) =>
    api.post(`/invoices/${id}/request-approval`).then((r) => r.data),

  approve: (id: string, note?: string) =>
    api.post(`/invoices/${id}/approve`, { note }).then((r) => r.data),

  reject: (id: string, note: string) =>
    api.post(`/invoices/${id}/reject`, { note }).then((r) => r.data),

  convert: (id: string, targetType?: string) =>
    api.post(`/invoices/${id}/convert`, { targetType }).then((r) => r.data),
}


export const hotelApi = {
  // Dashboard
  dashboard: () =>
    api.get('/hotel/dashboard').then((r) => r.data),

  // Rooms
  listRooms: (params?: Record<string, unknown>) =>
    api.get('/hotel/rooms', { params }).then((r) => r.data),
  getRoom: (id: string) =>
    api.get(`/hotel/rooms/${id}`).then((r) => r.data),
  createRoom: (data: unknown) =>
    api.post('/hotel/rooms', data).then((r) => r.data),
  updateRoom: (id: string, data: unknown) =>
    api.patch(`/hotel/rooms/${id}`, data).then((r) => r.data),
  deleteRoom: (id: string) =>
    api.delete(`/hotel/rooms/${id}`).then((r) => r.data),

  // Bookings
  listBookings: (params?: Record<string, unknown>) =>
    api.get('/hotel/bookings', { params }).then((r) => r.data),
  guestHistory: (phone: string, excludeBookingId?: string) =>
    api.get('/hotel/guests/history', { params: { phone, excludeBookingId } }).then((r) => r.data),
  getBooking: (id: string) =>
    api.get(`/hotel/bookings/${id}`).then((r) => r.data),
  createBooking: (data: unknown) =>
    api.post('/hotel/bookings', data).then((r) => r.data),
  updateBooking: (id: string, data: unknown) =>
    api.patch(`/hotel/bookings/${id}`, data).then((r) => r.data),

  // Check-in / Check-out
  checkIn: (id: string, data?: unknown) =>
    api.post(`/hotel/bookings/${id}/checkin`, data ?? {}).then((r) => r.data),
  checkOut: (id: string, data?: unknown) =>
    api.post(`/hotel/bookings/${id}/checkout`, data ?? {}).then((r) => r.data),

  // Folio charges
  addCharge: (bookingId: string, data: unknown) =>
    api.post(`/hotel/bookings/${bookingId}/charges`, data).then((r) => r.data),
  addChargesBulk: (bookingId: string, data: unknown) =>
    api.post(`/hotel/bookings/${bookingId}/charges/bulk`, data).then((r) => r.data),
  removeCharge: (bookingId: string, chargeId: string) =>
    api.delete(`/hotel/bookings/${bookingId}/charges/${chargeId}`).then((r) => r.data),

  // Housekeeping
  listHousekeeping: (params?: Record<string, unknown>) =>
    api.get('/hotel/housekeeping', { params }).then((r) => r.data),
  createHousekeepingTask: (data: unknown) =>
    api.post('/hotel/housekeeping', data).then((r) => r.data),
  updateHousekeepingTask: (id: string, data: unknown) =>
    api.patch(`/hotel/housekeeping/${id}`, data).then((r) => r.data),

  // Night audit
  nightAudit: () =>
    api.post('/hotel/night-audit').then((r) => r.data),

  // Availability calendar
  availability: (from: string, to: string) =>
    api.get('/hotel/availability', { params: { from, to } }).then((r) => r.data),
}

export const restaurantApi = {
  // Tables
  listTables: () =>
    api.get('/restaurant/tables').then((r) => r.data),
  createTable: (data: { tableNo: string; capacity: number; section?: string; notes?: string }) =>
    api.post('/restaurant/tables', data).then((r) => r.data),
  updateTable: (id: string, data: { tableNo?: string; capacity?: number; section?: string; notes?: string; isActive?: boolean }) =>
    api.patch(`/restaurant/tables/${id}`, data).then((r) => r.data),
  openTable: (id: string, guestCount: number) =>
    api.post(`/restaurant/tables/${id}/open`, { guestCount }).then((r) => r.data),
  freeTable: (id: string) =>
    api.post(`/restaurant/tables/${id}/free`).then((r) => r.data),
  setTableStatus: (id: string, status: 'available' | 'reserved' | 'cleaning') =>
    api.patch(`/restaurant/tables/${id}/status`, { status }).then((r) => r.data),
  transferTable: (fromTableId: string, toTableId: string) =>
    api.post('/restaurant/tables/transfer', { fromTableId, toTableId }).then((r) => r.data),
  getTableBill: (id: string) =>
    api.get(`/restaurant/tables/${id}/bill`).then((r) => r.data),

  // KOT
  fireKOT: (tableId: string, data: { items: unknown[]; notes?: string; station?: string }) =>
    api.post(`/restaurant/tables/${tableId}/kot`, data).then((r) => r.data),
  updateKOTStatus: (kotId: string, status: string) =>
    api.patch(`/restaurant/kot/${kotId}/status`, { status }).then((r) => r.data),
  cancelKOTItem: (kotId: string, itemIndex: number, reason: string) =>
    api.patch(`/restaurant/kot/${kotId}/cancel-item`, { itemIndex, reason }).then((r) => r.data),

  // Kitchen display + reporting
  kitchenQueue: (station?: string) =>
    api.get('/restaurant/kitchen', { params: station ? { station } : {} }).then((r) => r.data),
  shiftSummary: (date?: string) =>
    api.get('/restaurant/shift-summary', { params: date ? { date } : {} }).then((r) => r.data),
}

export const discountRulesApi = {
  list:   (params?: { active?: boolean }) =>
    api.get('/discount-rules', { params }).then((r) => r.data),
  create: (data: any) =>
    api.post('/discount-rules', data).then((r) => r.data),
  update: (id: string, data: any) =>
    api.patch(`/discount-rules/${id}`, data).then((r) => r.data),
  remove: (id: string) =>
    api.delete(`/discount-rules/${id}`).then((r) => r.data),
}

export const clinicApi = {
  // Visits
  listVisits: (partyId: string, params?: { from?: string; to?: string }) =>
    api.get('/clinic/visits', { params: { partyId, ...params } }).then((r) => r.data),
  createVisit: (data: any) =>
    api.post('/clinic/visits', data).then((r) => r.data),
  updateVisit: (id: string, data: any) =>
    api.patch(`/clinic/visits/${id}`, data).then((r) => r.data),
  deleteVisit: (id: string) =>
    api.delete(`/clinic/visits/${id}`).then((r) => r.data),

  // Documents
  listDocuments: (partyId: string, params?: { docType?: string }) =>
    api.get('/clinic/documents', { params: { partyId, ...params } }).then((r) => r.data),
  createDocument: (data: any) =>
    api.post('/clinic/documents', data).then((r) => r.data),
  updateDocument: (id: string, data: any) =>
    api.patch(`/clinic/documents/${id}`, data).then((r) => r.data),
  deleteDocument: (id: string) =>
    api.delete(`/clinic/documents/${id}`).then((r) => r.data),

  // Summary
  patientSummary: (partyId: string) =>
    api.get(`/clinic/patient/${partyId}/summary`).then((r) => r.data),
}

export const coachingApi = {
  // Daily Notes
  listNotes: (partyId: string, params?: { from?: string; to?: string }) =>
    api.get('/coaching/notes', { params: { partyId, ...params } }).then((r) => r.data),
  createNote: (data: { partyId: string; noteDate: string; subject?: string; covered: string; nextSession?: string }) =>
    api.post('/coaching/notes', data).then((r) => r.data),
  updateNote: (id: string, data: any) =>
    api.patch(`/coaching/notes/${id}`, data).then((r) => r.data),
  deleteNote: (id: string) =>
    api.delete(`/coaching/notes/${id}`).then((r) => r.data),

  // Weekly Reviews
  listReviews: (partyId: string, params?: { limit?: number }) =>
    api.get('/coaching/reviews', { params: { partyId, ...params } }).then((r) => r.data),
  upsertReview: (data: { partyId: string; weekStart: string; overallRating: number; strengths?: string; weaknesses?: string; parentNote?: string; targets?: string }) =>
    api.post('/coaching/reviews', data).then((r) => r.data),

  // Exams
  listExams: (params?: { batchName?: string; subject?: string; from?: string; to?: string }) =>
    api.get('/coaching/exams', { params }).then((r) => r.data),
  createExam: (data: { examDate: string; subject: string; examType?: string; maxMarks?: number; batchName?: string; notes?: string }) =>
    api.post('/coaching/exams', data).then((r) => r.data),
  updateExam: (id: string, data: any) =>
    api.patch(`/coaching/exams/${id}`, data).then((r) => r.data),
  deleteExam: (id: string) =>
    api.delete(`/coaching/exams/${id}`).then((r) => r.data),

  // Exam Scores
  getScores: (examId: string) =>
    api.get(`/coaching/exams/${examId}/scores`).then((r) => r.data),
  saveScores: (examId: string, scores: Array<{ partyId: string; marksObtained?: number | null; questionMarks?: Record<string, number | null>; errorTypes?: Record<string, string>; answerSheetUrl?: string | null; remarks?: string | null }>) =>
    api.put(`/coaching/exams/${examId}/scores`, { scores }).then((r) => r.data),
  scanSheet: (examId: string, imageBase64: string, partyId?: string, mediaType?: string) =>
    api.post(`/coaching/exams/${examId}/scan-sheet`, { imageBase64, partyId, mediaType: mediaType ?? 'image/jpeg' }).then((r) => r.data),
  saveExamPaper: (examId: string, paper: any) =>
    api.put(`/coaching/exams/${examId}/paper`, { paper }).then((r) => r.data),
  generateWeeklyExam: (weekId: string, excludeTopics: string[] = [], totalMarks = 100, specialNote = '') =>
    api.post('/coaching/exams/generate-weekly', { weekId, excludeTopics, totalMarks, specialNote }, { timeout: 120_000 }).then((r) => r.data),
  classAnalysis: (examId: string) =>
    api.post(`/coaching/exams/${examId}/class-analysis`, {}, { timeout: 60_000 }).then((r) => r.data),

  // Progress Summary
  studentProgress: (partyId: string) =>
    api.get(`/coaching/student/${partyId}/progress`).then((r) => r.data),

  // Monthly Plans
  listPlans: (params?: { monthYear?: string; batchName?: string; subject?: string }) =>
    api.get('/coaching/plans', { params }).then((r) => r.data),
  getPlan: (id: string) =>
    api.get(`/coaching/plans/${id}`).then((r) => r.data),
  createPlan: (data: { batchName: string; subject: string; monthYear: string; notes?: string; weeks?: any[] }) =>
    api.post('/coaching/plans', data).then((r) => r.data),
  updatePlan: (id: string, data: any) =>
    api.patch(`/coaching/plans/${id}`, data).then((r) => r.data),
  deletePlan: (id: string) =>
    api.delete(`/coaching/plans/${id}`).then((r) => r.data),
  updateWeek: (weekId: string, data: { title?: string; topics?: string[]; notes?: string }) =>
    api.patch(`/coaching/plan-weeks/${weekId}`, data).then((r) => r.data),
  planProgress: (planId: string) =>
    api.get(`/coaching/plans/${planId}/progress`).then((r) => r.data),

  // Topic Mastery
  getStudentMastery: (partyId: string, subject?: string) =>
    api.get(`/coaching/mastery/${partyId}`, { params: { subject } }).then((r) => r.data),
  setMastery: (data: { partyId: string; subject: string; topic: string; masteryLevel: number; notes?: string }) =>
    api.put('/coaching/mastery', data).then((r) => r.data),
  bulkSetMastery: (updates: Array<{ partyId: string; subject: string; topic: string; masteryLevel: number }>) =>
    api.put('/coaching/mastery/bulk', { updates }).then((r) => r.data),

  // Topic Notes
  getAllNotes: (filters?: { subject?: string; board?: string; standard?: string }) =>
    api.get('/coaching/topic-notes/all', { params: filters }).then((r) => r.data),
  deleteTopicNotes: (subject: string, topic: string) =>
    api.delete('/coaching/topic-notes', { params: { subject, topic } }).then((r) => r.data),
  getTopicNotes: (subject: string, topic: string) =>
    api.get('/coaching/topic-notes', { params: { subject, topic } }).then((r) => r.data),
  getPlanNotes: (planId: string) =>
    api.get(`/coaching/plans/${planId}/notes`).then((r) => r.data),
  scanTopicNotes: (data: { subject: string; topic: string; board?: string; standard?: string; images?: Array<{ base64: string; mediaType: string }>; imageBase64?: string; mediaType?: string }) =>
    api.post('/coaching/topic-notes/scan', data, { timeout: 120_000 }).then((r) => r.data),
  generateTopicNotes: (data: { subject: string; topic: string; board?: string; standard?: string }) =>
    api.post('/coaching/topic-notes/scan', data).then((r) => r.data),
  saveTopicNotes: (data: { subject: string; topic: string; board?: string; standard?: string; content: any }) =>
    api.put('/coaching/topic-notes', data).then((r) => r.data),
  getExperimentPlanner: () =>
    api.get('/coaching/experiment-planner').then((r) => r.data),
  saveExperimentPrep: (data: { weekId: string; subject: string; topic: string; itemStatus?: Record<string, boolean>; prepDone?: boolean; prepNotes?: string }) =>
    api.put('/coaching/experiment-prep', data).then((r) => r.data),
}

export const roboticsApi = {
  getProjects:    (status?: string) => api.get('/robotics/projects', { params: { status } }).then(r => r.data),
  getProject:     (id: string)      => api.get(`/robotics/projects/${id}`).then(r => r.data),
  getProjectsByPlan: (planId: string) => api.get(`/robotics/projects/by-plan/${planId}`).then(r => r.data),
  createProject:  (data: any)       => api.post('/robotics/projects', data).then(r => r.data),
  updateProject:  (id: string, data: any) => api.put(`/robotics/projects/${id}`, data).then(r => r.data),
  deleteProject:  (id: string)      => api.delete(`/robotics/projects/${id}`).then(r => r.data),
  saveProgress:   (data: any)       => api.put('/robotics/progress', data).then(r => r.data),
  generatePhaseKit: (id: string, data: any) => api.post(`/robotics/projects/${id}/phase-kit`, data, { timeout: 120_000 }).then(r => r.data),
  savePhaseKit:   (id: string, data: any) => api.put(`/robotics/projects/${id}/phase-kit`, data).then(r => r.data),
  getComponents:  ()                => api.get('/robotics/components').then(r => r.data),
  saveComponent:  (data: any)       => api.put('/robotics/components', data).then(r => r.data),
  deleteComponent:(name: string)    => api.delete(`/robotics/components/${encodeURIComponent(name)}`).then(r => r.data),
}
