// apps/web/src/components/coaching/PhaseKitPanel.tsx
import { useState } from 'react'
import {
  Sparkles, Printer, CheckCircle2,
  Package, BookOpen, Zap, Target, AlertTriangle, HelpCircle,
  Cpu, Layers, ListChecks, Loader2, ShieldAlert, BookMarked,
} from 'lucide-react'
import { useGeneratePhaseKit } from '@/hooks/useApi'

// ── Types ──────────────────────────────────────────────────────────────────────
interface ConceptNode { label: string; children?: string[] }
interface ConceptDiagram { title: string; nodes: ConceptNode[]; summary: string }
interface TheoryPoint { topic: string; explanation: string; example: string }
interface ComponentItem { name: string; qty: string; purpose: string; alternativeIfMissing?: string }
interface TeachingStep { step: number; title: string; duration: string; activity: string; studentAction: string }
interface AssessmentQ { question: string; answer: string; difficulty: 'easy' | 'medium' | 'hard' }
// Design-specific
interface CircuitConnection { from: string; to: string; wire: string; note?: string }
interface CircuitDiagram { title: string; connections: CircuitConnection[]; powerRail?: string; schematicNotes?: string[] }
interface PinRow { component: string; pin: string; connectsTo: string; purpose: string }
// Build-specific
interface AssemblyStep { stepNo: number; action: string; tool?: string; tip?: string; checkAfter?: string }
interface WiringGuide { sequence: string[]; colourCode?: Record<string, string>; pitfalls?: string[] }
// Code-specific
interface CodeBlock { functionName: string; purpose: string; pseudocode: string; arduinoHint?: string }
interface VarRow { name: string; type: string; purpose: string; initialValue?: string }
interface Flowchart { start: string; loop: string[]; conditions?: { if: string; then: string; else?: string }[] }
// Test-specific
interface TestCase { testName: string; input: string; expectedOutput: string; edgeCase: boolean; howToTest: string; failIndicator?: string }
interface DebugRow { symptom: string; likelyCause: string; fix: string; preventionTip?: string }
interface PerfMetric { metric: string; unit: string; targetValue: string; howToMeasure: string }

interface PhaseKit {
  objectives: string[]
  conceptDiagram: ConceptDiagram
  theoryPoints: TheoryPoint[]
  componentsNeeded: ComponentItem[]
  teachingSteps: TeachingStep[]
  commonMistakes: string[]
  assessmentQuestions: AssessmentQ[]
  safetyNotes?: string[]
  // phase-specific
  circuitDiagram?: CircuitDiagram
  componentConnections?: PinRow[]
  designChecklist?: string[]
  assemblySteps?: AssemblyStep[]
  wiringGuide?: WiringGuide
  codeStructure?: CodeBlock[]
  variablesNeeded?: VarRow[]
  flowchart?: Flowchart
  testCases?: TestCase[]
  debuggingGuide?: DebugRow[]
  performanceMetrics?: PerfMetric[]
  presentationScript?: any
  anticipatedQuestions?: AssessmentQ[]
  demoScript?: any[]
}

// ── Concept Diagram (text-based tree) ─────────────────────────────────────────
function ConceptDiagramView({ diagram }: { diagram: ConceptDiagram }) {
  return (
    <div className="bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-100 rounded-xl p-4">
      <div className="text-center mb-3">
        <span className="inline-block bg-indigo-600 text-white text-xs font-bold px-3 py-1 rounded-full">
          {diagram.title}
        </span>
      </div>
      <div className="flex flex-wrap justify-center gap-3">
        {(diagram.nodes ?? []).map((node, i) => (
          <div key={i} className="text-center">
            <div className="bg-white border-2 border-indigo-200 rounded-lg px-3 py-2 text-xs font-semibold text-indigo-800 shadow-sm">
              {node.label}
            </div>
            {node.children && node.children.length > 0 && (
              <div className="flex gap-1.5 mt-1.5 justify-center flex-wrap">
                {node.children.map((c, j) => (
                  <div key={j} className="bg-purple-100 border border-purple-200 rounded px-2 py-0.5 text-[10px] text-purple-700">
                    {c}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
      {diagram.summary && (
        <p className="mt-3 text-xs text-indigo-700 text-center italic border-t border-indigo-100 pt-3">
          {diagram.summary}
        </p>
      )}
    </div>
  )
}

// ── Section wrapper ───────────────────────────────────────────────────────────
function KitSection({ icon: Icon, title, color = 'indigo', children }: {
  icon: any; title: string; color?: string; children: React.ReactNode
}) {
  const colors: Record<string, string> = {
    indigo: 'text-indigo-700 bg-indigo-50 border-indigo-200',
    green:  'text-green-700 bg-green-50 border-green-200',
    yellow: 'text-yellow-700 bg-yellow-50 border-yellow-200',
    blue:   'text-blue-700 bg-blue-50 border-blue-200',
    orange: 'text-orange-700 bg-orange-50 border-orange-200',
    red:    'text-red-700 bg-red-50 border-red-200',
    purple: 'text-purple-700 bg-purple-50 border-purple-200',
  }
  return (
    <div>
      <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-bold uppercase tracking-wide mb-2 ${colors[color]}`}>
        <Icon className="w-3.5 h-3.5" />
        {title}
      </div>
      {children}
    </div>
  )
}

// ── Difficulty badge ──────────────────────────────────────────────────────────
function DiffBadge({ d }: { d: string }) {
  const map: Record<string, string> = {
    easy:   'bg-green-100 text-green-700',
    medium: 'bg-yellow-100 text-yellow-700',
    hard:   'bg-red-100 text-red-700',
  }
  return <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${map[d] ?? map.medium}`}>{d}</span>
}

// ── Circuit Diagram ───────────────────────────────────────────────────────────
function CircuitDiagramView({ cd }: { cd: CircuitDiagram }) {
  return (
    <div className="space-y-3">
      <div className="font-semibold text-sm text-gray-800">{cd.title}</div>
      {cd.powerRail && (
        <div className="text-xs bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2">
          <span className="font-semibold text-yellow-700">Power Rail: </span>
          <span className="text-gray-700">{cd.powerRail}</span>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="bg-orange-50">
              <th className="text-left px-3 py-2 border border-orange-100 text-orange-800 font-semibold">From</th>
              <th className="text-left px-3 py-2 border border-orange-100 text-orange-800 font-semibold">To</th>
              <th className="text-left px-3 py-2 border border-orange-100 text-orange-800 font-semibold w-20">Wire</th>
              <th className="text-left px-3 py-2 border border-orange-100 text-orange-800 font-semibold">Note</th>
            </tr>
          </thead>
          <tbody>
            {cd.connections?.map((c, i) => (
              <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-orange-50/30'}>
                <td className="px-3 py-2 border border-orange-100 font-medium text-gray-800">{c.from}</td>
                <td className="px-3 py-2 border border-orange-100 text-gray-700">{c.to}</td>
                <td className="px-3 py-2 border border-orange-100">
                  <span className="inline-flex items-center gap-1">
                    <span className={`w-3 h-3 rounded-full border border-gray-300 shrink-0 ${
                      { red:'bg-red-500', black:'bg-gray-800', yellow:'bg-yellow-400', blue:'bg-blue-500', green:'bg-green-500', orange:'bg-orange-400', white:'bg-white', brown:'bg-amber-800' }[c.wire?.toLowerCase() ?? ''] ?? 'bg-gray-400'
                    }`} />
                    <span className="text-gray-600">{c.wire}</span>
                  </span>
                </td>
                <td className="px-3 py-2 border border-orange-100 text-gray-500 text-[11px]">{c.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {cd.schematicNotes && cd.schematicNotes.length > 0 && (
        <ul className="space-y-1">
          {cd.schematicNotes.map((n, i) => (
            <li key={i} className="text-xs text-gray-600 flex items-start gap-2">
              <span className="text-orange-400 shrink-0">⚡</span>{n}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ── Pin Connection Table ───────────────────────────────────────────────────────
function PinTable({ pins }: { pins: PinRow[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="bg-blue-50">
            <th className="text-left px-3 py-2 border border-blue-100 text-blue-800 font-semibold">Component</th>
            <th className="text-left px-3 py-2 border border-blue-100 text-blue-800 font-semibold">Pin</th>
            <th className="text-left px-3 py-2 border border-blue-100 text-blue-800 font-semibold">Connects To</th>
            <th className="text-left px-3 py-2 border border-blue-100 text-blue-800 font-semibold">Purpose</th>
          </tr>
        </thead>
        <tbody>
          {pins.map((p, i) => (
            <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-blue-50/30'}>
              <td className="px-3 py-2 border border-blue-100 font-medium text-gray-800">{p.component}</td>
              <td className="px-3 py-2 border border-blue-100 font-mono text-indigo-700">{p.pin}</td>
              <td className="px-3 py-2 border border-blue-100 text-gray-700">{p.connectsTo}</td>
              <td className="px-3 py-2 border border-blue-100 text-gray-500 text-[11px]">{p.purpose}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Assembly Steps ─────────────────────────────────────────────────────────────
function AssemblyStepsView({ steps }: { steps: AssemblyStep[] }) {
  return (
    <div className="space-y-2">
      {steps.map((s) => (
        <div key={s.stepNo} className="border border-green-100 rounded-xl p-3 bg-green-50/40">
          <div className="flex items-start gap-3">
            <div className="w-7 h-7 rounded-full bg-green-500 text-white flex items-center justify-center text-xs font-bold shrink-0">{s.stepNo}</div>
            <div className="flex-1">
              <p className="text-xs font-medium text-gray-900">{s.action}</p>
              <div className="flex flex-wrap gap-3 mt-1.5">
                {s.tool && <span className="text-[11px] text-gray-500">🔧 <strong>Tool:</strong> {s.tool}</span>}
                {s.tip  && <span className="text-[11px] text-blue-600">💡 <strong>Tip:</strong> {s.tip}</span>}
              </div>
              {s.checkAfter && (
                <div className="mt-1.5 text-[11px] bg-white border border-green-200 rounded px-2 py-1 text-green-700">
                  ✓ <strong>Verify:</strong> {s.checkAfter}
                </div>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Test Cases ─────────────────────────────────────────────────────────────────
function TestCasesView({ cases }: { cases: TestCase[] }) {
  const normal = cases.filter(c => !c.edgeCase)
  const edge   = cases.filter(c => c.edgeCase)
  return (
    <div className="space-y-4">
      {normal.length > 0 && (
        <div>
          <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-2">Normal Tests</div>
          <div className="space-y-2">
            {normal.map((tc, i) => <TestCaseCard key={i} tc={tc} />)}
          </div>
        </div>
      )}
      {edge.length > 0 && (
        <div>
          <div className="text-[10px] font-bold text-orange-500 uppercase tracking-wide mb-2">⚠ Edge Cases</div>
          <div className="space-y-2">
            {edge.map((tc, i) => <TestCaseCard key={i} tc={tc} edge />)}
          </div>
        </div>
      )}
    </div>
  )
}
function TestCaseCard({ tc, edge }: { tc: TestCase; edge?: boolean }) {
  return (
    <div className={`border rounded-xl p-3 text-xs ${edge ? 'border-orange-200 bg-orange-50/40' : 'border-gray-200 bg-white'}`}>
      <div className="font-semibold text-gray-800 mb-1.5">{tc.testName}</div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1">
        <div><span className="text-gray-400">Input:</span> <span className="text-gray-700">{tc.input}</span></div>
        <div><span className="text-gray-400">Expected:</span> <span className="text-green-700 font-medium">{tc.expectedOutput}</span></div>
      </div>
      <div className="mt-1.5 text-[11px] text-indigo-600">📋 <strong>How:</strong> {tc.howToTest}</div>
      {tc.failIndicator && <div className="mt-1 text-[11px] text-red-500">❌ <strong>Failure looks like:</strong> {tc.failIndicator}</div>}
    </div>
  )
}

// ── Debug Guide ────────────────────────────────────────────────────────────────
function DebugGuideView({ rows }: { rows: DebugRow[] }) {
  return (
    <div className="space-y-2">
      {rows.map((r, i) => (
        <div key={i} className="border border-red-100 rounded-xl p-3 bg-red-50/30">
          <div className="text-xs font-semibold text-red-700 mb-1">🔴 {r.symptom}</div>
          <div className="text-[11px] text-gray-600 mb-0.5"><strong>Cause:</strong> {r.likelyCause}</div>
          <div className="text-[11px] text-green-700 mb-0.5"><strong>Fix:</strong> {r.fix}</div>
          {r.preventionTip && <div className="text-[11px] text-blue-600"><strong>Prevent:</strong> {r.preventionTip}</div>}
        </div>
      ))}
    </div>
  )
}

// ── Code Structure ─────────────────────────────────────────────────────────────
function CodeStructureView({ blocks }: { blocks: CodeBlock[] }) {
  return (
    <div className="space-y-3">
      {blocks.map((b, i) => (
        <div key={i} className="border border-gray-200 rounded-xl p-3 bg-gray-50">
          <div className="flex items-center gap-2 mb-1.5">
            <code className="text-xs bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded font-mono font-semibold">{b.functionName}()</code>
            <span className="text-xs text-gray-500">{b.purpose}</span>
          </div>
          <pre className="text-[11px] bg-white border border-gray-100 rounded p-2 whitespace-pre-wrap text-gray-700 font-mono leading-relaxed">{b.pseudocode}</pre>
          {b.arduinoHint && (
            <div className="mt-1.5 text-[11px] text-teal-600 bg-teal-50 border border-teal-100 rounded px-2 py-1">
              🔌 Arduino: <code className="font-mono">{b.arduinoHint}</code>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// ── Main Panel ────────────────────────────────────────────────────────────────

export function PhaseKitPanel({
  projectId,
  phase,
  kit: initialKit,
  weekTopics,
  checklist,
  projectTitle,
  category,
}: {
  projectId:    string
  phase:        string
  kit?:         PhaseKit | null
  weekTopics:   string[]
  checklist:    string[]
  projectTitle: string
  category:     string
}) {
  const [kit, setKit] = useState<PhaseKit | null>(initialKit ?? null)
  const generateMutation = useGeneratePhaseKit(projectId)

  async function generate() {
    const result = await generateMutation.mutateAsync({ phase, weekTopics, checklist, projectTitle, category })
    setKit(result.kit)
  }

  function handlePrint() {
    const content = document.getElementById(`kit-print-${phase}`)
    if (!content) return
    const win = window.open('', '_blank')
    if (!win) return
    win.document.write(`
      <html><head><title>${phase} Teaching Kit - ${projectTitle}</title>
      <style>
        body { font-family: sans-serif; padding: 24px; color: #1a1a1a; }
        h1 { font-size: 20px; color: #4f46e5; margin-bottom: 4px; }
        h2 { font-size: 13px; text-transform: uppercase; letter-spacing: 0.05em; color: #6b7280; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px; margin-top: 20px; }
        h3 { font-size: 12px; font-weight: 600; margin: 8px 0 2px; }
        p, li { font-size: 12px; line-height: 1.6; margin: 2px 0; }
        table { width: 100%; border-collapse: collapse; font-size: 11px; margin-top: 6px; }
        th { background: #f3f4f6; padding: 4px 8px; text-align: left; border: 1px solid #e5e7eb; }
        td { padding: 4px 8px; border: 1px solid #e5e7eb; vertical-align: top; }
        .badge { display: inline-block; padding: 1px 6px; border-radius: 9999px; font-size: 10px; font-weight: 600; }
        .easy { background: #dcfce7; color: #166534; }
        .medium { background: #fef9c3; color: #854d0e; }
        .hard { background: #fee2e2; color: #991b1b; }
        @media print { body { padding: 10px; } }
      </style></head>
      <body>${content.innerHTML}</body></html>
    `)
    win.document.close()
    win.print()
  }

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden bg-white">
      {/* Generating overlay */}
      {generateMutation.isPending && (
        <div className="flex items-center gap-2 px-4 py-3 bg-indigo-50 border-b border-indigo-100 text-xs text-indigo-700">
          <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />
          AI is preparing your teaching kit for <strong>{phase}</strong>…
        </div>
      )}

      <div className="p-4 space-y-5">
          {!kit ? (
            <div className="py-8 text-center">
              <Sparkles className="w-8 h-8 mx-auto mb-2 text-indigo-300" />
              <p className="text-sm text-gray-500 font-medium">No kit generated yet</p>
              <p className="text-xs text-gray-400 mt-1 mb-4">
                Click "AI Generate" to create a complete teaching kit for this phase
              </p>
              <button
                type="button"
                onClick={generate}
                disabled={generateMutation.isPending}
                className="btn-primary inline-flex items-center gap-1.5 text-sm"
              >
                {generateMutation.isPending
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating…</>
                  : <><Sparkles className="w-4 h-4" /> Generate Teaching Kit</>
                }
              </button>
            </div>
          ) : (
            <>
              {/* Print / Regenerate toolbar */}
              <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                <h3 className="font-bold text-gray-900 text-sm">{phase} — Teaching Kit</h3>
                <div className="flex gap-2">
                  <button
                    type="button"
                    title="Regenerate kit"
                    onClick={generate}
                    disabled={generateMutation.isPending}
                    className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 border border-indigo-200 px-2 py-1 rounded-lg"
                  >
                    <Sparkles className="w-3 h-3" />
                    {generateMutation.isPending ? 'Regenerating…' : 'Regenerate'}
                  </button>
                  <button
                    type="button"
                    title="Print teaching kit"
                    onClick={handlePrint}
                    className="flex items-center gap-1 text-xs text-gray-600 hover:text-gray-800 border border-gray-200 px-2 py-1 rounded-lg"
                  >
                    <Printer className="w-3 h-3" />
                    Print
                  </button>
                </div>
              </div>

              {/* Printable area */}
              <div id={`kit-print-${phase}`} className="space-y-5">

                {/* Print header (visible only in print) */}
                <div className="hidden print:block mb-4">
                  <h1>{phase} Teaching Kit — {projectTitle}</h1>
                  <p className="text-xs text-gray-500">Category: {category} · Topics: {weekTopics.join(', ')}</p>
                </div>

                {/* Objectives */}
                {kit.objectives?.length > 0 && (
                  <KitSection icon={Target} title="Learning Objectives" color="indigo">
                    <ul className="space-y-1">
                      {kit.objectives.map((o, i) => (
                        <li key={i} className="flex items-start gap-2 text-xs text-gray-700">
                          <CheckCircle2 className="w-3.5 h-3.5 text-indigo-400 shrink-0 mt-0.5" />
                          {o}
                        </li>
                      ))}
                    </ul>
                  </KitSection>
                )}

                {/* Concept Diagram */}
                {kit.conceptDiagram && (
                  <KitSection icon={Layers} title="Concept Diagram" color="purple">
                    <ConceptDiagramView diagram={kit.conceptDiagram} />
                  </KitSection>
                )}

                {/* Theory Points */}
                {kit.theoryPoints?.length > 0 && (
                  <KitSection icon={BookOpen} title="Theory to Cover" color="blue">
                    <div className="space-y-3">
                      {kit.theoryPoints.map((tp, i) => (
                        <div key={i} className="border border-blue-100 rounded-lg p-3 bg-blue-50/50">
                          <div className="font-semibold text-xs text-blue-800 mb-1">{tp.topic}</div>
                          <p className="text-xs text-gray-700 mb-1">{tp.explanation}</p>
                          <p className="text-[11px] text-blue-600 italic">💡 Example: {tp.example}</p>
                        </div>
                      ))}
                    </div>
                  </KitSection>
                )}

                {/* Components */}
                {kit.componentsNeeded?.length > 0 && (
                  <KitSection icon={Package} title="Components & Materials Needed" color="green">
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-green-50 border border-green-100">
                            <th className="text-left px-3 py-1.5 font-semibold text-green-800 border-r border-green-100">Component</th>
                            <th className="text-left px-3 py-1.5 font-semibold text-green-800 border-r border-green-100 w-14">Qty</th>
                            <th className="text-left px-3 py-1.5 font-semibold text-green-800 border-r border-green-100">Purpose</th>
                            <th className="text-left px-3 py-1.5 font-semibold text-green-800">If Unavailable</th>
                          </tr>
                        </thead>
                        <tbody>
                          {kit.componentsNeeded.map((c, i) => (
                            <tr key={i} className={`border border-green-100 ${i % 2 === 0 ? 'bg-white' : 'bg-green-50/30'}`}>
                              <td className="px-3 py-1.5 font-medium text-gray-800 border-r border-green-100">{c.name}</td>
                              <td className="px-3 py-1.5 text-gray-600 border-r border-green-100 text-center">{c.qty}</td>
                              <td className="px-3 py-1.5 text-gray-600 border-r border-green-100">{c.purpose}</td>
                              <td className="px-3 py-1.5 text-gray-400 italic text-[11px]">{c.alternativeIfMissing ?? '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </KitSection>
                )}

                {/* Teaching Steps */}
                {kit.teachingSteps?.length > 0 && (
                  <KitSection icon={ListChecks} title="Step-by-Step Teaching Plan" color="yellow">
                    <div className="space-y-2">
                      {kit.teachingSteps.map((s) => (
                        <div key={s.step} className="flex gap-3 border border-yellow-100 rounded-lg p-3 bg-yellow-50/40">
                          <div className="w-7 h-7 rounded-full bg-yellow-400 text-white flex items-center justify-center text-xs font-bold shrink-0">
                            {s.step}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-semibold text-xs text-gray-900">{s.title}</span>
                              <span className="text-[10px] bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded">{s.duration}</span>
                            </div>
                            <p className="text-[11px] text-gray-600"><strong>Teacher:</strong> {s.activity}</p>
                            <p className="text-[11px] text-indigo-600 mt-0.5"><strong>Students:</strong> {s.studentAction}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </KitSection>
                )}

                {/* Common Mistakes */}
                {kit.commonMistakes?.length > 0 && (
                  <KitSection icon={AlertTriangle} title="Common Mistakes to Warn About" color="orange">
                    <ul className="space-y-1">
                      {kit.commonMistakes.map((m, i) => (
                        <li key={i} className="flex items-start gap-2 text-xs text-gray-700">
                          <AlertTriangle className="w-3.5 h-3.5 text-orange-400 shrink-0 mt-0.5" />
                          {m}
                        </li>
                      ))}
                    </ul>
                  </KitSection>
                )}

                {/* Assessment Questions */}
                {kit.assessmentQuestions?.length > 0 && (
                  <KitSection icon={HelpCircle} title="Assessment Questions" color="indigo">
                    <div className="space-y-2">
                      {kit.assessmentQuestions.map((q, i) => (
                        <div key={i} className="border border-indigo-100 rounded-lg p-3 bg-indigo-50/40">
                          <div className="flex items-start gap-2">
                            <DiffBadge d={q.difficulty} />
                            <p className="text-xs font-medium text-gray-800 flex-1">{q.question}</p>
                          </div>
                          <p className="text-[11px] text-gray-500 mt-1.5 pl-0.5">
                            <strong>Answer:</strong> {q.answer}
                          </p>
                        </div>
                      ))}
                    </div>
                  </KitSection>
                )}

                {/* Safety Notes */}
                {kit.safetyNotes && kit.safetyNotes.length > 0 && (
                  <KitSection icon={ShieldAlert} title="Safety Notes" color="red">
                    <ul className="space-y-1">
                      {kit.safetyNotes.map((n, i) => (
                        <li key={i} className="flex items-start gap-2 text-xs text-gray-700">
                          <ShieldAlert className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
                          {n}
                        </li>
                      ))}
                    </ul>
                  </KitSection>
                )}

                {/* ── DESIGN phase ── Circuit Diagram */}
                {kit.circuitDiagram && (
                  <KitSection icon={Zap} title="Circuit Diagram & Connections" color="orange">
                    <CircuitDiagramView cd={kit.circuitDiagram} />
                  </KitSection>
                )}

                {/* Pin-by-pin connection table (design + build) */}
                {kit.componentConnections && kit.componentConnections.length > 0 && (
                  <KitSection icon={Cpu} title="Pin-by-Pin Connection Table" color="blue">
                    <PinTable pins={kit.componentConnections} />
                  </KitSection>
                )}

                {/* Design checklist */}
                {kit.designChecklist && kit.designChecklist.length > 0 && (
                  <KitSection icon={ListChecks} title="Design Verification Checklist" color="indigo">
                    <ul className="space-y-1">
                      {kit.designChecklist.map((item, i) => (
                        <li key={i} className="flex items-start gap-2 text-xs text-gray-700">
                          <CheckCircle2 className="w-3.5 h-3.5 text-indigo-400 shrink-0 mt-0.5" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </KitSection>
                )}

                {/* ── BUILD phase ── Assembly Steps */}
                {kit.assemblySteps && kit.assemblySteps.length > 0 && (
                  <KitSection icon={Layers} title="Step-by-Step Assembly" color="green">
                    <AssemblyStepsView steps={kit.assemblySteps} />
                  </KitSection>
                )}

                {/* Wiring guide (build) */}
                {kit.wiringGuide && (
                  <KitSection icon={Zap} title="Wiring Guide" color="yellow">
                    <div className="space-y-3">
                      {kit.wiringGuide.sequence && kit.wiringGuide.sequence.length > 0 && (
                        <div>
                          <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1.5">Connection Sequence</div>
                          <ol className="space-y-1 list-decimal list-inside">
                            {kit.wiringGuide.sequence.map((s, i) => (
                              <li key={i} className="text-xs text-gray-700">{s}</li>
                            ))}
                          </ol>
                        </div>
                      )}
                      {kit.wiringGuide.colourCode && Object.keys(kit.wiringGuide.colourCode).length > 0 && (
                        <div>
                          <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1.5">Wire Colour Code</div>
                          <div className="flex flex-wrap gap-2">
                            {Object.entries(kit.wiringGuide.colourCode).map(([colour, meaning]) => (
                              <div key={colour} className="flex items-center gap-1.5 bg-white border border-gray-200 rounded-lg px-2 py-1">
                                <span className={`w-3 h-3 rounded-full border border-gray-300 ${{ red:'bg-red-500', black:'bg-gray-800', yellow:'bg-yellow-400', blue:'bg-blue-500', green:'bg-green-500', orange:'bg-orange-400', white:'bg-white', brown:'bg-amber-800' }[colour.toLowerCase()] ?? 'bg-gray-400'}`} />
                                <span className="text-[11px] font-medium text-gray-700 capitalize">{colour}</span>
                                <span className="text-[11px] text-gray-400">= {meaning}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {kit.wiringGuide.pitfalls && kit.wiringGuide.pitfalls.length > 0 && (
                        <div>
                          <div className="text-[10px] font-bold text-orange-500 uppercase tracking-wide mb-1.5">⚠ Wiring Pitfalls</div>
                          <ul className="space-y-1">
                            {kit.wiringGuide.pitfalls.map((p, i) => (
                              <li key={i} className="text-xs text-gray-700 flex items-start gap-2">
                                <AlertTriangle className="w-3.5 h-3.5 text-orange-400 shrink-0 mt-0.5" />{p}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </KitSection>
                )}

                {/* ── CODE phase ── */}
                {kit.codeStructure && kit.codeStructure.length > 0 && (
                  <KitSection icon={Cpu} title="Code Structure" color="purple">
                    <CodeStructureView blocks={kit.codeStructure} />
                  </KitSection>
                )}
                {kit.variablesNeeded && kit.variablesNeeded.length > 0 && (
                  <KitSection icon={ListChecks} title="Variables Needed" color="indigo">
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs border-collapse">
                        <thead>
                          <tr className="bg-indigo-50">
                            {['Variable', 'Type', 'Purpose', 'Initial Value'].map(h => (
                              <th key={h} className="text-left px-3 py-2 border border-indigo-100 text-indigo-800 font-semibold">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {kit.variablesNeeded.map((v, i) => (
                            <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-indigo-50/30'}>
                              <td className="px-3 py-2 border border-indigo-100 font-mono text-indigo-700">{v.name}</td>
                              <td className="px-3 py-2 border border-indigo-100 text-gray-600">{v.type}</td>
                              <td className="px-3 py-2 border border-indigo-100 text-gray-700">{v.purpose}</td>
                              <td className="px-3 py-2 border border-indigo-100 font-mono text-gray-500">{v.initialValue ?? '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </KitSection>
                )}
                {kit.flowchart && (
                  <KitSection icon={Layers} title="Program Flow" color="blue">
                    <div className="space-y-3">
                      <div className="bg-blue-50 border border-blue-100 rounded-lg px-3 py-2 text-xs">
                        <span className="font-semibold text-blue-700">On Power-Up: </span>
                        <span className="text-gray-700">{kit.flowchart.start}</span>
                      </div>
                      <div>
                        <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1.5">Main Loop</div>
                        <ol className="space-y-1 list-decimal list-inside">
                          {kit.flowchart.loop.map((step, i) => (
                            <li key={i} className="text-xs text-gray-700">{step}</li>
                          ))}
                        </ol>
                      </div>
                      {kit.flowchart.conditions && kit.flowchart.conditions.length > 0 && (
                        <div>
                          <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1.5">Conditions</div>
                          <div className="space-y-1.5">
                            {kit.flowchart.conditions.map((c, i) => (
                              <div key={i} className="text-[11px] bg-white border border-gray-100 rounded px-2 py-1.5">
                                <span className="text-purple-600 font-semibold">IF </span><span className="text-gray-700">{c.if}</span>
                                <span className="text-green-600 font-semibold"> → </span><span className="text-gray-700">{c.then}</span>
                                {c.else && <><span className="text-orange-500 font-semibold"> ELSE </span><span className="text-gray-500">{c.else}</span></>}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </KitSection>
                )}

                {/* ── TEST phase ── */}
                {kit.testCases && kit.testCases.length > 0 && (
                  <KitSection icon={ListChecks} title="Test Cases & Edge Cases" color="yellow">
                    <TestCasesView cases={kit.testCases} />
                  </KitSection>
                )}
                {kit.debuggingGuide && kit.debuggingGuide.length > 0 && (
                  <KitSection icon={AlertTriangle} title="Debugging Guide" color="red">
                    <DebugGuideView rows={kit.debuggingGuide} />
                  </KitSection>
                )}
                {kit.performanceMetrics && kit.performanceMetrics.length > 0 && (
                  <KitSection icon={Target} title="Performance Targets" color="green">
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs border-collapse">
                        <thead>
                          <tr className="bg-green-50">
                            {['Metric', 'Unit', 'Target', 'How to Measure'].map(h => (
                              <th key={h} className="text-left px-3 py-2 border border-green-100 text-green-800 font-semibold">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {kit.performanceMetrics.map((m, i) => (
                            <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-green-50/30'}>
                              <td className="px-3 py-2 border border-green-100 font-medium text-gray-800">{m.metric}</td>
                              <td className="px-3 py-2 border border-green-100 text-gray-500">{m.unit}</td>
                              <td className="px-3 py-2 border border-green-100 text-green-700 font-semibold">{m.targetValue}</td>
                              <td className="px-3 py-2 border border-green-100 text-gray-600">{m.howToMeasure}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </KitSection>
                )}

              </div>
            </>
          )}
      </div>
    </div>
  )
}
