// src/App.tsx
import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './store/auth.store'
import { AppLayout } from './components/layout/AppLayout'
import { LoginPage } from './pages/LoginPage'

// Every page except login is split into its own chunk so the sign-in screen stays small.
const DashboardPage = lazy(() => import('./pages/DashboardPage').then(m => ({ default: m.DashboardPage })))
const InvoiceListPage = lazy(() => import('./pages/InvoiceListPage').then(m => ({ default: m.InvoiceListPage })))
const CreateInvoicePage = lazy(() => import('./pages/CreateInvoicePage').then(m => ({ default: m.CreateInvoicePage })))
const InvoiceDetailPage = lazy(() => import('./pages/InvoiceDetailPage').then(m => ({ default: m.InvoiceDetailPage })))
const ProductListPage = lazy(() => import('./pages/ProductListPage').then(m => ({ default: m.ProductListPage })))
const PartyListPage = lazy(() => import('./pages/PartyListPage').then(m => ({ default: m.PartyListPage })))
const PartyStatementPage = lazy(() => import('./pages/PartyStatementPage').then(m => ({ default: m.PartyStatementPage })))
const AIPage = lazy(() => import('./pages/AIPage').then(m => ({ default: m.AIPage })))
const InventoryLayout = lazy(() => import('./pages/inventory/InventoryLayout').then(m => ({ default: m.InventoryLayout })))
const StockLevelsPage = lazy(() => import('./pages/inventory/StockLevelsPage').then(m => ({ default: m.StockLevelsPage })))
const SuppliersPage = lazy(() => import('./pages/inventory/SuppliersPage').then(m => ({ default: m.SuppliersPage })))
const PurchaseOrdersPage = lazy(() => import('./pages/inventory/PurchaseOrdersPage').then(m => ({ default: m.PurchaseOrdersPage })))
const PurchaseOrderDetailPage = lazy(() => import('./pages/inventory/PurchaseOrderDetailPage').then(m => ({ default: m.PurchaseOrderDetailPage })))
const StockAdjustmentPage = lazy(() => import('./pages/inventory/StockAdjustmentPage').then(m => ({ default: m.StockAdjustmentPage })))
const StockTransfersPage = lazy(() => import('./pages/inventory/StockTransfersPage').then(m => ({ default: m.StockTransfersPage })))
const ExpensePage = lazy(() => import('./pages/ExpensePage').then(m => ({ default: m.ExpensePage })))
const BranchesPage = lazy(() => import('./pages/BranchesPage').then(m => ({ default: m.BranchesPage })))
const WebsitePage = lazy(() => import('./pages/WebsitePage').then(m => ({ default: m.WebsitePage })))
const ReportsPage = lazy(() => import('./pages/ReportsPage').then(m => ({ default: m.ReportsPage })))
const StaffPage = lazy(() => import('./pages/StaffPage').then(m => ({ default: m.StaffPage })))
const DeliveriesPage = lazy(() => import('./pages/DeliveriesPage').then(m => ({ default: m.DeliveriesPage })))
const HotelLayout = lazy(() => import('./pages/hotel/HotelLayout').then(m => ({ default: m.HotelLayout })))
const HotelDashboardPage = lazy(() => import('./pages/hotel/HotelDashboardPage').then(m => ({ default: m.HotelDashboardPage })))
const BookingsPage = lazy(() => import('./pages/hotel/BookingsPage').then(m => ({ default: m.BookingsPage })))
const BookingDetailPage = lazy(() => import('./pages/hotel/BookingDetailPage').then(m => ({ default: m.BookingDetailPage })))
const RoomsPage = lazy(() => import('./pages/hotel/RoomsPage').then(m => ({ default: m.RoomsPage })))
const HousekeepingPage = lazy(() => import('./pages/hotel/HousekeepingPage').then(m => ({ default: m.HousekeepingPage })))
const FoliosPage = lazy(() => import('./pages/hotel/FoliosPage').then(m => ({ default: m.FoliosPage })))
const NightAuditPage = lazy(() => import('./pages/hotel/NightAuditPage').then(m => ({ default: m.NightAuditPage })))
const BroadcastPage = lazy(() => import('./pages/BroadcastPage').then(m => ({ default: m.BroadcastPage })))
const DiscountRulesPage = lazy(() => import('./pages/DiscountRulesPage').then(m => ({ default: m.DiscountRulesPage })))
const POSSettingsPage = lazy(() => import('./pages/POSSettingsPage').then(m => ({ default: m.POSSettingsPage })))
const CustomerDisplayPage = lazy(() => import('./pages/CustomerDisplayPage').then(m => ({ default: m.CustomerDisplayPage })))
const GalleryPage = lazy(() => import('./pages/GalleryPage'))
const DocumentPipelinePage = lazy(() => import('./pages/DocumentPipelinePage'))
const ApprovalsPage = lazy(() => import('./pages/ApprovalsPage'))
const ContractsPage = lazy(() => import('./pages/ContractsPage'))
const AdvancesPage = lazy(() => import('./pages/AdvancesPage'))
const GRNPage = lazy(() => import('./pages/inventory/GRNPage'))
const AgingPage = lazy(() => import('./pages/AgingPage'))

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn())
  if (!isLoggedIn) return <Navigate to="/login" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <Suspense fallback={<div className="min-h-screen" aria-busy="true" />}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        <Route
          element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          }
        >
          <Route path="/" element={<DashboardPage />} />
          <Route path="/invoices" element={<InvoiceListPage />} />
          <Route path="/invoices/new" element={<CreateInvoicePage />} />
          <Route path="/invoices/:id" element={<InvoiceDetailPage />} />
          <Route path="/parties" element={<PartyListPage />} />
          <Route path="/parties/:id" element={<PartyStatementPage />} />
          <Route path="/ai" element={<AIPage />} />

          {/* ── Inventory section with shared sub-nav ── */}
          <Route path="/inventory" element={<InventoryLayout />}>
            <Route index element={<Navigate to="/inventory/stock" replace />} />
            <Route path="stock"          element={<StockLevelsPage />} />
            <Route path="products"       element={<ProductListPage />} />
            <Route path="suppliers"      element={<SuppliersPage />} />
            <Route path="purchase-orders"      element={<PurchaseOrdersPage />} />
            <Route path="purchase-orders/:id"  element={<PurchaseOrderDetailPage />} />
            <Route path="adjustments"    element={<StockAdjustmentPage />} />
            <Route path="transfers"      element={<StockTransfersPage />} />
            <Route path="grn"            element={<GRNPage />} />
          </Route>

          <Route path="/expenses" element={<ExpensePage />} />
          <Route path="/branches" element={<BranchesPage />} />
          <Route path="/website" element={<WebsitePage />} />
          <Route path="/reports" element={<ReportsPage />} />
          <Route path="/staff" element={<StaffPage />} />
          <Route path="/deliveries" element={<DeliveriesPage />} />
          <Route path="/gallery" element={<GalleryPage />} />
          <Route path="/pipeline" element={<DocumentPipelinePage />} />
          <Route path="/approvals" element={<ApprovalsPage />} />
          <Route path="/contracts" element={<ContractsPage />} />
          <Route path="/advances" element={<AdvancesPage />} />
          <Route path="/aging" element={<AgingPage />} />

          {/* ── Hotel section ── */}
          <Route path="/hotel" element={<HotelLayout />}>
            <Route index                 element={<HotelDashboardPage />} />
            <Route path="bookings"       element={<BookingsPage />} />
            <Route path="bookings/new"   element={<BookingsPage />} />
            <Route path="bookings/:id"   element={<BookingDetailPage />} />
            <Route path="rooms"          element={<RoomsPage />} />
            <Route path="housekeeping"   element={<HousekeepingPage />} />
            <Route path="folio"          element={<FoliosPage />} />
            <Route path="night-audit"    element={<NightAuditPage />} />
          </Route>

          <Route path="/broadcast" element={<BroadcastPage />} />
          <Route path="/discount-rules" element={<DiscountRulesPage />} />
          <Route path="/pos-settings" element={<POSSettingsPage />} />

          {/* Legacy /products redirect */}
          <Route path="/products" element={<Navigate to="/inventory/products" replace />} />
        </Route>

        {/* Customer display — no auth, opened in second window by cashier */}
        <Route path="/customer-display" element={<CustomerDisplayPage />} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </Suspense>
    </BrowserRouter>
  )
}
