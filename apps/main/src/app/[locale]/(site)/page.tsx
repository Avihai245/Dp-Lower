import type { Locale } from '@dpl/core';
import { s } from '@dpl/ui';
import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { LegacyHash } from '@/components/LegacyHash';
import { AuthorityStrip } from '@/components/home/AuthorityStrip';
import { Countries } from '@/components/home/Countries';
import { Hero } from '@/components/home/Hero';
import { Intro } from '@/components/home/Intro';
import { LatestArticles } from '@/components/home/LatestArticles';
import { LawBlock } from '@/components/home/LawBlock';
import { Offices } from '@/components/home/Offices';
import { Reviews } from '@/components/home/Reviews';
import { Stages } from '@/components/home/Stages';
import { TeamBand } from '@/components/home/TeamBand';
import { pageMetadata } from '@/lib/seo';

type Params = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'home' });
  return pageMetadata({ locale: locale as Locale, path: '/', title: t('meta.title'), description: t('meta.description') });
}

export default async function HomePage({ params }: Params) {
  const { locale: requested } = await params;
  setRequestLocale(requested);
  const locale = requested as Locale;

  return (
    <>
      <LegacyHash />
      <div style={s('animation: fadeIn 280ms ease both')}>
        <Hero locale={locale} />
        <AuthorityStrip />
        <Intro />
        <Countries locale={locale} />
        <LawBlock locale={locale} />
        <Stages />
        <TeamBand locale={locale} />
        <Reviews />
        <LatestArticles locale={locale} />
        <Offices locale={locale} />
      </div>
    </>
  );
}
