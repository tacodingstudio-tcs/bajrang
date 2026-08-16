import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api, type HotelProfile } from './api'

function setMeta(selector: string, attr: string, content: string) {
  const el = document.head.querySelector<HTMLMetaElement>(selector)
  if (el) el.setAttribute(attr, content)
}

// Applies admin-configured SEO overrides (Branch.domainConfig.seo) on top of
// the static defaults baked into index.html. The title/description overrides
// only apply on the homepage — other pages set their own via <Seo> so a
// route change doesn't get raced by this hook's async fetch resolving late
// and stomping a page-specific title back to the site-wide one. The share
// image is site-wide regardless of route, so it always applies.
export function useSeoSettings() {
  const { pathname } = useLocation()
  const isHome = pathname === '/'

  const { data } = useQuery({
    queryKey: ['public-hotel-profile'],
    queryFn: async () => (await api.get<HotelProfile>('/hotel')).data,
    staleTime: 5 * 60 * 1000,
  })

  useEffect(() => {
    const seo = (data?.domainConfig as { seo?: { metaTitle?: string; metaDescription?: string; ogImageUrl?: string } })?.seo
    if (!seo) return

    if (isHome && seo.metaTitle) {
      document.title = seo.metaTitle
      setMeta('meta[property="og:title"]', 'content', seo.metaTitle)
    }
    if (isHome && seo.metaDescription) {
      setMeta('meta[name="description"]', 'content', seo.metaDescription)
      setMeta('meta[property="og:description"]', 'content', seo.metaDescription)
    }
    if (seo.ogImageUrl) {
      let ogImage = document.head.querySelector<HTMLMetaElement>('meta[property="og:image"]')
      if (!ogImage) {
        ogImage = document.createElement('meta')
        ogImage.setAttribute('property', 'og:image')
        document.head.appendChild(ogImage)
      }
      ogImage.setAttribute('content', seo.ogImageUrl)
    }
  }, [data, isHome])
}
