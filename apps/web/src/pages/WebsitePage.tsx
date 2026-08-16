// src/pages/WebsitePage.tsx
// Admin control panel for the public hotel website — every section listed
// here maps 1:1 to a "section" row in hotel_website_content, read by the
// website via GET /api/public/website. Leaving a field blank keeps the
// website's own hardcoded default for that field.
import { useState, useEffect, useRef } from 'react'
import { useWebsiteContent, useUpdateWebsiteSection } from '@/hooks/useApi'
import { PageHeader } from '@/components/layout/PageHeader'
import { Plus, Trash2, Globe, Star, Upload, ChevronUp, ChevronDown, Image as ImageIcon } from 'lucide-react'
import toast from 'react-hot-toast'
import {
  DEFAULT_HERO_SLIDES, DEFAULT_HIGHLIGHTS, DEFAULT_NEARBY_PLACES, DEFAULT_REVIEWS, DEFAULT_GUIDES,
  DEFAULT_CONTACT, DEFAULT_FOOTER, DEFAULT_PRIVACY_POLICY, DEFAULT_TERMS_CONDITIONS,
} from '@/lib/websiteDefaults'

type TabKey = 'general' | 'hero' | 'highlights' | 'nearby' | 'reviews' | 'guides' | 'gallery' | 'legal'

const TABS: { key: TabKey; label: string }[] = [
  { key: 'general',    label: 'General' },
  { key: 'hero',       label: 'Hero Slides' },
  { key: 'highlights', label: 'Highlights' },
  { key: 'nearby',     label: 'Nearby Places' },
  { key: 'reviews',    label: 'Reviews' },
  { key: 'gallery',    label: 'Gallery' },
  { key: 'guides',     label: 'Guides' },
  { key: 'legal',      label: 'Legal' },
]

function Row({ children, onRemove }: { children: React.ReactNode; onRemove: () => void }) {
  return (
    <div className="flex items-start gap-3 p-4 border border-gray-200 rounded-lg">
      <div className="flex-1 grid sm:grid-cols-2 gap-3">{children}</div>
      <button type="button" onClick={onRemove} className="text-gray-300 hover:text-red-500 mt-1" title="Remove">
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  )
}

function Field({ label, value, onChange, textarea, placeholder, full }: {
  label: string; value: string; onChange: (v: string) => void
  textarea?: boolean; placeholder?: string; full?: boolean
}) {
  return (
    <div className={full ? 'sm:col-span-2' : ''}>
      <label className="label text-xs">{label}</label>
      {textarea ? (
        <textarea className="input" rows={2} value={value} placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)} />
      ) : (
        <input className="input" value={value} placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)} />
      )}
    </div>
  )
}

// ── General: contact + footer ──────────────────────────────────────────────

function GeneralTab({ contact, footer }: { contact: any; footer: any }) {
  const update = useUpdateWebsiteSection()
  const [c, setC] = useState({ ...DEFAULT_CONTACT, ...contact })
  const [f, setF] = useState({ ...DEFAULT_FOOTER, ...footer })

  useEffect(() => setC({ ...DEFAULT_CONTACT, ...contact }), [contact])
  useEffect(() => setF({ ...DEFAULT_FOOTER, ...footer }), [footer])

  function save() {
    update.mutate({ section: 'contact', data: c })
    update.mutate({ section: 'footer', data: f })
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="card p-5">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">Contact info</h3>
        <div className="space-y-3">
          <Field label="Phone" value={c.phone} onChange={(v) => setC({ ...c, phone: v })} placeholder="+91 2795 23 4567" />
          <Field label="Email" value={c.email} onChange={(v) => setC({ ...c, email: v })} placeholder="stay@example.com" />
          <Field label="Address" value={c.address} onChange={(v) => setC({ ...c, address: v })} placeholder="Kodinar, Gir Somnath, Gujarat" />
        </div>
      </div>

      <div className="card p-5">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">Footer</h3>
        <div className="space-y-3">
          <Field label="Tagline" value={f.tagline} onChange={(v) => setF({ ...f, tagline: v })} textarea
            placeholder="A considered stay near Somnath…" />
          <Field label="Closing proverb / quote" value={f.proverb} onChange={(v) => setF({ ...f, proverb: v })}
            placeholder='"अतिथि देवो भवः" — the guest is akin to God' />
          <Field label="Powered by" value={f.poweredBy} onChange={(v) => setF({ ...f, poweredBy: v })} placeholder="Twisha Consultancy Services" />
        </div>
      </div>

      <button type="button" onClick={save} disabled={update.isPending} className="btn-primary">
        {update.isPending ? 'Saving…' : 'Save changes'}
      </button>
    </div>
  )
}

// ── Hero slides ─────────────────────────────────────────────────────────────

function HeroTab({ slides }: { slides: any[] | undefined }) {
  const update = useUpdateWebsiteSection()
  const seed = slides && slides.length > 0 ? slides : DEFAULT_HERO_SLIDES
  const [items, setItems] = useState<any[]>(seed)
  useEffect(() => setItems(seed), [slides])

  function set(i: number, patch: any) { setItems((s) => s.map((it, idx) => idx === i ? { ...it, ...patch } : it)) }
  function add() { setItems((s) => [...s, { place: '', distance: '', img: '', alt: '' }]) }
  function remove(i: number) { setItems((s) => s.filter((_, idx) => idx !== i)) }
  function save() { update.mutate({ section: 'hero', data: { slides: items } }) }

  return (
    <div className="space-y-4 max-w-3xl">
      <p className="text-xs text-gray-400">Background photos in the homepage hero carousel. Leave empty to keep the site's defaults.</p>
      {items.map((s, i) => (
        <Row key={i} onRemove={() => remove(i)}>
          <Field label="Place name" value={s.place ?? ''} onChange={(v) => set(i, { place: v })} placeholder="Somnath Temple" />
          <Field label="Distance" value={s.distance ?? ''} onChange={(v) => set(i, { distance: v })} placeholder="35 km · 45 min" />
          <Field label="Image URL" value={s.img ?? ''} onChange={(v) => set(i, { img: v })} full placeholder="https://…" />
          <Field label="Alt text" value={s.alt ?? ''} onChange={(v) => set(i, { alt: v })} full placeholder="Somnath Temple at sunrise" />
        </Row>
      ))}
      <button type="button" onClick={add} className="btn-ghost text-sm"><Plus className="w-4 h-4" /> Add slide</button>
      <div><button type="button" onClick={save} disabled={update.isPending} className="btn-primary">{update.isPending ? 'Saving…' : 'Save changes'}</button></div>
    </div>
  )
}

// ── Highlights ───────────────────────────────────────────────────────────────

function HighlightsTab({ items: initial }: { items: any[] | undefined }) {
  const update = useUpdateWebsiteSection()
  const seed = initial && initial.length > 0 ? initial : DEFAULT_HIGHLIGHTS
  const [items, setItems] = useState<any[]>(seed)
  useEffect(() => setItems(seed), [initial])

  function set(i: number, patch: any) { setItems((s) => s.map((it, idx) => idx === i ? { ...it, ...patch } : it)) }
  function add() { setItems((s) => [...s, { label: '', desc: '' }]) }
  function remove(i: number) { setItems((s) => s.filter((_, idx) => idx !== i)) }
  function save() { update.mutate({ section: 'highlights', data: { items } }) }

  return (
    <div className="space-y-4 max-w-3xl">
      <p className="text-xs text-gray-400">
        "What's Included" tiles on the homepage. New items get a generic icon — editing an existing item's label keeps its original icon (Wi-Fi, Parking, Breakfast, Front Desk).
      </p>
      {items.map((it, i) => (
        <Row key={i} onRemove={() => remove(i)}>
          <Field label="Label" value={it.label ?? ''} onChange={(v) => set(i, { label: v })} placeholder="Free Wi-Fi" />
          <Field label="Description" value={it.desc ?? ''} onChange={(v) => set(i, { desc: v })} placeholder="High-speed internet, complimentary throughout" />
        </Row>
      ))}
      <button type="button" onClick={add} className="btn-ghost text-sm"><Plus className="w-4 h-4" /> Add highlight</button>
      <div><button type="button" onClick={save} disabled={update.isPending} className="btn-primary">{update.isPending ? 'Saving…' : 'Save changes'}</button></div>
    </div>
  )
}

// ── Nearby places ────────────────────────────────────────────────────────────

function NearbyTab({ items: initial }: { items: any[] | undefined }) {
  const update = useUpdateWebsiteSection()
  const seed = initial && initial.length > 0 ? initial : DEFAULT_NEARBY_PLACES
  const [items, setItems] = useState<any[]>(seed)
  useEffect(() => setItems(seed), [initial])

  function set(i: number, patch: any) { setItems((s) => s.map((it, idx) => idx === i ? { ...it, ...patch } : it)) }
  function add() { setItems((s) => [...s, { title: '', dist: '', desc: '', tagline: '', query: '', url: '', img: '' }]) }
  function remove(i: number) { setItems((s) => s.filter((_, idx) => idx !== i)) }
  function save() { update.mutate({ section: 'nearbyPlaces', data: { items } }) }

  return (
    <div className="space-y-4 max-w-3xl">
      <p className="text-xs text-gray-400">The "Kodinar & beyond" grid on the homepage. Each card links out to the URL you set here when clicked.</p>
      {items.map((it, i) => (
        <Row key={i} onRemove={() => remove(i)}>
          <Field label="Title" value={it.title ?? ''} onChange={(v) => set(i, { title: v })} placeholder="Somnath Temple" />
          <Field label="Distance" value={it.dist ?? ''} onChange={(v) => set(i, { dist: v })} placeholder="35 km · 45 min" />
          <Field label="Tagline (short)" value={it.tagline ?? ''} onChange={(v) => set(i, { tagline: v })} placeholder="A sacred pilgrimage site" />
          <Field label="Link URL" value={it.url ?? ''} onChange={(v) => set(i, { url: v })} placeholder="https://…" />
          <Field label="Description" value={it.desc ?? ''} onChange={(v) => set(i, { desc: v })} textarea full />
          <Field label="Image URL" value={it.img ?? ''} onChange={(v) => set(i, { img: v })} full placeholder="https://…" />
        </Row>
      ))}
      <button type="button" onClick={add} className="btn-ghost text-sm"><Plus className="w-4 h-4" /> Add place</button>
      <div><button type="button" onClick={save} disabled={update.isPending} className="btn-primary">{update.isPending ? 'Saving…' : 'Save changes'}</button></div>
    </div>
  )
}

// ── Reviews ──────────────────────────────────────────────────────────────────

function ReviewsTab({ items: initial }: { items: any[] | undefined }) {
  const update = useUpdateWebsiteSection()
  const seed = initial && initial.length > 0 ? initial : DEFAULT_REVIEWS
  const [items, setItems] = useState<any[]>(seed)
  useEffect(() => setItems(seed), [initial])

  function set(i: number, patch: any) { setItems((s) => s.map((it, idx) => idx === i ? { ...it, ...patch } : it)) }
  function add() { setItems((s) => [...s, { name: '', place: '', rating: 5, text: '' }]) }
  function remove(i: number) { setItems((s) => s.filter((_, idx) => idx !== i)) }
  function save() { update.mutate({ section: 'reviews', data: { items } }) }

  return (
    <div className="space-y-4 max-w-3xl">
      <p className="text-xs text-gray-400 flex items-center gap-1.5">
        Guest testimonials shown on the homepage. Only add reviews guests actually gave you — fabricated reviews are misleading and can violate ad platform / review policies.
      </p>
      {items.map((it, i) => (
        <Row key={i} onRemove={() => remove(i)}>
          <Field label="Guest name" value={it.name ?? ''} onChange={(v) => set(i, { name: v })} placeholder="Ansh Patel" />
          <Field label="City" value={it.place ?? ''} onChange={(v) => set(i, { place: v })} placeholder="Ahmedabad" />
          <div>
            <label className="label text-xs">Rating (1–5)</label>
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} type="button" onClick={() => set(i, { rating: n })}>
                  <Star className={`w-5 h-5 ${n <= (it.rating ?? 5) ? 'text-gold-500 fill-gold-500' : 'text-gray-200'}`} />
                </button>
              ))}
            </div>
          </div>
          <Field label="Review text" value={it.text ?? ''} onChange={(v) => set(i, { text: v })} textarea full />
        </Row>
      ))}
      <button type="button" onClick={add} className="btn-ghost text-sm"><Plus className="w-4 h-4" /> Add review</button>
      <div><button type="button" onClick={save} disabled={update.isPending} className="btn-primary">{update.isPending ? 'Saving…' : 'Save changes'}</button></div>
    </div>
  )
}

// ── Guides ───────────────────────────────────────────────────────────────────

function GuideStopEditor({ stop, onChange, onRemove }: { stop: any; onChange: (v: any) => void; onRemove: () => void }) {
  return (
    <div className="p-3 bg-gray-50 rounded border border-gray-200 space-y-2">
      <div className="flex items-start gap-3">
        <div className="flex-1 grid sm:grid-cols-2 gap-2">
          <Field label="Time" value={stop.time ?? ''} onChange={(v) => onChange({ ...stop, time: v })} placeholder="Morning" />
          <Field label="Stop title" value={stop.title ?? ''} onChange={(v) => onChange({ ...stop, title: v })} placeholder="Somnath Temple" />
          <Field label="Text" value={stop.text ?? ''} onChange={(v) => onChange({ ...stop, text: v })} textarea full />
          <Field label="Link URL" value={stop.url ?? ''} onChange={(v) => onChange({ ...stop, url: v })} placeholder="https://…" />
          <Field label="Link label" value={stop.linkLabel ?? ''} onChange={(v) => onChange({ ...stop, linkLabel: v })} placeholder="Official gallery" />
        </div>
        <button type="button" onClick={onRemove} className="text-gray-300 hover:text-red-500 mt-1"><Trash2 className="w-4 h-4" /></button>
      </div>
    </div>
  )
}

function GuideEditor({ guide, onChange, onRemove }: { guide: any; onChange: (v: any) => void; onRemove: () => void }) {
  function setStop(i: number, v: any) {
    const stops = [...(guide.stops ?? [])]
    stops[i] = v
    onChange({ ...guide, stops })
  }
  function addStop() { onChange({ ...guide, stops: [...(guide.stops ?? []), { time: '', title: '', text: '', url: '', linkLabel: '' }] }) }
  function removeStop(i: number) { onChange({ ...guide, stops: (guide.stops ?? []).filter((_: any, idx: number) => idx !== i) }) }

  return (
    <div className="card p-5 space-y-4">
      <div className="flex items-start justify-between">
        <h3 className="text-sm font-semibold text-gray-900">{guide.title || 'New guide'}</h3>
        <button type="button" onClick={onRemove} className="text-gray-300 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        <Field label="Title" value={guide.title ?? ''} onChange={(v) => onChange({ ...guide, title: v })} placeholder="A Guide to…" />
        <Field label="URL slug" value={guide.slug ?? ''} onChange={(v) => onChange({ ...guide, slug: v, path: `/guide/${v}` })} placeholder="visiting-somnath-from-kodinar" />
        <Field label="Excerpt (for the guides list)" value={guide.excerpt ?? ''} onChange={(v) => onChange({ ...guide, excerpt: v })} full textarea />
        <Field label="Hero image URL" value={guide.heroImg ?? ''} onChange={(v) => onChange({ ...guide, heroImg: v })} placeholder="https://…" />
        <Field label="Hero image alt text" value={guide.heroAlt ?? ''} onChange={(v) => onChange({ ...guide, heroAlt: v })} />
        <Field label="SEO description" value={guide.seoDescription ?? ''} onChange={(v) => onChange({ ...guide, seoDescription: v })} full textarea />
        <Field label="Intro paragraph" value={guide.intro ?? ''} onChange={(v) => onChange({ ...guide, intro: v })} full textarea />
        <Field label="Practical note (optional)" value={guide.note ?? ''} onChange={(v) => onChange({ ...guide, note: v })} full textarea />
        <Field label="Closing heading" value={guide.closingHeading ?? ''} onChange={(v) => onChange({ ...guide, closingHeading: v })} />
        <Field label="Closing text" value={guide.closingText ?? ''} onChange={(v) => onChange({ ...guide, closingText: v })} full textarea />
      </div>

      <div>
        <label className="label text-xs mb-2">Itinerary stops</label>
        <div className="space-y-2">
          {(guide.stops ?? []).map((s: any, i: number) => (
            <GuideStopEditor key={i} stop={s} onChange={(v) => setStop(i, v)} onRemove={() => removeStop(i)} />
          ))}
        </div>
        <button type="button" onClick={addStop} className="btn-ghost text-xs mt-2"><Plus className="w-3.5 h-3.5" /> Add stop</button>
      </div>
    </div>
  )
}

// ── Gallery ──────────────────────────────────────────────────────────────────

const MAX_UPLOAD_BYTES = 700_000 // matches the server-side per-image cap

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

function GalleryTab({ items: initial }: { items: any[] | undefined }) {
  const update = useUpdateWebsiteSection()
  const [items, setItems] = useState<any[]>(initial ?? [])
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  useEffect(() => setItems(initial ?? []), [initial])

  function setCaption(i: number, caption: string) {
    setItems((s) => s.map((it, idx) => idx === i ? { ...it, caption } : it))
  }
  function remove(i: number) { setItems((s) => s.filter((_, idx) => idx !== i)) }
  function move(i: number, dir: -1 | 1) {
    setItems((s) => {
      const next = [...s]
      const j = i + dir
      if (j < 0 || j >= next.length) return s
      ;[next[i], next[j]] = [next[j]!, next[i]!]
      return next
    })
  }
  function addUrl() {
    const url = window.prompt('Image URL')
    if (url?.trim()) setItems((s) => [...s, { url: url.trim(), caption: '' }])
  }
  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) { toast.error('Please choose an image file'); return }
    setUploading(true)
    try {
      const dataUrl = await fileToDataUrl(file)
      if (dataUrl.length > MAX_UPLOAD_BYTES) {
        toast.error('Image is too large — please use a smaller file (roughly under 500KB)')
        return
      }
      setItems((s) => [...s, { url: dataUrl, caption: '' }])
    } finally {
      setUploading(false)
    }
  }
  function save() { update.mutate({ section: 'gallery', data: { items } }) }

  return (
    <div className="space-y-4 max-w-3xl">
      <p className="text-xs text-gray-400">
        Photos shown on the public website's Gallery page, in the order listed below. Add by pasting an image URL or uploading a photo directly (max ~500KB per upload).
      </p>

      <div className="flex items-center gap-2">
        <button type="button" onClick={addUrl} className="btn-ghost text-sm"><Plus className="w-4 h-4" /> Add via URL</button>
        <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading} className="btn-ghost text-sm">
          <Upload className="w-4 h-4" /> {uploading ? 'Uploading…' : 'Upload photo'}
        </button>
        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleUpload} />
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        {items.map((it, i) => (
          <div key={i} className="border border-gray-200 rounded-lg overflow-hidden">
            <div className="aspect-video bg-gray-100 flex items-center justify-center overflow-hidden">
              {it.url ? (
                <img src={it.url} alt={it.caption ?? ''} className="w-full h-full object-cover" />
              ) : (
                <ImageIcon className="w-6 h-6 text-gray-300" />
              )}
            </div>
            <div className="p-3 space-y-2">
              <input
                className="input text-xs"
                placeholder="Caption (optional)"
                value={it.caption ?? ''}
                onChange={(e) => setCaption(i, e.target.value)}
              />
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1">
                  <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="text-gray-400 hover:text-gray-700 disabled:opacity-30" title="Move up">
                    <ChevronUp className="w-4 h-4" />
                  </button>
                  <button type="button" onClick={() => move(i, 1)} disabled={i === items.length - 1} className="text-gray-400 hover:text-gray-700 disabled:opacity-30" title="Move down">
                    <ChevronDown className="w-4 h-4" />
                  </button>
                  <span className="text-xs text-gray-400 ml-1">#{i + 1}</span>
                </div>
                <button type="button" onClick={() => remove(i)} className="text-gray-300 hover:text-red-500" title="Remove">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div><button type="button" onClick={save} disabled={update.isPending} className="btn-primary">{update.isPending ? 'Saving…' : 'Save changes'}</button></div>
    </div>
  )
}

// ── Legal (Privacy Policy / Terms & Conditions) ──────────────────────────────

function LegalDocEditor({
  section, title, help, initial, defaultContent,
}: {
  section: 'privacyPolicy' | 'termsConditions'
  title: string
  help: string
  initial: { effectiveDate?: string; sections?: { heading: string; body: string }[] } | undefined
  defaultContent: { effectiveDate: string; sections: { heading: string; body: string }[] }
}) {
  const update = useUpdateWebsiteSection()
  const seedDate = initial?.effectiveDate || defaultContent.effectiveDate
  const seedSections = initial?.sections && initial.sections.length > 0 ? initial.sections : defaultContent.sections

  const [effectiveDate, setEffectiveDate] = useState(seedDate)
  const [sections, setSections] = useState(seedSections)

  useEffect(() => { setEffectiveDate(seedDate); setSections(seedSections) }, [initial])

  function setSection(i: number, patch: Partial<{ heading: string; body: string }>) {
    setSections((s) => s.map((sec, idx) => idx === i ? { ...sec, ...patch } : sec))
  }
  function addSection() { setSections((s) => [...s, { heading: '', body: '' }]) }
  function removeSection(i: number) { setSections((s) => s.filter((_, idx) => idx !== i)) }
  function save() { update.mutate({ section, data: { effectiveDate, sections } }) }

  return (
    <div className="card p-5 space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
        <p className="text-xs text-gray-400 mt-1">{help}</p>
      </div>

      <div className="max-w-xs">
        <label className="label text-xs">Effective date</label>
        <input className="input" value={effectiveDate} onChange={(e) => setEffectiveDate(e.target.value)} placeholder="15 August 2026" />
      </div>

      <div className="space-y-3">
        {sections.map((sec, i) => (
          <Row key={i} onRemove={() => removeSection(i)}>
            <Field label="Heading" value={sec.heading} onChange={(v) => setSection(i, { heading: v })} full />
            <Field label="Body" value={sec.body} onChange={(v) => setSection(i, { body: v })} textarea full />
          </Row>
        ))}
      </div>
      <button type="button" onClick={addSection} className="btn-ghost text-xs"><Plus className="w-3.5 h-3.5" /> Add section</button>
      <div><button type="button" onClick={save} disabled={update.isPending} className="btn-primary text-sm">{update.isPending ? 'Saving…' : `Save ${title}`}</button></div>
    </div>
  )
}

function LegalTab({ privacyPolicy, termsConditions }: { privacyPolicy: any; termsConditions: any }) {
  return (
    <div className="space-y-6 max-w-3xl">
      <p className="text-xs text-gray-400">
        Shown at /privacy-policy and /terms-conditions on the website, and linked from the footer.
        This starting text is generic hotel-industry boilerplate, not reviewed by a lawyer — have it checked before relying on it, and fill in the cancellation policy section with your actual terms.
      </p>
      <LegalDocEditor
        section="privacyPolicy"
        title="Privacy Policy"
        help="What information is collected from guests and how it's used."
        initial={privacyPolicy}
        defaultContent={DEFAULT_PRIVACY_POLICY}
      />
      <LegalDocEditor
        section="termsConditions"
        title="Terms & Conditions"
        help="Booking, check-in/out, cancellation, and stay policies."
        initial={termsConditions}
        defaultContent={DEFAULT_TERMS_CONDITIONS}
      />
    </div>
  )
}

function GuidesTab({ items: initial }: { items: any[] | undefined }) {
  const update = useUpdateWebsiteSection()
  const seed = initial && initial.length > 0 ? initial : DEFAULT_GUIDES
  const [items, setItems] = useState<any[]>(seed)
  useEffect(() => setItems(seed), [initial])

  function set(i: number, v: any) { setItems((s) => s.map((it, idx) => idx === i ? v : it)) }
  function add() {
    setItems((s) => [...s, {
      slug: '', path: '', title: '', excerpt: '', heroImg: '', heroAlt: '',
      seoDescription: '', intro: '', note: '', stops: [], closingHeading: '', closingText: '',
    }])
  }
  function remove(i: number) { setItems((s) => s.filter((_, idx) => idx !== i)) }
  function save() { update.mutate({ section: 'guides', data: { items } }) }

  return (
    <div className="space-y-4 max-w-3xl">
      <p className="text-xs text-gray-400">
        Full travel guide pages at /guide/&lt;slug&gt;. A guide here with the same slug as a built-in default overrides it; a new slug adds a brand-new guide.
      </p>
      {items.map((g, i) => (
        <GuideEditor key={i} guide={g} onChange={(v) => set(i, v)} onRemove={() => remove(i)} />
      ))}
      <button type="button" onClick={add} className="btn-ghost text-sm"><Plus className="w-4 h-4" /> Add guide</button>
      <div><button type="button" onClick={save} disabled={update.isPending} className="btn-primary">{update.isPending ? 'Saving…' : 'Save changes'}</button></div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function WebsitePage() {
  const { data, isLoading } = useWebsiteContent()
  const [tab, setTab] = useState<TabKey>('general')

  const content: any = data ?? {}

  return (
    <div>
      <PageHeader
        title="Website"
        subtitle="Everything shown on the public hotel website"
        action={
          <a href="http://localhost:5174" target="_blank" rel="noopener noreferrer" className="btn-ghost text-sm">
            <Globe className="w-4 h-4" /> View site
          </a>
        }
      />

      <div className="px-8 pt-4">
        <div className="flex items-center gap-1 border-b border-gray-200 mb-6">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                tab === t.key ? 'border-primary-600 text-primary-700' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="text-gray-400 text-center py-12">Loading…</div>
        ) : (
          <>
            {tab === 'general'    && <GeneralTab contact={content.contact} footer={content.footer} />}
            {tab === 'hero'       && <HeroTab slides={content.hero?.slides} />}
            {tab === 'highlights' && <HighlightsTab items={content.highlights?.items} />}
            {tab === 'nearby'     && <NearbyTab items={content.nearbyPlaces?.items} />}
            {tab === 'reviews'    && <ReviewsTab items={content.reviews?.items} />}
            {tab === 'gallery'    && <GalleryTab items={content.gallery?.items} />}
            {tab === 'guides'     && <GuidesTab items={content.guides?.items} />}
            {tab === 'legal'      && <LegalTab privacyPolicy={content.privacyPolicy} termsConditions={content.termsConditions} />}
          </>
        )}
      </div>
    </div>
  )
}
