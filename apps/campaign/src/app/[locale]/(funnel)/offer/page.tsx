import type { Locale } from '@dpl/core';
import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { OfferView } from '@/components/funnel/OfferView';
import { pageMetadata } from '@/lib/seo';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'funnel' });
  return pageMetadata({ locale: locale as Locale, path: '/offer', title: t('meta.offer.title'), description: t('meta.offer.description'), noindex: true });
}

export default async function OfferPage({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale);
  return <OfferView />;
}
