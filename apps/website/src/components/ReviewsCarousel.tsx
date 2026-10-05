import { useEffect, useState } from 'react'
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

// Auto-advancing carousel — reviews grouped into pages of `perPage`, sliding
// as a whole page at a time (stacked vertically within a page on mobile,
// a 3-column row on desktop). Pauses on hover so a review can be read.
export function ReviewsCarousel({ reviews, perPage = 3, intervalMs = 6000 }: {
  reviews: ReviewItem[]
  perPage?: number
  intervalMs?: number
}) {
  const pageCount = Math.max(1, Math.ceil(reviews.length / perPage))
  const [page, setPage] = useState(0)
  const [paused, setPaused] = useState(false)

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
    >
      <div className="overflow-hidden">
        <div
          className="flex transition-transform duration-700 ease-out"
          style={{ transform: `translateX(-${page * 100}%)` }}
        >
          {Array.from({ length: pageCount }).map((_, p) => (
            <div key={p} className="w-full shrink-0 grid sm:grid-cols-3 gap-6">
              {reviews.slice(p * perPage, p * perPage + perPage).map((r) => (
                <ReviewCard key={r.name} {...r} />
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
          <div className="flex items-center gap-2">
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
