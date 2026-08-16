import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { SiteLayout } from './components/SiteLayout'
import { HomePage } from './pages/HomePage'
import { RoomsPage } from './pages/RoomsPage'
import { RoomDetailPage } from './pages/RoomDetailPage'
import { AmenitiesPage } from './pages/AmenitiesPage'
import { GalleryPage } from './pages/GalleryPage'
import { ContactPage } from './pages/ContactPage'
import { BookPage } from './pages/BookPage'
import { GuidesIndexPage } from './pages/guide/GuidesIndexPage'
import { GuidePage } from './pages/guide/GuidePage'
import { PrivacyPolicyPage } from './pages/PrivacyPolicyPage'
import { TermsPage } from './pages/TermsPage'

export default function App() {
  return (
    <BrowserRouter>
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
    </BrowserRouter>
  )
}
