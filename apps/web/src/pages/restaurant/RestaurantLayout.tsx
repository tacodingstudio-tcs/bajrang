// Restaurant section layout with sub-navigation tabs
import { NavLink, Outlet } from 'react-router-dom'
import { LayoutGrid, MonitorCheck, BarChart2, Settings } from 'lucide-react'

const SUB_NAV = [
  { to: '/restaurant',         label: 'Floor Plan',     icon: LayoutGrid,    end: true },
  { to: '/restaurant/kitchen', label: 'Kitchen Display', icon: MonitorCheck },
  { to: '/restaurant/shift',   label: 'Shift Report',   icon: BarChart2 },
  { to: '/restaurant/setup',   label: 'Setup Tables',   icon: Settings },
]

export function RestaurantLayout() {
  return (
    <div className="flex flex-col h-full">
      <div className="bg-white border-b border-gray-200 px-6">
        <div className="flex gap-1 overflow-x-auto">
          {SUB_NAV.map(({ to, label, icon: Icon, end }) => (
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
      <div className="flex-1 overflow-y-auto">
        <Outlet />
      </div>
    </div>
  )
}
