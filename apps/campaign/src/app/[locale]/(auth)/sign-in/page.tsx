import type { Locale } from '@dpl/core';
import { createAdminSupabase } from '@dpl/db/admin';
import { getCookieLead } from '@dpl/db/lead-session';
import { safeNext } from '@dpl/db/links';
import { createServerSupabase } from '@dpl/db/server';
import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { cookies } from 'next/headers';
import { SignInForm } from '@/components/funnel/SignInForm';
import { parseSource, SRC_COOKIE } from '@/components/funnel/logic/first-touch';
import { redirect } from '@/i18n/navigation';
import { pageMetadata } from '@/lib/seo';
import { isStaffUser } from '@/server/auth';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'auth' });
  return pageMetadata({ locale: locale as Locale, path: '/sign-in', title: t('meta.signIn.title'), description: t('meta.signIn.description'), noindex: true });
}

const first = (v: string | string[] | undefined): string | undefined => (Array.isArray(v) ? v[0] : v);

/** Applicant and staff sign in. `?next=` (validated with safeNext) says where to go afterwards; `?error=` shows why we are back. */
export default async function SignInPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;
  const rawNext = first(sp.next);
  const next = rawNext ? safeNext(rawNext) : null;
  const error = first(sp.error) === 'link' || first(sp.error) === 'oauth' ? (first(sp.error) as 'link' | 'oauth') : null;

  // already signed in: nothing to ask, carry on (unless we were sent back here with an error to show)
  if (!error) {
    const {
      data: { user },
    } = await (await createServerSupabase()).auth.getUser();
    if (user) {
      const staff = await isStaffUser(createAdminSupabase(), user.id);
      redirect({ href: next ?? (staff ? '/admin' : '/portal'), locale });
    }
  }

  // somebody who came from the firm's own website goes back there, everybody else to this campaign's landing page
  const source = parseSource((await cookies()).get(SRC_COOKIE)?.value);
  const mainSiteUrl = source === 'main-site' ? (process.env.NEXT_PUBLIC_MAIN_SITE_URL ?? 'http://localhost:3000') : null;
  // a browser that holds a lead (somebody who just finished the funnel) starts with its own email filled in
  const lead = await getCookieLead(createAdminSupabase());
  const known = lead ? { email: lead.email, accountCreated: !!lead.account_created_at, passwordSet: !!lead.password_set_at } : null;
  const t = await getTranslations({ locale, namespace: 'auth' });

  return <SignInForm next={next} error={error} mainSiteUrl={mainSiteUrl} known={known} logoAlt={t('brand.logoAlt')} />;
}
