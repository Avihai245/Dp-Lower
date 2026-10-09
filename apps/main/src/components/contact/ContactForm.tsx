'use client';

import { s, x } from '@dpl/ui';
import { useTranslations } from 'next-intl';
import { useEffect, useId, useRef, useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react';
import { Link } from '@/i18n/navigation';
import { currentAttribution } from '@/lib/shell/attribution';
import { SANS, SERIF } from '../pages/tokens';
import { Eyebrow } from '../pages/ui';
import { postContact, type SubmitFailure } from './submit';
import { TURNSTILE_SITE_KEY, Turnstile } from './Turnstile';
import {
  LIMITS,
  capitalizeNameInput,
  firstInvalidField,
  firstNameOf,
  toPayload,
  validateContact,
  type ContactField,
  type ContactValues,
} from './validation';

export interface MatterOption {
  /** what is sent to the firm: the English label, whatever language the page is in */
  value: string;
  label: string;
}

export interface ContactFormProps {
  locale: 'en' | 'he';
  matters: MatterOption[];
  /** the Tel Aviv office's number, offered when something goes wrong and in the "urgent" line */
  urgentTel: { display: string; href: string };
}

const ERROR_COLOR = '#9a3b2e';
const LABEL_CSS =
  'display: block; font-size: 12.5px; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; color: #736d64; margin-bottom: 8px';
const controlCss = (invalid: boolean) =>
  `width: 100%; padding: 15px 16px; font-size: 16px; font-family: ${SANS}; color: #14202b; border: 1px solid ${invalid ? ERROR_COLOR : '#ece6dc'}; background: #f8f5f0; box-sizing: border-box`;
const ERROR_CSS = `font-size: 13px; line-height: 1.5; color: ${ERROR_COLOR}; margin: 6px 0 0`;
const LINK_BUTTON_CSS = `background: none; border: 0; padding: 0; font-family: ${SANS}; font-size: 14.5px; font-weight: 600; color: #7a5c2c; cursor: pointer; border-bottom: 1px solid #ece6dc`;

const EMPTY: Omit<ContactValues, 'matter'> = { name: '', email: '', phone: '', note: '', consent: false };

const FAILURE_MESSAGE: Record<SubmitFailure, 'failed.rate' | 'failed.captcha' | 'failed.generic'> = {
  rate_limited: 'failed.rate',
  captcha: 'failed.captcha',
  invalid: 'failed.generic',
  network: 'failed.generic',
  server: 'failed.generic',
};

type Phase = 'editing' | 'sending' | 'sent';

export function ContactForm({ locale, matters, urgentTel }: ContactFormProps) {
  const t = useTranslations('forms.contact');
  const uid = useId();
  const [values, setValues] = useState<ContactValues>({ ...EMPTY, matter: matters[0]?.value ?? '' });
  const [website, setWebsite] = useState('');
  const [attempted, setAttempted] = useState(false);
  const [phase, setPhase] = useState<Phase>('editing');
  const [failure, setFailure] = useState<SubmitFailure | null>(null);
  const [sentTo, setSentTo] = useState({ name: '', phone: '', email: '' });
  const [announcement, setAnnouncement] = useState('');
  const [token, setToken] = useState<string | null>(null);
  const [tokenRound, setTokenRound] = useState(0);

  const fields = useRef<Partial<Record<ContactField, HTMLInputElement | null>>>({});
  const sentHeading = useRef<HTMLHeadingElement>(null);
  const focusNameNext = useRef(false);
  const announceTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const captcha = TURNSTILE_SITE_KEY !== '';

  // inline errors appear after the first attempt to send, and then follow the typing
  const errors = attempted ? validateContact(values) : {};
  const ready = Object.keys(validateContact(values)).length === 0;
  const sending = phase === 'sending';

  useEffect(() => {
    if (phase === 'sent') sentHeading.current?.focus();
    if (phase === 'editing' && focusNameNext.current) {
      focusNameNext.current = false;
      fields.current.name?.focus();
    }
  }, [phase]);

  useEffect(() => () => clearTimeout(announceTimer.current), []);

  /** Text for the live region. It is cleared first so that the same sentence is announced again on a second attempt. */
  const announce = (text: string) => {
    clearTimeout(announceTimer.current);
    setAnnouncement('');
    if (text) announceTimer.current = setTimeout(() => setAnnouncement(text), 60);
  };

  const set = <K extends keyof ContactValues>(key: K, value: ContactValues[K]) =>
    setValues((v) => ({ ...v, [key]: value }));

  function onNameChange(e: ChangeEvent<HTMLInputElement>) {
    const input = e.target;
    const next = capitalizeNameInput(input.value);
    if (next !== input.value) {
      // same length, so the caret can stay where the visitor is typing
      const caret = input.selectionStart;
      input.value = next;
      if (caret !== null) input.setSelectionRange(caret, caret);
    }
    set('name', next);
  }

  async function send() {
    if (sending) return;
    setAttempted(true);
    setFailure(null);
    const problems = validateContact(values);
    const first = firstInvalidField(problems);
    if (first) {
      announce(t('errors.summary'));
      fields.current[first]?.focus();
      return;
    }
    if (captcha && !token) {
      // the security check has not produced a token yet (or it expired)
      setFailure('captcha');
      setTokenRound((n) => n + 1);
      return;
    }
    setPhase('sending');
    announce(t('sending'));
    const payload = toPayload(values, {
      locale,
      page: window.location.pathname,
      website,
      ...currentAttribution(),
    });
    const result = await postContact(captcha ? { ...payload, turnstileToken: token ?? undefined } : payload);
    if (captcha) {
      // a token is good for one submission only
      setToken(null);
      setTokenRound((n) => n + 1);
    }
    announce('');
    if (result.ok) {
      setSentTo({ name: values.name, phone: values.phone.trim(), email: values.email.trim() });
      setPhase('sent');
      return;
    }
    setFailure(result.reason);
    setPhase('editing');
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void send();
  }

  function startAgain() {
    setValues((v) => ({ ...EMPTY, matter: v.matter }));
    setWebsite('');
    setAttempted(false);
    setFailure(null);
    focusNameNext.current = true;
    setPhase('editing');
  }

  const telLink = (chunks: ReactNode) => (
    <a href={urgentTel.href}>
      <bdi>{chunks}</bdi>
    </a>
  );
  const ltr = (chunks: ReactNode) => <bdi>{chunks}</bdi>;
  const errorId = (field: ContactField) => `${uid}-${field}-error`;
  const fieldProps = (field: ContactField) => ({
    'aria-invalid': errors[field] ? (true as const) : undefined,
    'aria-describedby': errors[field] ? errorId(field) : undefined,
    className: errors[field] ? 'dpl-field-error' : undefined,
  });
  const fieldError = (field: ContactField) =>
    errors[field] ? (
      <p id={errorId(field)} style={s(ERROR_CSS)}>
        {t(`errors.${field}`)}
      </p>
    ) : null;

  if (phase === 'sent') {
    const firstName = firstNameOf(sentTo.name);
    return (
      <div style={s('padding: 20px 0 8px')}>
        <div
          style={s(
            'width: 46px; height: 46px; border: 1px solid #3f6b4f; display: grid; place-items: center; margin-bottom: 24px',
          )}
        >
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#3f6b4f"
            strokeWidth="1.6"
            aria-hidden="true"
            focusable="false"
          >
            <path d="m4 12 5 5L20 6" />
          </svg>
        </div>
        <h2
          ref={sentHeading}
          tabIndex={-1}
          style={s(
            `font-family: ${SERIF}; font-size: 30px; line-height: 1.15; color: #14202b; margin: 0 0 14px; outline: 0`,
          )}
        >
          {t.rich('sent.title', { name: firstName, ltr })}
        </h2>
        <p role="status" style={s('font-size: 16.5px; line-height: 1.7; color: #55606b; margin: 0 0 12px')}>
          {t.rich('sent.line', { phone: sentTo.phone, email: sentTo.email, ltr })}
        </p>
        <p style={s('font-size: 16.5px; line-height: 1.7; color: #55606b; margin: 0 0 28px')}>
          {t.rich('sent.urgent', { number: urgentTel.display, tel: telLink })}
        </p>
        <button
          type="button"
          data-linkbtn=""
          onClick={startAgain}
          {...x(LINK_BUTTON_CSS, { hover: 'border-bottom-color: #7a5c2c' })}
        >
          {t('sent.again')}
        </button>
      </div>
    );
  }

  return (
    <form method="post" noValidate onSubmit={onSubmit} aria-labelledby={`${uid}-title`} aria-busy={sending}>
      <Eyebrow as="h2" strong id={`${uid}-title`}>
        {t('eyebrow')}
      </Eyebrow>
      <noscript>
        <p style={s('font-size: 14px; line-height: 1.55; color: #a03a2c; margin: 0 0 14px')}>{t('noscript')}</p>
      </noscript>
      <div style={s('display: flex; flex-direction: column; gap: 18px')}>
        <div>
          <label style={s('display: block')}>
            <span style={s(LABEL_CSS)}>{t('fields.name.label')}</span>
            <input
              ref={(el) => {
                fields.current.name = el;
              }}
              type="text"
              name="name"
              value={values.name}
              onChange={onNameChange}
              placeholder={t('fields.name.placeholder')}
              autoComplete="name"
              maxLength={LIMITS.name}
              aria-required="true"
              {...fieldProps('name')}
              style={s(controlCss(!!errors.name))}
            />
          </label>
          {fieldError('name')}
        </div>
        <div
          data-resp="2"
          style={s('display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 18px')}
        >
          <div>
            <label style={s('display: block')}>
              <span style={s(LABEL_CSS)}>{t('fields.email.label')}</span>
              <input
                ref={(el) => {
                  fields.current.email = el;
                }}
                type="email"
                name="email"
                dir="ltr"
                inputMode="email"
                value={values.email}
                onChange={(e) => set('email', e.target.value)}
                placeholder={t('fields.email.placeholder')}
                autoComplete="email"
                autoCapitalize="none"
                spellCheck={false}
                maxLength={LIMITS.email}
                aria-required="true"
                {...fieldProps('email')}
                style={s(controlCss(!!errors.email))}
              />
            </label>
            {fieldError('email')}
          </div>
          <div>
            <label style={s('display: block')}>
              <span style={s(LABEL_CSS)}>{t('fields.phone.label')}</span>
              <input
                ref={(el) => {
                  fields.current.phone = el;
                }}
                type="tel"
                name="phone"
                dir="ltr"
                inputMode="tel"
                value={values.phone}
                onChange={(e) => set('phone', e.target.value)}
                placeholder={t('fields.phone.placeholder')}
                autoComplete="tel"
                maxLength={LIMITS.phone}
                aria-required="true"
                {...fieldProps('phone')}
                style={s(controlCss(!!errors.phone))}
              />
            </label>
            {fieldError('phone')}
          </div>
        </div>
        <label style={s('display: block')}>
          <span style={s(LABEL_CSS)}>{t('fields.matter.label')}</span>
          <select
            name="matter"
            value={values.matter}
            onChange={(e) => set('matter', e.target.value)}
            style={s(controlCss(false))}
          >
            {matters.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </label>
        <label style={s('display: block')}>
          <span style={s(LABEL_CSS)}>{t('fields.note.label')}</span>
          <textarea
            name="note"
            rows={4}
            value={values.note}
            onChange={(e) => set('note', e.target.value)}
            placeholder={t('fields.note.placeholder')}
            maxLength={LIMITS.note}
            style={s(`${controlCss(false)}; line-height: 1.6; resize: vertical`)}
          />
        </label>
        <div>
          <label style={s('display: flex; align-items: flex-start; gap: 12px; cursor: pointer')}>
            <input
              ref={(el) => {
                fields.current.consent = el;
              }}
              type="checkbox"
              name="consent"
              checked={values.consent}
              onChange={(e) => set('consent', e.target.checked)}
              aria-required="true"
              {...fieldProps('consent')}
              style={s('width: 18px; height: 18px; margin: 2px 0 0; accent-color: #a07a3c; flex: none')}
            />
            <span style={s('font-size: 14px; line-height: 1.6; color: #55606b')}>
              {t.rich('consent', {
                privacy: (chunks) => (
                  <Link href="/privacy" target="_blank" rel="noopener">
                    {chunks}
                  </Link>
                ),
              })}
            </span>
          </label>
          {fieldError('consent')}
        </div>

        {failure && (
          <div
            role="alert"
            style={s(`border: 1px solid ${ERROR_COLOR}; background: #fbf3f1; padding: 16px 18px`)}
          >
            <div
              style={s(
                `font-family: ${SERIF}; font-size: 20px; line-height: 1.2; color: #14202b; margin-bottom: 8px`,
              )}
            >
              {t('failed.title')}
            </div>
            <p style={s('font-size: 14.5px; line-height: 1.6; color: #55606b; margin: 0 0 12px')}>
              {t.rich(FAILURE_MESSAGE[failure], { number: urgentTel.display, tel: telLink })}
            </p>
            <button
              type="button"
              data-linkbtn=""
              onClick={() => void send()}
              {...x(LINK_BUTTON_CSS, { hover: 'border-bottom-color: #7a5c2c' })}
            >
              {t('failed.retry')}
            </button>
          </div>
        )}

        <div>
          {captcha && <Turnstile locale={locale} onToken={setToken} resetSignal={tokenRound} />}
          <button
            type="submit"
            aria-disabled={sending}
            style={s(
              `display: block; border-radius: 999px; width: 100%; background: #14202b; color: #f8f5f0; border: 1px solid #14202b; font-family: ${SANS}; font-weight: 700; font-size: 15.5px; letter-spacing: 0.05em; padding: 19px; cursor: ${sending ? 'progress' : 'pointer'}; opacity: ${sending ? '0.6' : ready ? '1' : '0.35'}; pointer-events: ${sending ? 'none' : 'auto'}`,
            )}
          >
            {sending ? t('sending') : t('submit')}
          </button>
        </div>
        <p style={s('font-size: 12.5px; line-height: 1.6; color: #736d64; margin: 0')}>{t('disclaimer')}</p>
      </div>

      {/* honeypot: people never reach it, bots fill it */}
      <div className="dpl-hp" aria-hidden="true">
        <label>
          {t('honeypot')}
          <input
            type="text"
            name="website"
            tabIndex={-1}
            autoComplete="off"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
          />
        </label>
      </div>
      <p role="status" className="dpl-sr-only">
        {announcement}
      </p>
    </form>
  );
}
