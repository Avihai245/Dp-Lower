'use client';
import { isQuizComplete, type Locale } from '@dpl/core';
import { s, x } from '@dpl/ui';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useRouter } from '@/i18n/navigation';
import { api } from '@/lib/api';
import { getQuizAnswers } from '@/lib/quiz-store';
import type { LeadSubmitResponse } from './logic/api-types';
import { EMPTY_DRAFT, capitalizeAsTyped, clearDraft, readDraft, validateLead, writeDraft, type LeadDraft } from './logic/lead-form';
import { Turnstile } from './Turnstile';
import { CheckIcon, H1_STYLE, LEDE_STYLE, LINK_BUTTON, LockIcon, Page, PRIMARY_BUTTON, SANS, StepHeader, errorKey } from './ui';

const INPUT = `width: 100%; padding: 16px 18px; font-size: 16px; ${SANS}; color: #14202b; border: 1px solid #ddd5c8; background: #fff; border-radius: 12px; box-sizing: border-box`;
const LABEL = 'display: block; font-size: 14px; font-weight: 600; color: #14202b; margin-bottom: 8px';
const ERROR = 'display: block; font-size: 13.5px; color: #a03a2c; margin-top: 7px';

type Phase = 'form' | 'submitting' | 'existing';

/**
 * "Where should we send your result?": name, email and phone, and nothing more. Validated with the same rules as the
 * server, with errors only after the first attempt. POST /api/leads decides what happens next: a new or updated lead
 * continues to the booking, an email that already has a file gets "we have emailed you a link".
 * `initialLead` is the lead this browser already holds (read from the lead cookie by the page), if any.
 */
export function LeadForm({ initialLead }: { initialLead: LeadDraft | null }) {
  const t = useTranslations('funnel');
  const locale = useLocale() as Locale;
  const router = useRouter();
  const [draft, setDraft] = useState<LeadDraft>(EMPTY_DRAFT);
  const [ready, setReady] = useState(false);
  const [tried, setTried] = useState(false);
  const [phase, setPhase] = useState<Phase>('form');
  const [error, setError] = useState<'rateLimited' | 'network' | 'captcha' | 'generic' | null>(null);
  const [captchaReset, setCaptchaReset] = useState(0);
  const captcha = useRef<string | null>(null);
  const [resend, setResend] = useState<'idle' | 'sending' | 'sent' | 'failed'>('idle');
  const touched = useRef(false);
  const refs = { fullName: useRef<HTMLInputElement>(null), email: useRef<HTMLInputElement>(null), phone: useRef<HTMLInputElement>(null) };
  const honeypot = useRef<HTMLInputElement>(null);

  // Start from what was typed before a refresh, else from the lead this browser already has (read by the server).
  useEffect(() => {
    const stored = readDraft();
    if (stored.fullName || stored.email || stored.phone) {
      touched.current = true;
      setDraft(stored);
    } else if (initialLead) {
      setDraft(initialLead);
    }
    // nothing to submit and nobody to continue: the questions come first
    if (!initialLead && !isQuizComplete(getQuizAnswers())) {
      router.replace('/eligibility');
      return;
    }
    setReady(true);
  }, [initialLead, router]);

  const validity = validateLead(draft);

  function update(field: keyof LeadDraft, raw: string) {
    touched.current = true;
    const value = field === 'fullName' ? capitalizeAsTyped(raw) : raw;
    const next = { ...draft, [field]: value };
    setDraft(next);
    writeDraft(next);
    if (phase === 'existing') setPhase('form');
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (phase === 'submitting') return;
    if (!validity.ok) {
      setTried(true);
      (!validity.name ? refs.fullName : !validity.email ? refs.email : refs.phone).current?.focus();
      return;
    }
    setPhase('submitting');
    setError(null);
    const res = await api<LeadSubmitResponse>('/api/leads', {
      body: {
        fullName: draft.fullName.trim(),
        email: draft.email.trim(),
        phone: draft.phone.trim(),
        locale,
        answers: getQuizAnswers(),
        website: honeypot.current?.value ?? '',
        turnstileToken: captcha.current ?? undefined,
      },
    });
    if (!res.ok || !res.data) {
      setPhase('form');
      if (res.error === 'captcha_failed') {
        // the token is single use: ask the widget for a new one
        captcha.current = null;
        setCaptchaReset((n) => n + 1);
        setError('captcha');
      } else {
        setError(errorKey(res.error));
      }
      return;
    }
    if (res.data.status === 'existing') {
      setResend('idle');
      setPhase('existing');
      return;
    }
    clearDraft();
    router.push('/booking');
  }

  async function sendAgain() {
    setResend('sending');
    const res = await api('/api/auth/link', { body: { email: draft.email.trim() } });
    setResend(res.ok ? 'sent' : 'failed');
  }

  const labels = { answers: t('steps.answers'), details: t('steps.details'), call: t('steps.call'), result: t('steps.result') };

  return (
    <Page>
      <StepHeader current="details" logoAlt={t('brand.logoAlt')} labels={labels} ariaLabel={t('steps.label')} />
      <div data-pad style={s('flex: 1; display: flex; justify-content: center; padding: clamp(40px, 7vh, 84px) 20px 72px')}>
        {phase === 'existing' ? (
          <div data-fx-anim style={s('width: 100%; max-width: 480px; animation: qIn 340ms cubic-bezier(0.2,0,0,1) both')}>
            <h1 data-h1 style={s(H1_STYLE)}>{t('lead.existing.title')}</h1>
            <p style={s(LEDE_STYLE)}>{t.rich('lead.existing.lede', { email: draft.email.trim(), b: (c) => <bdi dir="ltr" style={s('font-weight: 600; color: #14202b')}>{c}</bdi> })}</p>
            <div role="status" style={s('display: flex; align-items: flex-start; gap: 12px; border: 1px solid #ece6dc; background: #fff; padding: 18px 20px; margin-bottom: 24px')}>
              <CheckIcon style={s('flex: none; margin-top: 2px')} />
              <span style={s('font-size: 14.5px; line-height: 1.6; color: #14202b')}>{t('lead.existing.note')}</span>
            </div>
            <div style={s('display: flex; flex-direction: column; align-items: flex-start; gap: 4px')}>
              {resend === 'sent' ? (
                <p role="status" style={s('margin: 6px 0; font-size: 14.5px; line-height: 1.55; color: #2f5a3e')}>{t('lead.existing.resent')}</p>
              ) : (
                <button type="button" disabled={resend === 'sending'} onClick={sendAgain} {...x(LINK_BUTTON, { hover: 'color: #14202b' })}>
                  {t('lead.existing.resend')}
                </button>
              )}
              {resend === 'failed' && <p role="alert" style={s('margin: 4px 0; font-size: 13.5px; color: #a03a2c')}>{t('lead.errors.generic')}</p>}
              <button type="button" onClick={() => setPhase('form')} {...x(LINK_BUTTON, { hover: 'color: #14202b' })}>
                {t('lead.existing.change')}
              </button>
            </div>
          </div>
        ) : (
          <form noValidate onSubmit={submit} data-fx-anim style={s(`width: 100%; max-width: 480px; animation: ${ready ? 'qIn 340ms cubic-bezier(0.2,0,0,1) both' : 'none'}; visibility: ${ready ? 'visible' : 'hidden'}`)}>
            <h1 data-h1 style={s(H1_STYLE)}>{t('lead.title')}</h1>
            <p style={s(LEDE_STYLE)}>{t('lead.lede')}</p>
            <div style={s('display: flex; flex-direction: column; gap: 20px; margin-bottom: 28px')}>
              <div>
                <label htmlFor="lead-name" style={s(LABEL)}>{t('lead.name.label')}</label>
                <input
                  id="lead-name"
                  ref={refs.fullName}
                  type="text"
                  name="name"
                  autoComplete="name"
                  placeholder={t('lead.name.placeholder')}
                  value={draft.fullName}
                  onChange={(e) => update('fullName', e.target.value)}
                  aria-invalid={tried && !validity.name}
                  aria-describedby={tried && !validity.name ? 'lead-name-error' : undefined}
                  {...x(INPUT, { focus: 'border-color: #14202b; outline: none' })}
                />
                {tried && !validity.name && <span id="lead-name-error" role="alert" style={s(ERROR)}>{t('lead.name.error')}</span>}
              </div>
              <div>
                <label htmlFor="lead-email" style={s(LABEL)}>{t('lead.email.label')}</label>
                <input
                  id="lead-email"
                  ref={refs.email}
                  type="email"
                  name="email"
                  dir="ltr"
                  inputMode="email"
                  autoComplete="email"
                  autoCapitalize="none"
                  spellCheck={false}
                  placeholder={t('lead.email.placeholder')}
                  value={draft.email}
                  onChange={(e) => update('email', e.target.value)}
                  aria-invalid={tried && !validity.email}
                  aria-describedby={tried && !validity.email ? 'lead-email-error' : undefined}
                  {...x(INPUT, { focus: 'border-color: #14202b; outline: none' })}
                />
                {tried && !validity.email && <span id="lead-email-error" role="alert" style={s(ERROR)}>{t('lead.email.error')}</span>}
              </div>
              <div>
                <label htmlFor="lead-phone" style={s(LABEL)}>{t('lead.phone.label')}</label>
                <input
                  id="lead-phone"
                  ref={refs.phone}
                  type="tel"
                  name="phone"
                  dir="ltr"
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder={t('lead.phone.placeholder')}
                  value={draft.phone}
                  onChange={(e) => update('phone', e.target.value)}
                  aria-invalid={tried && !validity.phone}
                  aria-describedby={tried && !validity.phone ? 'lead-phone-error lead-phone-hint' : 'lead-phone-hint'}
                  {...x(INPUT, { focus: 'border-color: #14202b; outline: none' })}
                />
                {tried && !validity.phone && <span id="lead-phone-error" role="alert" style={s(ERROR)}>{t('lead.phone.error')}</span>}
                <span id="lead-phone-hint" style={s('display: block; font-size: 13.5px; color: #736d64; margin-top: 7px')}>{t('lead.phone.hint')}</span>
              </div>
            </div>
            {/* honeypot: bots fill every field, people never see this one */}
            <div className="fx-hp" aria-hidden="true">
              <label>
                Website
                <input ref={honeypot} type="text" name="website" tabIndex={-1} autoComplete="off" defaultValue="" />
              </label>
            </div>
            <Turnstile onToken={(token) => (captcha.current = token)} resetKey={captchaReset} />
            {error && <p role="alert" style={s('font-size: 14px; line-height: 1.5; color: #a03a2c; margin: 0 0 16px')}>{t(`lead.errors.${error}`)}</p>}
            <button
              type="submit"
              disabled={phase === 'submitting'}
              aria-busy={phase === 'submitting'}
              {...x(`${PRIMARY_BUTTON}; opacity: ${phase === 'submitting' ? 0.6 : 1}`, { hover: 'background: #1e2f3f', className: 'btn' })}
            >
              {t('lead.continue')}
            </button>
            <div style={s('display: flex; align-items: center; justify-content: center; gap: 8px; margin-top: 18px; font-size: 13.5px; color: #736d64')}>
              <LockIcon />
              <span>{t('lead.privacy')}</span>
            </div>
          </form>
        )}
      </div>
    </Page>
  );
}
