import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Quote, Star } from 'lucide-react'

export interface ReviewItem {
  name: string
  place: string
  rating: number
  text: string
}

function ReviewCard({ name, place, rating, text }: ReviewItem) {
  return (
    <div className="h-full bg-white border border-maroon-100 p-6 shadow-sm">
      <Quote size={22} className="text-gold-400 mb-4" fill="currentColor" strokeWidth={0} />
      <div className="flex items-center gap-0.5 mb-3">
        {Array.from({ length: 5 }).map((_, s) => (
          <Star key={s} size={13} className={s < rating ? 'text-gold-500' : 'text-maroon-100'} fill="currentColor" strokeWidth={0} />
        ))}
      </div>
      <p className="text-sm text-ink-800/75 leading-relaxed mb-5">"{text}"</p>
      <div className="flex items-center gap-3 pt-4 border-t border-maroon-50">
        <div className="w-9 h-9 rounded-full bg-maroon-800 text-gold-300 font-serif text-sm flex items-center justify-center shrink-0">
          {name.charAt(0)}
        </div>
        <div>
          <div className="text-sm font-semibold text-ink-900">{name}</div>
          <div className="text-xs text-ink-800/70">{place}</div>
        </div>
      </div>
    </div>
  )
}

// One review per page on phones (so a long list never lengthens the page), three
// across from the `sm` breakpoint up.
function useIsDesktop() {
  const query = '(min-width: 640px)'
  const [desktop, setDesktop] = useState(() => typeof window !== 'undefined' && window.matchMedia(query).matches)
  useEffect(() => {
    const mq = window.matchMedia(query)
    const on = () => setDesktop(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return desktop
}

// Auto-advancing carousel — reviews grouped into pages (1 per page on mobile,
// `perPage` on desktop), sliding one page at a time. Pauses on hover/touch so a
// review can be read; swipe left/right on touch screens.
export function ReviewsCarousel({ reviews, perPage = 3, intervalMs = 6000 }: {
  reviews: ReviewItem[]
  perPage?: number
  intervalMs?: number
}) {
  const isDesktop = useIsDesktop()
  const per = isDesktop ? perPage : 1
  const pageCount = Math.max(1, Math.ceil(reviews.length / per))
  const [page, setPage] = useState(0)
  const [paused, setPaused] = useState(false)
  const touchX = useRef<number | null>(null)

  // keep the current page valid when the layout (per-page) or list changes
  useEffect(() => { setPage((p) => Math.min(p, pageCount - 1)) }, [pageCount])

  useEffect(() => {
    if (paused || pageCount <= 1) return
    const t = setInterval(() => setPage((p) => (p + 1) % pageCount), intervalMs)
    return () => clearInterval(t)
  }, [paused, pageCount, intervalMs])

  const go = (delta: number) => setPage((p) => (p + delta + pageCount) % pageCount)

  return (
    <div
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={(e) => { setPaused(true); touchX.current = e.touches[0]?.clientX ?? null }}
      onTouchEnd={(e) => {
        const start = touchX.current
        const end = e.changedTouches[0]?.clientX
        touchX.current = null
        if (start != null && end != null && Math.abs(end - start) > 40) go(end < start ? 1 : -1)
        setPaused(false)
      }}
    >
      <div className="overflow-hidden">
        <div
          className="flex transition-transform duration-700 ease-out"
          style={{ transform: `translateX(-${page * 100}%)` }}
        >
          {Array.from({ length: pageCount }).map((_, p) => (
            <div key={p} className="w-full shrink-0 grid sm:grid-cols-3 gap-6">
              {reviews.slice(p * per, p * per + per).map((r, i) => (
                <ReviewCard key={`${r.name}-${p * per + i}`} {...r} />
              ))}
            </div>
          ))}
        </div>
      </div>

      {pageCount > 1 && (
        <div className="flex items-center justify-center gap-4 mt-8">
          <button
            type="button"
            onClick={() => go(-1)}
            aria-label="Previous reviews"
            className="w-9 h-9 flex items-center justify-center border border-maroon-200 text-maroon-800 hover:bg-maroon-800 hover:text-white transition-colors"
          >
            <ChevronLeft size={16} />
          </button>
          <div className="sm:hidden text-sm tabular-nums text-ink-800/70" aria-live="polite">
            {page + 1} / {pageCount}
          </div>
          <div className="hidden sm:flex items-center gap-2">
            {Array.from({ length: pageCount }).map((_, p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPage(p)}
                aria-label={`Show reviews page ${p + 1}`}
                aria-current={p === page}
                className="group flex items-center justify-center w-6 h-6"
              >
                <span className={`block h-1.5 rounded-full transition-all ${p === page ? 'w-6 bg-gold-500' : 'w-1.5 bg-maroon-200 group-hover:bg-maroon-300'}`} />
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => go(1)}
            aria-label="Next reviews"
            className="w-9 h-9 flex items-center justify-center border border-maroon-200 text-maroon-800 hover:bg-maroon-800 hover:text-white transition-colors"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      )}
    </div>
  )
}
