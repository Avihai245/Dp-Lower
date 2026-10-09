import type { Article, Service, ServiceGroup } from '@dpl/i18n';

/**
 * Structure of the site navigation (pure data and helpers, no translations): the six header entries, the five mega
 * menus, the footer page list and the rule that decides which header entry is highlighted for a path. Labels come
 * from the `site` messages and the service / article names from @dpl/i18n content, assembled in `buildMenus`.
 */

/** Entries that open a mega menu under the header. */
export const MENU_KEYS = ['about', 'passports', 'israel', 'other', 'insights'] as const;
export type MenuKey = (typeof MENU_KEYS)[number];
export type NavKey = MenuKey | 'contact';

export interface NavEntry {
  key: NavKey;
  /** the page of a plain entry, and where the mobile navigation sends the others */
  href: string;
  /** the mega menu the entry opens, none for a plain link */
  menu: MenuKey | null;
}

export const NAV: readonly NavEntry[] = [
  { key: 'about', href: '/about', menu: 'about' },
  { key: 'passports', href: '/services', menu: 'passports' },
  { key: 'israel', href: '/services', menu: 'israel' },
  { key: 'other', href: '/services', menu: 'other' },
  { key: 'insights', href: '/insights', menu: 'insights' },
  { key: 'contact', href: '/contact', menu: null },
];

/** Where the call to action in the left column of each mega menu goes. */
export const MENU_CTA_HREF: Record<MenuKey, string> = {
  about: '/about',
  passports: '/services',
  israel: '/services',
  other: '/services',
  insights: '/insights',
};

/** Fixed entries of the "about" menu. `href: null` is the client portal, which lives on the campaign site. */
export const ABOUT_MENU_ITEMS = [
  { id: 'about', href: '/about' },
  { id: 'team', href: '/team' },
  { id: 'stories', href: '/testimonials' },
  { id: 'recognition', href: '/about' },
  { id: 'offices', href: '/contact' },
  { id: 'portal', href: null },
] as const;

export const INSIGHTS_MENU_ITEMS = [
  { id: 'center', href: '/insights' },
  { id: 'media', href: '/media' },
] as const;

/** The "insights" menu lists the newest articles after its two fixed entries. */
export const INSIGHTS_MENU_ARTICLES = 4;

export const FOOTER_PAGES = [
  { id: 'about', href: '/about' },
  { id: 'team', href: '/team' },
  { id: 'services', href: '/services' },
  { id: 'testimonials', href: '/testimonials' },
  { id: 'insights', href: '/insights' },
  { id: 'media', href: '/media' },
  { id: 'contact', href: '/contact' },
] as const;

export interface MenuLink {
  name: string;
  note: string;
  href: string;
  /** an absolute URL on another site (the campaign app): rendered as a plain anchor */
  external?: boolean;
}

export interface MegaMenu {
  title: string;
  lede: string;
  cta: string;
  ctaHref: string;
  items: MenuLink[];
}

/** Text lookups the menus need, so this module stays independent of the translation library. */
export interface MenuTexts {
  title(menu: MenuKey): string;
  lede(menu: MenuKey): string;
  cta(menu: MenuKey): string;
  item(menu: 'about' | 'insights', id: string): { name: string; note: string };
}

export const serviceHref = (slug: string): string => `/services/${slug}`;
export const articleHref = (slug: string): string => `/insights/${slug}`;

export function serviceMenuItems(services: readonly Service[], group: ServiceGroup): MenuLink[] {
  return services.filter((s) => s.group === group).map((s) => ({ name: s.name, note: s.note, href: serviceHref(s.slug) }));
}

export function insightsMenuArticles(articles: readonly Article[]): MenuLink[] {
  return articles.slice(0, INSIGHTS_MENU_ARTICLES).map((a) => ({ name: a.title, note: a.cat, href: articleHref(a.slug) }));
}

export function buildMenus(
  content: { services: readonly Service[]; articles: readonly Article[] },
  texts: MenuTexts,
  portalHref: string,
): Record<MenuKey, MegaMenu> {
  const frame = (menu: MenuKey, items: MenuLink[]): MegaMenu => ({
    title: texts.title(menu),
    lede: texts.lede(menu),
    cta: texts.cta(menu),
    ctaHref: MENU_CTA_HREF[menu],
    items,
  });
  return {
    about: frame(
      'about',
      ABOUT_MENU_ITEMS.map((it) => ({
        ...texts.item('about', it.id),
        href: it.href ?? portalHref,
        ...(it.href === null ? { external: true } : {}),
      })),
    ),
    passports: frame('passports', serviceMenuItems(content.services, 'passports')),
    israel: frame('israel', serviceMenuItems(content.services, 'israel')),
    other: frame('other', serviceMenuItems(content.services, 'other')),
    insights: frame('insights', [
      ...INSIGHTS_MENU_ITEMS.map((it) => ({ ...texts.item('insights', it.id), href: it.href })),
      ...insightsMenuArticles(content.articles),
    ]),
  };
}

/**
 * Which header entry is highlighted for a path (locale prefix already removed), or null. The three service entries
 * share /services: the list page lights "Passports", a service page lights the entry of its own group.
 */
export function activeNav(pathname: string, groupOf: (slug: string) => ServiceGroup | undefined): NavKey | null {
  const [first, second] = pathname.split('/').filter(Boolean);
  switch (first) {
    case 'about':
    case 'team':
    case 'testimonials':
      return 'about';
    case 'services':
      return (second ? groupOf(second) : undefined) ?? 'passports';
    case 'insights':
    case 'media':
      return 'insights';
    case 'contact':
      return 'contact';
    default:
      return null;
  }
}

/** slug -> group lookup passed to the client header (22 short entries). */
export const serviceGroups = (services: readonly Service[]): Record<string, ServiceGroup> =>
  Object.fromEntries(services.map((s) => [s.slug, s.group]));
