import type { DocType, LeadRoute, LeadStatus, Locale } from '@dpl/core';

/** The 15-email nurture sequence (category 'nurture': stops on unsubscribe, submission, ...). */
export const WELCOME_TEMPLATES = [
  'welcome-1', 'welcome-2', 'welcome-3', 'welcome-4', 'welcome-5', 'welcome-6', 'welcome-7', 'welcome-8',
  'welcome-9', 'welcome-10', 'welcome-11', 'welcome-12', 'welcome-13', 'welcome-14', 'welcome-15',
] as const;
export type WelcomeTemplateId = (typeof WELCOME_TEMPLATES)[number];

/** One-off emails triggered by something the person or the firm did (category 'transactional'). */
export const TRANSACTIONAL_TEMPLATES = [
  'file-open', // the "Lead Email" design: result / file summary, also used when a returning lead asks for a link
  'booking-confirmation',
  'booking-cancelled',
  'status-update',
  'document-requested',
  'document-rejected',
  'application-received',
  'password-reset',
  'contact-received',
] as const;
export type TransactionalTemplateId = (typeof TRANSACTIONAL_TEMPLATES)[number];

export type EmailTemplateId = WelcomeTemplateId | TransactionalTemplateId;

export const isNurtureTemplate = (id: EmailTemplateId): id is WelcomeTemplateId => id.startsWith('welcome-');

export interface EmailLead {
  id: string;
  firstName: string;
  fullName: string;
  email: string;
  /** null for contact-form senders who are not leads */
  caseRef: string | null;
  route: LeadRoute | null;
}

export interface EmailLinks {
  /** per-recipient "open my portal" link (signed, 60 days) */
  portal: string;
  /** firm website */
  site: string;
  privacy: string;
  /** null for transactional emails */
  unsubscribe: string | null;
  /** absolute URLs of the email-safe images (PNG/JPG) */
  logo: string;
  teamPhoto: string;
  /** landing page, used for "Book my free call" style links */
  booking: string;
}

/** Template-specific data. Each template reads only the fields listed here. */
export interface EmailData {
  'file-open'?: { applicationState: 'not_started' | 'in_progress' | 'complete'; docsReceived: number; docsTotal: number };
  'booking-confirmation'?: { startsAt: string; timezone: string; minutes: number };
  'booking-cancelled'?: { startsAt: string; timezone: string };
  'status-update'?: { status: LeadStatus };
  'document-requested'?: { docTypes: DocType[] };
  'document-rejected'?: { docType: DocType; note?: string | null };
  'password-reset'?: { resetUrl: string };
  'contact-received'?: { name: string };
}

export interface EmailContext {
  locale: Locale;
  lead: EmailLead;
  links: EmailLinks;
  data?: EmailData[keyof EmailData] | Record<string, unknown>;
}

export interface RenderedEmail {
  subject: string;
  /** hidden inbox preview text */
  preheader: string;
  html: string;
  text: string;
}
