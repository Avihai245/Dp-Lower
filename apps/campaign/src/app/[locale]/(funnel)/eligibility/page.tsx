import type { Locale } from '@dpl/core';
import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { EligibilityQuiz } from '@/components/funnel/EligibilityQuiz';
import { pageMetadata } from '@/lib/seo';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'funnel' });
  return pageMetadata({ locale: locale as Locale, path: '/eligibility', title: t('meta.eligibility.title'), description: t('meta.eligibility.description'), noindex: true });
}

export default async function EligibilityPage({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale);
  return <EligibilityQuiz />;
}
