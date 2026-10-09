/**
 * Portal API integration tests: the real routes of the running campaign app against the real local Supabase
 * (database, auth and storage). Run with
 *
 *   PORTAL_BASE_URL=http://localhost:3104 pnpm exec playwright test e2e/portal.api.spec.ts
 *
 * Applicants are created with the service-role client (see portal.helpers.ts) and signed in the way the browser is, so
 * every request below carries a real Supabase session cookie. All test data is removed again.
 */
import { expect, request as playwrightRequest, test, type APIRequestContext, type APIResponse } from '@playwright/test';
import type { PortalState } from '../apps/campaign/src/components/portal/model/types';
import {
  adminDb,
  anonClient,
  anonymousApi,
  BASE_URL,
  createApplicant,
  FULL_APPLICATION,
  storedObjects,
  tinyJpeg,
  tinyPdf,
  uploadToStorage,
  type Applicant,
} from './portal.helpers';

const DOC_TYPES = [
  'birth_certificate',
  'marriage_certificates',
  'emigration_naturalization',
  'persecution_proof',
  'passport',
  'family_tree',
  'photo_id',
  'other',
];

const getState = async (api: APIRequestContext): Promise<PortalState> => {
  const res = await api.get('/api/portal/state');
  expect(res.status()).toBe(200);
  return (await res.json()) as PortalState;
};
const errorOf = async (res: APIResponse): Promise<string> => ((await res.json()) as { error: string }).error;
const putApplication = (api: APIRequestContext, data: Record<string, string>, currentSection?: number) =>
  api.put('/api/portal/application', { data: { data, ...(currentSection === undefined ? {} : { currentSection }) } });
const eventsOf = async (leadId: string, type: string) => {
  const { data } = await adminDb().from('events').select('*').eq('lead_id', leadId).eq('type', type);
  return (data ?? []) as Array<{ type: string; channel: string; payload: Record<string, unknown>; dedupe_key: string | null }>;
};
const leadRow = async (leadId: string) => (await adminDb().from('leads').select('*').eq('id', leadId).single()).data as Record<string, unknown>;

test.describe('access', () => {
  test('every route refuses a visitor without a session', async () => {
    const api = await anonymousApi();
    const calls: Array<[string, () => Promise<APIResponse>]> = [
      ['GET state', () => api.get('/api/portal/state')],
      ['PUT application', () => api.put('/api/portal/application', { data: { data: { fullName: 'x' } } })],
      ['POST upload-url', () => api.post('/api/portal/documents/upload-url', { data: { docType: 'passport', fileName: 'a.pdf', mimeType: 'application/pdf', size: 10 } })],
      ['POST confirm', () => api.post('/api/portal/documents/confirm', { data: { docType: 'passport', path: 'x/passport/y-a.pdf' } })],
      ['DELETE document', () => api.delete('/api/portal/documents/passport')],
      ['POST submit', () => api.post('/api/portal/submit')],
      ['POST tour-done', () => api.post('/api/portal/tour-done')],
      ['PATCH details', () => api.patch('/api/portal/details', { data: { phone: '+15551234567' } })],
    ];
    for (const [name, call] of calls) {
      const res = await call();
      expect(res.status(), name).toBe(401);
      expect(await errorOf(res), name).toBe('unauthorized');
    }
    await api.dispose();
  });

  test('a lead cookie alone is not a portal session', async () => {
    // the funnel cookie proves "this browser created the lead", nothing more: the portal reads the Supabase session only
    const api = await anonymousApi();
    const res = await api.get('/api/portal/state', { headers: { cookie: 'dpl_lead=forged.token.value' } });
    expect(res.status()).toBe(401);
    await api.dispose();
  });

  test('writes from another origin are refused', async () => {
    const a = await createApplicant();
    try {
      const res = await a.api.post('/api/portal/tour-done', { headers: { origin: 'https://evil.example' } });
      expect(res.status()).toBe(403);
      expect(await errorOf(res)).toBe('bad_origin');
      // the applicant's own origin is fine
      const ok = await a.api.post('/api/portal/tour-done', { headers: { origin: new URL(res.url()).origin } });
      expect(ok.status()).toBe(200);
    } finally {
      await a.dispose();
    }
  });
});

test.describe('state', () => {
  let a: Applicant;
  test.beforeAll(async () => {
    a = await createApplicant({ route: 'austria' });
  });
  test.afterAll(async () => {
    await a.dispose();
  });

  test('describes a file that has just been opened', async () => {
    const state = await getState(a.api);
    expect(state.lead).toMatchObject({
      caseRef: a.caseRef,
      email: a.email,
      firstName: 'Portal',
      fullName: 'Portal Tester',
      route: 'austria',
      stage: 'account',
      status: 'account_created',
      accountCreated: true,
      passwordSet: false,
      tourDone: false,
      submittedAt: null,
      applicationStartedAt: null,
    });
    expect(state.application).toBeNull();
    expect(state.documents.map((d) => d.docType)).toEqual(DOC_TYPES);
    expect(state.documents.every((d) => d.status === 'missing' && d.fileName === null && d.reviewNote === null)).toBe(true);
    expect(state.booking).toBeNull();
    expect(state.caseHandler).toBeNull();
    expect(state.progress).toMatchObject({ percent: 0, applicationPercent: 0, sectionsDone: 0, sectionsTotal: 5, docsReceived: 0, docsTotal: 8 });
    expect(state.timeline.nodes.map((n) => [n.id, n.state])).toEqual([
      ['eligibility', 'done'],
      ['portal', 'done'],
      ['application', 'current'],
      ['documents', 'next'],
      ['submitted', 'next'],
      ['review', 'next'],
    ]);
    expect(state.timeline.current).toEqual({ kind: 'node', id: 'application' });
  });

  test('shows the booked consultation, the case handler and the whitelisted activity only', async () => {
    const db = adminDb();
    const starts = new Date(Date.now() + 3 * 86_400_000);
    starts.setUTCMinutes(0, 0, 0);
    const { data: booking } = await db
      .from('bookings')
      .insert({ lead_id: a.leadId, starts_at: starts.toISOString(), ends_at: new Date(starts.getTime() + 20 * 60_000).toISOString(), timezone: 'America/New_York' })
      .select('*')
      .single();
    const staffUser = await db.auth.admin.createUser({ email: `staff-e2e+${Date.now()}@example.com`, password: 'Staff-pw-12345', email_confirm: true });
    const staffId = staffUser.data!.user.id;
    await db.from('staff').insert({ user_id: staffId, full_name: 'Dr. E2E Handler', email: `staff-e2e+${Date.now()}@example.com`, role: 'lawyer' });
    await db.from('leads').update({ owner_id: staffId }).eq('id', a.leadId);
    const logged = await db.from('activity_log').insert([
      { lead_id: a.leadId, kind: 'system', code: 'account_created', text: 'Portal account created', meta: {} },
      { lead_id: a.leadId, kind: 'staff', code: 'internal_flag', text: 'Looks like a strong case', actor_name: 'Staff', meta: {} },
      { lead_id: a.leadId, kind: 'staff', code: 'status_changed', text: 'Status: under review', actor_name: 'Staff', meta: { status: 'under_review' } },
      { lead_id: a.leadId, kind: 'staff', code: 'status_changed', text: 'Status: nonsense', actor_name: 'Staff', meta: { status: 'not-a-status' } },
    ]);
    expect(logged.error).toBeNull();
    try {
      const state = await getState(a.api);
      expect(state.booking).toMatchObject({ id: booking?.id, timezone: 'America/New_York' });
      expect(state.timeline.nodes.map((n) => n.id)).toContain('consultation');
      expect(state.caseHandler).toEqual({ name: 'Dr. E2E Handler' });
      const codes = state.activity.map((x) => x.code);
      expect(codes).toContain('account_created');
      expect(codes).toContain('status_changed');
      expect(state.activity.find((x) => x.code === 'status_changed')).toMatchObject({ status: 'under_review' });
      expect(JSON.stringify(state)).not.toContain('Looks like a strong case');
      expect(JSON.stringify(state)).not.toContain('internal_flag');
      expect(state.activity.filter((x) => x.code === 'status_changed')).toHaveLength(1);
    } finally {
      await db.from('leads').update({ owner_id: null }).eq('id', a.leadId);
      await db.from('staff').delete().eq('user_id', staffId);
      await db.auth.admin.deleteUser(staffId);
      await db.from('bookings').delete().eq('lead_id', a.leadId);
    }
  });

  test('never contains storage paths, download links or internal ids', async () => {
    const res = await a.api.get('/api/portal/state');
    const text = await res.text();
    expect(text).not.toContain(a.leadId);
    expect(text).not.toContain(a.userId);
    expect(text).not.toMatch(/file_path|signedUrl|token|supabase|127\.0\.0\.1/i);
    expect(res.headers()['cache-control']).toContain('no-store');
  });
});

test.describe('application', () => {
  let a: Applicant;
  test.beforeAll(async () => {
    a = await createApplicant();
  });
  test.afterAll(async () => {
    await a.dispose();
  });

  test('the first save starts the application: timestamp, stage, status, one event, one activity row', async () => {
    const res = await putApplication(a.api, { fullName: 'Anna Reinhardt' }, 0);
    expect(res.status()).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, sectionsDone: 0, complete: false });

    const lead = await leadRow(a.leadId);
    expect(lead.application_started_at).toBeTruthy();
    expect(lead.stage).toBe('application');
    expect(lead.status).toBe('application_incomplete');

    const events = await eventsOf(a.leadId, 'application.started');
    expect(events).toHaveLength(1);
    expect(events[0]!.channel).toBe('crm');
    expect(events[0]!.dedupe_key).toBe(`application.started:${a.leadId}`);
    expect((events[0]!.payload.lead as { caseRef: string }).caseRef).toBe(a.caseRef);

    const { data: activity } = await adminDb().from('activity_log').select('*').eq('lead_id', a.leadId).eq('code', 'application_started');
    expect(activity).toHaveLength(1);

    // a later save does not start it again
    await putApplication(a.api, { dob: '12/03/1988' }, 0);
    expect(await eventsOf(a.leadId, 'application.started')).toHaveLength(1);
    const startedAt = lead.application_started_at;
    expect((await leadRow(a.leadId)).application_started_at).toBe(startedAt);
  });

  test('saves merge into what is stored, empty text clears a field, and the section is remembered', async () => {
    await putApplication(a.api, { birthPlace: 'Boston, USA', citizenship: 'United States' }, 1);
    let state = await getState(a.api);
    expect(state.application).toMatchObject({
      currentSection: 1,
      sectionsDone: 1,
      complete: false,
      data: { fullName: 'Anna Reinhardt', dob: '12/03/1988', birthPlace: 'Boston, USA', citizenship: 'United States' },
    });
    expect(state.progress.sectionsDone).toBe(1);
    expect(state.progress.applicationPercent).toBe(25);
    expect(state.lead.applicationStartedAt).toBeTruthy();

    // saving only the section keeps every answer
    await a.api.put('/api/portal/application', { data: { data: {}, currentSection: 3 } });
    state = await getState(a.api);
    expect(state.application!.currentSection).toBe(3);
    expect(state.application!.data.fullName).toBe('Anna Reinhardt');

    // clearing a field takes the section back out of the count
    await putApplication(a.api, { citizenship: '' });
    state = await getState(a.api);
    expect(state.application!.data.citizenship).toBe('');
    expect(state.application!.sectionsDone).toBe(0);
    await putApplication(a.api, { citizenship: 'United States' });
    expect((await getState(a.api)).application!.sectionsDone).toBe(1);
  });

  test('optional fields do not block a section; the name-change note does', async () => {
    await putApplication(a.api, { anName: 'Ruth Weiss', anRel: 'grandmother', anDob: '1911', anBirthPlace: 'Vienna', anLeft: '1938' });
    await putApplication(a.api, { line1: '', line2: '' });
    expect((await getState(a.api)).application!.sectionsDone).toBe(2);
    await putApplication(a.api, { nameChanges: 'None' });
    expect((await getState(a.api)).application!.sectionsDone).toBe(3);
  });

  test('rejects what the schema rejects', async () => {
    const bad: Array<[string, unknown]> = [
      ['unknown field', { data: { passwordHash: 'x' } }],
      ['non-string value', { data: { fullName: 42 } }],
      ['too long', { data: { fullName: 'x'.repeat(2001) } }],
      ['section out of range', { data: {}, currentSection: 5 }],
      ['negative section', { data: {}, currentSection: -1 }],
      ['fractional section', { data: {}, currentSection: 1.5 }],
      ['missing data', { currentSection: 1 }],
      ['not an object', 'fullName'],
    ];
    for (const [name, body] of bad) {
      const res = await a.api.put('/api/portal/application', { headers: { 'content-type': 'application/json' }, data: JSON.stringify(body) });
      expect(res.status(), name).toBe(400);
      expect(await errorOf(res), name).toBe('invalid_body');
    }
    const broken = await a.api.put('/api/portal/application', { headers: { 'content-type': 'application/json' }, data: Buffer.from('{"data":') });
    expect(broken.status()).toBe(400);
    expect(await errorOf(broken)).toBe('invalid_json');
    // none of that changed the stored answers
    expect((await getState(a.api)).application!.data).not.toHaveProperty('passwordHash');
  });

  test('saves that arrive at the same time do not overwrite each other', async () => {
    const b = await createApplicant();
    try {
      const fields = ['fullName', 'dob', 'birthPlace', 'citizenship', 'anName', 'anRel'];
      const results = await Promise.all(fields.map((f) => putApplication(b.api, { [f]: FULL_APPLICATION[f]! })));
      expect(results.map((r) => r.status())).toEqual(fields.map(() => 200));
      const data = (await getState(b.api)).application!.data;
      for (const f of fields) expect(data[f], f).toBe(FULL_APPLICATION[f]);
      // and the start of the application was recorded exactly once
      expect(await eventsOf(b.leadId, 'application.started')).toHaveLength(1);
    } finally {
      await b.dispose();
    }
  });
});

test.describe('documents', () => {
  let a: Applicant;
  test.beforeAll(async () => {
    a = await createApplicant();
  });
  test.afterAll(async () => {
    await a.dispose();
  });

  test('upload-url validates the request', async () => {
    const send = (data: Record<string, unknown>) => a.api.post('/api/portal/documents/upload-url', { data });
    const ok = { docType: 'passport', fileName: 'p.pdf', mimeType: 'application/pdf', size: 1000 };
    const cases: Array<[string, Record<string, unknown>]> = [
      ['unknown slot', { ...ok, docType: 'tax_return' }],
      ['wrong type: gif', { ...ok, mimeType: 'image/gif' }],
      ['wrong type: html', { ...ok, mimeType: 'text/html' }],
      ['wrong type: executable', { ...ok, mimeType: 'application/x-msdownload' }],
      ['empty file', { ...ok, size: 0 }],
      ['negative size', { ...ok, size: -5 }],
      ['too big (20 MB + 1)', { ...ok, size: 20 * 1024 * 1024 + 1 }],
      ['no name', { ...ok, fileName: '   ' }],
      ['name too long', { ...ok, fileName: 'a'.repeat(181) }],
      ['size as text', { ...ok, size: '1000' }],
    ];
    for (const [name, body] of cases) {
      const res = await send(body);
      expect(res.status(), name).toBe(400);
      expect(await errorOf(res), name).toBe('invalid_body');
    }
    // exactly 20 MB is allowed
    expect((await send({ ...ok, size: 20 * 1024 * 1024 })).status()).toBe(200);
  });

  test('upload, confirm, replace and remove a document, against the real storage', async () => {
    // 1. the server hands out a path inside this applicant's own folder
    const pdf = tinyPdf('first');
    const up = await uploadToStorage(a.api, 'passport', { name: 'passport scan.pdf', mimeType: 'application/pdf', body: pdf });
    expect(up.path).toMatch(new RegExp(`^${a.leadId}/passport/[0-9a-f-]{36}-passport_scan\\.pdf$`));
    expect(await storedObjects(a.leadId)).toEqual([up.path]);

    // 2. nothing is registered until the server has looked at the object
    expect((await getState(a.api)).documents.find((d) => d.docType === 'passport')!.status).toBe('missing');
    const res = await a.api.post('/api/portal/documents/confirm', { data: { docType: 'passport', path: up.path, fileName: 'passport scan.pdf' } });
    expect(res.status()).toBe(200);
    const body = (await res.json()) as { ok: boolean; document: PortalState['documents'][number]; docsReceived: number };
    expect(body.ok).toBe(true);
    expect(body.docsReceived).toBe(1);
    expect(body.document).toMatchObject({ docType: 'passport', status: 'received', fileName: 'passport scan.pdf', size: pdf.length, mimeType: 'application/pdf' });
    expect(JSON.stringify(body)).not.toContain(up.path);

    let state = await getState(a.api);
    const passport = state.documents.find((d) => d.docType === 'passport')!;
    expect(passport).toMatchObject({ status: 'received', fileName: 'passport scan.pdf', reviewNote: null });
    expect(passport.uploadedAt).toBeTruthy();
    expect(state.progress.docsReceived).toBe(1);
    expect(state.timeline.nodes.find((n) => n.id === 'documents')!.meta).toEqual({ kind: 'uploaded', done: 1, total: 8 });

    // the database row, the outbox and the history
    const { data: row } = await adminDb().from('documents').select('*').eq('lead_id', a.leadId).eq('doc_type', 'passport').single();
    expect(row).toMatchObject({ status: 'received', file_path: up.path, file_name: 'passport scan.pdf', mime_type: 'application/pdf' });
    const events = await eventsOf(a.leadId, 'document.uploaded');
    expect(events).toHaveLength(1);
    expect(events[0]!.payload).toMatchObject({ docType: 'passport', fileName: 'passport scan.pdf', docsReceived: 1, docsTotal: 8 });
    const { data: activity } = await adminDb().from('activity_log').select('*').eq('lead_id', a.leadId).eq('code', 'document_uploaded');
    expect(activity).toHaveLength(1);
    expect(activity?.[0]?.text).toBe('Document uploaded: Your passport');

    // confirming the same upload again is harmless
    expect((await a.api.post('/api/portal/documents/confirm', { data: { docType: 'passport', path: up.path } })).status()).toBe(200);

    // 3. a replacement removes the old file
    const jpg = tinyJpeg();
    const second = await uploadToStorage(a.api, 'passport', { name: 'passport-new.jpg', mimeType: 'image/jpeg', body: jpg });
    expect((await storedObjects(a.leadId)).sort()).toEqual([up.path, second.path].sort());
    const replaced = await a.api.post('/api/portal/documents/confirm', { data: { docType: 'passport', path: second.path, fileName: 'passport-new.jpg' } });
    expect(replaced.status()).toBe(200);
    expect(await storedObjects(a.leadId)).toEqual([second.path]);
    state = await getState(a.api);
    expect(state.documents.find((d) => d.docType === 'passport')).toMatchObject({ fileName: 'passport-new.jpg', mimeType: 'image/jpeg', status: 'received' });
    expect(state.progress.docsReceived).toBe(1);

    // 4. removing the file empties the slot again
    const del = await a.api.delete('/api/portal/documents/passport');
    expect(del.status()).toBe(200);
    expect(await storedObjects(a.leadId)).toEqual([]);
    state = await getState(a.api);
    expect(state.documents.find((d) => d.docType === 'passport')).toMatchObject({ status: 'missing', fileName: null, uploadedAt: null });
    expect(state.progress.docsReceived).toBe(0);
    expect((await a.api.delete('/api/portal/documents/passport')).status()).toBe(200);
  });

  test('keeps the original file name, including Hebrew ones the storage path cannot carry', async () => {
    const up = await uploadToStorage(a.api, 'birth_certificate', { name: 'תעודת לידה.pdf', mimeType: 'application/pdf', body: tinyPdf('he') });
    const res = await a.api.post('/api/portal/documents/confirm', { data: { docType: 'birth_certificate', path: up.path, fileName: 'תעודת לידה.pdf' } });
    expect(res.status()).toBe(200);
    expect((await getState(a.api)).documents.find((d) => d.docType === 'birth_certificate')!.fileName).toBe('תעודת לידה.pdf');
    // a name that tries to spoof its extension is flattened to one plain line
    const up2 = await uploadToStorage(a.api, 'other', { name: 'x.pdf', mimeType: 'application/pdf', body: tinyPdf('x') });
    await a.api.post('/api/portal/documents/confirm', { data: { docType: 'other', path: up2.path, fileName: 'invoice‮gnp.exe\n../../etc/passwd' } });
    const other = (await getState(a.api)).documents.find((d) => d.docType === 'other')!;
    expect(other.fileName).not.toMatch(/[‮\n/\\]/);
    await a.api.delete('/api/portal/documents/birth_certificate');
    await a.api.delete('/api/portal/documents/other');
  });

  test('confirm refuses a missing object, someone else\'s path and a path in the wrong slot', async () => {
    const confirm = (data: Record<string, unknown>) => a.api.post('/api/portal/documents/confirm', { data });
    const ghost = `${a.leadId}/passport/00000000-0000-4000-8000-000000000000-ghost.pdf`;
    const res = await confirm({ docType: 'passport', path: ghost });
    expect(res.status()).toBe(409);
    expect(await errorOf(res)).toBe('upload_missing');

    const other = `11111111-2222-4333-8444-555555555555/passport/00000000-0000-4000-8000-000000000000-x.pdf`;
    expect((await confirm({ docType: 'passport', path: other })).status()).toBe(400);
    expect(await errorOf(await confirm({ docType: 'passport', path: other }))).toBe('invalid_path');

    // a real upload for photo_id cannot be registered as the passport
    const up = await uploadToStorage(a.api, 'photo_id', { name: 'id.jpg', mimeType: 'image/jpeg', body: tinyJpeg() });
    const wrongSlot = await confirm({ docType: 'passport', path: up.path });
    expect(wrongSlot.status()).toBe(400);
    expect(await errorOf(wrongSlot)).toBe('invalid_path');

    for (const bad of ['../x', `${a.leadId}/passport/../photo_id/x.pdf`, `${a.leadId}/passport/00000000-0000-4000-8000-000000000000-a/b.pdf`, '']) {
      const r = await confirm({ docType: 'passport', path: bad });
      expect([400], bad).toContain(r.status());
    }
    await a.api.delete('/api/portal/documents/photo_id');
  });

  test('confirm checks what the file really is, not what the browser said', async () => {
    const html = Buffer.from('<!doctype html><script>alert(1)</script>');
    const up = await uploadToStorage(a.api, 'other', { name: 'letter.pdf', mimeType: 'application/pdf', body: html });
    const res = await a.api.post('/api/portal/documents/confirm', { data: { docType: 'other', path: up.path } });
    expect(res.status()).toBe(400);
    expect(await errorOf(res)).toBe('invalid_file_type');
    expect(await storedObjects(a.leadId)).toEqual([]);
    expect((await getState(a.api)).documents.find((d) => d.docType === 'other')!.status).toBe('missing');

    const exe = Buffer.concat([Buffer.from('MZ'), Buffer.alloc(64)]);
    const up2 = await uploadToStorage(a.api, 'other', { name: 'photo.jpg', mimeType: 'image/jpeg', body: exe });
    expect((await a.api.post('/api/portal/documents/confirm', { data: { docType: 'other', path: up2.path } })).status()).toBe(400);
    expect(await storedObjects(a.leadId)).toEqual([]);
  });

  test('storage itself enforces the type and size limits', async () => {
    // a signed URL for a PDF cannot be used to store a file of another type
    const res = await a.api.post('/api/portal/documents/upload-url', { data: { docType: 'other', fileName: 'x.pdf', mimeType: 'application/pdf', size: 100 } });
    const { path, token } = (await res.json()) as { path: string; token: string };
    const wrongType = await anonClient().storage.from('documents').uploadToSignedUrl(path, token, Buffer.from('GIF89a'), { contentType: 'image/gif' });
    expect(wrongType.error).toBeTruthy();

    // and a file over 20 MB is refused even when the request lies about its size
    const res2 = await a.api.post('/api/portal/documents/upload-url', { data: { docType: 'other', fileName: 'big.pdf', mimeType: 'application/pdf', size: 1000 } });
    const big = (await res2.json()) as { path: string; token: string };
    const tooBig = await anonClient()
      .storage.from('documents')
      .uploadToSignedUrl(big.path, big.token, Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.alloc(20 * 1024 * 1024 + 1024)]), { contentType: 'application/pdf' });
    expect(tooBig.error).toBeTruthy();
    expect(await storedObjects(a.leadId)).toEqual([]);
  });

  test('a signed upload path cannot be used for another path', async () => {
    const res = await a.api.post('/api/portal/documents/upload-url', { data: { docType: 'other', fileName: 'x.pdf', mimeType: 'application/pdf', size: 100 } });
    const { token } = (await res.json()) as { path: string; token: string };
    const elsewhere = `${a.leadId}/passport/00000000-0000-4000-8000-000000000001-sneaky.pdf`;
    const attempt = await anonClient().storage.from('documents').uploadToSignedUrl(elsewhere, token, tinyPdf(), { contentType: 'application/pdf' });
    expect(attempt.error).toBeTruthy();
    expect(await storedObjects(a.leadId)).toEqual([]);
  });

  test('DELETE only knows the eight slots', async () => {
    const res = await a.api.delete('/api/portal/documents/not_a_slot');
    expect(res.status()).toBe(404);
    expect(await errorOf(res)).toBe('not_found');
    expect((await a.api.delete('/api/portal/documents/..%2F..%2Fx')).status()).toBe(404);
  });

  test('a file flagged for replacement shows the team\'s note and goes back to received once replaced', async () => {
    const up = await uploadToStorage(a.api, 'marriage_certificates', { name: 'm.pdf', mimeType: 'application/pdf', body: tinyPdf('m') });
    await a.api.post('/api/portal/documents/confirm', { data: { docType: 'marriage_certificates', path: up.path, fileName: 'm.pdf' } });
    await adminDb().from('documents').update({ status: 'reupload', review_note: 'The scan is cut off at the bottom.' }).eq('lead_id', a.leadId).eq('doc_type', 'marriage_certificates');
    const flagged = (await getState(a.api)).documents.find((d) => d.docType === 'marriage_certificates')!;
    expect(flagged).toMatchObject({ status: 'reupload', reviewNote: 'The scan is cut off at the bottom.', fileName: 'm.pdf' });

    const again = await uploadToStorage(a.api, 'marriage_certificates', { name: 'm2.pdf', mimeType: 'application/pdf', body: tinyPdf('m2') });
    await a.api.post('/api/portal/documents/confirm', { data: { docType: 'marriage_certificates', path: again.path, fileName: 'm2.pdf' } });
    const fixed = (await getState(a.api)).documents.find((d) => d.docType === 'marriage_certificates')!;
    expect(fixed).toMatchObject({ status: 'received', reviewNote: null, fileName: 'm2.pdf' });
    await a.api.delete('/api/portal/documents/marriage_certificates');
  });
});

test.describe('submit', () => {
  test('needs a complete application, then sends it once', async () => {
    const a = await createApplicant({ locale: 'en' });
    try {
      // nothing saved yet
      let res = await a.api.post('/api/portal/submit');
      expect(res.status()).toBe(409);
      expect(await errorOf(res)).toBe('application_incomplete');

      // three of four sections are not enough
      const { email: _e, phone: _p, address: _a, ...threeSections } = FULL_APPLICATION;
      await putApplication(a.api, threeSections);
      res = await a.api.post('/api/portal/submit');
      expect(res.status()).toBe(409);
      expect((await leadRow(a.leadId)).submitted_at).toBeNull();
      expect(await eventsOf(a.leadId, 'application.submitted')).toHaveLength(0);

      // a document is not required
      await putApplication(a.api, { email: _e!, phone: _p!, address: _a! }, 4);
      expect((await getState(a.api)).application).toMatchObject({ complete: true, sectionsDone: 4 });
      res = await a.api.post('/api/portal/submit');
      expect(res.status()).toBe(200);
      const body = (await res.json()) as { ok: boolean; submittedAt: string; alreadySubmitted: boolean };
      expect(body.ok).toBe(true);
      expect(body.alreadySubmitted).toBe(false);
      expect(new Date(body.submittedAt).getTime()).toBeGreaterThan(Date.now() - 60_000);

      // the lead moved on, and everyone who needs to know was told
      const lead = await leadRow(a.leadId);
      expect(lead).toMatchObject({ stage: 'review', status: 'application_submitted' });
      expect(lead.submitted_at).toBeTruthy();
      const submitted = await eventsOf(a.leadId, 'application.submitted');
      expect(submitted).toHaveLength(1);
      expect(submitted[0]!.dedupe_key).toBe(`application.submitted:${a.leadId}`);
      expect(submitted[0]!.payload).toMatchObject({ docsReceived: 0, docsTotal: 8 });
      expect((submitted[0]!.payload.lead as { stage: string }).stage).toBe('review');
      const { data: emails } = await adminDb().from('events').select('*').eq('lead_id', a.leadId).eq('type', 'email.send');
      expect(emails).toHaveLength(1);
      expect(emails?.[0]?.channel).toBe('email');
      expect(emails?.[0]?.payload).toMatchObject({ template: 'application-received', category: 'transactional', to: { email: a.email } });
      const { data: activity } = await adminDb().from('activity_log').select('*').eq('lead_id', a.leadId).eq('code', 'application_submitted');
      expect(activity).toHaveLength(1);
      const { data: app } = await adminDb().from('applications').select('completed_at').eq('lead_id', a.leadId).single();
      expect(app?.completed_at).toBeTruthy();

      // the dashboard follows
      const state = await getState(a.api);
      expect(state.lead.submittedAt).toBe(body.submittedAt);
      expect(state.lead.status).toBe('application_submitted');
      expect(state.timeline.nodes.at(-1)).toMatchObject({ id: 'review', state: 'current', meta: { kind: 'status', status: 'application_submitted' } });
      expect(state.statusSteps.find((s) => s.id === 'research')!.state).toBe('current');

      // sending it again changes and sends nothing
      const again = await a.api.post('/api/portal/submit');
      expect(again.status()).toBe(200);
      expect(await again.json()).toMatchObject({ ok: true, alreadySubmitted: true, submittedAt: body.submittedAt });
      expect(await eventsOf(a.leadId, 'application.submitted')).toHaveLength(1);
      expect((await adminDb().from('events').select('id').eq('lead_id', a.leadId).eq('type', 'email.send')).data).toHaveLength(1);

      // the answers are locked once they are with the firm
      const edit = await putApplication(a.api, { fullName: 'Someone Else' });
      expect(edit.status()).toBe(409);
      expect(await errorOf(edit)).toBe('already_submitted');
      expect((await getState(a.api)).application!.data.fullName).toBe('Portal Tester');
    } finally {
      await a.dispose();
    }
  });

  test('never overwrites a status the team set, and two submits at once send one email', async () => {
    const a = await createApplicant();
    try {
      await putApplication(a.api, FULL_APPLICATION);
      await adminDb().from('leads').update({ status: 'info_required' }).eq('id', a.leadId);
      const results = await Promise.all([a.api.post('/api/portal/submit'), a.api.post('/api/portal/submit'), a.api.post('/api/portal/submit')]);
      expect(results.map((r) => r.status())).toEqual([200, 200, 200]);
      const flags = await Promise.all(results.map(async (r) => ((await r.json()) as { alreadySubmitted: boolean }).alreadySubmitted));
      expect(flags.filter((f) => !f)).toHaveLength(1);
      const lead = await leadRow(a.leadId);
      expect(lead.status).toBe('info_required');
      expect(lead.stage).toBe('review');
      expect(await eventsOf(a.leadId, 'application.submitted')).toHaveLength(1);
      expect(await eventsOf(a.leadId, 'email.send')).toHaveLength(1);
    } finally {
      await a.dispose();
    }
  });

  test('counts the documents that were in at submission', async () => {
    const a = await createApplicant();
    try {
      await putApplication(a.api, FULL_APPLICATION);
      const up = await uploadToStorage(a.api, 'passport', { name: 'p.pdf', mimeType: 'application/pdf', body: tinyPdf() });
      await a.api.post('/api/portal/documents/confirm', { data: { docType: 'passport', path: up.path } });
      await a.api.post('/api/portal/submit');
      const [event] = await eventsOf(a.leadId, 'application.submitted');
      expect(event!.payload).toMatchObject({ docsReceived: 1, docsTotal: 8 });
      // documents can still be added afterwards
      const more = await uploadToStorage(a.api, 'photo_id', { name: 'id.jpg', mimeType: 'image/jpeg', body: tinyJpeg() });
      expect((await a.api.post('/api/portal/documents/confirm', { data: { docType: 'photo_id', path: more.path } })).status()).toBe(200);
      expect((await getState(a.api)).progress.docsReceived).toBe(2);
    } finally {
      await a.dispose();
    }
  });
});

test.describe('tour and details', () => {
  let a: Applicant;
  test.beforeAll(async () => {
    a = await createApplicant({ fullName: 'Portal Tester' });
  });
  test.afterAll(async () => {
    await a.dispose();
  });

  test('tour-done is remembered', async () => {
    expect((await getState(a.api)).lead.tourDone).toBe(false);
    const res = await a.api.post('/api/portal/tour-done');
    expect(res.status()).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect((await getState(a.api)).lead.tourDone).toBe(true);
    expect((await a.api.post('/api/portal/tour-done')).status()).toBe(200);
  });

  test('name and phone can be corrected; the email cannot', async () => {
    const res = await a.api.patch('/api/portal/details', { data: { fullName: 'anna maria reinhardt', phone: '+49 30 5550 0163', email: 'someone.else@example.com' } });
    expect(res.status()).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, lead: { fullName: 'Anna Maria Reinhardt', firstName: 'Anna', phone: '+49 30 5550 0163' } });
    const state = await getState(a.api);
    expect(state.lead).toMatchObject({ fullName: 'Anna Maria Reinhardt', phone: '+49 30 5550 0163', email: a.email });
    const lead = await leadRow(a.leadId);
    expect(lead.email).toBe(a.email);
    const { data: activity } = await adminDb().from('activity_log').select('*').eq('lead_id', a.leadId).eq('code', 'details_updated');
    expect(activity).toHaveLength(1);

    // one field at a time
    expect((await a.api.patch('/api/portal/details', { data: { phone: '0501234567' } })).status()).toBe(200);
    expect((await getState(a.api)).lead).toMatchObject({ fullName: 'Anna Maria Reinhardt', phone: '0501234567' });
  });

  test('applies the prototype rules: two names, seven digits', async () => {
    const bad: Array<[string, Record<string, unknown>]> = [
      ['one name', { fullName: 'Anna' }],
      ['blank name', { fullName: '   ' }],
      ['name too long', { fullName: `Anna ${'x'.repeat(130)}` }],
      ['short phone', { phone: '12345' }],
      ['letters', { phone: 'call me maybe' }],
      ['nothing to change', {}],
    ];
    for (const [name, body] of bad) {
      const res = await a.api.patch('/api/portal/details', { data: body });
      expect(res.status(), name).toBe(400);
      expect(await errorOf(res), name).toBe('invalid_body');
    }
    expect((await getState(a.api)).lead.fullName).toBe('Anna Maria Reinhardt');
  });
});

test.describe('isolation between applicants', () => {
  test('one applicant cannot see, change or confirm another one\'s file', async () => {
    const a = await createApplicant({ fullName: 'Alice Applicant' });
    const b = await createApplicant({ fullName: 'Bob Applicant' });
    try {
      await putApplication(a.api, FULL_APPLICATION, 2);
      const up = await uploadToStorage(a.api, 'passport', { name: 'alice-passport.pdf', mimeType: 'application/pdf', body: tinyPdf('alice') });
      await a.api.post('/api/portal/documents/confirm', { data: { docType: 'passport', path: up.path, fileName: 'alice-passport.pdf' } });

      // Bob sees an empty file of his own
      const stateB = await getState(b.api);
      expect(stateB.lead.caseRef).toBe(b.caseRef);
      expect(stateB.lead.caseRef).not.toBe(a.caseRef);
      expect(stateB.application).toBeNull();
      expect(stateB.documents.every((d) => d.status === 'missing')).toBe(true);
      expect(JSON.stringify(stateB)).not.toContain('alice');
      expect(JSON.stringify(stateB)).not.toContain('Alice');

      // Bob cannot register Alice's object, in any slot
      for (const docType of DOC_TYPES) {
        const res = await b.api.post('/api/portal/documents/confirm', { data: { docType, path: up.path } });
        expect(res.status(), docType).toBe(400);
      }
      // his own upload paths are in his own folder, whatever he asks for
      const mine = await b.api.post('/api/portal/documents/upload-url', { data: { docType: 'passport', fileName: `../${a.leadId}/passport/x.pdf`, mimeType: 'application/pdf', size: 10 } });
      const { path } = (await mine.json()) as { path: string };
      // whatever the name says, it is flattened into one file name inside his own slot folder
      expect(path).toMatch(new RegExp(`^${b.leadId}/passport/[0-9a-f-]{36}-[\\w.-]+$`));
      expect(path.split('/')).toHaveLength(3);
      expect(path).not.toContain('..');

      // deleting a slot only ever touches the caller's own
      expect((await b.api.delete('/api/portal/documents/passport')).status()).toBe(200);
      expect(await storedObjects(a.leadId)).toEqual([up.path]);
      expect((await getState(a.api)).documents.find((d) => d.docType === 'passport')!.status).toBe('received');

      // Bob's saves and submit never reach Alice
      await putApplication(b.api, { fullName: 'Bob Applicant' });
      expect((await getState(a.api)).application!.data.fullName).toBe('Portal Tester');
      expect((await b.api.post('/api/portal/submit')).status()).toBe(409);
      expect((await leadRow(a.leadId)).submitted_at).toBeNull();

      // the session cookie of one is not the other's: no request can name a different lead, there is nothing to name
      for (const url of [`/api/portal/state?leadId=${a.leadId}`, `/api/portal/state?lead=${a.leadId}`]) {
        expect(((await (await b.api.get(url)).json()) as PortalState).lead.caseRef).toBe(b.caseRef);
      }
      const forged = await b.api.put('/api/portal/application', { data: { data: { fullName: 'Mallory Hacker' }, leadId: a.leadId } });
      expect(forged.status()).toBe(200);
      expect((await getState(a.api)).application!.data.fullName).toBe('Portal Tester');
      expect((await getState(b.api)).application!.data.fullName).toBe('Mallory Hacker');
    } finally {
      await a.dispose();
      await b.dispose();
    }
  });

  test('the storage bucket is closed to other applicants and to the public', async () => {
    const a = await createApplicant();
    const b = await createApplicant();
    try {
      const up = await uploadToStorage(a.api, 'passport', { name: 'p.pdf', mimeType: 'application/pdf', body: tinyPdf('secret') });
      await a.api.post('/api/portal/documents/confirm', { data: { docType: 'passport', path: up.path } });
      const base = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object`;
      const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
      // public URL and anonymous read
      expect((await fetch(`${base}/public/documents/${up.path}`)).status).toBeGreaterThanOrEqual(400);
      expect((await fetch(`${base}/documents/${up.path}`, { headers: { apikey: anon, authorization: `Bearer ${anon}` } })).status).toBeGreaterThanOrEqual(400);
      // another applicant's own session cannot list or read it either
      const sb = anonClient();
      const { error: signInError } = await sb.auth.signInWithPassword({ email: b.email, password: b.password });
      expect(signInError).toBeNull();
      const { data: listed } = await sb.storage.from('documents').list(`${a.leadId}/passport`);
      expect(listed ?? []).toEqual([]);
      const { data: blob } = await sb.storage.from('documents').download(up.path);
      expect(blob).toBeNull();
    } finally {
      await a.dispose();
      await b.dispose();
    }
  });
});

test.describe('sign-out', () => {
  test('closes this browser\'s session for good, refuses other origins and is harmless without a session', async () => {
    const a = await createApplicant();
    // a copy of the same session, as if the cookies had been taken from this browser
    const copy = await playwrightRequest.newContext({ baseURL: BASE_URL, storageState: { cookies: a.cookies, origins: [] } });
    try {
      // another site cannot sign a visitor out
      const foreign = await a.api.post('/api/portal/sign-out', { headers: { origin: 'https://evil.example' } });
      expect(foreign.status()).toBe(403);
      expect(await errorOf(foreign)).toBe('bad_origin');
      expect((await a.api.get('/api/portal/state')).status()).toBe(200);

      const res = await a.api.post('/api/portal/sign-out');
      expect(res.status()).toBe(200);
      expect(await res.json()).toEqual({ ok: true });
      // nothing is left in the browser that could open the portal again ...
      const left = (await a.api.storageState()).cookies.map((c) => c.name).filter((n) => n.startsWith('sb-') || n === 'dpl_lead');
      expect(left).toEqual([]);
      expect((await a.api.get('/api/portal/state')).status()).toBe(401);
      // ... and the session itself is closed at the auth server, so a copy of the old cookies is worth nothing either
      expect((await copy.get('/api/portal/state')).status()).toBe(401);

      // signing out again, or without ever having signed in, is fine
      expect((await a.api.post('/api/portal/sign-out')).status()).toBe(200);
      const nobody = await anonymousApi();
      expect((await nobody.post('/api/portal/sign-out')).status()).toBe(200);
      await nobody.dispose();
    } finally {
      await copy.dispose();
      await a.dispose();
    }
  });
});

test.describe('limits', () => {
  test('too many calls in a minute are answered with 429', async () => {
    const a = await createApplicant();
    try {
      // 20 a minute are allowed; the window is aligned to the clock, so keep going a little in case a minute ends meanwhile
      const statuses: number[] = [];
      for (let i = 0; i < 60 && !statuses.includes(429); i++) statuses.push((await a.api.post('/api/portal/tour-done')).status());
      expect(statuses.slice(0, 20).every((s) => s === 200)).toBe(true);
      expect(statuses).toContain(429);
      const limited = await a.api.post('/api/portal/tour-done');
      expect([200, 429]).toContain(limited.status());
      if (limited.status() === 429) expect(await errorOf(limited)).toBe('rate_limited');
      // another applicant is not affected
      const b = await createApplicant();
      try {
        expect((await b.api.post('/api/portal/tour-done')).status()).toBe(200);
      } finally {
        await b.dispose();
      }
    } finally {
      await a.dispose();
    }
  });
});
