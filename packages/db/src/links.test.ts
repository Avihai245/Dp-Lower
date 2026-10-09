import { beforeAll, describe, expect, it } from 'vitest';
import { createPortalLinkToken, createUnsubscribeToken, readPortalLinkToken, readUnsubscribeToken, safeNext } from './links';

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
