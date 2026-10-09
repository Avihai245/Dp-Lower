import type { Locale } from '@dpl/core';
import { absoluteUrl, type Article, type Service } from '@dpl/i18n';
import { articleIsoDate, parseArticleDate } from './dates';

/**
 * Structured data builders for the services, insights and legal pages. They are pure (the site origin is a parameter)
 * so they can be unit tested; `<JsonLd>` from `@/lib/seo` renders the result. Every page emits one `@graph`, as the
 * prototype's syncMeta did; the firm itself (`#firm`) comes from the site layout (lib/home/jsonld.ts) and is referenced by id.
 */

type Json = Record<string, unknown>;

export interface Crumb {
  name: string;
  /** unprefixed path, "/" for home */
  path: string;
}

export const firmId = (origin: string): string => `${origin.replace(/\/$/, '')}/#firm`;

/** The prototype's `cut`: collapse whitespace, then trim to `n` characters at a word boundary with an ellipsis. */
export function cutText(input: unknown, n: number): string {
  const s = String(input ?? '')
    .replace(/\s+/g, ' ')
    .trim();
  return s.length > n ? `${s.slice(0, n - 1).replace(/\s+\S*$/, '')}…` : s;
}

/** The prototype's `flat`: every string inside arrays and objects, joined by spaces. */
export function flatText(x: unknown): string {
  if (Array.isArray(x)) return x.map(flatText).join(' ');
  if (x && typeof x === 'object') return Object.values(x).map(flatText).join(' ');
  return String(x ?? '');
}

/** <meta name="description"> for a service page: the headline and the overview, 158 characters. */
export const serviceDescription = (s: Pick<Service, 'headline' | 'overview'>): string =>
  cutText(`${s.headline} ${flatText(s.overview)}`, 158);

/** <meta name="description"> for an article: its excerpt, 158 characters. */
export const articleDescription = (a: Pick<Article, 'excerpt'>): string => cutText(a.excerpt, 158);

const graph = (nodes: Json[]) => ({ '@context': 'https://schema.org', '@graph': nodes });

export function breadcrumbNode(origin: string, locale: Locale, crumbs: Crumb[]): Json {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((c, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: c.name,
      item: absoluteUrl(origin, locale, c.path),
    })),
  };
}

/** A page that only carries a breadcrumb trail (lists and legal pages). */
export function breadcrumbGraph(origin: string, locale: Locale, crumbs: Crumb[]) {
  return graph([breadcrumbNode(origin, locale, crumbs)]);
}

export interface ServiceJsonLdInput {
  origin: string;
  locale: Locale;
  service: Service;
  crumbs: Crumb[];
}

/** Service, FAQPage (only when the service has questions) and BreadcrumbList. */
export function serviceJsonLd({ origin, locale, service, crumbs }: ServiceJsonLdInput) {
  const url = absoluteUrl(origin, locale, `/services/${service.slug}`);
  const nodes: Json[] = [
    {
      '@type': 'Service',
      '@id': `${url}#service`,
      name: service.name,
      serviceType: service.kicker,
      description: cutText(flatText(service.overview), 500),
      url,
      provider: { '@id': firmId(origin) },
      areaServed: 'Worldwide',
    },
  ];
  if (service.faq.length) {
    nodes.push({
      '@type': 'FAQPage',
      '@id': `${url}#faq`,
      inLanguage: locale,
      mainEntity: service.faq.map((f) => ({
        '@type': 'Question',
        name: f.q,
        acceptedAnswer: { '@type': 'Answer', text: f.a },
      })),
    });
  }
  nodes.push(breadcrumbNode(origin, locale, crumbs));
  return graph(nodes);
}

export interface ArticleJsonLdInput {
  origin: string;
  locale: Locale;
  article: Article;
  crumbs: Crumb[];
  /** absolute URL of the share image */
  image: string;
}

/**
 * Article and BreadcrumbList. The publication date is ISO and is read from the English article of the same slug, so
 * the Hebrew page reports the same date (and never has to parse Hebrew text).
 */
export function articleJsonLd({ origin, locale, article, crumbs, image }: ArticleJsonLdInput) {
  const url = absoluteUrl(origin, locale, `/insights/${article.slug}`);
  const date = articleIsoDate(article.slug, article.date) ?? parseArticleDate(article.date) ?? undefined;
  return graph([
    {
      '@type': 'Article',
      '@id': `${url}#article`,
      headline: article.title,
      description: cutText(article.excerpt, 300),
      inLanguage: locale,
      datePublished: date,
      dateModified: date,
      author: { '@type': 'Organization', name: article.author },
      publisher: { '@id': firmId(origin) },
      mainEntityOfPage: url,
      image,
    },
    breadcrumbNode(origin, locale, crumbs),
  ]);
}
