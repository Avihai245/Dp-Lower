import { describe, expect, it } from 'vitest';
import {
  COOKIE_MAX_AGE_SECONDS,
  DEFAULT_SOURCE,
  SOURCE_MAX_LENGTH,
  attributionCookies,
  cookiesToWrite,
  decodeAttribution,
  parseAttribution,
  readCookie,
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

describe('readCookie', () => {
  it('finds a cookie by exact name', () => {
    expect(readCookie('a=1; dpl_src=main-site; b=2', 'dpl_src')).toBe('main-site');
    expect(readCookie('a=1; xdpl_src=nope', 'dpl_src')).toBeNull();
    expect(readCookie('', 'dpl_src')).toBeNull();
  });
});

describe('attributionCookies', () => {
  it('writes 30-day, path=/, SameSite=Lax cookies with encoded values', () => {
    const [src, utm] = attributionCookies({ source: 'a b;c', utm: { utm_source: 'g&h' } }, false);
    expect(src).toBe(`dpl_src=a%20b%3Bc; Max-Age=${COOKIE_MAX_AGE_SECONDS}; Path=/; SameSite=Lax`);
    expect(COOKIE_MAX_AGE_SECONDS).toBe(2_592_000);
    expect(utm).toContain('dpl_utm=');
    const value = /^dpl_utm=([^;]*)/.exec(utm!)![1]!;
    expect(JSON.parse(decodeURIComponent(value))).toEqual({ utm_source: 'g&h' });
  });

  it('adds Secure on https and omits the utm cookie when there are no utm parameters', () => {
    const list = attributionCookies({ source: 'x', utm: null }, true);
    expect(list).toHaveLength(1);
    expect(list[0]).toMatch(/; Secure$/);
  });
});

describe('decodeAttribution (server side)', () => {
  it('round-trips what the browser wrote', () => {
    const attribution = { source: 'läwoffice ü', utm: { utm_source: 'g&h', utm_medium: 'cpc' } };
    const [src, utm] = attributionCookies(attribution, false).map((c) => /^[^=]+=([^;]*)/.exec(c)![1]!);
    expect(decodeAttribution(src, utm)).toEqual(attribution);
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

describe('cookiesToWrite (first touch)', () => {
  it('writes both cookies for a first visit that carries attribution', () => {
    const list = cookiesToWrite('?source=news&utm_medium=email', 'unrelated=1', false);
    expect(list.map((c) => c.split('=')[0])).toEqual(['dpl_src', 'dpl_utm']);
  });

  it('writes nothing for a plain visit', () => {
    expect(cookiesToWrite('', '', false)).toEqual([]);
  });

  it('never overwrites an earlier touch', () => {
    expect(cookiesToWrite('?source=later', 'dpl_src=first', false)).toEqual([]);
    expect(cookiesToWrite('?utm_source=later', 'dpl_utm=%7B%7D', false)).toEqual([]);
  });
});
