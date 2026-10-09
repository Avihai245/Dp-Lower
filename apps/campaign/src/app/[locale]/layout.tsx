import { dirOf, type Locale } from '@dpl/core';
import { RevealObserver } from '@dpl/ui';
import type { Metadata, Viewport } from 'next';
import { hasLocale } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { ClientMessages } from '@/components/ClientMessages';
import { routing } from '@/i18n/routing';

import '@fontsource-variable/manrope';
import '@fontsource-variable/newsreader/opsz.css';
import '@fontsource-variable/newsreader/opsz-italic.css';
import '@fontsource-variable/frank-ruhl-libre';
import '@fontsource-variable/assistant';
import '@dpl/ui/fonts.css';
import '@dpl/ui/base.css';
import '@dpl/ui/hover.css';
import '../globals.css';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3001';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  applicationName: 'Decker Pex Levi',
  icons: { icon: { url: '/images/DPL_logo.webp', type: 'image/webp' } },
  openGraph: { type: 'website', siteName: 'Decker Pex Levi Law Offices' },
  twitter: { card: 'summary_large_image' },
};

export const viewport: Viewport = { themeColor: '#14202b', width: 'device-width', initialScale: 1 };

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({ children, params }: { children: ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  return (
    <html lang={locale} dir={dirOf(locale as Locale)}>
      <head>
        {/* without JavaScript nothing would ever reveal, so show everything */}
        <noscript>
          <style>{`[data-reveal],[data-reveal-img],[data-stagger]>*,[data-hero-seq]>*{opacity:1!important;transform:none!important;clip-path:none!important;animation:none!important}`}</style>
        </noscript>
      </head>
      <body>
        <ClientMessages namespaces={['common']}>
          <RevealObserver />
          {children}
        </ClientMessages>
      </body>
    </html>
  );
}
