import { useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { aiApi } from '@/lib/api'
import { useUsers, useSetAiAccess } from '@/hooks/useApi'
import { useAuthStore } from '@/store/auth.store'
import {
  Sparkles, Send, RefreshCw, CheckCircle, XCircle, Clock, AlertTriangle,
  Search, Copy, MessageCircle, Tag, TrendingUp, Users, ShieldAlert,
  FileText, Bot, ChevronDown, ChevronUp, ArrowUpRight, ArrowDownRight, ToggleLeft, ToggleRight,
} from 'lucide-react'
import toast from 'react-hot-toast'

const AI_ERR = (e: any) =>
  e?.response?.data?.message ?? 'AI call failed. Check your API key in .env.'

function buildWhatsAppLink(phone: string | null | undefined, message: string): string | null {
  if (!phone) return null
  const digits = phone.replace(/\D/g, '')
  const wa = digits.length === 10 ? `91${digits}` : digits
  return `https://wa.me/${wa}?text=${encodeURIComponent(message)}`
}

// ── Section wrapper ───────────────────────────────────────────────────────────
function Section({
  icon: Icon, title, description, children, defaultOpen = true,
}: {
  icon: React.ElementType
  title: string
  description: string
  children: React.ReactNode
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="bg-white rounded-xl border border-gray-200">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between p-6 text-left"
      >
        <div className="flex items-center gap-2">
          <Icon className="w-5 h-5 text-primary-600 flex-shrink-0" />
          <div>
            <h2 className="text-base font-semibold text-gray-900">{title}</h2>
            <p className="text-sm text-gray-500">{description}</p>
          </div>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </button>
      {open && <div className="px-6 pb-6">{children}</div>}
    </div>
  )
}

// ── 1. Expense Categorizer ────────────────────────────────────────────────────
function ExpenseCategorizer() {
  const [desc, setDesc] = useState('')
  const [amount, setAmount] = useState('')
  const [result, setResult] = useState<any>(null)

  const categorize = useMutation({
    mutationFn: () => aiApi.categorizeExpense(desc, Number(amount)),
    onSuccess:  (data) => setResult(data),
  })

  const catColors: Record<string, string> = {
    rent: 'bg-blue-100 text-blue-700', electricity: 'bg-yellow-100 text-yellow-700',
    salaries: 'bg-purple-100 text-purple-700', fuel_transport: 'bg-orange-100 text-orange-700',
    marketing: 'bg-pink-100 text-pink-700', repairs_maintenance: 'bg-red-100 text-red-700',
    bank_charges: 'bg-gray-100 text-gray-700', purchases: 'bg-green-100 text-green-700',
  }

  return (
    <Section icon={Tag} title="Expense Categorizer" description="Paste expense description → AI tags it with category and GL code" defaultOpen={false}>
      <div className="flex gap-2 flex-wrap">
        <input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder='e.g. "Laundry service for banquet linen"' className="input flex-1 min-w-48" />
        <input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Amount ₹" type="number" className="input w-32" />
        <button type="button" onClick={() => categorize.mutate()} disabled={!desc.trim() || !amount || categorize.isPending} className="btn-primary">
          {categorize.isPending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Tag className="w-4 h-4" />}
        </button>
      </div>
      {categorize.isError && <p className="mt-3 text-sm text-red-600">{AI_ERR(categorize.error)}</p>}
      {result && (
        <div className="mt-4 flex items-center gap-3 flex-wrap">
          <span className={`text-sm font-medium px-3 py-1 rounded-full capitalize ${catColors[result.category] ?? 'bg-gray-100 text-gray-700'}`}>
            {result.category.replace(/_/g, ' ')}
          </span>
          {result.suggestedGlCode && <span className="text-xs text-gray-500 font-mono">GL {result.suggestedGlCode}</span>}
          <span className={`text-xs px-2 py-0.5 rounded-full ${result.confidence >= 0.8 ? 'bg-green-50 text-green-600' : 'bg-yellow-50 text-yellow-600'}`}>{Math.round(result.confidence * 100)}% confident</span>
          <p className="w-full text-sm text-gray-600">{result.reason}</p>
        </div>
      )}
    </Section>
  )
}

// ── 2. Cash Flow Forecast ─────────────────────────────────────────────────────
function CashflowForecastSection() {
  const [horizon, setHorizon] = useState<7 | 30>(7)

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['ai-cashflow', horizon],
    queryFn:  () => aiApi.cashflowForecast(horizon),
    staleTime: 5 * 60 * 1000,
  })

  const totalIn  = data?.days.reduce((s: number, d: any) => s + d.projectedInflow,  0) ?? 0
  const totalOut = data?.days.reduce((s: number, d: any) => s + d.projectedOutflow, 0) ?? 0
  const totalNet = totalIn - totalOut

  return (
    <Section icon={TrendingUp} title="Cash Flow Forecast" description="AI-projected inflows and outflows for the next 7 or 30 days" defaultOpen={false}>
      <div className="flex items-center gap-3 mb-4">
        <div className="flex rounded-lg border border-gray-200 overflow-hidden">
          {([7, 30] as const).map((h) => (
            <button key={h} type="button" onClick={() => setHorizon(h)}
              className={`px-4 py-1.5 text-sm font-medium ${horizon === h ? 'bg-primary-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}>
              {h} days
            </button>
          ))}
        </div>
        <button type="button" onClick={() => refetch()} disabled={isLoading} className="text-gray-400 hover:text-gray-600">
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {isError && <p className="text-sm text-red-600">{AI_ERR(error)}</p>}

      {data && (
        <div className="space-y-4">
          {/* Summary tiles */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Projected Inflow',  val: totalIn,  icon: ArrowUpRight,   color: 'text-green-600' },
              { label: 'Projected Outflow', val: totalOut, icon: ArrowDownRight,  color: 'text-red-600' },
              { label: 'Net Cash Flow',     val: totalNet, icon: TrendingUp,      color: totalNet >= 0 ? 'text-green-600' : 'text-red-600' },
            ].map(({ label, val, icon: Icon, color }) => (
              <div key={label} className="bg-gray-50 rounded-lg p-3">
                <div className="flex items-center gap-1 mb-1">
                  <Icon className={`w-3.5 h-3.5 ${color}`} />
                  <span className="text-xs text-gray-500">{label}</span>
                </div>
                <p className={`text-lg font-bold ${color}`}>₹{Math.abs(val).toLocaleString('en-IN')}</p>
              </div>
            ))}
          </div>

          {/* AI narrative */}
          {data.summary && <p className="text-sm text-gray-700 bg-blue-50 border border-blue-100 rounded-lg p-3">{data.summary}</p>}

          {/* Risks */}
          {data.topRisks?.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Key Risks</p>
              {data.topRisks.map((r: string, i: number) => (
                <div key={i} className="flex items-start gap-2 text-sm text-orange-700">
                  <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                  {r}
                </div>
              ))}
            </div>
          )}

          {/* Daily bar overview */}
          <div className="space-y-1.5 max-h-48 overflow-y-auto">
            {data.days.slice(0, 14).map((d: any) => {
              const max = Math.max(d.projectedInflow, d.projectedOutflow, 1)
              return (
                <div key={d.date} className="flex items-center gap-2 text-xs">
                  <span className="w-20 text-gray-500 flex-shrink-0">{d.date.slice(5)}</span>
                  <div className="flex-1 flex flex-col gap-0.5">
                    <div className="h-1.5 bg-green-200 rounded-full" style={{ width: `${(d.projectedInflow / max) * 100}%` }} />
                    <div className="h-1.5 bg-red-200 rounded-full"   style={{ width: `${(d.projectedOutflow / max) * 100}%` }} />
                  </div>
                  <span className={`w-16 text-right font-medium ${d.netCashflow >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                    {d.netCashflow >= 0 ? '+' : ''}₹{(d.netCashflow / 1000).toFixed(1)}k
                  </span>
                  <span className={`w-12 text-center text-xs px-1 rounded ${d.confidence === 'high' ? 'bg-green-50 text-green-600' : d.confidence === 'medium' ? 'bg-yellow-50 text-yellow-600' : 'bg-gray-50 text-gray-400'}`}>{d.confidence}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </Section>
  )
}

// ── 3. Guest Duplicates ───────────────────────────────────────────────────────
function GuestDuplicates() {
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['ai-party-duplicates'],
    queryFn:  aiApi.partyDuplicates,
    staleTime: 10 * 60 * 1000,
  })

  return (
    <Section icon={Users} title="Duplicate Guest Detector" description="Find guests entered twice — same phone, ID number, or similar name" defaultOpen={false}>
      <button type="button" onClick={() => refetch()} disabled={isLoading} className="btn-primary mb-4">
        {isLoading ? <><RefreshCw className="w-4 h-4 animate-spin" /> Scanning...</> : <><Search className="w-4 h-4" /> Scan for Duplicates</>}
      </button>

      {isError && <p className="text-sm text-red-600">{AI_ERR(error)}</p>}

      {data?.length === 0 && <p className="text-sm text-green-600 flex items-center gap-1"><CheckCircle className="w-4 h-4" /> No duplicates found — your guest list looks clean.</p>}

      {data?.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm text-orange-700">{data.length} duplicate group{data.length > 1 ? 's' : ''} found</p>
          {data.map((g: any, i: number) => (
            <div key={i} className="border border-orange-200 bg-orange-50 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="w-4 h-4 text-orange-600 flex-shrink-0" />
                <span className="text-sm font-medium text-orange-800">{g.reason}</span>
                <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${g.confidence >= 0.9 ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>{Math.round(g.confidence * 100)}% sure</span>
              </div>
              <div className="space-y-1">
                {g.names.map((name: string, j: number) => (
                  <div key={j} className="flex items-center gap-2 text-sm text-gray-700">
                    <span className="w-1.5 h-1.5 rounded-full bg-orange-400 flex-shrink-0" />
                    <span className="font-medium">{name}</span>
                    <span className="text-xs text-gray-400 font-mono">{g.ids[j]?.slice(0, 8)}…</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </Section>
  )
}

// ── 4. GST Filing Summary ─────────────────────────────────────────────────────
function GstSummary() {
  const thisMonth = new Date().toISOString().slice(0, 7)
  const [month, setMonth] = useState(thisMonth)

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['ai-gst-summary', month],
    queryFn:  () => aiApi.gstSummaryAI(month),
    enabled:  false,
    staleTime: 5 * 60 * 1000,
  })

  const fmt = (n: number) => `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`

  return (
    <Section icon={FileText} title="GST Filing Summary" description="Structured B2B / B2C / ITC breakdown for a month" defaultOpen={false}>
      <div className="flex gap-2 mb-4">
        <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} max={thisMonth} className="input" />
        <button type="button" onClick={() => refetch()} disabled={isLoading} className="btn-primary">
          {isLoading ? <><RefreshCw className="w-4 h-4 animate-spin" /> Computing...</> : 'Generate Summary'}
        </button>
      </div>

      {isError && <p className="text-sm text-red-600">{AI_ERR(error)}</p>}

      {data && (
        <div className="space-y-4">
          {data.aiSummary && <p className="text-sm text-gray-700 bg-blue-50 border border-blue-100 rounded-lg p-3">{data.aiSummary}</p>}

          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'B2B Sales (registered)',   d: data.b2b,       color: 'bg-green-50 border-green-200' },
              { label: 'B2C Sales (unregistered)', d: data.b2c,       color: 'bg-blue-50 border-blue-200' },
              { label: 'Purchases (ITC)',          d: data.purchases, color: 'bg-orange-50 border-orange-200' },
            ].map(({ label, d, color }) => (
              <div key={label} className={`rounded-lg border p-3 text-sm ${color}`}>
                <p className="font-medium text-gray-700 mb-2">{label}</p>
                <div className="space-y-1 text-gray-600">
                  <div className="flex justify-between"><span>Taxable</span><span>{fmt(d.taxable)}</span></div>
                  <div className="flex justify-between"><span>IGST</span><span>{fmt(d.igst)}</span></div>
                  <div className="flex justify-between"><span>CGST</span><span>{fmt(d.cgst)}</span></div>
                  <div className="flex justify-between"><span>SGST</span><span>{fmt(d.sgst)}</span></div>
                  {d.count !== undefined && <div className="flex justify-between text-gray-400 text-xs pt-1"><span>Invoices</span><span>{d.count}</span></div>}
                </div>
              </div>
            ))}

            <div className="rounded-lg border border-primary-200 bg-primary-50 p-3 text-sm">
              <p className="font-medium text-primary-700 mb-2">Net GST Payable</p>
              <p className="text-2xl font-bold text-primary-700">{fmt(data.netGstPayable)}</p>
              <p className="text-xs text-primary-500 mt-1">Output GST − ITC</p>
            </div>
          </div>

          {data.b2b.invoices?.length > 0 && (
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">B2B Registered Buyers</p>
              <div className="divide-y divide-gray-100 border border-gray-200 rounded-lg overflow-hidden text-sm">
                {data.b2b.invoices.map((inv: any, i: number) => (
                  <div key={i} className="flex items-center justify-between px-4 py-2.5">
                    <div>
                      <span className="font-medium text-gray-900">{inv.partyName}</span>
                      <span className="ml-2 text-xs text-gray-400 font-mono">{inv.gstin}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-gray-700">{fmt(inv.taxable)}</span>
                      <span className="text-gray-400 text-xs ml-2">GST {fmt(inv.igst + inv.cgst + inv.sgst)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </Section>
  )
}

// ── 5. Credit Risk ────────────────────────────────────────────────────────────
function CreditRiskChecker() {
  const [partyId, setPartyId] = useState('')
  const [activeId, setActiveId] = useState('')
  const { data: risk, isLoading, isError } = useQuery({
    queryKey: ['ai-credit-risk', activeId],
    queryFn:  () => aiApi.creditRisk(activeId),
    enabled:  !!activeId,
    retry: false,
  })
  const labelColor: Record<string, string> = {
    excellent: 'bg-green-100 text-green-700', good: 'bg-blue-100 text-blue-700',
    fair: 'bg-yellow-100 text-yellow-700', poor: 'bg-orange-100 text-orange-700',
    high_risk: 'bg-red-100 text-red-700',
  }
  return (
    <Section icon={ShieldAlert} title="Corporate Account Credit Risk" description="AI credit score from payment history — paste a corporate/agent account ID to check" defaultOpen={false}>
      <div className="flex gap-2">
        <input value={partyId} onChange={(e) => setPartyId(e.target.value)} placeholder="Paste account UUID…" className="input flex-1 text-xs font-mono" />
        <button type="button" onClick={() => setActiveId(partyId.trim())} disabled={!partyId.trim() || isLoading} className="btn-primary px-4">
          {isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Check'}
        </button>
      </div>
      {isError && <p className="mt-3 text-sm text-red-600">Could not load. Check the party ID.</p>}
      {risk && (
        <div className="mt-5 space-y-3">
          <div className="flex items-center gap-3">
            <div className="text-3xl font-bold text-gray-900">{risk.score}<span className="text-lg text-gray-400">/100</span></div>
            <span className={`text-sm font-medium px-3 py-1 rounded-full capitalize ${labelColor[risk.label] ?? ''}`}>{risk.label?.replace('_', ' ')}</span>
          </div>
          <p className="text-sm text-gray-600">{risk.summary}</p>
          {risk.factors?.length > 0 && (
            <ul className="space-y-1">
              {risk.factors.map((f: string, i: number) => (
                <li key={i} className="text-xs text-gray-500 flex items-start gap-1.5"><span className="mt-0.5 w-1.5 h-1.5 rounded-full bg-gray-300 flex-shrink-0" />{f}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Section>
  )
}

// ── 6. Payment Reminders ──────────────────────────────────────────────────────
function PaymentReminders() {
  const queryClient = useQueryClient()
  const { data: pending, isLoading } = useQuery({ queryKey: ['ai-reminders'], queryFn: aiApi.pendingReminders })
  const generate = useMutation({ mutationFn: aiApi.generateReminders, onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ai-reminders'] }) })
  const approve  = useMutation({ mutationFn: (id: string) => aiApi.approveReminder(id), onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ai-reminders'] }) })
  const reject   = useMutation({ mutationFn: (id: string) => aiApi.rejectReminder(id),  onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ai-reminders'] }) })

  return (
    <Section icon={Clock} title="Payment Reminders" description="AI drafts WhatsApp reminders for overdue guest and corporate account balances" defaultOpen={false}>
      <div className="flex items-center justify-between mb-4">
        <button type="button" onClick={() => generate.mutate()} disabled={generate.isPending} className="btn-primary text-xs px-3 py-1.5">
          {generate.isPending ? <><RefreshCw className="w-3 h-3 animate-spin" /> Generating...</> : <><Sparkles className="w-3 h-3" /> Generate Drafts</>}
        </button>
        {generate.data && <p className="text-sm text-green-600">Generated {generate.data.generated} draft{generate.data.generated !== 1 ? 's' : ''}.</p>}
      </div>
      {generate.isError && <p className="mb-4 text-sm text-red-600">{AI_ERR(generate.error)}</p>}
      {isLoading && <p className="text-sm text-gray-400">Loading…</p>}
      {!isLoading && pending?.length === 0 && <p className="text-sm text-gray-400 text-center py-6">No pending reminders — click "Generate Drafts".</p>}
      <div className="space-y-3">
        {pending?.map((r: any) => (
          <div key={r.id} className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="text-sm font-medium text-gray-900">{r.payload.partyName}</span>
                  <span className="text-xs text-gray-500">{r.payload.phone}</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${r.payload.daysOverdue >= 30 ? 'bg-red-100 text-red-700' : r.payload.daysOverdue >= 15 ? 'bg-orange-100 text-orange-700' : 'bg-yellow-100 text-yellow-700'}`}>{r.payload.daysOverdue}d overdue</span>
                </div>
                <p className="text-sm text-gray-600 mb-1">Balance: <span className="font-medium">₹{r.payload.balance?.toFixed(0)}</span></p>
                <div className="bg-gray-50 rounded-md p-3 text-sm text-gray-700 whitespace-pre-wrap">{r.payload.draft?.message}</div>
              </div>
              <div className="flex flex-col gap-2 flex-shrink-0">
                {(() => { const link = buildWhatsAppLink(r.payload.phone, r.payload.draft?.message ?? ''); return link ? (<a href={link} target="_blank" rel="noopener noreferrer" onClick={() => approve.mutate(r.id)} className="flex items-center gap-1 text-xs text-white bg-green-600 hover:bg-green-700 px-3 py-1.5 rounded-md font-medium"><MessageCircle className="w-3.5 h-3.5" /> WhatsApp</a>) : null })()}
                <button type="button" onClick={() => { navigator.clipboard.writeText(r.payload.draft?.message ?? ''); toast.success('Copied') }} className="flex items-center gap-1 text-xs text-gray-600 bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-md font-medium"><Copy className="w-3.5 h-3.5" /> Copy</button>
                <button type="button" onClick={() => reject.mutate(r.id)} className="flex items-center gap-1 text-xs text-red-700 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-md font-medium"><XCircle className="w-3.5 h-3.5" /> Discard</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </Section>
  )
}

// ── 7. Chat Assistant ────────────────────────────────────────────────────────
function ChatAssistant() {
  const [history, setHistory] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([])
  const [input, setInput] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  const chat = useMutation({
    mutationFn: ({ question, hist }: { question: string; hist: typeof history }) =>
      aiApi.chat(question, hist),
    onSuccess: (data, vars) => {
      setHistory((h) => [
        ...h,
        { role: 'user', content: vars.question },
        { role: 'assistant', content: data.answer },
      ])
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
    },
  })

  function send() {
    if (!input.trim() || chat.isPending) return
    const q = input.trim()
    setInput('')
    chat.mutate({ question: q, hist: history })
  }

  const starters = [
    'Aaj kitni occupancy hai?',
    'Which bookings check out today?',
    'Who has pending advance dues?',
    'Last month ka revenue kya tha?',
  ]

  return (
    <Section icon={Bot} title="Chat Assistant" description="Ask anything about your business in Hindi or English" defaultOpen>
      <div className="flex flex-col gap-3">
        {/* Starter chips */}
        {history.length === 0 && (
          <div className="flex flex-wrap gap-2">
            {starters.map((s) => (
              <button key={s} type="button" onClick={() => { setInput(s); }} className="text-xs px-3 py-1.5 rounded-full border border-gray-200 text-gray-600 hover:bg-gray-50">
                {s}
              </button>
            ))}
          </div>
        )}

        {/* Conversation */}
        {history.length > 0 && (
          <div className="space-y-3 max-h-80 overflow-y-auto border border-gray-100 rounded-lg p-4 bg-gray-50">
            {history.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-sm whitespace-pre-wrap ${m.role === 'user' ? 'bg-primary-600 text-white rounded-br-sm' : 'bg-white border border-gray-200 text-gray-800 rounded-bl-sm'}`}>
                  {m.content}
                </div>
              </div>
            ))}
            {chat.isPending && (
              <div className="flex justify-start">
                <div className="bg-white border border-gray-200 rounded-2xl rounded-bl-sm px-4 py-2.5 text-sm text-gray-400 flex items-center gap-1.5">
                  <RefreshCw className="w-3 h-3 animate-spin" /> Thinking…
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        )}

        {chat.isError && <p className="text-sm text-red-600">{AI_ERR(chat.error)}</p>}

        {/* Input */}
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
            placeholder="Ask about your business…"
            disabled={chat.isPending}
            className="input flex-1"
          />
          <button type="button" onClick={send} disabled={!input.trim() || chat.isPending} className="btn-primary px-4">
            <Send className="w-4 h-4" />
          </button>
          {history.length > 0 && (
            <button type="button" onClick={() => setHistory([])} className="px-3 py-2 rounded-lg border border-gray-200 text-xs text-gray-500 hover:bg-gray-50">
              Clear
            </button>
          )}
        </div>
      </div>
    </Section>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────
// ── AI access management — owner/super_user only ──────────────────────────────
// Grants or revokes individual staff members' access to this whole page.
// Owner and super_user always have access regardless of this list.
function AiAccessManager() {
  const { data } = useUsers()
  const setAiAccess = useSetAiAccess()
  const users: any[] = (data as any)?.users ?? []
  const toggleable = users.filter((u) => u.role !== 'owner' && u.role !== 'super_user')

  if (toggleable.length === 0) return null

  return (
    <Section icon={Users} title="AI Access" description="Choose which staff members can see this page." defaultOpen={false}>
      <div className="space-y-1">
        {toggleable.map((u) => (
          <div key={u.id} className="flex items-center justify-between py-2">
            <div>
              <div className="text-sm font-medium text-gray-900">{u.name}</div>
              <div className="text-xs text-gray-500 capitalize">{u.role}</div>
            </div>
            <button
              type="button"
              onClick={() => setAiAccess.mutate({ id: u.id, aiEnabled: !u.aiEnabled })}
              disabled={setAiAccess.isPending}
              className={`flex items-center gap-1.5 text-sm font-medium ${u.aiEnabled ? 'text-primary-600' : 'text-gray-400'}`}
            >
              {u.aiEnabled ? <ToggleRight className="w-6 h-6" /> : <ToggleLeft className="w-6 h-6" />}
              {u.aiEnabled ? 'Enabled' : 'Disabled'}
            </button>
          </div>
        ))}
      </div>
    </Section>
  )
}

export function AIPage() {
  const role = useAuthStore((s) => s.user?.role)
  const canManageAiAccess = role === 'owner' || role === 'super_user'

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-4">
      <div>
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-primary-600" /> AI Assistant
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">
          7 AI features — all drafts, always human-approved before anything saves or sends.
        </p>
      </div>

      {canManageAiAccess && <AiAccessManager />}
      <ChatAssistant />
      <CashflowForecastSection />
      <GstSummary />
      <ExpenseCategorizer />
      <GuestDuplicates />
      <CreditRiskChecker />
      <PaymentReminders />
    </div>
  )
}
