'use client';
import { isValidTimeZone, type Locale } from '@dpl/core';
import { s, x } from '@dpl/ui';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from '@/i18n/navigation';
import { api } from '@/lib/api';
import type { LeadSummary } from './logic/api-types';
import { visitorTimeZone, whenLabel } from './logic/booking-format';
import { offerFor, type FileValue } from './logic/offer';
import { H1_STYLE, LINK_BUTTON, LockIcon, Page, SANS, StepHeader } from './ui';

const CTA = `width: 100%; background: #14202b; color: #f8f5f0; border: 1px solid #14202b; ${SANS}; font-weight: 600; padding: 19px; font-size: 15.5px; letter-spacing: 0.06em; text-transform: uppercase; cursor: pointer; transition: background 160ms ease`;

/**
 * The personalised result: the route named back to the visitor, what happens next, the (placeholder) fee note, then
 * "Go to my portal". The visitor's saved answers and booking come from GET /api/lead.
 */
export function OfferView() {
  const t = useTranslations('funnel');
  const locale = useLocale() as Locale;
  const router = useRouter();
  const [lead, setLead] = useState<LeadSummary | null>(null);
  const [fileOpen, setFileOpen] = useState(false);
  const [emailed, setEmailed] = useState(false);
  const [busy, setBusy] = useState<'portal' | 'email' | null>(null);
  const [error, setError] = useState<'portal' | 'email' | null>(null);

  useEffect(() => {
    let cancelled = false;
    void api<LeadSummary>('/api/lead').then((me) => {
      if (cancelled) return;
      if (me.status === 401) router.replace('/details');
      else if (me.ok && me.data) setLead(me.data);
    });
    return () => {
      cancelled = true;
    };
  }, [router]);

  const offer = useMemo(() => (lead ? offerFor(lead.answers) : null), [lead]);
  const when = useMemo(() => {
    if (!lead?.booking) return null;
    const zone = lead.booking.timezone && isValidTimeZone(lead.booking.timezone) ? lead.booking.timezone : visitorTimeZone();
    return whenLabel(lead.booking.startsAt, zone, locale);
  }, [lead, locale]);

  async function goPortal() {
    if (busy) return;
    setBusy('portal');
    setError(null);
    const res = await api('/api/portal/enter', { method: 'POST' });
    if (res.ok) {
      router.push('/portal');
      return;
    }
    setBusy(null);
    if (res.status === 401) router.replace('/details');
    else setError('portal');
  }

  async function emailResult() {
    if (busy) return;
    setBusy('email');
    setError(null);
    const res = await api('/api/results/email', { method: 'POST' });
    setBusy(null);
    if (res.ok) setEmailed(true);
    else if (res.status === 401) router.replace('/details');
    else setError('email');
  }

  const fileValue = (v: FileValue): string =>
    v.kind === 'text' ? t(`offer.file.values.${v.key}`) : v.kind === 'option' ? t(`quiz.questions.${v.quiz}.options.${v.option}`) : t(`offer.file.who.${v.relative}`);

  const labels = { answers: t('steps.answers'), details: t('steps.details'), call: t('steps.call'), result: t('steps.result') };
  const includes = t.raw('offer.includes') as string[];
  const firstName = lead?.firstName ?? '';

  return (
    <Page>
      <StepHeader current="result" logoAlt={t('brand.logoAlt')} labels={labels} ariaLabel={t('steps.label')} />
      <div data-pad style={s('flex: 1; display: flex; justify-content: center; padding: clamp(40px, 7vh, 84px) 20px 72px')}>
        <div data-fx-anim style={s(`width: 100%; max-width: 600px; animation: ${lead && offer ? 'qIn 340ms cubic-bezier(0.2,0,0,1) both' : 'none'}; visibility: ${lead && offer ? 'visible' : 'hidden'}`)}>
          {lead && offer && (
            <>
              <h1 data-h1 style={s(H1_STYLE)}>{t(`offer.headline.${offer.claim}`, { hasName: firstName ? 'yes' : 'no', name: firstName })}</h1>
              <p style={s('font-size: 17.5px; line-height: 1.6; color: #5f5a52; margin: 0 0 22px; text-wrap: pretty')}>{t('offer.lede', { relative: offer.relative })}</p>
              {when && (
                <div style={s('display: flex; align-items: center; gap: 10px; font-size: 15px; line-height: 1.5; color: #14202b; background: #f6f0e4; border-radius: 12px; padding: 13px 16px; margin: 0 0 22px')}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#a07a3c" strokeWidth="1.6" style={s('flex: none')} aria-hidden="true">
                    <rect x="3" y="5" width="18" height="16" rx="2" />
                    <path d="M8 3v4M16 3v4M3 11h18" />
                  </svg>
                  <span>{t('offer.callLine', { date: when.date, time: when.time })}</span>
                </div>
              )}

              <div style={s('background: #fff; border: 1px solid #e2dbcf; border-radius: 20px; padding: clamp(24px, 3vw, 34px); box-shadow: 0 18px 44px rgba(20,32,43,0.08); margin-top: 10px')}>
                <div style={s('display: flex; align-items: center; gap: 9px; margin-bottom: 12px')}>
                  <span aria-hidden="true" style={s('width: 8px; height: 8px; border-radius: 50%; background: #3f6b4f; display: block; flex: none')} />
                  <span style={s('font-size: 12px; font-weight: 600; letter-spacing: 0.16em; text-transform: uppercase; color: #2f5a3e')}>{t('offer.portal.badge')}</span>
                </div>
                <h2 style={s("font-family: 'Newsreader', Georgia, serif; font-size: 27px; line-height: 1.2; margin: 0 0 18px; letter-spacing: 0; font-weight: 400")}>{t('offer.portal.title')}</h2>
                <ul style={s('list-style: none; padding: 0; display: flex; flex-direction: column; gap: 12px; margin: 0 0 22px')}>
                  {includes.map((line) => (
                    <li key={line} style={s('display: flex; gap: 12px; align-items: flex-start; font-size: 15px; line-height: 1.5')}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#a07a3c" strokeWidth="1.8" style={s('flex: none; margin-top: 3px')} aria-hidden="true">
                        <path d="m4 12.5 5 5L20 6.5" />
                      </svg>
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>
                <div style={s('background: #f6f0e4; border-radius: 12px; padding: 14px 16px; margin-bottom: 22px; font-size: 15px; line-height: 1.5')}>
                  {t.rich('offer.discount.text', { b: (c) => <strong style={s('font-weight: 700')}>{c}</strong> })}
                  <span style={s('display: block; font-size: 11.5px; color: #7a5c2c; margin-top: 6px')}>{t('offer.discount.placeholder')}</span>
                </div>
                {error === 'portal' && <p role="alert" style={s('font-size: 14px; line-height: 1.5; color: #a03a2c; margin: 0 0 14px')}>{t('offer.errors.portal')}</p>}
                <button type="button" className="btn btn-primary" disabled={busy === 'portal'} aria-busy={busy === 'portal'} onClick={() => void goPortal()} style={s(`${CTA}; opacity: ${busy === 'portal' ? 0.6 : 1}`)}>
                  {t('offer.goPortal')}
                </button>
                <div style={s('display: flex; align-items: center; justify-content: center; gap: 8px; margin-top: 12px; font-size: 13.5px; color: #736d64')}>
                  <LockIcon />
                  <span>{t('offer.noPassword')}</span>
                </div>
              </div>

              <div style={s('display: flex; flex-direction: column; align-items: center; gap: 4px; margin-top: 20px')}>
                {emailed ? (
                  <p role="status" style={s('margin: 6px 0; text-align: center; font-size: 14.5px; line-height: 1.55; color: #2f5a3e')}>
                    {t.rich('offer.emailed', { email: lead.email, bdi: (c) => <bdi dir="ltr">{c}</bdi> })}
                  </p>
                ) : (
                  <button type="button" disabled={busy === 'email'} onClick={() => void emailResult()} {...x(LINK_BUTTON, { hover: 'color: #14202b' })}>
                    {t('offer.emailResult')}
                  </button>
                )}
                {error === 'email' && <p role="alert" style={s('margin: 4px 0; font-size: 13.5px; color: #a03a2c; text-align: center')}>{t('offer.errors.email')}</p>}
                <button type="button" aria-expanded={fileOpen} aria-controls="offer-file" onClick={() => setFileOpen((v) => !v)} {...x(LINK_BUTTON, { hover: 'color: #14202b' })}>
                  {fileOpen ? t('offer.file.hide') : t('offer.file.show')}
                </button>
              </div>
              {fileOpen && (
                <div id="offer-file" data-fx-anim style={s('border: 1px solid #ece6dc; border-radius: 16px; padding: 8px 22px; margin-top: 12px; animation: qIn 260ms cubic-bezier(0.2,0,0,1) both')}>
                  {offer.file.map((row) => (
                    <div key={row.id} data-kv style={s('display: grid; grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.1fr); gap: 16px; padding: 12px 0; border-bottom: 1px solid #f0ebe2')}>
                      <span style={s('font-size: 14px; color: #736d64')}>{t(`offer.file.rows.${row.id}`)}</span>
                      <span style={s('font-size: 15px; line-height: 1.4')}>{fileValue(row.value)}</span>
                    </div>
                  ))}
                </div>
              )}
              <p style={s('font-size: 12px; line-height: 1.5; color: #9a948a; margin: 30px 0 0; text-align: center')}>{t('offer.disclaimer')}</p>
            </>
          )}
        </div>
      </div>
    </Page>
  );
}
