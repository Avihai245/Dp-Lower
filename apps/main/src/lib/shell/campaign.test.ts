import { describe, expect, it } from 'vitest';
import { campaignUrl } from './campaign';

describe('campaignUrl', () => {
  const base = 'https://euro-passports.com';

  it('links English pages to the campaign root with the main-site source', () => {
    expect(campaignUrl('en', 'eligibility', base)).toBe('https://euro-passports.com/eligibility?source=main-site&lang=en');
    expect(campaignUrl('en', 'sign-in', base)).toBe('https://euro-passports.com/sign-in?source=main-site&lang=en');
  });

  it('links Hebrew pages to the campaign /he edition', () => {
    expect(campaignUrl('he', 'eligibility', base)).toBe('https://euro-passports.com/he/eligibility?source=main-site');
    expect(campaignUrl('he', 'sign-in', base)).toBe('https://euro-passports.com/he/sign-in?source=main-site');
  });

  it('ignores a trailing slash of the configured base', () => {
    expect(campaignUrl('en', 'sign-in', 'http://localhost:3001/')).toBe('http://localhost:3001/sign-in?source=main-site&lang=en');
  });

  it('reads the base from NEXT_PUBLIC_CAMPAIGN_URL by default', () => {
    const url = campaignUrl('en', 'eligibility');
    expect(url.endsWith('/eligibility?source=main-site&lang=en')).toBe(true);
    expect(url.startsWith('http')).toBe(true);
  });
});
