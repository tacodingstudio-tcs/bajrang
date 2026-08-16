import { Phone, Mail, MapPin } from 'lucide-react'
import { Reveal } from '../components/Reveal'
import { Seo } from '../components/Seo'
import { useWebsiteContent } from '../lib/useWebsiteContent'

const DEFAULT_PHONE   = '+91 2795 23 4567'
const DEFAULT_EMAIL   = 'stay@bajrangstayinn.example'
const DEFAULT_ADDRESS = 'Kodinar, Gir Somnath, Gujarat, India'

export function ContactPage() {
  const content = useWebsiteContent()
  const contact = content.contact ?? {}
  const phone   = contact.phone   || DEFAULT_PHONE
  const email   = contact.email   || DEFAULT_EMAIL
  const address = contact.address || DEFAULT_ADDRESS

  return (
    <div>
      <Seo
        title="Contact Us — Bajrang Stay Inn, Kodinar"
        description="Get in touch with Bajrang Stay Inn, Kodinar — phone, email, and address for questions or booking assistance."
        breadcrumbs={[{ name: 'Home', path: '/' }, { name: 'Contact', path: '/contact' }]}
      />
      <section className="relative bg-maroon-900 py-16 overflow-hidden">
        <div
          className="absolute inset-0"
          style={{ backgroundImage: 'radial-gradient(circle, rgba(193,150,67,0.5) 1px, transparent 1px)', backgroundSize: '20px 20px' }}
        />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex items-center gap-3 mb-3">
            <span className="w-8 h-px bg-gold-500" />
            <span className="text-gold-400 text-xs font-semibold tracking-[0.2em] uppercase">Get In Touch</span>
          </div>
          <h1 className="font-serif text-4xl sm:text-5xl text-white">Contact Us</h1>
          <p className="text-maroon-100/60 mt-4 max-w-md">Have a question before booking? Reach out any time.</p>
        </div>
      </section>

      <div className="bg-ivory-50">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-16">
          <div className="grid sm:grid-cols-3 gap-x-8 gap-y-8">
            <Reveal delay={0}>
              <div className="group border border-maroon-100 p-6 h-full hover:border-gold-400 hover:shadow-lg hover:shadow-maroon-900/5 transition-all">
                <div className="w-10 h-10 rounded-full bg-maroon-50 flex items-center justify-center mb-4 group-hover:bg-gold-100 transition-colors">
                  <Phone size={16} className="text-gold-600" />
                </div>
                <div className="font-serif text-ink-900 mb-1.5">Phone</div>
                <a href={`tel:${phone.replace(/[^\d+]/g, '')}`} className="text-sm text-ink-800/60 hover:text-maroon-700">{phone}</a>
              </div>
            </Reveal>
            <Reveal delay={90}>
              <div className="group border border-maroon-100 p-6 h-full hover:border-gold-400 hover:shadow-lg hover:shadow-maroon-900/5 transition-all">
                <div className="w-10 h-10 rounded-full bg-maroon-50 flex items-center justify-center mb-4 group-hover:bg-gold-100 transition-colors">
                  <Mail size={16} className="text-gold-600" />
                </div>
                <div className="font-serif text-ink-900 mb-1.5">Email</div>
                <a href={`mailto:${email}`} className="text-sm text-ink-800/60 hover:text-maroon-700">{email}</a>
              </div>
            </Reveal>
            <Reveal delay={180}>
              <div className="group border border-maroon-100 p-6 h-full hover:border-gold-400 hover:shadow-lg hover:shadow-maroon-900/5 transition-all">
                <div className="w-10 h-10 rounded-full bg-maroon-50 flex items-center justify-center mb-4 group-hover:bg-gold-100 transition-colors">
                  <MapPin size={16} className="text-gold-600" />
                </div>
                <div className="font-serif text-ink-900 mb-1.5">Address</div>
                <span className="text-sm text-ink-800/60">{address}</span>
              </div>
            </Reveal>
          </div>
        </div>
      </div>
    </div>
  )
}
