import type { Locale } from '@dpl/core';
import { safeNext } from '@dpl/db/links';
import { s } from '@dpl/ui';
import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { AUTH_BUTTON, AUTH_H1, AUTH_KICKER, AuthShell } from '@/components/funnel/AuthShell';
import { localizePath } from '@/components/funnel/logic/paths';
import { redirect } from '@/i18n/navigation';
import { pageMetadata } from '@/lib/seo';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'auth' });
  return pageMetadata({ locale: locale as Locale, path: '/open-link', title: t('meta.openLink.title'), description: t('meta.openLink.description'), noindex: true });
}

/**
 * The confirmation step in front of emailed links (see inspectEmailLink / the callback route): a link that does something
 * irreversible is only followed by a person pressing a button, because mail security scanners "click" every link with a
 * GET. `t` is a portal link token, `r` a password-reset token. The button is a plain form POST, so it works without JS.
 */
export default async function OpenLinkPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ t?: string; r?: string; next?: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { t: portalToken, r: resetToken, next } = await searchParams;
  if (!portalToken && !resetToken) redirect({ href: '/link-expired', locale: locale as Locale });

  const t = await getTranslations({ locale, namespace: 'auth' });
  const kind = portalToken ? 'portal' : 'reset';
  const action = portalToken
    ? localizePath(`/go/${encodeURIComponent(portalToken)}`, locale as Locale)
    : localizePath('/auth/callback', locale as Locale);

  return (
    <AuthShell logoAlt={t('brand.logoAlt')} width={460} header={null}>
      <div style={s(AUTH_KICKER)}>{t('openLink.kicker')}</div>
      <h1 data-h1 style={s(AUTH_H1)}>{t(`openLink.${kind}.title`)}</h1>
      <p style={s('font-size: 15.5px; line-height: 1.65; color: #736d64; margin: 0 0 26px')}>{t(`openLink.${kind}.lede`)}</p>
      <form method="post" action={action}>
        {resetToken && (
          <>
            <input type="hidden" name="token_hash" value={resetToken} />
            <input type="hidden" name="type" value="recovery" />
            {next && <input type="hidden" name="next" value={safeNext(next, '/portal')} />}
          </>
        )}
        <button type="submit" className="btn" style={s(AUTH_BUTTON)}>
          {t(`openLink.${kind}.submit`)}
        </button>
      </form>
    </AuthShell>
  );
}
