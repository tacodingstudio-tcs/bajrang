import { LegalPage } from './LegalPage'
import { useWebsiteContent } from '../lib/useWebsiteContent'
import { DEFAULT_TERMS_CONDITIONS } from '../lib/legalDefaults'

export function TermsPage() {
  const content = useWebsiteContent()
  return (
    <LegalPage
      title="Terms & Conditions"
      description="Booking, check-in/check-out, cancellation, and stay policies for Bajrang Stay Inn, Kodinar."
      path="/terms-conditions"
      breadcrumbLabel="Terms & Conditions"
      content={content.termsConditions}
      defaultContent={DEFAULT_TERMS_CONDITIONS}
    />
  )
}
