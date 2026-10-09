import { describe, expect, it } from 'vitest';
import {
  addExceptionInput,
  addNoteInput,
  addRuleInput,
  assignOwnerInput,
  docActionInput,
  inboxStatusInput,
  moveStageInput,
  nextActionInput,
  setStatusInput,
  updateContactInput,
  updateRuleInput,
  updateStaffInput,
} from './crm-schemas';

const ID = '3d4b0e9f-0dca-48cb-a6d8-497534af5c15';

describe('lead actions', () => {
  it('moveStage takes a lead id and one of the six stages', () => {
    expect(moveStageInput.safeParse({ leadId: ID, stage: 'review' }).success).toBe(true);
    expect(moveStageInput.safeParse({ leadId: ID, stage: 'archived' }).success).toBe(false);
    expect(moveStageInput.safeParse({ leadId: 'nope', stage: 'review' }).success).toBe(false);
    expect(moveStageInput.safeParse({ stage: 'review' }).success).toBe(false);
  });

  it('setStatus only accepts the statuses the team may pick (never the automatic ones)', () => {
    for (const status of ['application_submitted', 'under_review', 'info_required', 'review_completed', 'contacting']) {
      expect(setStatusInput.safeParse({ leadId: ID, status }).success, status).toBe(true);
    }
    for (const status of ['enquiry', 'account_created', 'application_incomplete', 'granted']) {
      expect(setStatusInput.safeParse({ leadId: ID, status }).success, status).toBe(false);
    }
  });

  it('nextAction names the action the page showed', () => {
    expect(nextActionInput.safeParse({ leadId: ID, expected: 'send_reminder' }).success).toBe(true);
    expect(nextActionInput.safeParse({ leadId: ID, expected: 'delete_everything' }).success).toBe(false);
  });

  it('documents: a known slot and one of four operations, a bounded note', () => {
    expect(docActionInput.safeParse({ leadId: ID, docType: 'passport', action: 'reject', note: 'blurred' }).success).toBe(true);
    expect(docActionInput.safeParse({ leadId: ID, docType: 'passport', action: 'delete' }).success).toBe(false);
    expect(docActionInput.safeParse({ leadId: ID, docType: 'selfie', action: 'request' }).success).toBe(false);
    expect(docActionInput.safeParse({ leadId: ID, docType: 'passport', action: 'reject', note: 'x'.repeat(1001) }).success).toBe(false);
  });

  it('notes are trimmed, not empty, at most 5000 characters', () => {
    expect(addNoteInput.parse({ leadId: ID, body: '  hello  ' }).body).toBe('hello');
    expect(addNoteInput.safeParse({ leadId: ID, body: '   ' }).success).toBe(false);
    expect(addNoteInput.safeParse({ leadId: ID, body: 'x'.repeat(5001) }).success).toBe(false);
  });

  it('owner is a staff id or null', () => {
    expect(assignOwnerInput.safeParse({ leadId: ID, ownerId: ID }).success).toBe(true);
    expect(assignOwnerInput.safeParse({ leadId: ID, ownerId: null }).success).toBe(true);
    expect(assignOwnerInput.safeParse({ leadId: ID, ownerId: 'me' }).success).toBe(false);
  });
});

describe('updateContact', () => {
  const ok = { leadId: ID, fullName: 'Sarah Weiss', email: 'Sarah.Weiss@Example.com ', phone: '+1 718 555 0142' };
  it('trims and lower-cases the email', () => {
    const parsed = updateContactInput.parse(ok);
    expect(parsed.email).toBe('sarah.weiss@example.com');
    expect(parsed.fullName).toBe('Sarah Weiss');
  });
  it('refuses a short name, a bad email and a phone with fewer than seven digits', () => {
    expect(updateContactInput.safeParse({ ...ok, fullName: 'S' }).success).toBe(false);
    expect(updateContactInput.safeParse({ ...ok, email: 'sarah' }).success).toBe(false);
    expect(updateContactInput.safeParse({ ...ok, phone: '12345' }).success).toBe(false);
  });
  it('lets the phone be empty (checked against the stored lead on the server)', () => {
    expect(updateContactInput.safeParse({ ...ok, phone: '' }).success).toBe(true);
  });
});

describe('inbox', () => {
  it('moves a callback or contact between the three states', () => {
    for (const kind of ['callback', 'contact']) for (const status of ['new', 'in_progress', 'closed']) expect(inboxStatusInput.safeParse({ kind, id: ID, status }).success).toBe(true);
    expect(inboxStatusInput.safeParse({ kind: 'sms', id: ID, status: 'new' }).success).toBe(false);
    expect(inboxStatusInput.safeParse({ kind: 'callback', id: ID, status: 'done' }).success).toBe(false);
  });
});

describe('availability', () => {
  const rule = { weekday: 6, startTime: '03:07', capacity: 2, active: true };
  it('validates weekday, HH:MM and capacity', () => {
    expect(addRuleInput.safeParse(rule).success).toBe(true);
    expect(addRuleInput.safeParse({ ...rule, weekday: 7 }).success).toBe(false);
    expect(addRuleInput.safeParse({ ...rule, weekday: -1 }).success).toBe(false);
    expect(addRuleInput.safeParse({ ...rule, startTime: '3:07' }).success).toBe(false);
    expect(addRuleInput.safeParse({ ...rule, startTime: '24:00' }).success).toBe(false);
    expect(addRuleInput.safeParse({ ...rule, capacity: -1 }).success).toBe(false);
    expect(addRuleInput.safeParse({ ...rule, capacity: 51 }).success).toBe(false);
    expect(addRuleInput.safeParse({ ...rule, capacity: 1.5 }).success).toBe(false);
    expect(addRuleInput.safeParse({ ...rule, capacity: 0 }).success).toBe(true);
  });
  it('an edit also needs the rule id', () => {
    expect(updateRuleInput.safeParse({ id: ID, ...rule }).success).toBe(true);
    expect(updateRuleInput.safeParse(rule).success).toBe(false);
  });
  it('blocks a real calendar day, optionally one time of it', () => {
    expect(addExceptionInput.safeParse({ onDate: '2031-01-05', startTime: null }).success).toBe(true);
    expect(addExceptionInput.safeParse({ onDate: '2031-01-05', startTime: '10:30', reason: 'Holiday' }).success).toBe(true);
    expect(addExceptionInput.safeParse({ onDate: '2031-02-30', startTime: null }).success).toBe(false);
    expect(addExceptionInput.safeParse({ onDate: '05/01/2031', startTime: null }).success).toBe(false);
    expect(addExceptionInput.safeParse({ onDate: '2031-01-05', startTime: '25:00' }).success).toBe(false);
    expect(addExceptionInput.safeParse({ onDate: '2031-01-05', startTime: null, reason: 'x'.repeat(201) }).success).toBe(false);
  });
});

describe('team', () => {
  it('sets a role and the active flag', () => {
    expect(updateStaffInput.safeParse({ userId: ID, role: 'lawyer', active: true }).success).toBe(true);
    expect(updateStaffInput.safeParse({ userId: ID, role: 'owner', active: true }).success).toBe(false);
    expect(updateStaffInput.safeParse({ userId: ID, role: 'admin' }).success).toBe(false);
  });
});
