import { getContent } from '@dpl/i18n';
import { describe, expect, it } from 'vitest';
import { firmJsonLd } from './jsonld';

const SITE = 'https://www.lawoffice.org.il';
const build = (locale: 'en' | 'he') =>
  firmJsonLd({ locale, siteUrl: SITE, name: locale === 'en' ? 'Decker Pex Levi Law Offices' : 'דקר פקס לוי', catalogName: locale === 'en' ? 'Practice areas' : 'תחומי עיסוק', content: getContent(locale) });

describe('home page structured data', () => {
  const en = build('en');
  const firm = en['@graph'][0] as Record<string, unknown> & { hasOfferCatalog: { itemListElement: Array<{ itemOffered: { name: string; url: string } }> } };
  const site = en['@graph'][1] as Record<string, unknown>;

  it('is a graph of the firm and the website, linked by id', () => {
    expect(en['@context']).toBe('https://schema.org');
    expect(en['@graph']).toHaveLength(2);
    expect(firm['@type']).toEqual(['LegalService', 'Organization']);
    expect(firm['@id']).toBe(`${SITE}/#firm`);
    expect(site['@type']).toBe('WebSite');
    expect(site['@id']).toBe(`${SITE}/#site`);
    expect(site.publisher).toEqual({ '@id': firm['@id'] });
    expect(site.inLanguage).toEqual(['en', 'he']);
  });

  it('carries both offices, phones, email, founders and profiles of the prototype', () => {
    expect(firm.telephone).toBe('+972-3-372-4722');
    expect(firm.email).toBe('office@lawoffice.org.il');
    expect(firm.address).toMatchObject({ addressLocality: 'Ramat Gan', postalCode: '5268104', addressCountry: 'IL' });
    expect(firm.department).toHaveLength(1);
    expect(firm.department).toMatchObject([{ telephone: '+972-2-381-0013', address: { addressLocality: 'Jerusalem', postalCode: '9342148' } }]);
    expect(firm.founder).toEqual([
      { '@type': 'Person', name: 'Joshua Pex' },
      { '@type': 'Person', name: 'Michael Decker' },
    ]);
    expect(firm.sameAs).toEqual(['https://www.facebook.com/DeckerPexCo', 'https://www.linkedin.com/company/decker-pex-co/', 'https://www.youtube.com/@DeckerPexLawoffice']);
    expect(firm.logo).toBe(`${SITE}/images/DPL_logo.webp`);
    expect(firm.areaServed).toEqual(['IL', 'US', 'CA', 'GB', 'Worldwide']);
  });

  it('offers the 22 practice areas at their clean addresses', () => {
    const offers = firm.hasOfferCatalog.itemListElement.map((o) => o.itemOffered);
    expect(offers).toHaveLength(22);
    expect(offers[0]).toEqual({ '@type': 'Service', name: 'German citizenship', url: `${SITE}/services/german-citizenship` });
    for (const o of offers) expect(o.url).toMatch(/^https:\/\/www\.lawoffice\.org\.il\/services\/[a-z-]+$/);
    expect(firm.knowsAbout).toEqual(offers.map((o) => o.name));
    expect(JSON.stringify(en)).not.toContain('?p=');
  });

  it('the Hebrew edition has Hebrew names, /he URLs and founders without the title', () => {
    const he = build('he');
    const hf = he['@graph'][0] as typeof firm;
    const offers = hf.hasOfferCatalog.itemListElement.map((o) => o.itemOffered);
    expect(offers).toHaveLength(22);
    expect(offers[0]).toEqual({ '@type': 'Service', name: 'אזרחות גרמנית', url: `${SITE}/he/services/german-citizenship` });
    expect(hf.founder).toEqual([
      { '@type': 'Person', name: 'יהושע פקס' },
      { '@type': 'Person', name: 'מיכאל דקר' },
    ]);
    // the identity of the firm does not depend on the language
    expect(hf['@id']).toBe(firm['@id']);
    expect(hf.url).toBe(`${SITE}/`);
  });

  it('serialises, and survives the < escaping JsonLd applies', () => {
    const text = JSON.stringify(en);
    expect(() => JSON.parse(text.replace(/</g, '\\u003c'))).not.toThrow();
  });

  it('normalises a trailing slash on the origin', () => {
    const g = firmJsonLd({ locale: 'en', siteUrl: `${SITE}/`, name: 'x', catalogName: 'y', content: getContent('en') });
    expect((g['@graph'][0] as { url: string }).url).toBe(`${SITE}/`);
  });
});
