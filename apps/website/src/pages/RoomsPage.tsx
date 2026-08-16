import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Wifi, Tv, Flame, Wind, Users, ArrowUpRight, Expand } from 'lucide-react'
import { api, type RoomTypeSummary } from '../lib/api'
import { photo, handleImageError } from '../lib/images'
import { Reveal } from '../components/Reveal'
import { Seo } from '../components/Seo'

const amenityIcons: Record<string, typeof Wifi> = {
  hasWifi: Wifi, hasTv: Tv, hasGeyser: Flame, hasAc: Wind,
}
const amenityLabels: Record<string, string> = {
  hasWifi: 'Wi-Fi', hasTv: 'TV', hasGeyser: 'Hot water', hasAc: 'AC',
}
const roomTypeTag: Record<string, string> = {
  standard: 'hotel,room',
  deluxe:   'hotel,suite',
  suite:    'luxury,suite',
  villa:    'resort,villa',
}

export function RoomsPage() {
  const { data: rooms, isLoading } = useQuery({
    queryKey: ['public-rooms'],
    queryFn: async () => (await api.get<RoomTypeSummary[]>('/hotel/rooms')).data,
  })

  return (
    <div>
      <Seo
        title="Rooms & Rates — Bajrang Stay Inn, Kodinar"
        description="Browse room types at Bajrang Stay Inn, Kodinar — Standard, Deluxe, Suite and Villa, with rates, occupancy, and amenities for each."
        breadcrumbs={[{ name: 'Home', path: '/' }, { name: 'Rooms', path: '/rooms' }]}
      />
      <section className="relative bg-maroon-900 py-16 overflow-hidden">
        <div
          className="absolute inset-0"
          style={{ backgroundImage: 'radial-gradient(circle, rgba(193,150,67,0.5) 1px, transparent 1px)', backgroundSize: '20px 20px' }}
        />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex items-center gap-3 mb-3">
            <span className="w-8 h-px bg-gold-500" />
            <span className="text-gold-400 text-xs font-semibold tracking-[0.2em] uppercase">Accommodation</span>
          </div>
          <h1 className="font-serif text-4xl sm:text-5xl text-white">Rooms & Rates</h1>
          <p className="text-maroon-100/60 mt-4 max-w-md">Every room includes complimentary Wi-Fi and daily housekeeping.</p>
        </div>
      </section>

      <div className="bg-ivory-50">
        {isLoading && <p className="text-ink-800/60 max-w-6xl mx-auto px-4 sm:px-6 py-14">Loading rooms…</p>}
        {rooms && rooms.length === 0 && <p className="text-ink-800/60 max-w-6xl mx-auto px-4 sm:px-6 py-14">No rooms configured yet.</p>}

        {/* Alternating editorial rows — image and detail swap sides — rather
            than a uniform card grid. */}
        <div className="divide-y divide-maroon-100">
          {rooms?.map((r, i) => {
            const reversed = i % 2 === 1
            return (
              <Reveal key={r.roomType}>
                <div className="grid lg:grid-cols-2">
                  <Link
                    to={`/rooms/${r.roomType}`}
                    className={`relative h-72 lg:h-[26rem] overflow-hidden group block ${reversed ? 'lg:order-2' : ''}`}
                  >
                    <img
                      src={r.imageUrl || photo(roomTypeTag[r.roomType] ?? 'hotel,room', 900, 700, 400 + i)}
                      onError={handleImageError}
                      alt={`${r.roomType} room, up to ${r.maxOccupancy} guests — Bajrang Stay Inn, Kodinar`}
                      className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
                    <span className="absolute top-6 left-6 font-serif text-5xl text-white/30">{String(i + 1).padStart(2, '0')}</span>
                    <span className="absolute bottom-5 left-6 flex items-center gap-1.5 bg-white/95 text-maroon-900 text-xs font-bold tracking-wide uppercase px-3.5 py-2 group-hover:bg-gold-400 transition-colors">
                      <Expand size={13} /> View details
                    </span>
                  </Link>
                  <div className={`flex flex-col justify-center px-6 sm:px-14 py-12 lg:py-0 ${reversed ? 'lg:order-1' : ''}`}>
                    <Link to={`/rooms/${r.roomType}`} className="w-fit">
                      <div className="text-2xl sm:text-3xl font-serif text-ink-900 capitalize hover:text-maroon-700 transition-colors">{r.roomType}</div>
                    </Link>
                    <div className="flex items-center gap-1.5 text-sm text-ink-800/50 mt-2">
                      <Users size={14} /> Up to {r.maxOccupancy} guests · {r.roomCount} rooms available
                    </div>

                    <div className="flex flex-wrap gap-5 mt-6">
                      {(['hasAc', 'hasTv', 'hasWifi', 'hasGeyser'] as const)
                        .filter(k => r[k])
                        .map(k => {
                          const Icon = amenityIcons[k]!
                          return (
                            <span key={k} className="flex items-center gap-1.5 text-xs text-ink-800/60">
                              <Icon size={13} className="text-gold-600" /> {amenityLabels[k]}
                            </span>
                          )
                        })}
                    </div>

                    <div className="flex items-center gap-8 mt-8">
                      <div>
                        <div className="text-maroon-700 font-serif text-2xl">
                          ₹{r.fromRate.toLocaleString('en-IN')}
                          <span className="text-sm font-sans text-ink-800/40"> / night</span>
                        </div>
                      </div>
                      <Link
                        to={`/book?roomType=${r.roomType}`}
                        className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-900 border-b border-ink-900/20 hover:border-gold-500 hover:text-maroon-700 pb-0.5 transition-colors"
                      >
                        Book this room <ArrowUpRight size={14} />
                      </Link>
                    </div>
                  </div>
                </div>
              </Reveal>
            )
          })}
        </div>
      </div>
    </div>
  )
}
