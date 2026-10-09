import { describe, expect, it } from 'vitest';
import { passwordState } from './password';

describe('passwordState', () => {
  it('shows the neutral hint until something is wrong', () => {
    expect(passwordState('', '')).toEqual({ ok: false, hint: 'default', error: false });
  });
  it('says "too short" below 8 characters', () => {
    expect(passwordState('abc', '')).toEqual({ ok: false, hint: 'short', error: true });
    expect(passwordState('1234567', '1234567')).toMatchObject({ ok: false, hint: 'short' });
  });
  it('says "mismatch" as soon as the confirmation differs, and that wins over "too short"', () => {
    expect(passwordState('abcdefgh', 'abcdefg')).toEqual({ ok: false, hint: 'mismatch', error: true });
    expect(passwordState('abc', 'abd')).toMatchObject({ hint: 'mismatch' });
  });
  it('is ok at 8 characters or more when both match', () => {
    expect(passwordState('12345678', '12345678')).toEqual({ ok: true, hint: 'default', error: false });
    expect(passwordState('a much longer password', 'a much longer password').ok).toBe(true);
  });
  it('does not enable the button when only the password is filled in', () => {
    expect(passwordState('12345678', '').ok).toBe(false);
  });
});
