import { describe, expect, it } from 'vitest';
import { chosenLanguage, countryOf, shouldGoHebrew, type LanguageRequest } from './language-choice';

const base: LanguageRequest = {
  pathname: '/about',
  method: 'GET',
  accept: 'text/html,application/xhtml+xml',
  userAgent: 'Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 Chrome/126 Safari/537.36',
  country: null,
  cookie: null,
  langParam: null,
};
const req = (o: Partial<LanguageRequest>): LanguageRequest => ({ ...base, ...o });

describe('shouldGoHebrew', () => {
  it('sends a visitor in Israel who has chosen nothing to the Hebrew edition; everyone else stays on English', () => {
    expect(shouldGoHebrew(req({ country: 'IL' }))).toBe(true);
    expect(shouldGoHebrew(req({ country: 'il' }))).toBe(true);
    for (const country of ['US', 'DE', 'AT', 'GB', null]) expect(shouldGoHebrew(req({ country })), String(country)).toBe(false);
  });

  it('an explicit choice wins over the country, in both directions: the switch cookie and ?lang=', () => {
    expect(shouldGoHebrew(req({ country: 'IL', cookie: 'en' }))).toBe(false);
    expect(shouldGoHebrew(req({ country: 'IL', langParam: 'en' }))).toBe(false);
    expect(shouldGoHebrew(req({ country: 'US', cookie: 'he' }))).toBe(true);
    expect(shouldGoHebrew(req({ country: 'DE', langParam: 'he' }))).toBe(true);
    // the query parameter is the newer statement: it beats an older cookie
    expect(shouldGoHebrew(req({ cookie: 'he', langParam: 'en' }))).toBe(false);
    // junk values are not a choice
    expect(shouldGoHebrew(req({ country: 'IL', cookie: 'fr', langParam: 'xx' }))).toBe(true);
  });

  it('never redirects crawlers, link previews or tools, so a search engine always gets the page the address names', () => {
    for (const userAgent of ['Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)', 'Bingbot/2.0', 'facebookexternalhit/1.1', 'WhatsApp/2.23', 'Slackbot-LinkExpanding 1.0', 'curl/8.4', 'Chrome-Lighthouse', 'HeadlessChrome/126']) {
      expect(shouldGoHebrew(req({ country: 'IL', userAgent })), userAgent).toBe(false);
    }
  });

  it('only page navigations are considered', () => {
    expect(shouldGoHebrew(req({ country: 'IL', method: 'POST' }))).toBe(false);
    expect(shouldGoHebrew(req({ country: 'IL', accept: 'application/json' }))).toBe(false);
    expect(shouldGoHebrew(req({ country: 'IL', accept: null }))).toBe(false);
    expect(shouldGoHebrew(req({ country: 'IL', method: 'HEAD' }))).toBe(true);
  });

  it('an address that is already Hebrew is never redirected', () => {
    expect(shouldGoHebrew(req({ country: 'IL', pathname: '/he' }))).toBe(false);
    expect(shouldGoHebrew(req({ country: 'IL', pathname: '/he/about' }))).toBe(false);
    // a page that merely starts with "he"
    expect(shouldGoHebrew(req({ country: 'IL', pathname: '/help' }))).toBe(true);
  });
});

describe('chosenLanguage and countryOf', () => {
  it('reads the query parameter before the cookie and ignores anything but en and he', () => {
    expect(chosenLanguage({ cookie: 'he', langParam: 'en' })).toBe('en');
    expect(chosenLanguage({ cookie: 'he', langParam: null })).toBe('he');
    expect(chosenLanguage({ cookie: 'EN', langParam: 'fr' })).toBeNull();
  });

  it('takes the country from the platform headers and rejects anything that is not a two-letter code', () => {
    const h = (o: Record<string, string>) => ({ get: (n: string) => o[n] ?? null });
    expect(countryOf(h({ 'x-vercel-ip-country': 'IL' }))).toBe('IL');
    expect(countryOf(h({ 'cf-ipcountry': 'de' }))).toBe('DE');
    expect(countryOf(h({ 'x-vercel-ip-country': 'ISR' }))).toBeNull();
    expect(countryOf(h({}))).toBeNull();
  });
});
