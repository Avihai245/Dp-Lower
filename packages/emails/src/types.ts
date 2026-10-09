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
  'details-changed',
  'password-reset',
  'contact-received',
  // Supabase auth emails other than password recovery (magic link, signup / email-change confirmation, one-time code)
  'auth-link',
] as const;
export type TransactionalTemplateId = (typeof TRANSACTIONAL_TEMPLATES)[number];

export type EmailTemplateId = WelcomeTemplateId | TransactionalTemplateId;

export const ALL_TEMPLATES: readonly EmailTemplateId[] = [...TRANSACTIONAL_TEMPLATES, ...WELCOME_TEMPLATES];

export const isNurtureTemplate = (id: EmailTemplateId): id is WelcomeTemplateId => id.startsWith('welcome-');

export interface EmailLead {
  id: string;
  firstName: string;
  fullName: string;
  email: string;
  /** null for contact-form senders who are not leads */
  caseRef: string | null;
  route: LeadRoute | null;
  /** only used by booking-confirmation ("We will call ... and ask for ..."); optional */
  phone?: string | null;
}

export interface EmailLinks {
  /** per-recipient "open my portal" link (signed, 60 days) */
  portal: string;
  /** firm website */
  site: string;
  privacy: string;
  /** null for transactional emails */
  unsubscribe: string | null;
  /** the address for the `List-Unsubscribe` header, which a mail provider's one-click button POSTs to (RFC 8058); falls back to `unsubscribe` */
  unsubscribeOneClick?: string | null;
  /** absolute URLs of the email-safe images (PNG/JPG) */
  logo: string;
  teamPhoto: string;
  /**
   * Where the recipient books, moves or cancels the free call ("Book my free call", "Change or cancel"): for a lead, a
   * signed link (60 days) that opens their own booking step; for anyone else, the landing page.
   */
  booking: string;
  /** the campaign's landing page (the Lead Email's footer link); `booking` when not given */
  landing?: string;
}

export type AuthLinkKind = 'magiclink' | 'signup' | 'invite' | 'email_change' | 'email' | 'reauthentication';

/** Template-specific data. Each template reads only the fields listed here. */
export interface EmailData {
  'file-open'?: { applicationState: 'not_started' | 'in_progress' | 'complete'; docsReceived: number; docsTotal: number };
  /** `lawyer`: the name of the lawyer the call is assigned to, when it is */
  'booking-confirmation'?: { startsAt: string; timezone: string; minutes: number; lawyer?: string | null };
  'booking-cancelled'?: { startsAt: string; timezone: string };
  'status-update'?: { status: LeadStatus };
  'document-requested'?: { docTypes: DocType[] };
  'document-rejected'?: { docType: DocType; note?: string | null };
  /** `previous`: the mail to the address the file had until now (no link into the file); `current`: to the address it has now */
  'details-changed'?: { variant: 'current' | 'previous'; changed: Array<'name' | 'email' | 'phone'> };
  'password-reset'?: { resetUrl: string };
  'contact-received'?: { name: string };
  /** `url` is the confirmation / sign-in link; `code` the one-time code (shown when present) */
  'auth-link'?: { url?: string | null; kind: AuthLinkKind; code?: string | null };
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
