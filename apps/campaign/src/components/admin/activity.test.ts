import { describe, expect, it } from 'vitest';
import { activityText } from './activity';
import type { ActivityView } from './types';

/** A tiny stand-in for next-intl's translator: messages with {param} placeholders. */
const MESSAGES: Record<string, string> = {
  'stage.review': 'Under review',
  'stage.filed': 'Filed with authority',
  'status.under_review': 'Under Review',
  'docs.name.passport': 'Your passport',
  'activity.inbox.in_progress': 'in progress',
  'activity.codes.account_created': 'Portal account created',
  'activity.codes.stage_changed': 'Stage changed: {from} → {to}',
  'activity.codes.status_changed': 'Applicant status set to {to}',
  'activity.codes.owner_assigned': 'Assigned to {name}',
  'activity.codes.doc_rejected': 'Document rejected, re-upload requested: {doc}',
  'activity.codes.password_reset_sent': 'Password reset link sent to {email}',
  'activity.codes.callback_status': 'Callback request marked {status}',
};
const t = Object.assign(
  (key: string, v: Record<string, string | number> = {}) => (MESSAGES[key] ?? key).replace(/\{(\w+)\}/g, (_m, k: string) => String(v[k])),
  { has: (key: string) => key in MESSAGES },
);

const entry = (over: Partial<ActivityView>): ActivityView => ({
  id: '1',
  kind: 'staff',
  code: null,
  text: 'English text',
  actorName: 'Anna Reinhardt',
  meta: {},
  createdAt: '2026-10-09T10:00:00Z',
  ...over,
});

describe('activityText', () => {
  it('localises a code that needs no data', () => {
    expect(activityText(t, entry({ kind: 'system', code: 'account_created', text: 'Portal account created' }))).toBe('Portal account created');
  });

  it('fills the message from the entry\'s meta, translating stages, statuses and documents', () => {
    expect(activityText(t, entry({ code: 'stage_changed', meta: { from: 'review', to: 'filed' } }))).toBe('Stage changed: Under review → Filed with authority');
    expect(activityText(t, entry({ code: 'status_changed', meta: { from: 'x', to: 'under_review' } }))).toBe('Applicant status set to Under Review');
    expect(activityText(t, entry({ code: 'doc_rejected', meta: { docType: 'passport' } }))).toBe('Document rejected, re-upload requested: Your passport');
    expect(activityText(t, entry({ code: 'owner_assigned', meta: { ownerName: 'Dana Cohen' } }))).toBe('Assigned to Dana Cohen');
    expect(activityText(t, entry({ code: 'callback_status', meta: { status: 'in_progress' } }))).toBe('Callback request marked in progress');
  });

  it('isolates emails for right-to-left sentences through the given function', () => {
    const e = entry({ code: 'password_reset_sent', meta: { email: 'a@b.co' } });
    expect(activityText(t, e)).toBe('Password reset link sent to a@b.co');
    expect(activityText(t, e, (v) => `[${v}]`)).toBe('Password reset link sent to [a@b.co]');
  });

  it('falls back to the English text for an unknown code, no code, or missing or invalid meta', () => {
    expect(activityText(t, entry({ code: 'something_new', text: 'Something new happened' }))).toBe('Something new happened');
    expect(activityText(t, entry({ code: null, text: 'Legacy entry' }))).toBe('Legacy entry');
    expect(activityText(t, entry({ code: 'stage_changed', text: 'Stage changed: A → B', meta: {} }))).toBe('Stage changed: A → B');
    expect(activityText(t, entry({ code: 'stage_changed', text: 'fallback', meta: { from: 'review', to: 'mars' } }))).toBe('fallback');
    expect(activityText(t, entry({ code: 'doc_rejected', text: 'fallback', meta: { docType: 'not_a_doc' } }))).toBe('fallback');
    expect(activityText(t, entry({ code: 'password_reset_sent', text: 'fallback', meta: { email: 42 } }))).toBe('fallback');
  });
});
