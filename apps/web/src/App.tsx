// src/App.tsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './store/auth.store'
import { AppLayout } from './components/layout/AppLayout'
import { LoginPage } from './pages/LoginPage'
import { DashboardPage } from './pages/DashboardPage'
import { InvoiceListPage } from './pages/InvoiceListPage'
import { CreateInvoicePage } from './pages/CreateInvoicePage'
import { InvoiceDetailPage } from './pages/InvoiceDetailPage'
import { ProductListPage } from './pages/ProductListPage'
import { PartyListPage } from './pages/PartyListPage'
import { PartyStatementPage } from './pages/PartyStatementPage'
import { AIPage } from './pages/AIPage'
import { InventoryLayout } from './pages/inventory/InventoryLayout'
import { StockLevelsPage } from './pages/inventory/StockLevelsPage'
import { SuppliersPage } from './pages/inventory/SuppliersPage'
import { PurchaseOrdersPage } from './pages/inventory/PurchaseOrdersPage'
import { PurchaseOrderDetailPage } from './pages/inventory/PurchaseOrderDetailPage'
import { StockAdjustmentPage } from './pages/inventory/StockAdjustmentPage'
import { StockTransfersPage } from './pages/inventory/StockTransfersPage'
import { ExpensePage } from './pages/ExpensePage'
import { BranchesPage } from './pages/BranchesPage'
import { WebsitePage } from './pages/WebsitePage'
import { ReportsPage } from './pages/ReportsPage'
import { StaffPage } from './pages/StaffPage'
import { DeliveriesPage } from './pages/DeliveriesPage'
import GalleryPage from './pages/GalleryPage'
import DocumentPipelinePage from './pages/DocumentPipelinePage'
import ApprovalsPage from './pages/ApprovalsPage'
import ContractsPage from './pages/ContractsPage'
import AdvancesPage from './pages/AdvancesPage'
import GRNPage from './pages/inventory/GRNPage'
import AgingPage from './pages/AgingPage'
import { HotelLayout }         from './pages/hotel/HotelLayout'
import { HotelDashboardPage }  from './pages/hotel/HotelDashboardPage'
import { BookingsPage }        from './pages/hotel/BookingsPage'
import { BookingDetailPage }   from './pages/hotel/BookingDetailPage'
import { RoomsPage }           from './pages/hotel/RoomsPage'
import { HousekeepingPage }    from './pages/hotel/HousekeepingPage'
import { FoliosPage }          from './pages/hotel/FoliosPage'
import { NightAuditPage }      from './pages/hotel/NightAuditPage'
import { BroadcastPage }        from './pages/BroadcastPage'
import { DiscountRulesPage }         from './pages/DiscountRulesPage'
import { POSSettingsPage }           from './pages/POSSettingsPage'
import { CustomerDisplayPage }       from './pages/CustomerDisplayPage'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn())
  if (!isLoggedIn) return <Navigate to="/login" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <BrowserRouter>
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
    </BrowserRouter>
  )
}
