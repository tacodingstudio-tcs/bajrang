// Booking Detail + Guest Folio — check-in, check-out, add charges, view running bill
import { useState } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { hotelApi, productApi, categoryApi } from '@/lib/api'
import {
  ArrowLeft, LogIn, LogOut, Plus, Trash2, BedDouble,
  User, Phone, Mail, Globe, CreditCard, Utensils, Package, Upload, Minus, ChefHat, Sparkles,
} from 'lucide-react'
import toast from 'react-hot-toast'

const MAX_ID_UPLOAD_BYTES = 700_000 // matches the server-side per-image cap

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

const CHARGE_TYPE_ICONS: Record<string, React.ElementType> = {
  room:      BedDouble,
  food:      Utensils,
  service:   Sparkles,
  laundry:   Package,
  minibar:   Package,
  spa:       User,
  transport: Package,
  telephone: Phone,
  other:     Package,
}

// Selectable in the "Other Charge" dropdown. Deliberately excludes 'minibar'
// and 'spa' — not offered as facilities here — while keeping them in
// CHARGE_TYPE_ICONS above so any pre-existing charges of that type (from
// before this change, or from a tenant that does offer them) still render
// a proper icon instead of falling through to nothing.
const CHARGE_TYPES = [
  'room','food','laundry','transport','telephone','other',
]

type CartLine = {
  key: string // productId for menu items, a generated id for custom charges
  chargeType: string
  description: string
  productId?: string
  rate: number
  gstRate: number
  qty: number
}

// ── Category-backed menu picker — feeds into the shared cart below. Its own
// scroll region, capped, so a long list never pushes the cart (and its qty
// controls) out of view. Used for both Food and Services, each pointed at
// its own product category.
function CategoryMenuPicker({
  categoryMatch, emptyIcon: EmptyIcon, emptyLabel, emptyHint, searchPlaceholder, onAdd,
}: {
  categoryMatch: RegExp
  emptyIcon: React.ElementType
  emptyLabel: string
  emptyHint: string
  searchPlaceholder: string
  onAdd: (p: any) => void
}) {
  const [search, setSearch] = useState('')

  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn:  () => categoryApi.list(),
  })
  const category = (categories ?? []).find((c: any) =>
    categoryMatch.test(c.name) || categoryMatch.test(c.slug ?? '')
  )

  const { data: productsData, isLoading } = useQuery({
    queryKey: ['products', 'menu', category?.id],
    queryFn:  () => productApi.list({ categoryId: category.id, isActive: true, limit: 200 }),
    enabled:  !!category,
  })
  const menuItems: any[] = (productsData as any)?.data ?? []
  const filtered = search
    ? menuItems.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()))
    : menuItems

  if (category && !isLoading && menuItems.length === 0) {
    return (
      <div className="py-6 text-center">
        <EmptyIcon className="w-8 h-8 mx-auto mb-3 text-gray-300" />
        <p className="text-sm text-gray-500 mb-1">{emptyLabel}</p>
        <p className="text-xs text-gray-400">{emptyHint}</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <input
        className="input"
        placeholder={searchPlaceholder}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      {isLoading ? (
        <div className="text-center py-6 text-gray-400 text-sm">Loading…</div>
      ) : (
        <div className="max-h-40 overflow-y-auto space-y-0.5 border border-gray-100 rounded-lg p-1">
          {filtered.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => onAdd(p)}
              className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-md hover:bg-gray-50 text-left"
            >
              <span className="text-sm text-gray-800">{p.name}</span>
              <span className="text-sm text-gray-500">₹{Number(p.salePrice).toLocaleString('en-IN')}</span>
            </button>
          ))}
          {filtered.length === 0 && (
            <div className="text-center py-4 text-sm text-gray-400">No matches</div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Custom charge form — laundry, spa, transport, telephone, misc, or a
// food item not on the menu. Adds one line to the shared cart below;
// doesn't submit on its own.
function CustomChargeForm({ onAdd }: { onAdd: (line: Omit<CartLine, 'key'>) => void }) {
  const [form, setForm] = useState({
    chargeType:  'laundry',
    description: '',
    qty:         '1',
    rate:        '',
    gstRate:     '5',
  })
  const f = (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm({ ...form, [k]: e.target.value })

  function handleAdd() {
    if (!form.description || !form.rate) { toast.error('Fill description and rate'); return }
    onAdd({
      chargeType:  form.chargeType,
      description: form.description,
      qty:         Number(form.qty),
      rate:        Number(form.rate),
      gstRate:     Number(form.gstRate),
    })
    setForm({ ...form, description: '', rate: '' })
  }

  return (
    <div className="space-y-3">
      <div>
        <label className="label">Charge Type</label>
        <select className="input capitalize" value={form.chargeType} onChange={f('chargeType')}>
          {CHARGE_TYPES.filter((t) => t !== 'room' && t !== 'food').map(t => <option key={t} value={t} className="capitalize">{t}</option>)}
        </select>
      </div>
      <div>
        <label className="label">Description</label>
        <input className="input" value={form.description} onChange={f('description')} placeholder="Description" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Qty</label>
          <input className="input" type="number" min="0" step="0.5" value={form.qty} onChange={f('qty')} />
        </div>
        <div>
          <label className="label">Rate (₹)</label>
          <input className="input" type="number" min="0" value={form.rate} onChange={f('rate')} />
        </div>
      </div>
      <div>
        <label className="label">GST %</label>
        <select className="input" value={form.gstRate} onChange={f('gstRate')}>
          {[0,5,12,18,28].map(r => <option key={r} value={r}>{r}%</option>)}
        </select>
      </div>
      <button type="button" onClick={handleAdd} className="btn-ghost w-full justify-center">
        <Plus className="w-4 h-4" /> Add to order
      </button>
    </div>
  )
}

function AddChargeModal({ bookingId, onClose }: { bookingId: string; onClose: () => void }) {
  const queryClient = useQueryClient()
  const [mode, setMode] = useState<'food' | 'service' | 'other'>('food')
  const [cart, setCart] = useState<CartLine[]>([])

  const addBulkCharges = useMutation({
    mutationFn: (items: any[]) => hotelApi.addChargesBulk(bookingId, { items }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hotel-booking', bookingId] })
      toast.success(`${cart.length} item${cart.length !== 1 ? 's' : ''} added to folio`)
      onClose()
    },
    onError: (err: any) => toast.error(err?.response?.data?.error ?? 'Failed to add charges'),
  })

  function addMenuItem(p: any, chargeType: string) {
    setCart((c) => {
      const existing = c.find((l) => l.productId === p.id)
      if (existing) return c.map((l) => l.productId === p.id ? { ...l, qty: l.qty + 1 } : l)
      return [...c, {
        key: p.id, chargeType, description: p.name, productId: p.id,
        rate: Number(p.salePrice), gstRate: Number(p.gstRate ?? 0), qty: 1,
      }]
    })
  }
  function addCustomLine(line: Omit<CartLine, 'key'>) {
    setCart((c) => [...c, { ...line, key: `custom-${Date.now()}-${Math.random()}` }])
  }
  function setQty(key: string, qty: number) {
    if (qty <= 0) { setCart((c) => c.filter((l) => l.key !== key)); return }
    setCart((c) => c.map((l) => l.key === key ? { ...l, qty } : l))
  }
  function removeLine(key: string) {
    setCart((c) => c.filter((l) => l.key !== key))
  }

  const total = cart.reduce((sum, l) => sum + l.qty * l.rate, 0)

  function handleSubmit() {
    if (cart.length === 0) { toast.error('Add at least one item'); return }
    addBulkCharges.mutate(cart.map((l) => ({
      chargeType:  l.chargeType,
      description: l.description,
      productId:   l.productId,
      qty:         l.qty,
      rate:        l.rate,
      gstRate:     l.gstRate,
    })))
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-sm max-h-[90vh] flex flex-col">
        {/* Everything above the footer scrolls as one unit, so on short
            screens the buttons stay pinned at the bottom instead of being
            pushed off-screen by a long menu + a growing cart. */}
        <div className="overflow-y-auto">
          <div className="p-5 pb-3 border-b border-gray-100">
            <h3 className="text-base font-semibold text-gray-900 mb-3">Add Folio Charges</h3>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setMode('food')}
                className={`flex-1 text-sm font-medium py-1.5 rounded-lg ${mode === 'food' ? 'bg-primary-50 text-primary-700' : 'text-gray-500'}`}
              >
                Food Order
              </button>
              <button
                type="button"
                onClick={() => setMode('service')}
                className={`flex-1 text-sm font-medium py-1.5 rounded-lg ${mode === 'service' ? 'bg-primary-50 text-primary-700' : 'text-gray-500'}`}
              >
                Services
              </button>
              <button
                type="button"
                onClick={() => setMode('other')}
                className={`flex-1 text-sm font-medium py-1.5 rounded-lg ${mode === 'other' ? 'bg-primary-50 text-primary-700' : 'text-gray-500'}`}
              >
                Other Charge
              </button>
            </div>
          </div>

          {/* Picker — changes with the tab */}
          <div className="p-5 pb-3">
            {mode === 'food' && (
              <CategoryMenuPicker
                categoryMatch={/food|beverage/i}
                emptyIcon={ChefHat}
                emptyLabel="No menu items yet."
                emptyHint="Add dishes from Products → Food & Beverage category, then they'll show up here."
                searchPlaceholder="Search menu…"
                onAdd={(p) => addMenuItem(p, 'food')}
              />
            )}
            {mode === 'service' && (
              <CategoryMenuPicker
                categoryMatch={/service/i}
                emptyIcon={Sparkles}
                emptyLabel="No services set up yet."
                emptyHint="Add them from Products → Services category, then they'll show up here."
                searchPlaceholder="Search services…"
                onAdd={(p) => addMenuItem(p, 'service')}
              />
            )}
            {mode === 'other' && <CustomChargeForm onAdd={addCustomLine} />}
          </div>

          {/* Cart — mixes food items and other charges from either tab in one running order. */}
          {cart.length > 0 && (
            <div className="px-5 pb-3 border-t border-gray-100 pt-3">
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                Order ({cart.length})
              </div>
              <div className="space-y-2">
                {cart.map((l) => (
                  <div key={l.key} className="flex items-center justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-gray-800 truncate">{l.description}</div>
                      <div className="text-xs text-gray-400 capitalize">{l.chargeType}</div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button type="button" onClick={() => setQty(l.key, l.qty - 1)} className="w-6 h-6 flex items-center justify-center rounded bg-gray-100 text-gray-600 hover:bg-gray-200">
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="text-sm w-5 text-center">{l.qty}</span>
                      <button type="button" onClick={() => setQty(l.key, l.qty + 1)} className="w-6 h-6 flex items-center justify-center rounded bg-gray-100 text-gray-600 hover:bg-gray-200">
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                    <span className="text-sm text-gray-500 w-16 text-right shrink-0">₹{(l.qty * l.rate).toLocaleString('en-IN')}</span>
                    <button type="button" onClick={() => removeLine(l.key)} className="text-gray-300 hover:text-red-500 shrink-0">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between pt-2 mt-2 border-t border-gray-100 text-sm font-semibold text-gray-900">
                <span>Total</span>
                <span>₹{total.toLocaleString('en-IN')}</span>
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-2 p-5 border-t border-gray-100 shrink-0">
          <button type="button" onClick={onClose} className="btn-ghost flex-1 justify-center">Cancel</button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={addBulkCharges.isPending || cart.length === 0}
            className="btn-primary flex-1 justify-center"
          >
            {addBulkCharges.isPending ? 'Adding…' : `Add ${cart.length || ''} to Folio`}
          </button>
        </div>
      </div>
    </div>
  )
}

function CheckInModal({ booking, onClose }: { booking: any; onClose: () => void }) {
  const queryClient = useQueryClient()
  const [idType, setIdType]     = useState(booking.idType ?? 'aadhar')
  const [idNumber, setIdNumber] = useState(booking.idNumber ?? '')
  const [formC, setFormC]       = useState(booking.formCFiled ?? false)
  const [idImages, setIdImages] = useState<string[]>(booking.idImages ?? [])
  const [uploading, setUploading] = useState(false)

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) { toast.error('Please choose an image file'); return }
    if (idImages.length >= 4) { toast.error('Maximum 4 photos per guest'); return }
    setUploading(true)
    try {
      const dataUrl = await fileToDataUrl(file)
      if (dataUrl.length > MAX_ID_UPLOAD_BYTES) {
        toast.error('Photo is too large — please use a smaller file (roughly under 500KB)')
        return
      }
      setIdImages((s) => [...s, dataUrl])
    } finally {
      setUploading(false)
    }
  }
  function removeImage(i: number) { setIdImages((s) => s.filter((_, idx) => idx !== i)) }

  const checkIn = useMutation({
    mutationFn: () => hotelApi.checkIn(booking.id, { idType, idNumber, formCFiled: formC, idImages }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hotel-booking', booking.id] })
      queryClient.invalidateQueries({ queryKey: ['hotel-dashboard'] })
      toast.success(`${booking.guestName} checked in to Room ${booking.roomNo}!`)
      onClose()
    },
    onError: (err: any) => toast.error(err?.response?.data?.error ?? 'Check-in failed'),
  })

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-sm">
        <div className="p-5 border-b border-gray-100">
          <h3 className="text-base font-semibold text-gray-900">Check-in: {booking.guestName}</h3>
          <p className="text-sm text-gray-500 mt-0.5">Room {booking.roomNo}</p>
        </div>
        <div className="p-5 space-y-3">
          <div>
            <label className="label">ID Type</label>
            <select className="input" value={idType} onChange={e => setIdType(e.target.value)}>
              <option value="aadhar">Aadhaar</option>
              <option value="passport">Passport</option>
              <option value="driving_license">Driving Licence</option>
              <option value="voter_id">Voter ID</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div>
            <label className="label">ID Number</label>
            <input className="input" value={idNumber} onChange={e => setIdNumber(e.target.value)} placeholder="XXXX XXXX XXXX" />
          </div>
          <div>
            <label className="label">ID Photo (front / back)</label>
            <div className="flex flex-wrap gap-2 mb-2">
              {idImages.map((img, i) => (
                <div key={i} className="relative w-16 h-16 rounded-lg overflow-hidden border border-gray-200 group">
                  <img src={img} alt={`ID photo ${i + 1}`} className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removeImage(i)}
                    className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
                    title="Remove"
                  >
                    <Trash2 className="w-4 h-4 text-white" />
                  </button>
                </div>
              ))}
              {idImages.length < 4 && (
                <label className="w-16 h-16 rounded-lg border border-dashed border-gray-300 flex flex-col items-center justify-center text-gray-400 hover:border-primary-400 hover:text-primary-500 cursor-pointer transition-colors">
                  <Upload className="w-4 h-4" />
                  <input type="file" accept="image/*" className="hidden" onChange={handleUpload} disabled={uploading} />
                </label>
              )}
            </div>
            <p className="text-xs text-gray-400">Kept with this booking only — required for police/local verification records, not shown anywhere public.</p>
          </div>
          {booking.nationality !== 'Indian' && (
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={formC} onChange={e => setFormC(e.target.checked)} className="w-4 h-4" />
              <span className="text-sm text-gray-700">Form C filed (Foreign nationals – Foreigners Act)</span>
            </label>
          )}
        </div>
        <div className="flex gap-2 p-5 border-t border-gray-100">
          <button type="button" onClick={onClose} className="btn-ghost flex-1 justify-center">Cancel</button>
          <button
            type="button"
            onClick={() => checkIn.mutate()}
            disabled={checkIn.isPending}
            className="btn-primary flex-1 justify-center bg-green-600 hover:bg-green-700"
          >
            <LogIn className="w-4 h-4 mr-1" />
            {checkIn.isPending ? 'Checking in…' : 'Check In'}
          </button>
        </div>
      </div>
    </div>
  )
}

function CheckOutModal({ booking, onClose }: { booking: any; onClose: () => void }) {
  const queryClient = useQueryClient()
  const [method, setMethod] = useState<'cash'|'card'|'upi'|'cheque'|'bank_transfer'>('cash')

  const checkOut = useMutation({
    mutationFn: () => hotelApi.checkOut(booking.id, { paymentMethod: method }),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['hotel-booking', booking.id] })
      queryClient.invalidateQueries({ queryKey: ['hotel-dashboard'] })
      toast.success(`Checked out. Balance due: ₹${result.summary.balanceDue.toLocaleString('en-IN')}`)
      onClose()
    },
    onError: (err: any) => toast.error(err?.response?.data?.error ?? 'Check-out failed'),
  })

  const totalCharges = Number(booking.totalCharges ?? 0)
  const advance      = Number(booking.advancePaid ?? 0)
  const balance      = totalCharges - advance

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-sm">
        <div className="p-5 border-b border-gray-100">
          <h3 className="text-base font-semibold text-gray-900">Check-out: {booking.guestName}</h3>
        </div>
        <div className="p-5 space-y-4">
          <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-gray-500">Total Charges</span><strong>₹{totalCharges.toLocaleString('en-IN')}</strong></div>
            <div className="flex justify-between"><span className="text-gray-500">Advance Paid</span><span className="text-green-600">- ₹{advance.toLocaleString('en-IN')}</span></div>
            <div className="border-t border-gray-200 pt-2 flex justify-between font-semibold">
              <span>{balance > 0 ? 'Balance Due' : 'Refundable'}</span>
              <span className={balance > 0 ? 'text-red-600' : 'text-green-600'}>
                ₹{Math.abs(balance).toLocaleString('en-IN')}
              </span>
            </div>
          </div>
          <div>
            <label className="label">Payment Method</label>
            <select className="input" value={method} onChange={e => setMethod(e.target.value as any)}>
              <option value="cash">Cash</option>
              <option value="card">Card</option>
              <option value="upi">UPI</option>
              <option value="cheque">Cheque</option>
              <option value="bank_transfer">Bank Transfer</option>
            </select>
          </div>
        </div>
        <div className="flex gap-2 p-5 border-t border-gray-100">
          <button type="button" onClick={onClose} className="btn-ghost flex-1 justify-center">Cancel</button>
          <button
            type="button"
            onClick={() => checkOut.mutate()}
            disabled={checkOut.isPending}
            className="btn-primary flex-1 justify-center bg-red-600 hover:bg-red-700"
          >
            <LogOut className="w-4 h-4 mr-1" />
            {checkOut.isPending ? 'Checking out…' : 'Confirm Check-out'}
          </button>
        </div>
      </div>
    </div>
  )
}

export function BookingDetailPage() {
  const { id }         = useParams<{ id: string }>()
  const [params]       = useSearchParams()
  const navigate       = useNavigate()
  const queryClient    = useQueryClient()

  const [showCharge,   setShowCharge]   = useState(false)
  const [showCheckin,  setShowCheckin]  = useState(params.get('action') === 'checkin')
  const [showCheckout, setShowCheckout] = useState(params.get('action') === 'checkout')

  const { data: booking, isLoading } = useQuery({
    queryKey: ['hotel-booking', id],
    queryFn: () => hotelApi.getBooking(id!),
    enabled: !!id,
  })

  // Repeat-guest lookup — excludes this booking itself so a checked-out
  // guest doesn't show up as "returning" on their own stay's page.
  const { data: guestHistory } = useQuery({
    queryKey: ['guest-history', booking?.guestPhone, id],
    queryFn:  () => hotelApi.guestHistory(booking!.guestPhone, id),
    enabled:  !!booking?.guestPhone,
  })

  const removeCharge = useMutation({
    mutationFn: (chargeId: string) => hotelApi.removeCharge(id!, chargeId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hotel-booking', id] })
      toast.success('Charge removed')
    },
  })

  if (isLoading) return <div className="p-8 text-center text-gray-400">Loading…</div>
  if (!booking)  return <div className="p-8 text-center text-gray-500">Booking not found</div>

  const charges      = booking.charges ?? []
  const totalCharges = Number(booking.totalCharges ?? 0)
  const advance      = Number(booking.advancePaid ?? 0)
  const balance      = totalCharges - advance

  const canCheckIn  = booking.status === 'reserved'
  const canCheckOut = booking.status === 'checked_in'
  const canAddCharge = booking.status === 'checked_in' || booking.status === 'reserved'

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button type="button" onClick={() => navigate('/hotel/bookings')} className="text-gray-400 hover:text-gray-600">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-900">{booking.guestName}</h1>
          <p className="text-sm text-gray-500 font-mono">{booking.folioNo}</p>
        </div>
        <span className={`text-xs font-medium px-3 py-1 rounded-full capitalize ${
          booking.status === 'checked_in'  ? 'bg-green-100 text-green-700' :
          booking.status === 'reserved'    ? 'bg-blue-100 text-blue-700' :
          booking.status === 'checked_out' ? 'bg-gray-100 text-gray-600' :
          'bg-red-100 text-red-600'
        }`}>
          {booking.status.replace('_', ' ')}
        </span>
        <div className="flex gap-2">
          {canCheckIn && (
            <button type="button" onClick={() => setShowCheckin(true)} className="btn-primary text-sm bg-green-600 hover:bg-green-700">
              <LogIn className="w-4 h-4 mr-1" /> Check In
            </button>
          )}
          {canCheckOut && (
            <button type="button" onClick={() => setShowCheckout(true)} className="btn-primary text-sm bg-red-600 hover:bg-red-700">
              <LogOut className="w-4 h-4 mr-1" /> Check Out
            </button>
          )}
          {canAddCharge && (
            <button type="button" onClick={() => setShowCharge(true)} className="btn-ghost text-sm">
              <Plus className="w-4 h-4 mr-1" /> Add Charge
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Guest info */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-white border border-gray-100 rounded-xl p-4 space-y-3">
            <h3 className="text-sm font-semibold text-gray-700">Guest Details</h3>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2 text-gray-700">
                <User className="w-4 h-4 text-gray-400" />
                {booking.guestName}
                <span className="text-gray-400">{booking.adults}A {booking.children > 0 ? `${booking.children}C` : ''}</span>
              </div>
              {booking.guestPhone && (
                <div className="flex items-center gap-2 text-gray-600">
                  <Phone className="w-4 h-4 text-gray-400" />{booking.guestPhone}
                </div>
              )}
              {guestHistory?.isReturning && (
                <p className="text-xs text-primary-600 font-medium">
                  ⭐ Returning guest — {guestHistory.stayCount} previous stay{guestHistory.stayCount > 1 ? 's' : ''}
                  {guestHistory.lastStay && ` · last stayed ${new Date(guestHistory.lastStay).toLocaleDateString('en-IN')}`}
                </p>
              )}
              {booking.guestEmail && (
                <div className="flex items-center gap-2 text-gray-600">
                  <Mail className="w-4 h-4 text-gray-400" />{booking.guestEmail}
                </div>
              )}
              <div className="flex items-center gap-2 text-gray-600">
                <Globe className="w-4 h-4 text-gray-400" />{booking.nationality}
              </div>
              {booking.idType && (
                <div className="flex items-center gap-2 text-gray-600">
                  <CreditCard className="w-4 h-4 text-gray-400" />
                  <span className="capitalize">{booking.idType.replace('_', ' ')}</span>: {booking.idNumber}
                </div>
              )}
              {booking.idImages?.length > 0 && (
                <div className="flex items-center gap-2 pt-1">
                  <CreditCard className="w-4 h-4 text-gray-400 shrink-0" />
                  <div className="flex gap-1.5">
                    {booking.idImages.map((img: string, i: number) => (
                      <a key={i} href={img} target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded border border-gray-200 overflow-hidden block">
                        <img src={img} alt={`ID photo ${i + 1}`} className="w-full h-full object-cover" />
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="bg-white border border-gray-100 rounded-xl p-4 space-y-3">
            <h3 className="text-sm font-semibold text-gray-700">Booking Info</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Room</span>
                <span className="font-medium">{booking.roomNo} ({booking.roomType})</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Floor</span>
                <span>{booking.floor ?? '–'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Check-in</span>
                <span>{new Date(booking.checkIn).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Check-out</span>
                <span>{new Date(booking.checkOut).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Meal Plan</span>
                <span className="font-medium">{booking.mealPlan}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Rate/Night</span>
                <span className="font-medium">₹{Number(booking.ratePerNight).toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Source</span>
                <span className="capitalize">{booking.bookingSource?.replace('_', ' ')}</span>
              </div>
              {booking.notes && (
                <div className="pt-1 border-t border-gray-100 text-gray-500 text-xs italic">
                  {booking.notes}
                </div>
              )}
            </div>
          </div>

          {/* Bill summary */}
          <div className="bg-white border border-gray-100 rounded-xl p-4 space-y-3">
            <h3 className="text-sm font-semibold text-gray-700">Bill Summary</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Total Charges</span>
                <strong>₹{totalCharges.toLocaleString('en-IN')}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Advance Paid</span>
                <span className="text-green-600">- ₹{advance.toLocaleString('en-IN')}</span>
              </div>
              <div className="border-t border-gray-100 pt-2 flex justify-between font-semibold">
                <span>{balance > 0 ? 'Balance Due' : 'Refundable'}</span>
                <span className={balance > 0 ? 'text-red-600' : 'text-green-600'}>
                  ₹{Math.abs(balance).toLocaleString('en-IN')}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Folio charges */}
        <div className="lg:col-span-2">
          <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900">Folio Charges</h3>
              {canAddCharge && (
                <button type="button" onClick={() => setShowCharge(true)} className="text-xs text-primary-600 hover:underline flex items-center gap-1">
                  <Plus className="w-3 h-3" /> Add Charge
                </button>
              )}
            </div>
            {charges.length === 0 ? (
              <div className="p-8 text-center text-gray-400 text-sm">No charges posted yet</div>
            ) : (
              <div className="divide-y divide-gray-50">
                {charges.map((c: any) => {
                  const Icon = CHARGE_TYPE_ICONS[c.chargeType] ?? Package
                  const isCredit = Number(c.amount) < 0
                  return (
                    <div key={c.id} className="px-4 py-3 flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                        c.chargeType === 'room'  ? 'bg-blue-100' :
                        c.chargeType === 'food'  ? 'bg-green-100' :
                        isCredit                  ? 'bg-green-100' :
                        'bg-gray-100'
                      }`}>
                        <Icon className="w-4 h-4 text-gray-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-900 truncate">{c.description}</div>
                        <div className="text-xs text-gray-400">
                          {new Date(c.date).toLocaleDateString('en-IN')} · {c.qty}×₹{Number(c.rate).toLocaleString('en-IN')}
                          {c.gstRate > 0 ? ` + ${c.gstRate}% GST` : ''}
                        </div>
                      </div>
                      <div className={`font-semibold text-sm ${isCredit ? 'text-green-600' : 'text-gray-900'}`}>
                        {isCredit ? '–' : ''}₹{Math.abs(Number(c.amount)).toLocaleString('en-IN')}
                      </div>
                      {canAddCharge && c.chargeType !== 'room' && (
                        <button
                          type="button"
                          onClick={() => removeCharge.mutate(c.id)}
                          className="p-1 text-gray-300 hover:text-red-500 transition-colors"
                          title="Remove charge"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
            {charges.length > 0 && (
              <div className="px-4 py-3 border-t border-gray-100 flex justify-between font-semibold text-sm bg-gray-50">
                <span>Total</span>
                <span>₹{totalCharges.toLocaleString('en-IN')}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {showCharge   && <AddChargeModal  bookingId={id!}  onClose={() => setShowCharge(false)} />}
      {showCheckin  && <CheckInModal   booking={booking} onClose={() => setShowCheckin(false)} />}
      {showCheckout && <CheckOutModal  booking={booking} onClose={() => setShowCheckout(false)} />}
    </div>
  )
}
