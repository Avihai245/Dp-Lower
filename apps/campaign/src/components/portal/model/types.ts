import type { ApplicationData, DocStatus, DocType, LeadRoute, LeadStage, LeadStatus, Locale } from '@dpl/core';

/**
 * Shapes shared by the portal API (GET /api/portal/state), the server pages and the client components.
 * Everything here is plain JSON: dates are ISO strings, and nothing in it is a storage path or a download link
 * (applicants only ever see file names and states).
 */

/** The only activity_log codes an applicant sees in "Case activity". Everything else is for the team. */
export const APPLICANT_ACTIVITY_CODES = [
  'account_created',
  'booking_created',
  'application_started',
  'document_uploaded',
  'application_submitted',
  'status_changed',
] as const;
export type ApplicantActivityCode = (typeof APPLICANT_ACTIVITY_CODES)[number];

export interface PortalLead {
  caseRef: string;
  fullName: string;
  firstName: string;
  email: string;
  phone: string | null;
  locale: Locale;
  route: LeadRoute | null;
  stage: LeadStage;
  status: LeadStatus;
  accountCreated: boolean;
  passwordSet: boolean;
  emailVerified: boolean;
  tourDone: boolean;
  createdAt: string;
  applicationStartedAt: string | null;
  submittedAt: string | null;
}

export interface PortalApplication {
  data: ApplicationData;
  currentSection: number;
  completedAt: string | null;
  /** input sections (0..4) that satisfy sectionDone() */
  sectionsDone: number;
  complete: boolean;
}

export interface PortalDocument {
  docType: DocType;
  status: DocStatus;
  fileName: string | null;
  uploadedAt: string | null;
  /** the team's note when a file has to be replaced */
  reviewNote: string | null;
  size: number | null;
  mimeType: string | null;
}

export interface PortalBooking {
  id: string;
  startsAt: string;
  endsAt: string;
  timezone: string | null;
}

export interface PortalActivity {
  id: string;
  code: ApplicantActivityCode;
  at: string;
  /** for status_changed: the applicant-facing status that was set */
  status?: LeadStatus;
  /** for document_uploaded: which slot */
  docType?: DocType;
}

export type TimelineNodeId = 'eligibility' | 'consultation' | 'portal' | 'application' | 'documents' | 'submitted' | 'review';
export type StepState = 'done' | 'current' | 'next';

export type TimelineMeta =
  | { kind: 'completed' }
  | { kind: 'signedIn' }
  | { kind: 'sections'; done: number; total: number }
  | { kind: 'uploaded'; done: number; total: number }
  /** `slot` is the booking screen's wording ("Tue Apr 14"), `short` the day and month ("12 Apr") */
  | { kind: 'date'; iso: string; timezone: string | null; style: 'slot' | 'short' }
  | { kind: 'waiting' }
  | { kind: 'afterSubmit' }
  | { kind: 'status'; status: LeadStatus };

export interface TimelineNode {
  id: TimelineNodeId;
  state: StepState;
  meta: TimelineMeta;
}

export interface Timeline {
  nodes: TimelineNode[];
  /** width of the green fill on the horizontal line, 0..100 */
  percent: number;
  /** "Current stage · …" */
  current: { kind: 'status'; status: LeadStatus } | { kind: 'node'; id: TimelineNodeId };
}

export type StatusStepId = 'eligibility' | 'application' | 'documents' | 'research' | 'filed' | 'passport';
export type StatusStepMeta =
  | { kind: 'date'; iso: string }
  | { kind: 'completed' }
  | { kind: 'inProgress' }
  | { kind: 'received'; done: number; total: number }
  | { kind: 'pending' }
  | { kind: 'notFiled' }
  | { kind: 'notScheduled' };
export interface StatusStep {
  id: StatusStepId;
  state: StepState;
  meta: StatusStepMeta;
}

export interface PortalProgress {
  /** "Application and documents · N% complete" */
  percent: number;
  /** application header: share of the four input sections that are done */
  applicationPercent: number;
  sectionsDone: number;
  /** all sections including the review step, shown as "x of 5 sections" */
  sectionsTotal: number;
  docsReceived: number;
  docsTotal: number;
}

export interface PortalState {
  lead: PortalLead;
  application: PortalApplication | null;
  /** always one entry per slot, in DOC_TYPES order */
  documents: PortalDocument[];
  booking: PortalBooking | null;
  /** the staff member who owns the case, when one is assigned */
  caseHandler: { name: string } | null;
  activity: PortalActivity[];
  timeline: Timeline;
  statusSteps: StatusStep[];
  progress: PortalProgress;
}
