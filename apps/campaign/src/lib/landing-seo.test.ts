import { describe, expect, it } from 'vitest';
import { landingJsonLd } from './landing-seo';

const base = {
  siteUrl: 'https://euro-passports.com/',
  mainUrl: 'https://www.lawoffice.org.il',
  serviceName: 'German and Austrian citizenship by descent',
  serviceType: 'Citizenship restoration',
  offerDescription: 'Free eligibility check and consultation call',
};

describe('landingJsonLd', () => {
  it('describes the firm and the service, linked by @id, without a FAQPage', () => {
    const [firm, service] = landingJsonLd({ ...base, locale: 'en' })['@graph'];
    expect([firm['@type'], service['@type']]).toEqual(['LegalService', 'Service']);
    expect(firm['@id']).toBe('https://www.lawoffice.org.il/#firm');
    expect(firm.logo).toBe('https://www.lawoffice.org.il/images/DPL_logo.webp');
    expect(service['@id']).toBe('https://euro-passports.com/#service');
    expect(service.provider).toEqual({ '@id': firm['@id'] });
    expect(service.url).toBe('https://euro-passports.com/');
    expect(service.offers).toMatchObject({ price: '0', priceCurrency: 'USD' });
  });

  it('points the Hebrew service at the /he page', () => {
    const [, service] = landingJsonLd({ ...base, locale: 'he' })['@graph'];
    expect(service.url).toBe('https://euro-passports.com/he');
  });
});
