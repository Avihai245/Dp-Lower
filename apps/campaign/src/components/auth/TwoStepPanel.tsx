'use client';
import type { Locale } from '@dpl/core';
import { createBrowserSupabase } from '@dpl/db/browser';
import { s } from '@dpl/ui';
import { useLocale, useTranslations } from 'next-intl';
import { useState, type FormEvent } from 'react';
import { AUTH_BUTTON, AUTH_H1, AUTH_INPUT, AUTH_KICKER, AUTH_LABEL, AuthShell, HEADER_LINK } from './AuthShell';
import { cleanCode, codeComplete, problemKind, qrSource } from './logic/mfa';
import { localizePath } from './logic/paths';
import { SANS } from './ui';

type Mode = 'idle' | 'scan';
type Problem = 'invalid' | 'rateLimited' | 'generic';

const SECONDARY = `width: 100%; background: #fff; border: 1px solid #d8cfc0; color: #14202b; cursor: pointer; ${SANS}; font-weight: 600; font-size: 14.5px; padding: 15px 18px; border-radius: 12px`;

/**
 * Turn two-step verification on or off for the signed-in staff member. Setting it up: the server makes a TOTP secret and a QR
 * code, the person scans it and proves the app works by typing the first code; only then is the factor "verified" and
 * asked for at every sign-in. Turning it off needs the second step too (the session is aal2 by the time this page opens).
 */
export function TwoStepPanel({ enrolled, required, next, logoAlt }: { enrolled: boolean; required: boolean; next: string; logoAlt: string }) {
  const t = useTranslations('auth.mfa.setup');
  const locale = useLocale() as Locale;
  const [on, setOn] = useState(enrolled);
  const [mode, setMode] = useState<Mode>('idle');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<Problem | null>(null);
  const [qr, setQr] = useState<{ factorId: string; src: string; secret: string } | null>(null);
  const [code, setCode] = useState('');
  const [justOn, setJustOn] = useState(false);
  const [askOff, setAskOff] = useState(false);
  const [justOff, setJustOff] = useState(false);

  const go = () => window.location.assign(localizePath(next, locale));

  async function start() {
    if (busy) return;
    setBusy(true);
    setProblem(null);
    const supabase = createBrowserSupabase();
    // an earlier attempt that was never confirmed would hold the name: clear it first
    const { data: all } = await supabase.auth.mfa.listFactors();
    for (const f of all?.all ?? []) if (f.factor_type === 'totp' && f.status === 'unverified') await supabase.auth.mfa.unenroll({ factorId: f.id });
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'Authenticator app' });
    setBusy(false);
    if (error || !data) {
      setProblem(problemKind(error));
      return;
    }
    setQr({ factorId: data.id, src: qrSource(data.totp.qr_code), secret: data.totp.secret });
    setCode('');
    setMode('scan');
  }

  async function cancel() {
    if (qr) await createBrowserSupabase().auth.mfa.unenroll({ factorId: qr.factorId });
    setQr(null);
    setMode('idle');
    setProblem(null);
  }

  async function confirm(e: FormEvent) {
    e.preventDefault();
    if (!qr || !codeComplete(code) || busy) return;
    setBusy(true);
    setProblem(null);
    const { error } = await createBrowserSupabase().auth.mfa.challengeAndVerify({ factorId: qr.factorId, code });
    setBusy(false);
    if (error) {
      setCode('');
      setProblem(problemKind(error));
      return;
    }
    setQr(null);
    setMode('idle');
    setOn(true);
    setJustOn(true);
  }

  async function turnOff() {
    if (busy) return;
    setBusy(true);
    setProblem(null);
    const supabase = createBrowserSupabase();
    const { data: factors } = await supabase.auth.mfa.listFactors();
    let failure: Problem | null = null;
    for (const f of factors?.totp ?? []) {
      const { error } = await supabase.auth.mfa.unenroll({ factorId: f.id });
      if (error) failure = problemKind(error);
    }
    setBusy(false);
    setAskOff(false);
    if (failure) {
      setProblem(failure);
      return;
    }
    setOn(false);
    setJustOn(false);
    setJustOff(true);
  }

  const status = on ? 'on' : 'off';
  const lede = on ? 'on' : required ? 'required' : 'off';
  return (
    <AuthShell
      logoAlt={logoAlt}
      width={500}
      header={
        // while the firm requires it, there is nowhere to go before it is set up
        on || !required ? (
          <a href={localizePath(next, locale)} style={s(HEADER_LINK)}>{t('back')}</a>
        ) : (
          <span />
        )
      }
    >
      <div style={s(AUTH_KICKER)}>{t('kicker')}</div>
      <h1 data-h1 style={s(AUTH_H1)}>{t('title')}</h1>
      <p style={s('font-size: 15.5px; line-height: 1.65; color: #736d64; margin: 0 0 22px')}>{t(`lede.${lede}`)}</p>

      <p style={s('margin: 0 0 24px; font-size: 14px; font-weight: 600; color: #14202b')}>
        <span style={s('color: #736d64; font-weight: 500')}>{t('title')}: </span>
        <span data-status={status} role="status">{t(`status.${status}`)}</span>
      </p>

      {justOn && <p role="status" style={s('border: 1px solid #ece6dc; background: #f8f5f0; padding: 14px 16px; font-size: 14.5px; line-height: 1.6; margin: 0 0 22px')}>{t('done')}</p>}
      {justOff && <p role="status" style={s('border: 1px solid #ece6dc; background: #f8f5f0; padding: 14px 16px; font-size: 14.5px; line-height: 1.6; margin: 0 0 22px')}>{t('turnedOff')}</p>}
      {problem && mode === 'idle' && <p role="alert" style={s('font-size: 13.5px; line-height: 1.5; color: #a3462f; margin: 0 0 18px')}>{t(problem)}</p>}

      {mode === 'scan' && qr && (
        <form noValidate onSubmit={confirm}>
          <h2 style={s("font-family: 'Newsreader', Georgia, serif; font-weight: 400; font-size: 22px; margin: 0 0 8px")}>{t('scanTitle')}</h2>
          <p style={s('font-size: 14.5px; line-height: 1.6; color: #736d64; margin: 0 0 16px')}>{t('scanLede')}</p>
          <img src={qr.src} alt={t('qrAlt')} width={200} height={200} style={s('display: block; width: 200px; height: 200px; margin: 0 0 16px; border: 1px solid #ece6dc; padding: 8px; background: #fff')} />
          <p style={s('font-size: 13px; color: #736d64; margin: 0 0 6px')}>{t('secretLabel')}</p>
          <code id="mfa-secret" dir="ltr" style={s('display: block; font-size: 15px; letter-spacing: 0.08em; word-break: break-all; background: #f8f5f0; border: 1px solid #ece6dc; padding: 10px 12px; margin: 0 0 22px')}>{qr.secret}</code>
          <div style={s('margin-bottom: 22px')}>
            <label htmlFor="mfa-code" style={s(AUTH_LABEL)}>{t('codeLabel')}</label>
            <input
              id="mfa-code"
              name="code"
              type="text"
              dir="ltr"
              inputMode="numeric"
              autoComplete="one-time-code"
              spellCheck={false}
              maxLength={7}
              value={code}
              onChange={(e) => {
                setCode(cleanCode(e.target.value));
                setProblem(null);
              }}
              aria-describedby={problem ? 'mfa-note' : undefined}
              aria-invalid={problem === 'invalid' ? true : undefined}
              placeholder="123456"
              style={s(`${AUTH_INPUT}; letter-spacing: 0.3em; font-size: 22px; text-align: center`)}
            />
            {problem && <p id="mfa-note" role="alert" style={s('font-size: 13.5px; line-height: 1.5; color: #a3462f; margin: 10px 0 0')}>{t(problem)}</p>}
          </div>
          <button
            type="submit"
            className="btn"
            disabled={!codeComplete(code) || busy}
            aria-busy={busy}
            style={s(`${AUTH_BUTTON}; opacity: ${codeComplete(code) ? (busy ? 0.6 : 1) : 0.35}; pointer-events: ${codeComplete(code) ? 'auto' : 'none'}`)}
          >
            {t('confirm')}
          </button>
          <button type="button" onClick={() => void cancel()} style={s(`${SECONDARY}; margin-top: 12px`)}>{t('cancel')}</button>
        </form>
      )}

      {mode === 'idle' && !on && (
        <button type="button" className="btn" onClick={() => void start()} disabled={busy} aria-busy={busy} style={s(`${AUTH_BUTTON}; opacity: ${busy ? 0.6 : 1}`)}>
          {t('start')}
        </button>
      )}

      {mode === 'idle' && on && (
        <>
          <button type="button" className="btn" onClick={go} style={s(AUTH_BUTTON)}>{t('continue')}</button>
          {required ? (
            <p style={s('font-size: 13px; line-height: 1.6; color: #736d64; margin: 22px 0 0; padding-top: 20px; border-top: 1px solid #ece6dc')}>{t('turnOffRequired')}</p>
          ) : (
            <div style={s('margin-top: 22px; padding-top: 20px; border-top: 1px solid #ece6dc')}>
              {askOff ? (
                <>
                  <p style={s('font-size: 14px; line-height: 1.6; margin: 0 0 14px')}>{t('turnOffAsk')}</p>
                  <button type="button" onClick={() => void turnOff()} disabled={busy} aria-busy={busy} style={s(`${SECONDARY}; border-color: #a3462f; color: #a3462f`)}>{t('turnOffYes')}</button>
                  <button type="button" onClick={() => setAskOff(false)} style={s(`${SECONDARY}; margin-top: 10px`)}>{t('cancel')}</button>
                </>
              ) : (
                <button type="button" onClick={() => setAskOff(true)} style={s(SECONDARY)}>{t('turnOff')}</button>
              )}
            </div>
          )}
        </>
      )}
    </AuthShell>
  );
}
