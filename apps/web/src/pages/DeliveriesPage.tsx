// src/pages/DeliveriesPage.tsx
// Delivery order tracking — create, dispatch, and complete deliveries.
import { useState } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import { useDeliveries, useCreateDelivery, useUpdateDelivery } from '@/hooks/useApi'
import { Truck, MapPin, Phone, CheckCircle, Clock, AlertCircle, XCircle, Package } from 'lucide-react'

function todayStr() { return new Date().toISOString().slice(0, 10) }

const STATUS_LABELS: Record<string, string> = {
  pending:          'Pending',
  dispatched:       'Dispatched',
  out_for_delivery: 'Out for Delivery',
  delivered:        'Delivered',
  failed:           'Failed',
  cancelled:        'Cancelled',
}

const STATUS_COLORS: Record<string, string> = {
  pending:          'bg-gray-100 text-gray-600',
  dispatched:       'bg-blue-100 text-blue-700',
  out_for_delivery: 'bg-amber-100 text-amber-700',
  delivered:        'bg-green-100 text-green-700',
  failed:           'bg-red-100 text-red-600',
  cancelled:        'bg-gray-100 text-gray-400',
}

const STATUS_ICONS: Record<string, React.ElementType> = {
  pending:          Clock,
  dispatched:       Truck,
  out_for_delivery: Truck,
  delivered:        CheckCircle,
  failed:           AlertCircle,
  cancelled:        XCircle,
}

const NEXT_STATUS: Record<string, string> = {
  pending:          'dispatched',
  dispatched:       'out_for_delivery',
  out_for_delivery: 'delivered',
}

const NEXT_LABEL: Record<string, string> = {
  pending:          'Dispatch',
  dispatched:       'Out for Delivery',
  out_for_delivery: 'Mark Delivered',
}

export function DeliveriesPage() {
  const [statusFilter, setFilter] = useState('')
  const [dateFilter,   setDate]   = useState('')
  const [showCreate,   setCreate] = useState(false)

  const { data, isLoading, refetch } = useDeliveries({
    status: statusFilter || undefined,
    date:   dateFilter   || undefined,
  })
  const create = useCreateDelivery()
  const update = useUpdateDelivery()

  const deliveries: any[] = data?.deliveries ?? []
  const total = data?.total ?? 0

  // Create form state
  const [fLine1,   setFL1]  = useState('')
  const [fCity,    setFC]   = useState('')
  const [fPin,     setFP]   = useState('')
  const [fLandmark,setFLM]  = useState('')
  const [fPerson,  setFPer] = useState('')
  const [fPhone,   setFPh]  = useState('')
  const [fInvNo,   setFInv] = useState('')
  const [fSched,   setFSch] = useState('')
  const [fNotes,   setFN]   = useState('')

  function resetForm() {
    setFL1(''); setFC(''); setFP(''); setFLM('')
    setFPer(''); setFPh(''); setFInv(''); setFSch(''); setFN('')
    setCreate(false)
  }

  function handleCreate() {
    create.mutate({
      deliveryAddress: {
        line1: fLine1 || undefined, city: fCity || undefined,
        pincode: fPin || undefined, landmark: fLandmark || undefined,
      },
      deliveryPersonName:  fPerson || undefined,
      deliveryPersonPhone: fPhone  || undefined,
      notes:               fNotes  || undefined,
      scheduledAt:         fSched  || undefined,
    }, { onSuccess: () => { resetForm(); refetch() } })
  }

  function handleAdvance(delivery: any) {
    const next = NEXT_STATUS[delivery.status]
    if (!next) return
    update.mutate({ id: delivery.id, data: { status: next } }, { onSuccess: () => refetch() })
  }

  function handleFail(id: string) {
    update.mutate({ id, data: { status: 'failed' } }, { onSuccess: () => refetch() })
  }

  return (
    <div>
      <PageHeader title="Deliveries" subtitle="Track and manage delivery orders" />

      <div className="p-8 space-y-5">
        {/* Filters + create */}
        <div className="flex items-center gap-3 flex-wrap">
          <select title="Filter by status" value={statusFilter}
            onChange={(e) => setFilter(e.target.value)} className="input w-44 text-sm">
            <option value="">All statuses</option>
            {Object.entries(STATUS_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
          <input type="date" title="Filter by date" value={dateFilter}
            onChange={(e) => setDate(e.target.value)}
            className="input w-44 text-sm" />
          {(statusFilter || dateFilter) && (
            <button type="button"
              onClick={() => { setFilter(''); setDate('') }}
              className="text-xs text-gray-400 hover:text-gray-600">
              Clear
            </button>
          )}
          <button type="button" onClick={() => setCreate(true)}
            className="btn btn-primary text-sm px-4 py-2 ml-auto">
            + New Delivery
          </button>
        </div>

        {/* Summary chips */}
        <div className="flex gap-2 flex-wrap">
          {Object.entries(STATUS_LABELS).map(([status, label]) => {
            const count = deliveries.filter(d => d.status === status).length
            if (!statusFilter && count === 0) return null
            const Icon = STATUS_ICONS[status] ?? Package
            return (
              <button
                key={status}
                type="button"
                onClick={() => setFilter(statusFilter === status ? '' : status)}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border transition-colors
                  ${statusFilter === status ? STATUS_COLORS[status] + ' border-transparent' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
                {!statusFilter && <span className="ml-0.5 font-bold">{count}</span>}
              </button>
            )
          })}
        </div>

        {/* Create form */}
        {showCreate && (
          <div className="card p-5 space-y-4 max-w-2xl">
            <h3 className="text-sm font-semibold text-gray-900">New Delivery Order</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="text-xs text-gray-500 mb-1 block" htmlFor="del-line1">
                  Delivery Address
                </label>
                <input id="del-line1" type="text" title="Address line 1" value={fLine1}
                  onChange={(e) => setFL1(e.target.value)}
                  placeholder="House / flat / street" className="input text-sm w-full" />
              </div>
              <div>
                <input type="text" title="City" value={fCity}
                  onChange={(e) => setFC(e.target.value)}
                  placeholder="City" className="input text-sm w-full" />
              </div>
              <div>
                <input type="text" title="Pincode" value={fPin}
                  onChange={(e) => setFP(e.target.value)}
                  placeholder="Pincode" className="input text-sm w-full" />
              </div>
              <div>
                <input type="text" title="Landmark" value={fLandmark}
                  onChange={(e) => setFLM(e.target.value)}
                  placeholder="Landmark (optional)" className="input text-sm w-full" />
              </div>
              <div />
              <div>
                <label className="text-xs text-gray-500 mb-1 block" htmlFor="del-person">
                  Delivery Person
                </label>
                <input id="del-person" type="text" title="Delivery person name" value={fPerson}
                  onChange={(e) => setFPer(e.target.value)}
                  placeholder="Name" className="input text-sm w-full" />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block" htmlFor="del-phone">
                  Phone
                </label>
                <input id="del-phone" type="tel" title="Delivery person phone" value={fPhone}
                  onChange={(e) => setFPh(e.target.value)}
                  placeholder="Mobile number" className="input text-sm w-full" />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block" htmlFor="del-sched">
                  Scheduled At
                </label>
                <input id="del-sched" type="datetime-local" title="Scheduled delivery time" value={fSched}
                  onChange={(e) => setFSch(e.target.value)} className="input text-sm w-full" />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block" htmlFor="del-notes">
                  Notes
                </label>
                <input id="del-notes" type="text" title="Notes" value={fNotes}
                  onChange={(e) => setFN(e.target.value)}
                  placeholder="Optional notes" className="input text-sm w-full" />
              </div>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={resetForm}
                className="btn btn-ghost text-sm px-4 py-2 flex-1">Cancel</button>
              <button type="button" onClick={handleCreate}
                disabled={create.isPending}
                className="btn btn-primary text-sm px-4 py-2 flex-1 disabled:opacity-50">
                {create.isPending ? 'Creating…' : 'Create Delivery'}
              </button>
            </div>
          </div>
        )}

        {/* Deliveries list */}
        {isLoading ? (
          <div className="text-center py-12 text-gray-400">Loading…</div>
        ) : deliveries.length === 0 ? (
          <div className="card p-12 text-center">
            <Truck className="w-10 h-10 mx-auto mb-3 text-gray-200" />
            <p className="text-gray-400 text-sm">No deliveries found.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {deliveries.map((d: any) => {
              const addr = d.delivery_address ?? {}
              const addrStr = [addr.line1, addr.city, addr.pincode].filter(Boolean).join(', ')
              const Icon = STATUS_ICONS[d.status] ?? Package
              const next = NEXT_STATUS[d.status]

              return (
                <div key={d.id} className="card p-4">
                  <div className="flex items-start gap-4">
                    {/* Status icon */}
                    <div className={`mt-0.5 p-2 rounded-lg ${STATUS_COLORS[d.status]}`}>
                      <Icon className="w-4 h-4" />
                    </div>

                    {/* Main info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[d.status]}`}>
                          {STATUS_LABELS[d.status]}
                        </span>
                        {d.invoice_number && (
                          <span className="text-xs text-gray-400">Invoice {d.invoice_number}</span>
                        )}
                        <span className="text-xs text-gray-300">{d.created_at}</span>
                      </div>

                      <div className="flex items-center gap-1.5 text-sm text-gray-700 mb-1">
                        <MapPin className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                        <span className="truncate">{addrStr || 'No address'}</span>
                        {addr.landmark && (
                          <span className="text-gray-400 text-xs">· {addr.landmark}</span>
                        )}
                      </div>

                      {d.party_name && (
                        <div className="text-xs text-gray-500 mb-1">For: {d.party_name}</div>
                      )}

                      <div className="flex items-center gap-4 mt-1">
                        {d.delivery_person_name && (
                          <span className="flex items-center gap-1 text-xs text-gray-500">
                            <Truck className="w-3 h-3" />
                            {d.delivery_person_name}
                          </span>
                        )}
                        {d.delivery_person_phone && (
                          <a href={`tel:${d.delivery_person_phone}`}
                            className="flex items-center gap-1 text-xs text-primary-600 hover:underline">
                            <Phone className="w-3 h-3" />
                            {d.delivery_person_phone}
                          </a>
                        )}
                        {d.scheduled_at && (
                          <span className="flex items-center gap-1 text-xs text-gray-400">
                            <Clock className="w-3 h-3" />
                            Scheduled: {d.scheduled_at}
                          </span>
                        )}
                        {d.delivered_at && (
                          <span className="flex items-center gap-1 text-xs text-green-600">
                            <CheckCircle className="w-3 h-3" />
                            Delivered: {d.delivered_at}
                          </span>
                        )}
                      </div>

                      {d.notes && (
                        <p className="mt-1 text-xs text-gray-400 italic">{d.notes}</p>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {next && (
                        <button type="button"
                          onClick={() => handleAdvance(d)}
                          disabled={update.isPending}
                          className="btn btn-primary text-xs px-3 py-1.5 disabled:opacity-50">
                          {NEXT_LABEL[d.status]}
                        </button>
                      )}
                      {(d.status === 'dispatched' || d.status === 'out_for_delivery') && (
                        <button type="button"
                          onClick={() => handleFail(d.id)}
                          disabled={update.isPending}
                          className="text-xs text-red-500 hover:underline">
                          Failed
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}

            {total > deliveries.length && (
              <p className="text-center text-xs text-gray-400 py-2">
                Showing {deliveries.length} of {total} deliveries
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
