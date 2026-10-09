import { ARTICLE_SLUGS, getArticle } from '@dpl/i18n';
import { describe, expect, it } from 'vitest';
import { articleIsoDate, parseArticleDate } from './dates';

describe('parseArticleDate', () => {
  it('parses the English display dates', () => {
    expect(parseArticleDate('15 Jun 2026')).toBe('2026-06-15');
    expect(parseArticleDate('6 May 2026')).toBe('2026-05-06');
    expect(parseArticleDate('29 Aug 2026')).toBe('2026-08-29');
    expect(parseArticleDate('8 Sep 2026')).toBe('2026-09-08');
    expect(parseArticleDate('31 Dec 2025')).toBe('2025-12-31');
  });

  it('accepts full month names, month-first order and ordinals', () => {
    expect(parseArticleDate('15 June 2026')).toBe('2026-06-15');
    expect(parseArticleDate('June 15, 2026')).toBe('2026-06-15');
    expect(parseArticleDate('Sept 3, 2026')).toBe('2026-09-03');
    expect(parseArticleDate('1st Mar 2026')).toBe('2026-03-01');
    expect(parseArticleDate('  15   jun  2026 ')).toBe('2026-06-15');
  });

  it('parses the Hebrew display dates (month prefixed with ב)', () => {
    expect(parseArticleDate('15 ביוני 2026')).toBe('2026-06-15');
    expect(parseArticleDate('6 במאי 2026')).toBe('2026-05-06');
    expect(parseArticleDate('29 באפריל 2026')).toBe('2026-04-29');
    expect(parseArticleDate('8 בספטמבר 2026')).toBe('2026-09-08');
    expect(parseArticleDate('29 באוגוסט 2026')).toBe('2026-08-29');
    expect(parseArticleDate('3 במרץ 2026')).toBe('2026-03-03');
    expect(parseArticleDate('3 מרץ 2026')).toBe('2026-03-03');
    expect(parseArticleDate('1 בינואר 2027')).toBe('2027-01-01');
    expect(parseArticleDate('1 בדצמבר 2026')).toBe('2026-12-01');
  });

  it('ignores bidi marks and non-breaking spaces', () => {
    expect(parseArticleDate('‏15 ביוני 2026‏')).toBe('2026-06-15');
  });

  it('passes ISO dates through and rejects everything else', () => {
    expect(parseArticleDate('2026-06-15')).toBe('2026-06-15');
    expect(parseArticleDate('2026-02-30')).toBeNull();
    expect(parseArticleDate('31 Feb 2026')).toBeNull();
    expect(parseArticleDate('15 Foo 2026')).toBeNull();
    expect(parseArticleDate('15 בפו 2026')).toBeNull();
    expect(parseArticleDate('ביקורת Google')).toBeNull();
    expect(parseArticleDate('')).toBeNull();
    expect(parseArticleDate('15 Jun')).toBeNull();
  });
});

describe('articleIsoDate', () => {
  it('is derived from the English article of the same slug, so both languages agree', () => {
    for (const slug of ARTICLE_SLUGS) {
      const en = parseArticleDate(getArticle('en', slug)!.date);
      expect(en, `${slug} English date`).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(articleIsoDate(slug)).toBe(en);
      // the Hebrew display text must describe the same day
      expect(parseArticleDate(getArticle('he', slug)!.date), `${slug} Hebrew date`).toBe(en);
    }
  });

  it('falls back to the given text for an unknown slug, otherwise undefined', () => {
    expect(articleIsoDate('no-such-article', '15 ביוני 2026')).toBe('2026-06-15');
    expect(articleIsoDate('no-such-article')).toBeUndefined();
  });
});
