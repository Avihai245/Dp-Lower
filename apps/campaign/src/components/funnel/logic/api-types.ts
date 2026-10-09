import type { LeadRoute, LeadStage, LeadStatus, Locale, QuizAnswers, SlotDay } from '@dpl/core';

/** Response shapes of the funnel API (docs/ARCHITECTURE.md section 8), shared by the routes and the screens. */

export interface BookingSummary {
  id: string;
  startsAt: string;
  endsAt: string;
  timezone: string | null;
}

/** GET /api/lead */
export interface LeadSummary {
  leadId: string;
  caseRef: string;
  fullName: string;
  firstName: string;
  email: string;
  phone: string | null;
  locale: Locale;
  route: LeadRoute | null;
  answers: QuizAnswers;
  stage: LeadStage;
  status: LeadStatus;
  accountCreated: boolean;
  passwordSet: boolean;
  emailVerified: boolean;
  booking: BookingSummary | null;
}

/** POST /api/leads */
export type LeadSubmitResponse =
  | { status: 'created' | 'updated'; leadId: string; caseRef: string }
  | { status: 'existing' };

/** GET /api/availability */
export interface AvailabilityResponse {
  days: SlotDay[];
  /** free seats in the days listed */
  seatsLeft: number;
  /** the firm's IANA zone: the dates in `days` are calendar dates there */
  timezone: string;
  callMinutes: number;
}
