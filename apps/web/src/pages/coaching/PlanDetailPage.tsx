// apps/web/src/pages/coaching/PlanDetailPage.tsx
import { useState, useRef, useEffect, useMemo } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { ArrowLeft, Plus, X, Pencil, Check, BarChart2, Users, BookOpen, NotebookPen, ClipboardList, Sparkles, FlaskConical, CheckSquare, Square, ChevronDown, ChevronRight, AlertCircle, CheckCircle2, Bot, Star, Mic, Monitor, HelpCircle, ExternalLink } from 'lucide-react'
import {
  useCoachingPlan, usePlanProgress, useUpdatePlanWeek, useSetMastery, useTopicNotes,
  useStudentExams, useGenerateWeeklyExam, useExperimentPlanner, useSaveExperimentPrep,
  useRoboticsProjectsByPlan, useSaveRoboticsProgress, useRoboticsComponents,
} from '@/hooks/useApi'
import { useParties } from '@/hooks/useApi'
import { useAuthStore } from '@/store/auth.store'
import { TopicNotesModal } from '@/components/coaching/TopicNotesModal'
import { WeeklyExamModal } from '@/components/coaching/WeeklyExamModal'
import { PhaseKitPanel } from '@/components/coaching/PhaseKitPanel'

// ── Mastery helpers ────────────────────────────────────────────────────────────

const LEVELS = [
  { level: 0, label: 'Not Started', color: 'bg-gray-200 text-gray-500', dot: 'bg-gray-300',  ring: 'ring-gray-300' },
  { level: 1, label: 'Introduced',  color: 'bg-blue-100 text-blue-700',  dot: 'bg-blue-400',  ring: 'ring-blue-400' },
  { level: 2, label: 'Developing',  color: 'bg-yellow-100 text-yellow-700', dot: 'bg-yellow-400', ring: 'ring-yellow-400' },
  { level: 3, label: 'Almost There',color: 'bg-orange-100 text-orange-700', dot: 'bg-orange-400', ring: 'ring-orange-400' },
  { level: 4, label: 'Mastered',    color: 'bg-green-100 text-green-700', dot: 'bg-green-500',  ring: 'ring-green-500' },
]

function MasteryBadge({ level }: { level: number }) {
  const cfg = LEVELS[level] ?? LEVELS[0]
  return (
    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${cfg.color}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  )
}

function MasteryDot({ level, size = 'md' }: { level: number; size?: 'sm' | 'md' }) {
  const cfg = LEVELS[level] ?? LEVELS[0]
  return (
    <span
      className={`rounded-full inline-block ${size === 'sm' ? 'w-3 h-3' : 'w-4 h-4'} ${cfg.dot}`}
      title={cfg.label}
    />
  )
}

// Cycling mastery dot — click to cycle through 0→1→2→3→4→0
function MasteryCell({
  level, onChange, disabled,
}: { level: number; onChange: (l: number) => void; disabled?: boolean }) {
  const cfg = LEVELS[level] ?? LEVELS[0]
  return (
    <button
      type="button"
      disabled={disabled}
      title={`${cfg.label} — click to change`}
      onClick={() => onChange((level + 1) % 5)}
      className={`w-7 h-7 rounded-full border-2 flex items-center justify-center transition-all hover:scale-110 ${cfg.dot} ring-2 ${cfg.ring} ring-offset-1`}
    />
  )
}

// ── Topic chip with notes indicator ──────────────────────────────────────────

function TopicChip({ topic, subject, onRemove, onOpenNotes }: {
  topic: string; subject: string; onRemove: () => void; onOpenNotes: () => void
}) {
  const { data: notes } = useTopicNotes(subject, topic)
  const hasNotes = notes && Object.keys(notes.content ?? {}).length > 0

  return (
    <span className="inline-flex items-center gap-1 text-xs bg-indigo-50 text-indigo-700 rounded-full pl-2.5 pr-1 py-1">
      {topic}
      <button
        type="button"
        onClick={onOpenNotes}
        title={hasNotes ? 'View / edit AI notes' : 'Generate AI notes'}
        className={`rounded-full p-0.5 transition-colors ${hasNotes ? 'text-indigo-500 hover:bg-indigo-200' : 'text-indigo-300 hover:bg-indigo-100'}`}
      >
        <NotebookPen className="w-3 h-3" />
      </button>
      <button type="button" onClick={onRemove} title="Remove topic" className="hover:text-red-500 p-0.5">
        <X className="w-3 h-3" />
      </button>
    </span>
  )
}

// ── Week editor ───────────────────────────────────────────────────────────────

function WeekEditor({ week, planId, subject, batchName, onEnterMarks }: {
  week: any; planId: string; subject: string; batchName: string
  onEnterMarks: (exam: any) => void
}) {
  const [editing, setEditing]         = useState(false)
  const [title, setTitle]             = useState(week.title ?? `Week ${week.weekNumber}`)
  const [topics, setTopics]           = useState<string[]>(Array.isArray(week.topics) ? week.topics : [])
  const [newTopic, setNewTopic]       = useState('')
  const [notesTopic, setNotesTopic]     = useState<string | null>(null)
  const [viewExam, setViewExam]         = useState<any>(null)
  const [showConfig, setShowConfig]     = useState(false)
  const [excludedTopics, setExcludedTopics] = useState<string[]>([])
  const [totalMarks, setTotalMarks]     = useState(100)
  const [specialNote, setSpecialNote]   = useState('')
  const updateWeek    = useUpdatePlanWeek(planId)
  const generateExam  = useGenerateWeeklyExam()
  const { data: examsData } = useStudentExams({ batchName, subject })
  const inputRef = useRef<HTMLInputElement>(null)

  const exams: any[] = Array.isArray(examsData) ? examsData : []
  const weekExam = exams.find((e: any) => e.weekId === week.id || e.notes?.includes(`Week ${week.weekNumber}`))

  function toggleExclude(t: string) {
    setExcludedTopics(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t])
  }

  async function handleGenerateExam() {
    if (topics.length === 0) return
    setShowConfig(false)
    const res = await generateExam.mutateAsync({ weekId: week.id, excludeTopics: excludedTopics, totalMarks, specialNote })
    setViewExam({ ...res.exam, generatedPaper: res.paper })
  }

  useEffect(() => {
    setTopics(Array.isArray(week.topics) ? week.topics : [])
    setTitle(week.title ?? `Week ${week.weekNumber}`)
  }, [week])

  function addTopic() {
    const t = newTopic.trim()
    if (!t || topics.includes(t)) return
    const updated = [...topics, t]
    setTopics(updated)
    setNewTopic('')
    updateWeek.mutate({ weekId: week.id, data: { topics: updated } })
  }

  function removeTopic(t: string) {
    const updated = topics.filter(x => x !== t)
    setTopics(updated)
    updateWeek.mutate({ weekId: week.id, data: { topics: updated } })
  }

  function saveTitle() {
    setEditing(false)
    updateWeek.mutate({ weekId: week.id, data: { title } })
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
      {/* Week header */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-bold text-primary-600 bg-primary-50 rounded px-2 py-0.5">
          Week {week.weekNumber}
        </span>
        {editing ? (
          <div className="flex items-center gap-1 flex-1">
            <input
              ref={inputRef}
              className="input flex-1 py-1 text-sm"
              value={title}
              onChange={e => setTitle(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && saveTitle()}
            />
            <button type="button" onClick={saveTitle} className="p-1 text-green-600 hover:bg-green-50 rounded">
              <Check className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <span
            className="text-sm font-medium text-gray-700 cursor-pointer hover:text-primary-700 flex-1"
            onClick={() => { setEditing(true); setTimeout(() => inputRef.current?.focus(), 50) }}
          >
            {title}
          </span>
        )}
      </div>

      {/* Topics list */}
      <div className="flex flex-wrap gap-1.5 min-h-[28px]">
        {topics.length === 0 && (
          <span className="text-xs text-gray-400 italic">No topics yet — add below</span>
        )}
        {topics.map(t => (
          <TopicChip
            key={t}
            topic={t}
            subject={subject}
            onRemove={() => removeTopic(t)}
            onOpenNotes={() => setNotesTopic(t)}
          />
        ))}
      </div>

      {/* Add topic input */}
      <div className="flex gap-1.5">
        <input
          className="input flex-1 py-1 text-sm"
          placeholder="Add topic..."
          value={newTopic}
          onChange={e => setNewTopic(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && addTopic()}
        />
        <button type="button" onClick={addTopic} className="btn-ghost px-3 py-1 text-sm">
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Weekly exam section */}
      <div className="border-t border-gray-100 pt-2.5 space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          {weekExam && (
            <button
              type="button"
              onClick={() => setViewExam(weekExam)}
              className="flex items-center gap-1.5 text-xs text-indigo-700 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 px-3 py-1.5 rounded-lg font-medium transition-colors"
            >
              <ClipboardList className="w-3.5 h-3.5" />
              View Week {week.weekNumber} Test · {weekExam?.maxMarks ?? 100} marks
              {(weekExam._count?.scores ?? 0) > 0 && (
                <span className="bg-green-100 text-green-700 px-1.5 rounded-full">{weekExam._count.scores} marked</span>
              )}
            </button>
          )}
          <button
            type="button"
            disabled={topics.length === 0 || generateExam.isPending}
            onClick={() => { setShowConfig(c => !c); setExcludedTopics([]); setSpecialNote('') }}
            className="flex items-center gap-1.5 text-xs text-purple-700 bg-purple-50 border border-purple-200 hover:bg-purple-100 disabled:opacity-50 px-3 py-1.5 rounded-lg font-medium transition-colors"
          >
            {generateExam.isPending
              ? <><Sparkles className="w-3.5 h-3.5 animate-pulse" /> Generating…</>
              : weekExam
              ? <><Sparkles className="w-3.5 h-3.5" /> Regenerate</>
              : <><Sparkles className="w-3.5 h-3.5" /> Generate Test</>
            }
          </button>
        </div>

        {/* Topic selection before generating */}
        {showConfig && !generateExam.isPending && (
          <div className="bg-purple-50 border border-purple-100 rounded-lg p-3 space-y-3">
            <div className="text-xs font-semibold text-purple-700">Configure Test</div>

            {/* Marks + structure row */}
            <div className="flex items-center gap-3 flex-wrap">
              <label className="flex items-center gap-1.5 text-xs text-gray-600">
                <span className="font-medium">Total Marks:</span>
                <input
                  type="number"
                  min={10}
                  max={500}
                  value={totalMarks}
                  onChange={e => setTotalMarks(Math.max(10, parseInt(e.target.value) || 100))}
                  className="w-16 border border-purple-200 rounded px-2 py-0.5 text-xs bg-white text-center focus:outline-none focus:ring-1 focus:ring-purple-400"
                />
              </label>
            </div>

            {/* Special note */}
            <div className="space-y-1">
              <div className="text-xs font-medium text-gray-600">Special Instructions <span className="font-normal text-gray-400">(optional)</span></div>
              <textarea
                value={specialNote}
                onChange={e => setSpecialNote(e.target.value)}
                rows={2}
                placeholder="e.g. more MCQs, focus on numericals, no long answer questions, include diagram questions…"
                className="w-full border border-purple-200 rounded-lg px-2.5 py-1.5 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-purple-400 resize-none placeholder-gray-400"
              />
            </div>

            {/* Topic selector */}
            <div className="space-y-1">
              <div className="text-xs font-medium text-gray-600">Topics to include <span className="font-normal text-gray-400">(uncheck delayed)</span></div>
              <div className="flex flex-wrap gap-1.5">
                {topics.map(t => {
                  const excluded = excludedTopics.includes(t)
                  return (
                    <label key={t} className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border cursor-pointer transition-colors ${
                      excluded
                        ? 'bg-gray-100 border-gray-200 text-gray-400 line-through'
                        : 'bg-white border-purple-200 text-purple-800'
                    }`}>
                      <input
                        type="checkbox"
                        checked={!excluded}
                        onChange={() => toggleExclude(t)}
                        className="accent-purple-600 w-3 h-3"
                      />
                      {t}
                    </label>
                  )
                })}
              </div>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-[11px] text-gray-400">
                {topics.length - excludedTopics.length} of {topics.length} topics · {totalMarks} marks paper
              </span>
              <div className="flex gap-1.5">
                <button type="button" onClick={() => setShowConfig(false)} className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1">
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={topics.length === excludedTopics.length}
                  onClick={handleGenerateExam}
                  className="text-xs bg-purple-600 text-white px-3 py-1 rounded-lg hover:bg-purple-700 disabled:opacity-50 flex items-center gap-1"
                >
                  <Sparkles className="w-3 h-3" /> Generate
                </button>
              </div>
            </div>
          </div>
        )}
        {topics.length === 0 && (
          <span className="text-[11px] text-gray-400 italic">Add topics to enable test generation</span>
        )}
      </div>

      {/* Modals */}
      {notesTopic && (
        <TopicNotesModal subject={subject} topic={notesTopic} onClose={() => setNotesTopic(null)} />
      )}
      {viewExam && (
        <WeeklyExamModal
          exam={viewExam}
          weekNumber={week.weekNumber}
          onClose={() => setViewExam(null)}
          onEnterMarks={(exam) => { setViewExam(null); onEnterMarks(exam) }}
        />
      )}
    </div>
  )
}

// ── Mastery Grid ──────────────────────────────────────────────────────────────

function MasteryGrid({
  students, topics, masteryRecords, subject, planId,
}: {
  students: any[];
  topics: string[];
  masteryRecords: any[];
  subject: string;
  planId: string;
}) {
  const setMastery = useSetMastery()

  function getLevel(partyId: string, topic: string) {
    const r = masteryRecords.find((m: any) => m.partyId === partyId && m.topic === topic)
    return r ? r.masteryLevel : 0
  }

  function handleChange(partyId: string, topic: string, level: number) {
    setMastery.mutate({ partyId, subject, topic, masteryLevel: level })
  }

  if (topics.length === 0) {
    return <div className="text-sm text-gray-500">No topics added yet. Add topics in the weekly plan above.</div>
  }

  if (students.length === 0) {
    return (
      <div className="text-sm text-gray-500">
        No students found for this batch. Make sure students have <code>batch_name</code> set in their profile matching this plan's batch name.
      </div>
    )
  }

  // Column avg mastery per topic
  function topicAvg(topic: string) {
    const levels = students.map(s => getLevel(s.id, topic))
    return levels.reduce((a, b) => a + b, 0) / levels.length
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="bg-gray-50">
            <th className="text-left text-xs font-semibold text-gray-500 px-3 py-2 sticky left-0 bg-gray-50 min-w-[140px]">
              Student
            </th>
            {topics.map(t => (
              <th key={t} className="text-center text-xs font-semibold text-gray-600 px-2 py-2 max-w-[100px]">
                <div className="truncate max-w-[90px] mx-auto" title={t}>{t}</div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {students.map((s, si) => (
            <tr key={s.id} className={si % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
              <td className="px-3 py-2 sticky left-0 bg-inherit font-medium text-gray-800 text-xs whitespace-nowrap">
                {s.name}
              </td>
              {topics.map(t => (
                <td key={t} className="px-2 py-2 text-center">
                  <div className="flex justify-center">
                    <MasteryCell
                      level={getLevel(s.id, t)}
                      onChange={l => handleChange(s.id, t, l)}
                      disabled={setMastery.isPending}
                    />
                  </div>
                </td>
              ))}
            </tr>
          ))}
          {/* Average row */}
          <tr className="border-t-2 border-gray-300 bg-gray-100">
            <td className="px-3 py-2 text-xs font-bold text-gray-600 sticky left-0 bg-gray-100">
              Class Avg
            </td>
            {topics.map(t => {
              const avg = topicAvg(t)
              const rounded = Math.round(avg)
              return (
                <td key={t} className="px-2 py-2 text-center">
                  <div className="flex flex-col items-center gap-0.5">
                    <MasteryDot level={rounded} size="sm" />
                    <span className="text-xs text-gray-500">{avg.toFixed(1)}</span>
                  </div>
                </td>
              )
            })}
          </tr>
        </tbody>
      </table>

      {/* Legend */}
      <div className="mt-3 flex flex-wrap gap-3">
        {LEVELS.map(l => (
          <span key={l.level} className="flex items-center gap-1.5 text-xs text-gray-500">
            <span className={`w-3 h-3 rounded-full ${l.dot}`} />
            {l.label}
          </span>
        ))}
        <span className="text-xs text-gray-400 ml-2">Click a dot to cycle through levels</span>
      </div>
    </div>
  )
}

// ── Progress Insights ─────────────────────────────────────────────────────────

function ProgressInsights({ planId }: { planId: string }) {
  const { data, isLoading } = usePlanProgress(planId)

  if (isLoading) return <div className="text-sm text-gray-500">Loading insights...</div>
  if (!data) return null

  const { topicSummary, studentSummary } = data

  const weakTopics   = (topicSummary as any[]).filter((t: any) => t.avgMastery < 2).sort((a: any, b: any) => a.avgMastery - b.avgMastery)
  const strongTopics = (topicSummary as any[]).filter((t: any) => t.avgMastery >= 3)
  const atRisk       = (studentSummary as any[]).filter((s: any) => s.weakTopics.length >= 2)

  return (
    <div className="space-y-4">
      {/* At-risk students */}
      {atRisk.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <div className="text-sm font-semibold text-red-700 mb-2">
            ⚠ Students Needing Attention ({atRisk.length})
          </div>
          <div className="space-y-2">
            {atRisk.map((s: any) => (
              <div key={s.student.id} className="flex items-start gap-2">
                <span className="text-xs font-medium text-red-800 min-w-[120px]">{s.student.name}</span>
                <div className="flex flex-wrap gap-1">
                  {s.weakTopics.map((t: string) => (
                    <span key={t} className="text-xs bg-red-100 text-red-700 rounded px-1.5 py-0.5">{t}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Weak topics */}
      {weakTopics.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
          <div className="text-sm font-semibold text-yellow-800 mb-2">
            Topics Needing More Time
          </div>
          <div className="space-y-2">
            {weakTopics.map((t: any) => (
              <div key={t.topic} className="flex items-center gap-3">
                <span className="text-xs font-medium text-yellow-900 min-w-[140px]">{t.topic}</span>
                <div className="flex-1 bg-yellow-200 rounded-full h-1.5">
                  <div
                    className="bg-yellow-500 h-1.5 rounded-full"
                    style={{ width: `${(t.avgMastery / 4) * 100}%` }}
                  />
                </div>
                <span className="text-xs text-yellow-700">{t.avgMastery.toFixed(1)}/4</span>
                {t.weakStudents.length > 0 && (
                  <span className="text-xs text-yellow-600">
                    {t.weakStudents.slice(0, 2).join(', ')}
                    {t.weakStudents.length > 2 ? ` +${t.weakStudents.length - 2}` : ''}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Strong topics */}
      {strongTopics.length > 0 && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4">
          <div className="text-sm font-semibold text-green-800 mb-2">
            Topics Going Well ✓
          </div>
          <div className="flex flex-wrap gap-2">
            {strongTopics.map((t: any) => (
              <span key={t.topic} className="text-xs bg-green-100 text-green-700 rounded-full px-2.5 py-1 font-medium">
                {t.topic} ({t.avgMastery.toFixed(1)}/4)
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Per-student progress bars */}
      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <div className="text-sm font-semibold text-gray-700 mb-3">Overall Progress per Student</div>
        <div className="space-y-2">
          {(studentSummary as any[])
            .sort((a: any, b: any) => b.avgLevel - a.avgLevel)
            .map((s: any) => (
              <div key={s.student.id} className="flex items-center gap-3">
                <span className="text-xs text-gray-700 min-w-[120px] truncate">{s.student.name}</span>
                <div className="flex-1 bg-gray-100 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all ${
                      s.avgLevel >= 3 ? 'bg-green-500' :
                      s.avgLevel >= 2 ? 'bg-yellow-400' :
                      s.avgLevel >= 1 ? 'bg-blue-400' : 'bg-gray-300'
                    }`}
                    style={{ width: `${(s.avgLevel / 4) * 100}%` }}
                  />
                </div>
                <span className="text-xs text-gray-500 w-8 text-right">{(s.avgLevel * 25).toFixed(0)}%</span>
                <MasteryBadge level={Math.round(s.avgLevel)} />
              </div>
            ))}
        </div>
      </div>
    </div>
  )
}

// ── Lab Prep Tab ──────────────────────────────────────────────────────────────

function LabPrepTab({ planId, weeks, subject }: { planId: string; weeks: any[]; subject: string }) {
  const { data, isLoading } = useExperimentPlanner()
  const savePrepMutation    = useSaveExperimentPrep()

  // Filter planner data to only this plan's weeks
  const planWeekIds = useMemo(() => new Set(weeks.map((w: any) => w.id)), [weeks])
  const items: any[] = useMemo(() =>
    (Array.isArray(data) ? data : []).filter((item: any) => planWeekIds.has(item.weekId)),
  [data, planWeekIds])

  if (isLoading) return <div className="py-16 text-center text-sm text-gray-400">Loading experiments…</div>

  if (items.length === 0) {
    return (
      <div className="py-16 text-center">
        <FlaskConical className="w-12 h-12 mx-auto mb-3 text-gray-200" />
        <p className="text-gray-500 font-medium">No experiments found for this plan</p>
        <p className="text-sm text-gray-400 mt-1">
          Add topics with experiments — AI will pick up apparatus &amp; chemicals from the notes library
        </p>
      </div>
    )
  }

  const totalExps    = items.reduce((s, i) => s + i.experiments.length, 0)
  const preparedExps = items.reduce((s, i) =>
    s + i.experiments.filter((e: any) => e.prep?.prepDone).length, 0)

  return (
    <div className="space-y-5">
      {/* Summary bar */}
      <div className="flex items-center gap-4 bg-green-50 border border-green-100 rounded-xl px-5 py-3">
        <FlaskConical className="w-5 h-5 text-green-600 shrink-0" />
        <div className="flex-1 text-sm text-green-800">
          <span className="font-semibold">{preparedExps}</span> of <span className="font-semibold">{totalExps}</span> experiments fully prepared
        </div>
        {preparedExps < totalExps && (
          <span className="text-xs text-orange-600 bg-orange-50 border border-orange-200 px-2.5 py-1 rounded-full font-medium flex items-center gap-1">
            <AlertCircle className="w-3 h-3" /> {totalExps - preparedExps} pending
          </span>
        )}
      </div>

      {/* Week cards */}
      {items.map(item => (
        <WeekExperimentCard key={item.weekId} item={item} onSave={savePrepMutation.mutate} saving={savePrepMutation.isPending} />
      ))}
    </div>
  )
}

function WeekExperimentCard({ item, onSave, saving }: { item: any; onSave: (d: any) => void; saving: boolean }) {
  const [collapsed, setCollapsed] = useState(false)

  const allDone = item.experiments.every((e: any) => e.prep?.prepDone)

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden bg-white">
      {/* Week header */}
      <button
        type="button"
        onClick={() => setCollapsed(c => !c)}
        className="w-full flex items-center justify-between px-5 py-3.5 bg-gray-50 hover:bg-gray-100 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded">
            Week {item.weekNumber}
          </span>
          {item.title && <span className="text-sm font-medium text-gray-700">{item.title}</span>}
          <span className="text-xs text-gray-400">{item.experiments.length} experiment{item.experiments.length !== 1 ? 's' : ''}</span>
          {allDone
            ? <span className="flex items-center gap-1 text-xs text-green-600"><CheckCircle2 className="w-3.5 h-3.5" /> All prepared</span>
            : <span className="text-xs text-orange-500 font-medium">Preparation needed</span>
          }
        </div>
        {collapsed ? <ChevronRight className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </button>

      {!collapsed && (
        <div className="divide-y divide-gray-50">
          {item.experiments.map((exp: any) => (
            <ExperimentPrepCard
              key={exp.topic}
              weekId={item.weekId}
              subject={item.subject}
              exp={exp}
              onSave={onSave}
              saving={saving}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function ExperimentPrepCard({ weekId, subject, exp, onSave, saving }: {
  weekId: string; subject: string; exp: any; onSave: (d: any) => void; saving: boolean
}) {
  const expt     = exp.experiment
  const activity = exp.practicalActivity
  const prep     = exp.prep

  // Build items list: apparatus + chemicals
  const allItems: string[] = useMemo(() => {
    const items: string[] = []
    if (expt?.apparatus)  items.push(...(expt.apparatus  ?? []))
    if (expt?.chemicals)  items.push(...(expt.chemicals  ?? []))
    if (activity?.materials) items.push(...(activity.materials ?? []))
    return [...new Set(items)].filter(Boolean)
  }, [expt, activity])

  const itemStatus: Record<string, boolean> = prep?.itemStatus ?? {}
  const arrangedCount = allItems.filter(i => itemStatus[i]).length
  const prepDone = prep?.prepDone ?? false

  const [notes, setNotes] = useState(prep?.prepNotes ?? '')
  const [showNotes, setShowNotes] = useState(false)

  function toggleItem(item: string) {
    const updated = { ...itemStatus, [item]: !itemStatus[item] }
    onSave({ weekId, subject, topic: exp.topic, itemStatus: updated, prepDone, prepNotes: notes || undefined })
  }

  function toggleDone() {
    onSave({ weekId, subject, topic: exp.topic, itemStatus, prepDone: !prepDone, prepNotes: notes || undefined })
  }

  function saveNotes() {
    onSave({ weekId, subject, topic: exp.topic, itemStatus, prepDone, prepNotes: notes || undefined })
    setShowNotes(false)
  }

  const name = expt?.name ?? activity?.name ?? exp.topic

  return (
    <div className="p-5 space-y-3">
      {/* Experiment header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <FlaskConical className="w-4 h-4 text-green-500 shrink-0" />
            <span className="text-sm font-semibold text-gray-800">{name}</span>
            <span className="text-xs text-gray-400">({exp.topic})</span>
            {activity && !expt && (
              <span className="text-[10px] bg-blue-50 text-blue-600 border border-blue-100 px-1.5 py-0.5 rounded-full">Activity</span>
            )}
          </div>
          {expt?.aim && (
            <p className="text-xs text-gray-500 mt-0.5 ml-6">{expt.aim}</p>
          )}
        </div>
        <button
          type="button"
          disabled={saving}
          onClick={toggleDone}
          className={`shrink-0 flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium border transition-colors ${
            prepDone
              ? 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100'
              : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
          }`}
        >
          {prepDone ? <><CheckCircle2 className="w-3.5 h-3.5" /> Prepared</> : 'Mark Prepared'}
        </button>
      </div>

      {/* Materials checklist */}
      {allItems.length > 0 && (
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              Materials &amp; Apparatus
            </span>
            <span className="text-xs text-gray-400">{arrangedCount}/{allItems.length} arranged</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
            {allItems.map(item => {
              const checked = !!itemStatus[item]
              return (
                <button
                  key={item}
                  type="button"
                  disabled={saving}
                  onClick={() => toggleItem(item)}
                  className={`flex items-center gap-2 text-left px-3 py-2 rounded-lg border text-xs transition-colors ${
                    checked
                      ? 'bg-green-50 border-green-200 text-green-800'
                      : 'bg-white border-gray-100 text-gray-600 hover:border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  {checked
                    ? <CheckSquare className="w-3.5 h-3.5 text-green-500 shrink-0" />
                    : <Square className="w-3.5 h-3.5 text-gray-300 shrink-0" />
                  }
                  <span className={checked ? 'line-through text-green-600' : ''}>{item}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Precautions */}
      {expt?.precautions?.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-100 rounded-lg px-3 py-2">
          <div className="text-xs font-medium text-yellow-700 mb-1">Precautions</div>
          <ul className="space-y-0.5">
            {expt.precautions.slice(0, 3).map((p: string, i: number) => (
              <li key={i} className="text-xs text-yellow-800">· {p}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Prep notes */}
      <div>
        {showNotes ? (
          <div className="space-y-1.5">
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              placeholder="Add your prep notes, special arrangements, substitutions…"
              className="w-full text-xs border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-400 resize-none"
            />
            <div className="flex gap-1.5">
              <button type="button" onClick={saveNotes} className="text-xs bg-indigo-600 text-white px-3 py-1 rounded-lg hover:bg-indigo-700">Save</button>
              <button type="button" onClick={() => setShowNotes(false)} className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1">Cancel</button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowNotes(true)}
            className="text-xs text-indigo-500 hover:text-indigo-700 hover:underline"
          >
            {prep?.prepNotes ? `📝 ${prep.prepNotes.slice(0, 60)}${prep.prepNotes.length > 60 ? '…' : ''}` : '+ Add prep notes'}
          </button>
        )}
      </div>
    </div>
  )
}

// ── Robotics Tab ──────────────────────────────────────────────────────────────

const PHASE_COLORS = [
  'border-gray-200 bg-gray-50','border-blue-200 bg-blue-50','border-yellow-200 bg-yellow-50',
  'border-purple-200 bg-purple-50','border-orange-200 bg-orange-50','border-green-200 bg-green-50',
]
const PHASE_HEADER = [
  'bg-gray-100 text-gray-600','bg-blue-100 text-blue-700','bg-yellow-100 text-yellow-700',
  'bg-purple-100 text-purple-700','bg-orange-100 text-orange-700','bg-green-100 text-green-700',
]

function StarRatingDisplay({ value }: { value: number }) {
  return (
    <span className="flex gap-0.5">
      {[1,2,3,4,5].map(i => (
        <Star key={i} className={`w-3 h-3 ${i <= value ? 'text-yellow-400 fill-yellow-400' : 'text-gray-200 fill-gray-200'}`} />
      ))}
    </span>
  )
}

function PhaseKitsSection({ project, phases, phaseChecklist, planWeeks }: {
  project: any; phases: string[]; phaseChecklist: Record<string, string[]>; planWeeks: any[]
}) {
  const [activePhase, setActivePhase] = useState(phases[0] ?? '')

  if (phases.length === 0) return null

  const weekTopics: string[] = (() => {
    const idx = phases.indexOf(activePhase)
    const w = planWeeks[idx]
    return w && Array.isArray(w.topics) ? w.topics : []
  })()

  return (
    <div className="border-t border-gray-200 mt-2">
      <div className="px-5 pt-4 pb-2">
        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Teaching Kits per Phase</div>
        {/* Phase tabs */}
        <div className="flex flex-wrap gap-1.5 mb-4">
          {phases.map((ph: string) => {
            const hasKit = !!(project.phaseKits as any)?.[ph]
            return (
              <button
                key={ph}
                type="button"
                onClick={() => setActivePhase(ph)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                  activePhase === ph
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-indigo-300 hover:text-indigo-600'
                }`}
              >
                {ph}
                {hasKit && <span className={`w-1.5 h-1.5 rounded-full ${activePhase === ph ? 'bg-indigo-200' : 'bg-green-400'}`} />}
              </button>
            )
          })}
        </div>
        {/* Active kit panel */}
        <PhaseKitPanel
          projectId={project.id}
          phase={activePhase}
          kit={(project.phaseKits as any)?.[activePhase] ?? null}
          weekTopics={weekTopics}
          checklist={phaseChecklist[activePhase] ?? []}
          projectTitle={project.title}
          category={project.category}
        />
      </div>
    </div>
  )
}

function RoboticsTab({ planId, weeks, batchName }: { planId: string; weeks: any[]; batchName: string }) {
  const navigate = useNavigate()
  const { data: projectsRaw, isLoading } = useRoboticsProjectsByPlan(planId)
  const projects: any[] = Array.isArray(projectsRaw) ? projectsRaw : []

  const { data: partiesData } = useParties({ type: 'customer', limit: 200 })
  const allParties: any[] = Array.isArray(partiesData) ? partiesData : (partiesData?.data ?? [])
  const students = allParties.filter(p => p.meta?.batch_name === batchName)

  const { data: componentsData } = useRoboticsComponents()
  const components: any[] = Array.isArray(componentsData) ? componentsData : []

  if (isLoading) return <div className="py-10 text-sm text-gray-400 text-center">Loading…</div>

  if (projects.length === 0) {
    return (
      <div className="py-16 text-center">
        <Bot className="w-12 h-12 mx-auto mb-3 text-gray-200" />
        <p className="font-medium text-gray-500">No robotics project linked to this plan</p>
        <p className="text-sm text-gray-400 mt-1 mb-4">Go to Robotics Studio → create or edit a project → link it to this plan</p>
        <button
          type="button"
          onClick={() => navigate('/coaching/robotics')}
          className="btn-primary inline-flex items-center gap-1.5"
        >
          <Bot className="w-4 h-4" /> Open Robotics Studio
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {projects.map((project: any) => {
        const phases: string[] = Array.isArray(project.phases) ? project.phases : []
        const phaseChecklist: Record<string, string[]> = project.phaseChecklist ?? {}
        const progressMap = new Map<string, any>()
        for (const p of project.studentProgress ?? []) progressMap.set(p.partyId, p)

        const byPhase = phases.map((_: string, i: number) =>
          students.filter(s => (progressMap.get(s.id)?.currentPhase ?? 0) === i)
        )
        const unstarted = students.filter(s => !progressMap.has(s.id))

        const presReadyCount = students.filter(s => {
          const prog = progressMap.get(s.id)
          const pres = prog?.presentation ?? {}
          return prog?.currentPhase === phases.length - 1 && pres.canExplain && pres.canDemo && pres.handlesQA
        }).length

        return (
          <div key={project.id} className="border border-gray-200 rounded-2xl overflow-hidden">
            {/* Project header */}
            <div className="px-5 py-4 bg-gradient-to-r from-indigo-50 to-purple-50 border-b border-gray-200 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <Bot className="w-4 h-4 text-indigo-600" />
                  <span className="font-bold text-gray-900">{project.title}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 font-medium">{project.category}</span>
                  {project.targetEvent && (
                    <span className="text-xs text-gray-500">· {project.targetEvent}</span>
                  )}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {students.length} students · {presReadyCount} presentation-ready
                </div>
              </div>
              <button
                type="button"
                onClick={() => navigate(`/coaching/robotics/${project.id}`)}
                className="flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-800 font-medium"
              >
                <ExternalLink className="w-3.5 h-3.5" /> Full View
              </button>
            </div>

            {/* Phase board with curriculum context */}
            <div className="p-4 overflow-x-auto">
              <div className={`flex gap-3 ${phases.length <= 3 ? 'min-w-0' : phases.length <= 5 ? 'min-w-[1000px]' : 'min-w-[1200px]'}`}>
                {phases.map((phase: string, i: number) => {
                  const week = weeks[i] // positional mapping: phase i ↔ week i+1
                  const weekTopics: string[] = week ? (Array.isArray(week.topics) ? week.topics : []) : []
                  const phaseStudents = [...(byPhase[i] ?? []), ...(i === 0 ? unstarted : [])]

                  return (
                    <div key={phase} className="flex-1 min-w-[190px]">
                      {/* Curriculum week strip */}
                      {week ? (
                        <div className="mb-1.5 px-2 py-1.5 rounded-lg bg-amber-50 border border-amber-100 text-[10px]">
                          <span className="font-semibold text-amber-700">Week {week.weekNumber} Theory</span>
                          {weekTopics.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {weekTopics.slice(0, 3).map((t: string) => (
                                <span key={t} className="bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded">{t}</span>
                              ))}
                              {weekTopics.length > 3 && (
                                <span className="text-amber-500">+{weekTopics.length - 3}</span>
                              )}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="mb-1.5 h-[44px]" /> // spacer so columns align
                      )}

                      {/* Phase column */}
                      <div className={`text-xs font-bold px-2.5 py-1.5 rounded-t-lg ${PHASE_HEADER[Math.min(i, PHASE_HEADER.length - 1)]}`}>
                        {phase}
                        <span className="ml-1 font-normal opacity-60">{phaseStudents.length}</span>
                      </div>
                      <div className={`rounded-b-lg border border-t-0 p-2 space-y-1.5 min-h-[60px] ${PHASE_COLORS[Math.min(i, PHASE_COLORS.length - 1)]}`}>
                        {phaseStudents.map((s: any) => {
                          const prog = progressMap.get(s.id)
                          const ratings = prog?.ratings ?? {}
                          const pres = prog?.presentation ?? {}
                          const checks: Record<string, boolean> = (prog?.phaseChecks ?? {})[String(i)] ?? {}
                          const cl = phaseChecklist[phase] ?? []
                          const doneCount = cl.filter((c: string) => checks[c]).length
                          const presScore = [pres.canExplain, pres.canDemo, pres.handlesQA].filter(Boolean).length
                          const avgRating = ['circuit','code','creativity','teamwork']
                            .map(k => ratings[k] ?? 0).reduce((a: number, b: number) => a + b, 0) / 4

                          return (
                            <div key={s.id} className="bg-white border border-gray-100 rounded-lg px-2.5 py-2">
                              <div className="flex items-center justify-between gap-1">
                                <div className="flex items-center gap-1.5 min-w-0">
                                  <div className="w-5 h-5 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 text-[9px] font-bold shrink-0">
                                    {s.name?.charAt(0)?.toUpperCase()}
                                  </div>
                                  <span className="text-[11px] font-medium text-gray-800 truncate">{s.name}</span>
                                </div>
                                {i === phases.length - 1 && presScore === 3 && (
                                  <CheckCircle2 className="w-3 h-3 text-green-500 shrink-0" />
                                )}
                              </div>
                              {/* Checklist micro progress */}
                              {cl.length > 0 && (
                                <div className="mt-1.5 flex gap-0.5">
                                  {cl.map((item: string) => (
                                    <div key={item} className={`flex-1 h-1 rounded-full ${checks[item] ? 'bg-indigo-400' : 'bg-gray-200'}`} />
                                  ))}
                                </div>
                              )}
                              {/* Quality + pres indicators */}
                              <div className="mt-1.5 flex items-center justify-between">
                                <StarRatingDisplay value={Math.round(avgRating)} />
                                <div className="flex gap-0.5">
                                  <Mic className={`w-2.5 h-2.5 ${pres.canExplain ? 'text-green-500' : 'text-gray-200'}`} />
                                  <Monitor className={`w-2.5 h-2.5 ${pres.canDemo ? 'text-green-500' : 'text-gray-200'}`} />
                                  <HelpCircle className={`w-2.5 h-2.5 ${pres.handlesQA ? 'text-green-500' : 'text-gray-200'}`} />
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>

                    </div>
                  )
                })}
              </div>
            </div>

            {/* Summary bar */}
            <div className="px-5 py-3 bg-gray-50 border-t border-gray-100 flex items-center gap-6 text-xs text-gray-500">
              <span><strong className="text-gray-700">{students.filter(s => progressMap.has(s.id)).length}</strong> / {students.length} started</span>
              <span><strong className="text-green-600">{presReadyCount}</strong> presentation-ready</span>
              <span><strong className="text-indigo-600">{components.length}</strong> lab components</span>
            </div>

            {/* Teaching Kits — full-width tabbed section below the board */}
            <PhaseKitsSection
              project={project}
              phases={phases}
              phaseChecklist={phaseChecklist}
              planWeeks={weeks}
            />
          </div>
        )
      })}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export function PlanDetailPage() {
  const { planId } = useParams<{ planId: string }>()
  const navigate   = useNavigate()
  const location   = useLocation()
  const [tab, setTab] = useState<'plan' | 'grid' | 'insights' | 'labprep' | 'robotics'>(
    (location.state as any)?.tab ?? 'plan'
  )
  const [enterMarksFor, setEnterMarksFor] = useState<any>(null)

  const { data, isLoading } = useCoachingPlan(planId!)

  // Get students for this batch
  const { data: partiesData } = useParties({ type: 'customer', limit: 200 })
  const allParties: any[] = Array.isArray(partiesData) ? partiesData : (partiesData?.data ?? [])

  if (isLoading) return <div className="p-8 text-sm text-gray-500">Loading...</div>
  if (!data) return <div className="p-8 text-sm text-gray-500">Plan not found.</div>

  const { plan, masteryRecords } = data
  const weeks: any[] = plan.weeks ?? []

  // Students in this batch
  const students = allParties.filter((p: any) => p.meta?.batch_name === plan.batchName)

  // All unique topics across all weeks
  const allTopics: string[] = []
  for (const w of weeks) {
    const topics = Array.isArray(w.topics) ? w.topics as string[] : []
    topics.forEach(t => { if (!allTopics.includes(t)) allTopics.push(t) })
  }

  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  const [y, m] = plan.monthYear.split('-')
  const monthLabel = `${MONTHS[parseInt(m) - 1]} ${y}`

  const tabs = [
    { id: 'plan',     label: 'Weekly Plan',       icon: BookOpen      },
    { id: 'grid',     label: 'Mastery Grid',      icon: Users         },
    { id: 'insights', label: 'Progress Insights', icon: BarChart2     },
    { id: 'labprep',  label: 'Lab Prep',          icon: FlaskConical  },
    { id: 'robotics', label: 'Robotics',           icon: Bot           },
  ] as const

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-start gap-3">
        <button type="button" title="Back to plans" onClick={() => navigate('/coaching/plans')} className="p-1.5 hover:bg-gray-100 rounded-lg mt-0.5">
          <ArrowLeft className="w-5 h-5 text-gray-500" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-gray-900">{plan.subject}</h1>
          <div className="text-sm text-gray-500 mt-0.5">
            {plan.batchName} · {monthLabel}
            {students.length > 0 && <span className="ml-2 text-primary-600 font-medium">· {students.length} students</span>}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
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

      {/* Tab: Weekly Plan */}
      {tab === 'plan' && (
        <div>
          <p className="text-sm text-gray-500 mb-4">
            Add topics to each week. Click a topic tag's × to remove it. Topics you add here appear as columns in the Mastery Grid.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {weeks.map((w: any) => (
              <WeekEditor
                key={w.id}
                week={w}
                planId={plan.id}
                subject={plan.subject}
                batchName={plan.batchName}
                onEnterMarks={setEnterMarksFor}
              />
            ))}
          </div>
        </div>
      )}

      {/* Marks entry — navigate to ExamsPage with exam highlighted */}
      {enterMarksFor && (() => {
        navigate('/coaching/exams', { state: { enterMarksFor } })
        setEnterMarksFor(null)
        return null
      })()}

      {/* Tab: Mastery Grid */}
      {tab === 'grid' && (
        <div className="space-y-3">
          <p className="text-sm text-gray-500">
            Click any coloured dot to cycle through mastery levels. Changes save instantly.
            Students appear here if their <strong>batch_name</strong> in their profile matches <strong>{plan.batchName}</strong>.
          </p>
          <MasteryGrid
            students={students}
            topics={allTopics}
            masteryRecords={masteryRecords ?? []}
            subject={plan.subject}
            planId={plan.id}
          />
        </div>
      )}

      {/* Tab: Progress Insights */}
      {tab === 'insights' && <ProgressInsights planId={plan.id} />}

      {/* Tab: Lab Prep */}
      {tab === 'labprep' && (
        <LabPrepTab planId={plan.id} weeks={weeks} subject={plan.subject} />
      )}

      {/* Tab: Robotics */}
      {tab === 'robotics' && (
        <RoboticsTab planId={plan.id} weeks={weeks} batchName={plan.batchName} />
      )}
    </div>
  )
}
