import type { Locale } from '@dpl/core';
import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { LinkExpiredForm } from '@/components/funnel/LinkExpiredForm';
import { pageMetadata } from '@/lib/seo';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'auth' });
  return pageMetadata({ locale: locale as Locale, path: '/link-expired', title: t('meta.linkExpired.title'), description: t('meta.linkExpired.description'), noindex: true });
}

/** Landing page for an emailed /go link that is invalid, expired or replaced by a newer one. */
export default async function LinkExpiredPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'auth' });
  return <LinkExpiredForm logoAlt={t('brand.logoAlt')} />;
}
