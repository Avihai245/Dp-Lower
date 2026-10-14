'use client';
import { s, x } from '@dpl/ui';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Link } from '@/i18n/navigation';
import { api } from '@/lib/api';
import { AUTH_BUTTON, AUTH_H1, AUTH_KICKER, AuthShell, HEADER_LINK } from './AuthShell';
import { CheckIcon, SANS } from './ui';

/**
 * Opening the unsubscribe link only ever shows this page; nothing changes until the visitor presses the button, which
 * POSTs the signed token. That keeps mail scanners and link previewers from unsubscribing people by merely fetching it.
 * `token` is null when the link is not valid (the server page already checked the signature).
 */
export function UnsubscribeConfirm({ token, logoAlt }: { token: string | null; logoAlt: string }) {
  const t = useTranslations('auth');
  const [phase, setPhase] = useState<'confirm' | 'done'>('confirm');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function confirm() {
    if (!token || busy) return;
    setBusy(true);
    setFailed(false);
    const res = await api('/api/unsubscribe', { body: { token } });
    setBusy(false);
    if (res.ok) setPhase('done');
    else setFailed(true);
  }

  const toSite = (
    <Link href="/" {...x(`${SANS}; font-size: 14px; color: #736d64; border-bottom: 1px solid #ece6dc; text-decoration: none`, { hover: 'color: #a07a3c' })}>
      {t('unsubscribe.toSite')}
    </Link>
  );

  return (
    <AuthShell logoAlt={logoAlt} width={460} header={<Link href="/" style={s(HEADER_LINK)}>{t('signIn.backToSite')}</Link>}>
      <div style={s(AUTH_KICKER)}>{t('unsubscribe.kicker')}</div>
      {!token ? (
        <>
          <h1 data-h1 style={s(AUTH_H1)}>{t('unsubscribe.invalid.title')}</h1>
          <p style={s('font-size: 15.5px; line-height: 1.65; color: #736d64; margin: 0 0 26px')}>{t('unsubscribe.invalid.lede')}</p>
          {toSite}
        </>
      ) : phase === 'done' ? (
        <>
          <h1 data-h1 style={s(AUTH_H1)}>{t('unsubscribe.done.title')}</h1>
          <div role="status" style={s('display: flex; align-items: flex-start; gap: 12px; border: 1px solid #ece6dc; background: #f8f5f0; padding: 18px 20px; margin: 0 0 24px')}>
            <CheckIcon style={s('flex: none; margin-top: 2px')} />
            <span style={s('font-size: 14.5px; line-height: 1.6; color: #14202b')}>{t('unsubscribe.done.lede')}</span>
          </div>
          {toSite}
        </>
      ) : (
        <>
          <h1 data-h1 style={s(AUTH_H1)}>{t('unsubscribe.title')}</h1>
          <p style={s('font-size: 15.5px; line-height: 1.65; color: #736d64; margin: 0 0 26px')}>{t('unsubscribe.lede')}</p>
          {failed && <p role="alert" style={s('font-size: 14px; line-height: 1.55; color: #a3462f; margin: 0 0 20px')}>{t('unsubscribe.error')}</p>}
          <button type="button" className="btn" disabled={busy} aria-busy={busy} onClick={() => void confirm()} style={s(`${AUTH_BUTTON}; opacity: ${busy ? 0.6 : 1}`)}>
            {t('unsubscribe.confirm')}
          </button>
          <div style={s('margin-top: 22px; padding-top: 20px; border-top: 1px solid #ece6dc')}>{toSite}</div>
        </>
      )}
    </AuthShell>
  );
}
