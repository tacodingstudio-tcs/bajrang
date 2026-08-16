import { Reveal } from '../components/Reveal'
import { Seo } from '../components/Seo'
import type { LegalContent } from '../lib/legalDefaults'

export function LegalPage({
  title, description, path, breadcrumbLabel, content, defaultContent,
}: {
  title: string
  description: string
  path: string
  breadcrumbLabel: string
  content: Partial<LegalContent> | undefined
  defaultContent: LegalContent
}) {
  const effectiveDate = content?.effectiveDate || defaultContent.effectiveDate
  const sections = content?.sections && content.sections.length > 0 ? content.sections : defaultContent.sections

  return (
    <div className="bg-ivory-50">
      <Seo
        title={`${title} — Bajrang Stay Inn, Kodinar`}
        description={description}
        breadcrumbs={[{ name: 'Home', path: '/' }, { name: breadcrumbLabel, path }]}
      />

      <section className="relative bg-maroon-900 py-16 overflow-hidden">
        <div
          className="absolute inset-0"
          style={{ backgroundImage: 'radial-gradient(circle, rgba(193,150,67,0.5) 1px, transparent 1px)', backgroundSize: '20px 20px' }}
        />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex items-center gap-3 mb-3">
            <span className="w-8 h-px bg-gold-500" />
            <span className="text-gold-400 text-xs font-semibold tracking-[0.2em] uppercase">Bajrang Stay Inn</span>
          </div>
          <h1 className="font-serif text-4xl sm:text-5xl text-white">{title}</h1>
          <p className="text-maroon-100/60 mt-4">Effective {effectiveDate}</p>
        </div>
      </section>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-16">
        {sections.map((s, i) => (
          <Reveal key={s.heading} delay={i * 60}>
            <div className={i > 0 ? 'mt-10' : ''}>
              <h2 className="font-serif text-xl text-ink-900 mb-3">{s.heading}</h2>
              <p className="text-sm text-ink-800/75 leading-relaxed">{s.body}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </div>
  )
}
