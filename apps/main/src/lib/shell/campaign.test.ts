import { describe, expect, it, vi } from 'vitest';
import { campaignUrl } from './campaign';

describe('campaignUrl', () => {
  const base = 'https://euro-passports.com';

  describe('English only (the portal setting by default)', () => {
    it('sends every page, in either language, to the English edition with the main-site source', () => {
      for (const locale of ['en', 'he'] as const) {
        expect(campaignUrl(locale, 'sign-in', base, false)).toBe('https://euro-passports.com/sign-in?source=main-site');
        expect(campaignUrl(locale, 'portal', base, false)).toBe('https://euro-passports.com/portal?source=main-site');
      }
    });

    it('ignores a trailing slash of the configured base', () => {
      expect(campaignUrl('en', 'sign-in', 'http://localhost:3001/', false)).toBe('http://localhost:3001/sign-in?source=main-site');
    });

    it('is what the default is when NEXT_PUBLIC_CAMPAIGN_LOCALES is not set', async () => {
      vi.stubEnv('NEXT_PUBLIC_CAMPAIGN_LOCALES', '');
      vi.resetModules();
      const { campaignUrl: fresh } = await import('./campaign');
      const url = fresh('he', 'sign-in');
      vi.unstubAllEnvs();
      expect(url.endsWith('/sign-in?source=main-site')).toBe(true);
      expect(url).not.toContain('/he/');
      expect(url.startsWith('http')).toBe(true);
    });
  });

  describe('bilingual portal (NEXT_PUBLIC_CAMPAIGN_LOCALES=en,he)', () => {
    it('links English pages to the portal root and tells it the language the visitor reads', () => {
      expect(campaignUrl('en', 'sign-in', base, true)).toBe('https://euro-passports.com/sign-in?source=main-site&lang=en');
      expect(campaignUrl('en', 'portal', base, true)).toBe('https://euro-passports.com/portal?source=main-site&lang=en');
    });

    it('links Hebrew pages to the portal /he edition', () => {
      expect(campaignUrl('he', 'sign-in', base, true)).toBe('https://euro-passports.com/he/sign-in?source=main-site');
      expect(campaignUrl('he', 'portal', base, true)).toBe('https://euro-passports.com/he/portal?source=main-site');
    });
  });
});
