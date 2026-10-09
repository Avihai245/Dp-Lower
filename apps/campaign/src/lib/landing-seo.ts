import { absoluteUrl } from '@dpl/i18n';
import type { Locale } from '@dpl/core';

/**
 * JSON-LD for the landing page: the firm (LegalService) and the campaign's service, as in the prototype's <head>.
 * The FAQPage entity is emitted by the Faq section next to the questions it describes, so it is not repeated here.
 */
export interface LandingJsonLdInput {
  locale: Locale;
  /** campaign origin, e.g. https://euro-passports.com */
  siteUrl: string;
  /** the firm's own website origin, e.g. https://www.lawoffice.org.il */
  mainUrl: string;
  serviceName: string;
  serviceType: string;
  offerDescription: string;
}

interface LegalServiceNode {
  '@type': 'LegalService';
  '@id': string;
  name: string;
  url: string;
  telephone: string;
  email: string;
  logo: string;
  address: Record<string, string>;
}

interface ServiceNode {
  '@type': 'Service';
  '@id': string;
  name: string;
  serviceType: string;
  provider: { '@id': string };
  areaServed: string;
  url: string;
  offers: { '@type': 'Offer'; price: string; priceCurrency: string; description: string };
}

export interface LandingJsonLd {
  '@context': 'https://schema.org';
  '@graph': [LegalServiceNode, ServiceNode];
}

export function landingJsonLd(i: LandingJsonLdInput): LandingJsonLd {
  const main = i.mainUrl.replace(/\/$/, '');
  const firm = `${main}/#firm`;
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'LegalService',
        '@id': firm,
        name: 'Decker Pex Levi Law Offices',
        url: `${main}/`,
        telephone: '+972-3-372-4722',
        email: 'office@lawoffice.org.il',
        logo: `${main}/images/DPL_logo.webp`,
        address: {
          '@type': 'PostalAddress',
          streetAddress: '11 Menachem Begin Road, Rogovin Tidhar Tower, 25th floor',
          addressLocality: 'Ramat Gan',
          postalCode: '5268104',
          addressCountry: 'IL',
        },
      },
      {
        '@type': 'Service',
        '@id': `${i.siteUrl.replace(/\/$/, '')}/#service`,
        name: i.serviceName,
        serviceType: i.serviceType,
        provider: { '@id': firm },
        areaServed: 'Worldwide',
        url: absoluteUrl(i.siteUrl, i.locale, '/'),
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD', description: i.offerDescription },
      },
    ],
  };
}
