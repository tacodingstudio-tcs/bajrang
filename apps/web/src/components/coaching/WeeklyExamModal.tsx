// apps/web/src/components/coaching/WeeklyExamModal.tsx
import { useState, useCallback } from 'react'
import {
  X, Clock, Award, BookOpen, CheckCircle2, AlertCircle,
  ChevronDown, ChevronUp, Users, BrainCircuit, Sparkles,
  ClipboardList, Pencil, Save, Plus, Trash2, TrendingUp,
  TrendingDown,
} from 'lucide-react'
import { useSaveExamPaper, useClassAnalysis } from '@/hooks/useApi'
import { toast } from 'react-hot-toast'

// ── helpers ────────────────────────────────────────────────────────────────────

function DiffBadge({ d }: { d: string }) {
  const map: Record<string, string> = {
    easy: 'bg-green-100 text-green-700', medium: 'bg-amber-100 text-amber-700', hard: 'bg-red-100 text-red-700',
  }
  return <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${map[d] ?? 'bg-gray-100 text-gray-600'}`}>{d}</span>
}

// ── View: MCQ ─────────────────────────────────────────────────────────────────

function MCQView({ q, showAnswer }: { q: any; showAnswer: boolean }) {
  return (
    <div className="border border-gray-100 rounded-lg p-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2 flex-1">
          <span className="shrink-0 w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center">{q.no}</span>
          <span className="text-sm text-gray-800">{q.text}</span>
        </div>
        <div className="flex gap-1 shrink-0"><DiffBadge d={q.difficulty} /><span className="text-xs text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded">{q.marks}m</span></div>
      </div>
      <div className="grid grid-cols-2 gap-1.5 pl-8">
        {Object.entries(q.options ?? {}).map(([opt, text]: [string, any]) => (
          <div key={opt} className={`text-xs rounded-lg px-2.5 py-1.5 border ${showAnswer && q.correctOption === opt ? 'bg-green-50 border-green-300 text-green-800 font-medium' : 'bg-gray-50 border-gray-100 text-gray-700'}`}>
            <span className="font-semibold mr-1">{opt}.</span>{text}
          </div>
        ))}
      </div>
      {showAnswer && q.explanation && (
        <div className="pl-8 text-xs text-indigo-700 bg-indigo-50 rounded px-2 py-1.5">💡 {q.explanation}</div>
      )}
      <div className="pl-8 text-[11px] text-gray-400">Topic: {q.topic}</div>
    </div>
  )
}

// ── View: Short/Long ───────────────────────────────────────────────────────────

function AnswerView({ q, showAnswer }: { q: any; showAnswer: boolean }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border border-gray-100 rounded-lg overflow-hidden">
      <div className="flex items-start gap-2 p-3">
        <span className="shrink-0 w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center justify-center">{q.no}</span>
        <div className="flex-1">
          <p className="text-sm text-gray-800">{q.text}</p>
          {q.subParts?.map((sp: string, i: number) => <p key={i} className="text-xs text-gray-600 pl-2 mt-0.5">• {sp}</p>)}
          <div className="flex gap-2 mt-1.5"><DiffBadge d={q.difficulty} /><span className="text-xs text-gray-400">{q.marks}m · {q.topic}</span></div>
        </div>
      </div>
      {showAnswer && (
        <>
          <button type="button" onClick={() => setOpen(o => !o)} className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 border-t border-gray-100 text-xs font-medium text-gray-600 hover:bg-gray-100">
            <span>Model Answer & Marking Scheme</span>
            {open ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
          {open && (
            <div className="px-3 pb-3 pt-2 space-y-2 bg-gray-50">
              {q.modelAnswer && <p className="text-xs text-gray-700 leading-relaxed">{q.modelAnswer}</p>}
              {q.markingScheme?.map((m: string, i: number) => (
                <div key={i} className="text-xs text-green-700 flex items-start gap-1"><CheckCircle2 className="w-3 h-3 shrink-0 mt-0.5" /> {m}</div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ── Edit: MCQ ─────────────────────────────────────────────────────────────────

function MCQEdit({ q, onChange, onDelete }: { q: any; onChange: (q: any) => void; onDelete: () => void }) {
  const opts = ['A', 'B', 'C', 'D'] as const
  return (
    <div className="border border-blue-100 rounded-lg p-3 space-y-2 bg-blue-50/30">
      <div className="flex items-center gap-2">
        <span className="shrink-0 w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center">{q.no}</span>
        <textarea
          className="flex-1 input text-sm py-1 resize-none"
          rows={2}
          value={q.text}
          onChange={e => onChange({ ...q, text: e.target.value })}
          placeholder="Question text"
        />
        <button type="button" onClick={onDelete} className="p-1 text-gray-300 hover:text-red-500 shrink-0" title="Delete question">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-1.5 pl-8">
        {opts.map(opt => (
          <div key={opt} className="flex items-center gap-1.5">
            <input
              type="radio"
              name={`correct-${q.id}`}
              checked={q.correctOption === opt}
              onChange={() => onChange({ ...q, correctOption: opt })}
              className="accent-green-600 shrink-0"
              title={`Mark ${opt} as correct`}
            />
            <input
              className="input text-xs py-1 flex-1"
              value={q.options?.[opt] ?? ''}
              onChange={e => onChange({ ...q, options: { ...q.options, [opt]: e.target.value } })}
              placeholder={`Option ${opt}`}
            />
          </div>
        ))}
      </div>

      <div className="pl-8 flex gap-2">
        <input className="input text-xs py-1 flex-1" value={q.topic} onChange={e => onChange({ ...q, topic: e.target.value })} placeholder="Topic" />
        <select title="Difficulty" className="input text-xs py-1 w-24" value={q.difficulty} onChange={e => onChange({ ...q, difficulty: e.target.value })}>
          {['easy', 'medium', 'hard'].map(d => <option key={d}>{d}</option>)}
        </select>
      </div>

      <div className="pl-8">
        <input className="input text-xs py-1 w-full" value={q.explanation ?? ''} onChange={e => onChange({ ...q, explanation: e.target.value })} placeholder="Explanation (shown with answer key)" />
      </div>
    </div>
  )
}

// ── Edit: Short/Long ──────────────────────────────────────────────────────────

function AnswerEdit({ q, onChange, onDelete }: { q: any; onChange: (q: any) => void; onDelete: () => void }) {
  return (
    <div className="border border-indigo-100 rounded-lg p-3 space-y-2 bg-indigo-50/20">
      <div className="flex items-start gap-2">
        <span className="shrink-0 w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center justify-center mt-1">{q.no}</span>
        <textarea
          className="flex-1 input text-sm py-1 resize-none"
          rows={2}
          value={q.text}
          onChange={e => onChange({ ...q, text: e.target.value })}
          placeholder="Question text"
        />
        <button type="button" onClick={onDelete} className="p-1 text-gray-300 hover:text-red-500 shrink-0" title="Delete question">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="pl-8 space-y-1.5">
        <div className="flex gap-2">
          <input className="input text-xs py-1 flex-1" value={q.topic} onChange={e => onChange({ ...q, topic: e.target.value })} placeholder="Topic" />
          <select title="Difficulty" className="input text-xs py-1 w-24" value={q.difficulty} onChange={e => onChange({ ...q, difficulty: e.target.value })}>
            {['easy', 'medium', 'hard'].map(d => <option key={d}>{d}</option>)}
          </select>
          <input type="number" title="Marks" className="input text-xs py-1 w-16" value={q.marks} min={1} max={10}
            onChange={e => onChange({ ...q, marks: Number(e.target.value) })} />
        </div>

        <textarea
          className="input text-xs py-1 w-full resize-none"
          rows={3}
          value={q.modelAnswer ?? ''}
          onChange={e => onChange({ ...q, modelAnswer: e.target.value })}
          placeholder="Model answer"
        />

        <div className="space-y-1">
          <div className="text-[10px] text-gray-500 font-semibold uppercase">Marking scheme (one point per line)</div>
          <textarea
            className="input text-xs py-1 w-full resize-none"
            rows={2}
            value={(q.markingScheme ?? []).join('\n')}
            onChange={e => onChange({ ...q, markingScheme: e.target.value.split('\n').filter(Boolean) })}
            placeholder="1 mark — definition&#10;2 marks — explanation"
          />
        </div>
      </div>
    </div>
  )
}

// ── Class Analysis ─────────────────────────────────────────────────────────────

function ClassAnalysisView({ examId, maxMarks }: { examId: string; maxMarks: number }) {
  const analysis = useClassAnalysis()
  const [result, setResult] = useState<any>(null)

  async function run() { const r = await analysis.mutateAsync(examId); setResult(r) }

  if (!result) return (
    <div className="text-center py-8">
      <BrainCircuit className="w-10 h-10 mx-auto mb-3 text-indigo-300" />
      <p className="text-sm text-gray-600 mb-4">Enter student marks first, then generate class analysis</p>
      <button type="button" onClick={run} disabled={analysis.isPending} className="btn-primary inline-flex items-center gap-1.5">
        {analysis.isPending ? <><BrainCircuit className="w-4 h-4 animate-pulse" /> Analysing…</> : <><Sparkles className="w-4 h-4" /> Generate Class Analysis</>}
      </button>
    </div>
  )

  const { analysis: a, classAvg, topicAnalysis } = result
  const healthColor = a.overallHealth === 'good' ? 'text-green-600 bg-green-50 border-green-200' : a.overallHealth === 'needs_attention' ? 'text-amber-600 bg-amber-50 border-amber-200' : 'text-red-600 bg-red-50 border-red-200'

  return (
    <div className="space-y-4">
      <div className={`rounded-xl border p-4 ${healthColor}`}>
        <div className="flex items-center justify-between mb-1">
          <span className="font-semibold capitalize">{a.overallHealth?.replace('_', ' ')}</span>
          <span className="text-2xl font-bold">{classAvg}%</span>
        </div>
        <p className="text-sm">{a.summary}</p>
      </div>
      {a.weakTopics?.length ? (
        <div>
          <div className="flex items-center gap-1.5 text-xs font-semibold text-red-600 uppercase mb-2"><TrendingDown className="w-3.5 h-3.5" /> Topics Needing Re-teaching</div>
          {a.weakTopics.map((wt: any, i: number) => (
            <div key={i} className={`rounded-lg p-3 border mb-2 ${wt.urgency === 'high' ? 'border-red-200 bg-red-50' : 'border-amber-100 bg-amber-50'}`}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium">{wt.topic}</span>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${wt.urgency === 'high' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>{wt.avgPct}%</span>
              </div>
              <p className="text-xs text-gray-600">{wt.action}</p>
            </div>
          ))}
        </div>
      ) : null}
      {a.strongTopics?.length ? (
        <div>
          <div className="flex items-center gap-1.5 text-xs font-semibold text-green-600 uppercase mb-2"><TrendingUp className="w-3.5 h-3.5" /> Strong Topics</div>
          <div className="flex flex-wrap gap-2">{a.strongTopics.map((t: string, i: number) => <span key={i} className="text-xs bg-green-50 text-green-700 border border-green-200 px-2.5 py-1 rounded-full">✓ {t}</span>)}</div>
        </div>
      ) : null}
      {topicAnalysis?.length ? (
        <div>
          <div className="text-xs font-semibold text-gray-500 uppercase mb-2">Topic-wise Class Average</div>
          {topicAnalysis.map((t: any, i: number) => (
            <div key={i} className="flex items-center gap-2 mb-1">
              <div className="w-28 text-xs text-gray-600 truncate">{t.topic}</div>
              <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
                <div className={`h-full rounded-full transition-all ${t.avgPct >= 70 ? 'bg-green-500 w-full' : t.avgPct >= 50 ? 'bg-amber-400' : 'bg-red-400'}`} data-pct={t.avgPct} style={{ width: `${Math.min(t.avgPct, 100)}%` }} />
              </div>
              <span className="text-xs font-medium w-8 text-right">{t.avgPct}%</span>
            </div>
          ))}
        </div>
      ) : null}
      {a.nextWeekSuggestion && <div className="bg-blue-50 border border-blue-100 rounded-lg p-3"><div className="text-xs font-semibold text-blue-700 mb-1">📅 Next Week Focus</div><p className="text-sm text-blue-900">{a.nextWeekSuggestion}</p></div>}
    </div>
  )
}

// ── Main Modal ─────────────────────────────────────────────────────────────────

export function WeeklyExamModal({ exam, weekNumber, onClose, onEnterMarks }: {
  exam: any; weekNumber?: number; onClose: () => void; onEnterMarks: (exam: any) => void
}) {
  const [tab, setTab]             = useState<'paper' | 'analysis'>('paper')
  const [showAnswers, setShowAnswers] = useState(false)
  const [editMode, setEditMode]   = useState(false)
  const [paper, setPaper]         = useState<any>(() => exam.generatedPaper ?? {})
  const savePaper = useSaveExamPaper()
  const hasScores = (exam._count?.scores ?? 0) > 0
  const sections: any[] = paper.sections ?? []

  // ── edit helpers ─────────────────────────────────────────────────────────────

  const updateQuestion = useCallback((sectionIdx: number, qIdx: number, updated: any) => {
    setPaper((prev: any) => {
      const sections = prev.sections.map((s: any, si: number) =>
        si !== sectionIdx ? s : {
          ...s,
          questions: s.questions.map((q: any, qi: number) => qi === qIdx ? updated : q),
        }
      )
      return { ...prev, sections }
    })
  }, [])

  const deleteQuestion = useCallback((sectionIdx: number, qIdx: number) => {
    setPaper((prev: any) => {
      const sections = prev.sections.map((s: any, si: number) =>
        si !== sectionIdx ? s : { ...s, questions: s.questions.filter((_: any, qi: number) => qi !== qIdx) }
      )
      return { ...prev, sections }
    })
  }, [])

  const addQuestion = useCallback((sectionIdx: number) => {
    setPaper((prev: any) => {
      const section = prev.sections[sectionIdx]
      const isMCQ = sectionIdx === 0
      const nextId = `${['A','B','C'][sectionIdx]}${(section.questions?.length ?? 0) + 1}`
      const nextNo = (section.questions?.at(-1)?.no ?? 0) + 1
      const newQ = isMCQ
        ? { id: nextId, no: nextNo, topic: '', text: '', options: { A: '', B: '', C: '', D: '' }, correctOption: 'A', marks: 1, difficulty: 'medium', explanation: '' }
        : { id: nextId, no: nextNo, topic: '', text: '', marks: sectionIdx === 1 ? 3 : 5, difficulty: 'medium', modelAnswer: '', markingScheme: [] }
      const sections = prev.sections.map((s: any, si: number) =>
        si !== sectionIdx ? s : { ...s, questions: [...(s.questions ?? []), newQ] }
      )
      return { ...prev, sections }
    })
  }, [])

  async function handleSave() {
    await savePaper.mutateAsync({ examId: exam.id, paper })
    setEditMode(false)
  }

  function handleDiscard() {
    setPaper(exam.generatedPaper ?? {})
    setEditMode(false)
  }

  // Recalculate totals for display
  const totalQ = sections.reduce((s, sec) => s + (sec.questions?.length ?? 0), 0)
  const totalM = sections.reduce((s, sec) => s + (sec.questions ?? []).reduce((a: number, q: any) => a + (q.marks ?? 0), 0), 0)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col">

        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-gray-100 shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-indigo-600" />
              <h2 className="text-base font-bold text-gray-900">{paper.title ?? `Week ${weekNumber} Test`}</h2>
              {editMode && <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">Editing</span>}
            </div>
            <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
              {paper.duration && <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{paper.duration}</span>}
              <span className="flex items-center gap-1"><Award className="w-3 h-3" />{editMode ? totalM : exam.maxMarks} marks</span>
              <span className="flex items-center gap-1"><BookOpen className="w-3 h-3" />{exam.subject}</span>
              {exam.batchName && <span className="bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded">{exam.batchName}</span>}
              {editMode && <span className="text-gray-400">{totalQ} questions</span>}
            </div>
          </div>
          <button type="button" title="Close" onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg">
            <X className="w-4 h-4 text-gray-400" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex items-center justify-between border-b border-gray-100 px-5 shrink-0">
          <div className="flex">
            {[{ id: 'paper', label: 'Exam Paper' }, { id: 'analysis', label: 'Class Analysis' }].map(t => (
              <button key={t.id} type="button" onClick={() => setTab(t.id as any)}
                className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${tab === t.id ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                {t.label}
              </button>
            ))}
          </div>
          {/* Edit toggle — only on paper tab */}
          {tab === 'paper' && sections.length > 0 && (
            editMode ? (
              <div className="flex gap-1.5 py-1.5">
                <button type="button" onClick={handleDiscard} className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded">Discard</button>
                <button type="button" onClick={handleSave} disabled={savePaper.isPending}
                  className="text-xs bg-indigo-600 text-white px-3 py-1 rounded-lg hover:bg-indigo-700 flex items-center gap-1">
                  <Save className="w-3 h-3" /> {savePaper.isPending ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            ) : (
              <button type="button" onClick={() => setEditMode(true)}
                className="text-xs text-gray-500 hover:text-indigo-600 flex items-center gap-1 py-1.5 px-2 rounded hover:bg-indigo-50">
                <Pencil className="w-3.5 h-3.5" /> Edit Paper
              </button>
            )
          )}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">

          {tab === 'paper' && (
            <>
              {/* Instructions */}
              {!editMode && paper.instructions?.length ? (
                <div className="bg-blue-50 border border-blue-100 rounded-lg p-3">
                  <div className="text-xs font-semibold text-blue-700 mb-1.5">Instructions</div>
                  <ol className="space-y-0.5">{paper.instructions.map((inst: string, i: number) => <li key={i} className="text-xs text-blue-800">{i + 1}. {inst}</li>)}</ol>
                </div>
              ) : null}

              {/* Show answers toggle (view mode only) */}
              {!editMode && (
                <div className="flex items-center justify-end">
                  <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
                    <input type="checkbox" checked={showAnswers} onChange={e => setShowAnswers(e.target.checked)} className="accent-indigo-600" />
                    Show answers & marking scheme
                  </label>
                </div>
              )}

              {/* Sections */}
              {sections.map((section: any, si: number) => (
                <div key={si}>
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h3 className="text-sm font-bold text-gray-800">{section.name}</h3>
                      {section.totalMarks && <span className="text-xs text-gray-400">{section.totalMarks} marks</span>}
                    </div>
                    {!editMode && section.instructions && <span className="text-xs text-gray-400 italic max-w-xs text-right">{section.instructions}</span>}
                  </div>

                  <div className="space-y-2">
                    {section.questions?.map((q: any, qi: number) =>
                      editMode ? (
                        si === 0
                          ? <MCQEdit key={q.id ?? qi} q={q} onChange={u => updateQuestion(si, qi, u)} onDelete={() => deleteQuestion(si, qi)} />
                          : <AnswerEdit key={q.id ?? qi} q={q} onChange={u => updateQuestion(si, qi, u)} onDelete={() => deleteQuestion(si, qi)} />
                      ) : (
                        si === 0
                          ? <MCQView key={q.id ?? qi} q={q} showAnswer={showAnswers} />
                          : <AnswerView key={q.id ?? qi} q={q} showAnswer={showAnswers} />
                      )
                    )}

                    {/* Add question button in edit mode */}
                    {editMode && (
                      <button type="button" onClick={() => addQuestion(si)}
                        className="w-full flex items-center justify-center gap-1.5 text-xs text-indigo-600 border border-dashed border-indigo-200 rounded-lg py-2 hover:bg-indigo-50">
                        <Plus className="w-3.5 h-3.5" /> Add Question to {section.name?.split('—')[0]?.trim()}
                      </button>
                    )}
                  </div>
                </div>
              ))}

              {sections.length === 0 && (
                <div className="py-12 text-center text-gray-400">
                  <AlertCircle className="w-8 h-8 mx-auto mb-2" />
                  <p className="text-sm">Paper not generated yet</p>
                </div>
              )}
            </>
          )}

          {tab === 'analysis' && (
            <>
              {!hasScores && <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2 text-sm text-amber-800"><AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /> Enter marks for students first, then generate class analysis.</div>}
              <ClassAnalysisView examId={exam.id} maxMarks={exam.maxMarks} />
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-gray-100 shrink-0">
          <span className="text-xs text-gray-400">{hasScores ? `${exam._count.scores} students scored` : 'No marks entered yet'}</span>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="btn-ghost text-sm">Close</button>
            <button type="button" onClick={() => { onClose(); onEnterMarks(exam) }} className="btn-primary text-sm flex items-center gap-1.5">
              <Users className="w-4 h-4" /> Enter Marks
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
