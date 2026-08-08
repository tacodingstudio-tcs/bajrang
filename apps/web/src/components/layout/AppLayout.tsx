// src/components/layout/AppLayout.tsx
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/store/auth.store'
import { authApi } from '@/lib/api'
import { getEntityConfig } from '@/lib/entityConfig'
import {
  LayoutDashboard, FileText, Warehouse, Users, LogOut, Plus, Store, Sparkles,
  BarChart2, Building2, ShoppingCart, ClipboardCheck, ArrowLeftRight, Package, ChevronDown,
  TrendingDown, UserCheck, Truck, Images, GitBranch, Clock, RefreshCw, Wallet, TrendingUp,
  BedDouble, CalendarDays, Moon, UtensilsCrossed, ChefHat, BarChart3, Settings, MessageCircle, Tag, GraduationCap, HeartPulse, BookMarked, Bot,
} from 'lucide-react'
import { usePendingApprovals } from '@/hooks/useApi'
import { CelebrationsPanel } from '@/components/CelebrationsPanel'
import { LabPrepReminder } from '@/components/LabPrepReminder'

// Nav items that don't depend on domain (static)
const STATIC_NAV = [
  { to: '/',           label: 'Dashboard',    icon: LayoutDashboard },
  { to: '/invoices',   label: 'Invoices',     icon: FileText },
  { to: '/deliveries', label: 'Deliveries',   icon: Truck },
  { to: '/expenses',   label: 'Expenses',     icon: TrendingDown },
  { to: '/staff',      label: 'Staff',        icon: UserCheck },
  { to: '/reports',    label: 'Reports',      icon: BarChart2 },
  { to: '/ai',         label: 'AI Assistant', icon: Sparkles },
  { to: '/branches',   label: 'Branches',     icon: Building2 },
]

const SERVICE_DOMAINS = new Set([
  'clinic','diagnostic_lab','optical','pharmacy','gym','coaching',
  'salon','tiffin','hotel','pest_control','photography','repair','laundry',
])

const BROADCAST_DOMAINS = new Set([
  'restaurant','hotel','salon','textile','jewellery','electronics','hardware',
  'agri','gym','coaching','pharmacy','tiffin','catering','wholesale','enterprise',
  'pest_control','photography','repair','laundry','optical','diagnostic_lab','automobile',
  'event_management',
])

const GALLERY_DOMAINS = new Set([
  'photography','salon','repair','catering','printing','hotel',
  'pest_control','laundry','automobile','event_management',
])

// B2B/trade domains — get pipeline, advances, aging, PO/GRN nav
const B2B_DOMAINS = new Set([
  'wholesale','enterprise','electronics','textile','hardware',
  'printing','jewellery','automobile','agri','catering','iron_steel',
])

// Domains that use quotation → SO → challan → invoice pipeline
const PIPELINE_DOMAINS = new Set([
  'wholesale','enterprise','electronics','textile','hardware','printing',
  'catering','jewellery','automobile','agri','iron_steel',
])

// Domains with recurring billing / contracts (AMC, subscription, retainer)
const RECURRING_DOMAINS = new Set([
  'coaching','tiffin','gym','clinic','pest_control','repair',
  'hotel','photography','enterprise','catering','automobile','printing',
  'diagnostic_lab','optical','laundry',
])

const BASE_INVENTORY_ITEMS = [
  { to: '/inventory/stock',           label: 'Stock Levels',     icon: BarChart2,      b2bOnly: false },
  { to: '/inventory/products',        label: null,               icon: Package,        b2bOnly: false }, // label set dynamically
  { to: '/inventory/suppliers',       label: 'Suppliers',        icon: Building2,      b2bOnly: false },
  { to: '/inventory/purchase-orders', label: 'Purchase Orders',  icon: ShoppingCart,   b2bOnly: true  },
  { to: '/inventory/adjustments',     label: 'Adjustments',      icon: ClipboardCheck, b2bOnly: false },
  { to: '/inventory/transfers',       label: 'Transfers',        icon: ArrowLeftRight, b2bOnly: false },
  { to: '/inventory/grn',             label: 'Goods Receipts',   icon: Package,        b2bOnly: true  },
]

export function AppLayout() {
  const navigate   = useNavigate()
  const location   = useLocation()
  const { user, tenant, branch, refreshToken, logout, canManage } = useAuthStore()
  const inventoryOpen = location.pathname.startsWith('/inventory')

  const domainType  = (branch as any)?.domainType ?? ''
  const entityCfg   = getEntityConfig(domainType)
  const partiesLabel = SERVICE_DOMAINS.has(domainType) ? entityCfg.plural : 'Parties'

  const isManager = canManage()
  const isB2B     = B2B_DOMAINS.has(domainType)
  const inventorySubItems = BASE_INVENTORY_ITEMS
    .filter(i => !i.b2bOnly || isB2B)
    .map(i => i.to === '/inventory/products' ? { ...i, label: entityCfg.catalogPlural } : i)
  const { data: pendingApprovals } = usePendingApprovals({ enabled: isManager && isB2B })
  const pendingCount = Array.isArray(pendingApprovals) ? pendingApprovals.length : 0

  const galleryNav    = GALLERY_DOMAINS.has(domainType)   ? [{ to: '/gallery',   label: 'Gallery',   icon: Images    }] : []
  const broadcastNav  = BROADCAST_DOMAINS.has(domainType) ? [{ to: '/broadcast', label: 'Broadcast',  icon: MessageCircle }] : []
  const pipelineNav   = PIPELINE_DOMAINS.has(domainType)  ? [{ to: '/pipeline',  label: 'Pipeline',  icon: GitBranch }] : []
  const contractsNav  = RECURRING_DOMAINS.has(domainType) ? [{ to: '/contracts', label: 'Contracts', icon: RefreshCw }] : []

  const isHotel      = domainType === 'hotel'
  const isRestaurant = domainType === 'restaurant'

  const restaurantNav = isRestaurant ? [
    { to: '/restaurant',         label: 'Floor Plan',      icon: UtensilsCrossed },
    { to: '/restaurant/kitchen', label: 'Kitchen Display', icon: ChefHat },
    { to: '/restaurant/shift',   label: 'Shift Report',    icon: BarChart3 },
    { to: '/restaurant/setup',   label: 'Setup Tables',    icon: Settings },
  ] : []

  const hotelNav = isHotel ? [
    { to: '/hotel',              label: 'Front Desk',   icon: LayoutDashboard },
    { to: '/hotel/bookings',     label: 'Bookings',     icon: CalendarDays },
    { to: '/hotel/rooms',        label: 'Rooms',        icon: BedDouble },
    { to: '/hotel/housekeeping', label: 'Housekeeping', icon: Sparkles },
    { to: '/hotel/folio',        label: 'Folios',       icon: FileText },
    { to: '/hotel/night-audit',  label: 'Night Audit',  icon: Moon },
  ] : []

  const navItems = [
    { to: '/',         label: 'Dashboard',           icon: LayoutDashboard },
    ...(isHotel ? hotelNav
      : isRestaurant ? restaurantNav
      : [
          { to: '/invoices', label: isB2B ? 'Documents' : 'Bills', icon: FileText },
          ...pipelineNav,
          ...contractsNav,
          { to: '/parties',  label: partiesLabel,          icon: Users },
        ]
    ),
    ...STATIC_NAV.slice(2), // Deliveries, Expenses, Staff, Reports, AI, Branches
    ...galleryNav,
    ...broadcastNav,
    { to: '/discount-rules', label: 'Discounts', icon: Tag },
    { to: '/pos-settings',   label: 'POS Settings', icon: Settings },
    ...(domainType === 'coaching' ? [
      { to: '/coaching/progress', label: 'Student Progress', icon: GraduationCap },
      { to: '/coaching/exams',    label: 'Exams',            icon: BarChart3     },
      { to: '/coaching/plans',    label: 'Monthly Plans',    icon: ClipboardCheck},
      { to: '/coaching/notes',    label: 'Notes Library',    icon: BookMarked    },
      { to: '/coaching/robotics', label: 'Robotics Studio',  icon: Bot           },
    ] : []),
    ...(domainType === 'clinic' ? [{ to: '/clinic/patients', label: 'Patient History', icon: HeartPulse }] : []),
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

        {/* Quick create button */}
        <div className="p-3">
          <NavLink
            to={isHotel ? '/hotel/bookings' : isRestaurant ? '/restaurant' : '/invoices/new'}
            className="btn-primary w-full justify-center"
          >
            <Plus className="w-4 h-4" />
            {isHotel ? 'New Booking' : isRestaurant ? 'Floor Plan' : 'New Invoice'}
          </NavLink>
        </div>

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

          {/* Aging / Outstanding — B2B + owner/manager only */}
          {isB2B && isManager && (
            <NavLink to="/aging"
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive ? 'bg-primary-50 text-primary-700' : 'text-gray-600 hover:bg-gray-100'
                }`
              }>
              <TrendingUp className="w-4 h-4" />
              <span className="flex-1">Aging Report</span>
            </NavLink>
          )}

          {/* Advances — B2B + owner/manager only */}
          {isB2B && isManager && (
            <NavLink to="/advances"
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive ? 'bg-primary-50 text-primary-700' : 'text-gray-600 hover:bg-gray-100'
                }`
              }>
              <Wallet className="w-4 h-4" />
              <span className="flex-1">Advances</span>
            </NavLink>
          )}

          {/* Approvals — B2B + owner/manager only */}
          {isB2B && isManager && <NavLink to="/approvals"
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                isActive ? 'bg-primary-50 text-primary-700' : 'text-gray-600 hover:bg-gray-100'
              }`
            }>
            <Clock className="w-4 h-4" />
            <span className="flex-1">Approvals</span>
            {pendingCount > 0 && (
              <span className="ml-auto bg-yellow-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                {pendingCount}
              </span>
            )}
          </NavLink>}

          {/* Inventory — expandable section */}
          <NavLink
            to="/inventory"
            className={() =>
              `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                inventoryOpen
                  ? 'bg-primary-50 text-primary-700'
                  : 'text-gray-600 hover:bg-gray-100'
              }`
            }
          >
            <Warehouse className="w-4 h-4" />
            <span className="flex-1">Inventory</span>
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${inventoryOpen ? 'rotate-180' : ''}`} />
          </NavLink>

          {inventoryOpen && (
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
              <div className="text-xs text-gray-500 capitalize">{user?.role}</div>
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
          {domainType === 'coaching' && <LabPrepReminder />}
          <CelebrationsPanel businessName={branch?.name ?? tenant?.name ?? 'Our Store'} />
        </div>
        <div className="flex-1 overflow-y-auto">
          <Outlet />
        </div>
      </main>

    </div>
  )
}
