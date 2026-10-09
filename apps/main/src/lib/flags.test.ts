import { getContent } from '@dpl/i18n';
import { s } from '@dpl/ui';
import { describe, expect, it } from 'vitest';
import { COUNTRY_SLUGS, flagStyle } from './flags';

describe('country flags', () => {
  it('draws a flag for each of the nine countries, all of which exist in the content', () => {
    expect(COUNTRY_SLUGS).toHaveLength(9);
    const slugs = getContent('en').services.map((sv) => sv.slug);
    for (const slug of COUNTRY_SLUGS) {
      expect(slugs).toContain(slug);
      expect(flagStyle(slug)).toMatch(/gradient/);
    }
  });

  it('are the prototype size, 34 x 23', () => {
    const style = s(flagStyle('german-citizenship')) as Record<string, string>;
    expect(style.width).toBe('34px');
    expect(style.height).toBe('23px');
  });

  it('never mirror: the stripes keep their physical direction in the right-to-left edition', () => {
    for (const slug of COUNTRY_SLUGS) {
      const style = s(flagStyle(slug)) as Record<string, string>;
      const background = `${style.background ?? ''} ${style.backgroundImage ?? ''}`;
      expect(background, slug).not.toContain('--dir');
      expect(background, slug).not.toContain('calc(');
    }
    // Portugal: green on the hoist (left) side
    expect((s(flagStyle('portuguese-citizenship')) as Record<string, string>).background).toContain('linear-gradient(90deg, #046a38 0 40%, #c8102e 40%)');
    // the US canton stays top left
    expect((s(flagStyle('usa-immigration')) as Record<string, string>).backgroundPosition).toBe('left top, left top');
  });

  it('returns an empty flag for an unknown slug rather than throwing', () => {
    expect(() => flagStyle('atlantis')).not.toThrow();
  });
});
