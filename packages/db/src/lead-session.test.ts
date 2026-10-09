import { signToken } from '@dpl/core';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPortalLinkToken, createUnsubscribeToken } from './links';

/** The cookie jar of the request under test. */
const jar = new Map<string, string>();
vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => (jar.has(name) ? { name, value: jar.get(name)! } : undefined),
    set: (name: string, value: string) => void jar.set(name, value),
  }),
}));

const SECRET = 'unit-test-secret-unit-test-secret-1234';
beforeAll(() => {
  process.env.APP_SECRET = SECRET;
});
beforeEach(() => jar.clear());

const { LEAD_COOKIE, readLeadSession, setLeadCookie } = await import('./lead-session');

describe('the lead cookie', () => {
  it('is read back after it was set, with its lead and epoch', async () => {
    await setLeadCookie({ id: 'lead-1', session_epoch: 4 });
    expect(await readLeadSession()).toEqual({ leadId: 'lead-1', epoch: 4 });
  });

  it('is not forged by any other signed token that names the same lead', async () => {
    const forged = [
      // the unsubscribe token sits in every nurture email and never expires
      await createUnsubscribeToken('lead-1'),
      // the emailed portal link
      await createPortalLinkToken({ id: 'lead-1', session_epoch: 0 }),
      // a bare token without a purpose, and one with the right purpose but no epoch
      await signToken({ lid: 'lead-1', ep: 0 } as never, SECRET, 3600),
      await signToken({ p: 'lead', lid: 'lead-1' }, SECRET, 3600),
    ];
    for (const token of forged) {
      jar.set(LEAD_COOKIE, token);
      expect(await readLeadSession()).toBeNull();
    }
  });

  it('is not accepted when it is signed with another secret or is garbage', async () => {
    jar.set(LEAD_COOKIE, await signToken({ p: 'lead', lid: 'lead-1', ep: 0 }, 'another-secret-another-secret-123456', 3600));
    expect(await readLeadSession()).toBeNull();
    jar.set(LEAD_COOKIE, 'forged.token.value');
    expect(await readLeadSession()).toBeNull();
  });
});
