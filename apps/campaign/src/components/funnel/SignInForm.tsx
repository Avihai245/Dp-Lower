'use client';
import { isEmail, type Locale } from '@dpl/core';
import { createBrowserSupabase } from '@dpl/db/browser';
import { s, x } from '@dpl/ui';
import { useLocale, useTranslations } from 'next-intl';
import { useState, type FormEvent } from 'react';
import { Link } from '@/i18n/navigation';
import { api } from '@/lib/api';
import { AUTH_BUTTON, AUTH_H1, AUTH_INPUT, AUTH_KICKER, AUTH_LABEL, AuthShell, HEADER_LINK } from './AuthShell';
import { localizePath } from './logic/paths';
import { CheckIcon, SANS, errorKey } from './ui';

type Mode = 'form' | 'reset' | 'sent';
/** The lead this browser already holds (the visitor who just finished the funnel), read from its cookie by the page. */
export interface KnownLead {
  email: string;
  accountCreated: boolean;
  passwordSet: boolean;
}
type Notice = 'rateLimited' | 'network' | 'generic' | 'googleUnavailable' | 'link' | 'oauth' | null;

const BACK_LINK = `background: none; border: 0; padding: 0; ${SANS}; font-size: 14px; color: #736d64; cursor: pointer; border-bottom: 1px solid #ece6dc`;

const GoogleG = () => (
  <svg width="19" height="19" viewBox="0 0 48 48" style={s('flex: none')} aria-hidden="true">
    <path fill="#4285F4" d="M45.1 24.5c0-1.6-.1-3.1-.4-4.5H24v8.5h11.8c-.5 2.7-2.1 5-4.4 6.5v5.4h7.1c4.2-3.8 6.6-9.5 6.6-15.9z" />
    <path fill="#34A853" d="M24 46c5.9 0 10.9-2 14.5-5.3l-7.1-5.4c-2 1.3-4.5 2.1-7.4 2.1-5.7 0-10.5-3.8-12.2-9h-7.3v5.6C7.1 41.1 15 46 24 46z" />
    <path fill="#FBBC05" d="M11.8 28.4c-.4-1.3-.7-2.7-.7-4.4s.3-3.1.7-4.4v-5.6H4.5C2.9 17.1 2 20.4 2 24s.9 6.9 2.5 10l7.3-5.6z" />
    <path fill="#EA4335" d="M24 10.6c3.2 0 6.1 1.1 8.4 3.3l6.3-6.3C34.9 4.1 29.9 2 24 2 15 2 7.1 6.9 4.5 14l7.3 5.6c1.7-5.2 6.5-9 12.2-9z" />
  </svg>
);

/**
 * "Follow your case.": email + password, Continue with Google, and the "Forgot it?" sub-mode that emails a reset link.
 * After a password sign-in staff go to /admin and everybody else to `next` or the portal.
 */
export function SignInForm({ next, error, mainSiteUrl, known, logoAlt }: { next: string | null; error: 'link' | 'oauth' | null; mainSiteUrl: string | null; known: KnownLead | null; logoAlt: string }) {
  const t = useTranslations('auth');
  const locale = useLocale() as Locale;
  const [mode, setMode] = useState<Mode>('form');
  const [email, setEmail] = useState(known?.accountCreated ? known.email : '');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [hint, setHint] = useState<'invalid' | 'noPassword' | null>(null);
  const [notice, setNotice] = useState<Notice>(error);

  const emailOk = isEmail(email);
  const onField = (set: (v: string) => void) => (e: { target: { value: string } }) => {
    set(e.target.value);
    setHint(null);
    setNotice(null);
  };

  async function signIn(e: FormEvent) {
    e.preventDefault();
    if (!emailOk || !password || busy) return;
    setBusy(true);
    setHint(null);
    setNotice(null);
    const supabase = createBrowserSupabase();
    const { error: authError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (authError) {
      setBusy(false);
      // the "no password yet" hint is only for a browser that already proved it owns the file (it holds the lead)
      setHint(known?.accountCreated && !known.passwordSet ? 'noPassword' : 'invalid');
      return;
    }
    const { data: staff } = await supabase.rpc('is_staff');
    const destination = next ?? (staff === true ? '/admin' : '/portal');
    // a full navigation: the server must see the new session cookie, and nothing cached may answer for the protected page
    window.location.assign(localizePath(destination, locale));
  }

  async function google() {
    if (busy) return;
    setBusy(true);
    setNotice(null);
    // Google only works when the auth server has the provider switched on; ask before leaving the page
    const settings = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/settings`, { headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '' } })
      .then((r) => r.json() as Promise<{ external?: { google?: boolean } }>)
      .catch(() => null);
    if (settings?.external?.google === false) {
      setBusy(false);
      setNotice('googleUnavailable');
      return;
    }
    const redirectTo = `${window.location.origin}${localizePath('/auth/callback', locale)}${next ? `?next=${encodeURIComponent(next)}` : ''}`;
    const { error: oauthError } = await createBrowserSupabase().auth.signInWithOAuth({ provider: 'google', options: { redirectTo } });
    if (oauthError) {
      setBusy(false);
      setNotice('googleUnavailable');
    }
  }

  async function sendReset(e: FormEvent) {
    e.preventDefault();
    if (!emailOk || busy) return;
    setBusy(true);
    setNotice(null);
    const res = await api('/api/auth/forgot', { body: { email: email.trim(), locale } });
    setBusy(false);
    if (res.ok) setMode('sent');
    else setNotice(errorKey(res.error));
  }

  const back = (extra = '') => (
    <button type="button" onClick={() => { setMode('form'); setHint(null); setNotice(null); }} {...x(`${BACK_LINK}${extra}`, { hover: 'color: #a07a3c' })}>
      {t('signIn.reset.back')}
    </button>
  );
  const banner = notice && (
    <p role="alert" style={s('font-size: 14px; line-height: 1.55; color: #a3462f; margin: 0 0 20px')}>
      {t(`signIn.notice.${notice}`)}
    </p>
  );
  const resetDisabled = !emailOk || busy;

  return (
    <AuthShell
      logoAlt={logoAlt}
      width={460}
      header={
        mainSiteUrl ? (
          <a href={mainSiteUrl} style={s(HEADER_LINK)}>{t('signIn.backToSite')}</a>
        ) : (
          <Link href="/" style={s(HEADER_LINK)}>{t('signIn.backToSite')}</Link>
        )
      }
    >
      <div style={s(AUTH_KICKER)}>{t('signIn.kicker')}</div>
      <h1 data-h1 style={s(AUTH_H1)}>{t('signIn.title')}</h1>
      <p style={s('font-size: 15.5px; line-height: 1.65; color: #736d64; margin: 0 0 26px')}>{t(`signIn.lede.${mode}`)}</p>

      {mode === 'reset' && (
        <form noValidate onSubmit={sendReset}>
          <div style={s('margin-bottom: 22px')}>
            <label htmlFor="si-reset-email" style={s(AUTH_LABEL)}>{t('signIn.reset.emailLabel')}</label>
            <input id="si-reset-email" type="email" dir="ltr" inputMode="email" autoComplete="email" autoCapitalize="none" spellCheck={false} value={email} onChange={onField(setEmail)} placeholder={t('signIn.emailPlaceholder')} style={s(AUTH_INPUT)} />
          </div>
          {banner}
          <button type="submit" className="btn" disabled={resetDisabled} aria-busy={busy} style={s(`${AUTH_BUTTON}; opacity: ${resetDisabled ? 0.35 : 1}; pointer-events: ${resetDisabled ? 'none' : 'auto'}`)}>
            {t('signIn.reset.submit')}
          </button>
          <div style={s('margin-top: 22px; padding-top: 20px; border-top: 1px solid #ece6dc')}>{back()}</div>
        </form>
      )}

      {mode === 'sent' && (
        <>
          <div role="status" style={s('display: flex; align-items: flex-start; gap: 12px; border: 1px solid #ece6dc; background: #f8f5f0; padding: 18px 20px; margin-bottom: 24px')}>
            <CheckIcon style={s('flex: none; margin-top: 2px')} />
            <span style={s('font-size: 14.5px; line-height: 1.6; color: #14202b')}>
              {t.rich('signIn.sent', { email: email.trim(), bdi: (c) => <bdi dir="ltr">{c}</bdi> })}
            </span>
          </div>
          {back()}
        </>
      )}

      {mode === 'form' && (
        <form noValidate onSubmit={signIn}>
          {banner}
          <button
            type="button"
            onClick={() => void google()}
            disabled={busy}
            {...x(
              `width: 100%; display: flex; align-items: center; justify-content: center; gap: 12px; background: #fff; border: 1px solid #d8cfc0; cursor: pointer; padding: 15px 18px; ${SANS}; font-weight: 600; font-size: 15.5px; color: #14202b; border-radius: 12px; transition: border-color 180ms ease, background 180ms ease`,
              { hover: 'border-color: #14202b; background: #f8f5f0' },
            )}
          >
            <GoogleG />
            {t('signIn.google')}
          </button>
          <div role="separator" style={s('display: flex; align-items: center; gap: 14px; margin: 22px 0')}>
            <span style={s('flex: 1; height: 1px; background: #ece6dc; display: block')} />
            <span style={s('font-size: 12px; letter-spacing: 0.12em; text-transform: uppercase; color: #9c958a')}>{t('signIn.or')}</span>
            <span style={s('flex: 1; height: 1px; background: #ece6dc; display: block')} />
          </div>
          <div style={s('margin-bottom: 18px')}>
            <label htmlFor="si-email" style={s(AUTH_LABEL)}>{t('signIn.email')}</label>
            <input id="si-email" type="email" name="email" dir="ltr" inputMode="email" autoComplete="username" autoCapitalize="none" spellCheck={false} value={email} onChange={onField(setEmail)} placeholder={t('signIn.emailPlaceholder')} style={s(AUTH_INPUT)} />
          </div>
          <div style={s('margin-bottom: 24px')}>
            <div style={s('display: flex; align-items: baseline; gap: 12px; margin-bottom: 8px')}>
              <label htmlFor="si-password" style={s(`${AUTH_LABEL}; margin-bottom: 0`)}>{t('signIn.password')}</label>
              <button
                type="button"
                onClick={() => { setMode('reset'); setHint(null); setNotice(null); }}
                {...x(`margin-left: auto; background: none; border: 0; padding: 0; ${SANS}; font-size: 13px; color: #7a5c2c; cursor: pointer; border-bottom: 1px solid #ece6dc`, { hover: 'border-bottom-color: #7a5c2c' })}
              >
                {t('signIn.forgot')}
              </button>
            </div>
            <input id="si-password" type="password" name="password" autoComplete="current-password" value={password} onChange={onField(setPassword)} placeholder={t('signIn.passwordPlaceholder')} aria-describedby={hint ? 'si-hint' : undefined} style={s(AUTH_INPUT)} />
            {hint && (
              <span id="si-hint" role="alert" style={s('display: block; font-size: 13px; color: #a3462f; margin-top: 8px; line-height: 1.5')}>
                {t(`signIn.hints.${hint}`)}
              </span>
            )}
          </div>
          <button
            type="submit"
            className="btn"
            disabled={!emailOk || !password || busy}
            aria-busy={busy}
            style={s(`${AUTH_BUTTON}; opacity: ${emailOk && password ? (busy ? 0.6 : 1) : 0.35}; pointer-events: ${emailOk && password ? 'auto' : 'none'}`)}
          >
            {t('signIn.submit')}
          </button>
          <div style={s('margin-top: 22px; padding-top: 20px; border-top: 1px solid #ece6dc; font-size: 13px; line-height: 1.6; color: #736d64')}>
            {known?.accountCreated ? t('signIn.noAccount.known') : t('signIn.noAccount.unknown')}
          </div>
        </form>
      )}
    </AuthShell>
  );
}
