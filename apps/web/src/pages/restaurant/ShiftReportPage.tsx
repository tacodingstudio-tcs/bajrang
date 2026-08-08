// src/pages/restaurant/ShiftReportPage.tsx
import { useQuery } from '@tanstack/react-query'
import { restaurantApi } from '@/lib/api'
import { BarChart2, RefreshCw } from 'lucide-react'

const STATION_LABELS: Record<string, string> = {
  hot_kitchen: 'Hot Kitchen',
  cold: 'Cold',
  bar: 'Bar',
  tandoor: 'Tandoor',
  bakery: 'Bakery',
  grill: 'Grill',
}

const STATUS_COLORS: Record<string, string> = {
  pending:      'bg-yellow-100 text-yellow-800',
  acknowledged: 'bg-blue-100 text-blue-800',
  preparing:    'bg-orange-100 text-orange-800',
  ready:        'bg-green-100 text-green-800',
  served:       'bg-gray-100 text-gray-700',
  cancelled:    'bg-red-100 text-red-700',
}

export function ShiftReportPage() {
  const { data, isLoading, refetch, isFetching, dataUpdatedAt } = useQuery<any>({
    queryKey: ['shift-summary'],
    queryFn:  () => restaurantApi.shiftSummary(),
    staleTime: 30_000,
  })

  const d: any = data ?? {}
  const kotByStation: Record<string, Record<string, number>> = d.kotsByStation ?? {}
  const tables: any[] = d.tableTurns ?? []
  const totalKOTs   = d.totalKOTs   ?? 0
  const avgTurnMins = d.avgTurnMins  ?? null

  return (
    <div className="p-6 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <BarChart2 className="w-5 h-5 text-primary-600" />
          <h1 className="text-lg font-semibold text-gray-900">Shift Report</h1>
          {dataUpdatedAt && (
            <span className="text-xs text-gray-400 ml-1">
              as of {new Date(dataUpdatedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => refetch()}
          disabled={isFetching}
          className="btn-ghost text-sm"
        >
          <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {isLoading && <div className="text-gray-400 py-10 text-center">Loading summary…</div>}

      {!isLoading && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-3 gap-4 mb-8">
            <div className="bg-white border border-gray-100 rounded-xl p-4">
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Total KOTs Today</p>
              <p className="text-3xl font-bold text-gray-900">{totalKOTs}</p>
            </div>
            <div className="bg-white border border-gray-100 rounded-xl p-4">
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Tables Used</p>
              <p className="text-3xl font-bold text-gray-900">{tables.length}</p>
            </div>
            <div className="bg-white border border-gray-100 rounded-xl p-4">
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Avg Turn Time</p>
              <p className="text-3xl font-bold text-gray-900">
                {avgTurnMins != null ? `${avgTurnMins}m` : '—'}
              </p>
            </div>
          </div>

          {/* KOTs by station */}
          {Object.keys(kotByStation).length > 0 && (
            <div className="mb-8">
              <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-3">KOTs by Station</h2>
              <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500">Station</th>
                      {['pending', 'acknowledged', 'preparing', 'ready', 'served', 'cancelled'].map(s => (
                        <th key={s} className="px-3 py-2.5 text-center text-xs font-medium text-gray-500 capitalize">{s}</th>
                      ))}
                      <th className="px-3 py-2.5 text-center text-xs font-medium text-gray-500">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {Object.entries(kotByStation).map(([station, counts]) => {
                      const total = Object.values(counts).reduce((a, b) => a + b, 0)
                      return (
                        <tr key={station} className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-medium text-gray-900">
                            {STATION_LABELS[station] ?? station}
                          </td>
                          {['pending', 'acknowledged', 'preparing', 'ready', 'served', 'cancelled'].map(s => (
                            <td key={s} className="px-3 py-3 text-center">
                              {counts[s] ? (
                                <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[s]}`}>
                                  {counts[s]}
                                </span>
                              ) : (
                                <span className="text-gray-300">—</span>
                              )}
                            </td>
                          ))}
                          <td className="px-3 py-3 text-center font-bold text-gray-700">{total}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Table turns */}
          {tables.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-3">Table Activity</h2>
              <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500">Table</th>
                      <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500">Section</th>
                      <th className="px-4 py-2.5 text-center text-xs font-medium text-gray-500">KOTs</th>
                      <th className="px-4 py-2.5 text-center text-xs font-medium text-gray-500">Guests</th>
                      <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500">Opened</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {tables.map((t: any) => (
                      <tr key={t.tableId} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium text-gray-900">{t.tableNo}</td>
                        <td className="px-4 py-3 text-gray-500">{t.section ?? '—'}</td>
                        <td className="px-4 py-3 text-center text-gray-700">{t.kotCount}</td>
                        <td className="px-4 py-3 text-center text-gray-700">{t.guestCount ?? '—'}</td>
                        <td className="px-4 py-3 text-gray-500 text-xs">
                          {t.openedAt ? new Date(t.openedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {Object.keys(kotByStation).length === 0 && tables.length === 0 && (
            <div className="text-center py-16 text-gray-400">
              <BarChart2 className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p>No activity recorded for today's shift yet.</p>
            </div>
          )}
        </>
      )}
    </div>
  )
}
