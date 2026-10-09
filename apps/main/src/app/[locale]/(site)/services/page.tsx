import { hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { ServicesIndex } from '@/components/services/ServicesIndex';
import { routing } from '@/i18n/routing';
import { breadcrumbGraph } from '@/lib/jsonld';
import { JsonLd, pageMetadata, SITE_URL } from '@/lib/seo';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const t = await getTranslations({ locale, namespace: 'seo' });
  return pageMetadata({ locale, path: '/services', title: t('pages.services.title'), description: t('pages.services.description') });
}

export default async function ServicesPage({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'seo' });
  return (
    <>
      <JsonLd
        data={breadcrumbGraph(SITE_URL, locale, [
          { name: t('pages.home.name'), path: '/' },
          { name: t('pages.services.name'), path: '/services' },
        ])}
      />
      <ServicesIndex locale={locale} />
    </>
  );
}
