import { useEffect } from 'react'

const SITE_URL = 'https://www.bajrangstayinn.example'
const BREADCRUMB_SCRIPT_ID = 'breadcrumb-jsonld'

function setMeta(selector: string, content: string) {
  const el = document.head.querySelector<HTMLMetaElement>(selector)
  if (el) el.setAttribute('content', content)
}

export interface BreadcrumbItem {
  name: string
  path: string // e.g. '/rooms' — joined with SITE_URL
}

// Sets this page's own title/description — overrides whatever SiteLayout's
// site-wide default (or the admin's homepage SEO settings) put there.
// Optionally injects a BreadcrumbList JSON-LD script (removed on unmount, so
// it never lingers into a page that didn't ask for one). Renders nothing.
export function Seo({ title, description, breadcrumbs }: {
  title: string
  description: string
  breadcrumbs?: BreadcrumbItem[]
}) {
  useEffect(() => {
    document.title = title
    setMeta('meta[name="description"]', description)
    setMeta('meta[property="og:title"]', title)
    setMeta('meta[property="og:description"]', description)
  }, [title, description])

  useEffect(() => {
    if (!breadcrumbs || breadcrumbs.length === 0) return

    const script = document.createElement('script')
    script.type = 'application/ld+json'
    script.id = BREADCRUMB_SCRIPT_ID
    script.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: breadcrumbs.map((b, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        name: b.name,
        item: `${SITE_URL}${b.path}`,
      })),
    })
    document.head.appendChild(script)

    return () => { script.remove() }
  }, [breadcrumbs])

  return null
}
