'use client';

import type { Locale } from '@dpl/core';
import { s, x } from '@dpl/ui';
import { useLocale, useTranslations } from 'next-intl';
import { type FormEvent, type ReactNode, useEffect, useId, useRef, useState } from 'react';
import { TURNSTILE_SITE_KEY, Turnstile } from '@/components/contact/Turnstile';
import { Link } from '@/i18n/navigation';
import { currentAttribution } from '@/lib/shell/attribution';
import {
  autoCapitalize,
  buildChatPayload,
  firstNameOf,
  leadErrors,
  postContact,
  type LeadField,
} from '@/lib/shell/lead-form';
import { Ltr } from './Ltr';
import { useDialog } from './useDialog';

const FONT = "font-family: 'Manrope', system-ui, sans-serif";
const BUBBLE = 'font-size: 14.5px; line-height: 1.6; color: #14202b; background: #ece6dc; padding: 12px 15px; max-width: 90%';
const ERROR = 'font-size: 12.5px; line-height: 1.5; color: #9b2c1f; margin: -4px 0 0';
const input = (invalid: boolean) =>
  `width: 100%; padding: 13px 14px; font-size: 15.5px; ${FONT}; color: #14202b; border: 1px solid ${invalid ? '#9b2c1f' : '#ded7ca'}; background: #fff; box-sizing: border-box`;

interface Props {
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
}

interface Values {
  name: string;
  phone: string;
  email: string;
  consent: boolean;
  website: string;
}
const EMPTY: Values = { name: '', phone: '', email: '', consent: false, website: '' };

/**
 * Scripted chat in two steps: the visitor picks what the enquiry is about, then leaves name, phone, an optional email
 * and consent, and an attorney calls back. There is no live agent: the details go to POST /api/contact with kind "chat".
 */
export function ChatWidget({ open, onToggle, onClose }: Props) {
  const t = useTranslations('site');
  const locale = useLocale() as Locale;
  const uid = useId();

  const [topic, setTopic] = useState<number | null>(null);
  const [values, setValues] = useState<Values>(EMPTY);
  const [touched, setTouched] = useState<Partial<Record<LeadField, boolean>>>({});
  const [attempted, setAttempted] = useState(false);
  const [sending, setSending] = useState(false);
  const [failure, setFailure] = useState<'rate' | 'captcha' | 'failed' | null>(null);
  const captcha = TURNSTILE_SITE_KEY !== '';
  const [token, setToken] = useState<string | null>(null);
  const [tokenRound, setTokenRound] = useState(0);
  const [sent, setSent] = useState<{ name: string; phone: string } | null>(null);

  const panelRef = useRef<HTMLDivElement>(null);
  const launcherRef = useRef<HTMLButtonElement>(null);
  const doneRef = useRef<HTMLDivElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const consentRef = useRef<HTMLInputElement>(null);
  const fieldRefs = { name: nameRef, phone: phoneRef, email: emailRef, consent: consentRef };
  const onKeyDown = useDialog(open, { containerRef: panelRef, returnFocusRef: launcherRef, onClose });

  const topics = t.raw('chat.topics') as string[];
  const step = sent ? 2 : topic === null ? 0 : 1;
  const errors = leadErrors(values, { emailRequired: false });
  const ready = errors.length === 0;
  const shown = (f: LeadField) => errors.includes(f) && (attempted || touched[f] === true);
  const set = (patch: Partial<Values>) => setValues((v) => ({ ...v, ...patch }));
  const blur = (f: LeadField) => setTouched((o) => ({ ...o, [f]: true }));
  const errId = (f: LeadField) => `${uid}-${f}-error`;

  // the topic buttons disappear when one is chosen: keep focus moving forward
  useEffect(() => {
    if (step === 1) nameRef.current?.focus();
    if (step === 2) doneRef.current?.focus();
  }, [step]);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (sending || topic === null) return;
    if (errors.length) {
      setAttempted(true);
      fieldRefs[errors[0]!].current?.focus();
      return;
    }
    if (captcha && !token) {
      setFailure('captcha');
      return;
    }
    setSending(true);
    setFailure(null);
    const payload = buildChatPayload({ ...values, topicIndex: topic }, { locale, page: window.location.pathname, ...currentAttribution() });
    const result = await postContact(captcha ? { ...payload, turnstileToken: token ?? undefined } : payload);
    // a Turnstile token is good for one submission
    setToken(null);
    setTokenRound((r) => r + 1);
    setSending(false);
    if (!result.ok) {
      setFailure(result.reason);
      return;
    }
    setSent({ name: firstNameOf(values.name), phone: values.phone.trim() });
    setValues(EMPTY);
    setTouched({});
    setAttempted(false);
  }

  const bdi = (chunks: ReactNode) => <bdi>{chunks}</bdi>;
  const prompt = sent ? t('chat.promptSent') : step === 0 ? t('chat.promptTopics') : t('chat.promptForm');
  const fieldProps = (f: 'name' | 'phone' | 'email') => ({
    ref: fieldRefs[f],
    id: `${uid}-${f}`,
    name: f,
    'aria-invalid': shown(f) ? (true as const) : undefined,
    'aria-describedby': shown(f) ? errId(f) : undefined,
    onBlur: () => blur(f),
  });

  return (
    <div
      data-chat-wrap
      data-float
      style={s('position: fixed; right: 22px; bottom: 22px; z-index: 51; display: flex; flex-direction: column; align-items: flex-end; gap: 12px')}
    >
      {open && (
        <div
          ref={panelRef}
          id={`${uid}-dialog`}
          role="dialog"
          aria-label={t('chat.dialog')}
          tabIndex={-1}
          data-chat
          className="dpl-dialog"
          onKeyDown={onKeyDown}
          style={s(
            `width: 372px; max-width: calc(100vw - 44px); background: #f8f5f0; border: 1px solid #14202b; box-shadow: 0 26px 70px rgba(20,32,43,0.26); display: flex; flex-direction: column; max-height: min(78vh, 640px); ${FONT}; animation: fadeIn 180ms ease both`,
          )}
        >
          <div style={s('display: flex; align-items: center; gap: 12px; padding: 16px 18px; background: #14202b; color: #f8f5f0')}>
            <span
              aria-hidden="true"
              style={s("width: 34px; height: 34px; border-radius: 50%; background: rgba(248,245,240,0.14); display: grid; place-items: center; font-family: 'Newsreader', Georgia, serif; font-size: 15px")}
            >
              {t('chat.initials')}
            </span>
            <span style={s('flex: 1')}>
              <span style={s('display: block; font-size: 15px; font-weight: 600')}>{t('chat.name')}</span>
              <span style={s('display: flex; align-items: center; gap: 7px; font-size: 12.5px; opacity: 0.72; margin-top: 2px')}>
                <i aria-hidden="true" style={s('width: 7px; height: 7px; border-radius: 50%; background: #6f9a7c; display: block')} />
                {t('chat.status')}
              </span>
            </span>
            <button
              type="button"
              aria-label={t('chat.close')}
              onClick={() => {
                onClose();
                launcherRef.current?.focus();
              }}
              style={s('background: transparent; border: 0; color: #f8f5f0; opacity: 0.75; cursor: pointer; font-size: 20px; line-height: 1; padding: 4px 6px')}
            >
              ×
            </button>
          </div>

          <div style={s('padding: 18px; overflow-y: auto; display: flex; flex-direction: column; gap: 12px; flex: 1')}>
            <div style={s(`${BUBBLE}; border-radius: 2px 12px 12px 12px`)}>{t('chat.greeting')}</div>
            <div style={s(`${BUBBLE}; border-radius: 12px`)} aria-live="polite">
              {prompt}
            </div>
            {topic !== null && (
              <div
                style={s('font-size: 14.5px; color: #f8f5f0; background: #14202b; padding: 11px 15px; border-radius: 12px 2px 12px 12px; margin-left: auto; width: fit-content; max-width: 86%')}
              >
                {topics[topic]}
              </div>
            )}

            {step === 0 && (
              <div style={s('display: flex; flex-direction: column; gap: 8px; margin-top: 2px')}>
                {topics.map((label, i) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => setTopic(i)}
                    {...x(
                      `text-align: left; cursor: pointer; ${FONT}; font-size: 15px; color: #14202b; background: #fff; border: 1px solid #ded7ca; padding: 13px 15px; transition: border-color 160ms ease`,
                      { hover: 'border-color: #14202b' },
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}

            {step === 1 && (
              <form onSubmit={onSubmit} noValidate style={s('display: flex; flex-direction: column; gap: 10px; margin-top: 4px')}>
                {captcha && <Turnstile locale={locale} onToken={setToken} resetSignal={tokenRound} />}
                <input
                  {...fieldProps('name')}
                  type="text"
                  autoComplete="name"
                  required
                  aria-required="true"
                  value={values.name}
                  onChange={(e) => set({ name: autoCapitalize(e.target.value) })}
                  placeholder={t('chat.placeholders.name')}
                  aria-label={t('chat.placeholders.name')}
                  style={s(input(shown('name')))}
                />
                {shown('name') && (
                  <p id={errId('name')} style={s(ERROR)}>
                    {t('chat.errors.name')}
                  </p>
                )}
                <input
                  {...fieldProps('phone')}
                  type="tel"
                  inputMode="tel"
                  dir="ltr"
                  autoComplete="tel"
                  required
                  aria-required="true"
                  value={values.phone}
                  onChange={(e) => set({ phone: e.target.value })}
                  placeholder={t('chat.placeholders.phone')}
                  aria-label={t('chat.placeholders.phone')}
                  style={s(input(shown('phone')))}
                />
                {shown('phone') && (
                  <p id={errId('phone')} style={s(ERROR)}>
                    {t('chat.errors.phone')}
                  </p>
                )}
                <input
                  {...fieldProps('email')}
                  type="email"
                  inputMode="email"
                  dir="ltr"
                  autoComplete="email"
                  value={values.email}
                  onChange={(e) => set({ email: e.target.value })}
                  placeholder={t('chat.placeholders.email')}
                  aria-label={t('chat.emailOptional')}
                  style={s(input(shown('email')))}
                />
                {shown('email') && (
                  <p id={errId('email')} style={s(ERROR)}>
                    {t('chat.errors.email')}
                  </p>
                )}
                <input
                  className="dpl-hp"
                  type="text"
                  name="website"
                  tabIndex={-1}
                  autoComplete="off"
                  data-lpignore="true"
                  data-1p-ignore
                  aria-hidden="true"
                  value={values.website}
                  onChange={(e) => set({ website: e.target.value })}
                />
                <label style={s('display: flex; align-items: flex-start; gap: 10px; cursor: pointer')}>
                  <input
                    ref={consentRef}
                    type="checkbox"
                    name="consent"
                    checked={values.consent}
                    onChange={(e) => set({ consent: e.target.checked })}
                    required
                    aria-required="true"
                    aria-invalid={shown('consent') ? true : undefined}
                    aria-describedby={shown('consent') ? errId('consent') : undefined}
                    style={s('width: 17px; height: 17px; margin: 2px 0 0; accent-color: #a07a3c; flex: none')}
                  />
                  <span style={s('font-size: 13px; line-height: 1.55; color: #55606b')}>
                    {t.rich('chat.consent', {
                      privacy: (chunks) => (
                        <Link href="/privacy" data-linkbtn style={s('display: inline-block; font-size: 13px; color: #7a5c2c; cursor: pointer; text-decoration: underline; text-underline-offset: auto')}>
                          {chunks}
                        </Link>
                      ),
                    })}
                  </span>
                </label>
                {shown('consent') && (
                  <p id={errId('consent')} style={s(ERROR)}>
                    {t('chat.errors.consent')}
                  </p>
                )}
                {failure && (
                  <p
                    role="alert"
                    style={s('font-size: 13.5px; line-height: 1.55; color: #7a2418; background: #fbf3f1; border-left: 3px solid #9b2c1f; padding: 10px 12px; margin: 0')}
                  >
                    {t.rich(failure === 'rate' ? 'chat.errors.rate' : failure === 'captcha' ? 'chat.errors.captcha' : 'chat.errors.failed', {
                      phone: t('phones.telAviv'),
                      n: (chunks) => <Ltr>{chunks}</Ltr>,
                    })}
                  </p>
                )}
                <button
                  type="submit"
                  aria-disabled={!ready || sending}
                  aria-busy={sending}
                  style={s(
                    `border-radius: 999px; background: #14202b; color: #f8f5f0; border: 1px solid #14202b; ${FONT}; font-weight: 700; font-size: 15px; padding: 15px; cursor: pointer; opacity: ${sending ? 0.7 : ready ? 1 : 0.35}; pointer-events: ${sending ? 'none' : 'auto'}`,
                  )}
                >
                  {sending ? t('chat.sending') : t('chat.submit')}
                </button>
              </form>
            )}

            {step === 2 && sent && (
              <div ref={doneRef} tabIndex={-1} role="status" style={s('border: 1px solid #ded7ca; background: #fff; padding: 16px 18px')}>
                <div style={s("font-family: 'Newsreader', Georgia, serif; font-size: 20px; line-height: 1.2; color: #14202b; margin-bottom: 8px")}>
                  {t.rich('chat.doneTitle', { name: sent.name, n: bdi })}
                </div>
                <p style={s('font-size: 14.5px; line-height: 1.6; color: #55606b; margin: 0')}>
                  {t.rich('chat.doneLine', { phone: sent.phone, n: (chunks) => <Ltr>{chunks}</Ltr> })}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
      <button
        ref={launcherRef}
        type="button"
        onClick={onToggle}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? `${uid}-dialog` : undefined}
        {...x(
          `display: flex; align-items: center; gap: 11px; background: #14202b; color: #f8f5f0; border: 2px solid #f8f5f0; box-shadow: 0 10px 30px rgba(20,32,43,0.3); cursor: pointer; ${FONT}; font-size: 15px; font-weight: 600; padding: 14px 22px; border-radius: 40px`,
          { hover: 'background: #22323f' },
        )}
      >
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" style={{ flex: 'none' }} aria-hidden="true">
          <path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 9 9 0 0 1-3.8-.8L3 21l1.9-5.1A8.4 8.4 0 0 1 12 3a8.4 8.4 0 0 1 9 8.5z" />
        </svg>
        {sent ? t('chat.launcherSent') : t('chat.launcher')}
      </button>
    </div>
  );
}
