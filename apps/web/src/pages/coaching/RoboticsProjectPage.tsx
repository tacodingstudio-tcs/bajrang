// apps/web/src/pages/coaching/RoboticsProjectPage.tsx
import { useState, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Bot, Users, Trophy, Cpu, ChevronDown, ChevronRight,
  CheckSquare, Square, Star, Mic, Monitor, HelpCircle, Plus, X,
  Wrench, BrainCircuit, Zap, Layers, Package, Trash2, CheckCircle2,
  AlertCircle, PenLine, Save,
} from 'lucide-react'
import {
  useRoboticsProject, useSaveRoboticsProgress, useParties,
  useRoboticsComponents, useSaveRoboticsComponent, useDeleteRoboticsComponent,
  useUpdateRoboticsProject, useCoachingPlan,
} from '@/hooks/useApi'

// ── Helpers ───────────────────────────────────────────────────────────────────

const PHASE_COLORS = [
  'border-gray-200 bg-gray-50',
  'border-blue-200 bg-blue-50',
  'border-yellow-200 bg-yellow-50',
  'border-purple-200 bg-purple-50',
  'border-orange-200 bg-orange-50',
  'border-green-200 bg-green-50',
]
const PHASE_HEADER_COLORS = [
  'bg-gray-100 text-gray-600',
  'bg-blue-100 text-blue-700',
  'bg-yellow-100 text-yellow-700',
  'bg-purple-100 text-purple-700',
  'bg-orange-100 text-orange-700',
  'bg-green-100 text-green-700',
]

function StarRating({ value, onChange }: { value: number; onChange?: (v: number) => void }) {
  return (
    <div className="flex gap-0.5">
      {[1,2,3,4,5].map(i => (
        <button
          key={i}
          type="button"
          title={`${i} star`}
          onClick={() => onChange?.(i === value ? 0 : i)}
          className={`${i <= value ? 'text-yellow-400' : 'text-gray-200'} hover:text-yellow-400 transition-colors`}
          disabled={!onChange}
        >
          <Star className="w-3.5 h-3.5 fill-current" />
        </button>
      ))}
    </div>
  )
}

// ── Student card in phase kanban ───────────────────────────────────────────────

function StudentPhaseCard({
  student, progress, phases, phaseChecklist, components, projectId, partyId, onSave,
}: {
  student: any; progress: any; phases: string[]; phaseChecklist: Record<string, string[]>
  components: any[]; projectId: string; partyId: string; onSave: (data: any) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const currentPhase = progress?.currentPhase ?? 0
  const phaseChecks: Record<string, Record<string, boolean>> = progress?.phaseChecks  ?? {}
  const ratings:     Record<string, number>                  = progress?.ratings      ?? {}
  const pres:        Record<string, any>                     = progress?.presentation  ?? {}
  const compStatus:  Record<string, { have: boolean; qty?: number }> = progress?.components ?? {}

  const currentChecklist: string[] = phaseChecklist[phases[currentPhase] ?? ''] ?? []
  const checksForPhase: Record<string, boolean> = phaseChecks[String(currentPhase)] ?? {}
  const checkedCount = currentChecklist.filter(c => checksForPhase[c]).length

  function save(patch: any) {
    onSave({ projectId, partyId, ...patch })
  }

  function toggleCheck(item: string) {
    const updated = { ...checksForPhase, [item]: !checksForPhase[item] }
    save({ phaseChecks: { ...phaseChecks, [String(currentPhase)]: updated } })
  }

  function setPhase(i: number) {
    save({ currentPhase: i })
  }

  function setRating(key: string, val: number) {
    save({ ratings: { ...ratings, [key]: val } })
  }

  function togglePres(key: string) {
    save({ presentation: { ...pres, [key]: !pres[key] } })
  }

  function setPresConfidence(val: number) {
    save({ presentation: { ...pres, confidence: val } })
  }

  function toggleComp(name: string) {
    const cur = compStatus[name] ?? { have: false }
    save({ components: { ...compStatus, [name]: { ...cur, have: !cur.have } } })
  }

  const isPresReady = currentPhase === phases.length - 1
  const presScore = [pres.canExplain, pres.canDemo, pres.handlesQA].filter(Boolean).length

  return (
    <div className={`rounded-xl border text-left ${PHASE_COLORS[Math.min(currentPhase, PHASE_COLORS.length - 1)]} overflow-hidden`}>
      {/* Card header */}
      <button
        type="button"
        className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-black/5 transition-colors"
        onClick={() => setExpanded(e => !e)}
      >
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-xs shrink-0">
            {student?.name?.charAt(0)?.toUpperCase() ?? '?'}
          </div>
          <div className="min-w-0">
            <div className="text-xs font-semibold text-gray-800 truncate">{student?.name ?? 'Unknown'}</div>
            {progress?.teamName && <div className="text-[10px] text-gray-400 truncate">{progress.teamName}</div>}
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {isPresReady && <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />}
          {currentChecklist.length > 0 && (
            <span className="text-[10px] text-gray-400">{checkedCount}/{currentChecklist.length}</span>
          )}
          {expanded ? <ChevronDown className="w-3.5 h-3.5 text-gray-400" /> : <ChevronRight className="w-3.5 h-3.5 text-gray-400" />}
        </div>
      </button>

      {expanded && (
        <div className="px-3 pb-3 space-y-3">
          {/* Phase selector */}
          <div>
            <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Current Phase</div>
            <div className="flex flex-wrap gap-1">
              {phases.map((ph, i) => (
                <button
                  key={ph}
                  type="button"
                  onClick={() => setPhase(i)}
                  className={`text-[10px] px-2 py-0.5 rounded-full border font-medium transition-colors ${
                    i === currentPhase
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : i < currentPhase
                      ? 'bg-green-100 text-green-700 border-green-200'
                      : 'bg-white text-gray-500 border-gray-200 hover:border-indigo-300'
                  }`}
                >
                  {i < currentPhase ? '✓ ' : ''}{ph}
                </button>
              ))}
            </div>
          </div>

          {/* Current phase checklist */}
          {currentChecklist.length > 0 && (
            <div>
              <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                {phases[currentPhase]} Checklist
              </div>
              <div className="space-y-1">
                {currentChecklist.map(item => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => toggleCheck(item)}
                    className={`w-full flex items-center gap-2 text-left text-xs px-2.5 py-1.5 rounded-lg border transition-colors ${
                      checksForPhase[item]
                        ? 'bg-green-50 border-green-200 text-green-800'
                        : 'bg-white border-gray-100 text-gray-600 hover:border-gray-200'
                    }`}
                  >
                    {checksForPhase[item]
                      ? <CheckSquare className="w-3.5 h-3.5 text-green-500 shrink-0" />
                      : <Square className="w-3.5 h-3.5 text-gray-300 shrink-0" />
                    }
                    <span className={checksForPhase[item] ? 'line-through text-green-600' : ''}>{item}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Quality ratings */}
          <div>
            <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Quality Ratings</div>
            <div className="space-y-1.5">
              {[
                { key: 'circuit',    label: '⚡ Circuit'    },
                { key: 'code',       label: '💻 Code'       },
                { key: 'creativity', label: '🎨 Creativity' },
                { key: 'teamwork',   label: '🤝 Teamwork'   },
              ].map(({ key, label }) => (
                <div key={key} className="flex items-center justify-between">
                  <span className="text-[11px] text-gray-600 w-24">{label}</span>
                  <StarRating value={ratings[key] ?? 0} onChange={v => setRating(key, v)} />
                </div>
              ))}
            </div>
          </div>

          {/* Presentation readiness */}
          <div>
            <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
              Presentation Readiness {presScore}/3
            </div>
            <div className="space-y-1">
              {[
                { key: 'canExplain', icon: Mic,         label: 'Can explain the solution' },
                { key: 'canDemo',    icon: Monitor,     label: 'Live demo works perfectly' },
                { key: 'handlesQA', icon: HelpCircle,  label: 'Handles Q&A confidently'  },
              ].map(({ key, icon: Icon, label }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => togglePres(key)}
                  className={`w-full flex items-center gap-2 text-left text-xs px-2.5 py-1.5 rounded-lg border transition-colors ${
                    pres[key]
                      ? 'bg-green-50 border-green-200 text-green-800'
                      : 'bg-white border-gray-100 text-gray-600 hover:border-gray-200'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 shrink-0 ${pres[key] ? 'text-green-500' : 'text-gray-300'}`} />
                  {label}
                </button>
              ))}
              <div className="flex items-center justify-between mt-1">
                <span className="text-[11px] text-gray-500">Confidence</span>
                <StarRating value={pres.confidence ?? 0} onChange={setPresConfidence} />
              </div>
            </div>
          </div>

          {/* Components checked out */}
          {components.length > 0 && (
            <div>
              <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Components</div>
              <div className="flex flex-wrap gap-1">
                {components.map((c: any) => (
                  <button
                    key={c.name}
                    type="button"
                    onClick={() => toggleComp(c.name)}
                    className={`text-[10px] px-2 py-0.5 rounded border transition-colors ${
                      compStatus[c.name]?.have
                        ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
                        : 'bg-white border-gray-200 text-gray-400 hover:border-indigo-200'
                    }`}
                  >
                    {compStatus[c.name]?.have ? '✓ ' : ''}{c.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Presentation Summary ───────────────────────────────────────────────────────

function PresentationSummary({ students, progressMap, phases }: { students: any[]; progressMap: Map<string, any>; phases: string[] }) {
  const lastPhase = phases.length - 1

  const rows = students.map(s => {
    const prog = progressMap.get(s.id)
    const pres = prog?.presentation ?? {}
    const ratings = prog?.ratings ?? {}
    const avgRating = ['circuit','code','creativity','teamwork']
      .map(k => ratings[k] ?? 0)
      .reduce((a, b) => a + b, 0) / 4
    return {
      student: s,
      phase: prog?.currentPhase ?? 0,
      isReady: (prog?.currentPhase ?? 0) === lastPhase,
      presScore: [pres.canExplain, pres.canDemo, pres.handlesQA].filter(Boolean).length,
      confidence: pres.confidence ?? 0,
      avgRating,
    }
  }).sort((a, b) => b.phase - a.phase || b.presScore - a.presScore)

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100">
            <th className="text-left py-2 px-3 text-xs text-gray-500 font-medium">Student</th>
            <th className="text-left py-2 px-3 text-xs text-gray-500 font-medium">Phase</th>
            <th className="text-center py-2 px-3 text-xs text-gray-500 font-medium">Explain</th>
            <th className="text-center py-2 px-3 text-xs text-gray-500 font-medium">Demo</th>
            <th className="text-center py-2 px-3 text-xs text-gray-500 font-medium">Q&A</th>
            <th className="text-center py-2 px-3 text-xs text-gray-500 font-medium">Confidence</th>
            <th className="text-center py-2 px-3 text-xs text-gray-500 font-medium">Avg Quality</th>
            <th className="text-center py-2 px-3 text-xs text-gray-500 font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ student, phase, isReady, presScore, confidence, avgRating }) => (
            <tr key={student.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
              <td className="py-2 px-3">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 text-xs font-bold shrink-0">
                    {student.name?.charAt(0)?.toUpperCase()}
                  </div>
                  <span className="text-xs font-medium text-gray-800">{student.name}</span>
                </div>
              </td>
              <td className="py-2 px-3">
                <span className="text-xs text-gray-500">{phases[phase] ?? '—'}</span>
              </td>
              <td className="py-2 px-3 text-center">
                {presScore >= 1 ? <CheckCircle2 className="w-4 h-4 text-green-500 mx-auto" /> : <AlertCircle className="w-4 h-4 text-gray-200 mx-auto" />}
              </td>
              <td className="py-2 px-3 text-center">
                {presScore >= 2 ? <CheckCircle2 className="w-4 h-4 text-green-500 mx-auto" /> : <AlertCircle className="w-4 h-4 text-gray-200 mx-auto" />}
              </td>
              <td className="py-2 px-3 text-center">
                {presScore >= 3 ? <CheckCircle2 className="w-4 h-4 text-green-500 mx-auto" /> : <AlertCircle className="w-4 h-4 text-gray-200 mx-auto" />}
              </td>
              <td className="py-2 px-3 text-center">
                <StarRating value={confidence} />
              </td>
              <td className="py-2 px-3 text-center">
                <div className="flex items-center justify-center gap-0.5">
                  {[1,2,3,4,5].map(i => (
                    <div key={i} className={`w-2 h-2 rounded-full ${i <= avgRating ? 'bg-yellow-400' : 'bg-gray-100'}`} />
                  ))}
                </div>
              </td>
              <td className="py-2 px-3 text-center">
                {isReady && presScore === 3
                  ? <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">Ready ✓</span>
                  : <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">In Progress</span>
                }
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Component Inventory ────────────────────────────────────────────────────────

function ComponentInventory() {
  const { data } = useRoboticsComponents()
  const saveMutation = useSaveRoboticsComponent()
  const deleteMutation = useDeleteRoboticsComponent()
  const components: any[] = Array.isArray(data) ? data : []

  const [newName, setNewName] = useState('')
  const [newCat,  setNewCat]  = useState('')
  const [newQty,  setNewQty]  = useState(1)

  const CATS = ['Microcontroller', 'Sensor', 'Actuator', 'Display', 'Power', 'Misc']

  // Group by category
  const grouped = components.reduce<Record<string, any[]>>((acc, c) => {
    const cat = c.category ?? 'Misc'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(c)
    return acc
  }, {})

  async function addComponent() {
    if (!newName.trim()) return
    await saveMutation.mutateAsync({ name: newName.trim(), category: newCat || 'Misc', totalQty: newQty })
    setNewName(''); setNewCat(''); setNewQty(1)
  }

  return (
    <div className="space-y-4">
      {/* Add form */}
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
        <div className="text-sm font-semibold text-gray-700 mb-3">Add Component / Tool</div>
        <div className="flex gap-2 flex-wrap">
          <input
            className="input flex-1 min-w-[160px] py-1.5 text-sm"
            placeholder="Component name (e.g. Arduino Uno)"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addComponent()}
          />
          <select title="Category" className="input py-1.5 text-sm" value={newCat} onChange={e => setNewCat(e.target.value)}>
            <option value="">Category…</option>
            {CATS.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <input
            type="number" min={1} max={99}
            title="Quantity"
            placeholder="Qty"
            className="input w-20 py-1.5 text-sm text-center"
            value={newQty}
            onChange={e => setNewQty(parseInt(e.target.value) || 1)}
          />
          <button
            type="button"
            title="Add component"
            disabled={!newName.trim() || saveMutation.isPending}
            onClick={addComponent}
            className="btn-primary text-sm py-1.5 px-4"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {components.length === 0 && (
        <div className="py-10 text-center text-gray-400">
          <Package className="w-8 h-8 mx-auto mb-2" />
          <p className="text-sm">No components yet — add your lab inventory above</p>
        </div>
      )}

      {/* Grouped list */}
      {Object.entries(grouped).map(([cat, items]) => (
        <div key={cat}>
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{cat}</div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {items.map((c: any) => (
              <div key={c.name} className="flex items-center justify-between bg-white border border-gray-200 rounded-lg px-3 py-2 group">
                <div>
                  <div className="text-xs font-medium text-gray-800">{c.name}</div>
                  <div className="text-[10px] text-gray-400">Qty: {c.totalQty}</div>
                </div>
                <button
                  type="button"
                  title="Delete component"
                  onClick={() => { if (confirm(`Remove "${c.name}"?`)) deleteMutation.mutate(c.name) }}
                  className="opacity-0 group-hover:opacity-100 p-1 text-gray-300 hover:text-red-500 transition-all"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export function RoboticsProjectPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()
  const [tab, setTab] = useState<'board' | 'presentation' | 'components'>('board')

  const { data: project, isLoading } = useRoboticsProject(projectId!)
  const { data: componentsData } = useRoboticsComponents()
  const components: any[] = Array.isArray(componentsData) ? componentsData : []
  const saveMutation = useSaveRoboticsProgress(projectId!)
  const updateProject = useUpdateRoboticsProject(projectId!)

  // Get students
  const { data: partiesData } = useParties({ type: 'customer', limit: 200 })
  const allParties: any[] = Array.isArray(partiesData) ? partiesData : (partiesData?.data ?? [])

  const students = useMemo(() => {
    if (!project) return []
    const seen = new Set<string>()
    return allParties.filter(p => {
      if (seen.has(p.id)) return false
      seen.add(p.id)
      return !project.batchName || p.meta?.batch_name === project.batchName
    })
  }, [allParties, project])

  const progressMap = useMemo(() => {
    const m = new Map<string, any>()
    for (const p of project?.studentProgress ?? []) m.set(p.partyId, p)
    return m
  }, [project?.studentProgress])

  // Linked plan (optional)
  const { data: planData } = useCoachingPlan(project?.planId ?? '')
  const linkedPlan = planData?.plan ?? null
  const planWeeks: any[] = linkedPlan?.weeks ?? []

  if (isLoading) return <div className="p-8 text-sm text-gray-400">Loading…</div>
  if (!project)  return <div className="p-8 text-sm text-gray-500">Project not found.</div>

  const phases: string[] = Array.isArray(project.phases) ? project.phases : []
  const phaseChecklist: Record<string, string[]> = (project.phaseChecklist as any) ?? {}

  // Group students by current phase
  const byPhase = phases.map((_: string, i: number) =>
    students.filter(s => (progressMap.get(s.id)?.currentPhase ?? 0) === i)
  )
  // Students not yet started (no progress record)
  const unstarted = students.filter(s => !progressMap.has(s.id))

  function saveProgress(data: any) {
    saveMutation.mutate(data)
  }

  const tabs = [
    { id: 'board',        label: 'Phase Board',       icon: Users   },
    { id: 'presentation', label: 'Presentation View', icon: Trophy  },
    { id: 'components',   label: 'Component Inventory', icon: Package },
  ] as const

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-start gap-3 mb-5">
        <button type="button" title="Back to Robotics Studio" onClick={() => navigate('/coaching/robotics')} className="p-1.5 hover:bg-gray-100 rounded-lg mt-0.5">
          <ArrowLeft className="w-5 h-5 text-gray-500" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-2.5 flex-wrap">
            <Bot className="w-5 h-5 text-indigo-600" />
            <h1 className="text-xl font-bold text-gray-900">{project.title}</h1>
            <span className="text-xs font-medium text-indigo-600 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-full">
              {project.category}
            </span>
            {project.targetEvent && (
              <span className="text-xs text-gray-500 flex items-center gap-1">
                <Trophy className="w-3 h-3" /> {project.targetEvent}
              </span>
            )}
          </div>
          {project.description && (
            <p className="text-sm text-gray-500 mt-1">{project.description}</p>
          )}
          <div className="flex gap-3 mt-2">
            <button
              type="button"
              onClick={() => updateProject.mutate({ status: project.status === 'completed' ? 'active' : 'completed' })}
              className={`text-xs flex items-center gap-1 px-3 py-1 rounded-lg border transition-colors ${
                project.status === 'completed'
                  ? 'bg-green-50 border-green-200 text-green-700'
                  : 'bg-gray-50 border-gray-200 text-gray-500 hover:border-green-200 hover:text-green-600'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              {project.status === 'completed' ? 'Completed' : 'Mark Completed'}
            </button>
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-2xl font-bold text-indigo-700">{students.length}</div>
          <div className="text-xs text-gray-400">students</div>
        </div>
      </div>

      {/* Linked plan banner */}
      {linkedPlan && (
        <div className="flex items-center gap-2 px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-xl text-sm">
          <span className="text-amber-600 text-xs font-semibold uppercase tracking-wide">Linked Plan</span>
          <span className="text-gray-700 font-medium">{linkedPlan.subject}</span>
          <span className="text-gray-400">·</span>
          <span className="text-gray-500">{linkedPlan.batchName}</span>
          <span className="text-gray-400">·</span>
          <span className="text-gray-500">{linkedPlan.monthYear}</span>
          <button
            type="button"
            onClick={() => navigate(`/coaching/plans/${linkedPlan.id}`, { state: { tab: 'robotics' } })}
            className="ml-auto text-xs text-amber-700 hover:text-amber-900 font-medium flex items-center gap-1"
          >
            View in Plan →
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit mb-5">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              tab === id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* ── Phase Board ── */}
      {tab === 'board' && (
        <div>
          {students.length === 0 && (
            <div className="py-16 text-center text-gray-400">
              <Users className="w-10 h-10 mx-auto mb-3" />
              <p className="text-sm font-medium">No students found</p>
              <p className="text-xs mt-1">
                {project.batchName
                  ? `Students with batch_name "${project.batchName}" will appear here`
                  : 'All students in your system appear here'}
              </p>
            </div>
          )}
          <div className="flex gap-3 overflow-x-auto pb-2">
            {phases.map((phase: string, i: number) => (
              <div key={phase} className="min-w-[220px] flex-1">
                <div className={`text-xs font-bold px-3 py-1.5 rounded-t-lg ${PHASE_HEADER_COLORS[Math.min(i, PHASE_HEADER_COLORS.length - 1)]}`}>
                  {phase}
                  <span className="ml-1.5 font-normal opacity-70">
                    {(byPhase[i]?.length ?? 0) + (i === 0 ? unstarted.length : 0)}
                  </span>
                </div>
                <div className="space-y-2 p-2 bg-gray-50 rounded-b-lg border border-t-0 border-gray-200 min-h-[80px]">
                  {/* Unstarted students appear in phase 0 */}
                  {i === 0 && unstarted.map(s => (
                    <StudentPhaseCard
                      key={s.id}
                      student={s}
                      progress={null}
                      phases={phases}
                      phaseChecklist={phaseChecklist}
                      components={components}
                      projectId={projectId!}
                      partyId={s.id}
                      onSave={saveProgress}
                    />
                  ))}
                  {(byPhase[i] ?? []).map(s => (
                    <StudentPhaseCard
                      key={s.id}
                      student={s}
                      progress={progressMap.get(s.id)}
                      phases={phases}
                      phaseChecklist={phaseChecklist}
                      components={components}
                      projectId={projectId!}
                      partyId={s.id}
                      onSave={saveProgress}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Presentation View ── */}
      {tab === 'presentation' && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-5 py-3.5 border-b border-gray-100 bg-gray-50 flex items-center gap-2">
            <Trophy className="w-4 h-4 text-yellow-500" />
            <span className="font-semibold text-gray-800 text-sm">Presentation Readiness — {project.targetEvent || 'Showcase'}</span>
            <span className="text-xs text-gray-400 ml-auto">
              {students.filter(s => {
                const p = progressMap.get(s.id)
                const pres = p?.presentation ?? {}
                return p?.currentPhase === phases.length - 1 && pres.canExplain && pres.canDemo && pres.handlesQA
              }).length} / {students.length} fully ready
            </span>
          </div>
          <PresentationSummary students={students} progressMap={progressMap} phases={phases} />
        </div>
      )}

      {/* ── Component Inventory ── */}
      {tab === 'components' && <ComponentInventory />}
    </div>
  )
}
