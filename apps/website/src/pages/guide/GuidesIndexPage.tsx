import { Link } from 'react-router-dom'
import { ArrowUpRight } from 'lucide-react'
import { handleImageError } from '../../lib/images'
import { Reveal } from '../../components/Reveal'
import { Seo } from '../../components/Seo'
import { TiltCard } from '../../components/TiltCard'
import { defaultGuides, type GuideEntry } from './guides'
import { useWebsiteContent, mergeByKey } from '../../lib/useWebsiteContent'

export function GuidesIndexPage() {
  const content = useWebsiteContent()
  const guides = mergeByKey<GuideEntry>(defaultGuides, content.guides?.items, 'slug')

  return (
    <div className="bg-ivory-50">
      <Seo
        title="Travel Guides — Bajrang Stay Inn, Kodinar"
        description="Guides to Somnath, Gir National Park, Diu, and more — everything worth seeing near Bajrang Stay Inn, Kodinar."
        breadcrumbs={[{ name: 'Home', path: '/' }, { name: 'Guide', path: '/guide' }]}
      />

      <section className="relative bg-maroon-900 py-16 overflow-hidden">
        <div
          className="absolute inset-0"
          style={{ backgroundImage: 'radial-gradient(circle, rgba(193,150,67,0.5) 1px, transparent 1px)', backgroundSize: '20px 20px' }}
        />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex items-center gap-3 mb-3">
            <span className="w-8 h-px bg-gold-500" />
            <span className="text-gold-400 text-xs font-semibold tracking-[0.2em] uppercase">Travel Guides</span>
          </div>
          <h1 className="font-serif text-4xl sm:text-5xl text-white">Worth the drive from Kodinar</h1>
          <p className="text-maroon-100/60 mt-4 max-w-md">
            Everything we tell guests who ask what to see nearby — written up properly, one place at a time.
          </p>
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16">
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {guides.map((g, i) => (
            <Reveal key={g.slug} delay={i * 100}>
              <Link to={g.path} className="group block h-full">
                <TiltCard className="relative h-64 overflow-hidden mb-4">
                  <img loading="lazy" decoding="async"
                    src={g.heroImg}
                    alt={g.heroAlt}
                    onError={handleImageError}
                    className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                </TiltCard>
                <h2 className="font-serif text-lg text-ink-900 group-hover:text-maroon-700 transition-colors mb-1.5">
                  {g.title}
                </h2>
                <p className="text-sm text-ink-800/70 leading-relaxed mb-2">{g.excerpt}</p>
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-gold-600 group-hover:text-maroon-700 transition-colors">
                  Read guide <ArrowUpRight size={12} className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                </span>
              </Link>
            </Reveal>
          ))}
        </div>
      </div>
    </div>
  )
}
