// Hotel Housekeeping Board — Kanban-style task management
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { hotelApi } from '@/lib/api'
import { PageHeader } from '@/components/layout/PageHeader'
import { Plus, X, CheckCircle2, Clock, Loader2, MinusCircle } from 'lucide-react'
import toast from 'react-hot-toast'

const TASK_TYPES = [
  { value: 'stay_clean',     label: 'Stay-over Clean' },
  { value: 'checkout_clean', label: 'Checkout Clean' },
  { value: 'deep_clean',     label: 'Deep Clean' },
  { value: 'maintenance',    label: 'Maintenance' },
  { value: 'turndown',       label: 'Turndown Service' },
]

const STATUSES: { value: string; label: string; icon: React.ElementType; color: string }[] = [
  { value: 'pending',     label: 'Pending',     icon: Clock,         color: 'bg-yellow-50 border-yellow-200' },
  { value: 'in_progress', label: 'In Progress', icon: Loader2,       color: 'bg-blue-50 border-blue-200' },
  { value: 'done',        label: 'Done',        icon: CheckCircle2,  color: 'bg-green-50 border-green-200' },
  { value: 'skipped',     label: 'Skipped',     icon: MinusCircle,   color: 'bg-gray-50 border-gray-200' },
]

const PRIORITY_BADGE: Record<string, string> = {
  urgent: 'bg-red-100 text-red-700',
  high:   'bg-orange-100 text-orange-700',
  normal: 'bg-gray-100 text-gray-600',
  low:    'bg-gray-50 text-gray-400',
}

function AddTaskModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient()
  const { data: rooms = [] } = useQuery({
    queryKey: ['hotel-rooms'],
    queryFn:  () => hotelApi.listRooms(),
  })
  const [form, setForm] = useState({
    roomId:       '',
    taskType:     'stay_clean',
    priority:     'normal',
    assignedTo:   '',
    notes:        '',
    scheduledFor: new Date().toISOString().split('T')[0],
  })
  const create = useMutation({
    mutationFn: (data: any) => hotelApi.createHousekeepingTask(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hotel-housekeeping'] })
      toast.success('Task created')
      onClose()
    },
  })
  const f = (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm({ ...form, [k]: e.target.value })

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-sm">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h3 className="text-base font-semibold text-gray-900">New Housekeeping Task</h3>
          <button type="button" onClick={onClose}><X className="w-5 h-5 text-gray-400" /></button>
        </div>
        <div className="p-5 space-y-3">
          <div>
            <label className="label">Room *</label>
            <select className="input" value={form.roomId} onChange={f('roomId')}>
              <option value="">— Select room —</option>
              {rooms.map((r: any) => (
                <option key={r.id} value={r.id}>{r.roomNo} ({r.roomType}) – {r.status}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Task Type</label>
            <select className="input" value={form.taskType} onChange={f('taskType')}>
              {TASK_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Priority</label>
              <select className="input" value={form.priority} onChange={f('priority')}>
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
            <div>
              <label className="label">Scheduled For</label>
              <input className="input" type="date" value={form.scheduledFor} onChange={f('scheduledFor')} />
            </div>
          </div>
          <div>
            <label className="label">Assigned To</label>
            <input className="input" value={form.assignedTo} onChange={f('assignedTo')} placeholder="Staff name" />
          </div>
          <div>
            <label className="label">Notes</label>
            <textarea className="input h-16 resize-none" value={form.notes} onChange={f('notes')} placeholder="Special instructions…" />
          </div>
        </div>
        <div className="flex gap-2 p-5 border-t border-gray-100">
          <button type="button" onClick={onClose} className="btn-ghost flex-1 justify-center">Cancel</button>
          <button
            type="button"
            onClick={() => create.mutate(form)}
            disabled={!form.roomId || create.isPending}
            className="btn-primary flex-1 justify-center"
          >
            {create.isPending ? 'Creating…' : 'Create Task'}
          </button>
        </div>
      </div>
    </div>
  )
}

function TaskCard({ task }: { task: any }) {
  const queryClient = useQueryClient()

  const update = useMutation({
    mutationFn: (status: string) => hotelApi.updateHousekeepingTask(task.id, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hotel-housekeeping'] })
      queryClient.invalidateQueries({ queryKey: ['hotel-rooms'] })
      queryClient.invalidateQueries({ queryKey: ['hotel-dashboard'] })
    },
    onError: () => toast.error('Update failed'),
  })

  return (
    <div className="bg-white border border-gray-100 rounded-lg p-3 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div>
          <span className="text-sm font-semibold text-gray-900">Room {task.roomNo}</span>
          {task.floor && <span className="text-xs text-gray-400 ml-1">·Floor {task.floor}</span>}
        </div>
        <span className={`text-xs font-medium px-1.5 py-0.5 rounded flex-shrink-0 ${PRIORITY_BADGE[task.priority] ?? 'bg-gray-100 text-gray-500'}`}>
          {task.priority}
        </span>
      </div>
      <div className="text-xs text-gray-600 mb-2 capitalize">
        {task.taskType.replace(/_/g, ' ')}
      </div>
      {task.assignedTo && (
        <div className="text-xs text-gray-400 mb-2">👤 {task.assignedTo}</div>
      )}
      {task.notes && (
        <div className="text-xs text-gray-400 italic mb-2 truncate">{task.notes}</div>
      )}
      <div className="flex gap-1 mt-2">
        {task.status !== 'in_progress' && task.status !== 'done' && (
          <button
            type="button"
            onClick={() => update.mutate('in_progress')}
            className="flex-1 text-xs bg-blue-50 hover:bg-blue-100 text-blue-700 py-1 rounded transition-colors"
          >
            Start
          </button>
        )}
        {task.status !== 'done' && (
          <button
            type="button"
            onClick={() => update.mutate('done')}
            className="flex-1 text-xs bg-green-50 hover:bg-green-100 text-green-700 py-1 rounded transition-colors"
          >
            Done ✓
          </button>
        )}
        {task.status !== 'skipped' && task.status !== 'done' && (
          <button
            type="button"
            onClick={() => update.mutate('skipped')}
            className="text-xs bg-gray-50 hover:bg-gray-100 text-gray-500 px-2 py-1 rounded transition-colors"
          >
            Skip
          </button>
        )}
      </div>
    </div>
  )
}

export function HousekeepingPage() {
  const [date, setDate]     = useState(new Date().toISOString().split('T')[0]!)
  const [showNew, setShowNew] = useState(false)

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['hotel-housekeeping', date],
    queryFn: () => hotelApi.listHousekeeping({ date }),
  })

  const byStatus: Record<string, any[]> = { pending: [], in_progress: [], done: [], skipped: [] }
  for (const t of tasks) {
    if (byStatus[t.status]) byStatus[t.status]!.push(t)
    else byStatus['pending']!.push(t)
  }

  return (
    <div>
      <PageHeader
        title="Housekeeping"
        subtitle={`${tasks.filter((t: any) => t.status !== 'done').length} tasks pending`}
        action={
          <div className="flex items-center gap-3">
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="input text-sm"
            />
            <button type="button" onClick={() => setShowNew(true)} className="btn-primary text-sm">
              <Plus className="w-4 h-4" /> Add Task
            </button>
          </div>
        }
      />

      <div className="p-6">
        {isLoading ? (
          <div className="text-center text-gray-400 py-12">Loading…</div>
        ) : tasks.length === 0 ? (
          <div className="text-center text-gray-400 py-12">
            No housekeeping tasks for {new Date(date).toLocaleDateString('en-IN')}
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {STATUSES.map(({ value, label, icon: Icon, color }) => (
              <div key={value} className={`rounded-xl border p-3 ${color}`}>
                <div className="flex items-center gap-2 mb-3">
                  <Icon className="w-4 h-4" />
                  <span className="text-sm font-semibold">{label}</span>
                  <span className="ml-auto text-xs font-medium bg-white/60 rounded-full px-2 py-0.5">
                    {byStatus[value]?.length ?? 0}
                  </span>
                </div>
                <div className="space-y-2">
                  {(byStatus[value] ?? []).map((task: any) => (
                    <TaskCard key={task.id} task={task} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showNew && <AddTaskModal onClose={() => setShowNew(false)} />}
    </div>
  )
}
