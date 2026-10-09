import { DOC_TYPES } from '@dpl/core';
import type { LeadRow } from '@dpl/db/types';
import { describe, expect, it } from 'vitest';
import { toPortalActivity } from './activity';
import { ACTIVITY_LIMIT, buildPortalState, cleanApplicationData, type PortalRows } from './state';

const lead = {
  id: '11111111-1111-4111-8111-111111111111',
  case_ref: 'DPL-26-1042',
  user_id: 'u1',
  full_name: 'Anna Reinhardt',
  email: 'anna@example.com',
  phone: '+4930555',
  locale: 'en',
  route: 'austria',
  answers: {},
  source: 'campaign-ger-aus',
  utm: {},
  stage: 'account',
  stage_since: '2026-10-01T00:00:00Z',
  status: 'account_created',
  owner_id: null,
  consented_at: null,
  email_verified_at: null,
  account_created_at: '2026-10-01T00:00:00Z',
  password_set_at: null,
  application_started_at: null,
  submitted_at: null,
  unsubscribed_at: null,
  result_emailed_at: null,
  tour_done: false,
  next_action_done_at: null,
  created_at: '2026-10-01T00:00:00Z',
  updated_at: '2026-10-01T00:00:00Z',
  session_epoch: 0,
} satisfies LeadRow;

const rows = (over: Partial<PortalRows> = {}): PortalRows => ({
  lead,
  application: null,
  documents: [],
  booking: null,
  ownerName: null,
  activity: [],
  ...over,
});

const fullData = {
  fullName: 'Anna Reinhardt',
  dob: '12/03/1988',
  birthPlace: 'Boston',
  citizenship: 'US',
  anName: 'Ruth Weiss',
  anRel: 'grandmother',
  anDob: '1911',
  anBirthPlace: 'Vienna',
  anLeft: '1938',
  nameChanges: 'None',
  email: 'anna@example.com',
  phone: '+4930555',
  address: 'Berlin',
};

describe('buildPortalState', () => {
  it('describes a lead that has just arrived in the portal', () => {
    const s = buildPortalState(rows());
    expect(s.lead).toMatchObject({
      caseRef: 'DPL-26-1042',
      firstName: 'Anna',
      accountCreated: true,
      passwordSet: false,
      emailVerified: false,
      tourDone: false,
      submittedAt: null,
    });
    expect(s.application).toBeNull();
    expect(s.documents).toHaveLength(8);
    expect(s.documents.map((d) => d.docType)).toEqual([...DOC_TYPES]);
    expect(s.documents.every((d) => d.status === 'missing' && d.fileName === null)).toBe(true);
    expect(s.progress).toEqual({
      percent: 0,
      applicationPercent: 0,
      sectionsDone: 0,
      sectionsTotal: 5,
      docsReceived: 0,
      docsTotal: 8,
    });
    expect(s.timeline.nodes.map((n) => n.id)).toEqual(['eligibility', 'portal', 'application', 'documents', 'submitted', 'review']);
    expect(s.caseHandler).toBeNull();
    expect(s.activity).toEqual([]);
  });

  it('never exposes storage paths, ids of other records or the lead id', () => {
    const s = buildPortalState(
      rows({
        documents: [
          { doc_type: 'passport', status: 'received', file_name: 'p.pdf', uploaded_at: '2026-10-02T00:00:00Z', review_note: null, file_size: 10, mime_type: 'application/pdf' },
        ],
      }),
    );
    const json = JSON.stringify(s);
    expect(json).not.toContain(lead.id);
    expect(json).not.toContain('file_path');
    expect(json).not.toContain('user_id');
  });

  it('counts sections, completeness and received documents', () => {
    const s = buildPortalState(
      rows({
        application: { data: fullData, current_section: 4, completed_at: '2026-10-03T00:00:00Z' },
        documents: [
          { doc_type: 'passport', status: 'received', file_name: 'p.pdf', uploaded_at: '2026-10-02T00:00:00Z', review_note: null, file_size: 10, mime_type: 'application/pdf' },
          { doc_type: 'photo_id', status: 'received', file_name: 'id.jpg', uploaded_at: '2026-10-04T00:00:00Z', review_note: null, file_size: 10, mime_type: 'image/jpeg' },
          { doc_type: 'marriage_certificates', status: 'reupload', file_name: 'm.heic', uploaded_at: '2026-10-02T00:00:00Z', review_note: 'Cut off', file_size: 10, mime_type: 'image/heic' },
        ],
      }),
    );
    expect(s.application).toMatchObject({ sectionsDone: 4, complete: true, currentSection: 4 });
    expect(s.progress.docsReceived).toBe(2);
    expect(s.progress.percent).toBe(Math.round((0.7 + (2 / 8) * 0.3) * 100));
    const marriage = s.documents.find((d) => d.docType === 'marriage_certificates')!;
    expect(marriage).toMatchObject({ status: 'reupload', reviewNote: 'Cut off', fileName: 'm.heic' });
    expect(s.timeline.nodes.find((n) => n.id === 'application')!.state).toBe('done');
    expect(s.timeline.nodes.find((n) => n.id === 'documents')!.state).toBe('current');
  });

  it('ignores unknown keys and non-string values in the stored application data', () => {
    expect(cleanApplicationData({ fullName: 'A', nope: 'x', dob: 5, address: null })).toEqual({ fullName: 'A' });
    expect(cleanApplicationData(null)).toEqual({});
    expect(cleanApplicationData([1, 2])).toEqual({});
  });

  it('describes a submitted case with the handler, booking and status steps', () => {
    const s = buildPortalState(
      rows({
        lead: { ...lead, stage: 'review', status: 'under_review', submitted_at: '2026-10-08T09:00:00Z', password_set_at: '2026-10-02T00:00:00Z' },
        application: { data: fullData, current_section: 4, completed_at: '2026-10-08T09:00:00Z' },
        booking: { id: 'b1', starts_at: '2026-10-05T09:00:00Z', ends_at: '2026-10-05T09:20:00Z', timezone: 'Asia/Jerusalem' },
        ownerName: 'Anna Reinhardt, Adv.',
      }),
    );
    expect(s.lead.passwordSet).toBe(true);
    expect(s.caseHandler).toEqual({ name: 'Anna Reinhardt, Adv.' });
    expect(s.booking).toEqual({ id: 'b1', startsAt: '2026-10-05T09:00:00Z', endsAt: '2026-10-05T09:20:00Z', timezone: 'Asia/Jerusalem' });
    expect(s.timeline.current).toEqual({ kind: 'status', status: 'under_review' });
    expect(s.statusSteps.find((x) => x.id === 'research')!.state).toBe('current');
  });

  it('keeps only applicant-visible activity, newest first, capped', () => {
    const many = Array.from({ length: 12 }, (_, i) => ({
      id: `a${i}`,
      code: 'document_uploaded',
      created_at: `2026-10-0${(i % 9) + 1}T00:00:00Z`,
      meta: { docType: 'passport' },
    }));
    const s = buildPortalState(
      rows({
        activity: [
          { id: 'x', code: 'internal_note', created_at: '2026-10-09T00:00:00Z', meta: {} },
          { id: 'y', code: null, created_at: '2026-10-09T00:00:00Z', meta: {} },
          ...many,
        ],
      }),
    );
    expect(s.activity).toHaveLength(ACTIVITY_LIMIT);
    expect(s.activity.every((a) => a.code === 'document_uploaded')).toBe(true);
  });
});

describe('toPortalActivity', () => {
  it('reads the status of a status change, accepting meta.status or meta.to', () => {
    expect(toPortalActivity({ id: '1', code: 'status_changed', created_at: 't', meta: { status: 'under_review' } })).toMatchObject({
      code: 'status_changed',
      status: 'under_review',
    });
    expect(toPortalActivity({ id: '1', code: 'status_changed', created_at: 't', meta: { to: 'info_required' } })).toMatchObject({
      status: 'info_required',
    });
  });

  it('drops a status change without a valid status', () => {
    expect(toPortalActivity({ id: '1', code: 'status_changed', created_at: 't', meta: { status: 'bogus' } })).toBeNull();
    expect(toPortalActivity({ id: '1', code: 'status_changed', created_at: 't', meta: null })).toBeNull();
  });

  it('keeps the slot of an upload only when it is a real slot', () => {
    expect(toPortalActivity({ id: '1', code: 'document_uploaded', created_at: 't', meta: { docType: 'passport' } })).toMatchObject({
      docType: 'passport',
    });
    expect(toPortalActivity({ id: '1', code: 'document_uploaded', created_at: 't', meta: { docType: '../x' } })).not.toHaveProperty('docType');
  });

  it('hides everything that is not whitelisted', () => {
    for (const code of ['note_added', 'lead_created', 'email_verified', 'details_updated', 'staff_assigned', '']) {
      expect(toPortalActivity({ id: '1', code, created_at: 't', meta: {} })).toBeNull();
    }
  });
});
