import { beforeAll, describe, expect, it } from 'vitest';
import { createEnterToken, createPortalLinkToken, createResumeToken, createUnsubscribeToken, readEnterToken, readPortalLinkToken, readResumeToken, readUnsubscribeToken, safeNext } from './links';

beforeAll(() => {
  process.env.APP_SECRET = 'unit-test-secret-unit-test-secret-1234';
});

describe('safeNext', () => {
  it('keeps same-site relative paths', () => {
    expect(safeNext('/portal/documents?x=1')).toBe('/portal/documents?x=1');
    expect(safeNext('/he/portal')).toBe('/he/portal');
  });
  it('rejects anything that could leave the site', () => {
    for (const bad of ['https://evil.com', '//evil.com', '/\\evil.com', 'javascript:alert(1)', '/javascript:alert(1)', 'portal', '', '/\u0000//evil.com', '/%2F%2Fevil.com/../..' ]) {
      const out = safeNext(bad, '/portal');
      expect(out === '/portal' || out.startsWith('/')).toBe(true);
      expect(out.startsWith('//')).toBe(false);
      expect(out).not.toMatch(/^\/[a-z]+:/i);
    }
    expect(safeNext('https://evil.com')).toBe('/portal');
    expect(safeNext('//evil.com')).toBe('/portal');
    expect(safeNext('/\\evil.com')).toBe('/portal');
    expect(safeNext(null, '/x')).toBe('/x');
  });
});

describe('link tokens', () => {
  const lead = { id: 'lead-1', session_epoch: 3 };
  it('round-trips a portal link token with its epoch and a safe next', async () => {
    const t = await createPortalLinkToken(lead, '/portal/application');
    expect(await readPortalLinkToken(t)).toEqual({ leadId: 'lead-1', epoch: 3, next: '/portal/application' });
  });
  it('downgrades an unsafe next at creation and at read time', async () => {
    const t = await createPortalLinkToken(lead, 'https://evil.com');
    expect((await readPortalLinkToken(t))?.next).toBe('/portal');
  });
  it('does not accept a token for another purpose', async () => {
    const unsub = await createUnsubscribeToken('lead-1');
    expect(await readPortalLinkToken(unsub)).toBeNull();
    const portal = await createPortalLinkToken(lead);
    expect(await readUnsubscribeToken(portal)).toBeNull();
    expect(await readUnsubscribeToken(unsub)).toEqual({ leadId: 'lead-1' });
  });
  it('rejects tampered tokens', async () => {
    const t = await createPortalLinkToken(lead);
    expect(await readPortalLinkToken(t.slice(0, -2) + 'xx')).toBeNull();
  });
});

describe('enter token ("Go to my portal" from the firm\'s own site)', () => {
  const lead = { id: 'lead-1', session_epoch: 3 };
  it('round-trips the lead id and epoch', async () => {
    const t = await createEnterToken(lead);
    expect(await readEnterToken(t)).toEqual({ leadId: 'lead-1', epoch: 3 });
  });
  it('is a distinct purpose from every other token, in both directions', async () => {
    const enter = await createEnterToken(lead);
    const portal = await createPortalLinkToken(lead);
    const unsub = await createUnsubscribeToken('lead-1');
    expect(await readPortalLinkToken(enter)).toBeNull();
    expect(await readUnsubscribeToken(enter)).toBeNull();
    expect(await readEnterToken(portal)).toBeNull();
    expect(await readEnterToken(unsub)).toBeNull();
  });
  it('rejects tampered tokens', async () => {
    const t = await createEnterToken(lead);
    expect(await readEnterToken(t.slice(0, -2) + 'xx')).toBeNull();
  });
});

describe('resume token (portal to the firm\'s funnel)', () => {
  const lead = { id: 'lead-1', session_epoch: 4 };

  it('carries the lead, its epoch and one of the funnel steps', async () => {
    const t = await createResumeToken(lead, '/apply/booking');
    expect(await readResumeToken(t!)).toEqual({ leadId: 'lead-1', epoch: 4, target: '/apply/booking' });
    const home = await createResumeToken(lead, '/portal');
    expect((await readResumeToken(home!))?.target).toBe('/portal');
    const he = await createResumeToken(lead, '/he/apply/offer');
    expect((await readResumeToken(he!))?.target).toBe('/he/apply/offer');
  });

  it('refuses any destination that is not a funnel step, so it can never be an open redirect', async () => {
    for (const bad of ['https://evil.example/apply/booking', '//evil.example', '/apply/booking/../../admin', '/portal/documents', '/portal?x=1', '/admin', '/apply', '/apply/booking?x=1', '/he/he/apply/booking']) {
      expect(await createResumeToken(lead, bad), bad).toBeNull();
    }
  });

  it('is its own purpose: no other token opens it and it opens nothing else', async () => {
    const t = (await createResumeToken(lead, '/apply/booking'))!;
    expect(await readEnterToken(t)).toBeNull();
    expect(await readPortalLinkToken(t)).toBeNull();
    expect(await readUnsubscribeToken(t)).toBeNull();
    expect(await readResumeToken(await createEnterToken(lead))).toBeNull();
    expect(await readResumeToken(await createPortalLinkToken(lead, '/booking'))).toBeNull();
    expect(await readResumeToken('garbage')).toBeNull();
  });
});
