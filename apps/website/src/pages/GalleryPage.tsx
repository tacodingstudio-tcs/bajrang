import { useState } from 'react'
import { X, ChevronLeft, ChevronRight, Images } from 'lucide-react'
import { handleImageError } from '../lib/images'
import { Reveal } from '../components/Reveal'
import { Seo } from '../components/Seo'
import { useWebsiteContent } from '../lib/useWebsiteContent'

export function GalleryPage() {
  const content = useWebsiteContent()
  const items = content.gallery?.items ?? []
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  return (
    <div className="bg-ivory-50">
      <Seo
        title="Gallery — Bajrang Stay Inn, Kodinar"
        description="Photos of Bajrang Stay Inn, Kodinar — rooms, common areas, and the property."
        breadcrumbs={[{ name: 'Home', path: '/' }, { name: 'Gallery', path: '/gallery' }]}
      />

      <section className="relative bg-maroon-900 py-16 overflow-hidden">
        <div
          className="absolute inset-0"
          style={{ backgroundImage: 'radial-gradient(circle, rgba(193,150,67,0.5) 1px, transparent 1px)', backgroundSize: '20px 20px' }}
        />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex items-center gap-3 mb-3">
            <span className="w-8 h-px bg-gold-500" />
            <span className="text-gold-400 text-xs font-semibold tracking-[0.2em] uppercase">Gallery</span>
          </div>
          <h1 className="font-serif text-4xl sm:text-5xl text-white">A look around</h1>
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16">
        {items.length === 0 ? (
          <div className="text-center py-16 text-ink-800/40">
            <Images className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p>Photos coming soon.</p>
          </div>
        ) : (
          <div className="columns-2 sm:columns-3 gap-4 [column-fill:balance]">
            {items.map((img, i) => (
              <Reveal key={i} delay={(i % 9) * 60}>
                <button
                  type="button"
                  onClick={() => setOpenIndex(i)}
                  className="group block w-full mb-4 overflow-hidden break-inside-avoid"
                >
                  <img
                    src={img.url}
                    alt={img.caption ?? `Bajrang Stay Inn, Kodinar — photo ${i + 1}`}
                    onError={handleImageError}
                    className="w-full h-auto object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                </button>
              </Reveal>
            ))}
          </div>
        )}
      </div>

      {openIndex !== null && items[openIndex] && (
        <div
          className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4"
          onClick={() => setOpenIndex(null)}
        >
          <button
            type="button"
            onClick={() => setOpenIndex(null)}
            className="absolute top-5 right-5 text-white/70 hover:text-white"
            aria-label="Close"
          >
            <X size={28} />
          </button>

          {openIndex > 0 && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setOpenIndex(openIndex - 1) }}
              className="absolute left-4 sm:left-8 text-white/70 hover:text-white"
              aria-label="Previous photo"
            >
              <ChevronLeft size={32} />
            </button>
          )}
          {openIndex < items.length - 1 && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setOpenIndex(openIndex + 1) }}
              className="absolute right-4 sm:right-8 text-white/70 hover:text-white"
              aria-label="Next photo"
            >
              <ChevronRight size={32} />
            </button>
          )}

          <img
            src={items[openIndex].url}
            alt={items[openIndex].caption ?? `Bajrang Stay Inn, Kodinar — photo ${openIndex + 1}`}
            onClick={(e) => e.stopPropagation()}
            className="max-h-[85vh] max-w-[90vw] object-contain"
          />
          {items[openIndex].caption && (
            <p className="absolute bottom-6 text-white/70 text-sm text-center px-4">{items[openIndex].caption}</p>
          )}
        </div>
      )}
    </div>
  )
}
