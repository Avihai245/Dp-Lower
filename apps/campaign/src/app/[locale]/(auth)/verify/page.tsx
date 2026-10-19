import { DEFAULT_LOCALE, type Locale } from '@dpl/core';
import { safeNext } from '@dpl/db/links';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { VerifyForm } from '@/components/auth/VerifyForm';
import { redirect } from '@/i18n/navigation';
import { pageMetadata } from '@/lib/seo';
import { resolveStaff } from '@/server/staff';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'auth' });
  return pageMetadata({ locale: locale as Locale, path: '/verify', title: t('meta.verify.title'), description: t('meta.verify.description'), noindex: true });
}

export const dynamic = 'force-dynamic';

const first = (v: string | string[] | undefined): string | undefined => (Array.isArray(v) ? v[0] : v);

/**
 * The second step of a staff sign-in: the code of the authenticator app. Only a staff member whose session still owes it
 * sees the form; everybody else is sent where they belong (nothing here advertises itself to a visitor).
 */
export default async function VerifyPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const next = safeNext(first((await searchParams).next), '/admin');
  const access = await resolveStaff();
  if (access.kind === 'anonymous') redirect({ href: `/sign-in?next=${encodeURIComponent(locale === DEFAULT_LOCALE ? next : `/${locale}${next}`)}`, locale });
  if (access.kind === 'forbidden') notFound();
  // nothing left to verify: carry on
  if (access.kind === 'staff') redirect({ href: next, locale });
  // the firm requires enrolment and this member has none yet: there is no code to type, set it up first
  if (access.kind === 'second-step' && access.step === 'enroll') redirect({ href: `/two-step?next=${encodeURIComponent(next)}`, locale });
  const t = await getTranslations({ locale, namespace: 'auth' });
  return <VerifyForm next={next} logoAlt={t('brand.logoAlt')} />;
}
