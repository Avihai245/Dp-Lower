import { hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { routing } from '@/i18n/routing';
import { breadcrumbGraph } from '@/lib/jsonld';
import { JsonLd, pageMetadata, SITE_URL } from '@/lib/seo';
import { LegalPage, type LegalDoc } from './LegalPage';

/** Shared bodies of the three legal route files (/privacy, /terms, /accessibility). */

export async function legalMetadata(doc: LegalDoc, locale: string): Promise<Metadata> {
  if (!hasLocale(routing.locales, locale)) return {};
  const t = await getTranslations({ locale, namespace: 'seo' });
  return pageMetadata({
    locale,
    path: `/${doc}`,
    title: t(`pages.${doc}.title`),
    description: t(`pages.${doc}.description`),
  });
}

export async function renderLegal(doc: LegalDoc, locale: string) {
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'seo' });
  return (
    <>
      <JsonLd
        data={breadcrumbGraph(SITE_URL, locale, [
          { name: t('pages.home.name'), path: '/' },
          { name: t(`pages.${doc}.name`), path: `/${doc}` },
        ])}
      />
      <LegalPage doc={doc} locale={locale} />
    </>
  );
}
