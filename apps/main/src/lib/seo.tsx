import { type Locale } from '@dpl/core';
import { absoluteUrl, alternates } from '@dpl/i18n';
import type { Metadata } from 'next';

export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(/\/$/, '');
export const OG_LOCALE: Record<Locale, string> = { en: 'en_US', he: 'he_IL' };

interface PageMeta {
  locale: Locale;
  /** unprefixed path, "/" for home, e.g. "/services/german-citizenship" */
  path: string;
  /** the complete <title> (no template is added) */
  title: string;
  description: string;
  /** absolute URL or a path under /public, default the team photo */
  image?: string;
  type?: 'website' | 'article' | 'profile';
  noindex?: boolean;
}

/** Title, description, canonical, hreflang alternates (en, he, x-default), Open Graph and Twitter card for one page. */
export function pageMetadata(p: PageMeta): Metadata {
  const url = absoluteUrl(SITE_URL, p.locale, p.path);
  const image = p.image ? (p.image.startsWith('http') ? p.image : `${SITE_URL}${p.image}`) : `${SITE_URL}/images/Decker-Pex-Levi-Team-scaled.jpg.webp`;
  const other: Locale = p.locale === 'en' ? 'he' : 'en';
  return {
    title: p.title,
    description: p.description,
    alternates: { canonical: url, languages: alternates(SITE_URL, p.path) },
    robots: p.noindex
      ? { index: false, follow: true }
      : { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1 },
    openGraph: {
      type: p.type === 'article' ? 'article' : 'website',
      url,
      title: p.title,
      description: p.description,
      siteName: 'Decker Pex Levi Law Offices',
      locale: OG_LOCALE[p.locale],
      alternateLocale: [OG_LOCALE[other]],
      images: [{ url: image }],
    },
    twitter: { card: 'summary_large_image', title: p.title, description: p.description, images: [image] },
  };
}

/** Renders one JSON-LD block. '<' is escaped so the payload can never close the script tag. */
export function JsonLd({ data }: { data: unknown }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, '\\u003c') }} />;
}

export function breadcrumbJsonLd(locale: Locale, items: Array<{ name: string; path: string }>) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: it.name,
      item: absoluteUrl(SITE_URL, locale, it.path),
    })),
  };
}
