import type { Locale } from '@dpl/core';
import { safeNext } from '@dpl/db/links';
import { createServerSupabase } from '@dpl/db/server';
import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { SetPasswordForm } from '@/components/funnel/SetPasswordForm';
import { redirect } from '@/i18n/navigation';
import { pageMetadata } from '@/lib/seo';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'auth' });
  return pageMetadata({ locale: locale as Locale, path: '/create-password', title: t('meta.createPassword.title'), description: t('meta.createPassword.description'), noindex: true });
}

const first = (v: string | string[] | undefined): string | undefined => (Array.isArray(v) ? v[0] : v);

/**
 * "Set a password." Needs a Supabase session: the email shown (read-only) is the signed-in account's, and the password
 * is set for that account. Without a session the visitor is sent to sign in and brought back here.
 * `?mode=reset` is the same screen after the emailed recovery link, whose callback has just opened the session.
 */
export default async function CreatePasswordPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;
  const mode = first(sp.mode) === 'reset' ? 'reset' : 'create';

  const {
    data: { user },
  } = await (await createServerSupabase()).auth.getUser();
  if (!user?.email) {
    redirect({ href: `/sign-in?next=${encodeURIComponent(mode === 'reset' ? '/create-password?mode=reset' : '/create-password')}`, locale });
  }

  const t = await getTranslations({ locale, namespace: 'auth' });
  return <SetPasswordForm email={user!.email!} mode={mode} next={safeNext(first(sp.next), '/portal')} logoAlt={t('brand.logoAlt')} />;
}
