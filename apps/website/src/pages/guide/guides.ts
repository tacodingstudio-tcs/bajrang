import { regionPhotos } from '../../lib/images'
import type { GuideStop } from './GuideLayout'

export interface GuideEntry {
  slug: string
  path: string
  title: string
  excerpt: string
  heroImg: string
  heroAlt: string
  seoDescription: string
  intro: string
  note?: string
  stopsHeading?: string
  stops: GuideStop[]
  closingHeading: string
  closingText: string
}

// Default/seed guide content — used whenever the admin hasn't added or
// overridden a "guides" entry via the website content API. The public site
// merges these with `content.guides.items` (admin data wins by slug).
export const defaultGuides: GuideEntry[] = [
  {
    slug: 'visiting-somnath-from-kodinar',
    path: '/guide/visiting-somnath-from-kodinar',
    title: 'A Guide to Visiting Somnath from Kodinar',
    excerpt: 'How to time your visit to the first Jyotirlinga, what else is nearby, and how to make a full day of it.',
    heroImg: regionPhotos.somnathTemple,
    heroAlt: 'Somnath Temple at sunrise, viewed from the Arabian Sea shore',
    seoDescription: "Planning a day trip to Somnath Temple from Kodinar? Here's how to time your visit, what else is nearby, and how to make the most of the day.",
    intro: "Somnath Temple is about 35 km from Kodinar — roughly a 45-minute drive along the coast. It's an easy half-day or full-day trip from Bajrang Stay Inn, and the surrounding area has enough worth seeing that most guests turn it into a full day out rather than a quick in-and-out visit.",
    note: "Somnath observes standard temple etiquette: modest clothing, and phones/cameras are not permitted inside the sanctum. Security screening is routine at the entrance, so arrive a little early if you're visiting during a festival or weekend.",
    stopsHeading: 'Suggested day plan',
    stops: [
      {
        time: 'Morning',
        title: 'Somnath Temple',
        text: 'Start early — Somnath, the first among the twelve Jyotirlingas, draws large crowds by mid-morning, especially on weekends. The temple sits directly on the Arabian Sea shore; the evening aarti and light-and-sound show are worth timing your visit around if you can stay till evening instead.',
        url: 'https://somnath.org/gallery/',
        linkLabel: 'Official gallery',
      },
      {
        time: 'Late morning',
        title: 'Triveni Sangam',
        text: 'A short drive from the temple, this is the sacred confluence of three rivers where pilgrims traditionally bathe before visiting Somnath. Quiet and unhurried compared to the temple itself.',
        url: 'https://girsomnath.nic.in/tourist-place/triveni-sangam/',
        linkLabel: 'District tourism page',
      },
      {
        time: 'Afternoon',
        title: 'Prachi Tirth',
        text: "A cluster of ancient temples on the Prachi river, considered one of Saurashtra's holiest pilgrimage sites and far less crowded than Somnath — a good stop if you want a slower, more contemplative visit.",
        url: 'https://girsomnath.nic.in/tourist-place/prachi-tirth/',
        linkLabel: 'District tourism page',
      },
    ],
    closingHeading: 'Combining it with the rest of the coast',
    closingText: 'If you have more than a day, Diu (about 90 km, roughly 1.5 hours) and Gir National Park (about 55 km, roughly 1.5 hours) are both reasonable add-ons from Kodinar — most guests pick one or the other rather than trying to fit Somnath, Diu, and Gir into a single trip. Mul Dwarka Temple, believed to predate Dwarka itself, is much closer — just 7 km from Kodinar — and works well as a quieter stop on the way back.',
  },
  {
    slug: 'gir-national-park-from-kodinar',
    path: '/guide/gir-national-park-from-kodinar',
    title: 'A Guide to Visiting Gir National Park from Kodinar',
    excerpt: 'What to know about safari permits, seasonal closures, and timing before you go looking for wild Asiatic lions.',
    heroImg: regionPhotos.girLion,
    heroAlt: 'Asiatic lions resting in Gir National Park, Gujarat',
    seoDescription: 'Planning a safari at Gir National Park from Kodinar? What to know about permits, timing, and getting there.',
    intro: "Gir National Park is about 55 km from Kodinar — roughly a 1.5-hour drive. It's the only place in the world with wild Asiatic lions, and the trip is usually built around a jeep safari rather than a casual drive-through, so it's worth planning a little ahead.",
    note: "Safari entry is permit-based with a fixed number of vehicles allowed per time slot, and permits can sell out during peak season (December to March) and weekends. Booking a slot in advance — rather than showing up and hoping — is the safer approach; our front desk can help you check current booking arrangements.",
    stopsHeading: 'What to plan around',
    stops: [
      {
        time: 'Early morning or late afternoon',
        title: 'Jeep safari',
        text: "Safaris run in fixed morning and afternoon slots rather than all day — early morning slots generally have a better chance of sightings as temperatures rise later. Each permit covers a set route and duration, so this isn't a casual self-drive visit.",
        url: 'https://girlion.gujarat.gov.in/GalleryPhoto.aspx',
        linkLabel: 'Official Gir Lion gallery',
      },
      {
        time: 'Before you go',
        title: 'Forest is closed part of the year',
        text: "The sanctuary is typically closed to visitors during the monsoon months for a few months each year, reopening in autumn. Confirm current opening dates before finalizing your trip if you're visiting outside the winter season.",
        url: 'https://girlion.gujarat.gov.in/GalleryPhoto.aspx',
        linkLabel: 'Check current status',
      },
    ],
    closingHeading: 'Making a day of it',
    closingText: "Given the drive and the fixed safari slots, most guests treat Gir as a dedicated day trip rather than pairing it with Somnath or Diu on the same day. If you'd rather stay closer, Mul Dwarka Temple (7 km) and Jamjir Waterfall (18 km) are both easy half-day options nearer to Kodinar.",
  },
  {
    slug: 'diu-from-kodinar',
    path: '/guide/diu-from-kodinar',
    title: 'A Day Trip to Diu from Kodinar',
    excerpt: 'The fort, the beaches, and what to know about a former Portuguese colony on the coast.',
    heroImg: regionPhotos.nagoaBeach,
    heroAlt: 'Nagoa Beach, Diu',
    seoDescription: 'Planning a trip to Diu from Kodinar? The fort, the beaches, and how to make the most of a former Portuguese colony on the coast.',
    intro: "Diu is about 90 km from Kodinar — roughly a 1.5-hour drive. It's a former Portuguese colony, and that history is still visible everywhere: the fort, the old churches, and a slower pace than the mainland. Most guests treat it as a full day out rather than a quick stop.",
    note: "Diu is a separate Union Territory from Gujarat, so the drive crosses a state border — nothing special is required for Indian visitors, but it's worth knowing if you're timing fuel stops, since fuel pricing sometimes differs slightly across the border.",
    stopsHeading: 'What to see',
    stops: [
      {
        time: 'Morning',
        title: 'Diu Fort',
        text: 'A 16th-century Portuguese fort on the coast, with sea views from the ramparts. Worth visiting earlier in the day before it gets hot, since much of it is uncovered stonework.',
        url: 'https://diu.gov.in/tourist-places/',
        linkLabel: 'Diu district tourism page',
      },
      {
        time: 'Afternoon',
        title: 'Nagoa Beach',
        text: "A horseshoe-shaped beach about 8 km from Diu town, generally considered the most popular of Diu's beaches. A good spot to slow down after a morning of walking around the fort and old town.",
        url: 'https://diu.gov.in/tourist-place/nagoa-beach/',
        linkLabel: 'Nagoa Beach page',
      },
    ],
    closingHeading: "If you're staying overnight",
    closingText: "Diu is far enough from Kodinar that some guests prefer to stay a night in Diu itself rather than doing the full round trip in one day — worth factoring in if you want a relaxed visit rather than a rushed one. Either way, it's usually a one-destination day given the distance, rather than combined with Somnath or Gir.",
  },
]
