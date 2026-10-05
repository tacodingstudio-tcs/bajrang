import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Wifi, Tv, Flame, Wind, Users, ArrowUpRight, ArrowLeft, BedDouble, X, ChevronLeft, ChevronRight, Expand } from 'lucide-react'
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

// Fallback copy used only when the admin hasn't written a description for
// this room type yet — generic but honest, never invents specific amenities.
const defaultDescriptions: Record<string, string> = {
  standard: "A comfortable, no-fuss room with everything you need for a good night's stay — clean, quiet, and well looked after.",
  deluxe:   'A larger room with a bit more room to spread out, for guests who want extra comfort without going all the way to a suite.',
  suite:    'Our most spacious rooms, suited to longer stays or guests who want extra room and a few more comforts.',
  villa:    'A private, self-contained space for guests who want more room and more privacy than a standard room offers.',
}

export function RoomDetailPage() {
  const { roomType } = useParams<{ roomType: string }>()
  const [activeIndex, setActiveIndex] = useState(0)
  const [lightboxOpen, setLightboxOpen] = useState(false)

  const { data: rooms, isLoading } = useQuery({
    queryKey: ['public-rooms'],
    queryFn: async () => (await api.get<RoomTypeSummary[]>('/hotel/rooms')).data,
  })

  const room = rooms?.find((r) => r.roomType === roomType)

  if (isLoading) {
    return <div className="bg-ivory-50 min-h-[60vh] flex items-center justify-center text-ink-800/70">Loading…</div>
  }

  if (!room) {
    return (
      <div className="bg-ivory-50 min-h-[60vh] flex flex-col items-center justify-center text-center px-4">
        <h1 className="font-serif text-3xl text-ink-900 mb-3">Room not found</h1>
        <p className="text-ink-800/70 mb-6">This room type may no longer be available.</p>
        <Link to="/rooms" className="inline-flex items-center gap-2 text-sm font-semibold text-maroon-700 hover:text-gold-600 transition-colors">
          <ArrowLeft size={14} /> Back to all rooms
        </Link>
      </div>
    )
  }

  const description = room.description || defaultDescriptions[room.roomType]
    || `A well-kept ${room.roomType.replace('_', ' ')} room at Bajrang Stay Inn, Kodinar.`

  const gallery = room.images && room.images.length > 0
    ? room.images
    : [room.imageUrl || photo(roomTypeTag[room.roomType] ?? 'hotel,room', 1200, 800, 500)]
  const activeImage = gallery[Math.min(activeIndex, gallery.length - 1)]!

  return (
    <div className="bg-ivory-50">
      <Seo
        title={`${room.roomType.replace('_', ' ')} Room — Bajrang Stay Inn, Kodinar`}
        description={description.slice(0, 155)}
        breadcrumbs={[
          { name: 'Home', path: '/' },
          { name: 'Rooms', path: '/rooms' },
          { name: room.roomType.replace('_', ' '), path: `/rooms/${room.roomType}` },
        ]}
      />

      <section className="relative h-[50vh] sm:h-[60vh] overflow-hidden">
        <button
          type="button"
          onClick={() => setLightboxOpen(true)}
          className="absolute inset-0 w-full h-full cursor-zoom-in"
          aria-label="Open full-size photo"
        >
          <img
            src={activeImage}
            onError={handleImageError}
            alt={`${room.roomType} room, up to ${room.maxOccupancy} guests — Bajrang Stay Inn, Kodinar`}
            className="w-full h-full object-cover"
          />
        </button>
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent pointer-events-none" />
        {gallery.length > 1 && (
          <span className="absolute top-5 right-5 flex items-center gap-1.5 bg-black/55 backdrop-blur-sm text-white text-[11px] font-semibold px-3 py-1.5 pointer-events-none">
            <Expand size={12} /> {activeIndex + 1} / {gallery.length}
          </span>
        )}
        <div className="relative h-full max-w-5xl mx-auto px-4 sm:px-6 flex flex-col justify-end pb-10 pointer-events-none">
          <Link to="/rooms" className="inline-flex items-center gap-1.5 text-xs font-semibold text-white/70 hover:text-white uppercase tracking-wide mb-4 w-fit pointer-events-auto">
            <ArrowLeft size={13} /> All rooms
          </Link>
          <h1 className="font-serif text-4xl sm:text-5xl text-white capitalize">{room.roomType.replace('_', ' ')}</h1>
          <div className="flex items-center gap-1.5 text-sm text-white/70 mt-2">
            <Users size={14} /> Up to {room.maxOccupancy} guests · {room.roomCount} room{room.roomCount !== 1 ? 's' : ''} of this type
          </div>
        </div>
      </section>

      {gallery.length > 1 && (
        <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-4">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {gallery.map((img, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setActiveIndex(i)}
                className={`shrink-0 w-20 h-16 overflow-hidden border-2 transition-colors ${
                  i === activeIndex ? 'border-gold-500' : 'border-transparent opacity-70 hover:opacity-100'
                }`}
              >
                <img src={img} onError={handleImageError} alt={`${room.roomType} photo ${i + 1}`} className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        </div>
      )}

      {lightboxOpen && (
        <div
          className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4"
          onClick={() => setLightboxOpen(false)}
        >
          <button type="button" onClick={() => setLightboxOpen(false)} className="absolute top-5 right-5 text-white/70 hover:text-white" aria-label="Close">
            <X size={28} />
          </button>
          {gallery.length > 1 && (
            <>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setActiveIndex((i) => (i - 1 + gallery.length) % gallery.length) }}
                className="absolute left-4 sm:left-8 text-white/70 hover:text-white"
                aria-label="Previous photo"
              >
                <ChevronLeft size={32} />
              </button>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setActiveIndex((i) => (i + 1) % gallery.length) }}
                className="absolute right-4 sm:right-8 text-white/70 hover:text-white"
                aria-label="Next photo"
              >
                <ChevronRight size={32} />
              </button>
            </>
          )}
          <img
            src={activeImage}
            onClick={(e) => e.stopPropagation()}
            alt={`${room.roomType} room — Bajrang Stay Inn, Kodinar`}
            className="max-h-[85vh] max-w-[90vw] object-contain"
          />
        </div>
      )}

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-14 grid lg:grid-cols-3 gap-12">
        <div className="lg:col-span-2">
          <Reveal>
            <h2 className="font-serif text-2xl text-ink-900 mb-4">About this room</h2>
            <p className="text-ink-800/75 leading-relaxed">{description}</p>
          </Reveal>

          <Reveal delay={80}>
            <h2 className="font-serif text-2xl text-ink-900 mt-10 mb-4">Amenities</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {(['hasAc', 'hasTv', 'hasWifi', 'hasGeyser'] as const)
                .filter((k) => room[k])
                .map((k) => {
                  const Icon = amenityIcons[k]!
                  return (
                    <div key={k} className="flex items-center gap-2 text-sm text-ink-800/70 border border-maroon-100 px-3 py-2.5">
                      <Icon size={15} className="text-gold-600 shrink-0" /> {amenityLabels[k]}
                    </div>
                  )
                })}
              {room.viewTypes?.map((v) => (
                <div key={v} className="flex items-center gap-2 text-sm text-ink-800/70 border border-maroon-100 px-3 py-2.5 capitalize">
                  <BedDouble size={15} className="text-gold-600 shrink-0" /> {v} view
                </div>
              ))}
            </div>
          </Reveal>
        </div>

        <Reveal delay={140}>
          <div className="border border-maroon-100 p-6 lg:sticky lg:top-24">
            <div className="text-maroon-700 font-serif text-3xl">
              ₹{room.fromRate.toLocaleString('en-IN')}
              <span className="text-sm font-sans text-ink-800/70"> / night</span>
            </div>
            <p className="text-xs text-ink-800/70 mt-1 mb-6">Rate before taxes, subject to availability.</p>
            <Link
              to={`/book?roomType=${room.roomType}`}
              className="flex items-center justify-center gap-2 bg-maroon-800 hover:bg-gold-500 text-white hover:text-maroon-900 text-xs font-bold tracking-[0.15em] uppercase py-4 transition-colors"
            >
              Book this room <ArrowUpRight size={14} />
            </Link>
          </div>
        </Reveal>
      </div>
    </div>
  )
}
