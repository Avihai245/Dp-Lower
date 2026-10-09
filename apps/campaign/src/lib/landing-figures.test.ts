import { describe, expect, it } from 'vitest';
import { FIGURES, figureValue } from './landing-figures';

describe('figureValue', () => {
  const [families, years, approval, countries] = FIGURES;

  it('starts at zero and ends at the designed values', () => {
    expect(figureValue(families!, 0, 'en')).toBe('0+');
    expect(figureValue(families!, 1, 'en')).toBe('1,200+');
    expect(figureValue(years!, 1, 'en')).toBe('15+');
    expect(figureValue(approval!, 1, 'en')).toBe('94%');
    expect(figureValue(countries!, 1, 'he')).toBe('30+');
  });

  it('rounds the in-between values like the prototype', () => {
    expect(figureValue(families!, 0.5, 'en')).toBe('600+');
    expect(figureValue(approval!, 0.333, 'en')).toBe('31%');
  });

  it('clamps out-of-range and non-finite progress', () => {
    expect(figureValue(families!, 1.7, 'en')).toBe('1,200+');
    expect(figureValue(families!, -1, 'en')).toBe('0+');
    expect(figureValue(families!, Number.NaN, 'en')).toBe('0+');
  });

  it('groups thousands for the locale', () => {
    expect(figureValue(families!, 1, 'he')).toBe('1,200+');
  });
});
