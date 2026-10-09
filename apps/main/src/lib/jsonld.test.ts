import { absoluteUrl, ARTICLE_SLUGS, getArticle, getContent, getService, SERVICE_SLUGS } from '@dpl/i18n';
import { describe, expect, it } from 'vitest';
import {
  articleDescription,
  articleJsonLd,
  breadcrumbGraph,
  cutText,
  flatText,
  firmId,
  serviceDescription,
  serviceJsonLd,
} from './jsonld';

const ORIGIN = 'https://www.lawoffice.org.il';

interface Node {
  '@type': string;
  [key: string]: unknown;
}
const nodesOf = (doc: { '@graph': unknown[] }) => doc['@graph'] as Node[];
const typesOf = (doc: { '@graph': unknown[] }) => nodesOf(doc).map((n) => n['@type']);

describe('cutText / flatText', () => {
  it('leaves short text alone and collapses whitespace', () => {
    expect(cutText('  a   b\n c ', 50)).toBe('a b c');
    expect(cutText(undefined, 10)).toBe('');
  });

  it('cuts at a word boundary and never exceeds the limit', () => {
    const out = cutText('one two three four five six seven', 15);
    expect(out).toBe('one two three…');
    expect(out.length).toBeLessThanOrEqual(15);
    expect(cutText('x'.repeat(40), 10)).toBe('xxxxxxxxx…');
  });

  it('flattens nested arrays and objects', () => {
    expect(flatText(['a', ['b', { c: 'd' }], null, 3])).toBe('a b d  3');
  });
});

describe('meta descriptions', () => {
  it('are at most 158 characters for every service and article, in both languages', () => {
    for (const locale of ['en', 'he'] as const) {
      for (const s of getContent(locale).services) {
        const d = serviceDescription(s);
        expect(d.length, `${locale} ${s.slug}`).toBeLessThanOrEqual(158);
        expect(d.length).toBeGreaterThan(40);
      }
      for (const a of getContent(locale).articles) {
        const d = articleDescription(a);
        expect(d.length, `${locale} ${a.slug}`).toBeLessThanOrEqual(158);
        expect(d.length).toBeGreaterThan(40);
      }
    }
  });

  it('starts a service description with its headline, as the prototype does', () => {
    const s = getService('en', 'german-citizenship')!;
    expect(
      serviceDescription(s).startsWith(
        'German citizenship for the descendants of those who lost it. Germany restores',
      ),
    ).toBe(true);
  });
});

describe('serviceJsonLd', () => {
  const crumbs = (name: string, slug: string) => [
    { name: 'Home', path: '/' },
    { name: 'Practice areas', path: '/services' },
    { name, path: `/services/${slug}` },
  ];

  it('emits Service, FAQPage and BreadcrumbList for a service with questions', () => {
    const service = getService('en', 'german-citizenship')!;
    const doc = serviceJsonLd({
      origin: ORIGIN,
      locale: 'en',
      service,
      crumbs: crumbs(service.name, service.slug),
    });
    expect(doc['@context']).toBe('https://schema.org');
    expect(typesOf(doc)).toEqual(['Service', 'FAQPage', 'BreadcrumbList']);

    const [svc, faq, crumb] = nodesOf(doc) as [Node, Node, Node];
    const url = `${ORIGIN}/services/german-citizenship`;
    expect(svc).toMatchObject({
      '@id': `${url}#service`,
      name: 'German citizenship',
      serviceType: 'Citizenship by descent',
      url,
      provider: { '@id': firmId(ORIGIN) },
      areaServed: 'Worldwide',
    });
    expect((svc.description as string).length).toBeLessThanOrEqual(500);

    expect(faq['@id']).toBe(`${url}#faq`);
    const questions = faq.mainEntity as Array<{ name: string; acceptedAnswer: { text: string } }>;
    expect(questions).toHaveLength(service.faq.length);
    expect(questions[0]).toMatchObject({
      '@type': 'Question',
      name: service.faq[0]!.q,
      acceptedAnswer: { '@type': 'Answer', text: service.faq[0]!.a },
    });

    const items = crumb.itemListElement as Array<{ position: number; name: string; item: string }>;
    expect(items.map((i) => i.position)).toEqual([1, 2, 3]);
    expect(items.map((i) => i.item)).toEqual([`${ORIGIN}/`, `${ORIGIN}/services`, url]);
  });

  it('omits the FAQPage when a service has no questions', () => {
    const service = getService('en', 'portuguese-citizenship')!;
    expect(service.faq).toHaveLength(0);
    const doc = serviceJsonLd({
      origin: ORIGIN,
      locale: 'en',
      service,
      crumbs: crumbs(service.name, service.slug),
    });
    expect(typesOf(doc)).toEqual(['Service', 'BreadcrumbList']);
  });

  it('uses the /he URLs and Hebrew text for the Hebrew page', () => {
    const service = getService('he', 'austrian-citizenship')!;
    const doc = serviceJsonLd({
      origin: ORIGIN,
      locale: 'he',
      service,
      crumbs: [
        { name: 'דף הבית', path: '/' },
        { name: 'תחומי עיסוק', path: '/services' },
        { name: service.name, path: `/services/${service.slug}` },
      ],
    });
    const [svc, faq, crumb] = nodesOf(doc) as [Node, Node, Node];
    expect(svc.url).toBe(`${ORIGIN}/he/services/austrian-citizenship`);
    expect(svc.name).toBe('אזרחות אוסטרית');
    expect(faq.inLanguage).toBe('he');
    const items = crumb.itemListElement as Array<{ item: string }>;
    expect(items.map((i) => i.item)).toEqual([
      `${ORIGIN}/he`,
      `${ORIGIN}/he/services`,
      `${ORIGIN}/he/services/austrian-citizenship`,
    ]);
  });

  it('builds a serialisable document for all 22 services in both languages', () => {
    expect(SERVICE_SLUGS).toHaveLength(22);
    for (const locale of ['en', 'he'] as const) {
      for (const slug of SERVICE_SLUGS) {
        const service = getService(locale, slug)!;
        const doc = serviceJsonLd({
          origin: ORIGIN,
          locale,
          service,
          crumbs: [{ name: service.name, path: `/services/${slug}` }],
        });
        const json = JSON.stringify(doc);
        expect(json).not.toContain('undefined');
        expect(JSON.parse(json)).toEqual(doc);
        expect(typesOf(doc)).toContain('Service');
        expect(typesOf(doc).includes('FAQPage')).toBe(service.faq.length > 0);
      }
    }
  });
});

describe('articleJsonLd', () => {
  const image = `${ORIGIN}/images/Decker-Pex-Levi-Team-scaled.jpg.webp`;

  it('emits Article and BreadcrumbList with an ISO date', () => {
    const article = getArticle('en', 'german-citizenship-jewish-descent')!;
    const doc = articleJsonLd({
      origin: ORIGIN,
      locale: 'en',
      article,
      crumbs: [
        { name: 'Home', path: '/' },
        { name: 'Knowledge center', path: '/insights' },
        { name: article.title, path: `/insights/${article.slug}` },
      ],
      image,
    });
    expect(typesOf(doc)).toEqual(['Article', 'BreadcrumbList']);
    const art = nodesOf(doc)[0]!;
    const url = `${ORIGIN}/insights/german-citizenship-jewish-descent`;
    expect(art).toMatchObject({
      '@id': `${url}#article`,
      headline: 'German citizenship by Jewish descent',
      datePublished: '2026-06-15',
      dateModified: '2026-06-15',
      author: { '@type': 'Organization', name: 'Austria and Germany Department' },
      publisher: { '@id': firmId(ORIGIN) },
      mainEntityOfPage: url,
      image,
      inLanguage: 'en',
    });
  });

  it('reports the same ISO date for the Hebrew page and does not throw on Hebrew text (the prototype did)', () => {
    for (const slug of ARTICLE_SLUGS) {
      const en = getArticle('en', slug)!;
      const he = getArticle('he', slug)!;
      const build = (locale: 'en' | 'he') =>
        articleJsonLd({
          origin: ORIGIN,
          locale,
          article: locale === 'en' ? en : he,
          crumbs: [{ name: 'x', path: `/insights/${slug}` }],
          image,
        });
      const enArt = nodesOf(build('en'))[0]!;
      const heArt = nodesOf(build('he'))[0]!;
      expect(heArt.datePublished).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(heArt.datePublished).toBe(enArt.datePublished);
      expect(heArt.mainEntityOfPage).toBe(`${ORIGIN}/he/insights/${slug}`);
      expect(heArt.inLanguage).toBe('he');
      expect((heArt.description as string).length).toBeLessThanOrEqual(300);
    }
  });
});

describe('breadcrumbGraph', () => {
  it('wraps one BreadcrumbList with absolute, locale-aware URLs', () => {
    const doc = breadcrumbGraph(ORIGIN, 'he', [
      { name: 'דף הבית', path: '/' },
      { name: 'מדיניות פרטיות', path: '/privacy' },
    ]);
    expect(typesOf(doc)).toEqual(['BreadcrumbList']);
    const items = nodesOf(doc)[0]!.itemListElement as Array<{ item: string; position: number }>;
    expect(items).toEqual([
      { '@type': 'ListItem', position: 1, name: 'דף הבית', item: absoluteUrl(ORIGIN, 'he', '/') },
      { '@type': 'ListItem', position: 2, name: 'מדיניות פרטיות', item: `${ORIGIN}/he/privacy` },
    ]);
  });
});
