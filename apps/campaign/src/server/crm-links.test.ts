import { describe, expect, it } from 'vitest';
import { RESET_NEXT, buildResetUrl } from './crm-links';

describe('buildResetUrl', () => {
  it('points at the app\'s own /auth/callback with the token hash, the recovery type and the set-password screen', () => {
    const url = new URL(buildResetUrl('https://euro-passports.com/auth/callback', 'abc123_-hash'));
    expect(url.origin + url.pathname).toBe('https://euro-passports.com/auth/callback');
    expect(url.searchParams.get('token_hash')).toBe('abc123_-hash');
    expect(url.searchParams.get('type')).toBe('recovery');
    expect(url.searchParams.get('next')).toBe('/create-password?mode=reset');
    expect(RESET_NEXT).toBe('/create-password?mode=reset');
  });

  it('keeps the language prefix of the callback and encodes awkward hashes', () => {
    const raw = buildResetUrl('http://localhost:3001/he/auth/callback', 'a+b/c=d&e');
    expect(raw.startsWith('http://localhost:3001/he/auth/callback?')).toBe(true);
    expect(new URL(raw).searchParams.get('token_hash')).toBe('a+b/c=d&e');
    // the nested query string of `next` must not leak into the outer one
    expect(new URL(raw).searchParams.has('mode')).toBe(false);
  });
});
