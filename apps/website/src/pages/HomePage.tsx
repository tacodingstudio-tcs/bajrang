import { useRef } from 'react'
import { Link } from 'react-router-dom'
import { Wifi, Car, Coffee, ShieldCheck, ArrowRight, ArrowUpRight, MapPin, BedDouble, Star, Landmark, ExternalLink, Sparkles } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { m, useScroll, useTransform } from 'framer-motion'
import { api, type RoomTypeSummary } from '../lib/api'
import { photo, regionPhotos, handleImageError } from '../lib/images'
import { Reveal } from '../components/Reveal'
import { BookingSearchBar } from '../components/BookingSearchBar'
import { HeroSlider, type SlideItem } from '../components/HeroSlider'
import { CountUp } from '../components/CountUp'
import { TiltCard } from '../components/TiltCard'
import { ReviewsCarousel } from '../components/ReviewsCarousel'
import { useWebsiteContent, mergeByKey } from '../lib/useWebsiteContent'

// Everything below (hero slides, highlights, nearby places, reviews) is a
// default/fallback — admin edits from the "Website" section of the admin
// panel are merged in at render time via useWebsiteContent(). A place with
// no admin override just uses the default.

const defaultSlides: SlideItem[] = [
  { img: regionPhotos.somnathTemple, alt: 'Somnath Temple', place: 'Somnath Temple', distance: '35 km · 45 min' },
  { img: regionPhotos.mulDwarka,     alt: 'Mul Dwarka Temple', place: 'Mul Dwarka', distance: '7.3 km · 14 min' },
  { img: regionPhotos.diuFort,       alt: 'Diu Fort', place: 'Diu Fort', distance: '90 km · 1.5 hr' },
  { img: regionPhotos.kodinar,       alt: 'Jamjir Waterfall, near Kodinar', place: 'Jamjir Waterfall', distance: '18 km · 30 min' },
]

const defaultHighlights = [
  { icon: Wifi,        label: 'Free Wi-Fi',   desc: 'High-speed internet, complimentary throughout the property' },
  { icon: Car,         label: 'Free Parking', desc: 'Secure on-site parking for guests, day or night' },
  { icon: Coffee,      label: 'Breakfast',    desc: 'A hearty spread included, served 7–10:30 AM' },
  { icon: ShieldCheck, label: 'Front Desk',   desc: 'Staffed around the clock for anything you need' },
]

// Places worth the drive from Kodinar — each opens its own Google Maps
// listing on click, so guests can check timings, reviews, and directions
// without us maintaining that information ourselves.
const defaultExplore = [
  { img: regionPhotos.somnathTemple, title: 'Somnath Temple',    dist: '35 km · 45 min', desc: 'The first among the twelve Jyotirlingas, rebuilt on the Arabian Sea shore.', query: 'Somnath Temple, Gujarat', url: 'https://somnath.org/gallery/', big: true },
  { img: regionPhotos.mulDwarka,     title: 'Mul Dwarka Temple', dist: '7 km · 14 min',   desc: 'An ancient temple believed to predate Dwarka itself.', tagline: 'Older than Dwarka itself', query: 'Mul Dwarka Temple, Porbandar', url: 'https://girsomnath.nic.in/tourist-place/mool-dwarka/' },
  { img: photo('waterfall,forest', 640, 480, 21), title: 'Jamjir Waterfall', dist: '18 km · 30 min', desc: 'A seasonal cascade tucked into the Kodinar countryside.', tagline: 'A cascade in the countryside', query: 'Jamjir Waterfall, Kodinar', url: 'https://girsomnath.nic.in/tourist-place/jamjir-waterfall/' },
  { img: photo('temple,river,india', 640, 480, 22), title: 'Prachi Tirth', dist: '30 km · 40 min', desc: 'A cluster of ancient temples on the sacred Prachi river, revered as one of Saurashtra\'s holiest pilgrimage sites.', tagline: 'A sacred pilgrimage site', query: 'Prachi Tirth, Gir Somnath, Gujarat', url: 'https://girsomnath.nic.in/tourist-place/prachi-tirth/' },
  { img: photo('river,confluence,nature', 640, 480, 23), title: 'Triveni Sangam', dist: '35 km · 45 min', desc: 'Sacred confluence of three rivers, near Somnath.', tagline: 'Where three rivers meet', query: 'Triveni Sangam, Somnath, Gujarat', url: 'https://girsomnath.nic.in/tourist-place/triveni-sangam/' },
  { img: regionPhotos.girLion,       title: 'Gir National Park', dist: '55 km · 1.5 hr',  desc: 'Home to the last wild Asiatic lions on Earth.', tagline: 'Home of the Asiatic lion', query: 'Gir National Park, Gujarat', url: 'https://girlion.gujarat.gov.in/GalleryPhoto.aspx', wide: true },
  { img: regionPhotos.nagoaBeach, title: 'Diu', dist: '90 km · 1.5 hr',  desc: 'A former Portuguese colony with quiet beaches and a coastal fort.', tagline: 'Quiet beaches, old-world charm', query: 'Diu beaches, Diu', url: 'https://diu.gov.in/tourist-places/', wide: true },
]

// Placeholder testimonials — replace with real guest reviews via the admin
// "Website" section before launch.
const defaultReviews = [
  { name: 'Ansh Patel',    place: 'Ahmedabad', rating: 5, text: 'Spotless rooms and the front desk staff genuinely cared about making our Somnath trip easy. Would stay again.' },
  { name: 'Priya Shah',    place: 'Surat',     rating: 5, text: 'Quiet, comfortable, and close to everything we wanted to see. Breakfast was a nice surprise — fresh and generous.' },
  { name: 'Rakesh Mehta',  place: 'Rajkot',    rating: 4, text: 'Great value for a family stay. Parking was easy and the rooms were bigger than we expected for the price.' },
  { name: 'Meera Joshi',   place: 'Vadodara',  rating: 5, text: 'Booked last minute for a Somnath trip and they still had us checked in within minutes. Room was clean and the bed was genuinely comfortable.' },
  { name: 'Kiran Solanki', place: 'Rajkot',    rating: 4, text: 'Good base for exploring Gir and Diu. Staff gave us solid directions and timing advice that saved us a wasted trip.' },
  { name: 'Devansh Trivedi', place: 'Bhavnagar', rating: 5, text: 'Simple, honest hotel — no surprises at checkout, and the room matched exactly what we expected from the photos.' },
]

const stats = [
  { icon: BedDouble, value: '24+',  label: 'Rooms' },
  { icon: Landmark,  value: '35km', label: 'To Somnath' },
  { icon: Star,      value: '4.6',  label: 'Guest rating' },
  { icon: ShieldCheck, value: '24/7', label: 'Front desk' },
]

// Warm, layered gradient used on every dark band — richer than a flat fill,
// evokes lamplight rather than a single flat maroon wash.
const richDark = 'bg-[radial-gradient(ellipse_at_top_left,_#5a1f26_0%,_#331215_45%,_#210b0e_100%)]'
const goldTexture = {
  backgroundImage: 'radial-gradient(circle, rgba(233,196,120,0.35) 1px, transparent 1px)',
  backgroundSize: '22px 22px',
}

export function HomePage() {
  const { data: rooms } = useQuery({
    queryKey: ['public-rooms'],
    queryFn: async () => (await api.get<RoomTypeSummary[]>('/hotel/rooms')).data,
  })

  const [featured, ...rest] = rooms ?? []

  const content = useWebsiteContent()
  const nearbySlides = mergeByKey(defaultSlides, content.hero?.slides, 'place')
  const highlightItems: (typeof defaultHighlights[number])[] = mergeByKey(
    defaultHighlights.map((h) => ({ ...h, icon: h.icon })),
    (content.highlights?.items as Omit<typeof defaultHighlights[number], 'icon'>[] | undefined)?.map((h) => ({ ...h, icon: (h as { icon?: typeof Sparkles }).icon ?? Sparkles })),
    'label'
  )
  const explore = mergeByKey(defaultExplore, content.nearbyPlaces?.items, 'title')
  const reviews = mergeByKey(defaultReviews, content.reviews?.items, 'name')

  const heroRef = useRef<HTMLElement>(null)
  const { scrollYProgress: heroProgress } = useScroll({ target: heroRef, offset: ['start start', 'end start'] })
  const heroY = useTransform(heroProgress, [0, 1], ['0%', '20%'])

  return (
    <div className="bg-ivory-50">
      {/* ── Welcome ribbon — slim, sits directly below the nav, above the hero ── */}
      <section className={`relative ${richDark} overflow-hidden pt-24 sm:pt-28`}>
        <div className="absolute inset-0" style={goldTexture} />
        <Reveal className="relative max-w-3xl mx-auto px-4 sm:px-6 pb-6 sm:pb-8 text-center">
          <div className="flex items-center justify-center gap-3 mb-4">
            <span className="w-6 h-px bg-gold-500" />
            <span className="text-gold-400 text-[10px] font-semibold tracking-[0.25em] uppercase">The Kathiawadi Welcome</span>
            <span className="w-6 h-px bg-gold-500" />
          </div>
          <p className="font-gu text-base sm:text-lg font-medium text-gold-100 leading-relaxed">
            અમારા કાઠિયાવાડમાં કોક દી ભૂલો પડ ભગવાન, તું થા અમારો મહેમાન,
            <span className="block">તારું એવું કરું સન્માન કે તને સ્વર્ગ ભુલાવું શામળા.</span>
          </p>
          <p className="font-serif italic text-xs sm:text-sm text-white/50 mt-2.5">
            "O Almighty, become lost somewhere in our Kathiawad someday — be our guest, and we'll make you forget even heaven."
          </p>
        </Reveal>
      </section>

      {/* ── Full-bleed hero — slider as background, copy overlaid bottom-left ── */}
      <section ref={heroRef} data-glow className="relative min-h-[92vh] flex items-end overflow-hidden">
        <m.div style={{ y: heroY }} className="absolute inset-0 h-[120%]">
          <HeroSlider slides={nearbySlides} compact />
        </m.div>
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/35 to-black/10" />
        <div className="absolute inset-0 bg-gradient-to-r from-maroon-950/40 via-transparent to-transparent" />

        <div className="relative w-full max-w-6xl mx-auto px-4 sm:px-6 pt-32 pb-16">
          <div className="flex items-center gap-3 mb-6">
            <span className="w-8 h-px bg-gold-400" />
            <span className="text-gold-300 text-xs font-semibold tracking-[0.25em] uppercase">Kodinar, Gujarat</span>
          </div>
          <h1 className="font-serif text-5xl sm:text-7xl font-medium text-white leading-[1.08] max-w-2xl drop-shadow-lg">
            A quiet address near
            <span className="block italic text-gold-200">the temple town</span>
          </h1>
          <p className="mt-6 text-white/75 max-w-md text-base sm:text-lg leading-relaxed">
            Bajrang Stay Inn — considered stays in Kodinar, minutes from the coast
            and a short drive from Somnath.
          </p>

          <div className="mt-10 flex flex-wrap items-center gap-5">
            <Link
              to="/book"
              className="group inline-flex items-center gap-2 bg-gold-500 hover:bg-gold-400 text-maroon-900 text-xs font-bold tracking-[0.15em] uppercase px-8 py-4 shadow-lg shadow-black/30 transition-all hover:-translate-y-0.5"
            >
              Check Availability
              <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link to="/rooms" className="inline-flex items-center gap-1.5 text-white text-xs font-semibold tracking-[0.15em] uppercase border-b border-white/40 hover:border-gold-400 pb-1 transition-colors">
              View Rooms <ArrowUpRight size={13} />
            </Link>
          </div>
        </div>
      </section>

      {/* ── Stats band ───────────────────────────────────────────────────── */}
      <section className="relative bg-gradient-to-b from-gold-50 to-ivory-50 border-b border-maroon-100 overflow-hidden">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 grid grid-cols-2 sm:grid-cols-4 divide-x divide-maroon-200/60">
          {stats.map(({ icon: Icon, value, label }, i) => (
            <Reveal key={label} delay={i * 90} className="py-10 text-center">
              <Icon size={20} className="text-gold-600 mx-auto mb-2" />
              <div className="font-serif text-3xl sm:text-4xl text-maroon-800"><CountUp value={value} /></div>
              <div className="text-[11px] text-ink-800/70 uppercase tracking-[0.15em] mt-1">{label}</div>
            </Reveal>
          ))}
        </div>
      </section>

      <BookingSearchBar />

      {/* ── Highlights — real tiles, not a thin inline row ────────────────── */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 pt-16 sm:pt-20 pb-16">
        <Reveal>
          <div className="flex items-center gap-3 mb-3">
            <span className="w-8 h-px bg-gold-500" />
            <span className="text-gold-600 text-xs font-semibold tracking-[0.2em] uppercase">What's Included</span>
          </div>
          <h2 className="font-serif text-3xl sm:text-4xl text-ink-900 mb-10">Everything you'd expect, and then some</h2>
        </Reveal>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {highlightItems.map(({ icon: Icon, label, desc }, i) => (
            <Reveal key={label} delay={i * 90}>
              <div className="group relative h-full p-6 bg-gradient-to-br from-maroon-50 to-gold-50/40 border border-maroon-100 hover:border-gold-400 hover:shadow-xl hover:shadow-maroon-900/10 transition-all duration-300">
                <div className="w-12 h-12 rounded-full bg-maroon-800 flex items-center justify-center mb-5 group-hover:bg-gold-500 transition-colors duration-300">
                  <Icon size={20} className="text-gold-300 group-hover:text-maroon-900 transition-colors duration-300" />
                </div>
                <div className="font-serif text-lg text-ink-900 mb-1.5">{label}</div>
                <p className="text-sm text-ink-800/70 leading-relaxed">{desc}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── Rooms — asymmetric: one large featured room + a stacked list ── */}
      {featured && (
        <section className="border-t border-maroon-100">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16">
            <Reveal>
              <div className="flex items-center gap-3 mb-3">
                <span className="w-8 h-px bg-gold-500" />
                <span className="text-gold-600 text-xs font-semibold tracking-[0.2em] uppercase">Accommodation</span>
              </div>
              <h2 className="font-serif text-3xl sm:text-4xl text-ink-900 mb-10">Rooms built for rest</h2>
            </Reveal>

            <div className="grid lg:grid-cols-5 gap-8">
              {/* Featured room — spans wider, bigger image */}
              <Reveal className="lg:col-span-3">
                <Link to={`/rooms/${featured.roomType}`} className="group block">
                  <TiltCard className="relative h-[28rem] overflow-hidden">
                    <img loading="lazy" decoding="async"
                      src={featured.imageUrl || photo('hotel,suite', 900, 700, 900)}
                      onError={handleImageError}
                      alt={`${featured.roomType} room, up to ${featured.maxOccupancy} guests — Bajrang Stay Inn, Kodinar`}
                      className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
                    <span className="absolute top-5 left-5 bg-gold-500 text-maroon-900 text-[10px] font-bold tracking-[0.15em] uppercase px-3 py-1.5 shadow-md">
                      Featured
                    </span>
                    <div className="absolute bottom-0 left-0 right-0 p-6">
                      <div className="flex items-end justify-between mb-4">
                        <div>
                          <div className="text-3xl font-serif text-white capitalize">{featured.roomType}</div>
                          <div className="text-sm text-white/70 mt-1">Up to {featured.maxOccupancy} guests</div>
                        </div>
                        <div className="text-right">
                          <div className="text-gold-300 font-serif text-2xl">₹{featured.fromRate.toLocaleString('en-IN')}</div>
                          <div className="text-xs text-white/60">/ night</div>
                        </div>
                      </div>
                      <span className="inline-flex items-center gap-2 bg-white text-maroon-900 text-xs font-bold tracking-[0.1em] uppercase px-5 py-3 group-hover:bg-gold-400 group-hover:text-maroon-900 transition-colors">
                        View room details
                        <ArrowUpRight size={14} className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                      </span>
                    </div>
                  </TiltCard>
                </Link>
              </Reveal>

              {/* Remaining rooms — individual cards, not a flat list */}
              <div className="lg:col-span-2 flex flex-col gap-4">
                {rest.slice(0, 3).map((r, i) => (
                  <Reveal key={r.roomType} delay={(i + 1) * 100}>
                    <Link
                      to={`/rooms/${r.roomType}`}
                      className="group relative flex items-center gap-4 p-3 bg-white border border-maroon-100 shadow-sm hover:shadow-lg hover:border-gold-300 hover:-translate-y-0.5 transition-all duration-300"
                    >
                      <div className="w-24 h-24 shrink-0 overflow-hidden relative">
                        <img loading="lazy" decoding="async"
                          src={r.imageUrl || photo('hotel,bedroom', 200, 200, 910 + i)}
                          onError={handleImageError}
                          alt={`${r.roomType} room, up to ${r.maxOccupancy} guests — Bajrang Stay Inn, Kodinar`}
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-base font-serif text-ink-900 capitalize">{r.roomType}</div>
                        <div className="text-xs text-ink-800/70 mt-0.5">Up to {r.maxOccupancy} guests</div>
                        <div className="inline-flex items-center gap-1 mt-2 text-[10px] font-semibold text-maroon-700 bg-maroon-50 px-2 py-1 uppercase tracking-wide">
                          Free cancellation
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-maroon-700 font-serif text-lg">₹{r.fromRate.toLocaleString('en-IN')}</div>
                        <div className="text-[10px] text-ink-800/70 mb-1.5">/ night</div>
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-gold-600 group-hover:text-maroon-700 transition-colors">
                          View details <ArrowUpRight size={12} className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                        </span>
                      </div>
                    </Link>
                  </Reveal>
                ))}
                <Link
                  to="/rooms"
                  className="flex items-center justify-center gap-2 py-4 text-sm font-semibold text-maroon-800 border border-dashed border-maroon-200 hover:border-gold-400 hover:bg-gold-50/40 transition-colors"
                >
                  See all rooms <ArrowUpRight size={14} />
                </Link>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ── Explore — bento grid, each place opens its own Google Maps listing ── */}
      <section id="explore" className="border-t border-maroon-100 py-16 scroll-mt-24">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 mb-8">
          <span className="text-gold-600 text-[10px] font-semibold tracking-[0.25em] uppercase">Within reach</span>
          <div className="flex items-end justify-between mt-2">
            <h2 className="font-serif text-3xl sm:text-4xl text-ink-900">Kodinar & beyond</h2>
            <span className="hidden sm:block text-xs text-ink-800/70 uppercase tracking-[0.15em]">Tap a place →</span>
          </div>
          <Link to="/guide" className="inline-flex items-center gap-1.5 text-sm font-semibold text-maroon-700 hover:text-gold-600 transition-colors mt-3">
            Read our travel guides <ArrowUpRight size={13} />
          </Link>
        </div>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 grid grid-cols-2 lg:grid-cols-4 auto-rows-[13rem] gap-4">
          {explore.map(({ img, title, dist, desc, tagline, query, url, big, wide }, i) => (
            <Reveal
              key={title}
              delay={i * 80}
              className={`${big ? 'col-span-2 row-span-2' : wide ? 'col-span-2' : ''}`}
            >
              <a
                href={url ?? `https://www.google.com/search?q=${encodeURIComponent(query)}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <TiltCard className="group relative h-full overflow-hidden">
                  <img loading="lazy" decoding="async"
                    src={img}
                    alt={`${title} — ${dist} from Bajrang Stay Inn, Kodinar`}
                    onError={handleImageError}
                    className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
                  <span className="absolute top-4 right-4 flex items-center gap-1 bg-black/55 backdrop-blur-sm border border-white/10 rounded-full pl-2 pr-2.5 py-1 text-gold-300 text-[10px] font-semibold uppercase tracking-wide shadow-sm">
                    <MapPin size={11} /> {dist}
                  </span>
                  <ExternalLink
                    size={14}
                    className="absolute top-4 left-4 text-white/0 group-hover:text-white/70 transition-colors"
                  />
                  <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-5">
                    <div className={`font-serif text-white ${big ? 'text-2xl sm:text-3xl' : 'text-base sm:text-lg'}`}>{title}</div>
                    {big ? (
                      <p className="text-sm text-white/70 mt-2 max-w-sm">{desc}</p>
                    ) : (
                      <p className="text-xs text-white/60 mt-1 line-clamp-1">{tagline}</p>
                    )}
                  </div>
                </TiltCard>
              </a>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── Reviews ──────────────────────────────────────────────────────── */}
      <section className="border-t border-maroon-100 bg-gradient-to-b from-gold-50/40 to-ivory-50 py-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <Reveal>
            <div className="flex items-center gap-3 mb-3">
              <span className="w-8 h-px bg-gold-500" />
              <span className="text-gold-600 text-xs font-semibold tracking-[0.2em] uppercase">Guest Reviews</span>
            </div>
            <h2 className="font-serif text-3xl sm:text-4xl text-ink-900 mb-10">What our guests say</h2>
          </Reveal>
          <Reveal delay={80}>
            <ReviewsCarousel reviews={reviews} />
          </Reveal>
        </div>
      </section>

      {/* ── Closing CTA ──────────────────────────────────────────────────── */}
      <section className={`relative ${richDark} overflow-hidden`}>
        <div className="absolute inset-0" style={goldTexture} />
        <Reveal className="relative max-w-3xl mx-auto px-4 sm:px-6 py-20 text-center">
          <h2 className="font-serif text-3xl sm:text-4xl text-white mb-4">Ready for a quiet stay?</h2>
          <p className="text-white/60 max-w-md mx-auto mb-8">
            Check availability for your dates and we'll have a room ready — minutes from the coast, close to everything.
          </p>
          <Link
            to="/book"
            className="group inline-flex items-center gap-2 bg-gold-500 hover:bg-gold-400 text-maroon-900 text-xs font-bold tracking-[0.15em] uppercase px-8 py-4 transition-all hover:-translate-y-0.5"
          >
            Check Availability
            <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
          </Link>
        </Reveal>
      </section>
    </div>
  )
}
