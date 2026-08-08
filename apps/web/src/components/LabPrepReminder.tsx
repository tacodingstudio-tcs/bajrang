// LabPrepReminder — bell icon in top bar for upcoming experiments needing prep
import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { FlaskConical, X, AlertCircle, CheckCircle2 } from 'lucide-react'
import { useExperimentPlanner } from '@/hooks/useApi'

function weekStartDate(monthYear: string, weekNumber: number): Date {
  const [y, m] = monthYear.split('-').map(Number)
  // First day of month
  const firstDay = new Date(y, m - 1, 1)
  // Week 1 = days 1-7, Week 2 = days 8-14, etc.
  const dayOffset = (weekNumber - 1) * 7
  return new Date(y, m - 1, 1 + dayOffset)
}

function daysUntil(date: Date): number {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.round((date.getTime() - today.getTime()) / 86400000)
}

function urgencyLabel(days: number): { label: string; color: string } {
  if (days < 0)  return { label: 'Overdue',      color: 'text-red-600 bg-red-50 border-red-200' }
  if (days === 0) return { label: 'Today',        color: 'text-red-600 bg-red-50 border-red-200' }
  if (days <= 3)  return { label: `In ${days}d`,  color: 'text-orange-600 bg-orange-50 border-orange-200' }
  if (days <= 7)  return { label: `In ${days}d`,  color: 'text-yellow-600 bg-yellow-50 border-yellow-200' }
  return          { label: `In ${days}d`,         color: 'text-gray-500 bg-gray-50 border-gray-200' }
}

export function LabPrepReminder() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  const { data } = useExperimentPlanner()

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const allItems: any[] = Array.isArray(data) ? data : []

  // Build flat list of pending experiments with timing
  const pending = allItems.flatMap(item => {
    const weekStart = weekStartDate(item.monthYear, item.weekNumber)
    const days = daysUntil(weekStart)
    // Show only within next 21 days and not already fully prepared
    if (days > 21) return []
    return item.experiments
      .filter((e: any) => !e.prep?.prepDone)
      .map((e: any) => ({
        topic:      e.topic,
        expName:    e.experiment?.name ?? e.practicalActivity?.name ?? e.topic,
        subject:    item.subject,
        batchName:  item.batchName,
        weekNumber: item.weekNumber,
        planId:     item.planId,
        days,
        weekStart,
        totalItems: [
          ...(e.experiment?.apparatus ?? []),
          ...(e.experiment?.chemicals ?? []),
          ...(e.practicalActivity?.materials ?? []),
        ].length,
        arrangedItems: Object.values(e.prep?.itemStatus ?? {}).filter(Boolean).length,
      }))
  }).sort((a, b) => a.days - b.days)

  // Urgent = within 7 days
  const urgentCount = pending.filter(p => p.days <= 7).length

  // Don't render anything if no coaching domain (no data ever loads)
  if (!data && !open) return null
  if (pending.length === 0 && !open) return null

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        title="Lab Prep Reminders"
        className="relative p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
      >
        <FlaskConical className="w-5 h-5" />
        {urgentCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-orange-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
            {urgentCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-10 w-96 bg-white border border-gray-200 rounded-xl shadow-xl z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50">
            <div className="flex items-center gap-2">
              <FlaskConical className="w-4 h-4 text-green-600" />
              <span className="text-sm font-semibold text-gray-900">Lab Prep</span>
              <span className="text-xs text-gray-400">next 3 weeks</span>
            </div>
            <button type="button" onClick={() => setOpen(false)} title="Close">
              <X className="w-4 h-4 text-gray-400" />
            </button>
          </div>

          <div className="max-h-[28rem] overflow-y-auto">
            {pending.length === 0 ? (
              <div className="py-10 text-center">
                <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-green-400" />
                <p className="text-sm text-gray-500 font-medium">All experiments prepared!</p>
                <p className="text-xs text-gray-400 mt-0.5">No pending lab prep in the next 3 weeks</p>
              </div>
            ) : (
              <>
                {urgentCount > 0 && (
                  <div className="px-4 py-2 bg-orange-50 border-b border-orange-100 flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 text-orange-500 shrink-0" />
                    <span className="text-xs text-orange-700 font-medium">
                      {urgentCount} experiment{urgentCount !== 1 ? 's' : ''} need prep within 7 days
                    </span>
                  </div>
                )}
                {pending.map((p, i) => {
                  const { label, color } = urgencyLabel(p.days)
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => { navigate(`/coaching/plans/${p.planId}`, { state: { tab: 'labprep' } }); setOpen(false) }}
                      className="w-full flex items-start gap-3 px-4 py-3 hover:bg-gray-50 transition-colors border-b border-gray-50 text-left"
                    >
                      <FlaskConical className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-semibold text-gray-800 truncate">{p.expName}</span>
                          <span className={`text-[10px] border px-1.5 py-0.5 rounded-full font-medium ${color}`}>{label}</span>
                        </div>
                        <div className="text-[11px] text-gray-400 mt-0.5">
                          {p.subject} · {p.batchName} · Week {p.weekNumber}
                        </div>
                        {p.totalItems > 0 && (
                          <div className="mt-1 flex items-center gap-1">
                            <div className="flex-1 h-1 bg-gray-100 rounded-full overflow-hidden">
                              <div
                                className="h-1 bg-green-400 rounded-full transition-all"
                                style={{ width: `${Math.round((p.arrangedItems / p.totalItems) * 100)}%` }}
                              />
                            </div>
                            <span className="text-[10px] text-gray-400 shrink-0">
                              {p.arrangedItems}/{p.totalItems} arranged
                            </span>
                          </div>
                        )}
                      </div>
                    </button>
                  )
                })}
              </>
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-gray-100 px-4 py-2.5">
            <button
              type="button"
              onClick={() => { navigate('/coaching/plans'); setOpen(false) }}
              className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
            >
              View all plans →
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
