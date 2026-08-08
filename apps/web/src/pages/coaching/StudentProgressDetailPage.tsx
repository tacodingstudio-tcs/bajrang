// apps/web/src/pages/coaching/StudentProgressDetailPage.tsx
// Per-student view: Daily Notes | Weekly Reviews | Exam Results tabs

import { useState, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Plus, Edit2, Trash2, Star, BookOpen, BarChart2, ClipboardList, Save, X, Target, FileText, MessageCircle } from 'lucide-react'
import { toast } from 'react-hot-toast'
import {
  useParty,
  useStudentNotes, useCreateStudentNote, useUpdateStudentNote, useDeleteStudentNote,
  useStudentWeeklyReviews, useUpsertWeeklyReview,
  useStudentProgress,
  useStudentMastery, useSetMastery,
} from '@/hooks/useApi'

const TABS = ['notes', 'reviews', 'exams', 'mastery'] as const
type Tab = typeof TABS[number]

const MASTERY_LEVELS = [
  { level: 0, label: 'Not Started',  dot: 'bg-gray-300',    bg: 'bg-gray-100',    text: 'text-gray-500' },
  { level: 1, label: 'Introduced',   dot: 'bg-blue-400',    bg: 'bg-blue-50',     text: 'text-blue-700' },
  { level: 2, label: 'Developing',   dot: 'bg-yellow-400',  bg: 'bg-yellow-50',   text: 'text-yellow-700' },
  { level: 3, label: 'Almost There', dot: 'bg-orange-400',  bg: 'bg-orange-50',   text: 'text-orange-700' },
  { level: 4, label: 'Mastered',     dot: 'bg-green-500',   bg: 'bg-green-50',    text: 'text-green-700' },
]

function today() { return new Date().toISOString().split('T')[0]! }
function weekStart(d = new Date()) {
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1) // Monday
  return new Date(d.setDate(diff)).toISOString().split('T')[0]!
}

// ── Daily Note Form ──────────────────────────────────────────────────────────
function NoteForm({ partyId, existing, onDone }: { partyId: string; existing?: any; onDone: () => void }) {
  const [form, setForm] = useState({
    noteDate:    existing?.noteDate?.split('T')[0] ?? today(),
    subject:     existing?.subject ?? '',
    covered:     existing?.covered ?? '',
    nextSession: existing?.nextSession ?? '',
  })
  const create = useCreateStudentNote()
  const update = useUpdateStudentNote()

  async function save() {
    if (!form.covered.trim()) { toast.error('Please fill what was covered'); return }
    if (existing) {
      await update.mutateAsync({ id: existing.id, ...form })
    } else {
      await create.mutateAsync({ partyId, ...form })
    }
    onDone()
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Date</label>
          <input type="date" className="input" value={form.noteDate} onChange={(e) => setForm({ ...form, noteDate: e.target.value })} />
        </div>
        <div>
          <label className="label">Subject</label>
          <input type="text" className="input" placeholder="e.g. Maths, Science" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
        </div>
      </div>
      <div>
        <label className="label">What was covered <span className="text-red-500">*</span></label>
        <textarea rows={3} className="input resize-none" placeholder="Topics, concepts, exercises covered today..." value={form.covered} onChange={(e) => setForm({ ...form, covered: e.target.value })} />
      </div>
      <div>
        <label className="label">Next session plan</label>
        <textarea rows={2} className="input resize-none" placeholder="What to cover next time, homework assigned..." value={form.nextSession} onChange={(e) => setForm({ ...form, nextSession: e.target.value })} />
      </div>
      <div className="flex gap-2 justify-end">
        <button type="button" className="btn-ghost" onClick={onDone}><X className="w-4 h-4" /> Cancel</button>
        <button type="button" className="btn-primary" onClick={save} disabled={create.isPending || update.isPending}>
          <Save className="w-4 h-4" /> {existing ? 'Update' : 'Save Note'}
        </button>
      </div>
    </div>
  )
}

// ── Weekly Review Form ───────────────────────────────────────────────────────
function ReviewForm({ partyId, existing, onDone }: { partyId: string; existing?: any; onDone: () => void }) {
  const [form, setForm] = useState({
    weekStart:     existing?.weekStart?.split('T')[0] ?? weekStart(),
    overallRating: existing?.overallRating ?? 3,
    strengths:     existing?.strengths ?? '',
    weaknesses:    existing?.weaknesses ?? '',
    parentNote:    existing?.parentNote ?? '',
    targets:       existing?.targets ?? '',
  })
  const upsert = useUpsertWeeklyReview()

  async function save() {
    await upsert.mutateAsync({ partyId, ...form })
    onDone()
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
      <div className="grid grid-cols-2 gap-4 items-end">
        <div>
          <label className="label">Week of (Monday)</label>
          <input type="date" className="input" value={form.weekStart} onChange={(e) => setForm({ ...form, weekStart: e.target.value })} />
        </div>
        <div>
          <label className="label">Overall Rating</label>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setForm({ ...form, overallRating: n })}
                className={`text-xl ${n <= form.overallRating ? 'text-yellow-400' : 'text-gray-300'}`}
              >★</button>
            ))}
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Strengths this week</label>
          <textarea rows={3} className="input resize-none" placeholder="What did the student do well?" value={form.strengths} onChange={(e) => setForm({ ...form, strengths: e.target.value })} />
        </div>
        <div>
          <label className="label">Areas to improve</label>
          <textarea rows={3} className="input resize-none" placeholder="What needs more attention?" value={form.weaknesses} onChange={(e) => setForm({ ...form, weaknesses: e.target.value })} />
        </div>
      </div>
      <div>
        <label className="label">Targets for next week</label>
        <textarea rows={2} className="input resize-none" placeholder="Goals and targets for next week..." value={form.targets} onChange={(e) => setForm({ ...form, targets: e.target.value })} />
      </div>
      <div>
        <label className="label">Note for parents</label>
        <textarea rows={2} className="input resize-none" placeholder="Message to share with parents..." value={form.parentNote} onChange={(e) => setForm({ ...form, parentNote: e.target.value })} />
      </div>
      <div className="flex gap-2 justify-end">
        <button type="button" className="btn-ghost" onClick={onDone}><X className="w-4 h-4" /> Cancel</button>
        <button type="button" className="btn-primary" onClick={save} disabled={upsert.isPending}>
          <Save className="w-4 h-4" /> Save Review
        </button>
      </div>
    </div>
  )
}

// ── Main Page ────────────────────────────────────────────────────────────────
export function StudentProgressDetailPage() {
  const { partyId } = useParams<{ partyId: string }>()
  const navigate     = useNavigate()
  const [tab, setTab] = useState<Tab>('notes')
  const [showNoteForm, setShowNoteForm] = useState(false)
  const [editNote, setEditNote]         = useState<any>(null)
  const [showReviewForm, setShowReviewForm] = useState(false)
  const [editReview, setEditReview]         = useState<any>(null)

  const { data: party }   = useParty(partyId!)
  const { data: notes }   = useStudentNotes(partyId!)
  const { data: reviews } = useStudentWeeklyReviews(partyId!)
  const { data: progress} = useStudentProgress(partyId!)
  const deleteNote        = useDeleteStudentNote()

  const notesList: any[]   = Array.isArray(notes)   ? notes   : []
  const reviewsList: any[] = Array.isArray(reviews) ? reviews : []
  const examScores: any[]  = progress?.scores ?? []

  // Group exam scores by subject for the progress chart
  const bySubject = useMemo(() => {
    const map: Record<string, any[]> = {}
    for (const s of examScores) {
      const subj = s.exam?.subject ?? 'Unknown'
      if (!map[subj]) map[subj] = []
      map[subj].push(s)
    }
    return map
  }, [examScores])

  async function handleDeleteNote(id: string) {
    if (!confirm('Delete this note?')) return
    await deleteNote.mutateAsync(id)
  }

  const studentName = (party as any)?.name ?? 'Student'
  const meta = (party as any)?.meta ?? {}

  return (
    <div className="p-8 space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button type="button" onClick={() => navigate('/coaching/progress')} className="p-2 hover:bg-gray-100 rounded-lg">
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-semibold text-gray-900">{studentName}</h1>
          <div className="text-sm text-gray-500 flex gap-3 flex-wrap">
            {meta.standard && <span>{meta.standard}</span>}
            {meta.batch_name && <span>· {meta.batch_name}</span>}
            {(party as any)?.phone && <span>· {(party as any).phone}</span>}
            {meta.parent_name && <span>· Parent: {meta.parent_name}</span>}
            {meta.parent_phone && <span className="text-green-600">· 📱 {meta.parent_phone}</span>}
          </div>
        </div>
        {/* Summary pills + actions */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs px-2 py-1 bg-blue-50 text-blue-700 rounded-full">{notesList.length} Notes</span>
          <span className="text-xs px-2 py-1 bg-purple-50 text-purple-700 rounded-full">{reviewsList.length} Reviews</span>
          <span className="text-xs px-2 py-1 bg-green-50 text-green-700 rounded-full">{examScores.length} Exams</span>
          <div className="flex gap-1 ml-2">
            <button
              type="button"
              title="Print / Save PDF report card"
              onClick={() => window.open(`/coaching/report/${partyId}?month=${new Date().toISOString().slice(0,7)}`, '_blank')}
              className="btn-ghost text-xs flex items-center gap-1 py-1 px-2"
            >
              <FileText className="w-3.5 h-3.5" /> Report Card
            </button>
            {(party as any)?.phone && (
              <button
                type="button"
                title="Send WhatsApp monthly report to parent"
                onClick={() => window.open(`/coaching/report/${partyId}?month=${new Date().toISOString().slice(0,7)}`, '_blank')}
                className="btn-ghost text-xs flex items-center gap-1 py-1 px-2 text-green-700"
              >
                <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {([
          { key: 'notes',   label: 'Daily Notes',     icon: BookOpen  },
          { key: 'reviews', label: 'Weekly Reviews',  icon: Star      },
          { key: 'exams',   label: 'Exam Results',    icon: BarChart2 },
          { key: 'mastery', label: 'Topic Mastery',   icon: Target    },
        ] as { key: Tab; label: string; icon: any }[]).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === key ? 'border-primary-600 text-primary-700' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Icon className="w-4 h-4" />{label}
          </button>
        ))}
      </div>

      {/* ── NOTES TAB ─────────────────────────────────────────────────── */}
      {tab === 'notes' && (
        <div className="space-y-4">
          {!showNoteForm && !editNote && (
            <button type="button" className="btn-primary" onClick={() => setShowNoteForm(true)}>
              <Plus className="w-4 h-4" /> Add Today's Note
            </button>
          )}
          {showNoteForm && (
            <NoteForm partyId={partyId!} onDone={() => setShowNoteForm(false)} />
          )}
          {editNote && (
            <NoteForm partyId={partyId!} existing={editNote} onDone={() => setEditNote(null)} />
          )}

          {notesList.length === 0 ? (
            <div className="text-sm text-gray-400 py-8 text-center">No notes yet. Add the first note for this student.</div>
          ) : (
            <div className="space-y-3">
              {notesList.map((note: any) => (
                <div key={note.id} className="bg-white border border-gray-200 rounded-xl p-4 group">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-medium text-primary-600 bg-primary-50 px-2 py-0.5 rounded-full">
                          {new Date(note.noteDate).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
                        </span>
                        {note.subject && (
                          <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">{note.subject}</span>
                        )}
                      </div>
                      <div className="text-sm font-medium text-gray-800 mb-1">Covered</div>
                      <p className="text-sm text-gray-600 whitespace-pre-wrap">{note.covered}</p>
                      {note.nextSession && (
                        <>
                          <div className="text-sm font-medium text-gray-800 mt-3 mb-1">Next session</div>
                          <p className="text-sm text-gray-600 whitespace-pre-wrap">{note.nextSession}</p>
                        </>
                      )}
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button type="button" onClick={() => { setEditNote(note); setShowNoteForm(false) }} className="p-1.5 hover:bg-gray-100 rounded text-gray-400 hover:text-gray-700">
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button type="button" onClick={() => handleDeleteNote(note.id)} className="p-1.5 hover:bg-red-50 rounded text-gray-400 hover:text-red-600">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── REVIEWS TAB ───────────────────────────────────────────────── */}
      {tab === 'reviews' && (
        <div className="space-y-4">
          {!showReviewForm && !editReview && (
            <button type="button" className="btn-primary" onClick={() => setShowReviewForm(true)}>
              <Plus className="w-4 h-4" /> Add Weekly Review
            </button>
          )}
          {showReviewForm && (
            <ReviewForm partyId={partyId!} onDone={() => setShowReviewForm(false)} />
          )}
          {editReview && (
            <ReviewForm partyId={partyId!} existing={editReview} onDone={() => setEditReview(null)} />
          )}

          {reviewsList.length === 0 ? (
            <div className="text-sm text-gray-400 py-8 text-center">No weekly reviews yet.</div>
          ) : (
            <div className="space-y-4">
              {reviewsList.map((r: any) => (
                <div key={r.id} className="bg-white border border-gray-200 rounded-xl p-5 group">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-sm font-medium text-gray-500">
                        Week of {new Date(r.weekStart).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </div>
                      <div className="flex mt-1">
                        {[1, 2, 3, 4, 5].map((n) => (
                          <span key={n} className={`text-lg ${n <= r.overallRating ? 'text-yellow-400' : 'text-gray-200'}`}>★</span>
                        ))}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => { setEditReview(r); setShowReviewForm(false) }}
                      className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-gray-100 rounded text-gray-400 hover:text-gray-700"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-4 text-sm">
                    {r.strengths && (
                      <div>
                        <div className="font-medium text-green-700 mb-1">Strengths</div>
                        <p className="text-gray-600 whitespace-pre-wrap">{r.strengths}</p>
                      </div>
                    )}
                    {r.weaknesses && (
                      <div>
                        <div className="font-medium text-orange-600 mb-1">Areas to improve</div>
                        <p className="text-gray-600 whitespace-pre-wrap">{r.weaknesses}</p>
                      </div>
                    )}
                  </div>
                  {r.targets && (
                    <div className="mt-3 text-sm">
                      <div className="font-medium text-blue-700 mb-1">Next week targets</div>
                      <p className="text-gray-600 whitespace-pre-wrap">{r.targets}</p>
                    </div>
                  )}
                  {r.parentNote && (
                    <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm">
                      <div className="font-medium text-amber-800 mb-1">Note for parents</div>
                      <p className="text-amber-700">{r.parentNote}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── EXAMS TAB ─────────────────────────────────────────────────── */}
      {tab === 'exams' && (
        <div className="space-y-6">
          {examScores.length === 0 ? (
            <div className="text-sm text-gray-400 py-8 text-center">
              No exam results yet.{' '}
              <button type="button" onClick={() => navigate('/coaching/exams')} className="text-primary-600 underline">Create an exam</button>
              {' '}and enter marks.
            </div>
          ) : (
            <>
              {/* Per-subject progress */}
              {Object.entries(bySubject).map(([subject, scores]) => {
                const sorted = [...scores].sort((a, b) =>
                  new Date(a.exam.examDate).getTime() - new Date(b.exam.examDate).getTime()
                )
                const avg = sorted.filter((s) => s.marksObtained != null).reduce((sum, s, _, arr) => sum + (Number(s.marksObtained) / s.exam.maxMarks * 100) / arr.length, 0)
                return (
                  <div key={subject} className="bg-white border border-gray-200 rounded-xl p-5">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-semibold text-gray-900">{subject}</h3>
                      <span className="text-sm text-gray-500">Avg: <span className="font-semibold text-gray-900">{avg.toFixed(1)}%</span></span>
                    </div>
                    {/* Mini bar chart */}
                    <div className="flex items-end gap-2 h-24">
                      {sorted.map((s: any) => {
                        const pct = s.marksObtained != null ? (Number(s.marksObtained) / s.exam.maxMarks * 100) : null
                        return (
                          <div key={s.id} className="flex-1 flex flex-col items-center gap-1 min-w-0" title={`${new Date(s.exam.examDate).toLocaleDateString('en-IN')}: ${s.marksObtained ?? 'Absent'}/${s.exam.maxMarks}`}>
                            <div className="text-xs text-gray-500 font-medium">{pct != null ? `${pct.toFixed(0)}%` : 'A'}</div>
                            <div className="w-full rounded-t" style={{
                              height: pct != null ? `${Math.max(pct * 0.6, 4)}px` : '4px',
                              backgroundColor: pct == null ? '#e5e7eb' : pct >= 80 ? '#22c55e' : pct >= 60 ? '#3b82f6' : pct >= 40 ? '#f59e0b' : '#ef4444',
                            }} />
                            <div className="text-xs text-gray-400 truncate w-full text-center">
                              {new Date(s.exam.examDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                            </div>
                          </div>
                        )
                      })}
                    </div>

                    {/* Score table */}
                    <table className="w-full text-sm mt-4">
                      <thead>
                        <tr className="border-b border-gray-100">
                          <th className="text-left py-1 text-gray-500 font-medium">Date</th>
                          <th className="text-left py-1 text-gray-500 font-medium">Type</th>
                          <th className="text-right py-1 text-gray-500 font-medium">Marks</th>
                          <th className="text-right py-1 text-gray-500 font-medium">%</th>
                          {sorted.some((s) => s.answerSheetUrl) && <th className="text-right py-1 text-gray-500 font-medium">Sheet</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {sorted.map((s: any) => {
                          const pct = s.marksObtained != null ? (Number(s.marksObtained) / s.exam.maxMarks * 100) : null
                          return (
                            <tr key={s.id} className="border-b border-gray-50">
                              <td className="py-1.5">{new Date(s.exam.examDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' })}</td>
                              <td className="py-1.5 capitalize text-gray-500">{s.exam.examType?.replace('_', ' ')}</td>
                              <td className="py-1.5 text-right font-medium">
                                {s.marksObtained != null ? `${s.marksObtained}/${s.exam.maxMarks}` : <span className="text-gray-400">Absent</span>}
                              </td>
                              <td className="py-1.5 text-right">
                                {pct != null ? (
                                  <span className={`font-semibold ${pct >= 80 ? 'text-green-600' : pct >= 60 ? 'text-blue-600' : pct >= 40 ? 'text-amber-600' : 'text-red-600'}`}>
                                    {pct.toFixed(1)}%
                                  </span>
                                ) : '—'}
                              </td>
                              {sorted.some((ss) => ss.answerSheetUrl) && (
                                <td className="py-1.5 text-right">
                                  {s.answerSheetUrl ? (
                                    <a href={s.answerSheetUrl} target="_blank" rel="noopener noreferrer" className="text-primary-600 underline text-xs">View</a>
                                  ) : '—'}
                                </td>
                              )}
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>

                    {sorted.some((s) => s.remarks) && (
                      <div className="mt-3 space-y-1">
                        {sorted.filter((s) => s.remarks).map((s: any) => (
                          <div key={s.id} className="text-xs text-gray-500 italic">
                            {new Date(s.exam.examDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}: {s.remarks}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </>
          )}

          <button type="button" onClick={() => navigate('/coaching/exams')} className="btn-ghost">
            <ClipboardList className="w-4 h-4" /> Manage Exams & Enter Marks
          </button>
        </div>
      )}

      {/* ── MASTERY TAB ──────────────────────────────────────────────────── */}
      {tab === 'mastery' && partyId && (
        <MasteryTab partyId={partyId} />
      )}
    </div>
  )
}

// ── Mastery Tab Component ─────────────────────────────────────────────────────

function MasteryTab({ partyId }: { partyId: string }) {
  const { data: records = [], isLoading } = useStudentMastery(partyId)
  const setMastery = useSetMastery()

  const list: any[] = Array.isArray(records) ? records : []

  // Group by subject
  const bySubject: Record<string, any[]> = {}
  for (const r of list) {
    if (!bySubject[r.subject]) bySubject[r.subject] = []
    bySubject[r.subject].push(r)
  }
  const subjects = Object.keys(bySubject).sort()

  function cycleLevel(r: any) {
    setMastery.mutate({ partyId, subject: r.subject, topic: r.topic, masteryLevel: (r.masteryLevel + 1) % 5 })
  }

  if (isLoading) return <div className="text-sm text-gray-500">Loading mastery data...</div>

  if (list.length === 0) {
    return (
      <div className="text-sm text-gray-500 space-y-1">
        <p>No topic mastery data yet for this student.</p>
        <p className="text-xs">Mastery levels are set from the <strong>Monthly Plan → Mastery Grid</strong> view when you assess this student on specific topics.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Legend */}
      <div className="flex flex-wrap gap-3">
        {MASTERY_LEVELS.map(l => (
          <span key={l.level} className={`inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-full font-medium ${l.bg} ${l.text}`}>
            <span className={`w-2 h-2 rounded-full ${l.dot}`} />
            {l.label}
          </span>
        ))}
      </div>

      {subjects.map(subject => {
        const items = bySubject[subject]
        const masteredCount = items.filter(r => r.masteryLevel === 4).length
        const weakCount     = items.filter(r => r.masteryLevel <= 1).length
        const avgLevel      = items.reduce((a, b) => a + b.masteryLevel, 0) / items.length

        return (
          <div key={subject} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            {/* Subject header */}
            <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200">
              <div className="font-semibold text-gray-900">{subject}</div>
              <div className="flex items-center gap-3 text-xs text-gray-500">
                <span className="text-green-600 font-medium">{masteredCount} mastered</span>
                {weakCount > 0 && <span className="text-red-500 font-medium">{weakCount} weak</span>}
                <span>Avg {(avgLevel * 25).toFixed(0)}%</span>
              </div>
            </div>

            {/* Progress bar */}
            <div className="h-1.5 bg-gray-100">
              <div
                className={`h-full transition-all ${
                  avgLevel >= 3 ? 'bg-green-500' :
                  avgLevel >= 2 ? 'bg-yellow-400' :
                  avgLevel >= 1 ? 'bg-blue-400' : 'bg-gray-300'
                } ${
                  avgLevel >= 3.5 ? 'w-full' :
                  avgLevel >= 2.5 ? 'w-3/4' :
                  avgLevel >= 1.5 ? 'w-1/2' :
                  avgLevel >= 0.5 ? 'w-1/4' : 'w-0'
                }`}
              />
            </div>

            {/* Topics */}
            <div className="p-4 flex flex-wrap gap-2">
              {items.map(r => {
                const cfg = MASTERY_LEVELS[r.masteryLevel] ?? MASTERY_LEVELS[0]
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => cycleLevel(r)}
                    title="Click to update level"
                    className={`inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border font-medium transition-all hover:scale-105 ${cfg.bg} ${cfg.text} border-transparent hover:border-gray-300`}
                  >
                    <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                    {r.topic}
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
