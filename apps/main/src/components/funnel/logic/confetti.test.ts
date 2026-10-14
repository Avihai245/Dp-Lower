import { describe, expect, it } from 'vitest';
import { confettiStyles } from './confetti';

describe('confettiStyles', () => {
  const pieces = confettiStyles();

  it('is the prototype\'s shower of 46 pieces', () => {
    expect(pieces).toHaveLength(46);
  });
  it('is the same shower every time', () => {
    expect(confettiStyles()).toEqual(pieces);
  });
  it('uses the confettiFall keyframes with a per-piece drift, rotation, duration and delay', () => {
    for (const css of pieces) {
      expect(css).toMatch(/animation: confettiFall [\d.]+s cubic-bezier\(0\.25,0\.6,0\.4,1\) [\d.]+s forwards/);
      expect(css).toMatch(/--dx: -?\d+px/);
      expect(css).toMatch(/--rot: \d+deg/);
      expect(css).toMatch(/left: \d+(\.\d+)?%/);
      expect(css).toContain('position: absolute');
    }
  });
  it('only uses the brand colours, in round and slim pieces', () => {
    const colours = new Set(pieces.map((c) => /background: (#[0-9a-f]{6})/.exec(c)?.[1]));
    for (const c of colours) expect(['#a07a3c', '#14202b', '#c9a86a', '#5980a6', '#d8c8a8']).toContain(c);
    expect(pieces.some((c) => c.includes('border-radius: 50%'))).toBe(true);
    expect(pieces.some((c) => c.includes('border-radius: 1px'))).toBe(true);
  });
  it('keeps every piece physical in right-to-left pages (noflip)', () => {
    expect(pieces.every((c) => c.includes('noflip'))).toBe(true);
  });
});
