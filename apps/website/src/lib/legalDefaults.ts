// Fallback content for /privacy-policy and /terms-conditions — used whenever
// the admin hasn't set an override for that section yet. Generic, honest
// hotel-industry boilerplate, NOT reviewed by a lawyer. The cancellation
// section is deliberately left as a placeholder rather than an invented
// policy, since only the business can set real cancellation/refund terms.
export interface LegalSection {
  heading: string
  body: string
}

export interface LegalContent {
  effectiveDate: string
  sections: LegalSection[]
}

export const DEFAULT_PRIVACY_POLICY: LegalContent = {
  effectiveDate: '15 August 2026',
  sections: [
    {
      heading: 'Information we collect',
      body: 'When you make a booking inquiry or contact us, we collect your name, phone number, email address, and stay details (dates, room type, number of guests). At check-in, Indian law requires hotels to collect and record a valid government-issued photo ID for every guest, and to file a Form C for foreign nationals.',
    },
    {
      heading: 'How we use your information',
      body: 'We use this information to process your booking, verify your identity as required by law, contact you about your stay, and respond to inquiries. We do not use your information for unrelated marketing without your consent.',
    },
    {
      heading: 'Sharing your information',
      body: 'We share guest information with government and law-enforcement authorities where legally required (such as police verification or Form C filing). We do not sell your personal information to third parties. Payment processing is handled by our payment gateway provider, which processes payment details directly — we do not store your full card details.',
    },
    {
      heading: 'Data security',
      body: 'We take reasonable steps to protect the information you share with us, but no method of storage or transmission is completely secure, and we cannot guarantee absolute security.',
    },
    {
      heading: 'Your rights',
      body: 'You may contact us at any time to ask what information we hold about you, request a correction, or request deletion where we are not legally required to retain it (such as ID records tied to a stay).',
    },
    {
      heading: 'Changes to this policy',
      body: 'We may update this policy from time to time. The effective date above reflects the most recent update.',
    },
  ],
}

export const DEFAULT_TERMS_CONDITIONS: LegalContent = {
  effectiveDate: '15 August 2026',
  sections: [
    {
      heading: 'Reservations',
      body: 'A booking submitted through this website is an inquiry, not a confirmed reservation. Our team will contact you by phone to confirm availability and finalize your booking.',
    },
    {
      heading: 'Check-in and check-out',
      body: 'Standard check-in is from 12:00 PM and check-out is by 11:00 AM, subject to room availability. Early check-in or late check-out may be arranged in advance where possible, and may incur an additional charge. A valid government-issued photo ID is required for every guest at check-in, as required by law.',
    },
    {
      heading: 'Cancellations and refunds',
      body: "[This section needs the property's actual cancellation and refund policy — how far in advance a booking can be cancelled for a full refund, any cancellation fees, and how no-shows are handled.]",
    },
    {
      heading: 'Payment',
      body: 'An advance payment may be required to confirm your booking. The balance is payable at check-in or check-out, in the methods accepted by the property at that time.',
    },
    {
      heading: 'Guest conduct',
      body: 'Guests are expected to behave respectfully toward staff and other guests. The property reserves the right to charge for damage caused to hotel property during a stay, and to refuse or end a stay in cases of serious misconduct.',
    },
    {
      heading: 'Liability',
      body: 'The property takes reasonable care of guests and their belongings, but is not liable for loss of personal belongings except where required by law. Guests are advised not to leave valuables unattended.',
    },
    {
      heading: 'Governing law',
      body: 'These terms are governed by the laws of India, and any disputes are subject to the jurisdiction of the courts in Gir Somnath, Gujarat.',
    },
  ],
}
