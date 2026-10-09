import type { Locale } from '@dpl/core';
import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { BookingPicker } from '@/components/funnel/BookingPicker';
import { pageMetadata } from '@/lib/seo';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'funnel' });
  return pageMetadata({ locale: locale as Locale, path: '/booking', title: t('meta.booking.title'), description: t('meta.booking.description'), noindex: true });
}

export default async function BookingPage({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale);
  return <BookingPicker />;
}
