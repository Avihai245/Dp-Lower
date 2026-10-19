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
  return (
    <ClientMessages namespaces={['landing', 'landingMore', 'common', 'funnel']}>
      {/* the figures count up from 0 with scripts: without them show the final value (the text kept for screen readers) instead of "0+" */}
      <noscript>
        <style>{`[data-count] [aria-hidden="true"]{display:none!important}[data-count] .dpl-sr-only{position:static!important;width:auto!important;height:auto!important;margin:0!important;overflow:visible!important;clip:auto!important;white-space:nowrap!important;direction:ltr!important;font-family:var(--font-serif)!important;font-size:clamp(38px,3.4vw,54px)!important;line-height:1!important;color:#14202b!important}`}</style>
      </noscript>
      {children}
    </ClientMessages>
  );
}
