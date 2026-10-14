import { describe, expect, it } from 'vitest';
import { entryNeedsSession, entryTarget } from './landing-entry';

describe('entryTarget', () => {
  it('sends eligibility, and anything else unrecognized and non-empty, to the firm\'s own site: there is no landing page here any more', () => {
    for (const entry of ['eligibility', 'nope']) {
      expect(entryTarget(entry, false)).toEqual({ kind: 'external', path: '/apply' });
      expect(entryTarget(entry, true)).toEqual({ kind: 'external', path: '/apply' });
    }
  });

  it('a bare visit (no entry at all, or an empty one) shows the portal itself, same as an explicit signin/portal entry, only when a session exists', () => {
    for (const entry of ['', undefined, 'signin', 'portal']) {
      expect(entryTarget(entry, false)).toEqual({ kind: 'internal', path: '/sign-in' });
      expect(entryTarget(entry, true)).toEqual({ kind: 'internal', path: '/portal' });
    }
  });

  it('ignores case and whitespace', () => {
    expect(entryTarget(' SignIn ', false)).toEqual({ kind: 'internal', path: '/sign-in' });
  });
});

describe('entryNeedsSession', () => {
  it('is true wherever the destination depends on the session: signin, portal, and a bare visit', () => {
    expect(entryNeedsSession('signin')).toBe(true);
    expect(entryNeedsSession('portal')).toBe(true);
    expect(entryNeedsSession(undefined)).toBe(true);
    expect(entryNeedsSession('')).toBe(true);
    expect(entryNeedsSession('eligibility')).toBe(false);
  });
});
