import { describe, expect, it } from 'vitest';
import { entryNeedsSession, entryTarget, firstParam, toSearchParams } from './landing-entry';

describe('entryTarget', () => {
  it('sends eligibility to the quiz regardless of the session', () => {
    expect(entryTarget('eligibility', false)).toBe('/eligibility');
    expect(entryTarget('eligibility', true)).toBe('/eligibility');
  });

  it('sends signin and portal to the portal only when a session exists', () => {
    expect(entryTarget('signin', false)).toBe('/sign-in');
    expect(entryTarget('portal', false)).toBe('/sign-in');
    expect(entryTarget('signin', true)).toBe('/portal');
    expect(entryTarget('portal', true)).toBe('/portal');
  });

  it('ignores case and whitespace, and returns null for anything else', () => {
    expect(entryTarget(' SignIn ', false)).toBe('/sign-in');
    expect(entryTarget('nope', true)).toBeNull();
    expect(entryTarget('', true)).toBeNull();
    expect(entryTarget(undefined, true)).toBeNull();
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

describe('query helpers', () => {
  it('firstParam takes the first of repeated values', () => {
    expect(firstParam('a')).toBe('a');
    expect(firstParam(['a', 'b'])).toBe('a');
    expect(firstParam(undefined)).toBeUndefined();
  });

  it('toSearchParams keeps every value', () => {
    const q = toSearchParams({ source: 'x', utm_term: ['a', 'b'], missing: undefined });
    expect(q.get('source')).toBe('x');
    expect(q.getAll('utm_term')).toEqual(['a', 'b']);
    expect(q.has('missing')).toBe(false);
  });
});
