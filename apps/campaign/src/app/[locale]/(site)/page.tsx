import { s } from '@dpl/ui';
import type { Locale } from '@dpl/core';
import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { preload } from 'react-dom';
import { Attorneys } from '@/components/landing/Attorneys';
import { Benefits } from '@/components/landing/Benefits';
import { CaseStudy } from '@/components/landing/CaseStudy';
import { Header } from '@/components/landing/Header';
import { Hero } from '@/components/landing/Hero';
import {
  AdvisorModal,
  ChatWidget,
  CtaBand,
  Faq,
  Fees,
  FinalCta,
  LandingFooter,
  MobileCta,
  Process,
  TeamPhoto,
  VideoSection,
  WhyUs,
} from '@/components/landing/more';
import { Reputation } from '@/components/landing/Reputation';
import { Routes } from '@/components/landing/Routes';
import { StatStrip } from '@/components/landing/StatStrip';
import { LandingUiProvider } from '@/components/landing/ui-context';
import { WhyApplies } from '@/components/landing/WhyApplies';
import { landingJsonLd } from '@/lib/landing-seo';
import { JsonLd, SITE_URL, pageMetadata } from '@/lib/seo';

interface Props {
  params: Promise<{ locale: string }>;
}

/** The firm's own website: where the LegalService entity (the same @id as on that site) lives. */
const MAIN_URL = process.env.NEXT_PUBLIC_MAIN_SITE_URL ?? 'https://www.lawoffice.org.il';

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'landing.meta' });
  return pageMetadata({
    locale: locale as Locale,
    path: '/',
    title: t('title'),
    description: t('description'),
    image: '/images/pic1.webp',
  });
}

/**
 * Static page (no request-time APIs). Platform deep links (?entry=...) and first-touch attribution cookies are handled by
 * src/middleware.ts before the page is served.
 */
export default async function Landing({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: 'landing.meta' });
  const tc = await getTranslations({ locale, namespace: 'common' });
  preload('/images/DPL_logo.webp', { as: 'image' });

  return (
    <LandingUiProvider>
      <JsonLd
        data={landingJsonLd({
          locale: locale as Locale,
          siteUrl: SITE_URL,
          mainUrl: MAIN_URL,
          serviceName: t('serviceName'),
          serviceType: t('serviceType'),
          offerDescription: t('offerDescription'),
        })}
      />
      <div style={s('min-height: 100vh; background: var(--color-bg)')}>
        <div className="dpl-landing" style={s("background: #f8f5f0; color: #23292f; font-family: 'Manrope', system-ui, sans-serif")}>
          <a className="dpl-skip" href="#main">
            {tc('skipToContent')}
          </a>
          <Header />
          <main id="main">
            <Hero />
            <StatStrip />
            <WhyApplies />
            <Routes />
            <Attorneys />
            <Reputation />
            <CaseStudy />
            <Benefits />
            <Process />
            <CtaBand />
            <TeamPhoto />
            <VideoSection />
            <WhyUs />
            <Fees />
            <Faq />
            <FinalCta />
          </main>
          <LandingFooter />
          <ChatWidget />
          <AdvisorModal />
          <MobileCta />
        </div>
      </div>
    </LandingUiProvider>
  );
}
