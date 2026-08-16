// Hotel section layout with sub-navigation tabs
import { NavLink, Outlet } from 'react-router-dom'
import { LayoutDashboard, CalendarDays, BedDouble, Sparkles, ClipboardList, Moon } from 'lucide-react'
import { useAuthStore } from '@/store/auth.store'

const SUB_NAV = [
  { to: '/hotel',              label: 'Front Desk',   icon: LayoutDashboard, end: true },
  { to: '/hotel/bookings',     label: 'Bookings',     icon: CalendarDays },
  { to: '/hotel/rooms',        label: 'Rooms',        icon: BedDouble },
  { to: '/hotel/housekeeping', label: 'Housekeeping', icon: Sparkles },
  { to: '/hotel/folio',        label: 'Folios',       icon: ClipboardList },
  { to: '/hotel/night-audit',  label: 'Night Audit',  icon: Moon },
]

// viewer (housekeeping) only has server-side access to /hotel/housekeeping
// and /hotel/rooms (read-only) — the other tabs would just 403.
const VIEWER_TABS = new Set(['/hotel/housekeeping', '/hotel/rooms'])

export function HotelLayout() {
  const isViewer = useAuthStore((s) => s.user?.role === 'viewer')
  const tabs = isViewer ? SUB_NAV.filter((t) => VIEWER_TABS.has(t.to)) : SUB_NAV

  return (
    <div className="flex flex-col h-full">
      {/* Sub-nav */}
      <div className="bg-white border-b border-gray-200 px-6">
        <div className="flex gap-1 overflow-x-auto">
          {tabs.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  isActive
                    ? 'border-primary-600 text-primary-700'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`
              }
            >
              <Icon className="w-4 h-4" />
              {label}
            </NavLink>
          ))}
        </div>
      </div>

      {/* Page content */}
      <div className="flex-1 overflow-y-auto">
        <Outlet />
      </div>
    </div>
  )
}
