import { regionPhotos } from '../../lib/images'
import type { GuideEntry } from './guides'

// Additional seed guides. Distances/times match the figures used elsewhere on
// the site (home page "nearby places" and the other guides); seasonal advice is
// deliberately general. Admin entries with the same slug override these.
export const moreGuides: GuideEntry[] = [
  {
    slug: 'mul-dwarka-and-jamjir-waterfall-from-kodinar',
    path: '/guide/mul-dwarka-and-jamjir-waterfall-from-kodinar',
    title: 'Mul Dwarka and Jamjir Waterfall: Easy Half-Day Trips from Kodinar',
    excerpt: 'Two close-by stops that fit into a morning or an afternoon — an ancient temple and a seasonal waterfall.',
    heroImg: regionPhotos.mulDwarka,
    heroAlt: 'Mul Dwarka Temple near Kodinar, Gujarat',
    seoDescription: 'Short on time? Mul Dwarka Temple (7 km) and Jamjir Waterfall (18 km) are easy half-day trips from Kodinar. Here is how to plan them.',
    intro: "Not every outing from Bajrang Stay Inn needs a full day. Mul Dwarka Temple is about 7 km away — roughly a 14-minute drive — and Jamjir Waterfall is about 18 km, around 30 minutes. Both work well as a morning or afternoon out, and they pair nicely if you would rather keep the day relaxed.",
    note: 'Opening hours and access can change, and the waterfall depends on recent rainfall. It is worth checking the local tourism page or asking our front desk the day before you go.',
    stopsHeading: 'Two easy stops',
    stops: [
      {
        time: 'Morning',
        title: 'Mul Dwarka Temple',
        text: "Believed to predate Dwarka itself, this is the closest of the region's major sites to Kodinar. It is generally quieter than Somnath, which makes it a good first stop if you want an unhurried visit before the day warms up.",
        url: 'https://girsomnath.nic.in/tourist-place/mool-dwarka/',
        linkLabel: 'District tourism page',
      },
      {
        time: 'Afternoon',
        title: 'Jamjir Waterfall',
        text: 'A seasonal cascade, so how impressive it looks depends on the monsoon. It tends to be at its fullest during and after the rains, and much thinner in the dry months. Wear shoes with grip — surfaces near the water can be slippery.',
        url: 'https://girsomnath.nic.in/tourist-place/jamjir-waterfall/',
        linkLabel: 'District tourism page',
      },
    ],
    closingHeading: 'Pairing them with the rest of your stay',
    closingText: 'Because both stops are close, you can be back at the hotel by mid-afternoon and still have time to rest. If you would like something longer afterwards, Prachi Tirth (about 30 km) and Somnath (about 35 km) are the natural next steps on another day.',
  },
  {
    slug: 'best-time-to-visit-kodinar-and-somnath',
    path: '/guide/best-time-to-visit-kodinar-and-somnath',
    title: 'The Best Time to Visit Kodinar and Somnath',
    excerpt: 'What to expect from the weather through the year, and how it changes what you can comfortably do.',
    heroImg: regionPhotos.kodinar,
    heroAlt: 'Landscape near Kodinar, Gujarat',
    seoDescription: 'When should you visit Kodinar and Somnath? A season-by-season look at the weather and what it means for sightseeing on the Saurashtra coast.',
    intro: 'Kodinar sits on the Saurashtra coast, so the weather shapes a trip more than you might expect — it affects how long you can comfortably spend outdoors, whether the waterfalls are running, and how crowded the main sites get. Here is a general guide; conditions vary from year to year, so treat the months as a rough guide, not a promise.',
    note: 'Festival days and long weekends draw large crowds at Somnath whatever the season. If your dates are flexible, a weekday visit is usually calmer.',
    stopsHeading: 'Season by season',
    stops: [
      {
        time: 'Roughly Nov – Feb',
        title: 'Cooler months',
        text: 'Generally the most comfortable time for sightseeing. Days are milder, which makes longer outings — Somnath, Diu or Gir — much easier to enjoy. This is also the busiest period, so booking ahead is sensible.',
        url: 'https://girsomnath.nic.in/',
        linkLabel: 'District tourism site',
      },
      {
        time: 'Roughly Mar – May',
        title: 'Hot months',
        text: 'Afternoons can be very hot. Plan outdoor visits for early morning or late afternoon, keep water with you, and use the middle of the day to rest at the hotel.',
        url: 'https://girsomnath.nic.in/',
        linkLabel: 'District tourism site',
      },
      {
        time: 'Roughly Jun – Sep',
        title: 'Monsoon',
        text: 'Rain brings greener countryside and fuller waterfalls such as Jamjir, but it can also disrupt road travel and beach plans. Keep itineraries flexible and check conditions the day before you head out.',
        url: 'https://girsomnath.nic.in/tourist-place/jamjir-waterfall/',
        linkLabel: 'Jamjir Waterfall page',
      },
    ],
    closingHeading: 'Choosing your dates',
    closingText: 'If you want comfortable weather and the full range of day trips, the cooler months are the usual choice. If you prefer quieter sites and do not mind heat or rain, the other seasons can work well with a little planning. Our front desk is happy to suggest timings for any day you are here.',
  },
  {
    slug: 'three-day-saurashtra-coast-itinerary-from-kodinar',
    path: '/guide/three-day-saurashtra-coast-itinerary-from-kodinar',
    title: 'A Three-Day Saurashtra Coast Itinerary from Kodinar',
    excerpt: 'Somnath and its neighbours, a slower day of nearby stops, and a day out to Diu — a paced plan from one base.',
    heroImg: regionPhotos.diuFort,
    heroAlt: 'Diu Fort on the Saurashtra coast',
    seoDescription: 'Planning three days around Kodinar? A paced itinerary covering Somnath, nearby temples and waterfall, and a day trip to Diu — all from one hotel.',
    intro: 'Kodinar works well as a base because the main sights are a manageable drive away and you come back to the same room each night. This plan spreads them across three days so no day is rushed. Distances below are approximate road distances from Kodinar.',
    note: 'Driving times depend on traffic and road conditions. Build in extra time for temple queues on weekends and festival days, and check current opening hours before you set out.',
    stopsHeading: 'The plan',
    stops: [
      {
        time: 'Day 1',
        title: 'Somnath, Triveni Sangam and Prachi Tirth',
        text: 'Somnath is about 35 km (roughly 45 minutes). Go early, then add Triveni Sangam nearby and, if you have energy, Prachi Tirth (about 30 km from Kodinar), which is typically quieter than the main temple.',
        url: 'https://somnath.org/gallery/',
        linkLabel: 'Somnath official gallery',
      },
      {
        time: 'Day 2',
        title: 'Mul Dwarka and Jamjir Waterfall',
        text: 'A lighter day. Mul Dwarka is about 7 km away and Jamjir Waterfall about 18 km, so you can be back at the hotel in the afternoon. If you would rather see wildlife, swap this day for Gir National Park (about 55 km, roughly 1.5 hours) — most guests choose one or the other.',
        url: 'https://girsomnath.nic.in/tourist-place/mool-dwarka/',
        linkLabel: 'Mul Dwarka page',
      },
      {
        time: 'Day 3',
        title: 'Diu',
        text: 'Diu is about 90 km (roughly 1.5 hours), so start early. Visit the fort in the morning and spend the afternoon at Nagoa Beach before the drive back. Some guests prefer to stay a night in Diu to avoid a long day.',
        url: 'https://diu.gov.in/tourist-places/',
        linkLabel: 'Diu tourism page',
      },
    ],
    closingHeading: 'Adjusting the plan',
    closingText: 'Two days? Combine Day 1 with a half day at Mul Dwarka. Four or more? Add Gir National Park as its own day. Whatever your length of stay, we can help with route timing and local recommendations when you check in.',
  },
]
