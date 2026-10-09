import type { Locale } from './locale';

/** Events written to the outbox (table `events`) and delivered to Zapier. */
export const CRM_EVENT_TYPES = [
  'lead.created',
  'lead.returned',
  'lead.updated',
  'booking.created',
  'booking.cancelled',
  /** the applicant did not take the call (marked by staff): for the firm's follow-up, no email goes to the applicant */
  'booking.no_show',
  /** staff corrected a no-show to held: for a CRM that already recorded the no-show (sent only after a no-show) */
  'booking.held',
  'callback.requested',
  'contact.created',
  'account.created',
  'application.started',
  'application.submitted',
  'document.uploaded',
  'document.removed',
  'document.reviewed',
  'status.changed',
  'stage.changed',
  'result.requested',
  'unsubscribed',
  'lead.deleted',
] as const;
export type CrmEventType = (typeof CRM_EVENT_TYPES)[number];

export type EventType = CrmEventType | 'email.send';

/** Payload of an `email.send` event: a fully rendered email, ready for any "send email" Zap step. */
export interface EmailPayload {
  template: string;
  locale: Locale;
  to: { email: string; name: string };
  from: { email: string; name: string };
  replyTo: string;
  subject: string;
  preheader: string;
  html: string;
  text: string;
  /** transactional emails ignore unsubscribe; marketing/nurture emails respect it */
  category: 'transactional' | 'nurture';
  /**
   * Nurture emails only: the signed unsubscribe address. A sending app that can set headers should send it as
   * `List-Unsubscribe: <url>` with `List-Unsubscribe-Post: List-Unsubscribe=One-Click` (docs/DEPLOYMENT.md, Zap 1).
   */
  listUnsubscribe?: string;
}

export interface LeadSnapshot {
  id: string;
  caseRef: string;
  name: string;
  email: string;
  phone: string | null;
  locale: Locale;
  route: string | null;
  source: string;
  stage: string;
  status: string;
}
