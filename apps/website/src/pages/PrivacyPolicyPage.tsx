import { LegalPage } from './LegalPage'
import { useWebsiteContent } from '../lib/useWebsiteContent'
import { DEFAULT_PRIVACY_POLICY } from '../lib/legalDefaults'

export function PrivacyPolicyPage() {
  const content = useWebsiteContent()
  return (
    <LegalPage
      title="Privacy Policy"
      description="How Bajrang Stay Inn, Kodinar collects, uses, and protects your personal information."
      path="/privacy-policy"
      breadcrumbLabel="Privacy Policy"
      content={content.privacyPolicy}
      defaultContent={DEFAULT_PRIVACY_POLICY}
    />
  )
}
