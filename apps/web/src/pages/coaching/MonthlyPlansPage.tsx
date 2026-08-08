// apps/web/src/pages/coaching/MonthlyPlansPage.tsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, BookOpen, ChevronRight, Trash2 } from 'lucide-react'
import { useCoachingPlans, useCreateCoachingPlan, useDeleteCoachingPlan } from '@/hooks/useApi'
import { PageHeader } from '@/components/layout/PageHeader'

const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
]

function monthLabel(my: string) {
  const [y, m] = my.split('-')
  return `${MONTHS[parseInt(m) - 1]} ${y}`
}

function currentMonthYear() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

interface PlanForm {
  batchName: string
  subject: string
  monthYear: string
  notes: string
}

const EMPTY: PlanForm = { batchName: '', subject: '', monthYear: currentMonthYear(), notes: '' }

export function MonthlyPlansPage() {
  const navigate = useNavigate()
  const [filterMonth, setFilterMonth] = useState('')
  const [filterBatch, setFilterBatch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<PlanForm>(EMPTY)

  const { data: plans = [], isLoading } = useCoachingPlans(
    filterMonth || filterBatch
      ? { monthYear: filterMonth || undefined, batchName: filterBatch || undefined }
      : undefined
  )
  const createPlan  = useCreateCoachingPlan()
  const deletePlan  = useDeleteCoachingPlan()

  // Derive unique batches from loaded plans for filter dropdown
  const batches = [...new Set((plans as any[]).map((p: any) => p.batchName))].sort()

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!form.batchName.trim() || !form.subject.trim() || !form.monthYear) return
    const plan = await createPlan.mutateAsync(form)
    setShowForm(false)
    setForm(EMPTY)
    navigate(`/coaching/plans/${plan.id}`)
  }

  // Group plans by monthYear
  const grouped: Record<string, any[]> = {}
  for (const p of plans as any[]) {
    if (!grouped[p.monthYear]) grouped[p.monthYear] = []
    grouped[p.monthYear].push(p)
  }
  const sortedMonths = Object.keys(grouped).sort((a, b) => b.localeCompare(a))

  return (
    <div className="p-8 space-y-6">
      <PageHeader
        title="Monthly Plans"
        subtitle="Syllabus plans per batch, subject and month"
        action={
          <button type="button" className="btn-primary" onClick={() => setShowForm(true)}>
            <Plus className="w-4 h-4" /> New Plan
          </button>
        }
      />

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <input
          type="month"
          value={filterMonth}
          onChange={e => setFilterMonth(e.target.value)}
          className="input w-44"
          placeholder="Filter by month"
        />
        <select value={filterBatch} onChange={e => setFilterBatch(e.target.value)} className="input w-52">
          <option value="">All batches</option>
          {batches.map(b => <option key={b}>{b}</option>)}
        </select>
        {(filterMonth || filterBatch) && (
          <button type="button" className="btn-ghost text-sm" onClick={() => { setFilterMonth(''); setFilterBatch('') }}>
            Clear
          </button>
        )}
      </div>

      {/* Create form */}
      {showForm && (
        <form onSubmit={handleCreate} className="bg-white border border-gray-200 rounded-xl p-5 space-y-4 max-w-lg">
          <div className="font-semibold text-gray-900">New Monthly Plan</div>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-xs text-gray-500 mb-1 block">Batch Name</label>
              <input
                className="input w-full"
                placeholder="e.g. Class 10 CBSE, Class 12 Gujarat Board"
                value={form.batchName}
                onChange={e => setForm(f => ({ ...f, batchName: e.target.value }))}
                required
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Subject</label>
              <input
                className="input w-full"
                placeholder="e.g. Mathematics"
                value={form.subject}
                onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
                required
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Month</label>
              <input
                type="month"
                className="input w-full"
                value={form.monthYear}
                onChange={e => setForm(f => ({ ...f, monthYear: e.target.value }))}
                required
              />
            </div>
            <div className="col-span-2">
              <label className="text-xs text-gray-500 mb-1 block">Notes (optional)</label>
              <input
                className="input w-full"
                placeholder="Any notes for this plan..."
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button type="submit" className="btn-primary" disabled={createPlan.isPending}>
              {createPlan.isPending ? 'Creating...' : 'Create Plan'}
            </button>
            <button type="button" className="btn-ghost" onClick={() => { setShowForm(false); setForm(EMPTY) }}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Plans grouped by month */}
      {isLoading ? (
        <div className="text-sm text-gray-500">Loading plans...</div>
      ) : sortedMonths.length === 0 ? (
        <div className="text-sm text-gray-500 mt-4">No plans yet. Create one to get started.</div>
      ) : (
        <div className="space-y-8">
          {sortedMonths.map(my => (
            <div key={my}>
              <div className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
                {monthLabel(my)}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {grouped[my].map((plan: any) => (
                  <div
                    key={plan.id}
                    className="bg-white border border-gray-200 rounded-xl p-4 hover:border-primary-400 hover:shadow-md transition-all group"
                  >
                    <div className="flex items-start justify-between">
                      <div
                        className="flex-1 cursor-pointer"
                        onClick={() => navigate(`/coaching/plans/${plan.id}`)}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <BookOpen className="w-4 h-4 text-primary-600" />
                          <span className="font-semibold text-gray-900 group-hover:text-primary-700">
                            {plan.subject}
                          </span>
                        </div>
                        <div className="text-xs text-gray-500 mb-2">{plan.batchName}</div>
                        <div className="flex flex-wrap gap-1">
                          {plan.weeks?.map((w: any) => (
                            <span key={w.id} className="text-xs bg-gray-100 text-gray-600 rounded px-1.5 py-0.5">
                              W{w.weekNumber}: {(w.topics as string[]).length} topics
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 ml-2">
                        <button
                          type="button"
                          onClick={() => navigate(`/coaching/plans/${plan.id}`)}
                          className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (confirm('Delete this plan?')) deletePlan.mutate(plan.id)
                          }}
                          className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
