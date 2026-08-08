// Hotel Front Desk Dashboard — room grid, arrivals/departures, occupancy, housekeeping
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { hotelApi } from '@/lib/api'
import {
  BedDouble, Users, LogIn, LogOut, Sparkles, Wrench, Moon, AlertCircle,
  CheckCircle2, Clock, RefreshCw,
} from 'lucide-react'
import toast from 'react-hot-toast'

const STATUS_COLORS: Record<string, string> = {
  available:   'bg-green-100 text-green-800 border-green-200',
  occupied:    'bg-blue-100 text-blue-800 border-blue-200',
  dirty:       'bg-yellow-100 text-yellow-800 border-yellow-200',
  maintenance: 'bg-red-100 text-red-800 border-red-200',
  blocked:     'bg-gray-200 text-gray-600 border-gray-300',
}

const STATUS_ICONS: Record<string, React.ElementType> = {
  available:   CheckCircle2,
  occupied:    Users,
  dirty:       Sparkles,
  maintenance: Wrench,
  blocked:     AlertCircle,
}

function StatCard({ label, value, color, icon: Icon }: {
  label: string; value: number | string; color: string; icon: React.ElementType
}) {
  return (
    <div className={`rounded-xl border p-4 ${color}`}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-medium uppercase tracking-wide opacity-70">{label}</span>
        <Icon className="w-4 h-4 opacity-60" />
      </div>
      <div className="text-3xl font-bold">{value}</div>
    </div>
  )
}

export function HotelDashboardPage() {
  const navigate    = useNavigate()
  const queryClient = useQueryClient()
  const [auditResult, setAuditResult] = useState<any>(null)

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['hotel-dashboard'],
    queryFn:  hotelApi.dashboard,
    refetchInterval: 60_000,
  })

  const nightAudit = useMutation({
    mutationFn: hotelApi.nightAudit,
    onSuccess: (result) => {
      setAuditResult(result)
      queryClient.invalidateQueries({ queryKey: ['hotel-dashboard'] })
      toast.success(`Night audit complete — ${result.charged} folios charged`)
    },
    onError: () => toast.error('Night audit failed'),
  })

  if (isLoading) {
    return <div className="p-8 text-center text-gray-400">Loading front desk…</div>
  }

  const stats      = data?.roomStats ?? {}
  const arrivals   = data?.arrivalsToday   ?? []
  const departures = data?.departuresToday  ?? []
  const inHouse    = data?.inHouse          ?? []
  const hkPending  = data?.housekeepingPending ?? []

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Front Desk</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => refetch()}
            className="btn-ghost text-sm"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => nightAudit.mutate()}
            disabled={nightAudit.isPending}
            className="btn-ghost text-sm"
          >
            <Moon className="w-4 h-4 mr-1" />
            {nightAudit.isPending ? 'Running…' : 'Night Audit'}
          </button>
          <button
            type="button"
            onClick={() => navigate('/hotel/bookings/new')}
            className="btn-primary text-sm"
          >
            <LogIn className="w-4 h-4 mr-1" /> New Booking
          </button>
        </div>
      </div>

      {/* Night audit result */}
      {auditResult && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-sm text-green-800">
          Night audit ran for {auditResult.date}: <strong>{auditResult.charged}</strong> folios charged,{' '}
          <strong>{auditResult.skipped}</strong> already posted.
          <button
            type="button"
            onClick={() => setAuditResult(null)}
            className="ml-3 text-green-600 hover:underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Occupancy stats */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
        <StatCard label="Total"       value={stats.total       ?? 0} color="bg-gray-50 border-gray-200 text-gray-900"      icon={BedDouble}     />
        <StatCard label="Available"   value={stats.available   ?? 0} color="bg-green-50 border-green-200 text-green-900"   icon={CheckCircle2}  />
        <StatCard label="Occupied"    value={stats.occupied    ?? 0} color="bg-blue-50 border-blue-200 text-blue-900"      icon={Users}         />
        <StatCard label="Dirty"       value={stats.dirty       ?? 0} color="bg-yellow-50 border-yellow-200 text-yellow-900" icon={Sparkles}      />
        <StatCard label="Maintenance" value={stats.maintenance ?? 0} color="bg-red-50 border-red-200 text-red-900"         icon={Wrench}        />
        <StatCard
          label="Occupancy"
          value={`${data?.occupancyPct ?? 0}%`}
          color="bg-primary-50 border-primary-200 text-primary-900"
          icon={Clock}
        />
      </div>

      {/* Arrivals + Departures */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Today's Arrivals */}
        <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
            <LogIn className="w-4 h-4 text-green-600" />
            <span className="text-sm font-semibold text-gray-900">Arrivals Today</span>
            <span className="ml-auto text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
              {arrivals.length}
            </span>
          </div>
          {arrivals.length === 0 ? (
            <p className="p-4 text-sm text-gray-400 text-center">No arrivals today</p>
          ) : (
            <div className="divide-y divide-gray-50">
              {arrivals.map((bk: any) => (
                <div
                  key={bk.id}
                  className="px-4 py-3 hover:bg-gray-50 cursor-pointer transition-colors"
                  onClick={() => navigate(`/hotel/bookings/${bk.id}`)}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium text-gray-900">{bk.guestName}</div>
                      <div className="text-xs text-gray-500">
                        Room {bk.roomNo} · {bk.adults}A {bk.children > 0 ? `${bk.children}C` : ''} · {bk.mealPlan}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-gray-400">{bk.folioNo}</div>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); navigate(`/hotel/bookings/${bk.id}?action=checkin`) }}
                        className="mt-1 text-xs btn-primary py-0.5 px-2"
                      >
                        Check In
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Today's Departures */}
        <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
            <LogOut className="w-4 h-4 text-red-500" />
            <span className="text-sm font-semibold text-gray-900">Departures Today</span>
            <span className="ml-auto text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">
              {departures.length}
            </span>
          </div>
          {departures.length === 0 ? (
            <p className="p-4 text-sm text-gray-400 text-center">No departures today</p>
          ) : (
            <div className="divide-y divide-gray-50">
              {departures.map((bk: any) => (
                <div
                  key={bk.id}
                  className="px-4 py-3 hover:bg-gray-50 cursor-pointer transition-colors"
                  onClick={() => navigate(`/hotel/bookings/${bk.id}`)}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium text-gray-900">{bk.guestName}</div>
                      <div className="text-xs text-gray-500">Room {bk.roomNo} · {bk.folioNo}</div>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); navigate(`/hotel/bookings/${bk.id}?action=checkout`) }}
                      className="text-xs bg-red-100 hover:bg-red-200 text-red-700 font-medium px-2 py-0.5 rounded-md transition-colors"
                    >
                      Check Out
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* In-house guests */}
      {inHouse.length > 0 && (
        <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
            <Users className="w-4 h-4 text-blue-600" />
            <span className="text-sm font-semibold text-gray-900">In-House Guests</span>
            <span className="ml-auto text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
              {inHouse.length}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500">
                <tr>
                  <th className="px-4 py-2 text-left">Guest</th>
                  <th className="px-4 py-2 text-left">Room</th>
                  <th className="px-4 py-2 text-left">Check-in</th>
                  <th className="px-4 py-2 text-left">Check-out</th>
                  <th className="px-4 py-2 text-left">Folio</th>
                  <th className="px-4 py-2 text-left">Guests</th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {inHouse.map((bk: any) => (
                  <tr
                    key={bk.id}
                    className="hover:bg-gray-50 cursor-pointer transition-colors"
                    onClick={() => navigate(`/hotel/bookings/${bk.id}`)}
                  >
                    <td className="px-4 py-3 font-medium text-gray-900">{bk.guestName}</td>
                    <td className="px-4 py-3 text-gray-600">{bk.roomNo} <span className="text-gray-400 text-xs">({bk.roomType})</span></td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {new Date(bk.actualCheckIn ?? bk.checkIn).toLocaleDateString('en-IN')}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {new Date(bk.checkOut).toLocaleDateString('en-IN')}
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs font-mono">{bk.folioNo}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{bk.adults}A {bk.children > 0 ? `${bk.children}C` : ''}</td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); navigate(`/hotel/bookings/${bk.id}`) }}
                        className="text-xs text-primary-600 hover:underline"
                      >
                        View Folio
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Housekeeping pending */}
      {hkPending.length > 0 && (
        <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-yellow-600" />
            <span className="text-sm font-semibold text-gray-900">Housekeeping — Today</span>
            <span className="ml-auto text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full font-medium">
              {hkPending.length} pending
            </span>
          </div>
          <div className="divide-y divide-gray-50">
            {hkPending.map((task: any) => (
              <div key={task.id} className="px-4 py-3 flex items-center justify-between">
                <div>
                  <span className="text-sm font-medium text-gray-900">Room {task.roomNo}</span>
                  <span className="ml-2 text-xs text-gray-400">{task.floor ? `Floor ${task.floor}` : ''}</span>
                  <div className="text-xs text-gray-500 mt-0.5 capitalize">
                    {task.taskType.replace(/_/g, ' ')}
                    {task.assignedTo ? ` · ${task.assignedTo}` : ''}
                  </div>
                </div>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                  task.priority === 'urgent' ? 'bg-red-100 text-red-700' :
                  task.priority === 'high'   ? 'bg-orange-100 text-orange-700' :
                  'bg-gray-100 text-gray-600'
                }`}>
                  {task.priority}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
