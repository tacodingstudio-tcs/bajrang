import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { CheckCircle2 } from 'lucide-react'
import { api, type InquiryPayload, type InquiryResult, type RoomTypeSummary } from '../lib/api'
import { Seo } from '../components/Seo'

function todayISO(offsetDays = 0) {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  return d.toISOString().slice(0, 10)
}

const inputClass = 'w-full border border-ink-900/15 bg-white px-3.5 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-maroon-600 focus:border-maroon-600'
const labelClass = 'block text-xs font-semibold text-ink-800/70 uppercase tracking-wide mb-1.5'

export function BookPage() {
  const [params] = useSearchParams()

  const { data: rooms } = useQuery({
    queryKey: ['public-rooms'],
    queryFn: async () => (await api.get<RoomTypeSummary[]>('/hotel/rooms')).data,
  })

  const [form, setForm] = useState({
    guestName:  '',
    guestPhone: '',
    guestEmail: '',
    roomType:   params.get('roomType') ?? '',
    checkIn:    params.get('checkIn')  ?? todayISO(1),
    checkOut:   params.get('checkOut') ?? todayISO(2),
    adults:     Number(params.get('adults'))   || 2,
    children:   Number(params.get('children')) || 0,
    notes:      '',
  })

  const [result, setResult] = useState<InquiryResult | null>(null)

  const inquiry = useMutation({
    mutationFn: async (payload: InquiryPayload) =>
      (await api.post<InquiryResult>('/hotel/inquiry', payload)).data,
    onSuccess: (data) => { setResult(data); toast.success('Inquiry sent!') },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error ?? 'Something went wrong — please call the hotel.')
    },
  })

  if (result) {
    return (
      <div className="bg-ivory-50 min-h-[80vh]">
        <div className="max-w-lg mx-auto px-4 sm:px-6 py-24 text-center">
          <CheckCircle2 size={40} className="text-maroon-700 mx-auto mb-6" />
          <h1 className="font-serif text-2xl text-ink-900 mb-2">Inquiry received</h1>
          <p className="text-ink-800/60 mb-8">{result.message}</p>
          <div className="bg-white border border-maroon-100 shadow-sm p-6 text-left text-sm space-y-3">
            <div className="flex justify-between"><span className="text-ink-800/50">Reference</span><span className="font-medium">{result.folioNo}</span></div>
            <div className="flex justify-between"><span className="text-ink-800/50">Room</span><span className="font-medium capitalize">{result.roomType} · #{result.roomNo}</span></div>
            <div className="flex justify-between"><span className="text-ink-800/50">Nights</span><span className="font-medium">{result.nights}</span></div>
            <div className="flex justify-between"><span className="text-ink-800/50">Estimated total</span><span className="font-medium">₹{result.totalAmount.toLocaleString('en-IN')}</span></div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div>
      <Seo
        title="Book a Stay — Bajrang Stay Inn, Kodinar"
        description="Send a booking inquiry to Bajrang Stay Inn, Kodinar — pick your dates, room type, and guest count, and our team will confirm by phone."
        breadcrumbs={[{ name: 'Home', path: '/' }, { name: 'Book a Stay', path: '/book' }]}
      />
      <section className="relative bg-maroon-900 py-16 overflow-hidden">
        <div
          className="absolute inset-0"
          style={{ backgroundImage: 'radial-gradient(circle, rgba(193,150,67,0.5) 1px, transparent 1px)', backgroundSize: '20px 20px' }}
        />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex items-center gap-3 mb-3">
            <span className="w-8 h-px bg-gold-500" />
            <span className="text-gold-400 text-xs font-semibold tracking-[0.2em] uppercase">Reserve</span>
          </div>
          <h1 className="font-serif text-4xl sm:text-5xl text-white">Book Your Stay</h1>
          <p className="text-maroon-100/60 mt-4 max-w-md">
            Submit your details and our team will call to confirm availability and payment.
          </p>
        </div>
      </section>

      <div className="bg-ivory-50">
        <div className="max-w-xl mx-auto px-4 sm:px-6 py-16">
          <div className="bg-white border border-maroon-100 shadow-sm p-8">
          <form
            className="space-y-6"
            onSubmit={(e) => {
              e.preventDefault()
              if (!form.roomType) { toast.error('Please select a room type'); return }
              inquiry.mutate({
                ...form,
                checkIn:  new Date(form.checkIn  + 'T12:00:00').toISOString(),
                checkOut: new Date(form.checkOut + 'T10:00:00').toISOString(),
                guestEmail: form.guestEmail || undefined,
                notes:      form.notes || undefined,
              })
            }}
          >
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Full name</label>
                <input
                  required value={form.guestName}
                  onChange={e => setForm(f => ({ ...f, guestName: e.target.value }))}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Phone</label>
                <input
                  required type="tel" value={form.guestPhone}
                  onChange={e => setForm(f => ({ ...f, guestPhone: e.target.value }))}
                  className={inputClass}
                />
              </div>
            </div>

            <div>
              <label className={labelClass}>Email (optional)</label>
              <input
                type="email" value={form.guestEmail}
                onChange={e => setForm(f => ({ ...f, guestEmail: e.target.value }))}
                className={inputClass}
              />
            </div>

            <div>
              <label className={labelClass}>Room type</label>
              <select
                required value={form.roomType}
                onChange={e => setForm(f => ({ ...f, roomType: e.target.value }))}
                className={inputClass}
              >
                <option value="">Select a room type</option>
                {rooms?.map(r => (
                  <option key={r.roomType} value={r.roomType} className="capitalize">
                    {r.roomType} — ₹{r.fromRate.toLocaleString('en-IN')}/night
                  </option>
                ))}
              </select>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Check-in</label>
                <input
                  required type="date" value={form.checkIn} min={todayISO()}
                  onChange={e => setForm(f => ({ ...f, checkIn: e.target.value }))}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Check-out</label>
                <input
                  required type="date" value={form.checkOut} min={form.checkIn}
                  onChange={e => setForm(f => ({ ...f, checkOut: e.target.value }))}
                  className={inputClass}
                />
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Adults</label>
                <input
                  type="number" min={1} value={form.adults}
                  onChange={e => setForm(f => ({ ...f, adults: +e.target.value }))}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Children</label>
                <input
                  type="number" min={0} value={form.children}
                  onChange={e => setForm(f => ({ ...f, children: +e.target.value }))}
                  className={inputClass}
                />
              </div>
            </div>

            <div>
              <label className={labelClass}>Notes (optional)</label>
              <textarea
                rows={3} value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                className={inputClass}
              />
            </div>

            <button
              type="submit" disabled={inquiry.isPending}
              className="w-full bg-maroon-800 hover:bg-maroon-700 disabled:opacity-60 text-white text-xs font-bold tracking-[0.15em] uppercase py-4 transition-colors"
            >
              {inquiry.isPending ? 'Sending…' : 'Send Inquiry'}
            </button>
          </form>
          </div>
        </div>
      </div>
    </div>
  )
}
