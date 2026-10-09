import { describe, expect, it } from 'vitest';
import { isNearForm, isPastHero, NEAR_FORM_RATIO, STICKY_SCROLL_THRESHOLD, stickyVisible } from './sticky';

const base = { scrollY: 1000, viewportHeight: 900, formTop: 4000, chatOpen: false };

describe('sticky call button', () => {
  it('uses the thresholds of the design (620px, 92% of the viewport)', () => {
    expect(STICKY_SCROLL_THRESHOLD).toBe(620);
    expect(NEAR_FORM_RATIO).toBe(0.92);
  });

  it('stays hidden until the visitor is past the hero', () => {
    expect(isPastHero(0)).toBe(false);
    expect(isPastHero(620)).toBe(false);
    expect(isPastHero(621)).toBe(true);
    expect(stickyVisible({ ...base, scrollY: 620 })).toBe(false);
    expect(stickyVisible({ ...base, scrollY: 621 })).toBe(true);
  });

  it('steps aside when the lead form is within reach', () => {
    // 900 * 0.92 = 828: the form counts as near once its top is above that line
    expect(isNearForm(828, 900)).toBe(false);
    expect(isNearForm(827, 900)).toBe(true);
    expect(isNearForm(-300, 900)).toBe(true);
    expect(stickyVisible({ ...base, formTop: 827 })).toBe(false);
    expect(stickyVisible({ ...base, formTop: 829 })).toBe(true);
  });

  it('is never "near" a form the page does not have (contact page)', () => {
    expect(isNearForm(null, 900)).toBe(false);
    expect(stickyVisible({ ...base, formTop: null })).toBe(true);
  });

  it('hides while the chat is open', () => {
    expect(stickyVisible({ ...base, chatOpen: true })).toBe(false);
  });

  it('follows the viewport height', () => {
    expect(isNearForm(700, 700)).toBe(false);
    expect(isNearForm(643, 700)).toBe(true);
  });
});
