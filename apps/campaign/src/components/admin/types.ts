import type { DocStatus, DocType, LeadRoute, LeadStage, LeadStatus, Locale, QuizId } from '@dpl/core';

/**
 * Serialisable shapes the CRM server code hands to the browser. No functions, no Dates (ISO strings), so they can
 * cross the Server -> Client Component boundary as props. Pure helpers that work on them live in model.ts.
 */

/** One lead as the list, the board and the pager need it. Built on the server from admin_lead_rows + documents. */
export interface LeadRowData {
  id: string;
  caseRef: string;
  fullName: string;
  email: string;
  phone: string | null;
  locale: Locale;
  route: LeadRoute | null;
  /** where the applicant lives, already in the page language (quiz answer label), display only */
  where: string | null;
  /** "Ruth Weiss · Vienna 1911", null when the application has no ancestor yet */
  ancestor: string | null;
  stage: LeadStage;
  stageSince: string;
  status: LeadStatus;
  ownerId: string | null;
  /** document slots that are not 'received' (DOC_TYPES order) */
  missingDocTypes: DocType[];
  hasRejectedDoc: boolean;
  notesCount: number;
  createdAt: string;
  updatedAt: string;
  nextCallAt: string | null;
  applicationComplete: boolean;
  nextActionDoneAt: string | null;
}

export interface StaffOption {
  id: string;
  name: string;
  role: 'admin' | 'lawyer' | 'case_manager';
}

export interface InboxCounts {
  callbacks: number;
  contacts: number;
}

export interface DocView {
  docType: DocType;
  status: DocStatus;
  fileName: string | null;
  /** a file is stored (the "View" action works) */
  hasFile: boolean;
  reviewNote: string | null;
  uploadedAt: string | null;
  requestedAt: string | null;
}

export interface NoteView {
  id: string;
  authorId: string | null;
  authorName: string | null;
  body: string;
  createdAt: string;
}

export interface ActivityView {
  id: string;
  kind: 'system' | 'staff';
  code: string | null;
  /** English fallback */
  text: string;
  actorName: string | null;
  meta: Record<string, unknown>;
  createdAt: string;
}

export interface AnswerView {
  id: QuizId;
  question: string;
  /** null = not recorded */
  answer: string | null;
}

export interface LeadDetailData {
  lead: LeadRowData;
  documents: DocView[];
  /** the five application sections, true = complete */
  sections: boolean[];
  /** postal address from the application, shown under Contact */
  address: string | null;
  /** where the lead came from: the source label and the campaign (utm_*) parameters of the first visit */
  origin: { source: string | null; utm: Record<string, string> };
  answers: AnswerView[];
  notes: NoteView[];
  activity: ActivityView[];
  /** the upcoming call, or else the last one whose time has come (held, no-show, or waiting to be marked); null: none */
  call: CallView | null;
}

/** A booked call as the lead page shows it. Cancelled calls are not shown (the activity keeps them). */
export type CallStatus = 'confirmed' | 'completed' | 'no_show';

export interface CallView {
  id: string;
  startsAt: string;
  endsAt: string;
  status: CallStatus;
  /** confirmed and not over yet (the header chip, "Cancel call") */
  upcoming: boolean;
  /** the call has started: it can be marked held or a no-show */
  started: boolean;
  /** the applicant's own time zone, when they booked it */
  timezone: string | null;
  /** the lawyer the call is assigned to; null: the unassigned template (any lawyer) */
  lawyer: { id: string; name: string } | null;
}

/** Result every CRM Server Action returns (never throws to the browser). */
export type ActionError =
  | 'unauthorized'
  | 'forbidden'
  | 'invalid'
  | 'not_found'
  | 'conflict'
  | 'duplicate'
  | 'email_taken'
  | 'stale'
  | 'confirm_mismatch'
  | 'rate_limited'
  | 'internal';
export type ActionResult<T = void> = { ok: true; data: T } | { ok: false; error: ActionError; field?: string };

// -- inbox ---------------------------------------------------------------------------------------------------------

export type InboxStatus = 'new' | 'in_progress' | 'closed';

export interface LeadLink {
  id: string;
  caseRef: string;
  name: string;
}

export interface CallbackItem {
  id: string;
  name: string | null;
  phone: string;
  locale: Locale;
  source: string | null;
  status: InboxStatus;
  handledByName: string | null;
  note: string | null;
  createdAt: string;
  updatedAt: string;
  lead: LeadLink | null;
}

export interface ContactItem {
  id: string;
  kind: 'contact' | 'lead_band' | 'chat';
  name: string;
  email: string | null;
  phone: string | null;
  matter: string | null;
  note: string | null;
  locale: Locale;
  page: string | null;
  source: string | null;
  status: InboxStatus;
  handledByName: string | null;
  createdAt: string;
  updatedAt: string;
  /** a lead with the same email address, when there is one */
  lead: LeadLink | null;
}

export interface InboxData {
  callbacks: CallbackItem[];
  contacts: ContactItem[];
}

// -- availability --------------------------------------------------------------------------------------------------

export interface RuleView {
  id: string;
  weekday: number;
  /** 'HH:MM' in the firm's time zone */
  startTime: string;
  capacity: number;
  active: boolean;
  /** the lawyer whose hours these are; null = the unassigned template */
  staffId: string | null;
}

export interface ExceptionView {
  id: string;
  /** 'YYYY-MM-DD' in the firm's time zone */
  onDate: string;
  /** null = the whole day */
  startTime: string | null;
  reason: string | null;
  /** the lawyer who is away; null = closed for everyone */
  staffId: string | null;
}

export interface BookingView {
  id: string;
  startsAt: string;
  endsAt: string;
  lead: (LeadLink & { phone: string | null }) | null;
  /** null = a seat of the unassigned template */
  lawyer: { id: string; name: string } | null;
}

/** A lawyer who takes calls (active, role lawyer): one calendar of their own on the availability page. */
export interface LawyerView {
  id: string;
  name: string;
}

export interface AvailabilityData {
  rules: RuleView[];
  exceptions: ExceptionView[];
  bookings: BookingView[];
  lawyers: LawyerView[];
  timezone: string;
  callMinutes: number;
}

// -- team ----------------------------------------------------------------------------------------------------------

export interface StaffView {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'lawyer' | 'case_manager';
  active: boolean;
  createdAt: string;
}
