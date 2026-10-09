import { describe, expect, it } from 'vitest';
import { applicationDataSchema, isApplicationComplete, sectionDone, sectionsDone } from './application';
import { documentPath } from './documents';
import { capitalizeName, firstNameOf, isEmail, isPhone } from './format';
import { evaluateEligibility, firstUnansweredIndex, isQuizComplete, quizAnswersSchema } from './quiz';
import { bookingInputSchema, callbackInputSchema, contactSubmissionSchema, leadInputSchema, uploadRequestSchema } from './schemas';
import { advanceStage, advanceStatus, needsAttention, nextAction, waitingOn } from './statuses';
import { hmacSha256Hex, signToken, verifyToken } from './token';

describe('format', () => {
  it('capitalises names the way the prototype does', () => {
    expect(capitalizeName('anna reinhardt')).toBe('Anna Reinhardt');
    expect(capitalizeName("  o'neil-smith ")).toBe("O'Neil-Smith");
    expect(capitalizeName('דוד כהן')).toBe('דוד כהן');
    expect(firstNameOf('jason miller')).toBe('Jason');
  });
  it('validates email and phone like the prototype (7+ digits)', () => {
    expect(isEmail('a@b.co')).toBe(true);
    expect(isEmail('nope')).toBe(false);
    expect(isPhone('+1 718 555 0142')).toBe(true);
    expect(isPhone('12 34')).toBe(false);
  });
});

describe('quiz', () => {
  it('derives the personalised offer inputs', () => {
    expect(evaluateEligibility({ country: 'austria', relative: 'grandparent' })).toEqual({
      route: 'austria', routeKnown: true, archives: 'austrian', relative: 'grandparent',
    });
    expect(evaluateEligibility({ country: 'unsure', relative: 'further' })).toMatchObject({ routeKnown: false, archives: 'both', relative: null });
    expect(evaluateEligibility({ country: 'both' })).toMatchObject({ archives: 'both' });
    expect(evaluateEligibility({})).toMatchObject({ route: 'unsure', routeKnown: false });
  });
  it('tracks progress for the chat to resume', () => {
    expect(firstUnansweredIndex({})).toBe(0);
    expect(firstUnansweredIndex({ country: 'germany', relative: 'parent' })).toBe(2);
    expect(isQuizComplete({ country: 'germany', relative: 'parent', when: 'after_1945', persecution: 'no', records: 'none', residence: 'il' })).toBe(true);
  });
  it('rejects unknown answers', () => {
    expect(quizAnswersSchema.safeParse({ country: 'france' }).success).toBe(false);
    expect(quizAnswersSchema.safeParse({ extra: 'x' }).success).toBe(false);
    expect(quizAnswersSchema.safeParse({ country: 'germany' }).success).toBe(true);
  });
});

describe('statuses', () => {
  it('only moves a case forward automatically', () => {
    expect(advanceStage('lead', 'account_created')).toBe('account');
    expect(advanceStage('review', 'account_created')).toBe('review');
    expect(advanceStage('account', 'application_submitted')).toBe('review');
    expect(advanceStage('filed', 'application_submitted')).toBe('filed');
  });
  it('never overwrites a status the team set', () => {
    expect(advanceStatus('enquiry', 'account_created')).toBe('account_created');
    expect(advanceStatus('under_review', 'application_submitted')).toBe('under_review');
    expect(advanceStatus('application_submitted', 'account_created')).toBe('application_submitted');
  });
  it('derives the CRM next action and waiting state', () => {
    expect(nextAction('application', 3)).toBe('send_document_reminder');
    expect(nextAction('application', 0)).toBe('move_to_review');
    expect(nextAction('granted', 0)).toBe('send_closing_email');
    expect(waitingOn({ stage: 'application', status: 'application_incomplete', missingDocs: 2, applicationComplete: false })).toBe('documents');
    expect(waitingOn({ stage: 'review', status: 'info_required', missingDocs: 0, applicationComplete: true })).toBe('applicant');
  });
  it('flags stale or blocked cases', () => {
    const now = new Date('2026-10-20T00:00:00Z');
    const mk = (o: object) => ({ stage: 'review' as const, status: 'under_review' as const, stageSince: new Date('2026-10-18T00:00:00Z'), now, hasRejectedDoc: false, ...o });
    expect(needsAttention(mk({}))).toBe(false);
    expect(needsAttention(mk({ stageSince: new Date('2026-10-10T00:00:00Z') }))).toBe(true);
    expect(needsAttention(mk({ hasRejectedDoc: true }))).toBe(true);
    expect(needsAttention(mk({ stage: 'granted', hasRejectedDoc: true }))).toBe(false);
  });
});

describe('application', () => {
  it('counts a section done when its required fields are filled', () => {
    const d = { fullName: 'A', dob: '1', birthPlace: 'x', citizenship: 'US', nameChanges: 'None' };
    expect(sectionDone(d, 0)).toBe(true);
    expect(sectionDone(d, 1)).toBe(false);
    expect(sectionDone(d, 2)).toBe(true); // line1/line2 optional
    expect(sectionsDone(d)).toBe(2);
    expect(isApplicationComplete(d)).toBe(false);
  });
  it('only accepts known fields', () => {
    expect(applicationDataSchema.safeParse({ fullName: 'x' }).success).toBe(true);
    expect(applicationDataSchema.safeParse({ hack: 'x' }).success).toBe(false);
  });
});

describe('schemas', () => {
  it('normalises and validates a lead', () => {
    const r = leadInputSchema.parse({ fullName: ' Ana Weiss ', email: ' ANA@Example.COM ', phone: '+1 718 555 0142', answers: { country: 'germany' } });
    expect(r.email).toBe('ana@example.com');
    expect(r.fullName).toBe('Ana Weiss');
    expect(r.locale).toBe('en');
    expect(leadInputSchema.safeParse({ fullName: 'A', email: 'x@y.zz', phone: '5551234567' }).success).toBe(false);
    expect(leadInputSchema.safeParse({ fullName: 'Ana', email: 'bad', phone: '5551234567' }).success).toBe(false);
    expect(leadInputSchema.safeParse({ fullName: 'Ana', email: 'x@y.zz', phone: '123' }).success).toBe(false);
  });
  it('requires consent and rejects honeypot fills on contact forms', () => {
    const ok = { kind: 'contact', name: 'Ana', email: 'a@b.co', phone: '5551234567', consent: true };
    expect(contactSubmissionSchema.safeParse(ok).success).toBe(true);
    expect(contactSubmissionSchema.safeParse({ ...ok, consent: false }).success).toBe(false);
    expect(contactSubmissionSchema.safeParse({ ...ok, website: 'http://spam' }).success).toBe(false);
    expect(contactSubmissionSchema.safeParse({ kind: 'chat', name: 'Ana', phone: '5551234567', consent: true, email: '' }).success).toBe(true);
  });
  it('validates bookings, callbacks and uploads', () => {
    expect(bookingInputSchema.safeParse({ startsAt: '2026-10-11T06:00:00.000Z', timezone: 'America/New_York' }).success).toBe(true);
    expect(bookingInputSchema.safeParse({ startsAt: 'tomorrow', timezone: 'America/New_York' }).success).toBe(false);
    expect(bookingInputSchema.safeParse({ startsAt: '2026-10-11T06:00:00.000Z', timezone: 'Nowhere/Land' }).success).toBe(false);
    expect(callbackInputSchema.safeParse({ phone: '+972501234567' }).success).toBe(true);
    expect(callbackInputSchema.safeParse({ phone: '12' }).success).toBe(false);
    const up = { docType: 'passport', fileName: 'p.pdf', mimeType: 'application/pdf', size: 1000 };
    expect(uploadRequestSchema.safeParse(up).success).toBe(true);
    expect(uploadRequestSchema.safeParse({ ...up, size: 21 * 1024 * 1024 }).success).toBe(false);
    expect(uploadRequestSchema.safeParse({ ...up, mimeType: 'application/x-msdownload' }).success).toBe(false);
  });
  it('builds safe storage paths', () => {
    expect(documentPath('lead-1', 'passport', 'u1', '../../etc/pass wd.pdf')).toBe('lead-1/passport/u1-etc_pass_wd.pdf');
  });
});

describe('signed tokens', () => {
  const secret = 'test-secret-test-secret-test-secret';
  it('round-trips a payload', async () => {
    const t = await signToken({ p: 'lead', lid: 'abc' }, secret, 60);
    expect(await verifyToken<{ lid: string }>(t, secret, 'lead')).toMatchObject({ lid: 'abc', p: 'lead' });
  });
  it('rejects tampering, a wrong secret and expiry', async () => {
    const t = await signToken({ p: 'lead', lid: 'abc' }, secret, 60);
    const [data, sig] = t.split('.');
    expect(await verifyToken(`${data}x.${sig}`, secret, 'lead')).toBeNull();
    expect(await verifyToken(t, 'another-secret-another-secret-1234', 'lead')).toBeNull();
    expect(await verifyToken(await signToken({ p: 'lead', lid: 'abc' }, secret, -5), secret, 'lead')).toBeNull();
    expect(await verifyToken('garbage', secret, 'lead')).toBeNull();
    expect(await verifyToken(undefined, secret, 'lead')).toBeNull();
  });
  it('is only accepted for the purpose it was signed for', async () => {
    const unsub = await signToken({ p: 'unsub', lid: 'abc' }, secret);
    const portal = await signToken({ p: 'portal', lid: 'abc', ep: 0 }, secret, 60);
    const lead = await signToken({ p: 'lead', lid: 'abc', ep: 0 }, secret, 60);
    expect(await verifyToken(unsub, secret, 'unsub')).not.toBeNull();
    for (const [token, wrongFor] of [[unsub, ['lead', 'portal']], [portal, ['lead', 'unsub']], [lead, ['portal', 'unsub']]] as const) {
      for (const purpose of wrongFor) expect(await verifyToken(token, secret, purpose), `${purpose}`).toBeNull();
    }
    // a payload that names no purpose at all (an old or hand-made token) is accepted for none
    const bare = await (async () => {
      const data = btoa(JSON.stringify({ lid: 'abc', ep: 0 })).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
      const sig = await hmacSha256Hex(secret, data);
      return `${data}.${sig}`;
    })();
    expect(await verifyToken(bare, secret, 'lead')).toBeNull();
  });
  it('produces a stable HMAC for webhook signatures', async () => {
    const a = await hmacSha256Hex('k', 'm');
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(await hmacSha256Hex('k', 'm')).toBe(a);
    expect(await hmacSha256Hex('k', 'n')).not.toBe(a);
  });
});
