import { Link } from 'react-router-dom'
import { Clock, MapPin, ArrowUpRight, Info } from 'lucide-react'
import { handleImageError } from '../../lib/images'
import { Reveal } from '../../components/Reveal'
import { Seo, type BreadcrumbItem } from '../../components/Seo'

export interface GuideStop {
  time: string
  title: string
  text: string
  url: string
  linkLabel: string
}

export interface GuideLayoutProps {
  seoTitle: string
  seoDescription: string
  breadcrumbLabel: string
  path: string
  heroImg: string
  heroAlt: string
  eyebrow?: string
  heading: string
  intro: string
  note?: string
  stopsHeading?: string
  stops: GuideStop[]
  closingHeading: string
  closingText: string
}

// Shared shell for /guide/* pages — hero photo, intro, a stop-by-stop
// itinerary linking out to official sources, and a closing CTA back to
// booking. Content (text/links) is passed in per guide; nothing here is
// guide-specific.
export function GuideLayout({
  seoTitle, seoDescription, breadcrumbLabel, path,
  heroImg, heroAlt, eyebrow = 'Travel Guide', heading, intro, note,
  stopsHeading = 'Suggested plan', stops,
  closingHeading, closingText,
}: GuideLayoutProps) {
  const breadcrumbs: BreadcrumbItem[] = [
    { name: 'Home', path: '/' },
    { name: 'Guide', path: '/guide' },
    { name: breadcrumbLabel, path },
  ]

  return (
    <div>
      <Seo title={seoTitle} description={seoDescription} breadcrumbs={breadcrumbs} />

      <section className="relative h-[45vh] overflow-hidden">
        <img
          src={heroImg}
          alt={heroAlt}
          onError={handleImageError}
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-black/10" />
        <div className="relative h-full max-w-3xl mx-auto px-4 sm:px-6 flex flex-col justify-end pb-12">
          <span className="text-gold-300 text-xs font-semibold tracking-[0.25em] uppercase mb-3">{eyebrow}</span>
          <h1 className="font-serif text-3xl sm:text-5xl text-white leading-tight">{heading}</h1>
        </div>
      </section>

      <div className="bg-ivory-50">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-14">
          <Reveal>
            <p className="text-ink-800/75 leading-relaxed text-[15px]">{intro}</p>
          </Reveal>

          {note && (
            <Reveal delay={80}>
              <div className="flex items-start gap-3 mt-8 p-4 bg-maroon-50 border border-maroon-100">
                <Info size={16} className="text-maroon-700 shrink-0 mt-0.5" />
                <p className="text-sm text-ink-800/70 leading-relaxed">{note}</p>
              </div>
            </Reveal>
          )}

          <Reveal delay={120}>
            <h2 className="font-serif text-2xl text-ink-900 mt-12 mb-6">{stopsHeading}</h2>
          </Reveal>

          <div className="space-y-6">
            {stops.map((stop, i) => (
              <Reveal key={stop.title} delay={140 + i * 90}>
                <div className="border border-maroon-100 p-6 hover:border-gold-300 hover:shadow-sm transition-all">
                  <div className="flex items-center gap-2 text-xs font-semibold text-gold-600 uppercase tracking-wide mb-2">
                    <Clock size={12} /> {stop.time}
                  </div>
                  <h3 className="font-serif text-lg text-ink-900 mb-2">{stop.title}</h3>
                  <p className="text-sm text-ink-800/70 leading-relaxed mb-3">{stop.text}</p>
                  <a
                    href={stop.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-semibold text-maroon-700 hover:text-gold-600 transition-colors"
                  >
                    {stop.linkLabel} <ArrowUpRight size={12} />
                  </a>
                </div>
              </Reveal>
            ))}
          </div>

          <Reveal delay={140 + stops.length * 90 + 60}>
            <h2 className="font-serif text-2xl text-ink-900 mt-12 mb-4">{closingHeading}</h2>
            <p className="text-ink-800/75 leading-relaxed text-[15px] mb-4">{closingText}</p>
            <Link
              to="/#explore"
              className="inline-flex items-center gap-2 text-sm font-semibold text-maroon-800 hover:text-gold-600 transition-colors"
            >
              <MapPin size={14} /> See all nearby places on the homepage
              <ArrowUpRight size={13} />
            </Link>
          </Reveal>

          <Reveal delay={140 + stops.length * 90 + 120}>
            <div className="mt-14 pt-8 border-t border-maroon-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <p className="text-sm text-ink-800/70 max-w-sm">
                Staying at Bajrang Stay Inn puts you within easy reach of all of this — ask our front
                desk for the latest on timings and road conditions when you check in.
              </p>
              <Link
                to="/book"
                className="shrink-0 inline-flex items-center gap-2 bg-maroon-800 hover:bg-gold-500 text-white hover:text-maroon-900 text-xs font-bold tracking-[0.15em] uppercase px-6 py-3.5 transition-colors"
              >
                Book a Stay <ArrowUpRight size={13} />
              </Link>
            </div>
          </Reveal>
        </div>
      </div>
    </div>
  )
}
