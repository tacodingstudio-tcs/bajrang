// apps/web/src/pages/coaching/ExamsPage.tsx
// Create/manage exams and enter marks for all students in a batch

import { useState, useRef, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { ArrowLeft, Plus, Edit2, Trash2, Users, ChevronDown, ChevronUp, Save, X, ExternalLink, Scan, BrainCircuit, AlertCircle, ClipboardList } from 'lucide-react'
import { toast } from 'react-hot-toast'
import { coachingApi } from '@/lib/api'
import {
  useStudentExams, useCreateExam, useUpdateExam, useDeleteExam,
  useExamScores, useSaveExamScores, useParties,
} from '@/hooks/useApi'
import { WeeklyExamModal } from '@/components/coaching/WeeklyExamModal'

const EXAM_TYPES = ['weekly', 'unit_test', 'mock', 'half_yearly', 'annual'] as const
function examTypeLabel(t: string) {
  return { weekly: 'Weekly', unit_test: 'Unit Test', mock: 'Mock', half_yearly: 'Half Yearly', annual: 'Annual' }[t] ?? t
}
function today() { return new Date().toISOString().split('T')[0]! }

// ── Exam Form ────────────────────────────────────────────────────────────────
function ExamForm({ existing, onDone }: { existing?: any; onDone: () => void }) {
  const [form, setForm] = useState({
    examDate:  existing?.examDate?.split('T')[0] ?? today(),
    subject:   existing?.subject ?? '',
    examType:  existing?.examType ?? 'weekly',
    maxMarks:  existing?.maxMarks ?? 100,
    batchName: existing?.batchName ?? '',
    notes:     existing?.notes ?? '',
  })
  const create = useCreateExam()
  const update = useUpdateExam()

  async function save() {
    if (!form.subject.trim()) return
    if (existing) {
      await update.mutateAsync({ id: existing.id, ...form, maxMarks: Number(form.maxMarks) })
    } else {
      await create.mutateAsync({ ...form, maxMarks: Number(form.maxMarks) })
    }
    onDone()
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
      <h3 className="font-semibold text-gray-900">{existing ? 'Edit Exam' : 'New Exam'}</h3>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Exam Date <span className="text-red-500">*</span></label>
          <input type="date" title="Exam date" className="input" value={form.examDate} onChange={(e) => setForm({ ...form, examDate: e.target.value })} />
        </div>
        <div>
          <label className="label">Subject <span className="text-red-500">*</span></label>
          <input type="text" className="input" placeholder="e.g. Mathematics, Science" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
        </div>
        <div>
          <label className="label">Exam Type</label>
          <select title="Exam type" className="input" value={form.examType} onChange={(e) => setForm({ ...form, examType: e.target.value })}>
            {EXAM_TYPES.map((t) => <option key={t} value={t}>{examTypeLabel(t)}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Max Marks</label>
          <input type="number" title="Maximum marks" className="input" min={1} max={1000} value={form.maxMarks} onChange={(e) => setForm({ ...form, maxMarks: Number(e.target.value) })} />
        </div>
        <div>
          <label className="label">Batch / Class</label>
          <input type="text" className="input" placeholder="e.g. JEE Batch A, Class 10" value={form.batchName} onChange={(e) => setForm({ ...form, batchName: e.target.value })} />
        </div>
        <div>
          <label className="label">Notes</label>
          <input type="text" className="input" placeholder="Optional notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        </div>
      </div>
      <div className="flex gap-2 justify-end">
        <button type="button" className="btn-ghost" onClick={onDone}><X className="w-4 h-4" /> Cancel</button>
        <button type="button" className="btn-primary" onClick={save} disabled={create.isPending || update.isPending || !form.subject.trim()}>
          <Save className="w-4 h-4" /> {existing ? 'Update' : 'Create Exam'}
        </button>
      </div>
    </div>
  )
}

// ── AI Scan modal per student ─────────────────────────────────────────────────
function AIScanModal({ exam, student, onResult, onClose }: {
  exam: any; student: any
  onResult: (r: any) => void
  onClose: () => void
}) {
  const [scanning, setScanning] = useState(false)
  const [result, setResult]     = useState<any>(null)
  const [error, setError]       = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  async function handleFile(file: File) {
    setScanning(true); setError('')
    try {
      const reader = new FileReader()
      reader.onload = async (e) => {
        const base64 = (e.target?.result as string).split(',')[1]!
        const mediaType = file.type as any
        const res = await coachingApi.scanSheet(exam.id, base64, student.id, mediaType)
        setResult(res)
        setScanning(false)
      }
      reader.readAsDataURL(file)
    } catch (err: any) {
      setError(err?.response?.data?.error ?? 'Scan failed')
      setScanning(false)
    }
  }

  const questions: any[] = Array.isArray(exam.questions) ? exam.questions : []

  const ERROR_COLORS: Record<string, string> = {
    correct: 'text-green-600', calculation: 'text-amber-600',
    conceptual: 'text-red-600', not_attempted: 'text-gray-400',
    partial: 'text-orange-500', method: 'text-purple-600',
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-gray-200">
          <div>
            <div className="font-semibold text-gray-900">AI Answer Sheet Scan</div>
            <div className="text-sm text-gray-500">{student.name} · {exam.subject}</div>
          </div>
          <button type="button" title="Close" onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded">
            <X className="w-4 h-4 text-gray-400" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Upload area */}
          {!result && (
            <div
              className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center cursor-pointer hover:border-primary-400 hover:bg-primary-50/30 transition-colors"
              onClick={() => fileRef.current?.click()}
            >
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                aria-label="Upload answer sheet image"
                className="hidden"
                onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}
              />
              {scanning ? (
                <div className="space-y-2">
                  <BrainCircuit className="w-10 h-10 text-primary-500 mx-auto animate-pulse" />
                  <div className="text-sm font-medium text-primary-700">AI is reading the paper...</div>
                  <div className="text-xs text-gray-400">Analysing handwriting, errors and growth patterns</div>
                </div>
              ) : (
                <div className="space-y-2">
                  <Scan className="w-10 h-10 text-gray-300 mx-auto" />
                  <div className="text-sm font-medium text-gray-700">Click to upload answer sheet photo</div>
                  <div className="text-xs text-gray-400">JPG, PNG or WebP · AI will extract marks and analyse mistakes</div>
                </div>
              )}
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
              <AlertCircle className="w-4 h-4 shrink-0" /> {error}
            </div>
          )}

          {/* AI Results */}
          {result && (
            <div className="space-y-4">
              {/* Per-question breakdown */}
              {questions.length > 0 && (
                <div>
                  <div className="text-xs font-semibold text-gray-500 uppercase mb-2">Per-question breakdown</div>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 text-xs text-gray-500">
                        <th className="text-left pb-1">Q</th>
                        <th className="text-left pb-1">Topic</th>
                        <th className="text-right pb-1">Marks</th>
                        <th className="text-left pb-1 pl-3">Error type</th>
                      </tr>
                    </thead>
                    <tbody>
                      {questions.map((q: any) => {
                        const got = result.questionMarks?.[q.id]
                        const err = result.errorTypes?.[q.id] ?? 'unknown'
                        return (
                          <tr key={q.id} className="border-b border-gray-50">
                            <td className="py-1 font-medium">Q{q.questionNo}</td>
                            <td className="py-1 text-gray-600 text-xs">{q.topic}</td>
                            <td className="py-1 text-right font-semibold">
                              {got != null ? `${got}/${q.marks}` : '—'}
                            </td>
                            <td className={`py-1 pl-3 text-xs capitalize font-medium ${ERROR_COLORS[err] ?? 'text-gray-500'}`}>
                              {err}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Root cause */}
              {result.rootCauseDiagnosis && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <div className="text-xs font-semibold text-amber-800 mb-1">🔍 Root Cause Analysis</div>
                  <div className="text-sm text-amber-900">{result.rootCauseDiagnosis}</div>
                </div>
              )}

              {/* Growth */}
              {result.growthObservation && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <div className="text-xs font-semibold text-blue-800 mb-1">📈 Growth vs Previous Exams</div>
                  <div className="text-sm text-blue-900">{result.growthObservation}</div>
                </div>
              )}

              {/* Teacher actions */}
              {result.teacherActionItems?.length > 0 && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                  <div className="text-xs font-semibold text-green-800 mb-1.5">✅ What to do next</div>
                  <ul className="space-y-1">
                    {result.teacherActionItems.map((a: string, i: number) => (
                      <li key={i} className="text-sm text-green-900 flex items-start gap-1.5">
                        <span className="text-green-400 mt-0.5">•</span> {a}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Learning style */}
              {result.learningStyle && (
                <div className="text-xs text-gray-500">
                  Learning style detected: <span className="font-medium text-gray-700 capitalize">{result.learningStyle}</span>
                </div>
              )}

              {/* Total */}
              <div className="flex items-center justify-between py-2 border-t border-gray-200">
                <span className="text-sm font-medium text-gray-700">Total marks extracted:</span>
                <span className="text-lg font-bold text-gray-900">{result.totalObtained}/{exam.maxMarks}</span>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  className="btn-primary flex-1"
                  onClick={() => { onResult(result); onClose() }}
                >
                  <Save className="w-4 h-4" /> Use these marks
                </button>
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => { setResult(null); setError('') }}
                >
                  Re-scan
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Score Entry Panel ────────────────────────────────────────────────────────
function ScoreEntryPanel({ exam, onClose }: { exam: any; onClose: () => void }) {
  const { data: existingScores } = useExamScores(exam.id)
  const { data: partiesData }    = useParties({ type: 'customer', limit: 200 })
  const saveScores               = useSaveExamScores()
  const navigate                 = useNavigate()
  const [scanStudent, setScanStudent] = useState<any>(null)

  const students: any[] = Array.isArray(partiesData) ? partiesData : (partiesData?.data ?? [])
  const filtered = exam.batchName
    ? students.filter((s: any) => s.meta?.batch_name === exam.batchName)
    : students

  const existing: Record<string, any> = {}
  if (Array.isArray(existingScores)) {
    for (const s of existingScores) existing[s.partyId] = s
  }

  const questions: any[] = Array.isArray(exam.questions) ? exam.questions : []
  const hasQuestions = questions.length > 0

  type StudentScore = { marks: string; absent: boolean; url: string; remarks: string; qMarks: Record<string, string>; aiNotes: string }
  const [scores, setScores] = useState<Record<string, StudentScore>>(() => {
    const init: Record<string, StudentScore> = {}
    for (const s of filtered) {
      const ex = existing[s.id]
      const qm = ex?.questionMarks as Record<string, number> ?? {}
      init[s.id] = {
        marks:   ex?.marksObtained != null ? String(ex.marksObtained) : '',
        absent:  ex ? ex.marksObtained == null : false,
        url:     ex?.answerSheetUrl ?? '',
        remarks: ex?.remarks ?? '',
        qMarks:  Object.fromEntries(Object.entries(qm).map(([k, v]) => [k, String(v)])),
        aiNotes: ex?.aiNotes ?? '',
      }
    }
    return init
  })

  function setField(partyId: string, field: keyof StudentScore, value: any) {
    setScores(prev => ({ ...prev, [partyId]: { ...prev[partyId]!, [field]: value } }))
  }

  function setQMark(partyId: string, qId: string, value: string) {
    setScores(prev => {
      const qm = { ...prev[partyId]!.qMarks, [qId]: value }
      const total = Object.values(qm).reduce((s, v) => s + (v !== '' ? Number(v) : 0), 0)
      return { ...prev, [partyId]: { ...prev[partyId]!, qMarks: qm, marks: String(total) } }
    })
  }

  function applyAIResult(partyId: string, result: any) {
    const qm: Record<string, string> = {}
    for (const [k, v] of Object.entries(result.questionMarks ?? {})) {
      qm[k] = String(v)
    }
    const total = result.totalObtained ?? Object.values(result.questionMarks ?? {}).reduce((s: number, v: any) => s + (v ?? 0), 0)
    setScores(prev => ({
      ...prev,
      [partyId]: { ...prev[partyId]!, marks: String(total), qMarks: qm, aiNotes: result.rootCauseDiagnosis ?? '' },
    }))
  }

  async function handleSave() {
    const payload = filtered.map((s: any) => {
      const sc = scores[s.id]!
      const qm: Record<string, number | null> = {}
      for (const [k, v] of Object.entries(sc.qMarks)) {
        qm[k] = v !== '' ? Number(v) : null
      }
      return {
        partyId:        s.id,
        marksObtained:  sc.absent ? null : sc.marks !== '' ? Number(sc.marks) : null,
        questionMarks:  hasQuestions ? qm : undefined,
        answerSheetUrl: sc.url || null,
        remarks:        sc.remarks || null,
      }
    })
    await saveScores.mutateAsync({ examId: exam.id, scores: payload })
    onClose()
  }

  return (
    <>
      {scanStudent && (
        <AIScanModal
          exam={exam}
          student={scanStudent}
          onResult={(r) => applyAIResult(scanStudent.id, r)}
          onClose={() => setScanStudent(null)}
        />
      )}

      <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-gray-900">Enter Marks — {exam.subject}</h3>
            <div className="text-sm text-gray-500">
              {new Date(exam.examDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
              {' · '}{examTypeLabel(exam.examType)} · Max: {exam.maxMarks} marks
              {exam.batchName ? ` · ${exam.batchName}` : ''}
            </div>
          </div>
          <button type="button" title="Close" onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded">
            <X className="w-4 h-4 text-gray-400" />
          </button>
        </div>

        {filtered.length === 0 ? (
          <div className="text-sm text-gray-400 py-4 text-center">No students found. Add students from Parties.</div>
        ) : (
          <div className="space-y-4">
            {filtered.map((s: any) => {
              const sc = scores[s.id] ?? { marks: '', absent: false, url: '', remarks: '', qMarks: {}, aiNotes: '' }
              const total = sc.absent ? null : sc.marks !== '' ? Number(sc.marks) : null
              const pct = total != null ? (total / exam.maxMarks * 100) : null

              return (
                <div key={s.id} className="border border-gray-200 rounded-xl overflow-hidden">
                  {/* Student row header */}
                  <div className="flex items-center gap-3 px-4 py-2.5 bg-gray-50">
                    <div className="w-8 h-8 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-sm font-semibold">
                      {s.name[0]}
                    </div>
                    <div className="flex-1">
                      <div className="font-medium text-gray-900 text-sm">{s.name}</div>
                      {s.meta?.standard && <div className="text-xs text-gray-400">{s.meta.standard}</div>}
                    </div>
                    <label className="flex items-center gap-1.5 text-xs text-gray-500">
                      <input
                        type="checkbox"
                        checked={sc.absent}
                        onChange={e => setField(s.id, 'absent', e.target.checked)}
                        className="accent-primary-600"
                      />
                      Absent
                    </label>
                    {pct != null && (
                      <span className={`text-sm font-bold ${pct >= 80 ? 'text-green-600' : pct >= 60 ? 'text-blue-600' : pct >= 40 ? 'text-amber-600' : 'text-red-600'}`}>
                        {total}/{exam.maxMarks} ({pct.toFixed(0)}%)
                      </span>
                    )}
                    <button
                      type="button"
                      disabled={sc.absent}
                      onClick={() => setScanStudent(s)}
                      className="btn-ghost text-xs py-1 px-2 flex items-center gap-1 text-purple-700 disabled:opacity-40"
                      title="AI scan answer sheet"
                    >
                      <Scan className="w-3.5 h-3.5" /> AI Scan
                    </button>
                    <button
                      type="button"
                      title="View student progress"
                      onClick={() => navigate(`/coaching/progress/${s.id}`)}
                      className="p-1 text-gray-400 hover:text-primary-600"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="px-4 py-3 space-y-3">
                    {/* Per-question marks */}
                    {hasQuestions && !sc.absent && (
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                        {questions.map((q: any) => (
                          <div key={q.id} className="space-y-0.5">
                            <div className="text-xs text-gray-500 truncate" title={q.topic}>
                              Q{q.questionNo} · {q.topic} ({q.marks}m)
                            </div>
                            <input
                              type="number"
                              min={0}
                              max={q.marks}
                              value={sc.qMarks[q.id] ?? ''}
                              onChange={e => setQMark(s.id, q.id, e.target.value)}
                              className="input py-1 text-sm w-full"
                              placeholder={`0–${q.marks}`}
                            />
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Total marks (editable if no questions) */}
                    {!hasQuestions && !sc.absent && (
                      <div className="flex items-center gap-3">
                        <div className="text-xs text-gray-500">Total Marks</div>
                        <input
                          type="number" min={0} max={exam.maxMarks}
                          value={sc.marks}
                          onChange={e => setField(s.id, 'marks', e.target.value)}
                          className="input py-1 w-24 text-sm"
                          placeholder={`0–${exam.maxMarks}`}
                        />
                      </div>
                    )}

                    {/* AI notes (if scanned) */}
                    {sc.aiNotes && (
                      <div className="text-xs text-purple-700 bg-purple-50 rounded px-3 py-2 flex items-start gap-1.5">
                        <BrainCircuit className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                        <span>{sc.aiNotes}</span>
                      </div>
                    )}

                    {/* URL + remarks */}
                    <div className="flex gap-2">
                      <input
                        type="url" value={sc.url}
                        onChange={e => setField(s.id, 'url', e.target.value)}
                        className="input py-1 text-xs flex-1"
                        placeholder="Answer sheet URL (optional)"
                      />
                      <input
                        type="text" value={sc.remarks}
                        onChange={e => setField(s.id, 'remarks', e.target.value)}
                        className="input py-1 text-xs flex-1"
                        placeholder="Remarks"
                      />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        <div className="flex gap-2 justify-end pt-2 border-t border-gray-100">
          <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
          <button type="button" className="btn-primary" onClick={handleSave} disabled={saveScores.isPending}>
            <Save className="w-4 h-4" /> Save All Marks
          </button>
        </div>
      </div>
    </>
  )
}

// ── Main Page ────────────────────────────────────────────────────────────────
export function ExamsPage() {
  const navigate     = useNavigate()
  const location     = useLocation()
  const [showForm, setShowForm] = useState(false)
  const [editExam, setEditExam] = useState<any>(null)
  const [enterMarksFor, setEnterMarksFor] = useState<any>(null)
  const [viewPaper, setViewPaper] = useState<any>(null)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  const { data: exams, isLoading } = useStudentExams()
  const deleteExam = useDeleteExam()
  const examList: any[] = Array.isArray(exams) ? exams : []

  // Auto-open marks entry when navigated from PlanDetailPage
  useEffect(() => {
    const state = location.state as any
    if (state?.enterMarksFor) {
      setEnterMarksFor(state.enterMarksFor)
      window.history.replaceState({}, '')
    }
  }, [location.state])

  async function handleDelete(id: string) {
    if (!confirm('Delete this exam and all its scores?')) return
    await deleteExam.mutateAsync(id)
  }

  return (
    <div className="p-8 space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button type="button" title="Back" onClick={() => navigate('/coaching/progress')} className="p-2 hover:bg-gray-100 rounded-lg">
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-semibold text-gray-900">Exams</h1>
          <p className="text-sm text-gray-500">Create exams and enter marks for your students</p>
        </div>
        {!showForm && !editExam && !enterMarksFor && (
          <button type="button" className="btn-primary" onClick={() => setShowForm(true)}>
            <Plus className="w-4 h-4" /> New Exam
          </button>
        )}
      </div>

      {/* Exam form */}
      {showForm && <ExamForm onDone={() => setShowForm(false)} />}
      {editExam  && <ExamForm existing={editExam} onDone={() => setEditExam(null)} />}

      {/* Score entry panel */}
      {enterMarksFor && (
        <ScoreEntryPanel exam={enterMarksFor} onClose={() => setEnterMarksFor(null)} />
      )}

      {/* Exam list */}
      {isLoading ? (
        <div className="text-sm text-gray-500">Loading exams...</div>
      ) : examList.length === 0 ? (
        <div className="text-sm text-gray-400 py-12 text-center">
          No exams yet. Create the first exam to start tracking marks.
        </div>
      ) : (
        <div className="space-y-3">
          {examList.map((exam: any) => (
            <div key={exam.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="flex items-center gap-4 p-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-gray-900">{exam.subject}</span>
                    <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full capitalize">
                      {examTypeLabel(exam.examType)}
                    </span>
                    {exam.batchName && (
                      <span className="text-xs px-2 py-0.5 bg-primary-50 text-primary-700 rounded-full">{exam.batchName}</span>
                    )}
                  </div>
                  <div className="text-sm text-gray-500 mt-0.5">
                    {new Date(exam.examDate).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                    {' · '}Max: {exam.maxMarks} marks
                    {' · '}<span className="text-gray-400">{exam._count?.scores ?? 0} students entered</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {exam.generatedPaper && Object.keys(exam.generatedPaper).length > 0 && (
                    <button
                      type="button"
                      onClick={() => setViewPaper(exam)}
                      className="btn-ghost text-xs py-1.5 px-3 text-indigo-600"
                    >
                      <ClipboardList className="w-3.5 h-3.5" /> View Paper
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => { setEnterMarksFor(exam); setEditExam(null); setShowForm(false) }}
                    className="btn-ghost text-xs py-1.5 px-3"
                  >
                    <Users className="w-3.5 h-3.5" /> Enter Marks
                  </button>
                  <button type="button" title="Edit exam" onClick={() => { setEditExam(exam); setShowForm(false); setEnterMarksFor(null) }} className="p-1.5 hover:bg-gray-100 rounded text-gray-400 hover:text-gray-700">
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button type="button" title="Delete exam" onClick={() => handleDelete(exam.id)} className="p-1.5 hover:bg-red-50 rounded text-gray-400 hover:text-red-600">
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    title={expanded[exam.id] ? 'Collapse' : 'Expand scores'}
                    onClick={() => setExpanded((p) => ({ ...p, [exam.id]: !p[exam.id] }))}
                    className="p-1.5 hover:bg-gray-100 rounded text-gray-400"
                  >
                    {expanded[exam.id] ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Inline score summary when expanded */}
              {expanded[exam.id] && <ExamScoreSummary examId={exam.id} maxMarks={exam.maxMarks} />}
            </div>
          ))}
        </div>
      )}

      {/* View generated paper */}
      {viewPaper && (
        <WeeklyExamModal
          exam={viewPaper}
          onClose={() => setViewPaper(null)}
          onEnterMarks={(exam) => { setViewPaper(null); setEnterMarksFor(exam) }}
        />
      )}
    </div>
  )
}

function ExamScoreSummary({ examId, maxMarks }: { examId: string; maxMarks: number }) {
  const { data: scores } = useExamScores(examId)
  const list: any[] = Array.isArray(scores) ? scores : []
  const navigate = useNavigate()

  if (list.length === 0) {
    return <div className="px-4 pb-4 text-sm text-gray-400">No marks entered yet.</div>
  }

  const sorted = [...list].sort((a, b) => {
    if (a.marksObtained == null) return 1
    if (b.marksObtained == null) return -1
    return Number(b.marksObtained) - Number(a.marksObtained)
  })

  return (
    <div className="border-t border-gray-100 px-4 pb-4">
      <table className="w-full text-sm mt-3">
        <thead>
          <tr className="text-gray-400 text-xs">
            <th className="text-left py-1 font-medium">#</th>
            <th className="text-left py-1 font-medium">Student</th>
            <th className="text-right py-1 font-medium">Marks</th>
            <th className="text-right py-1 font-medium">%</th>
            <th className="text-left py-1 font-medium pl-4">Sheet</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((s: any, i) => {
            const pct = s.marksObtained != null ? (Number(s.marksObtained) / maxMarks * 100) : null
            return (
              <tr key={s.id} className="border-b border-gray-50">
                <td className="py-1.5 text-gray-400 text-xs">{i + 1}</td>
                <td className="py-1.5">
                  <button type="button" onClick={() => navigate(`/coaching/progress/${s.partyId}`)} className="text-primary-600 hover:underline font-medium">
                    {s.party?.name ?? '—'}
                  </button>
                </td>
                <td className="py-1.5 text-right font-medium">
                  {s.marksObtained != null ? `${s.marksObtained}/${maxMarks}` : <span className="text-gray-400 text-xs">Absent</span>}
                </td>
                <td className="py-1.5 text-right">
                  {pct != null ? (
                    <span className={`font-semibold text-xs ${pct >= 80 ? 'text-green-600' : pct >= 60 ? 'text-blue-600' : pct >= 40 ? 'text-amber-600' : 'text-red-600'}`}>
                      {pct.toFixed(1)}%
                    </span>
                  ) : '—'}
                </td>
                <td className="py-1.5 pl-4">
                  {s.answerSheetUrl ? (
                    <a href={s.answerSheetUrl} target="_blank" rel="noopener noreferrer" className="text-primary-600 text-xs underline">View</a>
                  ) : '—'}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
