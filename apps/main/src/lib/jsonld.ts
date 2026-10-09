import type { Locale } from '@dpl/core';
import { absoluteUrl, type ContentBundle } from '@dpl/i18n';
import { FIRM } from './firm';

/**
 * Structured data of the home page: the firm (LegalService + Organization with both offices, phones, founders, practice
 * areas, profiles and the catalogue of its services) and the WebSite. Taken from the prototype's <head>, with the
 * service names and URLs generated from the content so they are always the 22 current practice areas, at their clean
 * /services/<slug> addresses (and /he/services/<slug> for the Hebrew edition).
 */
export interface HomeJsonLdArgs {
  locale: Locale;
  /** origin without a trailing slash, e.g. https://www.lawoffice.org.il */
  siteUrl: string;
  /** the firm's name in the language of the page */
  name: string;
  /** name of the catalogue of services ("Practice areas") in the language of the page */
  catalogName: string;
  content: Pick<ContentBundle, 'services' | 'team'>;
}

const FOUNDER_SLUGS = ['joshua-pex', 'michael-decker'] as const;
/** Hebrew team names carry the title "עו"ד" in front, which is not part of a person's name in structured data. */
const plainName = (name: string): string => name.replace(/^עו"ד\s+/, '');

export function homeJsonLd({ locale, siteUrl, name, catalogName, content }: HomeJsonLdArgs) {
  const origin = siteUrl.replace(/\/$/, '');
  const firmId = `${origin}/#firm`;
  const founders = FOUNDER_SLUGS.map((slug) => content.team.find((m) => m.slug === slug))
    .filter((m): m is NonNullable<typeof m> => Boolean(m))
    .map((m) => ({ '@type': 'Person', name: plainName(m.name) }));

  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': ['LegalService', 'Organization'],
        '@id': firmId,
        name,
        alternateName: ['Decker Pex Levi', 'דקר פקס לוי'],
        url: `${origin}/`,
        logo: `${origin}/images/DPL_logo.webp`,
        image: `${origin}/images/Decker-Pex-Levi-Team-scaled.jpg.webp`,
        email: FIRM.email,
        telephone: '+972-3-372-4722',
        priceRange: 'Free initial consultation',
        address: {
          '@type': 'PostalAddress',
          streetAddress: '11 Menachem Begin Road, Rogovin Tidhar Tower, 25th floor',
          addressLocality: 'Ramat Gan',
          postalCode: '5268104',
          addressCountry: 'IL',
        },
        department: [
          {
            '@type': 'LegalService',
            name: 'Decker Pex Levi — Jerusalem',
            telephone: '+972-2-381-0013',
            address: {
              '@type': 'PostalAddress',
              streetAddress: '10 Yad Harutzim Street, 2nd floor',
              addressLocality: 'Jerusalem',
              postalCode: '9342148',
              addressCountry: 'IL',
            },
          },
        ],
        areaServed: ['IL', 'US', 'CA', 'GB', 'Worldwide'],
        availableLanguage: ['en', 'he'],
        founder: founders,
        knowsAbout: content.services.map((s) => s.name),
        sameAs: [FIRM.facebook, FIRM.linkedin, FIRM.youtube],
        hasOfferCatalog: {
          '@type': 'OfferCatalog',
          name: catalogName,
          itemListElement: content.services.map((s) => ({
            '@type': 'Offer',
            itemOffered: { '@type': 'Service', name: s.name, url: absoluteUrl(origin, locale, `/services/${s.slug}`) },
          })),
        },
      },
      {
        '@type': 'WebSite',
        '@id': `${origin}/#site`,
        url: `${origin}/`,
        name,
        inLanguage: ['en', 'he'],
        publisher: { '@id': firmId },
      },
    ],
  };
}
