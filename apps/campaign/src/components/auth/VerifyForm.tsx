'use client';
import type { Locale } from '@dpl/core';
import { createBrowserSupabase } from '@dpl/db/browser';
import { s } from '@dpl/ui';
import { useLocale, useTranslations } from 'next-intl';
import { useState, type FormEvent } from 'react';
import { AUTH_BUTTON, AUTH_H1, AUTH_INPUT, AUTH_KICKER, AUTH_LABEL, AuthShell, HEADER_LINK } from './AuthShell';
import { cleanCode, codeComplete, problemKind } from './logic/mfa';
import { localizePath } from './logic/paths';

/**
 * The second step of a staff sign-in: the 6-digit code of the authenticator app. The password has already been accepted
 * (the session is at assurance level aal1); the code upgrades it to aal2, which is what the CRM and the database want.
 */
export function VerifyForm({ next, logoAlt }: { next: string; logoAlt: string }) {
  const t = useTranslations('auth.mfa.verify');
  const locale = useLocale() as Locale;
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<'invalid' | 'rateLimited' | 'generic' | 'noFactor' | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!codeComplete(code) || busy) return;
    setBusy(true);
    setNotice(null);
    const supabase = createBrowserSupabase();
    const { data: factors, error: listError } = await supabase.auth.mfa.listFactors();
    if (listError) {
      setBusy(false);
      setNotice(problemKind(listError));
      return;
    }
    const factor = factors?.totp[0];
    if (!factor) {
      setBusy(false);
      setNotice('noFactor');
      return;
    }
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: factor.id, code });
    if (error) {
      setBusy(false);
      setCode('');
      setNotice(problemKind(error));
      return;
    }
    // a full navigation: the server must see the upgraded session cookie
    window.location.assign(localizePath(next, locale));
  }

  async function signOut() {
    await createBrowserSupabase().auth.signOut();
    window.location.assign(localizePath('/sign-in', locale));
  }

  const ready = codeComplete(code);
  return (
    <AuthShell
      logoAlt={logoAlt}
      audience="staff"
      width={460}
      header={
        <button type="button" onClick={() => void signOut()} style={s(`${HEADER_LINK}; cursor: pointer`)}>
          {t('signOut')}
        </button>
      }
    >
      <div style={s(AUTH_KICKER)}>{t('kicker')}</div>
      <h1 data-h1 style={s(AUTH_H1)}>{t('title')}</h1>
      <p style={s('font-size: 15.5px; line-height: 1.65; color: #736d64; margin: 0 0 26px')}>{t('lede')}</p>
      <form noValidate onSubmit={submit}>
        <div style={s('margin-bottom: 24px')}>
          <label htmlFor="mfa-code" style={s(AUTH_LABEL)}>{t('codeLabel')}</label>
          <input
            id="mfa-code"
            name="code"
            type="text"
            dir="ltr"
            inputMode="numeric"
            autoComplete="one-time-code"
            autoFocus
            spellCheck={false}
            maxLength={7}
            value={code}
            onChange={(e) => {
              setCode(cleanCode(e.target.value));
              setNotice(null);
            }}
            aria-describedby={notice ? 'mfa-note' : undefined}
            aria-invalid={notice === 'invalid' ? true : undefined}
            placeholder="123456"
            style={s(`${AUTH_INPUT}; letter-spacing: 0.3em; font-size: 22px; text-align: center`)}
          />
          {notice && (
            <p id="mfa-note" role="alert" style={s('font-size: 13.5px; line-height: 1.5; color: #a3462f; margin: 10px 0 0')}>
              {t(notice)}
            </p>
          )}
        </div>
        <button
          type="submit"
          className="btn"
          disabled={!ready || busy}
          aria-busy={busy}
          style={s(`${AUTH_BUTTON}; opacity: ${ready ? (busy ? 0.6 : 1) : 0.35}; pointer-events: ${ready ? 'auto' : 'none'}`)}
        >
          {t('submit')}
        </button>
      </form>
    </AuthShell>
  );
}
