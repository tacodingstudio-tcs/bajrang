import type { SyntheticEvent } from 'react'

// Real, verified photography for region-specific content — sourced from
// Wikimedia Commons (CC-BY-SA), not stock placeholders. These make a specific
// claim ("this is Somnath Temple") so they must be the real thing.
export const regionPhotos = {
  somnathTemple: 'https://upload.wikimedia.org/wikipedia/commons/c/ce/Somnath_temple.JPG',
  diuFort:       'https://upload.wikimedia.org/wikipedia/commons/d/d7/Diu_fort%2C_India.JPG',
  girLion:       'https://upload.wikimedia.org/wikipedia/commons/9/90/Gir_lion-Gir_forest%2Cjunagadh%2Cgujarat%2Cindia.jpeg',
  mulDwarka:     'https://upload.wikimedia.org/wikipedia/commons/d/d1/Mul_Dwarka_Temple_at_Visavada_Porbandar_Gujarat_India.jpg',
  kodinar:       'https://upload.wikimedia.org/wikipedia/commons/4/4f/Kodinar%2C_Gujarat_-_India_%283417906908%29.jpg',
  nagoaBeach:    'https://upload.wikimedia.org/wikipedia/commons/8/8b/Nagoa_Beach%2C_Diu.jpg',
}

// Generic atmospheric photography (hotel interiors, breakfast, lobby) where
// no specific real-world claim is made — via LoremFlickr (tag-matched real
// Flickr photos, no API key). Tags must be single words joined by literal
// commas; multi-word or encoded tags return no results.
// `lock` pins a specific photo per slot so it doesn't change on every reload.
export function photo(tags: string, w: number, h: number, lock: number): string {
  return `https://loremflickr.com/${w}/${h}/${tags}/all?lock=${lock}`
}

// LoremFlickr occasionally 500s (third-party outage, not tag-specific — seen
// even on previously-working locks). An <img> left to fail shows the
// browser's broken-image icon, which is worse than no image at all. Every
// `photo()` <img> should set onError={handleImageError} so a hiccup falls
// back to a brand-toned gradient instead.
//
// The fallback must be a real (if tiny) rendered gradient, not a transparent
// pixel with a CSS `background` set on the <img> — once an <img> src loads
// successfully, even a 1x1 transparent gif, the browser paints that content
// (nothing) instead of falling back to the element's CSS background. An
// inline SVG gradient sidesteps that: the gradient IS the image's pixels.
const FALLBACK_GRADIENT_SVG =
  'data:image/svg+xml;utf8,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100">' +
    '<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">' +
    '<stop offset="0%" stop-color="#5a1f26"/>' +
    '<stop offset="100%" stop-color="#a97f34"/>' +
    '</linearGradient></defs>' +
    '<rect width="100" height="100" fill="url(#g)"/></svg>'
  )

export function handleImageError(e: SyntheticEvent<HTMLImageElement>) {
  const img = e.currentTarget
  img.onerror = null
  img.src = FALLBACK_GRADIENT_SVG
}
