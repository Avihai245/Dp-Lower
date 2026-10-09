import { describe, expect, it } from 'vitest';
import { campaignUrl } from './campaign';

describe('campaignUrl', () => {
  const base = 'https://euro-passports.com';

  describe('English only (the campaign setting by default)', () => {
    it('sends every page, in either language, to the English edition with the main-site source', () => {
      for (const locale of ['en', 'he'] as const) {
        expect(campaignUrl(locale, 'eligibility', base, false)).toBe('https://euro-passports.com/eligibility?source=main-site');
        expect(campaignUrl(locale, 'sign-in', base, false)).toBe('https://euro-passports.com/sign-in?source=main-site');
      }
    });

    it('ignores a trailing slash of the configured base', () => {
      expect(campaignUrl('en', 'sign-in', 'http://localhost:3001/', false)).toBe('http://localhost:3001/sign-in?source=main-site');
    });

    it('is what the default is when NEXT_PUBLIC_CAMPAIGN_LOCALES is not set', () => {
      const url = campaignUrl('he', 'eligibility');
      expect(url.endsWith('/eligibility?source=main-site')).toBe(true);
      expect(url).not.toContain('/he/');
      expect(url.startsWith('http')).toBe(true);
    });
  });

  describe('bilingual campaign (NEXT_PUBLIC_CAMPAIGN_LOCALES=en,he)', () => {
    it('links English pages to the campaign root and tells it the language the visitor reads', () => {
      expect(campaignUrl('en', 'eligibility', base, true)).toBe('https://euro-passports.com/eligibility?source=main-site&lang=en');
      expect(campaignUrl('en', 'sign-in', base, true)).toBe('https://euro-passports.com/sign-in?source=main-site&lang=en');
    });

    it('links Hebrew pages to the campaign /he edition', () => {
      expect(campaignUrl('he', 'eligibility', base, true)).toBe('https://euro-passports.com/he/eligibility?source=main-site');
      expect(campaignUrl('he', 'sign-in', base, true)).toBe('https://euro-passports.com/he/sign-in?source=main-site');
    });
  });
});
