import type { Locale } from './locale';

/** Events written to the outbox (table `events`) and delivered to Zapier. */
export const CRM_EVENT_TYPES = [
  'lead.created',
  'lead.returned',
  'booking.created',
  'booking.cancelled',
  'callback.requested',
  'contact.created',
  'account.created',
  'application.started',
  'application.submitted',
  'document.uploaded',
  'document.reviewed',
  'status.changed',
  'stage.changed',
  'result.requested',
  'unsubscribed',
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
