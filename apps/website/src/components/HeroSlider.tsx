import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, MapPin } from 'lucide-react'

export interface SlideItem {
  img: string
  alt: string
  place: string
  distance: string
}

/**
 * Auto-advancing crossfade background for the hero, with a slow Ken-Burns
 * zoom on the active slide for a sense of motion rather than a static photo.
 * In `compact` mode the caption is a small pill (top-right), leaving the
 * frame free for hero copy laid over the top by the parent.
 */
export function HeroSlider({
  slides, intervalMs = 5500, compact = false,
}: { slides: SlideItem[]; intervalMs?: number; compact?: boolean }) {
  const [index, setIndex] = useState(0)

  useEffect(() => {
    const t = setInterval(() => setIndex(i => (i + 1) % slides.length), intervalMs)
    return () => clearInterval(t)
  }, [slides.length, intervalMs])

  const go = (delta: number) => setIndex(i => (i + delta + slides.length) % slides.length)
  const active = slides[index]!

  return (
    <div className="absolute inset-0 overflow-hidden">
      {slides.map((s, i) => (
        <img
          key={s.place}
          src={s.img}
          alt={s.alt}
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-[1500ms] ${
            i === index ? 'opacity-100 animate-[kenBurns_7s_ease-out_forwards]' : 'opacity-0'
          }`}
        />
      ))}
      {/* warm vignette so every photo reads consistently with the palette */}
      <div className="absolute inset-0 bg-gradient-to-br from-maroon-950/20 via-transparent to-gold-900/10 mix-blend-multiply" />

      {compact ? (
        <div className="absolute top-24 right-4 sm:right-8 flex items-center gap-3 bg-maroon-950/50 backdrop-blur-md border border-gold-400/20 rounded-full pl-4 pr-2 py-2 shadow-lg shadow-black/30">
          <MapPin size={14} className="text-gold-300 shrink-0" />
          <div className="text-white text-xs sm:text-sm">
            <span className="font-semibold">{active.place}</span>
            <span className="text-gold-200/70"> · {active.distance}</span>
          </div>
          <div className="flex items-center gap-0.5 ml-1 pl-2 border-l border-white/15">
            <button onClick={() => go(-1)} aria-label="Previous" className="w-6 h-6 flex items-center justify-center rounded-full text-white/70 hover:text-white hover:bg-white/10 transition-colors">
              <ChevronLeft size={14} />
            </button>
            <button onClick={() => go(1)} aria-label="Next" className="w-6 h-6 flex items-center justify-center rounded-full text-white/70 hover:text-white hover:bg-white/10 transition-colors">
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="absolute bottom-6 left-6 right-6 flex items-end justify-between">
            <div>
              <div className="font-serif text-xl text-white">{active.place}</div>
              <div className="text-gold-300 text-xs font-semibold tracking-[0.15em] uppercase mt-1">
                {active.distance} from Bajrang Stay Inn
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => go(-1)} aria-label="Previous" className="w-8 h-8 flex items-center justify-center border border-white/30 text-white hover:bg-white hover:text-maroon-900 transition-colors">
                <ChevronLeft size={15} />
              </button>
              <button onClick={() => go(1)} aria-label="Next" className="w-8 h-8 flex items-center justify-center border border-white/30 text-white hover:bg-white hover:text-maroon-900 transition-colors">
                <ChevronRight size={15} />
              </button>
            </div>
          </div>
          <div className="absolute top-6 left-6 flex gap-2">
            {slides.map((s, i) => (
              <button
                key={s.place}
                onClick={() => setIndex(i)}
                aria-label={`Show ${s.place}`}
                className={`h-1 rounded-full transition-all ${i === index ? 'w-8 bg-gold-400' : 'w-4 bg-white/40 hover:bg-white/60'}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
