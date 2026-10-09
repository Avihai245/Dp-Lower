import type { Locale } from '@dpl/core';
import { isNurtureTemplate, type EmailContext, type EmailTemplateId } from './types';

/**
 * Realistic sample contexts for the preview script and the tests. Every URL is absolute https, as in production.
 * `name` overrides the recipient (e.g. a hostile name for the escaping test).
 */
export function sampleContext(
  id: EmailTemplateId,
  locale: Locale,
  o: { name?: string; route?: EmailContext['lead']['route']; data?: EmailContext['data']; images?: { logo: string; teamPhoto: string } } = {},
): EmailContext {
  const he = locale === 'he';
  const fullName = o.name ?? (he ? 'דוד כהן' : 'David Cohen');
  const base = he ? 'https://euro-passports.com/he' : 'https://euro-passports.com';
  const nurture = isNurtureTemplate(id);
  const defaults: Partial<Record<EmailTemplateId, EmailContext['data']>> = {
    'file-open': { applicationState: 'in_progress', docsReceived: 3, docsTotal: 8 },
    'booking-confirmation': { startsAt: '2026-10-14T13:30:00.000Z', timezone: he ? 'Asia/Jerusalem' : 'America/New_York', minutes: 20 },
    'booking-cancelled': { startsAt: '2026-10-14T13:30:00.000Z', timezone: he ? 'Asia/Jerusalem' : 'America/New_York' },
    'status-update': { status: 'under_review' },
    'document-requested': { docTypes: ['birth_certificate', 'marriage_certificates', 'passport'] },
    'document-rejected': {
      docType: 'passport',
      note: he ? 'התמונה מטושטשת. נא להעלות סריקה ברורה של העמוד המלא.' : 'The photo is blurred. Please upload a clear scan of the full page.',
    },
    'password-reset': { resetUrl: `${base}/auth/callback?token_hash=3f9c1b7e&type=recovery&next=%2Fcreate-password%3Fmode%3Dreset` },
    'contact-received': { name: fullName },
    'auth-link': { kind: 'magiclink', url: `${base}/auth/callback?token_hash=3f9c1b7e&type=magiclink&next=%2Fportal`, code: null },
  };
  return {
    locale,
    lead: {
      id: '0b0f1c1e-2d57-4c0e-9a39-7d3f6f0b1a11',
      firstName: fullName.trim().split(/\s+/)[0] ?? fullName,
      fullName,
      email: 'david.cohen@example.com',
      caseRef: id === 'contact-received' ? null : 'DPL-26-1487',
      route: o.route === undefined ? 'germany' : o.route,
      phone: '+1 212 555 0142',
    },
    links: {
      portal: `${base}/go/eyJsaWQiOiIwYjBmMWMxZSIsInAiOiJwb3J0YWwifQ.Zm9vYmFy`,
      site: 'https://www.lawoffice.org.il',
      privacy: `${base}/privacy`,
      unsubscribe: nurture ? `${base}/unsubscribe?t=eyJsaWQiOiIwYjBmMWMxZSIsInAiOiJ1bnN1YiJ9.Zm9vYmFy` : null,
      logo: o.images?.logo ?? 'https://euro-passports.com/email/dpl-logo.png',
      teamPhoto: o.images?.teamPhoto ?? 'https://euro-passports.com/email/dpl-team.jpg',
      booking: base,
    },
    data: o.data ?? defaults[id],
  };
}
