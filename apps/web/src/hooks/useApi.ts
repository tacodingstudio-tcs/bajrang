// src/hooks/useApi.ts
// React Query hooks that wrap every API call.
// Components import these hooks — never call api.* directly in components.

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  invoiceApi, productApi, partyApi, stockApi, tenantApi, aiApi,
  supplierApi, purchaseOrderApi, grnApi, stockAdjustmentApi, stockTransferApi, stockSummaryApi,
  expenseApi, branchApi, analyticsApi, reportsApi, staffApi, deliveryApi, usersApi, galleryApi,
  contractApi, advanceApi, approvalApi, discountRulesApi, coachingApi, clinicApi, roboticsApi,
  websiteApi, featuresApi,
} from '@/lib/api'
import { useAuthStore } from '@/store/auth.store'

// ── Query keys ──────────────────────────────────────────────────────────────
// Centralised so invalidation is consistent across the app

export const QK = {
  analyticsDashboard:    (params?: unknown) => ['analytics-dashboard', params],
  analyticsMargin:       (params?: unknown) => ['analytics-margin', params],
  analyticsTopCustomers: (params?: unknown) => ['analytics-top-customers', params],
  analyticsGstSummary:   (params?: unknown) => ['analytics-gst-summary', params],
  analyticsSalesVsPurchases: (params?: unknown) => ['analytics-sales-vs-purchases', params],
  reportsGstr1:          (params?: unknown) => ['reports-gstr1', params],
  reportsPl:             (params?: unknown) => ['reports-pl', params],
  reportsCashRegister:   (params?: unknown) => ['reports-cash-register', params],
  reportsBankAccounts:   ()                 => ['reports-bank-accounts'],
  reportsBankRecon:      (params?: unknown) => ['reports-bank-recon', params],
  reportsMonthly:        ()                 => ['reports-monthly'],
  staffUsers:            ()                 => ['staff-users'],
  staffAttendance:       (params?: unknown) => ['staff-attendance', params],
  staffShifts:           (params?: unknown) => ['staff-shifts', params],
  deliveries:            (params?: unknown) => ['deliveries', params],
  delivery:              (id: string)       => ['delivery', id],
  users:                 (params?: unknown) => ['users', params],
  invoices:        (params?: unknown) => ['invoices', params],
  invoice:         (id: string)       => ['invoice', id],
  dailySummary:    ()                 => ['daily-summary'],
  weeklySummary:   ()                 => ['weekly-summary'],
  products:        (params?: unknown) => ['products', params],
  product:         (id: string)       => ['product', id],
  lowStock:        ()                 => ['low-stock'],
  parties:         (params?: unknown) => ['parties', params],
  party:           (id: string)       => ['party', id],
  partyStatement:  (id: string)       => ['party-statement', id],
  udhaarSummary:   ()                 => ['udhaar-summary'],
  stock:           ()                 => ['stock'],
  gstinLookup:     (gstin: string)    => ['gstin', gstin],
  suppliers:       (params?: unknown) => ['suppliers', params],
  supplier:        (id: string)       => ['supplier', id],
  purchaseOrders:  (params?: unknown) => ['purchase-orders', params],
  purchaseOrder:   (id: string)       => ['purchase-order', id],
  grns:            (params?: unknown) => ['grns', params],
  adjustments:     (params?: unknown) => ['adjustments', params],
  adjustment:      (id: string)       => ['adjustment', id],
  transfers:       (params?: unknown) => ['transfers', params],
  transfer:        (id: string)       => ['transfer', id],
  stockLevels:     (params?: unknown) => ['stock-levels', params],
  stockLedger:     (id: string)       => ['stock-ledger', id],
  expenses:        (params?: unknown) => ['expenses', params],
  expenseSummary:  (params?: unknown) => ['expense-summary', params],
  expenseCategories: ()               => ['expense-categories'],
} as const

// ── Invoice hooks ─────────────────────────────────────────────────────────────

export function useInvoices(params?: Record<string, unknown>) {
  return useQuery({
    queryKey: QK.invoices(params),
    queryFn:  () => invoiceApi.list(params),
  })
}

export function useInvoice(id: string) {
  return useQuery({
    queryKey: QK.invoice(id),
    queryFn:  () => invoiceApi.get(id),
    enabled:  !!id,
  })
}

export function useDailySummary() {
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn())
  return useQuery({
    queryKey:        QK.dailySummary(),
    queryFn:         invoiceApi.dailySummary,
    refetchInterval: 60_000,  // refresh every 60s — live dashboard
    enabled:         isLoggedIn,
  })
}

export function useWeeklySummary() {
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn())
  return useQuery({
    queryKey:        QK.weeklySummary(),
    queryFn:         invoiceApi.weeklySummary,
    refetchInterval: 300_000, // refresh every 5 min
    enabled:         isLoggedIn,
  })
}

export function useGstinLookup(gstin: string) {
  return useQuery({
    queryKey: QK.gstinLookup(gstin),
    queryFn:  () => tenantApi.gstinLookup(gstin),
    enabled:  gstin.length === 15,
    retry:    false,
    staleTime: 60 * 60 * 1000, // 1 hour — GSTIN data rarely changes
  })
}

export function useCreateInvoice() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: invoiceApi.create,
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: ['invoices'] })
      qc.invalidateQueries({ queryKey: ['daily-summary'] })
      qc.invalidateQueries({ queryKey: ['stock'] })
      qc.invalidateQueries({ queryKey: ['parties'] })
      toast.success('Invoice created')
    },
    onError: (err: any) => {
      const data = err?.response?.data
      const detail = data?.detail?.join(', ') ?? data?.formErrors?.join(', ') ?? err.message
      toast.error(`Invoice failed: ${detail}`)
    },
  })
}

export function useCancelInvoice() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => invoiceApi.cancel(id),
    onSuccess:  (_data, id) => {
      qc.invalidateQueries({ queryKey: QK.invoice(id) })
      qc.invalidateQueries({ queryKey: ['invoices'] })
      qc.invalidateQueries({ queryKey: ['stock'] })
      toast.success('Invoice cancelled')
    },
  })
}

export function useCreateReturn() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data?: unknown }) => invoiceApi.createReturn(id, data),
    onSuccess: (_res, { id }) => {
      qc.invalidateQueries({ queryKey: QK.invoice(id) })
      qc.invalidateQueries({ queryKey: ['invoices'] })
      qc.invalidateQueries({ queryKey: ['stock'] })
      toast.success('Sale return created')
    },
  })
}

export function useCreateDebitNote() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data?: unknown }) => invoiceApi.createDebitNote(id, data),
    onSuccess: (_res, { id }) => {
      qc.invalidateQueries({ queryKey: QK.invoice(id) })
      qc.invalidateQueries({ queryKey: ['invoices'] })
      toast.success('Debit note created')
    },
  })
}

export function useGenerateIrn() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => invoiceApi.generateIrn(id),
    onSuccess: (_res, id) => {
      qc.invalidateQueries({ queryKey: QK.invoice(id) })
      toast.success('IRN generated')
    },
  })
}

export function useGenerateEway() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: unknown }) => invoiceApi.generateEway(id, data),
    onSuccess: (_res, { id }) => {
      qc.invalidateQueries({ queryKey: QK.invoice(id) })
      toast.success('E-Way Bill generated')
    },
  })
}

export function useRecordPayment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: unknown }) =>
      invoiceApi.recordPayment(id, data),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: QK.invoice(id) })
      qc.invalidateQueries({ queryKey: ['invoices'] })
      qc.invalidateQueries({ queryKey: ['parties'] })
      qc.invalidateQueries({ queryKey: ['daily-summary'] })
      toast.success('Payment recorded')
    },
  })
}

// ── Product hooks ─────────────────────────────────────────────────────────────

export function useProducts(params?: Record<string, unknown>) {
  return useQuery({
    queryKey: QK.products(params),
    queryFn:  () => productApi.list(params),
  })
}

export function useProduct(id: string) {
  return useQuery({
    queryKey: QK.product(id),
    queryFn:  () => productApi.get(id),
    enabled:  !!id,
  })
}

export function useLowStock() {
  return useQuery({
    queryKey: QK.lowStock(),
    queryFn:  productApi.lowStock,
  })
}

export function useCreateProduct() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: productApi.create,
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: ['products'] })
      qc.invalidateQueries({ queryKey: ['stock'] })
      toast.success('Product added')
    },
  })
}

export function useUpdateProduct() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: unknown }) =>
      productApi.update(id, data),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: QK.product(id) })
      qc.invalidateQueries({ queryKey: ['products'] })
      toast.success('Product updated')
    },
  })
}

export function useDeleteProduct() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => productApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['products'] })
      qc.invalidateQueries({ queryKey: ['stock'] })
      toast.success('Product removed')
    },
    onError: (err: any) => toast.error(err?.response?.data?.error ?? 'Failed to remove product'),
  })
}

export function useStockAdjust() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, qty, reason }: { id: string; qty: number; reason: string }) =>
      productApi.adjustStock(id, qty, reason),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['products'] })
      qc.invalidateQueries({ queryKey: ['stock'] })
      toast.success('Stock adjusted')
    },
  })
}

// ── Party hooks ───────────────────────────────────────────────────────────────

export function useParties(params?: Record<string, unknown>) {
  return useQuery({
    queryKey: QK.parties(params),
    queryFn:  () => partyApi.list(params),
  })
}

export function useParty(id: string) {
  return useQuery({
    queryKey: QK.party(id),
    queryFn:  () => partyApi.get(id),
    enabled:  !!id,
  })
}

export function usePartyStatement(id: string) {
  return useQuery({
    queryKey: QK.partyStatement(id),
    queryFn:  () => partyApi.statement(id),
    enabled:  !!id,
  })
}

export function useUdhaarSummary() {
  return useQuery({
    queryKey: QK.udhaarSummary(),
    queryFn:  partyApi.udhaarSummary,
  })
}

export function useCreateParty() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: partyApi.create,
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: ['parties'] })
      toast.success('Party added')
    },
  })
}

// ── Stock hook ────────────────────────────────────────────────────────────────

export function useStock() {
  return useQuery({
    queryKey: QK.stock(),
    queryFn:  stockApi.all,
  })
}

// ── AI hooks ──────────────────────────────────────────────────────────────────

export function useAIInsight(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['ai-insight'],
    queryFn:  aiApi.insight,
    staleTime: 5 * 60 * 1000, // refresh every 5 min
    retry: false,
    enabled: options?.enabled ?? true,
  })
}

export function useReorderSuggestions(options?: { enabled?: boolean }) {
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn())
  return useQuery({
    queryKey: ['ai-reorder'],
    queryFn:  aiApi.reorder,
    staleTime: 10 * 60 * 1000,
    retry: false,
    enabled: isLoggedIn && (options?.enabled ?? true),
  })
}

export function useCreditRisk(partyId: string | undefined) {
  return useQuery({
    queryKey: ['ai-credit-risk', partyId],
    queryFn:  () => aiApi.creditRisk(partyId!),
    enabled:  !!partyId,
    staleTime: 5 * 60 * 1000,
    retry: false,
  })
}

export function useSuggestHSN() {
  return useMutation({
    mutationFn: (productId: string) => productApi.suggestHSN(productId),
    onError: () => toast.error('HSN suggestion failed'),
  })
}

export function useConfirmHSN() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, hsnCode, gstRate }: { id: string; hsnCode: string; gstRate: number }) =>
      productApi.confirmHSN(id, hsnCode, gstRate),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['products'] })
      toast.success('HSN code saved')
    },
  })
}

// ── Supplier hooks ────────────────────────────────────────────────────────────

export function useSuppliers(params?: Record<string, unknown>) {
  return useQuery({ queryKey: QK.suppliers(params), queryFn: () => supplierApi.list(params) })
}

export function useSupplier(id: string) {
  return useQuery({ queryKey: QK.supplier(id), queryFn: () => supplierApi.get(id), enabled: !!id })
}

export function useCreateSupplier() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: supplierApi.create,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['suppliers'] }); toast.success('Supplier added') },
  })
}

export function useUpdateSupplier() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: unknown }) => supplierApi.update(id, data),
    onSuccess: (_d, { id }) => {
      qc.invalidateQueries({ queryKey: QK.supplier(id) })
      qc.invalidateQueries({ queryKey: ['suppliers'] })
      toast.success('Supplier updated')
    },
  })
}

export function useDeleteSupplier() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => supplierApi.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['suppliers'] }); toast.success('Supplier deleted') },
  })
}

// ── Purchase Order hooks ──────────────────────────────────────────────────────

export function usePurchaseOrders(params?: Record<string, unknown>) {
  return useQuery({ queryKey: QK.purchaseOrders(params), queryFn: () => purchaseOrderApi.list(params) })
}

export function usePurchaseOrder(id: string) {
  return useQuery({ queryKey: QK.purchaseOrder(id), queryFn: () => purchaseOrderApi.get(id), enabled: !!id })
}

export function useCreatePurchaseOrder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: purchaseOrderApi.create,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['purchase-orders'] }); toast.success('Purchase order created') },
  })
}

export function useUpdatePurchaseOrder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: unknown }) => purchaseOrderApi.update(id, data),
    onSuccess: (_d, { id }) => {
      qc.invalidateQueries({ queryKey: QK.purchaseOrder(id) })
      qc.invalidateQueries({ queryKey: ['purchase-orders'] })
      toast.success('Purchase order updated')
    },
  })
}

export function useCancelPurchaseOrder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => purchaseOrderApi.cancel(id),
    onSuccess: (_d, id) => {
      qc.invalidateQueries({ queryKey: QK.purchaseOrder(id) })
      qc.invalidateQueries({ queryKey: ['purchase-orders'] })
      toast.success('Purchase order cancelled')
    },
  })
}

export function useRecordPOPayment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: any) => purchaseOrderApi.recordPayment(id, data),
    onSuccess: (_d, { id }) => {
      qc.invalidateQueries({ queryKey: QK.purchaseOrder(id) })
      qc.invalidateQueries({ queryKey: ['purchase-orders'] })
      qc.invalidateQueries({ queryKey: ['expenses'] })
      toast.success('Payment recorded & expense created')
    },
  })
}

// ── GRN hooks ─────────────────────────────────────────────────────────────────

export function useGRNs(params?: Record<string, unknown>) {
  return useQuery({ queryKey: QK.grns(params), queryFn: () => grnApi.list(params) })
}

export function useCreateGRN() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: grnApi.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['grns'] })
      qc.invalidateQueries({ queryKey: ['purchase-orders'] })
      qc.invalidateQueries({ queryKey: ['stock-levels'] })
      toast.success('Goods receipt recorded')
    },
  })
}

// ── Stock Adjustment hooks ────────────────────────────────────────────────────

export function useStockAdjustments(params?: Record<string, unknown>) {
  return useQuery({ queryKey: QK.adjustments(params), queryFn: () => stockAdjustmentApi.list(params) })
}

export function useStockAdjustment(id: string) {
  return useQuery({ queryKey: QK.adjustment(id), queryFn: () => stockAdjustmentApi.get(id), enabled: !!id })
}

export function useCreateStockAdjustment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: stockAdjustmentApi.create,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['adjustments'] }); toast.success('Adjustment saved as draft') },
  })
}

export function usePostStockAdjustment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => stockAdjustmentApi.post(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['adjustments'] })
      qc.invalidateQueries({ queryKey: ['stock-levels'] })
      qc.invalidateQueries({ queryKey: ['products'] })
      toast.success('Adjustment posted — stock updated')
    },
  })
}

// ── Stock Transfer hooks ──────────────────────────────────────────────────────

export function useStockTransfers(params?: Record<string, unknown>) {
  return useQuery({ queryKey: QK.transfers(params), queryFn: () => stockTransferApi.list(params) })
}

export function useStockTransfer(id: string) {
  return useQuery({ queryKey: QK.transfer(id), queryFn: () => stockTransferApi.get(id), enabled: !!id })
}

export function useCreateStockTransfer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: stockTransferApi.create,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['transfers'] }); toast.success('Transfer created') },
  })
}

export function useDispatchStockTransfer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => stockTransferApi.dispatch(id),
    onSuccess: (_d, id) => {
      qc.invalidateQueries({ queryKey: QK.transfer(id) })
      qc.invalidateQueries({ queryKey: ['transfers'] })
      qc.invalidateQueries({ queryKey: ['stock-levels'] })
      toast.success('Transfer dispatched')
    },
  })
}

export function useReceiveStockTransfer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: unknown }) => stockTransferApi.receive(id, data),
    onSuccess: (_d, { id }) => {
      qc.invalidateQueries({ queryKey: QK.transfer(id) })
      qc.invalidateQueries({ queryKey: ['transfers'] })
      qc.invalidateQueries({ queryKey: ['stock-levels'] })
      toast.success('Transfer received — stock updated')
    },
  })
}

// ── Stock Level hooks ─────────────────────────────────────────────────────────

export function useStockLevels(params?: Record<string, unknown>) {
  return useQuery({ queryKey: QK.stockLevels(params), queryFn: () => stockSummaryApi.list(params) })
}

export function useStockLedger(productId: string) {
  return useQuery({
    queryKey: QK.stockLedger(productId),
    queryFn:  () => stockSummaryApi.ledger(productId),
    enabled:  !!productId,
  })
}

export function useExpiryAlerts(days = 90) {
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn())
  return useQuery({
    queryKey: ['expiry-alerts', days],
    queryFn:  () => stockSummaryApi.expiryAlerts(days),
    staleTime: 5 * 60 * 1000,
    enabled: isLoggedIn,
  })
}


// ── Branch hooks ─────────────────────────────────────────────────────────────

export function useBranches() {
  return useQuery({ queryKey: ['branches'], queryFn: branchApi.list })
}

export function useCreateBranch() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: unknown) => branchApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['branches'] })
      toast.success('Branch created')
    },
  })
}

export function useUpdateBranch() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: any) => branchApi.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['branches'] })
      toast.success('Branch updated')
    },
  })
}

export function useDeactivateBranch() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => branchApi.deactivate(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['branches'] })
      toast.success('Branch deactivated')
    },
  })
}

export function useActivateBranch() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => branchApi.activate(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['branches'] })
      toast.success('Branch activated')
    },
  })
}

// ── Feature toggle hooks ────────────────────────────────────────────────────────

export function useFeatures(options?: { enabled?: boolean }) {
  return useQuery({ queryKey: ['features'], queryFn: featuresApi.get, enabled: options?.enabled ?? true })
}

export function useUpdateFeatures() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { contractsEnabled?: boolean; deliveriesEnabled?: boolean }) => featuresApi.update(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['features'] })
      toast.success('Settings updated')
    },
    onError: (err: any) => toast.error(err?.response?.data?.error ?? 'Failed to update settings'),
  })
}

// ── Website content hooks ──────────────────────────────────────────────────────

export function useWebsiteContent() {
  return useQuery({ queryKey: ['website-content'], queryFn: websiteApi.get })
}

export function useUpdateWebsiteSection() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ section, data }: { section: string; data: unknown }) =>
      websiteApi.updateSection(section, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['website-content'] })
      toast.success('Website updated')
    },
  })
}

// ── Expense hooks ─────────────────────────────────────────────────────────────

export function useExpenses(params?: Record<string, unknown>) {
  return useQuery({
    queryKey: QK.expenses(params),
    queryFn:  () => expenseApi.list(params),
  })
}

export function useExpenseSummary(params?: { from?: string; to?: string; branchId?: string }) {
  return useQuery({
    queryKey: QK.expenseSummary(params),
    queryFn:  () => expenseApi.summary(params),
  })
}

export function useExpenseCategories() {
  return useQuery({
    queryKey: QK.expenseCategories(),
    queryFn:  expenseApi.categories,
    staleTime: Infinity, // categories don't change at runtime
  })
}

export function useCreateExpense() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: expenseApi.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expenses'] })
      qc.invalidateQueries({ queryKey: ['expense-summary'] })
      toast.success('Expense added')
    },
  })
}

export function useUpdateExpense() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: unknown }) =>
      expenseApi.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expenses'] })
      qc.invalidateQueries({ queryKey: ['expense-summary'] })
      toast.success('Expense updated')
    },
  })
}

export function useDeleteExpense() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => expenseApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expenses'] })
      qc.invalidateQueries({ queryKey: ['expense-summary'] })
      toast.success('Expense deleted')
    },
  })
}

// ── Analytics hooks ───────────────────────────────────────────────────────────

export function useAnalyticsDashboard(params?: { period?: string; compareWith?: string }) {
  return useQuery({
    queryKey: QK.analyticsDashboard(params),
    queryFn:  () => analyticsApi.dashboard(params),
  })
}

export function useAnalyticsMargin(params?: { period?: string }) {
  return useQuery({
    queryKey: QK.analyticsMargin(params),
    queryFn:  () => analyticsApi.marginReport(params),
  })
}

export function useAnalyticsTopCustomers(params?: { period?: string; limit?: number }) {
  return useQuery({
    queryKey: QK.analyticsTopCustomers(params),
    queryFn:  () => analyticsApi.topCustomers(params),
  })
}

export function useAnalyticsGstSummary(params?: { month?: string }) {
  return useQuery({
    queryKey: QK.analyticsGstSummary(params),
    queryFn:  () => analyticsApi.gstSummary(params),
    enabled:  !!params?.month,
  })
}

export function useAnalyticsSalesVsPurchases(params?: { months?: number }) {
  return useQuery({
    queryKey: QK.analyticsSalesVsPurchases(params),
    queryFn:  () => analyticsApi.salesVsPurchases(params),
  })
}

export function useReportsGstr1(params?: { month?: string }) {
  return useQuery({
    queryKey: QK.reportsGstr1(params),
    queryFn:  () => reportsApi.gstr1(params),
    enabled:  !!params?.month,
  })
}

export function useReportsPlStatement(params?: { from?: string; to?: string }) {
  return useQuery({
    queryKey: QK.reportsPl(params),
    queryFn:  () => reportsApi.plStatement(params),
    enabled:  !!params?.from && !!params?.to,
  })
}

export function useHotelOccupancy(params: { from: string; to: string }) {
  return useQuery({
    queryKey: ['reports', 'hotel-occupancy', params],
    queryFn:  () => reportsApi.hotelOccupancy(params),
    enabled:  !!params.from && !!params.to,
  })
}

export function useReportsCashRegister(params?: { date?: string }) {
  return useQuery({
    queryKey: QK.reportsCashRegister(params),
    queryFn:  () => reportsApi.cashRegisterGet(params),
  })
}

export function useReportsCashRegisterSave() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: reportsApi.cashRegisterSave,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reports-cash-register'] })
      toast.success('Cash count saved')
    },
    onError: () => toast.error('Failed to save cash count'),
  })
}

export function useReportsBankAccounts() {
  return useQuery({
    queryKey: QK.reportsBankAccounts(),
    queryFn:  () => reportsApi.bankAccounts(),
  })
}

export function useReportsBankAccountCreate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: reportsApi.bankAccountCreate,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QK.reportsBankAccounts() })
      toast.success('Bank account added')
    },
    onError: () => toast.error('Failed to add bank account'),
  })
}

export function useReportsBankRecon(params: { month: string; bankAccountId?: string }) {
  return useQuery({
    queryKey: QK.reportsBankRecon(params),
    queryFn:  () => reportsApi.bankReconGet(params),
    enabled:  !!params.month,
  })
}

export function useReportsBankReconSave() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: reportsApi.bankReconSave,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reports-bank-recon'] })
      toast.success('Reconciliation saved')
    },
    onError: () => toast.error('Failed to save reconciliation'),
  })
}

export function useMonthlyComparison(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: QK.reportsMonthly(),
    queryFn:  () => reportsApi.monthlyComparison(),
    staleTime: 5 * 60 * 1000,
    enabled: options?.enabled ?? true,
  })
}

export function useDayBook(params?: { date?: string }) {
  return useQuery({
    queryKey: ['reports-day-book', params],
    queryFn:  () => reportsApi.dayBook(params),
    staleTime: 60 * 1000,
  })
}

// ── Staff ─────────────────────────────────────────────────────────────────────

export function useStaffUsers() {
  return useQuery({
    queryKey: QK.staffUsers(),
    queryFn:  () => staffApi.users(),
  })
}

export function useStaffAttendance(params: { date?: string; month?: string; userId?: string }) {
  return useQuery({
    queryKey: QK.staffAttendance(params),
    queryFn:  () => staffApi.getAttendance(params),
  })
}

export function useRecordAttendance() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: staffApi.recordAttendance,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['staff-attendance'] })
      toast.success('Attendance saved')
    },
    onError: () => toast.error('Failed to save attendance'),
  })
}

export function useUpdateAttendance() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: { clockOut?: string; status?: string; notes?: string } }) =>
      staffApi.updateAttendance(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['staff-attendance'] })
      toast.success('Updated')
    },
    onError: () => toast.error('Update failed'),
  })
}

export function useStaffShifts(params: { from?: string; to?: string; userId?: string }) {
  return useQuery({
    queryKey: QK.staffShifts(params),
    queryFn:  () => staffApi.getShifts(params),
  })
}

export function useCreateShift() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: staffApi.createShift,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['staff-shifts'] })
      toast.success('Shift scheduled')
    },
    onError: () => toast.error('Failed to schedule shift'),
  })
}

export function useDeleteShift() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: staffApi.deleteShift,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['staff-shifts'] })
    },
    onError: () => toast.error('Failed to delete shift'),
  })
}

// ── Deliveries ────────────────────────────────────────────────────────────────

export function useDeliveries(params?: { status?: string; date?: string; page?: number }) {
  return useQuery({
    queryKey: QK.deliveries(params),
    queryFn:  () => deliveryApi.list(params),
  })
}

export function useDelivery(id: string) {
  return useQuery({
    queryKey: QK.delivery(id),
    queryFn:  () => deliveryApi.get(id),
    enabled:  !!id,
  })
}

export function useCreateDelivery() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: deliveryApi.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['deliveries'] })
      toast.success('Delivery created')
    },
    onError: () => toast.error('Failed to create delivery'),
  })
}

export function useUpdateDelivery() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof deliveryApi.update>[1] }) =>
      deliveryApi.update(id, data),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['deliveries'] })
      qc.invalidateQueries({ queryKey: QK.delivery(vars.id) })
      toast.success('Delivery updated')
    },
    onError: () => toast.error('Failed to update delivery'),
  })
}

// ── Invoice send-receipt ──────────────────────────────────────────────────────

export function useSendReceipt() {
  return useMutation({
    mutationFn: ({ id, data }: {
      id: string
      data: { channel: 'whatsapp' | 'email'; to?: string; businessName?: string }
    }) => invoiceApi.sendReceipt(id, data),
    onSuccess: (_, vars) => {
      toast.success(vars.data.channel === 'whatsapp' ? 'Receipt sent via WhatsApp' : 'Receipt sent via email')
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.error ?? 'Failed to send receipt'
      toast.error(msg)
    },
  })
}

// ── User management ───────────────────────────────────────────────────────────

export function useUsers(params?: { role?: string; isActive?: boolean; search?: string }) {
  return useQuery({
    queryKey: QK.users(params),
    queryFn:  () => usersApi.list(params),
  })
}

export function useCreateUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { name: string; phone: string; pin: string; role?: string; branchIds?: string[]; lang?: string }) =>
      usersApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] })
      toast.success('User created successfully')
    },
    onError: (err: any) => toast.error(err?.response?.data?.error ?? 'Failed to create user'),
  })
}

export function useUpdateUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: { name?: string; role?: string; branchIds?: string[]; lang?: string } }) =>
      usersApi.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] })
      toast.success('User updated')
    },
    onError: (err: any) => toast.error(err?.response?.data?.error ?? 'Failed to update user'),
  })
}

export function useSetAiAccess() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, aiEnabled }: { id: string; aiEnabled: boolean }) =>
      usersApi.setAiAccess(id, aiEnabled),
    onSuccess: (_data, { aiEnabled }) => {
      qc.invalidateQueries({ queryKey: ['users'] })
      toast.success(aiEnabled ? 'AI Assistant access granted' : 'AI Assistant access revoked')
    },
    onError: (err: any) => toast.error(err?.response?.data?.error ?? 'Failed to update AI access'),
  })
}

export function useResetUserPin() {
  return useMutation({
    mutationFn: ({ id, pin }: { id: string; pin: string }) => usersApi.resetPin(id, pin),
    onSuccess: () => toast.success('PIN reset successfully'),
    onError: (err: any) => toast.error(err?.response?.data?.error ?? 'Failed to reset PIN'),
  })
}

export function useDeactivateUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => usersApi.deactivate(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); toast.success('User deactivated') },
    onError: (err: any) => toast.error(err?.response?.data?.error ?? 'Failed to deactivate user'),
  })
}

export function useActivateUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => usersApi.activate(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); toast.success('User activated') },
    onError: (err: any) => toast.error(err?.response?.data?.error ?? 'Failed to activate user'),
  })
}

// ── Gallery ──────────────────────────────────────────────────────────────────

export function useGallery(params?: Record<string, unknown>) {
  return useQuery({
    queryKey: ['gallery', params],
    queryFn:  () => galleryApi.list(params),
  })
}

export function useGalleryItem(id: string) {
  return useQuery({
    queryKey: ['gallery-item', id],
    queryFn:  () => galleryApi.get(id),
    enabled:  !!id,
  })
}

export function useUploadGalleryItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: galleryApi.upload,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['gallery'] }); toast.success('Photo added') },
    onError: (err: any) => toast.error(err?.response?.data?.error ?? 'Upload failed'),
  })
}

export function useUpdateGalleryItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; caption?: string; tags?: string[] }) =>
      galleryApi.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['gallery'] }); toast.success('Updated') },
  })
}

export function useDeleteGalleryItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: galleryApi.remove,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['gallery'] }); toast.success('Photo deleted') },
    onError: (err: any) => toast.error(err?.response?.data?.error ?? 'Delete failed'),
  })
}

// ── Contracts ─────────────────────────────────────────────────────────────────

export function useContracts(params?: Record<string, unknown>) {
  return useQuery({
    queryKey: ['contracts', params],
    queryFn:  () => contractApi.list(params),
  })
}

export function useContract(id: string) {
  return useQuery({
    queryKey: ['contract', id],
    queryFn:  () => contractApi.get(id),
    enabled:  !!id,
  })
}

export function useCreateContract() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: contractApi.create,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['contracts'] }); toast.success('Contract created') },
    onError: (e: any) => toast.error(e?.response?.data?.error ?? 'Failed'),
  })
}

export function useUpdateContract() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; [k: string]: unknown }) => contractApi.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['contracts'] }); toast.success('Contract updated') },
  })
}

export function useGenerateContractInvoice() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => contractApi.generateInvoice(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contracts'] })
      qc.invalidateQueries({ queryKey: ['invoices'] })
      toast.success('Invoice generated')
    },
    onError: (e: any) => toast.error(e?.response?.data?.error ?? 'Failed'),
  })
}

// ── Advances ──────────────────────────────────────────────────────────────────

export function useAdvances(params?: Record<string, unknown>) {
  return useQuery({
    queryKey: ['advances', params],
    queryFn:  () => advanceApi.list(params),
  })
}

export function useRecordAdvance() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: advanceApi.create,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['advances'] }); toast.success('Advance recorded') },
    onError: (e: any) => toast.error(e?.response?.data?.error ?? 'Failed'),
  })
}

export function useAllocateAdvance() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, allocations }: { id: string; allocations: Array<{ invoiceId: string; amount: number }> }) =>
      advanceApi.allocate(id, allocations),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['advances'] })
      qc.invalidateQueries({ queryKey: ['invoices'] })
      toast.success('Advance allocated')
    },
    onError: (e: any) => toast.error(e?.response?.data?.error ?? 'Failed'),
  })
}

// ── Approvals ─────────────────────────────────────────────────────────────────

export function usePendingApprovals({ enabled = true }: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: ['pending-approvals'],
    queryFn:  approvalApi.pending,
    refetchInterval: enabled ? 30_000 : false,
    enabled,
  })
}

export function useApproveInvoice() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, note }: { id: string; note?: string }) => approvalApi.approve(id, note),
    onSuccess: (_d, { id }) => {
      qc.invalidateQueries({ queryKey: ['pending-approvals'] })
      qc.invalidateQueries({ queryKey: ['invoices'] })
      qc.invalidateQueries({ queryKey: ['invoice', id] })
      toast.success('Invoice approved')
    },
  })
}

export function useRejectInvoice() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, note }: { id: string; note: string }) => approvalApi.reject(id, note),
    onSuccess: (_d, { id }) => {
      qc.invalidateQueries({ queryKey: ['pending-approvals'] })
      qc.invalidateQueries({ queryKey: ['invoices'] })
      qc.invalidateQueries({ queryKey: ['invoice', id] })
      toast.success('Invoice rejected')
    },
  })
}

export function useRequestApproval() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => approvalApi.requestApproval(id),
    onSuccess: (_d, id) => {
      qc.invalidateQueries({ queryKey: ['invoice', id] })
      toast.success('Sent for approval')
    },
  })
}

export function useConvertInvoice() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, targetType }: { id: string; targetType?: string }) =>
      approvalApi.convert(id, targetType),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoices'] })
      toast.success('Document converted')
    },
    onError: (e: any) => toast.error(e?.response?.data?.error ?? 'Conversion failed'),
  })
}

export function useDiscountRules() {
  return useQuery({
    queryKey: ['discount-rules'],
    queryFn:  () => discountRulesApi.list({ active: true }),
    staleTime: 60_000,
  })
}

export function useCreateDiscountRule() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: any) => discountRulesApi.create(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['discount-rules'] }); toast.success('Rule created') },
    onError:   (e: any) => toast.error(e?.response?.data?.error ?? 'Failed to create rule'),
  })
}

export function useUpdateDiscountRule() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: any) => discountRulesApi.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['discount-rules'] }); toast.success('Rule updated') },
    onError:   (e: any) => toast.error(e?.response?.data?.error ?? 'Failed to update rule'),
  })
}

export function useDeleteDiscountRule() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => discountRulesApi.remove(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['discount-rules'] }); toast.success('Rule deleted') },
    onError:   (e: any) => toast.error(e?.response?.data?.error ?? 'Failed to delete rule'),
  })
}

// ── CLINIC ────────────────────────────────────────────────────────────────────

export function useClinicVisits(partyId: string, params?: { from?: string; to?: string }) {
  return useQuery({
    queryKey:  ['clinic-visits', partyId, params],
    queryFn:   () => clinicApi.listVisits(partyId, params),
    enabled:   !!partyId,
    staleTime: 30_000,
  })
}

export function useCreateClinicVisit() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: any) => clinicApi.createVisit(data),
    onSuccess: (_, vars) => { qc.invalidateQueries({ queryKey: ['clinic-visits', vars.partyId] }); qc.invalidateQueries({ queryKey: ['clinic-summary'] }); toast.success('Visit saved') },
    onError:   (e: any) => toast.error(e?.response?.data?.error ?? 'Failed to save visit'),
  })
}

export function useUpdateClinicVisit() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: any) => clinicApi.updateVisit(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['clinic-visits'] }); toast.success('Visit updated') },
    onError:   (e: any) => toast.error(e?.response?.data?.error ?? 'Failed to update visit'),
  })
}

export function useDeleteClinicVisit() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => clinicApi.deleteVisit(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['clinic-visits'] }); qc.invalidateQueries({ queryKey: ['clinic-summary'] }); toast.success('Visit deleted') },
    onError:   (e: any) => toast.error(e?.response?.data?.error ?? 'Failed to delete visit'),
  })
}

export function useClinicDocuments(partyId: string, params?: { docType?: string }) {
  return useQuery({
    queryKey:  ['clinic-documents', partyId, params],
    queryFn:   () => clinicApi.listDocuments(partyId, params),
    enabled:   !!partyId,
    staleTime: 60_000,
  })
}

export function useCreateClinicDocument() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: any) => clinicApi.createDocument(data),
    onSuccess: (_, vars) => { qc.invalidateQueries({ queryKey: ['clinic-documents', vars.partyId] }); toast.success('Document added') },
    onError:   (e: any) => toast.error(e?.response?.data?.error ?? 'Failed to add document'),
  })
}

export function useUpdateClinicDocument() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: any) => clinicApi.updateDocument(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['clinic-documents'] }); toast.success('Document updated') },
    onError:   (e: any) => toast.error(e?.response?.data?.error ?? 'Failed to update document'),
  })
}

export function useDeleteClinicDocument() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => clinicApi.deleteDocument(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['clinic-documents'] }); toast.success('Document deleted') },
    onError:   (e: any) => toast.error(e?.response?.data?.error ?? 'Failed to delete document'),
  })
}

export function usePatientSummary(partyId: string) {
  return useQuery({
    queryKey:  ['clinic-summary', partyId],
    queryFn:   () => clinicApi.patientSummary(partyId),
    enabled:   !!partyId,
    staleTime: 60_000,
  })
}

// ── COACHING ──────────────────────────────────────────────────────────────────

export function useStudentNotes(partyId: string, params?: { from?: string; to?: string }) {
  return useQuery({
    queryKey:  ['student-notes', partyId, params],
    queryFn:   () => coachingApi.listNotes(partyId, params),
    enabled:   !!partyId,
    staleTime: 30_000,
  })
}

export function useCreateStudentNote() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: any) => coachingApi.createNote(data),
    onSuccess: (_, vars) => { qc.invalidateQueries({ queryKey: ['student-notes', vars.partyId] }); toast.success('Note saved') },
    onError:   (e: any) => toast.error(e?.response?.data?.error ?? 'Failed to save note'),
  })
}

export function useUpdateStudentNote() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: any) => coachingApi.updateNote(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['student-notes'] }); toast.success('Note updated') },
    onError:   (e: any) => toast.error(e?.response?.data?.error ?? 'Failed to update note'),
  })
}

export function useDeleteStudentNote() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => coachingApi.deleteNote(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['student-notes'] }); toast.success('Note deleted') },
    onError:   (e: any) => toast.error(e?.response?.data?.error ?? 'Failed to delete note'),
  })
}

export function useStudentWeeklyReviews(partyId: string) {
  return useQuery({
    queryKey:  ['student-reviews', partyId],
    queryFn:   () => coachingApi.listReviews(partyId),
    enabled:   !!partyId,
    staleTime: 60_000,
  })
}

export function useUpsertWeeklyReview() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: any) => coachingApi.upsertReview(data),
    onSuccess: (_, vars) => { qc.invalidateQueries({ queryKey: ['student-reviews', vars.partyId] }); toast.success('Review saved') },
    onError:   (e: any) => toast.error(e?.response?.data?.error ?? 'Failed to save review'),
  })
}

export function useStudentExams(params?: { batchName?: string; subject?: string }) {
  return useQuery({
    queryKey:  ['student-exams', params],
    queryFn:   () => coachingApi.listExams(params),
    staleTime: 30_000,
  })
}

export function useCreateExam() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: any) => coachingApi.createExam(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['student-exams'] }); toast.success('Exam created') },
    onError:   (e: any) => toast.error(e?.response?.data?.error ?? 'Failed to create exam'),
  })
}

export function useUpdateExam() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: any) => coachingApi.updateExam(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['student-exams'] }); toast.success('Exam updated') },
    onError:   (e: any) => toast.error(e?.response?.data?.error ?? 'Failed to update exam'),
  })
}

export function useDeleteExam() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => coachingApi.deleteExam(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['student-exams'] }); toast.success('Exam deleted') },
    onError:   (e: any) => toast.error(e?.response?.data?.error ?? 'Failed to delete exam'),
  })
}

export function useExamScores(examId: string) {
  return useQuery({
    queryKey:  ['exam-scores', examId],
    queryFn:   () => coachingApi.getScores(examId),
    enabled:   !!examId,
    staleTime: 30_000,
  })
}

export function useSaveExamScores() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ examId, scores }: { examId: string; scores: any[] }) => coachingApi.saveScores(examId, scores),
    onSuccess: (_, vars) => { qc.invalidateQueries({ queryKey: ['exam-scores', vars.examId] }); qc.invalidateQueries({ queryKey: ['student-exams'] }); toast.success('Marks saved') },
    onError:   (e: any) => toast.error(e?.response?.data?.error ?? 'Failed to save marks'),
  })
}

export function useGenerateWeeklyExam() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ weekId, excludeTopics, totalMarks, specialNote }: { weekId: string; excludeTopics?: string[]; totalMarks?: number; specialNote?: string }) =>
      coachingApi.generateWeeklyExam(weekId, excludeTopics ?? [], totalMarks ?? 100, specialNote ?? ''),
    onSuccess: () => { toast.success('Exam paper generated!'); qc.invalidateQueries({ queryKey: ['student-exams'] }) },
    onError:   (e: any) => {
      const msg = e?.response?.data?.error ?? e?.message ?? 'Failed to generate exam'
      if (msg.includes('timeout') || msg.includes('Network') || e?.code === 'ECONNABORTED') {
        toast.error('AI is taking too long — please try again in a moment')
      } else {
        toast.error(msg)
      }
    },
  })
}

export function useSaveExamPaper() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ examId, paper }: { examId: string; paper: any }) => coachingApi.saveExamPaper(examId, paper),
    onSuccess: () => { toast.success('Paper saved'); qc.invalidateQueries({ queryKey: ['student-exams'] }) },
    onError:   (e: any) => toast.error(e?.response?.data?.error ?? 'Failed to save'),
  })
}

export function useClassAnalysis() {
  return useMutation({
    mutationFn: (examId: string) => coachingApi.classAnalysis(examId),
    onError:    (e: any) => toast.error(e?.response?.data?.error ?? 'Analysis failed'),
  })
}

export function useStudentProgress(partyId: string) {
  return useQuery({
    queryKey:  ['student-progress', partyId],
    queryFn:   () => coachingApi.studentProgress(partyId),
    enabled:   !!partyId,
    staleTime: 60_000,
  })
}

// ── COACHING PLANS ────────────────────────────────────────────────────────────

export function useCoachingPlans(params?: { monthYear?: string; batchName?: string; subject?: string }) {
  return useQuery({
    queryKey:  ['coaching-plans', params],
    queryFn:   () => coachingApi.listPlans(params),
    staleTime: 30_000,
  })
}

export function useCoachingPlan(id: string) {
  return useQuery({
    queryKey:  ['coaching-plan', id],
    queryFn:   () => coachingApi.getPlan(id),
    enabled:   !!id,
    staleTime: 30_000,
  })
}

export function usePlanProgress(planId: string) {
  return useQuery({
    queryKey:  ['plan-progress', planId],
    queryFn:   () => coachingApi.planProgress(planId),
    enabled:   !!planId,
    staleTime: 30_000,
  })
}

export function useCreateCoachingPlan() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { batchName: string; subject: string; monthYear: string; notes?: string }) =>
      coachingApi.createPlan(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['coaching-plans'] }); toast.success('Plan created') },
    onError:   (e: any) => toast.error(e?.response?.data?.error ?? 'Failed to create plan'),
  })
}

export function useDeleteCoachingPlan() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => coachingApi.deletePlan(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['coaching-plans'] }); toast.success('Plan deleted') },
    onError:   (e: any) => toast.error(e?.response?.data?.error ?? 'Failed to delete plan'),
  })
}

export function useUpdatePlanWeek(planId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ weekId, data }: { weekId: string; data: { title?: string; topics?: string[]; notes?: string } }) =>
      coachingApi.updateWeek(weekId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['coaching-plan', planId] })
      qc.invalidateQueries({ queryKey: ['plan-progress', planId] })
    },
    onError: (e: any) => toast.error(e?.response?.data?.error ?? 'Failed to update week'),
  })
}

export function useStudentMastery(partyId: string, subject?: string) {
  return useQuery({
    queryKey:  ['topic-mastery', partyId, subject],
    queryFn:   () => coachingApi.getStudentMastery(partyId, subject),
    enabled:   !!partyId,
    staleTime: 30_000,
  })
}

export function useSetMastery() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { partyId: string; subject: string; topic: string; masteryLevel: number; notes?: string }) =>
      coachingApi.setMastery(data),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['topic-mastery', vars.partyId] })
      qc.invalidateQueries({ queryKey: ['plan-progress'] })
    },
    onError: (e: any) => toast.error(e?.response?.data?.error ?? 'Failed to update mastery'),
  })
}

export function useAllNotes(filters?: { subject?: string; board?: string; standard?: string }) {
  return useQuery({
    queryKey: ['all-notes', filters ?? {}],
    queryFn: () => coachingApi.getAllNotes(filters),
    retry: false,
  })
}

export function useDeleteTopicNotes() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { subject: string; topic: string }) =>
      coachingApi.deleteTopicNotes(data.subject, data.topic),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['all-notes'] })
      qc.invalidateQueries({ queryKey: ['topic-notes'] })
      toast.success('Notes deleted')
    },
    onError: () => toast.error('Failed to delete notes'),
  })
}

export function useTopicNotes(subject: string, topic: string) {
  return useQuery({
    queryKey: ['topic-notes', subject, topic],
    queryFn: () => coachingApi.getTopicNotes(subject, topic),
    enabled: !!subject && !!topic,
    retry: false,
  })
}

export function usePlanNotes(planId: string) {
  return useQuery({
    queryKey: ['plan-notes', planId],
    queryFn: () => coachingApi.getPlanNotes(planId),
    enabled: !!planId,
    retry: false,
  })
}

export function useScanTopicNotes() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { subject: string; topic: string; images?: Array<{ base64: string; mediaType: string }>; imageBase64?: string; mediaType?: string }) =>
      coachingApi.scanTopicNotes(data),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['topic-notes', vars.subject, vars.topic] })
    },
    onError: (e: any) => {
      const msg = e?.response?.data?.error ?? 'AI scan failed'
      const isRateLimit = e?.response?.status === 429 || msg.toLowerCase().includes('quota') || msg.toLowerCase().includes('rate limit')
      toast.error(isRateLimit ? '⏳ Gemini rate limit — wait 30 seconds and try again' : msg, { duration: 6000 })
    },
  })
}

export function useSaveTopicNotes() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { subject: string; topic: string; board?: string; standard?: string; content: any }) =>
      coachingApi.saveTopicNotes(data),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['topic-notes', vars.subject, vars.topic] })
      qc.invalidateQueries({ queryKey: ['all-notes'] })
      toast.success('Notes saved')
    },
    onError: (e: any) => toast.error(e?.response?.data?.error ?? 'Failed to save notes'),
  })
}

export function useExperimentPlanner() {
  return useQuery({
    queryKey: ['experiment-planner'],
    queryFn: () => coachingApi.getExperimentPlanner(),
    retry: false,
  })
}

export function useSaveExperimentPrep() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { weekId: string; subject: string; topic: string; itemStatus?: Record<string, boolean>; prepDone?: boolean; prepNotes?: string }) =>
      coachingApi.saveExperimentPrep(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['experiment-planner'] }),
  })
}

export function useTagNotes() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ notes, board, standard }: { notes: any[]; board: string; standard: string }) => {
      await Promise.all(notes.map(n =>
        coachingApi.saveTopicNotes({ subject: n.subject, topic: n.topic, board, standard, content: n.content ?? {} })
      ))
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['all-notes'] })
      toast.success('Tags saved')
    },
    onError: () => toast.error('Failed to tag notes'),
  })
}

// ── Robotics hooks ─────────────────────────────────────────────────────────────

export function useRoboticsProjects(status?: string) {
  return useQuery({ queryKey: ['robotics-projects', status ?? 'all'], queryFn: () => roboticsApi.getProjects(status), retry: false })
}
export function useRoboticsProject(id: string) {
  return useQuery({ queryKey: ['robotics-project', id], queryFn: () => roboticsApi.getProject(id), enabled: !!id, retry: false })
}
export function useRoboticsProjectsByPlan(planId: string) {
  return useQuery({ queryKey: ['robotics-projects-plan', planId], queryFn: () => roboticsApi.getProjectsByPlan(planId), enabled: !!planId, retry: false })
}
export function useGeneratePhaseKit(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { phase: string; weekTopics?: string[]; checklist?: string[]; projectTitle?: string; category?: string }) =>
      roboticsApi.generatePhaseKit(projectId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['robotics-project', projectId] })
      qc.invalidateQueries({ queryKey: ['robotics-projects-plan'] })
    },
    onError: () => toast.error('Kit generation failed'),
  })
}
export function useCreateRoboticsProject() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: any) => roboticsApi.createProject(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['robotics-projects'] }); qc.invalidateQueries({ queryKey: ['robotics-projects-plan'] }); toast.success('Project created!') },
    onError: (e: any) => toast.error(e?.response?.data?.error ?? 'Failed'),
  })
}
export function useUpdateRoboticsProject(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: any) => roboticsApi.updateProject(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['robotics-projects'] }); qc.invalidateQueries({ queryKey: ['robotics-project', id] }) },
    onError: (e: any) => toast.error(e?.response?.data?.error ?? 'Failed'),
  })
}
export function useDeleteRoboticsProject() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => roboticsApi.deleteProject(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['robotics-projects'] }); toast.success('Project deleted') },
  })
}
export function useSaveRoboticsProgress(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: any) => roboticsApi.saveProgress(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['robotics-project', projectId] }),
    onError: () => toast.error('Failed to save'),
  })
}
export function useRoboticsComponents() {
  return useQuery({ queryKey: ['robotics-components'], queryFn: () => roboticsApi.getComponents(), retry: false })
}
export function useSaveRoboticsComponent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: any) => roboticsApi.saveComponent(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['robotics-components'] }),
    onError: () => toast.error('Failed to save component'),
  })
}
export function useDeleteRoboticsComponent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (name: string) => roboticsApi.deleteComponent(name),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['robotics-components'] }),
  })
}
