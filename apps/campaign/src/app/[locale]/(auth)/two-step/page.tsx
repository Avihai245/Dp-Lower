import { DEFAULT_LOCALE, type Locale } from '@dpl/core';
import { safeNext } from '@dpl/db/links';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { TwoStepPanel } from '@/components/auth/TwoStepPanel';
import { redirect } from '@/i18n/navigation';
import { pageMetadata } from '@/lib/seo';
import { hasVerifiedTotp, resolveStaff, secondStepRequired } from '@/server/staff';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'auth' });
  return pageMetadata({ locale: locale as Locale, path: '/two-step', title: t('meta.twoStep.title'), description: t('meta.twoStep.description'), noindex: true });
}

export const dynamic = 'force-dynamic';

const first = (v: string | string[] | undefined): string | undefined => (Array.isArray(v) ? v[0] : v);

/**
 * Where a staff member turns two-step verification on or off. Reachable for staff who are fully signed in, and for staff the
 * firm requires to enrol before they may go on (STAFF_MFA_REQUIRED); someone who owes the code of an app they already
 * have must give it first (/verify), so a stolen password cannot switch the protection off.
 */
export default async function TwoStepPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const next = safeNext(first((await searchParams).next), '/admin');
  const access = await resolveStaff();
  if (access.kind === 'anonymous') redirect({ href: `/sign-in?next=${encodeURIComponent(locale === DEFAULT_LOCALE ? '/two-step' : `/${locale}/two-step`)}`, locale });
  // (redirect() has already thrown for an anonymous visitor; this only tells the type checker)
  if (access.kind === 'forbidden' || access.kind === 'anonymous') notFound();
  if (access.kind === 'second-step' && access.step === 'verify') redirect({ href: `/verify?next=${encodeURIComponent('/two-step')}`, locale });
  const t = await getTranslations({ locale, namespace: 'auth' });
  return <TwoStepPanel enrolled={hasVerifiedTotp(access.user)} required={secondStepRequired()} next={next} logoAlt={t('brand.logoAlt')} />;
}
