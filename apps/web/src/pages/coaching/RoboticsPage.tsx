// apps/web/src/pages/coaching/RoboticsPage.tsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Bot, Plus, ChevronRight, Calendar, Users, Trophy,
  Cpu, Zap, Wrench, BrainCircuit, Layers, X, Sparkles,
  CheckCircle2, Clock, Archive,
} from 'lucide-react'
import { useRoboticsProjects, useCreateRoboticsProject, useDeleteRoboticsProject, useCoachingPlans } from '@/hooks/useApi'

const CATEGORIES = ['Arduino', 'AI', 'IoT', 'Mechanical', 'Mixed']
const EVENTS     = ['Exhibition', 'Competition (WRO/ATL)', 'Internal Showcase', 'Science Fair', 'Other']
const STANDARDS  = ['5','6','7','8','9','10','11','12']

const CATEGORY_ICON: Record<string, any> = {
  Arduino:    Cpu,
  AI:         BrainCircuit,
  IoT:        Zap,
  Mechanical: Wrench,
  Mixed:      Layers,
}
const CATEGORY_COLOR: Record<string, string> = {
  Arduino:    'bg-blue-50 text-blue-700 border-blue-200',
  AI:         'bg-purple-50 text-purple-700 border-purple-200',
  IoT:        'bg-green-50 text-green-700 border-green-200',
  Mechanical: 'bg-orange-50 text-orange-700 border-orange-200',
  Mixed:      'bg-gray-50 text-gray-700 border-gray-200',
}

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null
  const d = new Date(dateStr)
  const today = new Date(); today.setHours(0,0,0,0)
  return Math.round((d.getTime() - today.getTime()) / 86400000)
}

function EventBadge({ days }: { days: number | null }) {
  if (days === null) return null
  const label = days < 0 ? `${Math.abs(days)}d ago` : days === 0 ? 'Today!' : `${days}d left`
  const color = days < 0 ? 'text-gray-400' : days <= 7 ? 'text-red-600 bg-red-50 border-red-200' : days <= 30 ? 'text-orange-600 bg-orange-50 border-orange-200' : 'text-green-600 bg-green-50 border-green-200'
  return (
    <span className={`text-[10px] font-bold border px-2 py-0.5 rounded-full ${color}`}>
      <Calendar className="inline w-2.5 h-2.5 mr-0.5" />{label}
    </span>
  )
}

// ── New Project Modal ──────────────────────────────────────────────────────────

function NewProjectModal({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate()
  const createMutation = useCreateRoboticsProject()
  const { data: plansRaw } = useCoachingPlans()
  const plans: any[] = Array.isArray(plansRaw) ? plansRaw : []

  const [form, setForm] = useState({
    title: '', description: '', category: 'Mixed',
    batchName: '', standard: '', targetEvent: '', eventDate: '', planId: '',
  })

  function set(k: string, v: string) { setForm(f => ({ ...f, [k]: v })) }

  async function handleCreate() {
    if (!form.title.trim()) return
    const project = await createMutation.mutateAsync({
      title:       form.title.trim(),
      description: form.description.trim() || undefined,
      category:    form.category,
      batchName:   form.batchName.trim()  || undefined,
      standard:    form.standard          || undefined,
      targetEvent: form.targetEvent       || undefined,
      eventDate:   form.eventDate         || undefined,
      planId:      form.planId            || undefined,
    })
    onClose()
    navigate(`/coaching/robotics/${project.id}`)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <Bot className="w-5 h-5 text-indigo-600" /> New Robotics Project
          </h2>
          <button type="button" title="Close" onClick={onClose}><X className="w-5 h-5 text-gray-400" /></button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="label">Project Title</label>
            <input className="input" placeholder="e.g. Line Follower Robot, AI Object Detector" value={form.title} onChange={e => set('title', e.target.value)} autoFocus />
          </div>
          <div>
            <label className="label">Description <span className="text-gray-400 font-normal">(optional)</span></label>
            <textarea className="input resize-none" rows={2} placeholder="What will students build? What problem does it solve?" value={form.description} onChange={e => set('description', e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Category</label>
              <select title="Category" className="input" value={form.category} onChange={e => set('category', e.target.value)}>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Standard <span className="text-gray-400 font-normal">(optional)</span></label>
              <select title="Standard" className="input" value={form.standard} onChange={e => set('standard', e.target.value)}>
                <option value="">Any class</option>
                {STANDARDS.map(s => <option key={s} value={s}>Class {s}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Batch Name <span className="text-gray-400 font-normal">(optional)</span></label>
              <input className="input" placeholder="e.g. Robotics Batch A" value={form.batchName} onChange={e => set('batchName', e.target.value)} />
            </div>
            <div>
              <label className="label">Target Event</label>
              <select title="Target Event" className="input" value={form.targetEvent} onChange={e => set('targetEvent', e.target.value)}>
                <option value="">None / Internal</option>
                {EVENTS.map(e => <option key={e} value={e}>{e}</option>)}
              </select>
            </div>
          </div>
          {form.targetEvent && (
            <div>
              <label className="label">Event Date</label>
              <input type="date" className="input" value={form.eventDate} onChange={e => set('eventDate', e.target.value)} />
            </div>
          )}
          {plans.length > 0 && (
            <div>
              <label className="label">Link to Monthly Plan <span className="text-gray-400 font-normal">(optional)</span></label>
              <select title="Link to plan" className="input" value={form.planId} onChange={e => set('planId', e.target.value)}>
                <option value="">No linked plan</option>
                {plans.map((p: any) => (
                  <option key={p.id} value={p.id}>{p.subject} — {p.batchName} ({p.monthYear})</option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="flex gap-2 mt-5">
          <button type="button" onClick={onClose} className="btn-ghost flex-1">Cancel</button>
          <button
            type="button"
            disabled={!form.title.trim() || createMutation.isPending}
            onClick={handleCreate}
            className="btn-primary flex-1 flex items-center justify-center gap-1.5"
          >
            <Sparkles className="w-3.5 h-3.5" />
            {createMutation.isPending ? 'Creating…' : 'Create Project'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Project card ───────────────────────────────────────────────────────────────

function ProjectCard({ project, onDelete }: { project: any; onDelete: () => void }) {
  const navigate  = useNavigate()
  const Icon      = CATEGORY_ICON[project.category] ?? Layers
  const colorCls  = CATEGORY_COLOR[project.category] ?? CATEGORY_COLOR.Mixed
  const phases: string[] = Array.isArray(project.phases) ? project.phases : []
  const students  = project.studentProgress ?? []
  const days      = daysUntil(project.eventDate)

  // Phase distribution
  const phaseCounts = phases.map((_: string, i: number) =>
    students.filter((s: any) => s.currentPhase === i).length
  )
  const maxPhaseStudents = students.filter((s: any) => s.currentPhase === phases.length - 1).length

  return (
    <div
      className="bg-white border border-gray-200 rounded-xl p-5 hover:shadow-md hover:border-indigo-200 transition-all cursor-pointer group"
      onClick={() => navigate(`/coaching/robotics/${project.id}`)}
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-2.5">
          <div className={`p-2 rounded-lg border ${colorCls}`}>
            <Icon className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 text-sm group-hover:text-indigo-700 transition-colors">
              {project.title}
            </h3>
            {project.batchName && (
              <p className="text-xs text-gray-400">{project.batchName}{project.standard ? ` · Class ${project.standard}` : ''}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <EventBadge days={days} />
          {project.status === 'completed' && (
            <CheckCircle2 className="w-4 h-4 text-green-500" />
          )}
          <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-indigo-400 transition-colors" />
        </div>
      </div>

      {project.description && (
        <p className="text-xs text-gray-500 mb-3 line-clamp-2">{project.description}</p>
      )}

      {/* Phase progress strip */}
      {phases.length > 0 && students.length > 0 && (
        <div className="mb-3">
          <div className="flex gap-0.5 h-1.5 rounded-full overflow-hidden bg-gray-100">
            {phases.map((_: string, i: number) => (
              <div
                key={i}
                className="flex-1 transition-all"
                style={{
                  backgroundColor: phaseCounts[i] > 0
                    ? i === phases.length - 1 ? '#22c55e'
                    : i >= phases.length * 0.66 ? '#818cf8'
                    : i >= phases.length * 0.33 ? '#fbbf24'
                    : '#93c5fd'
                    : 'transparent'
                }}
              />
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between text-xs text-gray-400">
        <div className="flex items-center gap-1">
          <Users className="w-3.5 h-3.5" />
          {students.length} student{students.length !== 1 ? 's' : ''}
          {maxPhaseStudents > 0 && (
            <span className="text-green-600 font-medium ml-1">{maxPhaseStudents} presentation-ready</span>
          )}
        </div>
        {project.targetEvent && (
          <div className="flex items-center gap-1">
            <Trophy className="w-3 h-3" />
            {project.targetEvent.replace(' (WRO/ATL)', '')}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export function RoboticsPage() {
  const [showNew,   setShowNew]   = useState(false)
  const [filter,    setFilter]    = useState<'active' | 'completed' | 'all'>('active')
  const deleteMutation = useDeleteRoboticsProject()

  const { data, isLoading } = useRoboticsProjects(filter === 'all' ? undefined : filter)
  const projects: any[] = Array.isArray(data) ? data : []

  const totalStudents = projects.reduce((s, p) => s + (p.studentProgress?.length ?? 0), 0)
  const presentationReady = projects.reduce((s, p) => {
    const phases: string[] = Array.isArray(p.phases) ? p.phases : []
    return s + (p.studentProgress ?? []).filter((st: any) => st.currentPhase === phases.length - 1).length
  }, 0)

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-2.5">
            <Bot className="w-6 h-6 text-indigo-600" />
            <h1 className="text-xl font-bold text-gray-900">Robotics Studio</h1>
          </div>
          <p className="text-sm text-gray-500 mt-1">Plan, build, track and present — project-based robotics &amp; AI learning</p>
        </div>
        <button type="button" onClick={() => setShowNew(true)} className="btn-primary flex items-center gap-1.5">
          <Plus className="w-4 h-4" /> New Project
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3 mb-5">
        <div className="bg-indigo-50 rounded-xl p-3 border border-indigo-100">
          <div className="text-2xl font-bold text-indigo-700">{projects.length}</div>
          <div className="text-xs text-indigo-500 mt-0.5">Projects</div>
        </div>
        <div className="bg-blue-50 rounded-xl p-3 border border-blue-100">
          <div className="text-2xl font-bold text-blue-700">{totalStudents}</div>
          <div className="text-xs text-blue-500 mt-0.5">Students</div>
        </div>
        <div className="bg-green-50 rounded-xl p-3 border border-green-100">
          <div className="text-2xl font-bold text-green-700">{presentationReady}</div>
          <div className="text-xs text-green-500 mt-0.5">Presentation Ready</div>
        </div>
        <div className="bg-yellow-50 rounded-xl p-3 border border-yellow-100">
          <div className="text-2xl font-bold text-yellow-700">
            {projects.filter(p => p.eventDate && daysUntil(p.eventDate) !== null && daysUntil(p.eventDate)! <= 30 && daysUntil(p.eventDate)! >= 0).length}
          </div>
          <div className="text-xs text-yellow-600 mt-0.5">Events This Month</div>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit mb-5">
        {(['active', 'completed', 'all'] as const).map(f => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors capitalize ${
              filter === f ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {f === 'active' ? <Clock className="w-3 h-3" /> : f === 'completed' ? <CheckCircle2 className="w-3 h-3" /> : <Archive className="w-3 h-3" />}
            {f}
          </button>
        ))}
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="py-20 text-center text-gray-400">
          <Bot className="w-10 h-10 mx-auto mb-3 animate-pulse" />
          <p className="text-sm">Loading projects…</p>
        </div>
      )}

      {/* Empty */}
      {!isLoading && projects.length === 0 && (
        <div className="py-20 text-center">
          <Bot className="w-14 h-14 mx-auto mb-4 text-gray-200" />
          <p className="text-gray-500 font-medium text-lg">No robotics projects yet</p>
          <p className="text-sm text-gray-400 mt-1 mb-5">Create your first project to start tracking student progress</p>
          <button type="button" onClick={() => setShowNew(true)} className="btn-primary inline-flex items-center gap-1.5">
            <Plus className="w-4 h-4" /> Create First Project
          </button>
        </div>
      )}

      {/* Project grid */}
      {!isLoading && projects.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {projects.map((p: any) => (
            <ProjectCard
              key={p.id}
              project={p}
              onDelete={() => { if (confirm(`Delete "${p.title}"?`)) deleteMutation.mutate(p.id) }}
            />
          ))}
        </div>
      )}

      {showNew && <NewProjectModal onClose={() => setShowNew(false)} />}
    </div>
  )
}
