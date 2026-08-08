// Hotel Bookings — list, search/filter, new reservation form
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { hotelApi } from '@/lib/api'
import { PageHeader } from '@/components/layout/PageHeader'
import { Plus, Search, Calendar, X } from 'lucide-react'
import toast from 'react-hot-toast'

const STATUS_BADGE: Record<string, string> = {
  reserved:     'bg-blue-100 text-blue-700',
  checked_in:   'bg-green-100 text-green-700',
  checked_out:  'bg-gray-100 text-gray-600',
  cancelled:    'bg-red-100 text-red-600',
  no_show:      'bg-yellow-100 text-yellow-700',
}

const BOOKING_SOURCES: Record<string, string> = {
  walk_in:         'Walk-in',
  phone:           'Phone',
  ota_makemytrip:  'MakeMyTrip',
  ota_goibibo:     'Goibibo',
  ota_booking:     'Booking.com',
  ota_agoda:       'Agoda',
  corporate:       'Corporate',
  direct_web:      'Direct/Web',
}

const MEAL_PLANS = [
  { value: 'EP',  label: 'EP – European Plan (Room Only)' },
  { value: 'CP',  label: 'CP – Continental (Breakfast)' },
  { value: 'MAP', label: 'MAP – Modified American (B+D)' },
  { value: 'AP',  label: 'AP – American Plan (All meals)' },
]

function NewBookingModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient()
  const [form, setForm] = useState({
    guestName:     '',
    guestPhone:    '',
    guestEmail:    '',
    nationality:   'Indian',
    idType:        'aadhar',
    idNumber:      '',
    adults:        '1',
    children:      '0',
    checkIn:       '',
    checkOut:      '',
    bookingSource: 'walk_in',
    mealPlan:      'EP',
    advancePaid:   '0',
    ratePerNight:  '',
    notes:         '',
    roomId:        '',
  })

  const { data: rooms = [] } = useQuery({
    queryKey: ['hotel-rooms'],
    queryFn: () => hotelApi.listRooms({ status: 'available' }),
  })

  const createBooking = useMutation({
    mutationFn: (data: any) => hotelApi.createBooking(data),
    onSuccess: () => {
      toast.success('Booking created!')
      queryClient.invalidateQueries({ queryKey: ['hotel-bookings'] })
      queryClient.invalidateQueries({ queryKey: ['hotel-dashboard'] })
      onClose()
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error ?? 'Failed to create booking')
    },
  })

  const selectedRoom = rooms.find((r: any) => r.id === form.roomId)

  function handleSubmit() {
    if (!form.guestName || !form.roomId || !form.checkIn || !form.checkOut || !form.ratePerNight) {
      toast.error('Please fill all required fields')
      return
    }
    createBooking.mutate({
      ...form,
      adults:       Number(form.adults),
      children:     Number(form.children),
      advancePaid:  Number(form.advancePaid),
      ratePerNight: Number(form.ratePerNight),
    })
  }

  const f = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm({ ...form, [k]: e.target.value })

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-2xl max-h-[95vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h3 className="text-base font-semibold text-gray-900">New Reservation</h3>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Guest info */}
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="label">Guest Name *</label>
              <input className="input" value={form.guestName} onChange={f('guestName')} placeholder="Full name" />
            </div>
            <div>
              <label className="label">Phone</label>
              <input className="input" value={form.guestPhone} onChange={f('guestPhone')} placeholder="+91 9876543210" />
            </div>
            <div>
              <label className="label">Email</label>
              <input className="input" type="email" value={form.guestEmail} onChange={f('guestEmail')} placeholder="guest@email.com" />
            </div>
            <div>
              <label className="label">Nationality</label>
              <input className="input" value={form.nationality} onChange={f('nationality')} />
            </div>
            <div>
              <label className="label">ID Type</label>
              <select className="input" value={form.idType} onChange={f('idType')}>
                <option value="aadhar">Aadhaar</option>
                <option value="passport">Passport</option>
                <option value="driving_license">Driving Licence</option>
                <option value="voter_id">Voter ID</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className="label">ID Number</label>
              <input className="input" value={form.idNumber} onChange={f('idNumber')} placeholder="XXXX XXXX XXXX" />
            </div>
            <div>
              <label className="label">Adults *</label>
              <input className="input" type="number" min="1" value={form.adults} onChange={f('adults')} />
            </div>
            <div>
              <label className="label">Children</label>
              <input className="input" type="number" min="0" value={form.children} onChange={f('children')} />
            </div>
          </div>

          <hr className="border-gray-100" />

          {/* Room + dates */}
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="label">Room *</label>
              <select className="input" value={form.roomId} onChange={f('roomId')}>
                <option value="">— Select room —</option>
                {rooms.map((r: any) => (
                  <option key={r.id} value={r.id}>
                    {r.roomNo} – {r.roomType} {r.hasAc ? '(AC)' : ''} · ₹{Number(r.ratePerNight).toLocaleString('en-IN')}/night
                  </option>
                ))}
              </select>
              {selectedRoom && (
                <div className="mt-1 text-xs text-gray-500">
                  Floor {selectedRoom.floor ?? '–'} · Max {selectedRoom.maxOccupancy} guests
                  {selectedRoom.hasWifi ? ' · WiFi' : ''}
                  {selectedRoom.hasTv ? ' · TV' : ''}
                  {selectedRoom.hasGeyser ? ' · Geyser' : ''}
                </div>
              )}
            </div>
            <div>
              <label className="label">Check-in *</label>
              <input className="input" type="datetime-local" value={form.checkIn} onChange={f('checkIn')} />
            </div>
            <div>
              <label className="label">Check-out *</label>
              <input className="input" type="datetime-local" value={form.checkOut} onChange={f('checkOut')} />
            </div>
            <div>
              <label className="label">Rate/Night (₹) *</label>
              <input
                className="input"
                type="number"
                value={form.ratePerNight}
                onChange={f('ratePerNight')}
                placeholder={selectedRoom ? String(selectedRoom.ratePerNight) : '0'}
              />
            </div>
            <div>
              <label className="label">Advance Paid (₹)</label>
              <input className="input" type="number" min="0" value={form.advancePaid} onChange={f('advancePaid')} />
            </div>
            <div>
              <label className="label">Booking Source</label>
              <select className="input" value={form.bookingSource} onChange={f('bookingSource')}>
                {Object.entries(BOOKING_SOURCES).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Meal Plan</label>
              <select className="input" value={form.mealPlan} onChange={f('mealPlan')}>
                {MEAL_PLANS.map((mp) => (
                  <option key={mp.value} value={mp.value}>{mp.label}</option>
                ))}
              </select>
            </div>
            <div className="col-span-2">
              <label className="label">Notes</label>
              <textarea className="input h-16 resize-none" value={form.notes} onChange={f('notes')} placeholder="Special requests, preferences…" />
            </div>
          </div>
        </div>

        <div className="flex gap-2 p-5 border-t border-gray-100">
          <button type="button" onClick={onClose} className="btn-ghost flex-1 justify-center">Cancel</button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={createBooking.isPending}
            className="btn-primary flex-1 justify-center"
          >
            {createBooking.isPending ? 'Creating…' : 'Create Reservation'}
          </button>
        </div>
      </div>
    </div>
  )
}

export function BookingsPage() {
  const navigate = useNavigate()
  const [search, setSearch]         = useState('')
  const [statusFilter, setStatus]   = useState('reserved,checked_in')
  const [showNew, setShowNew]       = useState(false)
  const [page, setPage]             = useState(1)

  const { data, isLoading } = useQuery({
    queryKey: ['hotel-bookings', search, statusFilter, page],
    queryFn: () => hotelApi.listBookings({
      search:  search || undefined,
      status:  statusFilter || undefined,
      page,
      limit:   20,
    }),
  })

  const bookings  = data?.data  ?? []
  const total     = data?.total ?? 0
  const totalPages = Math.ceil(total / 20)

  return (
    <div>
      <PageHeader
        title="Bookings"
        subtitle={`${total} bookings`}
        action={
          <button type="button" onClick={() => setShowNew(true)} className="btn-primary">
            <Plus className="w-4 h-4" /> New Booking
          </button>
        }
      />

      <div className="p-6 space-y-4">
        {/* Filters */}
        <div className="flex gap-3 items-center flex-wrap">
          <div className="relative max-w-sm flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              className="input pl-9"
              placeholder="Search guest, folio, phone…"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            />
          </div>
          <div className="flex gap-1">
            {[
              { value: 'reserved,checked_in', label: 'Active' },
              { value: 'reserved',            label: 'Reserved' },
              { value: 'checked_in',          label: 'In-House' },
              { value: 'checked_out',         label: 'Checked Out' },
              { value: '',                    label: 'All' },
            ].map(({ value, label }) => (
              <button
                key={value}
                type="button"
                onClick={() => { setStatus(value); setPage(1) }}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  statusFilter === value
                    ? 'bg-primary-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        {isLoading ? (
          <div className="text-center text-gray-400 py-12">Loading…</div>
        ) : bookings.length === 0 ? (
          <div className="text-center text-gray-400 py-12">No bookings found</div>
        ) : (
          <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase border-b border-gray-100">
                <tr>
                  <th className="px-4 py-2.5 text-left">Folio</th>
                  <th className="px-4 py-2.5 text-left">Guest</th>
                  <th className="px-4 py-2.5 text-left">Room</th>
                  <th className="px-4 py-2.5 text-left">Check-in</th>
                  <th className="px-4 py-2.5 text-left">Check-out</th>
                  <th className="px-4 py-2.5 text-left">Status</th>
                  <th className="px-4 py-2.5 text-right">Rate</th>
                  <th className="px-4 py-2.5 text-left">Source</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {bookings.map((bk: any) => (
                  <tr
                    key={bk.id}
                    className="hover:bg-gray-50 cursor-pointer transition-colors"
                    onClick={() => navigate(`/hotel/bookings/${bk.id}`)}
                  >
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">{bk.folioNo}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{bk.guestName}</div>
                      {bk.guestPhone && <div className="text-xs text-gray-400">{bk.guestPhone}</div>}
                    </td>
                    <td className="px-4 py-3 text-gray-700">{bk.roomNo}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {new Date(bk.checkIn).toLocaleDateString('en-IN')}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {new Date(bk.checkOut).toLocaleDateString('en-IN')}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${STATUS_BADGE[bk.status] ?? 'bg-gray-100 text-gray-600'}`}>
                        {bk.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-gray-900">
                      ₹{Number(bk.ratePerNight).toLocaleString('en-IN')}
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs">
                      {BOOKING_SOURCES[bk.bookingSource] ?? bk.bookingSource}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2">
            <button type="button" onClick={() => setPage(p => Math.max(1, p-1))} disabled={page === 1} className="btn-ghost text-sm">← Prev</button>
            <span className="text-sm text-gray-500">Page {page} of {totalPages}</span>
            <button type="button" onClick={() => setPage(p => Math.min(totalPages, p+1))} disabled={page === totalPages} className="btn-ghost text-sm">Next →</button>
          </div>
        )}
      </div>

      {showNew && <NewBookingModal onClose={() => setShowNew(false)} />}
    </div>
  )
}
