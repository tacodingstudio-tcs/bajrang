import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Search, ChevronDown, Calendar, Users } from 'lucide-react'
import { api, type RoomTypeSummary } from '../lib/api'

function todayISO(offsetDays = 0) {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  return d.toISOString().slice(0, 10)
}

function formatDisplayDate(iso: string) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

const guestOptions = [
  { adults: 1, children: 0 },
  { adults: 2, children: 0 },
  { adults: 2, children: 1 },
  { adults: 2, children: 2 },
  { adults: 3, children: 0 },
  { adults: 4, children: 0 },
]

/** The horizontal "Book a Stay" search widget — modeled on Taj Hotels' homepage search bar. */
export function BookingSearchBar() {
  const navigate = useNavigate()

  const { data: rooms } = useQuery({
    queryKey: ['public-rooms'],
    queryFn: async () => (await api.get<RoomTypeSummary[]>('/hotel/rooms')).data,
  })

  const [roomType, setRoomType] = useState('')
  const [checkIn, setCheckIn]   = useState(todayISO(1))
  const [checkOut, setCheckOut] = useState(todayISO(2))
  const [guests, setGuests]     = useState(0) // index into guestOptions

  const { adults, children } = guestOptions[guests]!

  function handleSubmit() {
    const p = new URLSearchParams({
      checkIn, checkOut,
      adults: String(adults), children: String(children),
    })
    if (roomType) p.set('roomType', roomType)
    navigate(`/book?${p.toString()}`)
  }

  return (
    <section className="relative z-10 px-4 sm:px-6 -mt-6 sm:-mt-8">
      <div className="max-w-4xl mx-auto bg-white shadow-2xl shadow-maroon-950/20 border border-gold-200/60">
        <div className="h-1.5 bg-gradient-to-r from-maroon-700 via-gold-500 to-maroon-700" />
        <div className="px-6 sm:px-10 pt-7 sm:pt-8 pb-6 sm:pb-7">
          <div className="flex items-center justify-center gap-4 mb-8">
            <span className="w-8 h-px bg-gold-500" />
            <h2 className="font-serif text-base sm:text-lg tracking-[0.2em] uppercase text-maroon-900">Book a Stay</h2>
            <span className="w-8 h-px bg-gold-500" />
          </div>

          <div className="grid sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-maroon-100 border border-maroon-100">
            <div className="flex items-center gap-3 px-4 py-4">
              <Search size={16} className="text-gold-600 shrink-0" />
              <div className="w-full">
                <div className="text-[10px] font-semibold uppercase tracking-wide text-ink-800/70 mb-0.5">Room type</div>
                <select
                  aria-label="Room type"
                  value={roomType}
                  onChange={e => setRoomType(e.target.value)}
                  className="w-full bg-transparent text-sm text-ink-900 focus:outline-none appearance-none"
                >
                  <option value="">Any room type</option>
                  {rooms?.map(r => (
                    <option key={r.roomType} value={r.roomType} className="capitalize">{r.roomType}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center gap-3 px-4 py-4">
              <Calendar size={16} className="text-gold-600 shrink-0" />
              <div className="w-full">
                <div className="text-[10px] font-semibold uppercase tracking-wide text-ink-800/70 mb-0.5">Check in — Check out</div>
                <div className="flex items-center gap-2">
                  <label className="relative text-sm text-ink-900 cursor-pointer">
                    {formatDisplayDate(checkIn)}
                    <input
                      type="date" value={checkIn} min={todayISO()}
                      onChange={e => setCheckIn(e.target.value)}
                      className="absolute inset-0 opacity-0 cursor-pointer"
                    />
                  </label>
                  <span className="text-ink-800/70">—</span>
                  <label className="relative text-sm text-ink-900 cursor-pointer">
                    {formatDisplayDate(checkOut)}
                    <input
                      type="date" value={checkOut} min={checkIn}
                      onChange={e => setCheckOut(e.target.value)}
                      className="absolute inset-0 opacity-0 cursor-pointer"
                    />
                  </label>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 px-4 py-4">
              <Users size={16} className="text-gold-600 shrink-0" />
              <div className="w-full">
                <div className="text-[10px] font-semibold uppercase tracking-wide text-ink-800/70 mb-0.5">Guests</div>
                <div className="flex items-center gap-2">
                  <select
                    aria-label="Guests"
                    value={guests}
                    onChange={e => setGuests(Number(e.target.value))}
                    className="w-full bg-transparent text-sm text-ink-900 focus:outline-none appearance-none"
                  >
                    {guestOptions.map((g, i) => (
                      <option key={i} value={i}>{g.adults} Adult{g.adults > 1 ? 's' : ''}, {g.children} Child{g.children !== 1 ? 'ren' : ''} · 1 Room</option>
                    ))}
                  </select>
                  <ChevronDown size={14} className="text-ink-800/70 shrink-0" />
                </div>
              </div>
            </div>
          </div>

          <button
            onClick={handleSubmit}
            className="group w-full flex items-center justify-center gap-2 bg-maroon-800 hover:bg-gold-500 text-white hover:text-maroon-900 text-xs font-bold tracking-[0.2em] uppercase py-4 mt-6 transition-colors"
          >
            <Search size={14} />
            Check Availability
          </button>
        </div>
      </div>
    </section>
  )
}
