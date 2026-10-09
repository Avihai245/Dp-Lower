import type { LeadRoute, LeadStage, LeadStatus } from './statuses';

/** Day (after the lead is created) on which each of the 15 welcome emails goes out. Index + 1 = email number. */
export const WELCOME_DAYS = [0, 2, 3, 5, 8, 11, 14, 18, 22, 26, 30, 34, 38, 42, 46] as const;
export const WELCOME_COUNT = WELCOME_DAYS.length;

/** An email is skipped (never sent late) when it is overdue by more than this, e.g. after dispatcher downtime. */
export const MISSED_WINDOW_HOURS = 36;
/** Minimum gap between two nurture emails to the same person. */
export const MIN_GAP_HOURS = 20;

export interface DripLeadState {
  createdAt: Date;
  unsubscribedAt: Date | null;
  submittedAt: Date | null;
  stage: LeadStage;
  status: LeadStatus;
  hasBooking: boolean;
  docsReceived: number;
  docsTotal: number;
  route: LeadRoute | null;
}
export interface DripRecord {
  number: number;
  status: 'queued' | 'sent' | 'skipped';
  /** when the email was queued/sent; used for the minimum gap */
  sentAt?: Date | null;
}

export type SkipReason = 'already_booked' | 'documents_started' | 'missed_window';
export type StopReason = 'unsubscribed' | 'submitted' | 'past_application' | 'status_closed';

export type DripDecision =
  | { action: 'send'; number: number; scheduledFor: Date }
  | { action: 'skip'; number: number; scheduledFor: Date; reason: SkipReason }
  | { action: 'stop'; reason: StopReason };

export const welcomeScheduledFor = (createdAt: Date, number: number): Date =>
  new Date(createdAt.getTime() + WELCOME_DAYS[number - 1]! * 86_400_000);

/**
 * The statuses of a case the team is dealing with: once one is set (the team can set them before the application is
 * submitted, for example for a file handed in on paper, a lead the firm is already talking to, or a case that is done)
 * the applicant is no longer someone to nurture. The other three (enquiry, account created, application in progress)
 * are the applicant's own.
 */
export const CLOSED_STATUSES: readonly LeadStatus[] = ['application_submitted', 'under_review', 'info_required', 'review_completed', 'contacting'];

/** Why the whole sequence should stop for this lead, if it should. */
export function dripStopReason(s: Pick<DripLeadState, 'unsubscribedAt' | 'submittedAt' | 'stage' | 'status'>): StopReason | null {
  if (s.unsubscribedAt) return 'unsubscribed';
  if (s.submittedAt) return 'submitted';
  if (s.stage === 'review' || s.stage === 'filed' || s.stage === 'granted') return 'past_application';
  if (CLOSED_STATUSES.includes(s.status)) return 'status_closed';
  return null;
}

/**
 * What the dispatcher should do for one lead right now.
 *  - stops after unsubscribe, submission, when the case has moved past the application or when the team has set a status
 *    (under review, more information needed, review completed, contacting the applicant);
 *  - email 3 ("your call is still open") is skipped when a call is booked;
 *  - emails 2 and 4 (asking for records) are sent only to someone who has not uploaded anything yet: they are skipped
 *    as soon as one document is in;
 *  - an email overdue by more than MISSED_WINDOW_HOURS is skipped, not sent late;
 *  - at most one email is sent per run, and not within MIN_GAP_HOURS of the previous one.
 */
export function planDrip(state: DripLeadState, records: readonly DripRecord[], now: Date): DripDecision[] {
  const stop = dripStopReason(state);
  if (stop) return [{ action: 'stop', reason: stop }];

  const done = new Set(records.map((r) => r.number));
  const lastSent = records
    .filter((r) => r.status !== 'skipped' && r.sentAt)
    .reduce<number>((max, r) => Math.max(max, r.sentAt!.getTime()), 0);

  const decisions: DripDecision[] = [];
  let sendChosen = false;
  for (let number = 1; number <= WELCOME_COUNT; number++) {
    if (done.has(number)) continue;
    const scheduledFor = welcomeScheduledFor(state.createdAt, number);
    if (scheduledFor.getTime() > now.getTime()) break;

    if (number === 3 && state.hasBooking) {
      decisions.push({ action: 'skip', number, scheduledFor, reason: 'already_booked' });
      continue;
    }
    if ((number === 2 || number === 4) && state.docsReceived > 0) {
      decisions.push({ action: 'skip', number, scheduledFor, reason: 'documents_started' });
      continue;
    }
    const overdueHours = (now.getTime() - scheduledFor.getTime()) / 3_600_000;
    if (number > 1 && overdueHours > MISSED_WINDOW_HOURS) {
      decisions.push({ action: 'skip', number, scheduledFor, reason: 'missed_window' });
      continue;
    }
    if (sendChosen) continue;
    if (number > 1 && lastSent && now.getTime() - lastSent < MIN_GAP_HOURS * 3_600_000) continue;
    decisions.push({ action: 'send', number, scheduledFor });
    sendChosen = true;
  }
  return decisions;
}
