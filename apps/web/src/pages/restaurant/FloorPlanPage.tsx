// src/pages/restaurant/FloorPlanPage.tsx
// Visual floor plan: table cards coloured by status, right-side drawer for
// KOT management, item entry, and bill preview / checkout.

import { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { restaurantApi, invoiceApi } from '@/lib/api'
import { useAuthStore } from '@/store/auth.store'
import {
  Users, Clock, Plus, X, Printer, ChevronRight,
  CheckCircle, AlertCircle, ArrowRightLeft, Trash2, ChefHat,
} from 'lucide-react'
import toast from 'react-hot-toast'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Table {
  id: string; tableNo: string; capacity: number; section?: string
  status: 'available' | 'occupied' | 'reserved' | 'cleaning'
  guestCount: number; openedAt?: string; currentInvoiceId?: string
}

interface KOTItem {
  description: string; qty: number; rate: number
  notes?: string; station?: string; portion?: string
  modifiers: Array<{ name: string; price: number }>
  cancelled?: boolean
}

interface KOT {
  id: string; kotNo: string; station: string; status: string
  items: KOTItem[]; notes?: string; createdAt: string
}

interface BillLine {
  description: string; qty: number; rate: number
  modifiers: Array<{ name: string; price: number }>; kotIds: string[]; notes: string[]
}

interface BillData {
  table: Table; kots: KOT[]; lines: BillLine[]
  subtotal: number; gst: number; total: number
  openedAt?: string; guestCount: number; minutesOpen: number
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const STATUS_STYLE: Record<string, string> = {
  available: 'bg-green-50 border-green-300 text-green-800',
  occupied:  'bg-red-50   border-red-300   text-red-800',
  reserved:  'bg-yellow-50 border-yellow-300 text-yellow-800',
  cleaning:  'bg-gray-100  border-gray-300   text-gray-600',
}

const STATUS_DOT: Record<string, string> = {
  available: 'bg-green-500',
  occupied:  'bg-red-500',
  reserved:  'bg-yellow-500',
  cleaning:  'bg-gray-400',
}

function elapsed(openedAt?: string): string {
  if (!openedAt) return ''
  const mins = Math.floor((Date.now() - new Date(openedAt).getTime()) / 60000)
  if (mins < 60) return `${mins}m`
  return `${Math.floor(mins / 60)}h ${mins % 60}m`
}

function groupBySection(tables: Table[]) {
  const map = new Map<string, Table[]>()
  for (const t of tables) {
    const key = t.section ?? 'Main'
    const arr = map.get(key) ?? []
    arr.push(t)
    map.set(key, arr)
  }
  return map
}

// ── Quick-entry item form ─────────────────────────────────────────────────────

function ItemEntryRow({
  onAdd,
}: {
  onAdd: (item: { description: string; qty: number; rate: number; notes?: string }) => void
}) {
  const [desc,  setDesc]  = useState('')
  const [qty,   setQty]   = useState('1')
  const [rate,  setRate]  = useState('')
  const [notes, setNotes] = useState('')
  const descRef = useRef<HTMLInputElement>(null)

  function submit() {
    if (!desc.trim() || !rate) return
    onAdd({ description: desc.trim(), qty: Number(qty), rate: Number(rate), notes: notes || undefined })
    setDesc(''); setQty('1'); setRate(''); setNotes('')
    descRef.current?.focus()
  }

  return (
    <div className="space-y-2 p-3 bg-gray-50 rounded-lg border border-gray-200">
      <div className="flex gap-2">
        <input
          ref={descRef}
          value={desc}
          onChange={e => setDesc(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && submit()}
          placeholder="Item name"
          className="input flex-1 text-sm"
        />
        <input
          value={qty}
          onChange={e => setQty(e.target.value)}
          type="number" min="0.5" step="0.5"
          className="input w-16 text-sm text-center"
          placeholder="Qty"
        />
        <input
          value={rate}
          onChange={e => setRate(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && submit()}
          type="number" min="0"
          className="input w-24 text-sm"
          placeholder="₹ Rate"
        />
      </div>
      <div className="flex gap-2">
        <input
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="Notes (no onion, extra spicy…)"
          className="input flex-1 text-xs"
        />
        <button
          type="button"
          onClick={submit}
          disabled={!desc.trim() || !rate}
          className="btn-primary text-sm px-4"
        >
          Add
        </button>
      </div>
    </div>
  )
}

// ── Table drawer (right panel) ────────────────────────────────────────────────

function TableDrawer({
  table,
  onClose,
}: {
  table: Table
  onClose: () => void
}) {
  const qc = useQueryClient()
  const [pendingItems, setPendingItems] = useState<Array<{
    description: string; qty: number; rate: number; notes?: string
    modifiers: Array<{name:string;price:number}>
  }>>([])
  const [transferMode, setTransferMode] = useState(false)
  const [showOpenForm, setShowOpenForm] = useState(table.status === 'available')

  const { data: bill, isLoading: billLoading } = useQuery<BillData>({
    queryKey: ['restaurant-bill', table.id],
    queryFn:  () => restaurantApi.getTableBill(table.id),
    enabled:  table.status === 'occupied',
    refetchInterval: 15000,
  })

  const { data: allTables } = useQuery<Table[]>({
    queryKey: ['restaurant-tables'],
    queryFn:  restaurantApi.listTables,
  })

  const openMut = useMutation({
    mutationFn: ({ guests }: { guests: number }) =>
      restaurantApi.openTable(table.id, guests),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['restaurant-tables'] })
      setShowOpenForm(false)
      toast.success(`Table ${table.tableNo} opened`)
    },
  })

  const freeMut = useMutation({
    mutationFn: () => restaurantApi.freeTable(table.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['restaurant-tables'] })
      toast.success(`Table ${table.tableNo} cleared`)
      onClose()
    },
  })

  const kotMut = useMutation({
    mutationFn: (items: typeof pendingItems) =>
      restaurantApi.fireKOT(table.id, { items }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['restaurant-bill', table.id] })
      setPendingItems([])
      toast.success('KOT fired to kitchen')
    },
  })

  const statusMut = useMutation({
    mutationFn: (status: 'available' | 'reserved' | 'cleaning') =>
      restaurantApi.setTableStatus(table.id, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['restaurant-tables'] })
      toast.success('Table status updated')
      onClose()
    },
  })

  const transferMut = useMutation({
    mutationFn: (toId: string) =>
      restaurantApi.transferTable(table.id, toId),
    onSuccess: (_, toId) => {
      const dest = allTables?.find(t => t.id === toId)
      qc.invalidateQueries({ queryKey: ['restaurant-tables'] })
      qc.invalidateQueries({ queryKey: ['restaurant-bill'] })
      toast.success(`Moved to ${dest?.tableNo ?? 'new table'}`)
      onClose()
    },
  })

  const [guestInput, setGuestInput] = useState('2')

  function removeItem(i: number) {
    setPendingItems(items => items.filter((_, idx) => idx !== i))
  }

  const pendingTotal = pendingItems.reduce((s, i) => s + i.qty * i.rate, 0)
  const availTables  = allTables?.filter(t => t.id !== table.id && t.status === 'available') ?? []

  return (
    <div className="fixed inset-y-0 right-0 w-[420px] bg-white shadow-2xl border-l border-gray-200 flex flex-col z-30">

      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <span className={`w-3 h-3 rounded-full ${STATUS_DOT[table.status]}`} />
          <div>
            <h2 className="text-base font-semibold text-gray-900">Table {table.tableNo}</h2>
            {table.section && <p className="text-xs text-gray-400">{table.section}</p>}
          </div>
          {table.status === 'occupied' && table.openedAt && (
            <span className="flex items-center gap-1 text-xs text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">
              <Clock className="w-3 h-3" />
              {elapsed(table.openedAt)}
            </span>
          )}
        </div>
        <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600">
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">

        {/* ── Available: open form ── */}
        {table.status === 'available' && (
          <div className="p-5 space-y-4">
            <p className="text-sm text-gray-500">Seat guests at this table</p>
            <div>
              <label className="label">Number of guests</label>
              <input
                type="number" min="1" max={table.capacity}
                value={guestInput}
                onChange={e => setGuestInput(e.target.value)}
                className="input w-32"
              />
            </div>
            <button
              type="button"
              onClick={() => openMut.mutate({ guests: Number(guestInput) || 1 })}
              disabled={openMut.isPending}
              className="btn-primary"
            >
              <Users className="w-4 h-4" />
              {openMut.isPending ? 'Opening…' : 'Open Table'}
            </button>

            <hr className="border-gray-100" />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => statusMut.mutate('reserved')}
                className="btn-ghost text-sm"
              >
                Mark Reserved
              </button>
              <button
                type="button"
                onClick={() => statusMut.mutate('cleaning')}
                className="btn-ghost text-sm"
              >
                Mark Cleaning
              </button>
            </div>
          </div>
        )}

        {/* ── Reserved / Cleaning ── */}
        {(table.status === 'reserved' || table.status === 'cleaning') && (
          <div className="p-5 space-y-3">
            <p className="text-sm text-gray-500 capitalize">{table.status}</p>
            <button
              type="button"
              onClick={() => statusMut.mutate('available')}
              className="btn-ghost text-sm"
            >
              Mark Available
            </button>
            {table.status === 'cleaning' && (
              <button
                type="button"
                onClick={() => openMut.mutate({ guests: 1 })}
                className="btn-primary text-sm"
              >
                <Users className="w-4 h-4" />
                Open Table
              </button>
            )}
          </div>
        )}

        {/* ── Occupied: KOT + Bill ── */}
        {table.status === 'occupied' && (
          <div className="space-y-0">

            {/* Guest count chip */}
            <div className="px-5 py-3 bg-gray-50 border-b border-gray-100 flex items-center gap-2">
              <Users className="w-4 h-4 text-gray-400" />
              <span className="text-sm text-gray-600">{table.guestCount} guests</span>
              {bill && (
                <span className="ml-auto text-sm font-semibold text-gray-900">
                  {bill.lines.reduce((s, l) => s + l.qty, 0)} items · ₹{bill.total.toLocaleString('en-IN')}
                </span>
              )}
            </div>

            {/* Existing KOTs */}
            {billLoading && (
              <div className="p-5 text-sm text-gray-400">Loading bill…</div>
            )}

            {bill && bill.kots.length > 0 && (
              <div className="px-5 py-4 space-y-3">
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Active KOTs</p>
                {bill.kots.map(kot => (
                  <KOTCard key={kot.id} kot={kot} tableId={table.id} />
                ))}
              </div>
            )}

            {/* Add items */}
            <div className="px-5 py-4 border-t border-gray-100">
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3">Add Items</p>
              <ItemEntryRow
                onAdd={item => setPendingItems(prev => [
                  ...prev,
                  { ...item, modifiers: [] },
                ])}
              />

              {pendingItems.length > 0 && (
                <div className="mt-3 space-y-1">
                  {pendingItems.map((item, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm text-gray-700 bg-amber-50 border border-amber-200 rounded px-3 py-1.5">
                      <span className="flex-1 truncate">{item.qty}× {item.description}</span>
                      <span className="text-gray-500">₹{(item.qty * item.rate).toLocaleString('en-IN')}</span>
                      <button type="button" onClick={() => removeItem(i)} className="text-gray-400 hover:text-red-500">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-xs text-gray-500">Total: ₹{pendingTotal.toLocaleString('en-IN')}</span>
                    <button
                      type="button"
                      onClick={() => kotMut.mutate(pendingItems)}
                      disabled={kotMut.isPending}
                      className="btn-primary text-sm"
                    >
                      <ChefHat className="w-4 h-4" />
                      {kotMut.isPending ? 'Firing…' : 'Fire KOT'}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Bill summary */}
            {bill && bill.lines.length > 0 && (
              <div className="px-5 py-4 border-t border-gray-100">
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3">Bill Summary</p>
                <div className="space-y-1">
                  {bill.lines.map((line, i) => (
                    <div key={i} className="flex items-center text-sm text-gray-700">
                      <span className="w-8 text-gray-400 text-xs">{line.qty}×</span>
                      <span className="flex-1 truncate">{line.description}</span>
                      <span>₹{(line.qty * line.rate).toLocaleString('en-IN')}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-3 pt-3 border-t border-dashed border-gray-200 space-y-1 text-sm">
                  <div className="flex justify-between text-gray-500">
                    <span>Subtotal</span>
                    <span>₹{bill.subtotal.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between text-gray-500">
                    <span>GST (5%)</span>
                    <span>₹{bill.gst.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between font-semibold text-gray-900 text-base pt-1">
                    <span>Total</span>
                    <span>₹{bill.total.toLocaleString('en-IN')}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Transfer table */}
            {availTables.length > 0 && (
              <div className="px-5 pb-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setTransferMode(t => !t)}
                  className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mt-3"
                >
                  <ArrowRightLeft className="w-4 h-4" />
                  Move to another table
                </button>
                {transferMode && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {availTables.map(t => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => transferMut.mutate(t.id)}
                        disabled={transferMut.isPending}
                        className="px-3 py-1 rounded-full text-sm border border-green-300 text-green-700 hover:bg-green-50"
                      >
                        {t.tableNo}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer: action buttons */}
      {table.status === 'occupied' && bill && bill.lines.length > 0 && (
        <div className="border-t border-gray-200 p-4 flex gap-2">
          <button
            type="button"
            onClick={() => window.print()}
            className="btn-ghost flex-1 justify-center"
          >
            <Printer className="w-4 h-4" />
            Print KOT
          </button>
          <CheckoutButton table={table} bill={bill} onDone={onClose} />
        </div>
      )}

      {table.status === 'occupied' && bill && bill.lines.length === 0 && (
        <div className="border-t border-gray-200 p-4">
          <button
            type="button"
            onClick={() => freeMut.mutate()}
            disabled={freeMut.isPending}
            className="btn-ghost w-full justify-center text-red-600 hover:text-red-700"
          >
            <Trash2 className="w-4 h-4" />
            {freeMut.isPending ? 'Clearing…' : 'Clear Table (no bill)'}
          </button>
        </div>
      )}
    </div>
  )
}

// ── KOT card (within drawer) ──────────────────────────────────────────────────

function KOTCard({ kot, tableId }: { kot: KOT; tableId: string }) {
  const qc = useQueryClient()
  const mut = useMutation({
    mutationFn: (status: string) => restaurantApi.updateKOTStatus(kot.id, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['restaurant-bill', tableId] }),
  })

  const STATUS_BADGE: Record<string, string> = {
    pending:      'bg-yellow-100 text-yellow-700',
    acknowledged: 'bg-blue-100 text-blue-700',
    preparing:    'bg-orange-100 text-orange-700',
    ready:        'bg-green-100 text-green-700',
    served:       'bg-gray-100 text-gray-500',
  }

  const activeItems = kot.items.filter(i => !(i as any).cancelled)

  return (
    <div className="border border-gray-100 rounded-lg overflow-hidden">
      <div className="flex items-center justify-between bg-gray-50 px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono font-medium text-gray-600">{kot.kotNo}</span>
          <span className="text-xs text-gray-400">{kot.station}</span>
        </div>
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_BADGE[kot.status] ?? 'bg-gray-100 text-gray-500'}`}>
          {kot.status}
        </span>
      </div>
      <div className="px-3 py-2 space-y-0.5">
        {activeItems.map((item, i) => (
          <div key={i} className="flex text-sm text-gray-700">
            <span className="w-6 text-gray-400 text-xs">{item.qty}×</span>
            <span className="flex-1 truncate">{item.description}</span>
            {item.notes && <span className="text-xs text-gray-400 truncate ml-1">({item.notes})</span>}
          </div>
        ))}
      </div>
      {kot.status !== 'served' && kot.status !== 'cancelled' && (
        <div className="px-3 pb-2 flex gap-1">
          {kot.status === 'pending' && (
            <button type="button" onClick={() => mut.mutate('acknowledged')}
              className="text-xs text-blue-600 hover:text-blue-700">ACK</button>
          )}
          {(kot.status === 'pending' || kot.status === 'acknowledged') && (
            <button type="button" onClick={() => mut.mutate('preparing')}
              className="text-xs text-orange-600 hover:text-orange-700 ml-2">PREP</button>
          )}
          {kot.status === 'preparing' && (
            <button type="button" onClick={() => mut.mutate('ready')}
              className="text-xs text-green-600 hover:text-green-700">READY</button>
          )}
          {kot.status === 'ready' && (
            <button type="button" onClick={() => mut.mutate('served')}
              className="text-xs text-gray-500 hover:text-gray-700 ml-2">SERVED</button>
          )}
        </div>
      )}
    </div>
  )
}

// ── Checkout button ───────────────────────────────────────────────────────────

function CheckoutButton({ table, bill, onDone }: { table: Table; bill: BillData; onDone: () => void }) {
  const qc  = useQueryClient()
  const [open, setOpen]   = useState(false)
  const [method, setMethod] = useState('cash')
  const [tip, setTip]     = useState('')

  const createInvoice = useMutation({
    mutationFn: async () => {
      const inv = await invoiceApi.create({
        txnType:    'sale_invoice',
        date:       new Date().toISOString().slice(0, 10),
        notes:      `Table ${table.tableNo}`,
        domainData: {
          table_id:           table.id,
          cover_count:        table.guestCount,
          order_type:         'dine_in',
          service_charge_pct: 0,
        },
        aiMeta: {},
        items: bill.lines.map(l => ({
          description: l.description,
          qty:         l.qty,
          rate:        l.rate,
          unit:        'pcs',
          discountPct: 0,
          gstRate:     5,
          gstExempt:   false,
          modifiers:   l.modifiers,
        })),
      })
      // Record payment immediately
      if (method && bill.total > 0) {
        await invoiceApi.recordPayment(inv.id, {
          amount:      bill.total + (Number(tip) || 0),
          method,
          paymentDate: new Date().toISOString().slice(0, 10),
        })
      }
      // Free the table
      await restaurantApi.freeTable(table.id)
      return inv
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['restaurant-tables'] })
      qc.invalidateQueries({ queryKey: ['restaurant-bill', table.id] })
      toast.success('Table checked out successfully')
      setOpen(false)
      onDone()
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message ?? 'Checkout failed')
    },
  })

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="btn-primary flex-1 justify-center">
        <CheckCircle className="w-4 h-4" />
        Checkout
      </button>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 w-full max-w-sm">
        <h3 className="font-semibold text-gray-900 mb-4">Checkout — Table {table.tableNo}</h3>

        <div className="space-y-3 text-sm text-gray-700 mb-4">
          <div className="flex justify-between"><span>Subtotal</span><span>₹{bill.subtotal.toLocaleString('en-IN')}</span></div>
          <div className="flex justify-between"><span>GST (5%)</span><span>₹{bill.gst.toLocaleString('en-IN')}</span></div>
          <div className="flex justify-between font-semibold text-base"><span>Total</span><span>₹{bill.total.toLocaleString('en-IN')}</span></div>
        </div>

        <div className="space-y-3 mb-5">
          <div>
            <label className="label">Payment method</label>
            <select value={method} onChange={e => setMethod(e.target.value)} className="input">
              <option value="cash">Cash</option>
              <option value="upi">UPI</option>
              <option value="card">Card</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div>
            <label className="label">Tip (optional)</label>
            <input
              type="number" min="0" placeholder="₹0"
              value={tip} onChange={e => setTip(e.target.value)}
              className="input"
            />
          </div>
        </div>

        <div className="flex gap-2">
          <button type="button" onClick={() => setOpen(false)} className="btn-ghost flex-1 justify-center">
            Cancel
          </button>
          <button
            type="button"
            onClick={() => createInvoice.mutate()}
            disabled={createInvoice.isPending}
            className="btn-primary flex-1 justify-center"
          >
            {createInvoice.isPending ? 'Processing…' : 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main Floor Plan ───────────────────────────────────────────────────────────

export function FloorPlanPage() {
  const [selectedTable, setSelectedTable] = useState<Table | null>(null)
  const [filter, setFilter] = useState<'all' | 'available' | 'occupied' | 'reserved'>('all')

  const { data: tables = [], isLoading } = useQuery<Table[]>({
    queryKey: ['restaurant-tables'],
    queryFn:  restaurantApi.listTables,
    refetchInterval: 20000,
  })

  const sections = groupBySection(
    tables.filter(t => filter === 'all' || t.status === filter)
  )

  const counts = {
    all:       tables.length,
    available: tables.filter(t => t.status === 'available').length,
    occupied:  tables.filter(t => t.status === 'occupied').length,
    reserved:  tables.filter(t => t.status === 'reserved').length,
  }

  return (
    <div className="p-6">
      {/* Header row */}
      <div className="flex items-center gap-4 mb-6">
        <h1 className="text-lg font-semibold text-gray-900">Floor Plan</h1>
        <div className="flex gap-1 ml-2">
          {(['all','available','occupied','reserved'] as const).map(f => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`px-3 py-1 rounded-full text-xs font-medium capitalize transition-colors ${
                filter === f
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {f === 'all' ? `All (${counts.all})` : `${f} (${counts[f]})`}
            </button>
          ))}
        </div>

        {/* Legend */}
        <div className="ml-auto flex items-center gap-4 text-xs text-gray-500">
          {Object.entries(STATUS_DOT).map(([s, cls]) => (
            <span key={s} className="flex items-center gap-1.5 capitalize">
              <span className={`w-2.5 h-2.5 rounded-full ${cls}`} />
              {s}
            </span>
          ))}
        </div>
      </div>

      {isLoading && (
        <div className="text-center text-gray-400 py-16">Loading tables…</div>
      )}

      {!isLoading && tables.length === 0 && (
        <div className="text-center text-gray-400 py-16">
          <p className="text-base mb-2">No tables configured</p>
          <p className="text-sm">Go to Setup Tables to add your floor plan</p>
        </div>
      )}

      {/* Table grid grouped by section */}
      {[...sections.entries()].map(([section, sectionTables]) => (
        <div key={section} className="mb-8">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">{section}</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
            {sectionTables.map(table => (
              <button
                key={table.id}
                type="button"
                onClick={() => setSelectedTable(table)}
                className={`relative rounded-xl border-2 p-4 text-left transition-all hover:shadow-md active:scale-95 ${STATUS_STYLE[table.status]}`}
              >
                {/* Table number */}
                <div className="text-xl font-bold mb-1">{table.tableNo}</div>

                {/* Capacity */}
                <div className="flex items-center gap-1 text-xs opacity-70">
                  <Users className="w-3 h-3" />
                  {table.status === 'occupied' ? `${table.guestCount}/${table.capacity}` : table.capacity}
                </div>

                {/* Time open */}
                {table.status === 'occupied' && table.openedAt && (
                  <div className="flex items-center gap-1 text-xs opacity-70 mt-0.5">
                    <Clock className="w-3 h-3" />
                    {elapsed(table.openedAt)}
                  </div>
                )}

                {/* Status dot */}
                <span className={`absolute top-2.5 right-2.5 w-2.5 h-2.5 rounded-full ${STATUS_DOT[table.status]}`} />

                {/* Reserved label */}
                {table.status === 'reserved' && (
                  <div className="text-xs mt-1 font-medium opacity-80">Reserved</div>
                )}
                {table.status === 'cleaning' && (
                  <div className="text-xs mt-1 font-medium opacity-80">Cleaning</div>
                )}
              </button>
            ))}
          </div>
        </div>
      ))}

      {/* Drawer overlay */}
      {selectedTable && (
        <>
          <div
            className="fixed inset-0 bg-black/20 z-20"
            onClick={() => setSelectedTable(null)}
          />
          <TableDrawer
            table={selectedTable}
            onClose={() => {
              setSelectedTable(null)
            }}
          />
        </>
      )}
    </div>
  )
}
