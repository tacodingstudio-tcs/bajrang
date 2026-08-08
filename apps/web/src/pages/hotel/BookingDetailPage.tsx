// Booking Detail + Guest Folio — check-in, check-out, add charges, view running bill
import { useState } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { hotelApi } from '@/lib/api'
import {
  ArrowLeft, LogIn, LogOut, Plus, Trash2, BedDouble,
  User, Phone, Mail, Globe, CreditCard, Utensils, Package,
} from 'lucide-react'
import toast from 'react-hot-toast'

const CHARGE_TYPE_ICONS: Record<string, React.ElementType> = {
  room:      BedDouble,
  food:      Utensils,
  laundry:   Package,
  minibar:   Package,
  spa:       User,
  transport: Package,
  telephone: Phone,
  other:     Package,
}

const CHARGE_TYPES = [
  'room','food','laundry','minibar','spa','transport','telephone','other',
]

function AddChargeModal({ bookingId, onClose }: { bookingId: string; onClose: () => void }) {
  const queryClient = useQueryClient()
  const [form, setForm] = useState({
    chargeType:  'food',
    description: '',
    qty:         '1',
    rate:        '',
    gstRate:     '5',
    date:        new Date().toISOString().split('T')[0],
  })

  const addCharge = useMutation({
    mutationFn: (data: any) => hotelApi.addCharge(bookingId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hotel-booking', bookingId] })
      toast.success('Charge added to folio')
      onClose()
    },
    onError: (err: any) => toast.error(err?.response?.data?.error ?? 'Failed to add charge'),
  })

  const amount = (Number(form.qty) * Number(form.rate)).toFixed(2)

  function handleSubmit() {
    if (!form.description || !form.rate) { toast.error('Fill description and rate'); return }
    addCharge.mutate({
      chargeType:  form.chargeType,
      description: form.description,
      qty:         Number(form.qty),
      rate:        Number(form.rate),
      gstRate:     Number(form.gstRate),
      date:        form.date,
    })
  }

  const f = (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm({ ...form, [k]: e.target.value })

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-sm">
        <div className="p-5 border-b border-gray-100">
          <h3 className="text-base font-semibold text-gray-900">Add Folio Charge</h3>
        </div>
        <div className="p-5 space-y-3">
          <div>
            <label className="label">Charge Type</label>
            <select className="input capitalize" value={form.chargeType} onChange={f('chargeType')}>
              {CHARGE_TYPES.map(t => <option key={t} value={t} className="capitalize">{t}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Description</label>
            <input className="input" value={form.description} onChange={f('description')}
              placeholder={form.chargeType === 'food' ? 'e.g. Dinner for 2' : 'Description'} />
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
            <div>
              <label className="label">GST %</label>
              <select className="input" value={form.gstRate} onChange={f('gstRate')}>
                {[0,5,12,18,28].map(r => <option key={r} value={r}>{r}%</option>)}
              </select>
            </div>
            <div>
              <label className="label">Date</label>
              <input className="input" type="date" value={form.date} onChange={f('date')} />
            </div>
          </div>
          {form.rate && (
            <div className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3">
              Amount: <strong>₹{Number(amount).toLocaleString('en-IN')}</strong>
              {Number(form.gstRate) > 0 && (
                <span className="text-gray-400 ml-2">
                  + ₹{(Number(amount) * Number(form.gstRate) / 100).toFixed(2)} GST
                </span>
              )}
            </div>
          )}
        </div>
        <div className="flex gap-2 p-5 border-t border-gray-100">
          <button type="button" onClick={onClose} className="btn-ghost flex-1 justify-center">Cancel</button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={addCharge.isPending}
            className="btn-primary flex-1 justify-center"
          >
            {addCharge.isPending ? 'Adding…' : 'Add Charge'}
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

  const checkIn = useMutation({
    mutationFn: () => hotelApi.checkIn(booking.id, { idType, idNumber, formCFiled: formC }),
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
