import { useQuery } from '@tanstack/react-query'
import { api } from './api'
import type { LegalContent } from './legalDefaults'

// Raw shape of GET /api/public/website — one key per section, absent if the
// admin hasn't set that section yet. Each section's internal shape is
// whatever that section's admin form/consumer agrees on (see individual
// merge helpers below).
export interface WebsiteContent {
  hero?:             { slides?: unknown[] }
  highlights?:       { items?: unknown[] }
  nearbyPlaces?:     { items?: unknown[] }
  reviews?:          { items?: unknown[] }
  guides?:           { items?: unknown[] }
  footer?:           { tagline?: string; proverb?: string; poweredBy?: string }
  contact?:          { phone?: string; email?: string; address?: string }
  gallery?:          { items?: GalleryImage[] }
  privacyPolicy?:    Partial<LegalContent>
  termsConditions?:  Partial<LegalContent>
}

export interface GalleryImage {
  url: string
  caption?: string
}

export function useWebsiteContent() {
  const { data } = useQuery({
    queryKey: ['public-website-content'],
    queryFn: async () => (await api.get<WebsiteContent>('/website')).data,
    staleTime: 5 * 60 * 1000,
  })
  return data ?? {}
}

// Merges an admin-provided list with a hardcoded default list by a key field
// (usually a slug/title) — admin entries win, defaults fill in the rest, and
// an admin item with `_hidden: true` removes the matching default entirely.
export function mergeByKey<T>(
  defaults: T[],
  overrides: unknown[] | undefined,
  key: keyof T
): T[] {
  if (!overrides || overrides.length === 0) return defaults
  const overrideList = overrides as T[]
  const overrideKeys = new Set(overrideList.map((o) => o[key]))
  const kept = defaults.filter((d) => !overrideKeys.has(d[key]))
  const visible = overrideList.filter((o) => !(o as { _hidden?: boolean })._hidden)
  return [...kept, ...visible]
}
