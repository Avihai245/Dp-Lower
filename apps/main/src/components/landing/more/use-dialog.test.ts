import { describe, expect, it } from 'vitest';
import { trapTarget } from './use-dialog';

describe('trapTarget', () => {
  it('lets the browser move inside the dialog', () => {
    expect(trapTarget(4, 1, false)).toBeNull();
    expect(trapTarget(4, 2, true)).toBeNull();
  });
  it('wraps Tab from the last tab stop to the first', () => {
    expect(trapTarget(4, 3, false)).toBe(0);
  });
  it('wraps Shift+Tab from the first tab stop to the last', () => {
    expect(trapTarget(4, 0, true)).toBe(3);
  });
  it('pulls focus back in when it is outside the dialog', () => {
    expect(trapTarget(4, -1, false)).toBe(0);
    expect(trapTarget(4, -1, true)).toBe(3);
  });
  it('does nothing without tab stops (the caller focuses the container)', () => {
    expect(trapTarget(0, -1, false)).toBeNull();
  });
  it('a single tab stop keeps focus on itself', () => {
    expect(trapTarget(1, 0, false)).toBe(0);
    expect(trapTarget(1, 0, true)).toBe(0);
  });
});
