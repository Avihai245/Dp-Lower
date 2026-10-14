import { setRequestLocale } from 'next-intl/server';
import type { ReactNode } from 'react';
import { ClientMessages } from '@/components/ClientMessages';
import '@/styles/landing.css';

/**
 * The public landing page. Its Client Components (header, reviews, chat, advisor modal, mobile bar) read these
 * namespaces; `funnel` is here because the chat asks the eligibility questions.
 *
 * setRequestLocale must run in every layout and page before any next-intl call: layouts and pages render independently,
 * and without it getMessages() reads the request headers, which turns the whole page dynamic (no static HTML, no CDN cache).
 */
export default async function SiteLayout({ children, params }: { children: ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <ClientMessages namespaces={['landing', 'landingMore', 'common', 'funnel']}>{children}</ClientMessages>;
}
