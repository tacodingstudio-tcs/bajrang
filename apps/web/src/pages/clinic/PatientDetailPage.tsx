// apps/web/src/pages/clinic/PatientDetailPage.tsx
// Per-patient view: Visit History | Vitals Trend | Documents

import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Plus, Edit2, Trash2, Save, X, ExternalLink,
  Activity, FileText, ClipboardList,
} from 'lucide-react'
import {
  useParty,
  useClinicVisits, useCreateClinicVisit, useUpdateClinicVisit, useDeleteClinicVisit,
  useClinicDocuments, useCreateClinicDocument, useUpdateClinicDocument, useDeleteClinicDocument,
  usePatientSummary,
} from '@/hooks/useApi'

const TABS = ['visits', 'vitals', 'documents'] as const
type Tab = typeof TABS[number]

const DOC_TYPES = [
  { value: 'lab',          label: 'Lab Report' },
  { value: 'xray',         label: 'X-Ray / Scan' },
  { value: 'prescription', label: 'Prescription' },
  { value: 'discharge',    label: 'Discharge Summary' },
  { value: 'other',        label: 'Other' },
]

function today() { return new Date().toISOString().split('T')[0]! }

// ── Visit Form ───────────────────────────────────────────────────────────────
function VisitForm({ partyId, existing, onDone }: { partyId: string; existing?: any; onDone: () => void }) {
  const [form, setForm] = useState({
    visitDate:    existing?.visitDate?.split('T')[0] ?? today(),
    doctorName:   existing?.doctorName ?? '',
    complaint:    existing?.complaint ?? '',
    diagnosis:    existing?.diagnosis ?? '',
    followUpDate: existing?.followUpDate?.split('T')[0] ?? '',
    notes:        existing?.notes ?? '',
    vitals: {
      bp_sys:  existing?.vitals?.bp_sys  ?? '',
      bp_dia:  existing?.vitals?.bp_dia  ?? '',
      weight:  existing?.vitals?.weight  ?? '',
      temp:    existing?.vitals?.temp    ?? '',
      spo2:    existing?.vitals?.spo2    ?? '',
      pulse:   existing?.vitals?.pulse   ?? '',
    },
    prescription: (existing?.prescription ?? []) as Array<{ medicine: string; dosage: string; frequency: string; duration: string; notes: string }>,
  })

  const create = useCreateClinicVisit()
  const update = useUpdateClinicVisit()

  function setVital(k: string, v: string) {
    setForm((f) => ({ ...f, vitals: { ...f.vitals, [k]: v } }))
  }

  function addRx() {
    setForm((f) => ({ ...f, prescription: [...f.prescription, { medicine: '', dosage: '', frequency: '', duration: '', notes: '' }] }))
  }

  function setRx(i: number, k: string, v: string) {
    setForm((f) => {
      const rx = [...f.prescription]
      rx[i] = { ...rx[i]!, [k]: v }
      return { ...f, prescription: rx }
    })
  }

  function removeRx(i: number) {
    setForm((f) => ({ ...f, prescription: f.prescription.filter((_, idx) => idx !== i) }))
  }

  async function save() {
    if (!form.visitDate) return
    const vitals: Record<string, number> = {}
    if (form.vitals.bp_sys  !== '') vitals['bp_sys']  = Number(form.vitals.bp_sys)
    if (form.vitals.bp_dia  !== '') vitals['bp_dia']  = Number(form.vitals.bp_dia)
    if (form.vitals.weight  !== '') vitals['weight']  = Number(form.vitals.weight)
    if (form.vitals.temp    !== '') vitals['temp']    = Number(form.vitals.temp)
    if (form.vitals.spo2    !== '') vitals['spo2']    = Number(form.vitals.spo2)
    if (form.vitals.pulse   !== '') vitals['pulse']   = Number(form.vitals.pulse)

    const payload = {
      partyId:      partyId,
      visitDate:    form.visitDate,
      doctorName:   form.doctorName || null,
      complaint:    form.complaint  || null,
      diagnosis:    form.diagnosis  || null,
      vitals,
      prescription: form.prescription.filter((r) => r.medicine.trim()),
      followUpDate: form.followUpDate || null,
      notes:        form.notes || null,
    }

    if (existing) {
      await update.mutateAsync({ id: existing.id, ...payload })
    } else {
      await create.mutateAsync(payload)
    }
    onDone()
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-5">
      <h3 className="font-semibold text-gray-900">{existing ? 'Edit Visit' : 'New Visit'}</h3>

      {/* Basic info */}
      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="label">Visit Date <span className="text-red-500">*</span></label>
          <input type="date" className="input" value={form.visitDate} onChange={(e) => setForm({ ...form, visitDate: e.target.value })} />
        </div>
        <div>
          <label className="label">Doctor Name</label>
          <input type="text" className="input" placeholder="Dr. Name" value={form.doctorName} onChange={(e) => setForm({ ...form, doctorName: e.target.value })} />
        </div>
        <div>
          <label className="label">Follow-up Date</label>
          <input type="date" className="input" value={form.followUpDate} onChange={(e) => setForm({ ...form, followUpDate: e.target.value })} />
        </div>
      </div>

      {/* Vitals */}
      <div>
        <div className="text-sm font-medium text-gray-700 mb-2">Vitals</div>
        <div className="grid grid-cols-6 gap-3">
          {[
            { key: 'bp_sys', label: 'BP Sys', unit: 'mmHg', placeholder: '120' },
            { key: 'bp_dia', label: 'BP Dia', unit: 'mmHg', placeholder: '80' },
            { key: 'pulse',  label: 'Pulse',  unit: '/min', placeholder: '72' },
            { key: 'temp',   label: 'Temp',   unit: '°F',   placeholder: '98.6' },
            { key: 'spo2',   label: 'SpO2',   unit: '%',    placeholder: '99' },
            { key: 'weight', label: 'Weight', unit: 'kg',   placeholder: '65' },
          ].map(({ key, label, unit, placeholder }) => (
            <div key={key}>
              <label className="text-xs text-gray-500 font-medium">{label}</label>
              <div className="relative">
                <input
                  type="number"
                  className="input py-1 pr-8 text-sm"
                  placeholder={placeholder}
                  value={(form.vitals as any)[key]}
                  onChange={(e) => setVital(key, e.target.value)}
                />
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-400">{unit}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Complaint & Diagnosis */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Chief Complaint</label>
          <textarea rows={3} className="input resize-none" placeholder="Patient's main complaint..." value={form.complaint} onChange={(e) => setForm({ ...form, complaint: e.target.value })} />
        </div>
        <div>
          <label className="label">Diagnosis</label>
          <textarea rows={3} className="input resize-none" placeholder="Doctor's diagnosis..." value={form.diagnosis} onChange={(e) => setForm({ ...form, diagnosis: e.target.value })} />
        </div>
      </div>

      {/* Prescription */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm font-medium text-gray-700">Prescription</div>
          <button type="button" onClick={addRx} className="text-xs text-primary-600 hover:underline flex items-center gap-1">
            <Plus className="w-3 h-3" /> Add Medicine
          </button>
        </div>
        {form.prescription.length === 0 ? (
          <div className="text-xs text-gray-400 py-2">No medicines added yet.</div>
        ) : (
          <div className="space-y-2">
            {form.prescription.map((rx, i) => (
              <div key={i} className="grid grid-cols-5 gap-2 items-center">
                <input type="text" className="input py-1 text-sm col-span-1" placeholder="Medicine name" value={rx.medicine} onChange={(e) => setRx(i, 'medicine', e.target.value)} />
                <input type="text" className="input py-1 text-sm" placeholder="Dosage (e.g. 500mg)" value={rx.dosage} onChange={(e) => setRx(i, 'dosage', e.target.value)} />
                <input type="text" className="input py-1 text-sm" placeholder="Frequency (1-0-1)" value={rx.frequency} onChange={(e) => setRx(i, 'frequency', e.target.value)} />
                <input type="text" className="input py-1 text-sm" placeholder="Duration (5 days)" value={rx.duration} onChange={(e) => setRx(i, 'duration', e.target.value)} />
                <button type="button" onClick={() => removeRx(i)} className="p-1 text-gray-400 hover:text-red-500">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Notes */}
      <div>
        <label className="label">Additional Notes</label>
        <textarea rows={2} className="input resize-none" placeholder="Any other clinical notes..." value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
      </div>

      <div className="flex gap-2 justify-end pt-2 border-t border-gray-100">
        <button type="button" className="btn-ghost" onClick={onDone}><X className="w-4 h-4" /> Cancel</button>
        <button type="button" className="btn-primary" onClick={save} disabled={create.isPending || update.isPending}>
          <Save className="w-4 h-4" /> {existing ? 'Update Visit' : 'Save Visit'}
        </button>
      </div>
    </div>
  )
}

// ── Document Form ─────────────────────────────────────────────────────────────
function DocumentForm({ partyId, existing, onDone }: { partyId: string; existing?: any; onDone: () => void }) {
  const [form, setForm] = useState({
    title:   existing?.title   ?? '',
    docType: existing?.docType ?? 'lab',
    url:     existing?.url     ?? '',
    docDate: existing?.docDate?.split('T')[0] ?? today(),
    notes:   existing?.notes   ?? '',
  })
  const create = useCreateClinicDocument()
  const update = useUpdateClinicDocument()

  async function save() {
    if (!form.title.trim() || !form.url.trim()) return
    if (existing) {
      await update.mutateAsync({ id: existing.id, ...form })
    } else {
      await create.mutateAsync({ partyId, ...form })
    }
    onDone()
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
      <h3 className="font-semibold text-gray-900">{existing ? 'Edit Document' : 'Add Document'}</h3>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Title <span className="text-red-500">*</span></label>
          <input type="text" className="input" placeholder="e.g. CBC Report, Chest X-Ray" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        </div>
        <div>
          <label className="label">Document Type</label>
          <select className="input" value={form.docType} onChange={(e) => setForm({ ...form, docType: e.target.value })}>
            {DOC_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <div className="col-span-2">
          <label className="label">Document URL <span className="text-red-500">*</span></label>
          <input type="url" className="input" placeholder="Google Drive / WhatsApp / Storage URL" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} />
        </div>
        <div>
          <label className="label">Document Date</label>
          <input type="date" className="input" value={form.docDate} onChange={(e) => setForm({ ...form, docDate: e.target.value })} />
        </div>
        <div>
          <label className="label">Notes</label>
          <input type="text" className="input" placeholder="Optional notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        </div>
      </div>
      <div className="flex gap-2 justify-end">
        <button type="button" className="btn-ghost" onClick={onDone}><X className="w-4 h-4" /> Cancel</button>
        <button type="button" className="btn-primary" onClick={save} disabled={create.isPending || update.isPending || !form.title.trim() || !form.url.trim()}>
          <Save className="w-4 h-4" /> {existing ? 'Update' : 'Add Document'}
        </button>
      </div>
    </div>
  )
}

// ── Vitals Chart ──────────────────────────────────────────────────────────────
function VitalsChart({ partyId }: { partyId: string }) {
  const { data: summary } = usePatientSummary(partyId)
  const visits: any[] = summary?.visits ?? []
  const withVitals = visits.filter((v: any) => Object.keys(v.vitals ?? {}).length > 0)

  if (withVitals.length === 0) {
    return <div className="text-sm text-gray-400 py-12 text-center">No vitals recorded yet. Add vitals when recording a visit.</div>
  }

  const VITALS_CONFIG = [
    { key: 'bp_sys',  label: 'Systolic BP',  unit: 'mmHg', color: '#ef4444', normal: [90, 130] },
    { key: 'bp_dia',  label: 'Diastolic BP', unit: 'mmHg', color: '#f97316', normal: [60, 85]  },
    { key: 'pulse',   label: 'Pulse',         unit: '/min', color: '#8b5cf6', normal: [60, 100] },
    { key: 'temp',    label: 'Temperature',   unit: '°F',   color: '#06b6d4', normal: [97, 99]  },
    { key: 'spo2',    label: 'SpO2',          unit: '%',    color: '#22c55e', normal: [95, 100] },
    { key: 'weight',  label: 'Weight',        unit: 'kg',   color: '#3b82f6', normal: null      },
  ]

  return (
    <div className="space-y-6">
      {VITALS_CONFIG.map(({ key, label, unit, color, normal }) => {
        const dataPoints = withVitals
          .filter((v: any) => v.vitals?.[key] != null)
          .map((v: any) => ({ date: v.visitDate, value: Number(v.vitals[key]) }))
          .reverse()

        if (dataPoints.length === 0) return null

        const values = dataPoints.map((d) => d.value)
        const min = Math.min(...values)
        const max = Math.max(...values)
        const range = max - min || 1
        const latest = dataPoints[dataPoints.length - 1]!

        return (
          <div key={key} className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <span className="font-medium text-gray-900">{label}</span>
                <span className="text-xs text-gray-400 ml-2">({unit})</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold" style={{ color }}>{latest.value}</span>
                {normal && (
                  <span className={`text-xs px-2 py-0.5 rounded-full ${latest.value >= normal[0] && latest.value <= normal[1] ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                    {latest.value >= normal[0] && latest.value <= normal[1] ? 'Normal' : 'Abnormal'}
                  </span>
                )}
              </div>
            </div>

            {/* Mini line chart */}
            <div className="flex items-end gap-2 h-16">
              {dataPoints.map((d, i) => {
                const pct = ((d.value - min) / range) * 100
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1" title={`${new Date(d.date).toLocaleDateString('en-IN')}: ${d.value} ${unit}`}>
                    <div className="w-full rounded-t transition-all" style={{
                      height: `${Math.max(pct * 0.55, 4)}px`,
                      backgroundColor: color,
                      opacity: i === dataPoints.length - 1 ? 1 : 0.5,
                    }} />
                    <div className="text-xs text-gray-400 truncate w-full text-center">
                      {new Date(d.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                    </div>
                  </div>
                )
              })}
            </div>

            {normal && (
              <div className="mt-2 text-xs text-gray-400">Normal range: {normal[0]}–{normal[1]} {unit}</div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export function PatientDetailPage() {
  const { partyId } = useParams<{ partyId: string }>()
  const navigate    = useNavigate()
  const [tab, setTab] = useState<Tab>('visits')
  const [showVisitForm,  setShowVisitForm]  = useState(false)
  const [editVisit,      setEditVisit]      = useState<any>(null)
  const [showDocForm,    setShowDocForm]    = useState(false)
  const [editDoc,        setEditDoc]        = useState<any>(null)

  const { data: party }     = useParty(partyId!)
  const { data: visits }    = useClinicVisits(partyId!)
  const { data: documents } = useClinicDocuments(partyId!)
  const deleteVisit         = useDeleteClinicVisit()
  const deleteDoc           = useDeleteClinicDocument()

  const visitList: any[]  = Array.isArray(visits)    ? visits    : []
  const docList: any[]    = Array.isArray(documents) ? documents : []

  const p = party as any
  const meta = p?.meta ?? {}

  return (
    <div className="p-8 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-start gap-4">
        <button type="button" onClick={() => navigate('/clinic/patients')} className="p-2 hover:bg-gray-100 rounded-lg mt-1">
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-semibold text-gray-900">{p?.name ?? 'Patient'}</h1>
          <div className="flex flex-wrap gap-3 mt-1 text-sm text-gray-500">
            {p?.phone          && <span>{p.phone}</span>}
            {meta.age          && <span>· Age: {meta.age}</span>}
            {meta.gender       && <span>· {meta.gender}</span>}
            {meta.blood_group  && <span>· <span className="text-red-600 font-medium">{meta.blood_group}</span></span>}
            {meta.known_allergies && (
              <span className="text-amber-600">· Allergies: {meta.known_allergies}</span>
            )}
            {meta.chronic_conditions && (
              <span className="text-orange-600">· {meta.chronic_conditions}</span>
            )}
          </div>
        </div>
        <div className="flex gap-2 text-xs shrink-0">
          <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded-full">{visitList.length} Visits</span>
          <span className="px-2 py-1 bg-purple-50 text-purple-700 rounded-full">{docList.length} Documents</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {([
          { key: 'visits',    label: 'Visit History',  icon: ClipboardList },
          { key: 'vitals',    label: 'Vitals Trend',   icon: Activity      },
          { key: 'documents', label: 'Documents',      icon: FileText      },
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

      {/* ── VISITS TAB ─────────────────────────────────────────────────── */}
      {tab === 'visits' && (
        <div className="space-y-4">
          {!showVisitForm && !editVisit && (
            <button type="button" className="btn-primary" onClick={() => setShowVisitForm(true)}>
              <Plus className="w-4 h-4" /> Record Visit
            </button>
          )}
          {showVisitForm && <VisitForm partyId={partyId!} onDone={() => setShowVisitForm(false)} />}
          {editVisit     && <VisitForm partyId={partyId!} existing={editVisit} onDone={() => setEditVisit(null)} />}

          {visitList.length === 0 ? (
            <div className="text-sm text-gray-400 py-12 text-center">No visits recorded yet.</div>
          ) : (
            <div className="space-y-4">
              {visitList.map((v: any) => {
                const hasVitals    = Object.keys(v.vitals ?? {}).length > 0
                const hasPrescription = (v.prescription ?? []).length > 0
                const followUp     = v.followUpDate ? new Date(v.followUpDate) : null
                const isOverdue    = followUp && followUp < new Date()

                return (
                  <div key={v.id} className="bg-white border border-gray-200 rounded-xl p-5 group">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap mb-2">
                          <span className="text-sm font-semibold text-primary-700 bg-primary-50 px-3 py-1 rounded-full">
                            {new Date(v.visitDate).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                          </span>
                          {v.doctorName && <span className="text-sm text-gray-500">Dr. {v.doctorName}</span>}
                          {followUp && (
                            <span className={`text-xs px-2 py-0.5 rounded-full ${isOverdue ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
                              Follow-up: {followUp.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                              {isOverdue ? ' (overdue)' : ''}
                            </span>
                          )}
                        </div>

                        {/* Vitals strip */}
                        {hasVitals && (
                          <div className="flex flex-wrap gap-3 mb-3 text-xs">
                            {v.vitals.bp_sys && v.vitals.bp_dia && (
                              <span className="bg-red-50 text-red-700 px-2 py-0.5 rounded">BP: {v.vitals.bp_sys}/{v.vitals.bp_dia}</span>
                            )}
                            {v.vitals.pulse  && <span className="bg-purple-50 text-purple-700 px-2 py-0.5 rounded">Pulse: {v.vitals.pulse}/min</span>}
                            {v.vitals.temp   && <span className="bg-cyan-50 text-cyan-700 px-2 py-0.5 rounded">Temp: {v.vitals.temp}°F</span>}
                            {v.vitals.spo2   && <span className="bg-green-50 text-green-700 px-2 py-0.5 rounded">SpO2: {v.vitals.spo2}%</span>}
                            {v.vitals.weight && <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded">Wt: {v.vitals.weight}kg</span>}
                          </div>
                        )}

                        <div className="grid grid-cols-2 gap-4 text-sm">
                          {v.complaint && (
                            <div>
                              <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-0.5">Complaint</div>
                              <p className="text-gray-700 whitespace-pre-wrap">{v.complaint}</p>
                            </div>
                          )}
                          {v.diagnosis && (
                            <div>
                              <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-0.5">Diagnosis</div>
                              <p className="text-gray-700 whitespace-pre-wrap">{v.diagnosis}</p>
                            </div>
                          )}
                        </div>

                        {hasPrescription && (
                          <div className="mt-3">
                            <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Prescription</div>
                            <div className="flex flex-wrap gap-2">
                              {v.prescription.map((rx: any, i: number) => (
                                <div key={i} className="text-xs bg-amber-50 border border-amber-200 text-amber-800 px-2 py-1 rounded-lg">
                                  <span className="font-medium">{rx.medicine}</span>
                                  {rx.dosage    && <span className="text-amber-600"> · {rx.dosage}</span>}
                                  {rx.frequency && <span className="text-amber-600"> · {rx.frequency}</span>}
                                  {rx.duration  && <span className="text-amber-600"> · {rx.duration}</span>}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {v.notes && (
                          <p className="mt-3 text-sm text-gray-500 italic">{v.notes}</p>
                        )}
                      </div>

                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                        <button type="button" onClick={() => { setEditVisit(v); setShowVisitForm(false) }} className="p-1.5 hover:bg-gray-100 rounded text-gray-400 hover:text-gray-700">
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button type="button" onClick={() => { if (confirm('Delete this visit?')) deleteVisit.mutate(v.id) }} className="p-1.5 hover:bg-red-50 rounded text-gray-400 hover:text-red-600">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── VITALS TAB ────────────────────────────────────────────────── */}
      {tab === 'vitals' && <VitalsChart partyId={partyId!} />}

      {/* ── DOCUMENTS TAB ─────────────────────────────────────────────── */}
      {tab === 'documents' && (
        <div className="space-y-4">
          {!showDocForm && !editDoc && (
            <button type="button" className="btn-primary" onClick={() => setShowDocForm(true)}>
              <Plus className="w-4 h-4" /> Add Document
            </button>
          )}
          {showDocForm && <DocumentForm partyId={partyId!} onDone={() => setShowDocForm(false)} />}
          {editDoc     && <DocumentForm partyId={partyId!} existing={editDoc} onDone={() => setEditDoc(null)} />}

          {docList.length === 0 ? (
            <div className="text-sm text-gray-400 py-12 text-center">No documents added yet.</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {docList.map((d: any) => {
                const typeLabel = DOC_TYPES.find((t) => t.value === d.docType)?.label ?? d.docType
                const colorMap: Record<string, string> = {
                  lab: 'bg-blue-50 text-blue-700 border-blue-200',
                  xray: 'bg-gray-50 text-gray-700 border-gray-300',
                  prescription: 'bg-amber-50 text-amber-700 border-amber-200',
                  discharge: 'bg-purple-50 text-purple-700 border-purple-200',
                  other: 'bg-green-50 text-green-700 border-green-200',
                }
                return (
                  <div key={d.id} className={`border rounded-xl p-4 group ${colorMap[d.docType] ?? colorMap['other']}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">{d.title}</div>
                        <div className="text-xs opacity-70 mt-0.5">{typeLabel}</div>
                        {d.docDate && (
                          <div className="text-xs opacity-60 mt-0.5">
                            {new Date(d.docDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </div>
                        )}
                        {d.notes && <div className="text-xs opacity-70 mt-1 italic">{d.notes}</div>}
                      </div>
                      <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <a href={d.url} target="_blank" rel="noopener noreferrer" className="p-1 hover:bg-white/50 rounded">
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                        <button type="button" onClick={() => { setEditDoc(d); setShowDocForm(false) }} className="p-1 hover:bg-white/50 rounded">
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button type="button" onClick={() => { if (confirm('Delete this document?')) deleteDoc.mutate(d.id) }} className="p-1 hover:bg-red-100 rounded">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    <a href={d.url} target="_blank" rel="noopener noreferrer" className="mt-3 flex items-center gap-1 text-xs font-medium hover:underline">
                      <ExternalLink className="w-3 h-3" /> Open Document
                    </a>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
