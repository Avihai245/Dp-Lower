'use client';
import { isEmail } from '@dpl/core';
import { s, x } from '@dpl/ui';
import { useTranslations } from 'next-intl';
import { useState, type FormEvent } from 'react';
import { Link } from '@/i18n/navigation';
import { api } from '@/lib/api';
import { AUTH_BUTTON, AUTH_H1, AUTH_INPUT, AUTH_KICKER, AUTH_LABEL, AuthShell, HEADER_LINK } from './AuthShell';
import { CheckIcon, SANS, errorKey } from './ui';

/**
 * Where /go/[token] sends a bad, expired or replaced emailed link: say so, and offer to email a fresh one. The answer
 * is the same for every address, so the page never tells whether an email is on file.
 */
export function LinkExpiredForm({ logoAlt }: { logoAlt: string }) {
  const t = useTranslations('auth');
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<'rateLimited' | 'network' | 'generic' | null>(null);
  const ok = isEmail(email);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!ok || busy) return;
    setBusy(true);
    setError(null);
    const res = await api('/api/auth/link', { body: { email: email.trim() } });
    setBusy(false);
    if (res.ok) setSent(true);
    else setError(errorKey(res.error));
  }

  return (
    <AuthShell logoAlt={logoAlt} width={460} header={<Link href="/" style={s(HEADER_LINK)}>{t('signIn.backToSite')}</Link>}>
      <div style={s(AUTH_KICKER)}>{t('linkExpired.kicker')}</div>
      <h1 data-h1 style={s(AUTH_H1)}>{t('linkExpired.title')}</h1>
      <p style={s('font-size: 15.5px; line-height: 1.65; color: #736d64; margin: 0 0 26px')}>{t('linkExpired.lede')}</p>
      {sent ? (
        <>
          <div role="status" style={s('display: flex; align-items: flex-start; gap: 12px; border: 1px solid #ece6dc; background: #f8f5f0; padding: 18px 20px; margin-bottom: 24px')}>
            <CheckIcon style={s('flex: none; margin-top: 2px')} />
            <span style={s('font-size: 14.5px; line-height: 1.6; color: #14202b')}>{t('linkExpired.sent')}</span>
          </div>
          <Link href="/sign-in" {...x(`${SANS}; font-size: 14px; color: #736d64; border-bottom: 1px solid #ece6dc; text-decoration: none`, { hover: 'color: #a07a3c' })}>
            {t('linkExpired.toSignIn')}
          </Link>
        </>
      ) : (
        <form noValidate onSubmit={submit}>
          <div style={s('margin-bottom: 22px')}>
            <label htmlFor="le-email" style={s(AUTH_LABEL)}>{t('signIn.reset.emailLabel')}</label>
            <input id="le-email" type="email" dir="ltr" inputMode="email" autoComplete="email" autoCapitalize="none" spellCheck={false} value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t('signIn.emailPlaceholder')} style={s(AUTH_INPUT)} />
          </div>
          {error && <p role="alert" style={s('font-size: 14px; line-height: 1.55; color: #a3462f; margin: 0 0 20px')}>{t(`signIn.notice.${error}`)}</p>}
          <button type="submit" className="btn" disabled={!ok || busy} aria-busy={busy} style={s(`${AUTH_BUTTON}; opacity: ${ok ? (busy ? 0.6 : 1) : 0.35}; pointer-events: ${ok ? 'auto' : 'none'}`)}>
            {t('linkExpired.submit')}
          </button>
          <div style={s('margin-top: 22px; padding-top: 20px; border-top: 1px solid #ece6dc')}>
            <Link href="/sign-in" {...x(`${SANS}; font-size: 14px; color: #736d64; border-bottom: 1px solid #ece6dc; text-decoration: none`, { hover: 'color: #a07a3c' })}>
              {t('linkExpired.toSignIn')}
            </Link>
          </div>
        </form>
      )}
    </AuthShell>
  );
}
