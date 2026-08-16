import { Link, NavLink, useLocation, useOutlet } from 'react-router-dom'
import { Menu, X, Phone, Mail, MapPin, ArrowUpRight } from 'lucide-react'
import { useEffect, useState } from 'react'
import { motion, AnimatePresence, useScroll, useSpring } from 'framer-motion'
import { CursorGlow } from './CursorGlow'
import { useSeoSettings } from '../lib/useSeoSettings'
import { useWebsiteContent } from '../lib/useWebsiteContent'

// Height of the homepage's welcome ribbon (the short dark section between
// the nav and the hero photo) — used to decide when the nav should switch
// from "blends with the ribbon" to "transparent over the hero photo". Keep
// in sync with the ribbon's actual rendered height in HomePage.tsx.
const RIBBON_HEIGHT = 285

type NavMode = 'dark' | 'transparent' | 'light'

const navLinkClass = (mode: NavMode) => ({ isActive }: { isActive: boolean }) => {
  const light = mode !== 'light'
  return `text-xs font-medium tracking-[0.15em] uppercase transition-colors ${
    isActive
      ? (light ? 'text-white' : 'text-maroon-700')
      : (light ? 'text-white/75 hover:text-white' : 'text-ink-800/70 hover:text-maroon-700')
  }`
}

const DEFAULT_TAGLINE = 'A considered stay near Somnath, minutes from the Saurashtra coast — quiet rooms, warm hospitality, and everything within easy reach.'
const DEFAULT_PROVERB = '"अतिथि देवो भवः" — the guest is akin to God'
const DEFAULT_POWERED_BY = 'Twisha Consultancy Services'
const DEFAULT_PHONE = '+91 2795 23 4567'
const DEFAULT_EMAIL = 'stay@bajrangstayinn.example'
const DEFAULT_ADDRESS = 'Kodinar, Gir Somnath, Gujarat'

export function SiteLayout() {
  useSeoSettings()
  const content = useWebsiteContent()
  const footer  = content.footer  ?? {}
  const contact = content.contact ?? {}
  const [open, setOpen] = useState(false)
  const [navMode, setNavMode] = useState<NavMode>('dark')
  const { pathname } = useLocation()
  const outlet = useOutlet()
  const isHome = pathname === '/'

  const { scrollYProgress } = useScroll()
  const progressWidth = useSpring(scrollYProgress, { stiffness: 200, damping: 30, restDelta: 0.001 })

  useEffect(() => {
    // Non-home pages: always solid light nav. Their <main> has top padding
    // reserved for the fixed header (see the pt-16/pt-20 below), so the
    // header never actually overlaps their hero band — a transparent header
    // there would just float over blank space, making white logo/nav text
    // invisible against nothing behind it.
    // Home page: dark nav merges with the welcome ribbon (no transparent
    // overlap with its text) while scrolled within it; solid light nav the
    // moment you scroll past it. Deliberately no "transparent over the hero
    // photo" phase at all — the hero has its own floating elements (the
    // photo slider's location pill, near its top) that scroll upward with
    // the page and would collide with the header's text while transparent.
    // A fixed pixel threshold for "safely past that pill" is fragile against
    // future hero content changes, so solid-as-soon-as-scrolled is the
    // robust choice over a prettier but breakable transparent window.
    const onScroll = () => {
      if (!isHome) {
        setNavMode('light')
        return
      }
      setNavMode(window.scrollY < RIBBON_HEIGHT ? 'dark' : 'light')
    }
    onScroll()
    window.addEventListener('scroll', onScroll)
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [isHome])

  // Land at the top on every route change instead of keeping scroll position.
  useEffect(() => { window.scrollTo(0, 0) }, [pathname])

  const isLight = navMode !== 'light' // true for both 'dark' and 'transparent' — white text either way

  return (
    <div className="min-h-screen flex flex-col">
      <CursorGlow />

      {/* scroll progress bar */}
      <motion.div
        className="fixed top-0 left-0 right-0 h-[2px] bg-gold-500 origin-left z-50"
        style={{ scaleX: progressWidth }}
      />

      <header
        className={`fixed top-0 inset-x-0 z-30 transition-all duration-300 ${
          navMode === 'transparent' ? 'bg-transparent'
          : navMode === 'dark' ? 'bg-maroon-900/95 backdrop-blur-sm'
          : 'bg-ivory-50/95 backdrop-blur border-b border-maroon-100'
        }`}
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 sm:h-20 flex items-center justify-between">
          <Link to="/" className="flex flex-col leading-none">
            <span className={`font-serif text-lg sm:text-xl tracking-wide ${isLight ? 'text-white' : 'text-ink-900'}`}>
              Bajrang Stay Inn
            </span>
            <span className={`text-[10px] tracking-[0.3em] uppercase mt-1 ${isLight ? 'text-gold-300' : 'text-gold-600'}`}>
              Kodinar
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-10">
            <NavLink to="/" end className={navLinkClass(navMode)}>Home</NavLink>
            <NavLink to="/rooms" className={navLinkClass(navMode)}>Rooms</NavLink>
            <NavLink to="/amenities" className={navLinkClass(navMode)}>Amenities</NavLink>
            <NavLink to="/gallery" className={navLinkClass(navMode)}>Gallery</NavLink>
            <NavLink to="/guide" className={navLinkClass(navMode)}>Guide</NavLink>
            <NavLink to="/contact" className={navLinkClass(navMode)}>Contact</NavLink>
          </nav>

          <div className="hidden md:flex items-center gap-6">
            <a href="tel:+912795234567" className={`flex items-center gap-1.5 text-sm ${isLight ? 'text-white/85' : 'text-ink-800'}`}>
              <Phone size={14} /> +91 2795 23 4567
            </a>
            <Link
              to="/book"
              className={`text-xs font-semibold tracking-[0.15em] uppercase px-6 py-3 border transition-colors ${
                isLight
                  ? 'border-white/60 text-white hover:bg-white hover:text-maroon-800'
                  : 'border-maroon-700 text-maroon-800 hover:bg-maroon-800 hover:text-white'
              }`}
            >
              Book Now
            </Link>
          </div>

          <button
            className={isLight ? 'text-white md:hidden' : 'text-ink-900 md:hidden'}
            onClick={() => setOpen(o => !o)}
            aria-label="Toggle menu"
          >
            {open ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>

        {open && (
          <div className="md:hidden bg-ivory-50 border-t border-maroon-100 px-4 py-4 flex flex-col gap-4">
            <NavLink to="/" end className={navLinkClass('light')} onClick={() => setOpen(false)}>Home</NavLink>
            <NavLink to="/rooms" className={navLinkClass('light')} onClick={() => setOpen(false)}>Rooms</NavLink>
            <NavLink to="/amenities" className={navLinkClass('light')} onClick={() => setOpen(false)}>Amenities</NavLink>
            <NavLink to="/gallery" className={navLinkClass('light')} onClick={() => setOpen(false)}>Gallery</NavLink>
            <NavLink to="/guide" className={navLinkClass('light')} onClick={() => setOpen(false)}>Guide</NavLink>
            <NavLink to="/contact" className={navLinkClass('light')} onClick={() => setOpen(false)}>Contact</NavLink>
            <Link
              to="/book"
              onClick={() => setOpen(false)}
              className="text-xs font-semibold tracking-[0.15em] uppercase border border-maroon-700 text-maroon-800 px-4 py-3 text-center"
            >
              Book Now
            </Link>
          </div>
        )}
      </header>

      <main className={`flex-1 ${isHome ? '' : 'pt-16 sm:pt-20'}`}>
        <AnimatePresence mode="wait">
          <motion.div
            key={pathname}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
          >
            {outlet}
          </motion.div>
        </AnimatePresence>
      </main>

      <footer className="relative bg-[radial-gradient(ellipse_at_top_left,_#5a1f26_0%,_#331215_45%,_#210b0e_100%)] text-maroon-50 mt-14 overflow-hidden">
        <div
          className="absolute inset-0 opacity-40"
          style={{ backgroundImage: 'radial-gradient(circle, rgba(233,196,120,0.35) 1px, transparent 1px)', backgroundSize: '22px 22px' }}
        />
        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-gold-500/50 to-transparent" />

        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 py-16 grid gap-12 sm:grid-cols-2 lg:grid-cols-[1.3fr_1fr_1fr_1fr]">
          <div>
            <div className="font-serif text-2xl text-white tracking-wide mb-1">Bajrang Stay Inn</div>
            <div className="text-[10px] tracking-[0.3em] uppercase text-gold-400 mb-4">Kodinar, Gujarat</div>
            <p className="text-sm text-maroon-100/70 leading-relaxed max-w-xs">
              {footer.tagline || DEFAULT_TAGLINE}
            </p>
            <Link
              to="/book"
              className="inline-flex items-center gap-2 mt-6 text-xs font-semibold tracking-[0.15em] uppercase bg-gold-500 hover:bg-gold-400 text-maroon-900 px-5 py-3 transition-colors"
            >
              Check availability
              <ArrowUpRight size={14} />
            </Link>
          </div>

          <div>
            <div className="text-xs font-semibold text-gold-400 uppercase tracking-[0.15em] mb-4">Explore</div>
            <nav className="flex flex-col gap-2.5">
              <Link to="/" className="text-sm text-maroon-100/80 hover:text-white transition-colors w-fit">Home</Link>
              <Link to="/rooms" className="text-sm text-maroon-100/80 hover:text-white transition-colors w-fit">Rooms</Link>
              <Link to="/amenities" className="text-sm text-maroon-100/80 hover:text-white transition-colors w-fit">Amenities</Link>
              <Link to="/contact" className="text-sm text-maroon-100/80 hover:text-white transition-colors w-fit">Contact</Link>
            </nav>
          </div>

          <div>
            <div className="text-xs font-semibold text-gold-400 uppercase tracking-[0.15em] mb-4">Contact</div>
            <div className="flex flex-col gap-3">
              <a href={`tel:${(contact.phone || DEFAULT_PHONE).replace(/[^\d+]/g, '')}`} className="flex items-center gap-2.5 text-sm text-maroon-100/85 hover:text-white transition-colors">
                <Phone size={14} className="text-gold-400 shrink-0" /> {contact.phone || DEFAULT_PHONE}
              </a>
              <a href={`mailto:${contact.email || DEFAULT_EMAIL}`} className="flex items-center gap-2.5 text-sm text-maroon-100/85 hover:text-white transition-colors">
                <Mail size={14} className="text-gold-400 shrink-0" /> {contact.email || DEFAULT_EMAIL}
              </a>
              <div className="flex items-start gap-2.5 text-sm text-maroon-100/85">
                <MapPin size={14} className="text-gold-400 shrink-0 mt-0.5" /> {contact.address || DEFAULT_ADDRESS}
              </div>
            </div>
          </div>

          <div>
            <div className="text-xs font-semibold text-gold-400 uppercase tracking-[0.15em] mb-4">Property</div>
            <div className="flex flex-col gap-2.5">
              <a
                href="/admin"
                className="text-sm text-white hover:text-gold-400 transition-colors underline decoration-gold-500/40 underline-offset-4 w-fit"
              >
                Staff login →
              </a>
              <p className="text-xs text-maroon-100/50 mt-1 leading-relaxed">
                Front desk staffed round the clock for guests and management alike.
              </p>
            </div>
          </div>
        </div>

        <div className="relative border-t border-white/10 max-w-6xl mx-auto px-4 sm:px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
          <div className="flex flex-col sm:flex-row items-center gap-1.5 sm:gap-4">
            <span className="text-xs text-maroon-100/50">
              © {new Date().getFullYear()} Bajrang Stay Inn, Kodinar. All rights reserved.
              <span className="text-maroon-100/30"> · Powered by {footer.poweredBy || DEFAULT_POWERED_BY}</span>
            </span>
            <span className="flex items-center gap-3">
              <Link to="/privacy-policy" className="text-xs text-maroon-100/50 hover:text-white transition-colors">Privacy Policy</Link>
              <Link to="/terms-conditions" className="text-xs text-maroon-100/50 hover:text-white transition-colors">Terms & Conditions</Link>
            </span>
          </div>
          <span className="text-xs text-maroon-100/40 italic font-serif">
            {footer.proverb || DEFAULT_PROVERB}
          </span>
        </div>
      </footer>
    </div>
  )
}
