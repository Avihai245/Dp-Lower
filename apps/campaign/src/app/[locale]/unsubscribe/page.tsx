import type { Locale } from '@dpl/core';
import { readUnsubscribeToken } from '@dpl/db/links';
import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ClientMessages } from '@/components/ClientMessages';
import { UnsubscribeConfirm } from '@/components/funnel/UnsubscribeConfirm';
import { pageMetadata } from '@/lib/seo';
import '@/styles/funnel.css';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'auth' });
  return pageMetadata({ locale: locale as Locale, path: '/unsubscribe', title: t('meta.unsubscribe.title'), description: t('meta.unsubscribe.description'), noindex: true });
}

/**
 * The link at the bottom of every nurture email. GET only shows a confirmation; the button on this page POSTs the
 * token to /api/unsubscribe. Opening the link never unsubscribes anybody, so mail scanners and link previews are harmless.
 */
export default async function UnsubscribePage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ t?: string | string[] }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const raw = (await searchParams).t;
  const token = Array.isArray(raw) ? raw[0] : raw;
  const valid = token ? await readUnsubscribeToken(token) : null;
  const t = await getTranslations({ locale, namespace: 'auth' });
  return (
    <ClientMessages namespaces={['auth']}>
      <UnsubscribeConfirm token={valid ? token! : null} logoAlt={t('brand.logoAlt')} />
    </ClientMessages>
  );
}
