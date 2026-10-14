import { describe, expect, it } from 'vitest';
import { entryNeedsSession, entryTarget } from './landing-entry';

describe('entryTarget', () => {
  it('sends eligibility, and anything unrecognized, to the firm\'s own site: there is no landing page here any more', () => {
    for (const entry of ['eligibility', 'nope', '', undefined]) {
      expect(entryTarget(entry, false)).toEqual({ kind: 'external', path: '/apply' });
      expect(entryTarget(entry, true)).toEqual({ kind: 'external', path: '/apply' });
    }
  });

  it('sends signin and portal to the portal only when a session exists', () => {
    expect(entryTarget('signin', false)).toEqual({ kind: 'internal', path: '/sign-in' });
    expect(entryTarget('portal', false)).toEqual({ kind: 'internal', path: '/sign-in' });
    expect(entryTarget('signin', true)).toEqual({ kind: 'internal', path: '/portal' });
    expect(entryTarget('portal', true)).toEqual({ kind: 'internal', path: '/portal' });
  });

  it('ignores case and whitespace', () => {
    expect(entryTarget(' SignIn ', false)).toEqual({ kind: 'internal', path: '/sign-in' });
  });
});

describe('entryNeedsSession', () => {
  it('is true only where the destination depends on the session', () => {
    expect(entryNeedsSession('signin')).toBe(true);
    expect(entryNeedsSession('portal')).toBe(true);
    expect(entryNeedsSession('eligibility')).toBe(false);
    expect(entryNeedsSession(undefined)).toBe(false);
  });
});
