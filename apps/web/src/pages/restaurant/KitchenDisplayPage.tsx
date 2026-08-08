// src/pages/restaurant/KitchenDisplayPage.tsx
// Kitchen Display System (KDS) — auto-refreshes every 10s, intended for a
// wall monitor in the kitchen. Staff bump KOTs from pending → preparing → ready.

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { restaurantApi } from '@/lib/api'
import { Clock, ChefHat, CheckCircle } from 'lucide-react'

const STATIONS = ['all', 'hot_kitchen', 'cold', 'bar', 'tandoor', 'bakery', 'grill']

const STATUS_ORDER = ['pending', 'acknowledged', 'preparing', 'ready']

const STATUS_STYLE: Record<string, { card: string; badge: string }> = {
  pending:      { card: 'border-yellow-400 bg-yellow-50',  badge: 'bg-yellow-100 text-yellow-800' },
  acknowledged: { card: 'border-blue-400 bg-blue-50',     badge: 'bg-blue-100 text-blue-800' },
  preparing:    { card: 'border-orange-400 bg-orange-50', badge: 'bg-orange-100 text-orange-800' },
  ready:        { card: 'border-green-400 bg-green-50',   badge: 'bg-green-100 text-green-800' },
}

const NEXT_STATUS: Record<string, string> = {
  pending:      'acknowledged',
  acknowledged: 'preparing',
  preparing:    'ready',
  ready:        'served',
}

const NEXT_LABEL: Record<string, string> = {
  pending:      'ACK',
  acknowledged: 'START',
  preparing:    'READY',
  ready:        'SERVED',
}

function elapsed(createdAt: string) {
  const mins = Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000)
  if (mins < 1) return '<1m'
  if (mins < 60) return `${mins}m`
  return `${Math.floor(mins / 60)}h${mins % 60}m`
}

function KOTCard({ kot }: { kot: any }) {
  const qc  = useQueryClient()
  const mut = useMutation({
    mutationFn: (status: string) => restaurantApi.updateKOTStatus(kot.id, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['kitchen-queue'] }),
  })

  const style   = STATUS_STYLE[kot.status] ?? STATUS_STYLE['pending']!
  const waitMin = Math.floor((Date.now() - new Date(kot.createdAt).getTime()) / 60000)
  const isUrgent = waitMin >= 15

  const activeItems = (Array.isArray(kot.items) ? kot.items : JSON.parse(kot.items ?? '[]'))
    .filter((i: any) => !i.cancelled)

  return (
    <div className={`rounded-xl border-2 ${style.card} ${isUrgent ? 'ring-2 ring-red-400' : ''} flex flex-col`}>
      {/* Card header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-black/10">
        <div className="flex items-center gap-2">
          {kot.tableNo && (
            <span className="text-lg font-bold text-gray-900">T{kot.tableNo}</span>
          )}
          <span className="text-sm font-mono text-gray-500">{kot.kotNo}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`flex items-center gap-1 text-xs font-medium ${isUrgent ? 'text-red-600' : 'text-gray-500'}`}>
            <Clock className="w-3.5 h-3.5" />
            {elapsed(kot.createdAt)}
          </span>
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full uppercase ${style.badge}`}>
            {kot.status}
          </span>
        </div>
      </div>

      {/* Items */}
      <div className="flex-1 px-4 py-3 space-y-2">
        {activeItems.map((item: any, i: number) => (
          <div key={i} className="flex items-start gap-2">
            <span className="text-xl font-bold text-gray-900 w-8 text-right shrink-0">{item.qty}</span>
            <div className="flex-1 min-w-0">
              <p className="text-base font-semibold text-gray-900 leading-tight">{item.description}</p>
              {item.portion && (
                <p className="text-xs text-gray-500">{item.portion}</p>
              )}
              {item.modifiers?.length > 0 && (
                <p className="text-xs text-blue-700">
                  + {item.modifiers.map((m: any) => m.name).join(', ')}
                </p>
              )}
              {item.notes && (
                <p className="text-xs text-red-600 font-medium">⚠ {item.notes}</p>
              )}
            </div>
          </div>
        ))}
        {kot.notes && (
          <p className="text-xs text-gray-500 border-t border-black/10 pt-2 mt-1">Note: {kot.notes}</p>
        )}
      </div>

      {/* Bump button */}
      {NEXT_STATUS[kot.status] && (
        <button
          type="button"
          onClick={() => mut.mutate(NEXT_STATUS[kot.status]!)}
          disabled={mut.isPending}
          className={`w-full py-2.5 text-sm font-bold rounded-b-xl transition-colors ${
            kot.status === 'ready'
              ? 'bg-green-600 hover:bg-green-700 text-white'
              : 'bg-gray-900 hover:bg-gray-800 text-white'
          }`}
        >
          {mut.isPending ? '…' : NEXT_LABEL[kot.status]}
        </button>
      )}
    </div>
  )
}

export function KitchenDisplayPage() {
  const [station, setStation] = useState('all')
  const [autoRefresh, setAutoRefresh] = useState(true)

  const { data: kots = [], isLoading, dataUpdatedAt } = useQuery<any[]>({
    queryKey: ['kitchen-queue', station],
    queryFn:  () => restaurantApi.kitchenQueue(station === 'all' ? undefined : station),
    refetchInterval: autoRefresh ? 10000 : false,
  })

  // Group by status column
  const byStatus = STATUS_ORDER.reduce((acc, s) => {
    acc[s] = kots.filter(k => k.status === s)
    return acc
  }, {} as Record<string, any[]>)

  return (
    <div className="p-4 min-h-full bg-gray-950 text-white">
      {/* Top bar */}
      <div className="flex items-center gap-3 mb-5">
        <ChefHat className="w-6 h-6 text-primary-400" />
        <h1 className="text-xl font-bold text-white">Kitchen Display</h1>

        {/* Station filter */}
        <div className="flex gap-1 ml-4 overflow-x-auto">
          {STATIONS.map(s => (
            <button
              key={s}
              type="button"
              onClick={() => setStation(s)}
              className={`px-3 py-1 rounded-full text-xs font-medium capitalize whitespace-nowrap transition-colors ${
                station === s
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
              }`}
            >
              {s === 'all' ? 'All Stations' : s.replace('_', ' ')}
            </button>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-3 text-xs text-gray-500">
          <button
            type="button"
            onClick={() => setAutoRefresh(r => !r)}
            className={`px-3 py-1 rounded-full text-xs transition-colors ${
              autoRefresh ? 'bg-green-900 text-green-300' : 'bg-gray-800 text-gray-400'
            }`}
          >
            {autoRefresh ? '● Live' : '○ Paused'}
          </button>
          <span>
            Updated {dataUpdatedAt ? new Date(dataUpdatedAt).toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit', second:'2-digit' }) : '—'}
          </span>
        </div>
      </div>

      {isLoading && (
        <div className="text-center text-gray-500 py-16">Loading kitchen queue…</div>
      )}

      {!isLoading && kots.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-gray-600">
          <CheckCircle className="w-12 h-12 mb-3 text-green-700" />
          <p className="text-lg font-semibold">All clear</p>
          <p className="text-sm">No pending orders</p>
        </div>
      )}

      {/* Kanban columns */}
      {kots.length > 0 && (
        <div className="grid grid-cols-4 gap-4">
          {STATUS_ORDER.map(status => (
            <div key={status}>
              <div className="flex items-center gap-2 mb-3">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400 capitalize">
                  {status}
                </h2>
                {(byStatus[status]?.length ?? 0) > 0 && (
                  <span className="bg-gray-700 text-gray-200 text-xs font-bold px-2 py-0.5 rounded-full">
                    {byStatus[status]!.length}
                  </span>
                )}
              </div>
              <div className="space-y-3">
                {byStatus[status]?.map(kot => (
                  <KOTCard key={kot.id} kot={kot} />
                ))}
                {byStatus[status]?.length === 0 && (
                  <div className="border-2 border-dashed border-gray-800 rounded-xl h-24 flex items-center justify-center text-gray-700 text-sm">
                    Empty
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
