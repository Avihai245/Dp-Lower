'use client';
import { s, x } from '@dpl/ui';
import { useTranslations } from 'next-intl';
import { useState, type FormEvent } from 'react';
import { Link, useRouter } from '@/i18n/navigation';
import { api } from '@/lib/api';
import { AUTH_BUTTON, AUTH_H1, AUTH_INPUT, AUTH_KICKER, AUTH_LABEL, AuthShell, HEADER_LINK } from './AuthShell';
import { passwordState } from './logic/password';
import { stripLocale } from './logic/paths';
import { SANS } from './ui';

const NOTE = `display: flex; align-items: flex-start; gap: 10px; ${SANS}; font-size: 13px; line-height: 1.6; color: #736d64`;

function Note({ children }: { children: string }) {
  return (
    <div style={s(NOTE)}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#a07a3c" strokeWidth="1.6" style={s('flex: none; margin-top: 3px')} aria-hidden="true">
        <rect x="4" y="11" width="16" height="10" rx="1" />
        <path d="M8 11V7a4 4 0 0 1 8 0v4" />
      </svg>
      <span>{children}</span>
    </div>
  );
}

/**
 * "Set a password." The email is read-only (it is the email of the signed-in account), the password needs 8 or more
 * characters and a matching confirmation. `mode="reset"` is the same screen after the emailed recovery link.
 */
export function SetPasswordForm({ email, mode, next, logoAlt }: { email: string; mode: 'create' | 'reset'; next: string; logoAlt: string }) {
  const t = useTranslations('auth');
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<'rejected' | 'rateLimited' | 'network' | 'generic' | null>(null);
  const state = passwordState(password, confirm);
  const copy = mode === 'reset' ? 'password.reset' : 'password';

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!state.ok || pending) return;
    setPending(true);
    setError(null);
    const res = await api('/api/auth/set-password', { body: { password } });
    if (res.ok) {
      router.push(stripLocale(next));
      return;
    }
    setPending(false);
    if (res.status === 401) router.push(`/sign-in?next=${encodeURIComponent('/create-password')}`);
    else setError(res.error === 'password_rejected' ? 'rejected' : res.error === 'rate_limited' ? 'rateLimited' : res.error === 'network' ? 'network' : 'generic');
  }

  return (
    <AuthShell
      logoAlt={logoAlt}
      width={480}
      header={
        <Link href="/portal" style={s(HEADER_LINK + '; white-space: nowrap')}>
          {t('password.backToPortal')}
        </Link>
      }
    >
      <div style={s(AUTH_KICKER)}>{t(`${copy}.kicker`)}</div>
      <h1 data-h1 style={s(AUTH_H1)}>{t(`${copy}.title`)}</h1>
      <p style={s('font-size: 15.5px; line-height: 1.65; color: #736d64; margin: 0 0 28px')}>{t(`${copy}.lede`)}</p>
      <form noValidate onSubmit={submit}>
        <div style={s('margin-bottom: 20px')}>
          <label htmlFor="pw-email" style={s(AUTH_LABEL)}>{t('password.email')}</label>
          <input id="pw-email" value={email} readOnly dir="ltr" autoComplete="username" style={s(`${AUTH_INPUT}; background: #ece6dc; color: #736d64`)} />
          <span style={s('display: block; font-size: 13px; color: #736d64; margin-top: 7px')}>{t('password.emailHint')}</span>
        </div>
        <div style={s('margin-bottom: 20px')}>
          <label htmlFor="pw-new" style={s(AUTH_LABEL)}>{t('password.password')}</label>
          <input
            id="pw-new"
            type="password"
            autoComplete="new-password"
            placeholder={t('password.passwordPlaceholder')}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={s(AUTH_INPUT)}
          />
        </div>
        <div style={s('margin-bottom: 26px')}>
          <label htmlFor="pw-confirm" style={s(AUTH_LABEL)}>{t('password.confirm')}</label>
          <input
            id="pw-confirm"
            type="password"
            autoComplete="new-password"
            placeholder={t('password.confirmPlaceholder')}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            aria-describedby="pw-hint"
            style={s(AUTH_INPUT)}
          />
          <span id="pw-hint" aria-live="polite" style={s(`display: block; font-size: 13px; margin-top: 8px; color: ${state.error ? '#9a3b2e' : '#736d64'}`)}>
            {t(`password.hint.${state.hint}`)}
          </span>
        </div>
        {error && <p role="alert" style={s('font-size: 14px; line-height: 1.5; color: #a03a2c; margin: 0 0 16px')}>{t(`password.errors.${error}`)}</p>}
        <button type="submit" className="btn" disabled={!state.ok || pending} aria-busy={pending} style={s(`${AUTH_BUTTON}; opacity: ${state.ok ? (pending ? 0.6 : 1) : 0.35}; pointer-events: ${state.ok ? 'auto' : 'none'}`)}>
          {t('password.save')}
        </button>
      </form>
      <Link
        href="/portal"
        {...x(`display: block; width: 100%; text-align: center; background: none; border: 0; padding: 14px 0 0; ${SANS}; font-size: 14px; line-height: normal; color: #736d64; cursor: pointer; text-decoration: none`, { hover: 'color: #a07a3c' })}
      >
        {t('password.notNow')}
      </Link>
      <div style={s('margin-top: 24px; padding-top: 22px; border-top: 1px solid #ece6dc; display: flex; flex-direction: column; gap: 12px')}>
        {(t.raw('password.notes') as string[]).map((note) => (
          <Note key={note}>{note}</Note>
        ))}
      </div>
    </AuthShell>
  );
}
