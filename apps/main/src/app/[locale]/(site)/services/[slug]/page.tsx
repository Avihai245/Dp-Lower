import { getService, SERVICE_SLUGS } from '@dpl/i18n';
import { hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { ServiceDetail } from '@/components/services/ServiceDetail';
import { routing } from '@/i18n/routing';
import { serviceDescription, serviceJsonLd } from '@/lib/jsonld';
import { JsonLd, pageMetadata, SITE_URL } from '@/lib/seo';

type Props = { params: Promise<{ locale: string; slug: string }> };

/** 22 services in both languages, prerendered. */
export function generateStaticParams() {
  return routing.locales.flatMap((locale) => SERVICE_SLUGS.map((slug) => ({ locale, slug })));
}

export async function generateMetadata({ params }: Props) {
  const { locale, slug } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const service = getService(locale, slug);
  if (!service) return {};
  const t = await getTranslations({ locale, namespace: 'seo' });
  return pageMetadata({
    locale,
    path: `/services/${slug}`,
    title: `${service.name} | ${t('brand')}`,
    description: serviceDescription(service),
  });
}

export default async function ServicePage({ params }: Props) {
  const { locale, slug } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const service = getService(locale, slug);
  if (!service) notFound();

  const t = await getTranslations({ locale, namespace: 'seo' });
  const jsonLd = serviceJsonLd({
    origin: SITE_URL,
    locale,
    service,
    crumbs: [
      { name: t('pages.home.name'), path: '/' },
      { name: t('pages.services.name'), path: '/services' },
      { name: service.name, path: `/services/${slug}` },
    ],
  });

  return (
    <>
      <JsonLd data={jsonLd} />
      <ServiceDetail service={service} locale={locale} />
    </>
  );
}
