// src/components/layout/AppLayout.tsx
import { useEffect, useState } from 'react'
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/store/auth.store'
import { authApi } from '@/lib/api'
import { getEntityConfig } from '@/lib/entityConfig'
import { CelebrationsPanel } from '@/components/CelebrationsPanel'
import { useFeatures } from '@/hooks/useApi'
import {
  LayoutDashboard, FileText, Warehouse, LogOut, Plus, Store, Sparkles,
  BarChart2, Building2, ShoppingCart, ClipboardCheck, Package, ChevronDown,
  TrendingDown, UserCheck, Truck, Images, RefreshCw,
  BedDouble, CalendarDays, Moon, Settings, MessageCircle, Tag, Globe,
} from 'lucide-react'

// Deliberately hardcoded for a hotel-only deployment — this app never
// switches domainType at runtime, so there's no need for the multi-domain
// Set-based branching the original (generic) billing platform used.
const HOTEL_NAV = [
  { to: '/hotel',              label: 'Front Desk',   icon: LayoutDashboard },
  { to: '/hotel/bookings',     label: 'Bookings',     icon: CalendarDays },
  { to: '/hotel/rooms',        label: 'Rooms',        icon: BedDouble },
  { to: '/hotel/housekeeping', label: 'Housekeeping', icon: Sparkles },
  { to: '/hotel/folio',        label: 'Folios',       icon: FileText },
  { to: '/hotel/night-audit',  label: 'Night Audit',  icon: Moon },
]

// Deliveries lives behind its own feature toggle (see OPERATIONS_NAV usage
// below) — kept separate from this list rather than filtered out of it.
const OPERATIONS_NAV = [
  { to: '/expenses',   label: 'Expenses',   icon: TrendingDown },
  { to: '/staff',      label: 'Staff',      icon: UserCheck },
]

// Purchase Orders and Goods Receipts are shown (ordering supplies from a
// vendor is a real hotel need); Transfers is not (single-property — no
// second branch to move stock to/from).
const INVENTORY_NAV = [
  { to: '/inventory/stock',           label: 'Stock Levels',     icon: BarChart2      },
  { to: '/inventory/products',        label: null,               icon: Package        }, // label set dynamically
  { to: '/inventory/suppliers',       label: 'Suppliers',        icon: Building2      },
  { to: '/inventory/purchase-orders', label: 'Purchase Orders',  icon: ShoppingCart   },
  { to: '/inventory/adjustments',     label: 'Adjustments',      icon: ClipboardCheck },
  { to: '/inventory/grn',             label: 'Goods Receipts',   icon: Package        },
]

export function AppLayout() {
  const navigate   = useNavigate()
  const location   = useLocation()
  const { user, tenant, branch, refreshToken, logout } = useAuthStore()

  // Expanded state is manual (the chevron toggles it), not purely derived
  // from the route — otherwise it's stuck open the whole time you're
  // anywhere under /inventory and the chevron does nothing. It still
  // auto-opens when you land on an inventory page via some other link.
  const [inventoryOpen, setInventoryOpen] = useState(location.pathname.startsWith('/inventory'))
  useEffect(() => {
    if (location.pathname.startsWith('/inventory')) setInventoryOpen(true)
  }, [location.pathname])

  const entityCfg = getEntityConfig('hotel')
  const inventorySubItems = INVENTORY_NAV
    .map(i => i.to === '/inventory/products' ? { ...i, label: entityCfg.catalogPlural } : i)

  const isSuperUser = user?.role === 'super_user'
  const isOwner = user?.role === 'owner'
  const isCashier = user?.role === 'cashier'
  const isViewer = user?.role === 'viewer'
  // Cashier is never eligible for AI Assistant, even if the per-user
  // aiEnabled toggle is on — that toggle is meant for manager-tier staff.
  const showAI = isOwner || isSuperUser || (!isCashier && !!user?.aiEnabled)
  const aiNav = showAI ? [{ to: '/ai', label: 'AI Assistant', icon: Sparkles }] : []
  // Editing the public website is owner/super_user only server-side
  // (websiteContentRoutes PATCH) — hide the nav link for manager/cashier
  // rather than showing a page whose Save button would just 403.
  const websiteNav = isOwner ? [{ to: '/website', label: 'Website', icon: Globe }] : []
  // POS Settings (hardware config + feature toggles) is owner/manager only —
  // cashier shouldn't be able to change shared terminal config.
  const posSettingsNav = !isCashier ? [{ to: '/pos-settings', label: 'POS Settings', icon: Settings }] : []
  // Branches (business-level setup) hidden from cashier for now.
  const branchesNav = !isCashier ? [{ to: '/branches', label: 'Branches', icon: Building2 }] : []
  // Reports (GST/P&L/financial) is manager-tier — hidden from cashier, same
  // reasoning as Branches/Website/POS Settings.
  const reportsNav = !isCashier ? [{ to: '/reports', label: 'Reports', icon: BarChart2 }] : []

  // Contracts and Deliveries are hidden-by-default feature modules — off
  // until the owner or super_user turns them on from POS Settings. Skipped
  // entirely for viewer — that role has no server-side access to /api/features.
  const { data: features } = useFeatures({ enabled: !isViewer })
  const contractsNav  = features?.contractsEnabled  ? [{ to: '/contracts',  label: 'Contracts',  icon: RefreshCw }] : []
  const deliveriesNav = features?.deliveriesEnabled ? [{ to: '/deliveries', label: 'Deliveries', icon: Truck }]     : []

  // super_user is a narrow role — website, AI assistant (if granted), and
  // POS settings only. Enforced server-side too (tenantMiddleware); this is
  // just keeping the nav honest about what's actually reachable.
  const superUserNav = [
    { to: '/website', label: 'Website', icon: Globe },
    ...aiNav,
    { to: '/pos-settings', label: 'POS Settings', icon: Settings },
  ]

  // viewer is the hotel's housekeeping-staff role — housekeeping tasks and
  // room status only. Enforced server-side too (tenantMiddleware).
  const viewerNav = [
    { to: '/hotel/housekeeping', label: 'Housekeeping', icon: Sparkles },
    { to: '/hotel/rooms',        label: 'Rooms',        icon: BedDouble },
  ]

  const navItems = isSuperUser ? superUserNav : isViewer ? viewerNav : [
    { to: '/', label: 'Dashboard', icon: LayoutDashboard },
    ...HOTEL_NAV,
    ...deliveriesNav,
    ...OPERATIONS_NAV,
    ...reportsNav,
    ...aiNav,
    ...branchesNav,
    ...websiteNav,
    { to: '/gallery',    label: 'Gallery',    icon: Images },
    { to: '/broadcast',  label: 'Broadcast',  icon: MessageCircle },
    ...contractsNav,
    { to: '/discount-rules', label: 'Discounts', icon: Tag },
    ...posSettingsNav,
  ]

  async function handleLogout() {
    // Revoke the refresh token server-side BEFORE clearing local state —
    // otherwise the token reference is lost and the session technically
    // stays valid server-side until its 30-day expiry, even though the
    // user believes they've logged out. Best-effort: if the network call
    // fails, still proceed to clear local state so the user isn't stuck.
    if (refreshToken) {
      await authApi.logout(refreshToken).catch(() => {})
    }
    logout()
    navigate('/login')
  }

  // super_user has no server-side access outside Website/AI/its own profile
  // (enforced in tenantMiddleware) — bounce it away from any other route
  // client-side too, rather than letting it land on a page that just 403s.
  useEffect(() => {
    if (!isSuperUser) return
    const allowed = ['/website', '/ai', '/pos-settings']
    if (!allowed.some((p) => location.pathname.startsWith(p))) {
      navigate('/website', { replace: true })
    }
  }, [isSuperUser, location.pathname, navigate])

  // viewer has no server-side access outside housekeeping/rooms (read-only)
  // — same reasoning.
  useEffect(() => {
    if (!isViewer) return
    const allowed = ['/hotel/housekeeping', '/hotel/rooms']
    if (!allowed.some((p) => location.pathname.startsWith(p))) {
      navigate('/hotel/housekeeping', { replace: true })
    }
  }, [isViewer, location.pathname, navigate])

  return (
    <div className="flex h-screen bg-gray-50">

      {/* ── Sidebar ──────────────────────────────────────────────────────── */}
      <aside className="w-60 flex-shrink-0 bg-white border-r border-gray-200 flex flex-col">

        {/* Logo / business name */}
        <div className="h-16 flex items-center gap-2 px-5 border-b border-gray-200">
          <div className="w-8 h-8 rounded-lg bg-primary-600 flex items-center justify-center">
            <Store className="w-4 h-4 text-white" />
          </div>
          <div className="overflow-hidden">
            <div className="text-sm font-semibold text-gray-900 truncate">
              {tenant?.name ?? 'BillBook'}
            </div>
            <div className="text-xs text-gray-500 truncate">{branch?.name}</div>
          </div>
        </div>

        {/* Quick create button — not relevant to super_user/viewer's narrow roles */}
        {!isSuperUser && !isViewer && (
          <div className="p-3">
            <NavLink to="/hotel/bookings" className="btn-primary w-full justify-center">
              <Plus className="w-4 h-4" />
              New Booking
            </NavLink>
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 px-3 space-y-1 overflow-y-auto">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} end={to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive ? 'bg-primary-50 text-primary-700' : 'text-gray-600 hover:bg-gray-100'
                }`
              }>
              <Icon className="w-4 h-4" />
              <span className="flex-1">{label}</span>
            </NavLink>
          ))}

          {/* Inventory — expandable section */}
          {!isSuperUser && !isViewer && (
            <button
              type="button"
              onClick={() => setInventoryOpen((o) => !o)}
              className={`flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                inventoryOpen
                  ? 'bg-primary-50 text-primary-700'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <Warehouse className="w-4 h-4" />
              <span className="flex-1 text-left">Inventory</span>
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${inventoryOpen ? 'rotate-180' : ''}`} />
            </button>
          )}

          {!isSuperUser && !isViewer && inventoryOpen && (
            <div className="ml-4 pl-3 border-l border-gray-200 space-y-0.5">
              {inventorySubItems.map(({ to, label, icon: Icon }) => (
                <NavLink
                  key={to}
                  to={to}
                  className={({ isActive }) =>
                    `flex items-center gap-2.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                      isActive
                        ? 'bg-primary-50 text-primary-700'
                        : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
                    }`
                  }
                >
                  <Icon className="w-3.5 h-3.5" />
                  {label}
                </NavLink>
              ))}
            </div>
          )}
        </nav>

        {/* User footer */}
        <div className="p-3 border-t border-gray-200">
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs font-semibold text-gray-600">
              {user?.name?.[0]?.toUpperCase()}
            </div>
            <div className="flex-1 overflow-hidden">
              <div className="text-sm font-medium text-gray-900 truncate">{user?.name}</div>
              <div className="text-xs text-gray-500 capitalize">
                {user?.role === 'super_user' ? 'Super User' : user?.role?.replace('_', ' ')}
              </div>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md"
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* ── Main content ─────────────────────────────────────────────────── */}
      <main className="flex-1 overflow-y-auto flex flex-col">
        {/* Top bar with notifications */}
        <div className="h-12 flex items-center justify-end gap-1 px-4 border-b border-gray-100 bg-white shrink-0">
          {!isSuperUser && !isViewer && <CelebrationsPanel businessName={branch?.name ?? tenant?.name ?? 'Our Store'} />}
        </div>
        <div className="flex-1 overflow-y-auto">
          <Outlet />
        </div>
      </main>

    </div>
  )
}
