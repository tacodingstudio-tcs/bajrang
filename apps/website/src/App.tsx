import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { SiteLayout } from './components/SiteLayout'
import { HomePage } from './pages/HomePage'

// Everything except the home page is split into its own chunk to keep first load small.
const RoomsPage = lazy(() => import('./pages/RoomsPage').then(m => ({ default: m.RoomsPage })))
const RoomDetailPage = lazy(() => import('./pages/RoomDetailPage').then(m => ({ default: m.RoomDetailPage })))
const AmenitiesPage = lazy(() => import('./pages/AmenitiesPage').then(m => ({ default: m.AmenitiesPage })))
const GalleryPage = lazy(() => import('./pages/GalleryPage').then(m => ({ default: m.GalleryPage })))
const ContactPage = lazy(() => import('./pages/ContactPage').then(m => ({ default: m.ContactPage })))
const BookPage = lazy(() => import('./pages/BookPage').then(m => ({ default: m.BookPage })))
const GuidesIndexPage = lazy(() => import('./pages/guide/GuidesIndexPage').then(m => ({ default: m.GuidesIndexPage })))
const GuidePage = lazy(() => import('./pages/guide/GuidePage').then(m => ({ default: m.GuidePage })))
const PrivacyPolicyPage = lazy(() => import('./pages/PrivacyPolicyPage').then(m => ({ default: m.PrivacyPolicyPage })))
const TermsPage = lazy(() => import('./pages/TermsPage').then(m => ({ default: m.TermsPage })))

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<div className="min-h-screen" aria-busy="true" />}>
      <Routes>
        <Route element={<SiteLayout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/rooms" element={<RoomsPage />} />
          <Route path="/rooms/:roomType" element={<RoomDetailPage />} />
          <Route path="/amenities" element={<AmenitiesPage />} />
          <Route path="/gallery" element={<GalleryPage />} />
          <Route path="/contact" element={<ContactPage />} />
          <Route path="/book" element={<BookPage />} />
          <Route path="/guide" element={<GuidesIndexPage />} />
          <Route path="/guide/:slug" element={<GuidePage />} />
          <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
          <Route path="/terms-conditions" element={<TermsPage />} />
        </Route>
      </Routes>
      </Suspense>
    </BrowserRouter>
  )
}
