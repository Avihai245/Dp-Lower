import { describe, expect, it } from 'vitest';
import { buildStatusSteps, buildTimeline, type StatusStepsInput, type TimelineInput } from './timeline';

const base: TimelineInput = {
  sectionsDone: 0,
  sectionsTotal: 5,
  applicationComplete: false,
  docsReceived: 0,
  docsTotal: 8,
  submittedAt: null,
  status: 'account_created',
  booking: null,
};
const ids = (t: ReturnType<typeof buildTimeline>) => t.nodes.map((n) => n.id);
const states = (t: ReturnType<typeof buildTimeline>) => t.nodes.map((n) => n.state);

describe('buildTimeline', () => {
  it('starts at "Your application" with six stages when there is no booking', () => {
    const t = buildTimeline(base);
    expect(ids(t)).toEqual(['eligibility', 'portal', 'application', 'documents', 'submitted', 'review']);
    expect(states(t)).toEqual(['done', 'done', 'current', 'next', 'next', 'next']);
    expect(t.current).toEqual({ kind: 'node', id: 'application' });
    expect(t.nodes[2]!.meta).toEqual({ kind: 'sections', done: 0, total: 5 });
    expect(t.nodes[3]!.meta).toEqual({ kind: 'uploaded', done: 0, total: 8 });
    expect(t.nodes[4]!.meta).toEqual({ kind: 'waiting' });
    expect(t.nodes[5]!.meta).toEqual({ kind: 'afterSubmit' });
  });

  it('shows a status the team set before the application was submitted, but does not call the review finished', () => {
    for (const status of ['under_review', 'info_required', 'review_completed', 'contacting'] as const) {
      const t = buildTimeline({ ...base, status });
      expect(t.nodes.at(-1)).toEqual({ id: 'review', state: 'next', meta: { kind: 'status', status } });
      expect(t.current).toEqual({ kind: 'node', id: 'application' });
    }
    // the applicant's own statuses say nothing yet
    for (const status of ['enquiry', 'account_created', 'application_incomplete'] as const) {
      expect(buildTimeline({ ...base, status }).nodes.at(-1)!.meta).toEqual({ kind: 'afterSubmit' });
    }
  });

  it('adds the consultation call as a done stage when one is booked', () => {
    const t = buildTimeline({ ...base, booking: { startsAt: '2026-10-12T09:00:00Z', timezone: 'America/New_York' } });
    expect(ids(t)).toEqual(['eligibility', 'consultation', 'portal', 'application', 'documents', 'submitted', 'review']);
    expect(t.nodes[1]).toEqual({
      id: 'consultation',
      state: 'done',
      meta: { kind: 'date', iso: '2026-10-12T09:00:00Z', timezone: 'America/New_York', style: 'slot' },
    });
    expect(t.current).toEqual({ kind: 'node', id: 'application' });
  });

  it('fills the green line up to the last finished stage (prototype: (cur - 1) / (n - 1))', () => {
    // cur = 2 of 6 nodes: 1/5 of the line
    expect(buildTimeline(base).percent).toBe(20);
    const withCall = buildTimeline({ ...base, booking: { startsAt: '2026-10-12T09:00:00Z', timezone: null } });
    // cur = 3 of 7 nodes: 2/6
    expect(withCall.percent).toBe(33);
  });

  it('moves on to documents once the application is complete', () => {
    const t = buildTimeline({ ...base, sectionsDone: 4, applicationComplete: true, docsReceived: 3 });
    expect(states(t)).toEqual(['done', 'done', 'done', 'current', 'next', 'next']);
    expect(t.nodes[2]!.meta).toEqual({ kind: 'completed' });
    expect(t.nodes[3]!.meta).toEqual({ kind: 'uploaded', done: 3, total: 8 });
    expect(t.current).toEqual({ kind: 'node', id: 'documents' });
  });

  it('reaches "Submitted to the firm" only when everything before it is in', () => {
    const t = buildTimeline({ ...base, sectionsDone: 4, applicationComplete: true, docsReceived: 8 });
    expect(states(t)).toEqual(['done', 'done', 'done', 'done', 'current', 'next']);
    expect(t.current).toEqual({ kind: 'node', id: 'submitted' });
    expect(t.nodes[3]!.meta).toEqual({ kind: 'completed' });
  });

  it('after submission the stages before it are passed, the review is current and shows the status', () => {
    const t = buildTimeline({
      ...base,
      sectionsDone: 4,
      applicationComplete: true,
      docsReceived: 4,
      submittedAt: '2026-10-09T10:00:00Z',
      status: 'under_review',
    });
    expect(states(t)).toEqual(['done', 'done', 'done', 'done', 'done', 'current']);
    expect(t.nodes[3]!.meta).toEqual({ kind: 'uploaded', done: 4, total: 8 });
    expect(t.nodes[4]!.meta).toEqual({ kind: 'date', iso: '2026-10-09T10:00:00Z', timezone: null, style: 'short' });
    expect(t.nodes[5]!.meta).toEqual({ kind: 'status', status: 'under_review' });
    expect(t.current).toEqual({ kind: 'status', status: 'under_review' });
    // the fill stops at the last finished stage, one before the current one
    expect(t.percent).toBe(80);
  });

  it('completes the whole line when the team has finished the review', () => {
    const t = buildTimeline({
      ...base,
      sectionsDone: 4,
      applicationComplete: true,
      docsReceived: 8,
      submittedAt: '2026-10-09T10:00:00Z',
      status: 'review_completed',
    });
    expect(states(t).every((s) => s === 'done')).toBe(true);
    expect(t.percent).toBe(100);
    expect(t.current).toEqual({ kind: 'status', status: 'review_completed' });
  });

  it('keeps contacting-applicant as a finished review too', () => {
    const t = buildTimeline({ ...base, applicationComplete: true, submittedAt: '2026-10-09T10:00:00Z', status: 'contacting' });
    expect(t.nodes.at(-1)!.state).toBe('done');
  });
});

describe('buildStatusSteps', () => {
  const input: StatusStepsInput = {
    stage: 'review',
    createdAt: '2026-10-01T08:00:00Z',
    submittedAt: '2026-10-09T10:00:00Z',
    docsReceived: 3,
    docsTotal: 8,
    lastUploadAt: '2026-10-09T09:00:00Z',
  };

  it('describes a case under review', () => {
    const steps = buildStatusSteps(input);
    expect(steps.map((s) => s.id)).toEqual(['eligibility', 'application', 'documents', 'research', 'filed', 'passport']);
    expect(steps.map((s) => s.state)).toEqual(['done', 'done', 'current', 'current', 'next', 'next']);
    expect(steps[0]!.meta).toEqual({ kind: 'date', iso: '2026-10-01T08:00:00Z' });
    expect(steps[1]!.meta).toEqual({ kind: 'date', iso: '2026-10-09T10:00:00Z' });
    expect(steps[2]!.meta).toEqual({ kind: 'received', done: 3, total: 8 });
    expect(steps[3]!.meta).toEqual({ kind: 'inProgress' });
    expect(steps[4]!.meta).toEqual({ kind: 'notFiled' });
    expect(steps[5]!.meta).toEqual({ kind: 'notScheduled' });
  });

  it('marks documents done with the date of the last file once all eight are in', () => {
    const steps = buildStatusSteps({ ...input, docsReceived: 8 });
    expect(steps[2]).toEqual({ id: 'documents', state: 'done', meta: { kind: 'date', iso: '2026-10-09T09:00:00Z' } });
    expect(buildStatusSteps({ ...input, docsReceived: 8, lastUploadAt: null })[2]!.meta).toEqual({ kind: 'completed' });
  });

  it('follows the stage the team has the case in', () => {
    const filed = buildStatusSteps({ ...input, stage: 'filed' });
    expect(filed.map((s) => s.state)).toEqual(['done', 'done', 'current', 'done', 'current', 'next']);
    expect(filed[3]!.meta).toEqual({ kind: 'completed' });
    expect(filed[4]!.meta).toEqual({ kind: 'inProgress' });

    const granted = buildStatusSteps({ ...input, stage: 'granted' });
    expect(granted.map((s) => s.state)).toEqual(['done', 'done', 'current', 'done', 'done', 'current']);
    expect(granted[5]!.meta).toEqual({ kind: 'notScheduled' });
  });

  it('keeps research pending while the case is not yet in review', () => {
    const early = buildStatusSteps({ ...input, stage: 'application' });
    expect(early[3]).toEqual({ id: 'research', state: 'next', meta: { kind: 'pending' } });
  });
});
