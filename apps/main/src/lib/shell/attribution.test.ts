import { describe, expect, it } from 'vitest';
import { attributionFor, externalReferrerHost, rememberFirstTouch } from './attribution';

/** A Storage stand-in that keeps what it is given. */
function memory(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    size: () => data.size,
  };
}

describe('externalReferrerHost', () => {
  it('names another site and ignores the site itself, nothing and rubbish', () => {
    expect(externalReferrerHost('https://www.google.com/search?q=x', 'www.lawoffice.org.il')).toBe(
      'www.google.com',
    );
    expect(externalReferrerHost('https://www.lawoffice.org.il/about', 'www.lawoffice.org.il')).toBeNull();
    expect(externalReferrerHost('', 'www.lawoffice.org.il')).toBeNull();
    expect(externalReferrerHost('not a url', 'www.lawoffice.org.il')).toBeNull();
  });
});

describe('first-touch attribution', () => {
  it('keeps the campaign parameters of the landing page for the forms that come later', () => {
    const store = memory();
    rememberFirstTouch('?utm_source=google&utm_campaign=spring&gclid=abc', '', 'www.lawoffice.org.il', store);
    // three pages later: the URL carries nothing, the forms still know
    expect(attributionFor('', store)).toEqual({
      utm: { utm_source: 'google', utm_campaign: 'spring' },
      source: 'google',
    });
  });

  it('first touch wins: a later visit never overwrites it', () => {
    const store = memory();
    rememberFirstTouch('?utm_source=google', '', 'x.org', store);
    rememberFirstTouch('?utm_source=newsletter', 'https://mail.example/', 'x.org', store);
    expect(attributionFor('', store).source).toBe('google');
  });

  it('parameters on the page being sent from replace the stored ones as a whole; two touches are never mixed', () => {
    const store = memory();
    rememberFirstTouch('?utm_source=google&utm_medium=cpc&utm_campaign=spring', '', 'x.org', store);
    expect(attributionFor('?utm_medium=email&utm_content=b', store).utm).toEqual({ utm_medium: 'email', utm_content: 'b' });
    expect(attributionFor('?utm_source=second&utm_campaign=c2', store)).toEqual({ utm: { utm_source: 'second', utm_campaign: 'c2' }, source: 'second' });
    // a page without campaign parameters keeps the first touch
    expect(attributionFor('?page=2', store).utm).toEqual({ utm_source: 'google', utm_medium: 'cpc', utm_campaign: 'spring' });
  });

  it('falls back to the referring site, then to "direct"', () => {
    const viaReferrer = memory();
    rememberFirstTouch('', 'https://news.example/story', 'x.org', viaReferrer);
    expect(attributionFor('', viaReferrer)).toEqual({ utm: {}, source: 'news.example' });
    expect(attributionFor('', memory())).toEqual({ utm: {}, source: 'direct' });
  });

  it('writes nothing for a visit with nothing to remember (own pages, no parameters)', () => {
    const store = memory();
    rememberFirstTouch('', 'https://x.org/about', 'x.org', store);
    rememberFirstTouch('?page=2', '', 'x.org', store);
    expect(store.size()).toBe(0);
  });

  it('survives blocked or corrupted storage', () => {
    const broken = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    };
    expect(() => rememberFirstTouch('?utm_source=google', '', 'x.org', broken)).not.toThrow();
    expect(attributionFor('?utm_source=google', { getItem: () => '{not json' })).toEqual({
      utm: { utm_source: 'google' },
      source: 'google',
    });
    expect(attributionFor('', { getItem: () => '{"utm":"oops","referrer":3}' })).toEqual({
      utm: {},
      source: 'direct',
    });
  });

  it('never exceeds the API limits', () => {
    const many = Array.from({ length: 20 }, (_, i) => `utm_k${i}=v`).join('&');
    const store = memory();
    rememberFirstTouch(`?${many}`, '', 'x.org', store);
    expect(Object.keys(attributionFor('?utm_extra=1', store).utm).length).toBeLessThanOrEqual(12);
    expect(attributionFor(`?utm_source=${'a'.repeat(500)}`, memory()).source).toHaveLength(80);
  });
});
