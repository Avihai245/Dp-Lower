import type { Metadata } from 'next';
import { hasLocale } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { AboutPage } from '@/components/pages/AboutPage';
import { staticPageBreadcrumbs, staticPageMetadata } from '@/components/pages/seo';
import { routing } from '@/i18n/routing';
import { JsonLd } from '@/lib/seo';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  return staticPageMetadata(locale, 'about');
}

export default async function About({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  return (
    <>
      <JsonLd data={await staticPageBreadcrumbs(locale, 'about')} />
      <AboutPage locale={locale} />
    </>
  );
}
