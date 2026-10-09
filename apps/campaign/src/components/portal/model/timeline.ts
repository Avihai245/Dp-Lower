import { stageIndex, type LeadStage, type LeadStatus } from '@dpl/core';
import type { StatusStep, StepState, Timeline, TimelineMeta, TimelineNode, TimelineNodeId } from './types';

/** "Review by the firm" is finished once the team has completed the review or is already contacting the applicant. */
const REVIEW_FINISHED: readonly LeadStatus[] = ['review_completed', 'contacting'];

export interface TimelineInput {
  sectionsDone: number;
  /** sections shown in "x of N sections" (the review step counts) */
  sectionsTotal: number;
  applicationComplete: boolean;
  docsReceived: number;
  docsTotal: number;
  submittedAt: string | null;
  status: LeadStatus;
  /** a booked or held consultation; null when none (the "Consultation call" stage is then left out) */
  booking: { startsAt: string; timezone: string | null } | null;
}

interface RawNode {
  id: TimelineNodeId;
  done: boolean;
  meta: TimelineMeta;
}

/**
 * The stage line at the top of the portal ("Where your application stands"), from the prototype's `tl`.
 * Same rules: the first stage that is not done is the current one (the last stage when all are done), and the green fill
 * reaches the last finished stage. Once the application has been submitted the stages before "Submitted to the firm"
 * count as passed: the applicant's own work is over (missing records can still be added), and a ticked stage after an
 * unticked one would read as a bug. "x of N uploaded" keeps telling the truth about the documents.
 */
export function buildTimeline(i: TimelineInput): Timeline {
  const submitted = !!i.submittedAt;
  const docsAll = i.docsTotal > 0 && i.docsReceived >= i.docsTotal;
  const applicationDone = i.applicationComplete || submitted;

  const candidates: Array<RawNode | null> = [
    { id: 'eligibility', done: true, meta: { kind: 'completed' } },
    i.booking
      ? { id: 'consultation', done: true, meta: { kind: 'date', iso: i.booking.startsAt, timezone: i.booking.timezone, style: 'slot' } }
      : null,
    { id: 'portal', done: true, meta: { kind: 'signedIn' } },
    {
      id: 'application',
      done: applicationDone,
      meta: applicationDone ? { kind: 'completed' } : { kind: 'sections', done: i.sectionsDone, total: i.sectionsTotal },
    },
    {
      id: 'documents',
      done: docsAll || submitted,
      meta: docsAll ? { kind: 'completed' } : { kind: 'uploaded', done: i.docsReceived, total: i.docsTotal },
    },
    {
      id: 'submitted',
      done: submitted,
      meta: submitted ? { kind: 'date', iso: i.submittedAt as string, timezone: null, style: 'short' } : { kind: 'waiting' },
    },
    {
      id: 'review',
      done: submitted && REVIEW_FINISHED.includes(i.status),
      meta: submitted ? { kind: 'status', status: i.status } : { kind: 'afterSubmit' },
    },
  ];
  const raw = candidates.filter((n): n is RawNode => n !== null);

  let cur = raw.findIndex((n) => !n.done);
  const allDone = cur === -1;
  if (allDone) cur = raw.length - 1;

  const nodes: TimelineNode[] = raw.map((n, k) => ({
    id: n.id,
    state: n.done ? 'done' : k === cur ? 'current' : 'next',
    meta: n.meta,
  }));

  const percent = allDone ? 100 : cur <= 0 ? 0 : Math.round(((cur - 1) / (raw.length - 1)) * 100);
  const current: Timeline['current'] = submitted ? { kind: 'status', status: i.status } : { kind: 'node', id: raw[cur]!.id };
  return { nodes, percent, current };
}

export interface StatusStepsInput {
  stage: LeadStage;
  createdAt: string;
  submittedAt: string | null;
  docsReceived: number;
  docsTotal: number;
  /** when the most recent file arrived */
  lastUploadAt: string | null;
}

/**
 * The six-step roadmap of a submitted case. The prototype printed demo dates and an estimate ("Est. Jun 2026"); these steps
 * come from what the system really knows: the stage the team has the case in, the submission date and the documents.
 * The firm's own stages (research, filing, passport appointment) carry no date because none is recorded.
 */
export function buildStatusSteps(i: StatusStepsInput): StatusStep[] {
  const docsDone = i.docsTotal > 0 && i.docsReceived >= i.docsTotal;
  const at = stageIndex(i.stage);
  const review = stageIndex('review');
  const filed = stageIndex('filed');
  const granted = stageIndex('granted');
  const state = (done: boolean, current: boolean): StepState => (done ? 'done' : current ? 'current' : 'next');

  return [
    { id: 'eligibility', state: 'done', meta: { kind: 'date', iso: i.createdAt } },
    {
      id: 'application',
      state: state(!!i.submittedAt, true),
      meta: i.submittedAt ? { kind: 'date', iso: i.submittedAt } : { kind: 'inProgress' },
    },
    {
      id: 'documents',
      state: state(docsDone, true),
      meta: docsDone
        ? i.lastUploadAt
          ? { kind: 'date', iso: i.lastUploadAt }
          : { kind: 'completed' }
        : { kind: 'received', done: i.docsReceived, total: i.docsTotal },
    },
    {
      id: 'research',
      state: state(at > review, at === review),
      meta: at > review ? { kind: 'completed' } : at === review ? { kind: 'inProgress' } : { kind: 'pending' },
    },
    {
      id: 'filed',
      state: state(at >= granted, at === filed),
      meta: at >= granted ? { kind: 'completed' } : at === filed ? { kind: 'inProgress' } : { kind: 'notFiled' },
    },
    { id: 'passport', state: state(false, at >= granted), meta: { kind: 'notScheduled' } },
  ];
}
