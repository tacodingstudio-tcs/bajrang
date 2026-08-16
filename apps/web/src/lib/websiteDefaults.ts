// Mirrors the public website's built-in fallback content (apps/website/src/pages/HomePage.tsx
// and apps/website/src/pages/guide/guides.ts) so the admin "Website" tabs can show and let you
// edit/remove what's actually live on the site right now — not just add new items on top of it.
// If the website's own defaults change, update this file to match so admin stays in sync.

const img = {
  somnathTemple: 'https://upload.wikimedia.org/wikipedia/commons/c/ce/Somnath_temple.JPG',
  diuFort:       'https://upload.wikimedia.org/wikipedia/commons/d/d7/Diu_fort%2C_India.JPG',
  girLion:       'https://upload.wikimedia.org/wikipedia/commons/9/90/Gir_lion-Gir_forest%2Cjunagadh%2Cgujarat%2Cindia.jpeg',
  mulDwarka:     'https://upload.wikimedia.org/wikipedia/commons/d/d1/Mul_Dwarka_Temple_at_Visavada_Porbandar_Gujarat_India.jpg',
  kodinar:       'https://upload.wikimedia.org/wikipedia/commons/4/4f/Kodinar%2C_Gujarat_-_India_%283417906908%29.jpg',
  nagoaBeach:    'https://upload.wikimedia.org/wikipedia/commons/8/8b/Nagoa_Beach%2C_Diu.jpg',
}

function loremflickr(tags: string, w: number, h: number, lock: number) {
  return `https://loremflickr.com/${w}/${h}/${tags}/all?lock=${lock}`
}

export const DEFAULT_HERO_SLIDES = [
  { img: img.somnathTemple, alt: 'Somnath Temple', place: 'Somnath Temple', distance: '35 km · 45 min' },
  { img: img.mulDwarka,     alt: 'Mul Dwarka Temple', place: 'Mul Dwarka', distance: '7.3 km · 14 min' },
  { img: img.diuFort,       alt: 'Diu Fort', place: 'Diu Fort', distance: '90 km · 1.5 hr' },
  { img: img.kodinar,       alt: 'Jamjir Waterfall, near Kodinar', place: 'Jamjir Waterfall', distance: '18 km · 30 min' },
]

export const DEFAULT_HIGHLIGHTS = [
  { label: 'Free Wi-Fi',   desc: 'High-speed internet, complimentary throughout the property' },
  { label: 'Free Parking', desc: 'Secure on-site parking for guests, day or night' },
  { label: 'Breakfast',    desc: 'A hearty spread included, served 7–10:30 AM' },
  { label: 'Front Desk',   desc: 'Staffed around the clock for anything you need' },
]

export const DEFAULT_NEARBY_PLACES = [
  { title: 'Somnath Temple',    dist: '35 km · 45 min', desc: 'The first among the twelve Jyotirlingas, rebuilt on the Arabian Sea shore.', tagline: '', query: 'Somnath Temple, Gujarat', url: 'https://somnath.org/gallery/', img: img.somnathTemple, big: true },
  { title: 'Mul Dwarka Temple', dist: '7 km · 14 min',   desc: 'An ancient temple believed to predate Dwarka itself.', tagline: 'Older than Dwarka itself', query: 'Mul Dwarka Temple, Porbandar', url: 'https://girsomnath.nic.in/tourist-place/mool-dwarka/', img: img.mulDwarka },
  { title: 'Jamjir Waterfall',  dist: '18 km · 30 min',  desc: 'A seasonal cascade tucked into the Kodinar countryside.', tagline: 'A cascade in the countryside', query: 'Jamjir Waterfall, Kodinar', url: 'https://girsomnath.nic.in/tourist-place/jamjir-waterfall/', img: loremflickr('waterfall,forest', 640, 480, 21) },
  { title: 'Prachi Tirth',      dist: '30 km · 40 min',  desc: "A cluster of ancient temples on the sacred Prachi river, revered as one of Saurashtra's holiest pilgrimage sites.", tagline: 'A sacred pilgrimage site', query: 'Prachi Tirth, Gir Somnath, Gujarat', url: 'https://girsomnath.nic.in/tourist-place/prachi-tirth/', img: loremflickr('temple,river,india', 640, 480, 22) },
  { title: 'Triveni Sangam',    dist: '35 km · 45 min',  desc: 'Sacred confluence of three rivers, near Somnath.', tagline: 'Where three rivers meet', query: 'Triveni Sangam, Somnath, Gujarat', url: 'https://girsomnath.nic.in/tourist-place/triveni-sangam/', img: loremflickr('river,confluence,nature', 640, 480, 23) },
  { title: 'Gir National Park', dist: '55 km · 1.5 hr',  desc: 'Home to the last wild Asiatic lions on Earth.', tagline: 'Home of the Asiatic lion', query: 'Gir National Park, Gujarat', url: 'https://girlion.gujarat.gov.in/GalleryPhoto.aspx', img: img.girLion, wide: true },
  { title: 'Diu',               dist: '90 km · 1.5 hr',  desc: 'A former Portuguese colony with quiet beaches and a coastal fort.', tagline: 'Quiet beaches, old-world charm', query: 'Diu beaches, Diu', url: 'https://diu.gov.in/tourist-places/', img: img.nagoaBeach, wide: true },
]

// These are placeholder testimonials, not real guest feedback — replace or
// remove them here once you have actual reviews to publish.
export const DEFAULT_REVIEWS = [
  { name: 'Ansh Patel',      place: 'Ahmedabad', rating: 5, text: 'Spotless rooms and the front desk staff genuinely cared about making our Somnath trip easy. Would stay again.' },
  { name: 'Priya Shah',      place: 'Surat',     rating: 5, text: 'Quiet, comfortable, and close to everything we wanted to see. Breakfast was a nice surprise — fresh and generous.' },
  { name: 'Rakesh Mehta',    place: 'Rajkot',    rating: 4, text: 'Great value for a family stay. Parking was easy and the rooms were bigger than we expected for the price.' },
  { name: 'Meera Joshi',     place: 'Vadodara',  rating: 5, text: 'Booked last minute for a Somnath trip and they still had us checked in within minutes. Room was clean and the bed was genuinely comfortable.' },
  { name: 'Kiran Solanki',   place: 'Rajkot',    rating: 4, text: 'Good base for exploring Gir and Diu. Staff gave us solid directions and timing advice that saved us a wasted trip.' },
  { name: 'Devansh Trivedi', place: 'Bhavnagar', rating: 5, text: 'Simple, honest hotel — no surprises at checkout, and the room matched exactly what we expected from the photos.' },
]

export const DEFAULT_CONTACT = {
  phone:   '+91 2795 23 4567',
  email:   'stay@bajrangstayinn.example',
  address: 'Kodinar, Gir Somnath, Gujarat',
}

export const DEFAULT_FOOTER = {
  tagline:   'A considered stay near Somnath, minutes from the Saurashtra coast — quiet rooms, warm hospitality, and everything within easy reach.',
  proverb:   '"अतिथि देवो भवः" — the guest is akin to God',
  poweredBy: 'Twisha Consultancy Services',
}

// Generic, honest hotel-industry boilerplate — NOT reviewed by a lawyer.
// The owner should have actual legal counsel review this before treating it
// as binding, especially the cancellation/refund terms below, which are
// left as an explicit placeholder since only the business can set that
// policy (an invented cancellation window/fee would be actively misleading).
export const DEFAULT_PRIVACY_POLICY = {
  effectiveDate: '15 August 2026',
  sections: [
    {
      heading: 'Information we collect',
      body: 'When you make a booking inquiry or contact us, we collect your name, phone number, email address, and stay details (dates, room type, number of guests). At check-in, Indian law requires hotels to collect and record a valid government-issued photo ID for every guest, and to file a Form C for foreign nationals.',
    },
    {
      heading: 'How we use your information',
      body: 'We use this information to process your booking, verify your identity as required by law, contact you about your stay, and respond to inquiries. We do not use your information for unrelated marketing without your consent.',
    },
    {
      heading: 'Sharing your information',
      body: 'We share guest information with government and law-enforcement authorities where legally required (such as police verification or Form C filing). We do not sell your personal information to third parties. Payment processing is handled by our payment gateway provider, which processes payment details directly — we do not store your full card details.',
    },
    {
      heading: 'Data security',
      body: 'We take reasonable steps to protect the information you share with us, but no method of storage or transmission is completely secure, and we cannot guarantee absolute security.',
    },
    {
      heading: 'Your rights',
      body: 'You may contact us at any time to ask what information we hold about you, request a correction, or request deletion where we are not legally required to retain it (such as ID records tied to a stay).',
    },
    {
      heading: 'Changes to this policy',
      body: 'We may update this policy from time to time. The effective date above reflects the most recent update.',
    },
  ],
}

export const DEFAULT_TERMS_CONDITIONS = {
  effectiveDate: '15 August 2026',
  sections: [
    {
      heading: 'Reservations',
      body: 'A booking submitted through this website is an inquiry, not a confirmed reservation. Our team will contact you by phone to confirm availability and finalize your booking.',
    },
    {
      heading: 'Check-in and check-out',
      body: 'Standard check-in is from 12:00 PM and check-out is by 11:00 AM, subject to room availability. Early check-in or late check-out may be arranged in advance where possible, and may incur an additional charge. A valid government-issued photo ID is required for every guest at check-in, as required by law.',
    },
    {
      heading: 'Cancellations and refunds',
      body: '[This section needs the property\'s actual cancellation and refund policy — how far in advance a booking can be cancelled for a full refund, any cancellation fees, and how no-shows are handled. Please provide this and we\'ll fill it in accurately rather than leave a placeholder live.]',
    },
    {
      heading: 'Payment',
      body: 'An advance payment may be required to confirm your booking. The balance is payable at check-in or check-out, in the methods accepted by the property at that time.',
    },
    {
      heading: 'Guest conduct',
      body: 'Guests are expected to behave respectfully toward staff and other guests. The property reserves the right to charge for damage caused to hotel property during a stay, and to refuse or end a stay in cases of serious misconduct.',
    },
    {
      heading: 'Liability',
      body: 'The property takes reasonable care of guests and their belongings, but is not liable for loss of personal belongings except where required by law. Guests are advised not to leave valuables unattended.',
    },
    {
      heading: 'Governing law',
      body: 'These terms are governed by the laws of India, and any disputes are subject to the jurisdiction of the courts in Gir Somnath, Gujarat.',
    },
  ],
}

export const DEFAULT_GUIDES = [
  {
    slug: 'visiting-somnath-from-kodinar',
    path: '/guide/visiting-somnath-from-kodinar',
    title: 'A Guide to Visiting Somnath from Kodinar',
    excerpt: 'How to time your visit to the first Jyotirlinga, what else is nearby, and how to make a full day of it.',
    heroImg: img.somnathTemple,
    heroAlt: 'Somnath Temple at sunrise, viewed from the Arabian Sea shore',
    seoDescription: "Planning a day trip to Somnath Temple from Kodinar? Here's how to time your visit, what else is nearby, and how to make the most of the day.",
    intro: "Somnath Temple is about 35 km from Kodinar — roughly a 45-minute drive along the coast. It's an easy half-day or full-day trip from Bajrang Stay Inn, and the surrounding area has enough worth seeing that most guests turn it into a full day out rather than a quick in-and-out visit.",
    note: "Somnath observes standard temple etiquette: modest clothing, and phones/cameras are not permitted inside the sanctum. Security screening is routine at the entrance, so arrive a little early if you're visiting during a festival or weekend.",
    closingHeading: 'Combining it with the rest of the coast',
    closingText: 'If you have more than a day, Diu (about 90 km, roughly 1.5 hours) and Gir National Park (about 55 km, roughly 1.5 hours) are both reasonable add-ons from Kodinar — most guests pick one or the other rather than trying to fit Somnath, Diu, and Gir into a single trip. Mul Dwarka Temple, believed to predate Dwarka itself, is much closer — just 7 km from Kodinar — and works well as a quieter stop on the way back.',
    stops: [
      { time: 'Morning', title: 'Somnath Temple', text: 'Start early — Somnath, the first among the twelve Jyotirlingas, draws large crowds by mid-morning, especially on weekends. The temple sits directly on the Arabian Sea shore; the evening aarti and light-and-sound show are worth timing your visit around if you can stay till evening instead.', url: 'https://somnath.org/gallery/', linkLabel: 'Official gallery' },
      { time: 'Late morning', title: 'Triveni Sangam', text: 'A short drive from the temple, this is the sacred confluence of three rivers where pilgrims traditionally bathe before visiting Somnath. Quiet and unhurried compared to the temple itself.', url: 'https://girsomnath.nic.in/tourist-place/triveni-sangam/', linkLabel: 'District tourism page' },
      { time: 'Afternoon', title: 'Prachi Tirth', text: "A cluster of ancient temples on the Prachi river, considered one of Saurashtra's holiest pilgrimage sites and far less crowded than Somnath — a good stop if you want a slower, more contemplative visit.", url: 'https://girsomnath.nic.in/tourist-place/prachi-tirth/', linkLabel: 'District tourism page' },
    ],
  },
  {
    slug: 'gir-national-park-from-kodinar',
    path: '/guide/gir-national-park-from-kodinar',
    title: 'A Guide to Visiting Gir National Park from Kodinar',
    excerpt: 'What to know about safari permits, seasonal closures, and timing before you go looking for wild Asiatic lions.',
    heroImg: img.girLion,
    heroAlt: 'Asiatic lions resting in Gir National Park, Gujarat',
    seoDescription: 'Planning a safari at Gir National Park from Kodinar? What to know about permits, timing, and getting there.',
    intro: "Gir National Park is about 55 km from Kodinar — roughly a 1.5-hour drive. It's the only place in the world with wild Asiatic lions, and the trip is usually built around a jeep safari rather than a casual drive-through, so it's worth planning a little ahead.",
    note: "Safari entry is permit-based with a fixed number of vehicles allowed per time slot, and permits can sell out during peak season (December to March) and weekends. Booking a slot in advance — rather than showing up and hoping — is the safer approach; our front desk can help you check current booking arrangements.",
    closingHeading: 'Making a day of it',
    closingText: "Given the drive and the fixed safari slots, most guests treat Gir as a dedicated day trip rather than pairing it with Somnath or Diu on the same day. If you'd rather stay closer, Mul Dwarka Temple (7 km) and Jamjir Waterfall (18 km) are both easy half-day options nearer to Kodinar.",
    stops: [
      { time: 'Early morning or late afternoon', title: 'Jeep safari', text: "Safaris run in fixed morning and afternoon slots rather than all day — early morning slots generally have a better chance of sightings as temperatures rise later. Each permit covers a set route and duration, so this isn't a casual self-drive visit.", url: 'https://girlion.gujarat.gov.in/GalleryPhoto.aspx', linkLabel: 'Official Gir Lion gallery' },
      { time: 'Before you go', title: 'Forest is closed part of the year', text: "The sanctuary is typically closed to visitors during the monsoon months for a few months each year, reopening in autumn. Confirm current opening dates before finalizing your trip if you're visiting outside the winter season.", url: 'https://girlion.gujarat.gov.in/GalleryPhoto.aspx', linkLabel: 'Check current status' },
    ],
  },
  {
    slug: 'diu-from-kodinar',
    path: '/guide/diu-from-kodinar',
    title: 'A Day Trip to Diu from Kodinar',
    excerpt: 'The fort, the beaches, and what to know about a former Portuguese colony on the coast.',
    heroImg: img.nagoaBeach,
    heroAlt: 'Nagoa Beach, Diu',
    seoDescription: 'Planning a trip to Diu from Kodinar? The fort, the beaches, and how to make the most of a former Portuguese colony on the coast.',
    intro: "Diu is about 90 km from Kodinar — roughly a 1.5-hour drive. It's a former Portuguese colony, and that history is still visible everywhere: the fort, the old churches, and a slower pace than the mainland. Most guests treat it as a full day out rather than a quick stop.",
    note: "Diu is a separate Union Territory from Gujarat, so the drive crosses a state border — nothing special is required for Indian visitors, but it's worth knowing if you're timing fuel stops, since fuel pricing sometimes differs slightly across the border.",
    closingHeading: "If you're staying overnight",
    closingText: "Diu is far enough from Kodinar that some guests prefer to stay a night in Diu itself rather than doing the full round trip in one day — worth factoring in if you want a relaxed visit rather than a rushed one. Either way, it's usually a one-destination day given the distance, rather than combined with Somnath or Gir.",
    stops: [
      { time: 'Morning', title: 'Diu Fort', text: 'A 16th-century Portuguese fort on the coast, with sea views from the ramparts. Worth visiting earlier in the day before it gets hot, since much of it is uncovered stonework.', url: 'https://diu.gov.in/tourist-places/', linkLabel: 'Diu district tourism page' },
      { time: 'Afternoon', title: 'Nagoa Beach', text: "A horseshoe-shaped beach about 8 km from Diu town, generally considered the most popular of Diu's beaches. A good spot to slow down after a morning of walking around the fort and old town.", url: 'https://diu.gov.in/tourist-place/nagoa-beach/', linkLabel: 'Nagoa Beach page' },
    ],
  },
]
