import { Wifi, Car, Coffee, ShieldCheck, Utensils, Sparkles, Wind, Tv } from 'lucide-react'
import { photo, handleImageError } from '../lib/images'
import { Reveal } from '../components/Reveal'
import { Seo } from '../components/Seo'

const amenities = [
  { icon: Wifi,        title: 'Free Wi-Fi',        desc: 'High-speed internet in every room and common area.' },
  { icon: Car,         title: 'Parking',            desc: 'Complimentary on-site parking for guests.' },
  { icon: Coffee,      title: 'Breakfast',          desc: 'Complimentary breakfast served 7–10:30 AM.' },
  { icon: ShieldCheck, title: '24×7 Front Desk',     desc: 'Round-the-clock staff for check-in and assistance.' },
  { icon: Utensils,    title: 'In-room Dining',      desc: 'Food and beverages delivered straight to your room.' },
  { icon: Sparkles,    title: 'Daily Housekeeping',  desc: 'Rooms cleaned and refreshed every day of your stay.' },
  { icon: Wind,        title: 'Air Conditioning',    desc: 'Climate-controlled comfort in all room categories.' },
  { icon: Tv,          title: 'Cable TV',            desc: 'A wide channel selection in every room.' },
]

export function AmenitiesPage() {
  return (
    <div className="bg-ivory-50">
      <Seo
        title="Amenities — Bajrang Stay Inn, Kodinar"
        description="Free Wi-Fi, parking, breakfast, 24×7 front desk, daily housekeeping and more at Bajrang Stay Inn, Kodinar."
        breadcrumbs={[{ name: 'Home', path: '/' }, { name: 'Amenities', path: '/amenities' }]}
      />
      {/* Split layout: sticky image column on the left, numbered list on the
          right — instead of a header band + icon grid. */}
      <div className="lg:flex">
        <div className="relative h-[45vh] lg:h-[calc(100vh-5rem)] lg:w-[42%] lg:sticky lg:top-20 lg:self-start">
          <img
            src={photo('hotel,poolside', 900, 1200, 501)}
            onError={handleImageError}
            alt="Poolside area at Bajrang Stay Inn, Kodinar"
            className="absolute inset-0 w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-maroon-900/80 via-maroon-900/10 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 p-8 lg:p-12">
            <div className="flex items-center gap-3 mb-3">
              <span className="w-8 h-px bg-gold-400" />
              <span className="text-gold-300 text-xs font-semibold tracking-[0.2em] uppercase">In-House</span>
            </div>
            <h1 className="font-serif text-3xl sm:text-4xl text-white">Amenities</h1>
            <p className="text-white/70 mt-3 max-w-xs text-sm">Everything you need for a comfortable, unhurried stay.</p>
          </div>
        </div>

        <div className="lg:w-[58%] divide-y divide-maroon-100">
          {amenities.map(({ icon: Icon, title, desc }, i) => (
            <Reveal key={title} delay={(i % 4) * 60}>
              <div className="group flex items-start gap-6 px-6 sm:px-12 py-7">
                <span className="font-serif text-2xl text-gold-500/50 w-10 shrink-0">{String(i + 1).padStart(2, '0')}</span>
                <Icon size={18} className="text-gold-600 mt-1 shrink-0" />
                <div>
                  <div className="font-serif text-lg text-ink-900">{title}</div>
                  <p className="text-sm text-ink-800/55 leading-relaxed mt-1">{desc}</p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </div>
  )
}
