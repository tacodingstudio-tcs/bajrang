// apps/web/src/pages/coaching/StudentReportPage.tsx
// Print-optimised monthly report card for parents
// Open in new tab → Print / Save as PDF / Send via WhatsApp

import { useParams, useSearchParams } from 'react-router-dom'
import { useParty, useStudentMastery, useStudentProgress, useCoachingPlans, usePlanNotes } from '@/hooks/useApi'
import { Printer, MessageCircle } from 'lucide-react'

const MASTERY_LEVELS = [
  { level: 0, label: 'Not Started',  dot: '○', filled: 'bg-gray-200',   text: 'text-gray-400'  },
  { level: 1, label: 'Introduced',   dot: '●', filled: 'bg-blue-300',   text: 'text-blue-600'  },
  { level: 2, label: 'Developing',   dot: '●', filled: 'bg-yellow-400', text: 'text-yellow-600'},
  { level: 3, label: 'Almost There', dot: '●', filled: 'bg-orange-400', text: 'text-orange-600'},
  { level: 4, label: 'Mastered',     dot: '●', filled: 'bg-green-500',  text: 'text-green-600' },
]

function MasteryDots({ level }: { level: number }) {
  return (
    <span className="flex gap-0.5 items-center">
      {[0, 1, 2, 3, 4].map(i => (
        <span
          key={i}
          className={`w-3 h-3 rounded-full border ${i <= level ? MASTERY_LEVELS[level]?.filled ?? 'bg-gray-200' : 'bg-gray-100 border-gray-200'}`}
        />
      ))}
    </span>
  )
}

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']

function monthLabel(my: string) {
  if (!my) return ''
  const [y, m] = my.split('-')
  return `${MONTHS[parseInt(m) - 1]} ${y}`
}

// ── Per-plan study notes section for report ────────────────────────────────────

function PlanStudyNotes({ plan }: { plan: any }) {
  const { data: notesList } = usePlanNotes(plan.id)
  const notes: any[] = Array.isArray(notesList) ? notesList : []
  if (notes.length === 0) return null

  return (
    <div className="mt-6 break-before-page">
      <div className="text-sm font-semibold text-gray-700 mb-3">
        Study Notes — {plan.subject}
      </div>
      <div className="space-y-5">
        {notes.map((note: any) => {
          const c = note.content ?? {}
          return (
            <div key={note.id} className="border border-gray-200 rounded-lg p-4">
              <div className="font-semibold text-gray-800 text-sm mb-3 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-indigo-400 inline-block" />
                {note.topic}
              </div>

              {c.summary && (
                <div className="mb-2">
                  <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Summary</span>
                  <p className="text-xs text-gray-700 mt-0.5 leading-relaxed">{c.summary}</p>
                </div>
              )}

              {c.keyPoints?.length > 0 && (
                <div className="mb-2">
                  <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Key Points</span>
                  <ul className="mt-0.5 space-y-0.5">
                    {c.keyPoints.map((pt: string, i: number) => (
                      <li key={i} className="text-xs text-gray-700 flex items-start gap-1.5">
                        <span className="mt-1 w-1 h-1 rounded-full bg-indigo-400 shrink-0" />{pt}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {c.formulae?.length > 0 && (
                <div className="mb-2">
                  <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Formulae</span>
                  <div className="mt-0.5 flex flex-wrap gap-2">
                    {c.formulae.map((f: any, i: number) => (
                      <div key={i} className="bg-violet-50 border border-violet-100 rounded px-2 py-1">
                        <div className="text-[10px] text-violet-500">{f.name}</div>
                        <div className="font-mono text-sm font-bold text-violet-800">{f.formula}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {c.tricks?.length > 0 && (
                <div className="mb-2">
                  <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Tricks & Mnemonics</span>
                  <ul className="mt-0.5 space-y-0.5">
                    {c.tricks.map((t: string, i: number) => (
                      <li key={i} className="text-xs text-gray-700 flex items-start gap-1.5">
                        <span className="shrink-0">💡</span>{t}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {c.experiment && (
                <div className="mb-2 bg-green-50 rounded p-2">
                  <span className="text-[10px] font-semibold text-green-600 uppercase tracking-wide">🧪 Experiment: {c.experiment.name}</span>
                  <p className="text-xs text-green-800 mt-0.5">{c.experiment.objective}</p>
                  {c.experiment.materials?.length > 0 && (
                    <div className="mt-1 text-[10px] text-green-700">
                      <strong>Materials:</strong> {c.experiment.materials.join(', ')}
                    </div>
                  )}
                  {c.experiment.procedure?.length > 0 && (
                    <ol className="mt-1 space-y-0.5">
                      {c.experiment.procedure.map((step: string, i: number) => (
                        <li key={i} className="text-[10px] text-green-800 flex gap-1">
                          <span className="font-bold shrink-0">{i + 1}.</span>{step}
                        </li>
                      ))}
                    </ol>
                  )}
                  {c.experiment.result && (
                    <div className="mt-1 text-[10px] text-green-700">
                      <strong>Result:</strong> {c.experiment.result}
                    </div>
                  )}
                </div>
              )}

              {c.commonMistakes?.length > 0 && (
                <div className="mb-2">
                  <span className="text-[10px] font-semibold text-orange-500 uppercase tracking-wide">⚠ Common Mistakes</span>
                  <ul className="mt-0.5 space-y-0.5">
                    {c.commonMistakes.map((m: string, i: number) => (
                      <li key={i} className="text-xs text-gray-700 flex items-start gap-1.5">
                        <span className="shrink-0 text-orange-400">•</span>{m}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {c.practiceQs?.length > 0 && (
                <div>
                  <span className="text-[10px] font-semibold text-purple-500 uppercase tracking-wide">Practice Questions</span>
                  <div className="mt-0.5 space-y-1.5">
                    {c.practiceQs.map((pq: any, i: number) => (
                      <div key={i} className="bg-purple-50 rounded p-2">
                        <div className="text-xs font-medium text-purple-800">Q{i + 1}: {pq.q}</div>
                        <div className="text-xs text-purple-600 mt-0.5">Ans: {pq.a}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function StudentReportPage() {
  const { partyId } = useParams<{ partyId: string }>()
  const [searchParams] = useSearchParams()
  const monthYear = searchParams.get('month') ?? ''

  const { data: party }    = useParty(partyId!)
  const { data: mastery }  = useStudentMastery(partyId!)
  const { data: progress } = useStudentProgress(partyId!)
  const { data: plans }    = useCoachingPlans(monthYear ? { monthYear, batchName: (party as any)?.meta?.batch_name } : undefined)

  const masteryList: any[] = Array.isArray(mastery) ? mastery : []
  const examScores: any[]  = progress?.scores ?? []
  const planList: any[]    = Array.isArray(plans) ? plans : []

  const student  = party as any
  const meta     = student?.meta ?? {}
  const batchName = meta.batch_name ?? ''

  // Group mastery by subject
  const bySubject: Record<string, any[]> = {}
  for (const r of masteryList) {
    if (!bySubject[r.subject]) bySubject[r.subject] = []
    bySubject[r.subject].push(r)
  }

  // Group exam scores by subject (filter to this month if monthYear given)
  const examBySubject: Record<string, any[]> = {}
  for (const s of examScores) {
    if (monthYear) {
      const examMonth = s.exam?.examDate?.slice(0, 7)
      if (examMonth !== monthYear) continue
    }
    const subj = s.exam?.subject ?? 'Unknown'
    if (!examBySubject[subj]) examBySubject[subj] = []
    examBySubject[subj].push(s)
  }

  const allSubjects = [...new Set([...Object.keys(bySubject), ...Object.keys(examBySubject)])].sort()

  // WhatsApp report message
  function buildWhatsAppMessage() {
    const lines: string[] = []
    lines.push(`📊 *Monthly Progress Report*`)
    lines.push(`Student: *${student?.name}*`)
    lines.push(`Batch: ${batchName}`)
    if (monthYear) lines.push(`Month: ${monthLabel(monthYear)}`)
    lines.push('')

    for (const subj of allSubjects) {
      lines.push(`📚 *${subj}*`)
      const topics = bySubject[subj] ?? []
      const mastered  = topics.filter(t => t.masteryLevel === 4).map(t => t.topic)
      const strong    = topics.filter(t => t.masteryLevel === 3).map(t => t.topic)
      const developing= topics.filter(t => t.masteryLevel === 2).map(t => t.topic)
      const weak      = topics.filter(t => t.masteryLevel <= 1 && t.masteryLevel > 0).map(t => t.topic)

      if (mastered.length)   lines.push(`✅ Mastered: ${mastered.join(', ')}`)
      if (strong.length)     lines.push(`🟠 Almost There: ${strong.join(', ')}`)
      if (developing.length) lines.push(`🟡 Developing: ${developing.join(', ')}`)
      if (weak.length)       lines.push(`🔴 Needs Attention: ${weak.join(', ')}`)

      const exams = examBySubject[subj] ?? []
      if (exams.length) {
        const scores = exams.map(e => e.marksObtained != null ? `${e.marksObtained}/${e.exam?.maxMarks}` : 'Absent').join(', ')
        lines.push(`📝 Exams: ${scores}`)
      }

      const avgLevel = topics.length > 0 ? topics.reduce((a, b) => a + b.masteryLevel, 0) / topics.length : 0
      lines.push(`Overall: ${(avgLevel * 25).toFixed(0)}%`)
      lines.push('')
    }

    lines.push('_For detailed report, contact the coaching centre._')
    return lines.join('\n')
  }

  function sendWhatsApp() {
    const phone = meta.parent_phone || meta.phone || student?.phone || ''
    const msg   = buildWhatsAppMessage()
    const url   = `https://wa.me/91${phone.replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`
    window.open(url, '_blank')
  }

  if (!student) return <div className="p-8 text-sm text-gray-500">Loading...</div>

  return (
    <>
      {/* Action bar — hidden in print */}
      <div className="print:hidden bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-3 sticky top-0 z-10">
        <div className="flex-1 text-sm font-medium text-gray-700">
          Report Card — {student.name} {monthYear && `· ${monthLabel(monthYear)}`}
        </div>
        <button
          type="button"
          onClick={sendWhatsApp}
          className="btn-ghost text-sm flex items-center gap-1.5 text-green-700"
        >
          <MessageCircle className="w-4 h-4" />
          Send via WhatsApp
        </button>
        <button
          type="button"
          onClick={() => window.print()}
          className="btn-primary text-sm flex items-center gap-1.5"
        >
          <Printer className="w-4 h-4" />
          Print / Save PDF
        </button>
      </div>

      {/* Report card — this is what prints */}
      <div className="max-w-2xl mx-auto p-8 print:p-6 print:max-w-full font-sans">

        {/* Header */}
        <div className="text-center border-b-2 border-gray-800 pb-4 mb-6">
          <div className="text-xl font-bold text-gray-900 tracking-wide">MONTHLY PROGRESS REPORT</div>
          {monthYear && <div className="text-sm text-gray-500 mt-0.5">{monthLabel(monthYear)}</div>}
        </div>

        {/* Student info */}
        <div className="grid grid-cols-2 gap-x-8 gap-y-1 mb-6 text-sm">
          <div><span className="text-gray-500">Student Name:</span> <span className="font-semibold">{student.name}</span></div>
          {batchName && <div><span className="text-gray-500">Batch:</span> <span className="font-semibold">{batchName}</span></div>}
          {meta.standard && <div><span className="text-gray-500">Standard:</span> <span className="font-semibold">{meta.standard}</span></div>}
          {student.phone && <div><span className="text-gray-500">Phone:</span> <span className="font-semibold">{student.phone}</span></div>}
          {meta.age && <div><span className="text-gray-500">Age:</span> <span className="font-semibold">{meta.age}</span></div>}
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-4 mb-6 text-xs bg-gray-50 rounded p-3">
          {MASTERY_LEVELS.map(l => (
            <span key={l.level} className="flex items-center gap-1.5 text-gray-600">
              <span className={`w-3 h-3 rounded-full ${l.filled}`} />
              {l.label}
            </span>
          ))}
        </div>

        {/* Subject sections */}
        {allSubjects.length === 0 ? (
          <div className="text-sm text-gray-500 italic">No progress data recorded yet.</div>
        ) : (
          <div className="space-y-6">
            {allSubjects.map(subj => {
              const topics = (bySubject[subj] ?? []).sort((a, b) => b.masteryLevel - a.masteryLevel)
              const exams  = examBySubject[subj] ?? []
              const avgLevel = topics.length > 0 ? topics.reduce((a, b) => a + b.masteryLevel, 0) / topics.length : 0
              const pct = (avgLevel * 25).toFixed(0)

              return (
                <div key={subj} className="border border-gray-200 rounded-lg overflow-hidden print:break-inside-avoid">
                  {/* Subject header */}
                  <div className="flex items-center justify-between px-4 py-2 bg-gray-800 text-white">
                    <span className="font-semibold text-sm">{subj}</span>
                    <span className="text-xs text-gray-300">Overall Progress: {pct}%</span>
                  </div>

                  {/* Progress bar */}
                  <div className="h-1.5 bg-gray-200">
                    <div
                      className={`h-full ${
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

                  <div className="p-4 space-y-4">
                    {/* Topics table */}
                    {topics.length > 0 && (
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-gray-100">
                            <th className="text-left text-xs font-semibold text-gray-500 pb-1">Topic</th>
                            <th className="text-left text-xs font-semibold text-gray-500 pb-1">Level</th>
                            <th className="text-left text-xs font-semibold text-gray-500 pb-1">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {topics.map(t => {
                            const cfg = MASTERY_LEVELS[t.masteryLevel] ?? MASTERY_LEVELS[0]
                            return (
                              <tr key={t.id} className="border-b border-gray-50 last:border-0">
                                <td className="py-1.5 text-gray-800">{t.topic}</td>
                                <td className="py-1.5"><MasteryDots level={t.masteryLevel} /></td>
                                <td className={`py-1.5 text-xs font-medium ${cfg.text}`}>{cfg.label}</td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    )}

                    {/* Exam scores */}
                    {exams.length > 0 && (
                      <div>
                        <div className="text-xs font-semibold text-gray-500 mb-1.5">Exam Scores</div>
                        <div className="flex flex-wrap gap-2">
                          {exams.map((e: any) => {
                            const pct = e.marksObtained != null ? ((Number(e.marksObtained) / e.exam.maxMarks) * 100) : null
                            return (
                              <div key={e.id} className="text-xs border border-gray-200 rounded px-2 py-1 text-center min-w-[80px]">
                                <div className="text-gray-400 text-[10px]">
                                  {new Date(e.exam.examDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                                </div>
                                <div className="font-semibold text-gray-800">
                                  {e.marksObtained != null ? `${e.marksObtained}/${e.exam.maxMarks}` : 'Absent'}
                                </div>
                                {pct != null && (
                                  <div className={`text-[10px] font-medium ${pct >= 80 ? 'text-green-600' : pct >= 60 ? 'text-blue-600' : pct >= 40 ? 'text-amber-600' : 'text-red-600'}`}>
                                    {pct.toFixed(0)}%
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Monthly plan topics */}
        {planList.length > 0 && (
          <div className="mt-6">
            <div className="text-sm font-semibold text-gray-700 mb-2">Monthly Syllabus Coverage</div>
            <div className="space-y-2">
              {planList.map((plan: any) => (
                <div key={plan.id} className="text-sm text-gray-600 border border-gray-200 rounded p-3">
                  <div className="font-medium text-gray-800 mb-1">{plan.subject}</div>
                  {(plan.weeks ?? []).map((w: any) => (
                    <div key={w.id} className="text-xs text-gray-500 flex gap-2">
                      <span className="font-medium">Week {w.weekNumber}:</span>
                      <span>{(w.topics as string[]).join(', ') || '—'}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* AI Study Notes per plan */}
        {planList.map((plan: any) => (
          <PlanStudyNotes key={plan.id} plan={plan} />
        ))}

        {/* Signature section */}
        <div className="mt-10 grid grid-cols-2 gap-8 text-sm">
          <div>
            <div className="border-t border-gray-400 pt-2 text-gray-500 text-xs">Class Teacher Signature</div>
          </div>
          <div>
            <div className="border-t border-gray-400 pt-2 text-gray-500 text-xs">Parent Signature</div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center text-xs text-gray-400 border-t border-gray-100 pt-4">
          Generated by HisabKitab Coaching Platform · {new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
        </div>
      </div>
    </>
  )
}
