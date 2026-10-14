import { describe, expect, it } from 'vitest';
import enCommon from '../../messages/en/common.json';
import enLanding from '../../messages/en/landing.json';
import heCommon from '../../messages/he/common.json';
import heLanding from '../../messages/he/landing.json';
import { FIGURES } from './landing-figures';

/**
 * The landing sections read lists from the messages and pair them with things that live in code (the three
 * photographs, the four count-up figures, the featured review). These tests keep both sides in step in both languages;
 * key parity between English and Hebrew is already covered by src/i18n/messages.test.ts.
 */
const languages = { en: enLanding, he: heLanding } as const;

describe.each(Object.entries(languages))('landing messages (%s)', (_lang, m) => {
  it('has the list lengths the sections are designed for', () => {
    expect(m.stats).toHaveLength(3);
    expect(m.why.story).toHaveLength(3);
    expect(m.routes.items).toHaveLength(2);
    expect(m.attorneys.people).toHaveLength(3);
    expect(m.attorneys.credentials).toHaveLength(4);
    expect(m.caseStudy.parts).toHaveLength(3);
    expect(m.benefits.items).toHaveLength(5);
  });

  it('has one label per count-up figure', () => {
    expect(m.reputation.figures).toHaveLength(FIGURES.length);
  });

  it('has the twelve written reviews, newest first, with real ISO dates', () => {
    const { reviews } = m.reputation;
    expect(reviews).toHaveLength(12);
    const times = reviews.map((r) => Date.parse(`${r.date}T12:00:00Z`));
    expect(times.every(Number.isFinite)).toBe(true);
    expect([...times].sort((a, b) => b - a)).toEqual(times);
    for (const r of reviews) expect(r.text.length).toBeGreaterThan(40);
  });

  it('puts the review text into the featured quote', () => {
    expect(m.reputation.featuredQuote).toContain('{text}');
  });
});

describe('landing messages across languages', () => {
  it('uses the same review dates in English and Hebrew', () => {
    expect(heLanding.reputation.reviews.map((r) => r.date)).toEqual(
      enLanding.reputation.reviews.map((r) => r.date),
    );
  });

  it('keeps the figures claims out of the messages (they are numbers in code, identical in every language)', () => {
    expect(JSON.stringify(heLanding.reputation.figures)).not.toMatch(/1,?200|94%/);
  });

  it('names each language by the other one for the header switch', () => {
    expect(enCommon.language.name).toBe('עברית');
    expect(heCommon.language.name).toBe('English');
    expect(enCommon.language.switchLabel).toContain(enCommon.language.name);
    expect(heCommon.language.switchLabel).toContain(heCommon.language.name);
  });
});
