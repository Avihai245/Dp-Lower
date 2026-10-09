import { createServerSupabase } from '@dpl/db/server';
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
import { SourceCapture } from '@/components/landing/SourceCapture';
import { StatStrip } from '@/components/landing/StatStrip';
import { LandingUiProvider } from '@/components/landing/ui-context';
import { WhyApplies } from '@/components/landing/WhyApplies';
import { Link } from '@/i18n/navigation';
import { entryNeedsSession, entryTarget, firstParam } from '@/lib/landing-entry';
import { landingJsonLd } from '@/lib/landing-seo';
import { JsonLd, SITE_URL, pageMetadata } from '@/lib/seo';

type Search = Record<string, string | string[] | undefined>;
interface Props {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Search>;
}

/** The firm's own website: where the LegalService entity (the same @id as on that site) lives. */
const MAIN_URL = process.env.NEXT_PUBLIC_MAIN_SITE_URL ?? 'https://www.lawoffice.org.il';

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'landing.meta' });
  // a deep link (?entry=...) only forwards the visitor: it must not compete with the real page in search results
  const forwarding = entryTarget(firstParam((await searchParams).entry), false) !== null;
  return pageMetadata({
    locale: locale as Locale,
    path: '/',
    title: t('title'),
    description: t('description'),
    image: '/images/pic1.webp',
    noindex: forwarding,
  });
}

/** True when the browser carries a valid Supabase session (only asked for sign-in / portal deep links). */
async function hasSession(): Promise<boolean> {
  try {
    const supabase = await createServerSupabase();
    const { data } = await supabase.auth.getUser();
    return Boolean(data.user);
  } catch {
    return false;
  }
}

export default async function Landing({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const search = await searchParams;

  // Platform deep links: ?entry=eligibility | signin | portal (&source=...). The client component records the origin of
  // the visit and then replaces the URL; the destination is decided here, where the session can be checked.
  const entry = firstParam(search.entry);
  const target = entryTarget(entry, entryNeedsSession(entry) ? await hasSession() : false);
  if (target) {
    const tc = await getTranslations('common');
    return (
      <main style={s("min-height: 100vh; display: grid; place-items: center; background: #f8f5f0; color: #736d64; font-family: 'Manrope', system-ui, sans-serif; font-size: 15px")}>
        <SourceCapture redirectTo={target} />
        <p role="status">{tc('redirecting')}</p>
        <noscript>
          <Link href={target}>{tc('redirecting')}</Link>
        </noscript>
      </main>
    );
  }

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
      <SourceCapture />
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
