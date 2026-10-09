import { hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { InsightsIndex } from '@/components/insights/InsightsIndex';
import { routing } from '@/i18n/routing';
import { breadcrumbGraph } from '@/lib/jsonld';
import { JsonLd, pageMetadata, SITE_URL } from '@/lib/seo';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const t = await getTranslations({ locale, namespace: 'seo' });
  return pageMetadata({ locale, path: '/insights', title: t('pages.insights.title'), description: t('pages.insights.description') });
}

export default async function InsightsPage({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'seo' });
  return (
    <>
      <JsonLd
        data={breadcrumbGraph(SITE_URL, locale, [
          { name: t('pages.home.name'), path: '/' },
          { name: t('pages.insights.name'), path: '/insights' },
        ])}
      />
      <InsightsIndex locale={locale} />
    </>
  );
}
