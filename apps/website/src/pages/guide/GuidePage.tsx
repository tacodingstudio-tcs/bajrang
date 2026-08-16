import { useParams, Link } from 'react-router-dom'
import { ArrowUpRight } from 'lucide-react'
import { useWebsiteContent, mergeByKey } from '../../lib/useWebsiteContent'
import { defaultGuides, type GuideEntry } from './guides'
import { GuideLayout } from './GuideLayout'

// Renders any guide by slug — default (hardcoded) or admin-added via the
// website content API. Replaces having one React component per guide.
export function GuidePage() {
  const { slug } = useParams<{ slug: string }>()
  const content = useWebsiteContent()
  const guides = mergeByKey<GuideEntry>(defaultGuides, content.guides?.items, 'slug')
  const guide = guides.find((g) => g.slug === slug)

  if (!guide) {
    return (
      <div className="bg-ivory-50 min-h-[60vh] flex flex-col items-center justify-center text-center px-4">
        <h1 className="font-serif text-3xl text-ink-900 mb-3">Guide not found</h1>
        <p className="text-ink-800/60 mb-6">This guide may have been moved or removed.</p>
        <Link to="/guide" className="inline-flex items-center gap-2 text-sm font-semibold text-maroon-700 hover:text-gold-600 transition-colors">
          Back to all guides <ArrowUpRight size={13} />
        </Link>
      </div>
    )
  }

  return (
    <GuideLayout
      seoTitle={`${guide.title} — Bajrang Stay Inn`}
      seoDescription={guide.seoDescription}
      breadcrumbLabel={guide.title}
      path={guide.path}
      heroImg={guide.heroImg}
      heroAlt={guide.heroAlt}
      heading={guide.title}
      intro={guide.intro}
      note={guide.note}
      stopsHeading={guide.stopsHeading}
      stops={guide.stops}
      closingHeading={guide.closingHeading}
      closingText={guide.closingText}
    />
  )
}
