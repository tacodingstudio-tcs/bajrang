// apps/web/src/components/coaching/TopicNotesModal.tsx
// AI-generated study notes modal — scan chapter image or generate from topic name
import { useState, useRef } from 'react'
import {
  X, Upload, BrainCircuit, BookOpen, Lightbulb, FlaskConical,
  AlertTriangle, HelpCircle, Pencil, Save, ChevronDown, ChevronUp,
  Sparkles, FileText, Calculator, Globe, ImagePlus, GraduationCap,
  ClipboardList, Link, Zap, Trophy,
} from 'lucide-react'
import { useTopicNotes, useScanTopicNotes, useSaveTopicNotes } from '@/hooks/useApi'

interface ScannedImage {
  file: File
  base64: string
  preview: string
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface Formula { name: string; formula: string; meaning: string; when?: string; derivation?: string }
interface PracticeQ { q: string; a: string; difficulty: 'easy' | 'medium' | 'hard'; type?: string }
interface BoardQ { q: string; a: string; marks: number; year?: string; type?: string }
interface YearQuestion { year: string; q: string; marks: number; board?: string }
interface BoardPaperPattern {
  overview?: string
  questionTypes?: string[]
  trendingSubtopics?: string[]
  yearWiseQuestions?: YearQuestion[]
  predictedQuestions?: string[]
}
interface SolvedExample { problem: string; solution: string; tip?: string }
interface Definition { term: string; definition: string }
interface Experiment {
  name: string; aim?: string; objective?: string
  apparatus?: string[]; materials?: string[]; chemicals?: string[]
  diagram?: string; diagramHint?: string
  procedure: string[]; observation: string; result: string; conclusion?: string
  precautions?: string[]; possibleErrors?: string[]; viva?: string[]
}
interface PracticalActivity { name: string; materials: string[]; steps: string[]; learning: string }
interface TopicContent {
  summary?: string
  keyPoints?: string[]
  definitions?: Definition[]
  formulae?: Formula[]
  solvedExamples?: SolvedExample[]
  tricks?: string[]
  strategy?: string
  experiment?: Experiment | null
  practicalActivity?: PracticalActivity | null
  commonMistakes?: string[]
  examTips?: string[]
  boardPaperPattern?: BoardPaperPattern
  boardQuestions?: BoardQ[]
  practiceQs?: PracticeQ[]
  relatedTopics?: string[]
  realWorldExample?: string
}

interface TopicNotesModalProps {
  subject: string
  topic: string
  board?: string
  standard?: string
  onClose: () => void
}

// ── Section wrapper ────────────────────────────────────────────────────────────

function Section({ icon, title, children, defaultOpen = true }: {
  icon: React.ReactNode; title: string; children: React.ReactNode; defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="border border-gray-100 rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors"
      >
        <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
          {icon}
          {title}
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </button>
      {open && <div className="px-4 py-3">{children}</div>}
    </div>
  )
}

function DiffBadge({ d }: { d: string }) {
  const map: Record<string, string> = {
    easy:   'bg-green-100 text-green-700',
    medium: 'bg-yellow-100 text-yellow-700',
    hard:   'bg-red-100 text-red-700',
  }
  return <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${map[d] ?? 'bg-gray-100 text-gray-600'}`}>{d}</span>
}

// ── Main modal ────────────────────────────────────────────────────────────────

export function TopicNotesModal({ subject, topic, board, standard, onClose }: TopicNotesModalProps) {
  const fileRef   = useRef<HTMLInputElement>(null)
  const [editing, setEditing]         = useState(false)
  const [scanning, setScanning]       = useState(false)
  const [localContent, setLocalContent] = useState<TopicContent | null>(null)
  const [expandedQ, setExpandedQ]     = useState<number | null>(null)
  const [images, setImages]           = useState<ScannedImage[]>([])

  const { data: saved, isLoading } = useTopicNotes(subject, topic)
  const scanMutation = useScanTopicNotes()
  const saveMutation = useSaveTopicNotes()

  const content: TopicContent = localContent ?? (saved?.content as TopicContent) ?? {}
  const hasNotes = Object.keys(content).length > 0

  // ── File pick ─────────────────────────────────────────────────────────────

  async function handleFiles(files: FileList) {
    const newImages: ScannedImage[] = []
    for (const file of Array.from(files)) {
      const base64 = await fileToBase64(file)
      const preview = URL.createObjectURL(file)
      newImages.push({ file, base64, preview })
    }
    setImages(prev => [...prev, ...newImages])
  }

  function removeImage(idx: number) {
    setImages(prev => prev.filter((_, i) => i !== idx))
  }

  async function handleScan() {
    if (images.length === 0) return
    setScanning(true)
    try {
      const result = await scanMutation.mutateAsync({
        subject, topic, board, standard,
        images: images.map(img => ({ base64: img.base64, mediaType: img.file.type || 'image/jpeg' })),
      })
      setLocalContent(result.content ?? result)
    } finally {
      setScanning(false)
    }
  }

  async function handleGenerate() {
    setScanning(true)
    try {
      const result = await scanMutation.mutateAsync({ subject, topic, board, standard })
      setLocalContent(result.content ?? result)
    } finally {
      setScanning(false)
    }
  }

  async function handleSave() {
    await saveMutation.mutateAsync({ subject, topic, board, standard, content })
    setLocalContent(null)
    setEditing(false)
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b">
          <div>
            <div className="flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-indigo-600" />
              <h2 className="text-lg font-bold text-gray-900">{topic}</h2>
            </div>
            <p className="text-xs text-gray-400 mt-0.5">{subject} · AI Study Notes</p>
          </div>
          <button type="button" onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Action bar */}
        <div className="border-b bg-indigo-50">
          <div className="flex items-center gap-2 px-5 py-3">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={e => e.target.files && handleFiles(e.target.files)}
              aria-label="Upload chapter pages"
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={scanning}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white text-xs font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50"
            >
              <ImagePlus className="w-3.5 h-3.5" />
              Add Pages
            </button>
            {images.length > 0 && (
              <button
                type="button"
                onClick={handleScan}
                disabled={scanning}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-700 text-white text-xs font-medium rounded-lg hover:bg-indigo-800 disabled:opacity-50"
              >
                <Upload className="w-3.5 h-3.5" />
                Scan {images.length} Page{images.length > 1 ? 's' : ''}
              </button>
            )}
            <button
              type="button"
              onClick={handleGenerate}
              disabled={scanning}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-indigo-300 text-indigo-700 text-xs font-medium rounded-lg hover:bg-indigo-50 disabled:opacity-50"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Generate from Topic
            </button>
            {hasNotes && !editing && (
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 text-gray-600 text-xs font-medium rounded-lg hover:bg-gray-50 ml-auto"
              >
                <Pencil className="w-3.5 h-3.5" /> Edit
              </button>
            )}
            {(localContent || editing) && (
              <button
                type="button"
                onClick={handleSave}
                disabled={saveMutation.isPending}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white text-xs font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 ml-auto"
              >
                <Save className="w-3.5 h-3.5" />
                {saveMutation.isPending ? 'Saving…' : 'Save Notes'}
              </button>
            )}
          </div>

          {/* Image preview strip */}
          {images.length > 0 && (
            <div className="flex gap-2 px-5 pb-3 overflow-x-auto">
              {images.map((img, i) => (
                <div key={i} className="relative shrink-0">
                  <img
                    src={img.preview}
                    alt={`Page ${i + 1}`}
                    className="w-16 h-20 object-cover rounded-lg border-2 border-indigo-200"
                  />
                  <span className="absolute top-0.5 left-0.5 bg-indigo-600 text-white text-[9px] font-bold px-1 rounded">
                    {i + 1}
                  </span>
                  <button
                    type="button"
                    title="Remove page"
                    onClick={() => removeImage(i)}
                    className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full w-4 h-4 flex items-center justify-center hover:bg-red-600"
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="shrink-0 w-16 h-20 border-2 border-dashed border-indigo-300 rounded-lg flex flex-col items-center justify-center gap-1 hover:bg-indigo-50 text-indigo-400"
              >
                <ImagePlus className="w-4 h-4" />
                <span className="text-[9px]">Add more</span>
              </button>
            </div>
          )}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-3">

          {/* Scanning state */}
          {scanning && (
            <div className="flex flex-col items-center justify-center py-16 gap-4">
              <BrainCircuit className="w-12 h-12 text-indigo-400 animate-pulse" />
              <p className="text-sm text-gray-500 font-medium">AI is reading {images.length > 1 ? `${images.length} pages` : 'the chapter'}…</p>
              <p className="text-xs text-gray-400">Generating summary, tricks, experiments & practice questions</p>
            </div>
          )}

          {/* Loading saved */}
          {!scanning && isLoading && (
            <div className="py-12 text-center text-sm text-gray-400">Loading notes…</div>
          )}

          {/* Empty state */}
          {!scanning && !isLoading && !hasNotes && (
            <div className="py-12 text-center">
              <FileText className="w-10 h-10 text-gray-200 mx-auto mb-3" />
              <p className="text-sm text-gray-500 font-medium">No notes yet for this topic</p>
              <p className="text-xs text-gray-400 mt-1">
                Upload a chapter scan or click "Generate from Topic" to create AI notes
              </p>
            </div>
          )}

          {/* Notes content */}
          {!scanning && hasNotes && (
            <>
              {/* Summary */}
              {content.summary && (
                <Section icon={<BookOpen className="w-4 h-4 text-blue-500" />} title="Summary">
                  <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">{content.summary}</p>
                </Section>
              )}

              {/* Definitions */}
              {content.definitions?.length ? (
                <Section icon={<FileText className="w-4 h-4 text-sky-500" />} title="Definitions">
                  <div className="space-y-2">
                    {content.definitions.map((d, i) => (
                      <div key={i} className="bg-sky-50 rounded-lg p-2.5">
                        <span className="text-xs font-bold text-sky-700">{d.term}: </span>
                        <span className="text-xs text-sky-900">{d.definition}</span>
                      </div>
                    ))}
                  </div>
                </Section>
              ) : null}

              {/* Key Points */}
              {content.keyPoints?.length ? (
                <Section icon={<ClipboardList className="w-4 h-4 text-teal-500" />} title="Key Points">
                  <ul className="space-y-1.5">
                    {content.keyPoints.map((pt, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                        <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-teal-400 shrink-0" />
                        {pt}
                      </li>
                    ))}
                  </ul>
                </Section>
              ) : null}

              {/* Formulae */}
              {content.formulae?.length ? (
                <Section icon={<Calculator className="w-4 h-4 text-violet-500" />} title="Formulae">
                  <div className="space-y-3">
                    {content.formulae.map((f, i) => (
                      <div key={i} className="bg-violet-50 rounded-lg p-3 border border-violet-100">
                        <div className="text-xs font-semibold text-violet-700 mb-1">{f.name}</div>
                        <div className="font-mono text-base text-violet-900 font-bold mb-1">{f.formula}</div>
                        <div className="text-xs text-violet-600 mb-1">{f.meaning}</div>
                        {f.when && <div className="text-xs text-violet-500 italic">Use when: {f.when}</div>}
                        {f.derivation && (
                          <div className="mt-1.5 bg-violet-100 rounded p-1.5 text-xs text-violet-700">
                            <span className="font-semibold">Derivation: </span>{f.derivation}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </Section>
              ) : null}

              {/* Solved Examples */}
              {content.solvedExamples?.length ? (
                <Section icon={<GraduationCap className="w-4 h-4 text-blue-600" />} title="Solved Examples">
                  <div className="space-y-3">
                    {content.solvedExamples.map((ex, i) => (
                      <div key={i} className="border border-blue-100 rounded-lg overflow-hidden">
                        <div className="bg-blue-50 px-3 py-2">
                          <span className="text-xs font-bold text-blue-700">Example {i + 1}: </span>
                          <span className="text-sm text-blue-900">{ex.problem}</span>
                        </div>
                        <div className="px-3 py-2 bg-white">
                          <div className="text-xs font-semibold text-gray-500 mb-1">Solution:</div>
                          <p className="text-sm text-gray-800 whitespace-pre-line leading-relaxed">{ex.solution}</p>
                          {ex.tip && (
                            <div className="mt-2 flex items-start gap-1.5 text-xs text-amber-700 bg-amber-50 rounded p-1.5">
                              <Lightbulb className="w-3 h-3 shrink-0 mt-0.5" />{ex.tip}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </Section>
              ) : null}

              {/* Tricks & Mnemonics */}
              {content.tricks?.length ? (
                <Section icon={<Lightbulb className="w-4 h-4 text-yellow-500" />} title="Tricks & Mnemonics">
                  <ul className="space-y-2">
                    {content.tricks.map((t, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                        <span className="text-yellow-500 shrink-0">💡</span>{t}
                      </li>
                    ))}
                  </ul>
                </Section>
              ) : null}

              {/* Strategy */}
              {content.strategy && (
                <Section icon={<BrainCircuit className="w-4 h-4 text-indigo-500" />} title="Strategy / Teaching Approach">
                  <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">{content.strategy}</p>
                </Section>
              )}

              {/* Experiment */}
              {content.experiment && (
                <Section icon={<FlaskConical className="w-4 h-4 text-green-600" />} title="Experiment" defaultOpen={true}>
                  <div className="space-y-3">
                    <div className="font-semibold text-sm text-green-800">{content.experiment.name}</div>
                    {(content.experiment.aim || content.experiment.objective) && (
                      <div className="bg-green-50 rounded p-2.5">
                        <span className="text-xs font-semibold text-green-700 uppercase tracking-wide">Aim / Objective</span>
                        <p className="text-sm text-gray-700 mt-0.5">{content.experiment.aim ?? content.experiment.objective}</p>
                      </div>
                    )}
                    {(content.experiment.apparatus ?? content.experiment.materials)?.length ? (
                      <div>
                        <span className="text-xs font-semibold text-green-700 uppercase tracking-wide">Apparatus / Materials</span>
                        <div className="flex flex-wrap gap-1.5 mt-1.5">
                          {(content.experiment.apparatus ?? content.experiment.materials)!.map((m, i) => (
                            <span key={i} className="text-xs bg-green-50 text-green-700 border border-green-200 px-2 py-0.5 rounded-full">{m}</span>
                          ))}
                        </div>
                      </div>
                    ) : null}
                    {content.experiment.chemicals?.length ? (
                      <div>
                        <span className="text-xs font-semibold text-orange-600 uppercase tracking-wide">Chemicals</span>
                        <div className="flex flex-wrap gap-1.5 mt-1.5">
                          {content.experiment.chemicals.map((c, i) => (
                            <span key={i} className="text-xs bg-orange-50 text-orange-700 border border-orange-200 px-2 py-0.5 rounded-full">{c}</span>
                          ))}
                        </div>
                      </div>
                    ) : null}
                    {(content.experiment.diagram ?? content.experiment.diagramHint) && (
                      <div className="bg-gray-50 border border-dashed border-gray-300 rounded-lg p-3">
                        <span className="text-xs font-semibold text-gray-500">📐 Diagram</span>
                        <p className="text-xs text-gray-600 mt-1">{content.experiment.diagram ?? content.experiment.diagramHint}</p>
                      </div>
                    )}
                    {content.experiment.procedure?.length ? (
                      <div>
                        <span className="text-xs font-semibold text-green-700 uppercase tracking-wide">Procedure</span>
                        <ol className="mt-1.5 space-y-1.5">
                          {content.experiment.procedure.map((step, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                              <span className="shrink-0 w-5 h-5 rounded-full bg-green-100 text-green-700 text-[10px] font-bold flex items-center justify-center mt-0.5">{i + 1}</span>
                              {step}
                            </li>
                          ))}
                        </ol>
                      </div>
                    ) : null}
                    <div className="grid grid-cols-2 gap-3">
                      {content.experiment.observation && (
                        <div className="bg-blue-50 rounded-lg p-2.5">
                          <span className="text-xs font-semibold text-blue-700">Observation</span>
                          <p className="text-xs text-blue-800 mt-1">{content.experiment.observation}</p>
                        </div>
                      )}
                      {content.experiment.result && (
                        <div className="bg-green-50 rounded-lg p-2.5">
                          <span className="text-xs font-semibold text-green-700">Result</span>
                          <p className="text-xs text-green-800 mt-1">{content.experiment.result}</p>
                        </div>
                      )}
                    </div>
                    {content.experiment.conclusion && (
                      <div className="bg-teal-50 rounded p-2.5">
                        <span className="text-xs font-semibold text-teal-700">Conclusion</span>
                        <p className="text-xs text-teal-800 mt-0.5">{content.experiment.conclusion}</p>
                      </div>
                    )}
                    {content.experiment.precautions?.length ? (
                      <div>
                        <span className="text-xs font-semibold text-red-600 uppercase tracking-wide">⚠ Precautions</span>
                        <ul className="mt-1 space-y-0.5">
                          {content.experiment.precautions.map((p, i) => (
                            <li key={i} className="text-xs text-red-700 flex items-start gap-1.5"><span>•</span>{p}</li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                    {content.experiment.possibleErrors?.length ? (
                      <div>
                        <span className="text-xs font-semibold text-orange-600 uppercase tracking-wide">Possible Errors</span>
                        <ul className="mt-1 space-y-0.5">
                          {content.experiment.possibleErrors.map((e, i) => (
                            <li key={i} className="text-xs text-orange-700 flex items-start gap-1.5"><span>•</span>{e}</li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                    {content.experiment.viva?.length ? (
                      <div className="bg-purple-50 rounded-lg p-3">
                        <span className="text-xs font-semibold text-purple-700 uppercase tracking-wide">Viva Questions</span>
                        <ul className="mt-1.5 space-y-1">
                          {content.experiment.viva.map((v, i) => (
                            <li key={i} className="text-xs text-purple-800 flex items-start gap-1.5">
                              <span className="font-bold shrink-0">Q{i+1}.</span>{v}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </div>
                </Section>
              )}

              {/* Practical Activity (non-science) */}
              {content.practicalActivity && (
                <Section icon={<Zap className="w-4 h-4 text-amber-500" />} title="Practical Activity">
                  <div className="space-y-2">
                    <div className="font-medium text-sm text-amber-800">{content.practicalActivity.name}</div>
                    {content.practicalActivity.materials?.length ? (
                      <div className="flex flex-wrap gap-1.5">
                        {content.practicalActivity.materials.map((m, i) => (
                          <span key={i} className="text-xs bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full">{m}</span>
                        ))}
                      </div>
                    ) : null}
                    <ol className="space-y-1">
                      {content.practicalActivity.steps?.map((s, i) => (
                        <li key={i} className="text-sm text-gray-700 flex items-start gap-2">
                          <span className="shrink-0 w-4 h-4 rounded-full bg-amber-100 text-amber-700 text-[10px] font-bold flex items-center justify-center mt-0.5">{i+1}</span>{s}
                        </li>
                      ))}
                    </ol>
                    <div className="bg-amber-50 rounded p-2 text-xs text-amber-800">
                      <span className="font-semibold">Learning outcome: </span>{content.practicalActivity.learning}
                    </div>
                  </div>
                </Section>
              )}

              {/* Common Mistakes */}
              {content.commonMistakes?.length ? (
                <Section icon={<AlertTriangle className="w-4 h-4 text-orange-500" />} title="Common Mistakes">
                  <ul className="space-y-1.5">
                    {content.commonMistakes.map((m, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                        <span className="text-orange-500 shrink-0">⚠</span>{m}
                      </li>
                    ))}
                  </ul>
                </Section>
              ) : null}

              {/* Exam Tips */}
              {content.examTips?.length ? (
                <Section icon={<Trophy className="w-4 h-4 text-yellow-600" />} title="Exam Tips">
                  <ul className="space-y-1.5">
                    {content.examTips.map((t, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                        <span className="text-yellow-600 shrink-0">🎯</span>{t}
                      </li>
                    ))}
                  </ul>
                </Section>
              ) : null}

              {/* Board Paper Pattern (5-year analysis) */}
              {content.boardPaperPattern && (
                <Section icon={<GraduationCap className="w-4 h-4 text-orange-500" />} title="Last 5 Years Board Paper Pattern" defaultOpen={false}>
                  <div className="space-y-4">
                    {content.boardPaperPattern.overview && (
                      <p className="text-sm text-gray-700 bg-orange-50 rounded-lg p-3 border border-orange-100">
                        {content.boardPaperPattern.overview}
                      </p>
                    )}
                    {content.boardPaperPattern.trendingSubtopics?.length ? (
                      <div>
                        <div className="text-xs font-semibold text-orange-600 uppercase mb-1.5">Frequently Tested Sub-topics</div>
                        <div className="flex flex-wrap gap-2">
                          {content.boardPaperPattern.trendingSubtopics.map((t, i) => (
                            <span key={i} className="text-xs bg-orange-100 text-orange-700 border border-orange-200 px-2.5 py-1 rounded-full">🔥 {t}</span>
                          ))}
                        </div>
                      </div>
                    ) : null}
                    {content.boardPaperPattern.questionTypes?.length ? (
                      <div>
                        <div className="text-xs font-semibold text-gray-500 uppercase mb-1.5">Question Types Asked</div>
                        <ul className="space-y-1">
                          {content.boardPaperPattern.questionTypes.map((qt, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                              <span className="text-orange-400 mt-0.5">▸</span>{qt}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                    {content.boardPaperPattern.yearWiseQuestions?.length ? (
                      <div>
                        <div className="text-xs font-semibold text-gray-500 uppercase mb-2">Year-wise Questions</div>
                        <div className="space-y-2">
                          {content.boardPaperPattern.yearWiseQuestions.map((yq, i) => (
                            <div key={i} className="border border-orange-100 rounded-lg overflow-hidden">
                              <div className="bg-orange-50 px-3 py-1.5 flex items-center gap-2">
                                <span className="text-xs font-bold text-orange-700 bg-orange-200 px-2 py-0.5 rounded">{yq.year}</span>
                                {yq.board && <span className="text-[11px] text-orange-500">{yq.board}</span>}
                                <span className="ml-auto text-xs font-bold text-orange-600">{yq.marks}M</span>
                              </div>
                              <div className="px-3 py-2 text-sm text-gray-800">{yq.q}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}
                    {content.boardPaperPattern.predictedQuestions?.length ? (
                      <div>
                        <div className="text-xs font-semibold text-indigo-600 uppercase mb-1.5">🎯 Predicted for Next Exam</div>
                        <ul className="space-y-1">
                          {content.boardPaperPattern.predictedQuestions.map((pq, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm text-gray-700 bg-indigo-50 rounded-lg px-3 py-2">
                              <span className="text-indigo-400 mt-0.5">★</span>{pq}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </div>
                </Section>
              )}

              {/* Board Questions */}
              {content.boardQuestions?.length ? (
                <Section icon={<GraduationCap className="w-4 h-4 text-red-500" />} title="Board Exam Questions (Model Answers)" defaultOpen={false}>
                  <div className="space-y-2">
                    {content.boardQuestions.map((bq, i) => (
                      <div key={i} className="border border-red-100 rounded-lg overflow-hidden">
                        <div className="bg-red-50 px-3 py-2 flex items-start justify-between gap-2">
                          <span className="text-sm text-red-900">{bq.q}</span>
                          <div className="flex items-center gap-1 shrink-0">
                            {bq.type && <span className="text-[10px] text-red-500 bg-red-100 px-1.5 py-0.5 rounded">{bq.type}</span>}
                            <span className="text-xs font-bold text-red-600 bg-red-100 px-1.5 py-0.5 rounded">{bq.marks}M</span>
                          </div>
                        </div>
                        <div className="px-3 py-2 text-xs text-gray-700 whitespace-pre-line">{bq.a}</div>
                      </div>
                    ))}
                  </div>
                </Section>
              ) : null}

              {/* Real-world example */}
              {content.realWorldExample && (
                <Section icon={<Globe className="w-4 h-4 text-cyan-500" />} title="Real-World Connection" defaultOpen={false}>
                  <p className="text-sm text-gray-700 leading-relaxed">{content.realWorldExample}</p>
                </Section>
              )}

              {/* Related Topics */}
              {content.relatedTopics?.length ? (
                <Section icon={<Link className="w-4 h-4 text-gray-400" />} title="Related Topics" defaultOpen={false}>
                  <div className="flex flex-wrap gap-2">
                    {content.relatedTopics.map((t, i) => (
                      <span key={i} className="text-xs bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full">{t}</span>
                    ))}
                  </div>
                </Section>
              ) : null}

              {/* Practice Questions */}
              {content.practiceQs?.length ? (
                <Section icon={<HelpCircle className="w-4 h-4 text-purple-500" />} title={`Practice Questions (${content.practiceQs.length})`}>
                  <div className="space-y-2">
                    {content.practiceQs.map((pq, i) => (
                      <div key={i} className="border border-purple-100 rounded-lg overflow-hidden">
                        <button
                          type="button"
                          onClick={() => setExpandedQ(expandedQ === i ? null : i)}
                          className="w-full flex items-start justify-between gap-3 p-3 text-left hover:bg-purple-50 transition-colors"
                        >
                          <div className="flex items-start gap-2">
                            <span className="shrink-0 w-5 h-5 rounded-full bg-purple-100 text-purple-700 text-[10px] font-bold flex items-center justify-center mt-0.5">{i + 1}</span>
                            <span className="text-sm text-gray-800">{pq.q}</span>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {pq.type && (
                              <span className="text-[10px] text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded border border-gray-200 hidden sm:inline">
                                {pq.type}
                              </span>
                            )}
                            <DiffBadge d={pq.difficulty} />
                            {expandedQ === i
                              ? <ChevronUp className="w-3.5 h-3.5 text-gray-400" />
                              : <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
                            }
                          </div>
                        </button>
                        {expandedQ === i && (
                          <div className="px-3 pb-3 pt-0">
                            <div className="bg-purple-50 rounded-lg p-2.5">
                              <span className="text-[10px] font-semibold text-purple-600 uppercase">Answer</span>
                              <p className="text-sm text-purple-900 mt-1 leading-relaxed whitespace-pre-line">{pq.a}</p>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </Section>
              ) : null}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Helper ────────────────────────────────────────────────────────────────────

// Resize + compress image to max 1280px wide, quality 0.8 — keeps text readable
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      const MAX = 1280
      const scale = img.width > MAX ? MAX / img.width : 1
      const canvas = document.createElement('canvas')
      canvas.width  = Math.round(img.width  * scale)
      canvas.height = Math.round(img.height * scale)
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      URL.revokeObjectURL(url)
      // Always output as JPEG for smaller size
      const dataUrl = canvas.toDataURL('image/jpeg', 0.82)
      resolve(dataUrl.split(',')[1] ?? dataUrl)
    }
    img.onerror = reject
    img.src = url
  })
}
