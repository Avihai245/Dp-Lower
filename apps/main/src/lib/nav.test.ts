import { getContent } from '@dpl/i18n';
import { describe, expect, it } from 'vitest';
import {
  ABOUT_MENU_ITEMS,
  activeNav,
  buildMenus,
  FOOTER_PAGES,
  INSIGHTS_MENU_ARTICLES,
  MENU_CTA_HREF,
  MENU_KEYS,
  NAV,
  serviceGroups,
  serviceHref,
  type MenuTexts,
} from './nav';

const texts: MenuTexts = {
  title: (m) => `title:${m}`,
  lede: (m) => `lede:${m}`,
  cta: (m) => `cta:${m}`,
  item: (m, id) => ({ name: `${m}.${id}.name`, note: `${m}.${id}.note` }),
};
const PORTAL = 'https://campaign.test/sign-in?source=main-site';

describe('header entries', () => {
  it('has the six entries of the design in order, five of them with a mega menu', () => {
    expect(NAV.map((n) => n.key)).toEqual(['about', 'passports', 'israel', 'other', 'insights', 'contact']);
    expect(NAV.filter((n) => n.menu).map((n) => n.menu)).toEqual([...MENU_KEYS]);
    expect(NAV.find((n) => n.key === 'contact')?.menu).toBeNull();
  });

  it('sends every entry to a page of the site', () => {
    for (const n of NAV) expect(n.href.startsWith('/')).toBe(true);
    expect(NAV.find((n) => n.key === 'contact')?.href).toBe('/contact');
    // the three service groups share the services page
    expect(NAV.filter((n) => ['passports', 'israel', 'other'].includes(n.key)).map((n) => n.href)).toEqual(['/services', '/services', '/services']);
  });

  it('has a call to action for every menu', () => {
    for (const m of MENU_KEYS) expect(MENU_CTA_HREF[m]).toMatch(/^\//);
  });
});

describe('mega menus built from the content', () => {
  for (const locale of ['en', 'he'] as const) {
    describe(locale, () => {
      const content = getContent(locale);
      const menus = buildMenus(content, texts, PORTAL);

      it('lists every service in the menu of its group (10 + 8 + 4 = 22)', () => {
        expect(menus.passports.items).toHaveLength(10);
        expect(menus.israel.items).toHaveLength(8);
        expect(menus.other.items).toHaveLength(4);
        const slugs = [...menus.passports.items, ...menus.israel.items, ...menus.other.items].map((i) => i.href);
        expect(new Set(slugs).size).toBe(22);
        for (const s of content.services) expect(slugs).toContain(serviceHref(s.slug));
      });

      it('uses the names and notes of the content for services', () => {
        const german = menus.passports.items.find((i) => i.href === '/services/german-citizenship');
        const sv = content.services.find((s) => s.slug === 'german-citizenship')!;
        expect(german).toEqual({ name: sv.name, note: sv.note, href: '/services/german-citizenship' });
      });

      it('about: six fixed entries, the portal being an external link', () => {
        expect(menus.about.items).toHaveLength(ABOUT_MENU_ITEMS.length);
        const portal = menus.about.items.find((i) => i.name === 'about.portal.name');
        expect(portal).toMatchObject({ href: PORTAL, external: true });
        expect(menus.about.items.filter((i) => i.external)).toHaveLength(1);
        expect(menus.about.items.map((i) => i.href).slice(0, 5)).toEqual(['/about', '/team', '/testimonials', '/about', '/contact']);
      });

      it('insights: knowledge center, media, then the newest articles', () => {
        const items = menus.insights.items;
        expect(items).toHaveLength(2 + INSIGHTS_MENU_ARTICLES);
        expect(items.slice(0, 2).map((i) => i.href)).toEqual(['/insights', '/media']);
        expect(items.slice(2).map((i) => i.href)).toEqual(content.articles.slice(0, INSIGHTS_MENU_ARTICLES).map((a) => `/insights/${a.slug}`));
        expect(items[2]).toMatchObject({ name: content.articles[0]!.title, note: content.articles[0]!.cat });
      });

      it('takes title, lede and call to action from the texts', () => {
        for (const m of MENU_KEYS) {
          expect(menus[m]).toMatchObject({ title: `title:${m}`, lede: `lede:${m}`, cta: `cta:${m}`, ctaHref: MENU_CTA_HREF[m] });
        }
      });
    });
  }
});

describe('activeNav', () => {
  const groups = serviceGroups(getContent('en').services);
  const at = (p: string) => activeNav(p, (slug) => groups[slug]);

  it('lights About for about, team, a team member and testimonials', () => {
    for (const p of ['/about', '/team', '/team/anat-levi', '/testimonials']) expect(at(p)).toBe('about');
  });

  it('lights the group of the service on a service page, Passports on the list', () => {
    expect(at('/services')).toBe('passports');
    expect(at('/services/german-citizenship')).toBe('passports');
    expect(at('/services/aliyah')).toBe('israel');
    expect(at('/services/notary-services')).toBe('other');
    // an unknown slug is a 404 inside the shell: same as the list
    expect(at('/services/no-such-service')).toBe('passports');
  });

  it('lights Insights for the knowledge center, articles and media, and Contact for contact', () => {
    for (const p of ['/insights', '/insights/employing-foreign-experts', '/media']) expect(at(p)).toBe('insights');
    expect(at('/contact')).toBe('contact');
  });

  it('lights nothing for the home page and the legal pages', () => {
    for (const p of ['/', '', '/privacy', '/terms', '/accessibility']) expect(at(p)).toBeNull();
  });

  it('ignores a trailing slash', () => {
    expect(at('/about/')).toBe('about');
  });
});

describe('footer and service groups', () => {
  it('lists the seven pages of the design', () => {
    expect(FOOTER_PAGES.map((p) => p.id)).toEqual(['about', 'team', 'services', 'testimonials', 'insights', 'media', 'contact']);
    for (const p of FOOTER_PAGES) expect(p.href).toBe(`/${p.id}`);
  });

  it('maps every service slug to its group', () => {
    const content = getContent('en');
    const groups = serviceGroups(content.services);
    expect(Object.keys(groups)).toHaveLength(22);
    expect(groups['german-citizenship']).toBe('passports');
    expect(groups['aliyah']).toBe('israel');
    expect(groups['inheritance-estates']).toBe('other');
  });
});
