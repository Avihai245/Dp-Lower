import type { Metadata } from 'next';
import { hasLocale } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { ContactPage } from '@/components/pages/ContactPage';
import { staticPageBreadcrumbs, staticPageMetadata } from '@/components/pages/seo';
import { routing } from '@/i18n/routing';
import { JsonLd } from '@/lib/seo';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  return staticPageMetadata(locale, 'contact');
}

export default async function Contact({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  return (
    <>
      <JsonLd data={await staticPageBreadcrumbs(locale, 'contact')} />
      <ContactPage locale={locale} />
    </>
  );
}
