import type { Locale } from '@dpl/core';
import { getTranslations } from 'next-intl/server';
import { breadcrumbJsonLd, pageMetadata } from '@/lib/seo';

/** The pages of this part that have a fixed title and description (the prototype's per-page STATIC map). */
export type StaticPageKey = 'about' | 'team' | 'testimonials' | 'media' | 'contact';

/** Title, description, canonical, hreflang, Open Graph and Twitter card of a static page. Texts live in pages.json (meta). */
export async function staticPageMetadata(locale: Locale, key: StaticPageKey) {
  const t = await getTranslations({ locale, namespace: 'pages' });
  return pageMetadata({
    locale,
    path: `/${key}`,
    title: t(`meta.${key}.title`),
    description: t(`meta.${key}.description`),
  });
}

/** BreadcrumbList: Home > the page. */
export async function staticPageBreadcrumbs(locale: Locale, key: StaticPageKey) {
  const t = await getTranslations({ locale, namespace: 'pages' });
  return breadcrumbJsonLd(locale, [
    { name: t('breadcrumbs.home'), path: '/' },
    { name: t(`breadcrumbs.${key}`), path: `/${key}` },
  ]);
}
