import { describe, expect, it } from 'vitest';
import {
  COOKIE_MAX_AGE_SECONDS,
  DEFAULT_SOURCE,
  SOURCE_MAX_LENGTH,
  attributionCookieList,
  decodeAttribution,
  firstTouchCookies,
  parseAttribution,
  returnCookie,
} from './attribution';

describe('parseAttribution', () => {
  it('returns null when the URL says nothing about the visit', () => {
    expect(parseAttribution('')).toBeNull();
    expect(parseAttribution('?foo=bar&lang=he')).toBeNull();
  });

  it('uses the source parameter', () => {
    expect(parseAttribution('?source=main-site')).toEqual({ source: 'main-site', utm: null });
  });

  it('defaults to campaign-ger-aus when only utm parameters are present', () => {
    expect(parseAttribution('?utm_source=google&utm_medium=cpc')).toEqual({
      source: DEFAULT_SOURCE,
      utm: { utm_source: 'google', utm_medium: 'cpc' },
    });
  });

  it('is "direct" for a deep link without a source, and keeps an explicit source', () => {
    expect(parseAttribution('?entry=eligibility')?.source).toBe('direct');
    expect(parseAttribution('?entry=signin&utm_campaign=x')?.source).toBe('direct');
    expect(parseAttribution('?entry=eligibility&source=lawoffice')?.source).toBe('lawoffice');
  });

  it('cuts the source to 80 characters and strips control characters', () => {
    const long = 'a'.repeat(200);
    expect(parseAttribution(`?source=${long}`)?.source).toHaveLength(SOURCE_MAX_LENGTH);
    expect(parseAttribution('?source=%0Aweb%00site%0D')?.source).toBe('website');
    expect(parseAttribution('?source=%20%20')).toBeNull();
  });

  it('keeps only well-formed utm_ keys, lowercased, at most eight, with short values', () => {
    const q = new URLSearchParams({
      UTM_Source: 'A',
      utm_medium: 'b',
      'utm_bad key': 'c',
      utm_: 'd',
      other: 'e',
    });
    expect(parseAttribution(q)?.utm).toEqual({ utm_source: 'A', utm_medium: 'b' });

    const many = Array.from({ length: 12 }, (_, i) => `utm_k${i}=v`).join('&');
    expect(Object.keys(parseAttribution(`?${many}`)?.utm ?? {})).toHaveLength(8);

    expect(parseAttribution(`?utm_term=${'x'.repeat(500)}`)?.utm?.utm_term).toHaveLength(100);
  });

  it('keeps the first value of a repeated parameter', () => {
    expect(parseAttribution('?utm_source=first&utm_source=second')?.utm).toEqual({ utm_source: 'first' });
  });
});

describe('attributionCookieList', () => {
  it('lists the source cookie and, when present, the utm cookie as JSON', () => {
    expect(attributionCookieList({ source: 'a b;c', utm: { utm_source: 'g&h' } })).toEqual([
      { name: 'dpl_src', value: 'a b;c' },
      { name: 'dpl_utm', value: '{"utm_source":"g&h"}' },
    ]);
    expect(COOKIE_MAX_AGE_SECONDS).toBe(2_592_000);
  });

  it('omits the utm cookie when there are no utm parameters', () => {
    expect(attributionCookieList({ source: 'x', utm: null })).toEqual([{ name: 'dpl_src', value: 'x' }]);
  });
});

describe('decodeAttribution (server side)', () => {
  it('round-trips what the middleware wrote', () => {
    const attribution = { source: 'läwoffice ü', utm: { utm_source: 'g&h', utm_medium: 'cpc' } };
    // the platform URL-encodes the header value; both raw and encoded values must read back the same
    const [src, utm] = attributionCookieList(attribution).map((c) => encodeURIComponent(c.value));
    expect(decodeAttribution(src, utm)).toEqual(attribution);
    const [rawSrc, rawUtm] = attributionCookieList(attribution).map((c) => c.value);
    expect(decodeAttribution(rawSrc, rawUtm)).toEqual(attribution);
  });

  it('falls back to the default source and no utm for missing or empty cookies', () => {
    expect(decodeAttribution(undefined, undefined)).toEqual({ source: DEFAULT_SOURCE, utm: null });
    expect(decodeAttribution('', '')).toEqual({ source: DEFAULT_SOURCE, utm: null });
    expect(decodeAttribution('%20', null).source).toBe(DEFAULT_SOURCE);
  });

  it('survives malformed values', () => {
    expect(decodeAttribution('%E0%A4%A', '%7Bnot-json').source).toBe('%E0%A4%A');
    expect(decodeAttribution(null, '%7Bnot-json')).toEqual({ source: DEFAULT_SOURCE, utm: null });
    expect(decodeAttribution(null, encodeURIComponent('[1,2]')).utm).toBeNull();
    expect(decodeAttribution(null, encodeURIComponent('"text"')).utm).toBeNull();
    expect(decodeAttribution(null, encodeURIComponent('null')).utm).toBeNull();
  });

  it('caps and filters tampered values again', () => {
    // written as text: an object literal would swallow __proto__, JSON.parse keeps it as an own key
    const tampered = encodeURIComponent(
      `{"utm_ok":"${'x'.repeat(500)}","role":"admin","__proto__":"x","utm_num":5,"utm_a b":"c"}`,
    );
    expect(decodeAttribution('a'.repeat(300), tampered)).toEqual({
      source: 'a'.repeat(SOURCE_MAX_LENGTH),
      utm: { utm_ok: 'x'.repeat(100) },
    });
    const many = encodeURIComponent(
      JSON.stringify(Object.fromEntries(Array.from({ length: 20 }, (_, i) => [`utm_k${i}`, 'v']))),
    );
    expect(Object.keys(decodeAttribution(null, many).utm ?? {})).toHaveLength(8);
  });
});

describe('returnCookie (where "Back to the site" goes)', () => {
  it('is the source of the latest deep link, and "direct" when the link names an entry only', () => {
    expect(returnCookie('?entry=eligibility&source=main-site')).toEqual({ name: 'dpl_from', value: 'main-site' });
    expect(returnCookie('?source=news')).toEqual({ name: 'dpl_from', value: 'news' });
    expect(returnCookie('?entry=signin')).toEqual({ name: 'dpl_from', value: 'direct' });
  });
  it('says nothing for a visit that names no origin (utm parameters alone are attribution, not a way back)', () => {
    expect(returnCookie('')).toBeNull();
    expect(returnCookie('?utm_source=google&utm_medium=cpc')).toBeNull();
    expect(returnCookie('?source=%20%20')).toBeNull();
  });
  it('is independent of the first touch: both are written when a first visit is a deep link', () => {
    expect(firstTouchCookies('?entry=eligibility&source=main-site', () => false).map((c) => c.name)).toEqual(['dpl_src']);
    expect(returnCookie('?entry=eligibility&source=main-site')?.value).toBe('main-site');
  });
});

describe('firstTouchCookies', () => {
  const none = () => false;

  it('sets both cookies for a first visit that carries attribution', () => {
    const list = firstTouchCookies('?source=news&utm_medium=email', none);
    expect(list.map((c) => c.name)).toEqual(['dpl_src', 'dpl_utm']);
  });

  it('sets nothing for a plain visit', () => {
    expect(firstTouchCookies('', none)).toEqual([]);
  });

  it('never overwrites an earlier touch', () => {
    expect(firstTouchCookies('?source=later', (n) => n === 'dpl_src')).toEqual([]);
    expect(firstTouchCookies('?utm_source=later', (n) => n === 'dpl_utm')).toEqual([]);
  });
});
