'use client';

import type { Locale } from '@dpl/core';
import { s, x } from '@dpl/ui';
import { useLocale, useTranslations } from 'next-intl';
import { type ChangeEvent, type FormEvent, type ReactNode, useEffect, useId, useRef, useState } from 'react';
import { Link } from '@/i18n/navigation';
import { FIRM } from '@/lib/firm';
import {
  autoCapitalize,
  buildLeadBandPayload,
  firstNameOf,
  leadErrors,
  parseUtm,
  postContact,
  type LeadField,
} from '@/lib/lead-form';

const FONT = "font-family: 'Manrope', system-ui, sans-serif";
const LABEL = 'display: block; font-size: 12.5px; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; color: #736d64; margin-bottom: 8px';
const ERROR = 'font-size: 12.5px; line-height: 1.5; color: #9b2c1f; margin: 6px 0 0';
const input = (invalid: boolean) =>
  `width: 100%; padding: 14px 15px; font-size: 16px; ${FONT}; color: #14202b; border: 1px solid ${invalid ? '#9b2c1f' : '#ece6dc'}; background: #f8f5f0; box-sizing: border-box`;

interface Values {
  name: string;
  phone: string;
  email: string;
  consent: boolean;
  matterIndex: number;
  /** honeypot */
  website: string;
}

const EMPTY: Values = { name: '', phone: '', email: '', consent: false, matterIndex: 0, website: '' };

/**
 * "Need legal advice?" band at the foot of every page except the contact page (#leadform): what happens next on the
 * left, the enquiry form on the right. The button is dimmed until the form is valid (as designed) and the submit
 * handler validates for real. POST /api/contact with kind "lead_band".
 */
export function LeadBand() {
  const t = useTranslations('site');
  const locale = useLocale() as Locale;
  const uid = useId();

  const [values, setValues] = useState<Values>(EMPTY);
  const [touched, setTouched] = useState<Partial<Record<LeadField, boolean>>>({});
  const [attempted, setAttempted] = useState(false);
  const [sending, setSending] = useState(false);
  const [failure, setFailure] = useState<'rate' | 'failed' | null>(null);
  const [sent, setSent] = useState<{ name: string; phone: string; email: string } | null>(null);

  const nameRef = useRef<HTMLInputElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const consentRef = useRef<HTMLInputElement>(null);
  const fieldRefs = { name: nameRef, phone: phoneRef, email: emailRef, consent: consentRef };
  const sentRef = useRef<HTMLDivElement>(null);
  const refocusForm = useRef(false);

  const errors = leadErrors(values, { emailRequired: true });
  const ready = errors.length === 0;
  const shown = (f: LeadField) => errors.includes(f) && (attempted || touched[f] === true);
  const set = (patch: Partial<Values>) => setValues((v) => ({ ...v, ...patch }));
  const blur = (f: LeadField) => setTouched((o) => ({ ...o, [f]: true }));

  useEffect(() => {
    if (sent) sentRef.current?.focus();
    else if (refocusForm.current) {
      refocusForm.current = false;
      nameRef.current?.focus();
    }
  }, [sent]);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (sending) return;
    if (errors.length) {
      setAttempted(true);
      fieldRefs[errors[0]!].current?.focus();
      return;
    }
    setSending(true);
    setFailure(null);
    const result = await postContact(
      buildLeadBandPayload(values, { locale, page: window.location.pathname, utm: parseUtm(window.location.search) }),
    );
    setSending(false);
    if (!result.ok) {
      setFailure(result.reason);
      return;
    }
    setSent({ name: firstNameOf(values.name), phone: values.phone.trim(), email: values.email.trim() });
    setValues((v) => ({ ...EMPTY, matterIndex: v.matterIndex }));
    setTouched({});
    setAttempted(false);
  }

  function another() {
    refocusForm.current = true;
    setSent(null);
    setFailure(null);
  }

  const matters = t.raw('leadBand.matters') as string[];
  const next = t.raw('leadBand.next') as Array<{ num: string; text: string }>;
  const bdi = (chunks: ReactNode) => <bdi>{chunks}</bdi>;
  const phoneTel = t('phones.telAviv');
  const errId = (f: LeadField) => `${uid}-${f}-error`;
  const fieldProps = (f: 'name' | 'phone' | 'email') => ({
    ref: fieldRefs[f],
    id: `${uid}-${f}`,
    name: f,
    required: true,
    'aria-required': true as const,
    'aria-invalid': shown(f) ? (true as const) : undefined,
    'aria-describedby': shown(f) ? errId(f) : undefined,
    onBlur: () => blur(f),
  });

  return (
    <section
      id="leadform"
      data-leadform
      aria-labelledby={`${uid}-title`}
      style={s('background: #efe9df; border-top: 1px solid #ded7ca; margin-top: 96px')}
    >
      <div data-pad style={s('margin: 0 auto; padding: 72px clamp(20px, 4.6vw, 120px) 84px')}>
        <div
          data-resp="2"
          style={s('display: grid; grid-template-columns: minmax(0, 0.85fr) minmax(0, 1.15fr); gap: clamp(28px, 5vw, 80px); align-items: start')}
        >
          <div>
            <div style={s('font-size: 12px; font-weight: 600; letter-spacing: 0.18em; text-transform: uppercase; color: #7a5c2c; margin-bottom: 22px')}>
              {t('leadBand.eyebrow')}
            </div>
            <h2
              id={`${uid}-title`}
              data-big
              style={s("font-family: 'Newsreader', Georgia, serif; font-weight: 400; font-size: clamp(30px, 3.4vw, 48px); line-height: 1.08; letter-spacing: -0.02em; color: #14202b; margin: 0 0 18px; max-width: 18ch")}
            >
              {t('leadBand.title')}
            </h2>
            <p style={s('font-size: 17px; line-height: 1.75; color: #55606b; margin: 0 0 26px; max-width: 46ch')}>{t('leadBand.lede')}</p>
            <div style={s('display: flex; flex-direction: column; gap: 12px; margin: 0 0 26px; padding: 18px 20px; background: #fff; border: 1px solid #ded7ca')}>
              <div style={s('font-size: 12px; font-weight: 700; letter-spacing: 0.18em; text-transform: uppercase; color: #7a5c2c')}>
                {t('leadBand.nextTitle')}
              </div>
              {next.map((step) => (
                <div key={step.num} style={s('display: grid; grid-template-columns: 22px minmax(0, 1fr); gap: 12px; align-items: baseline')}>
                  <span style={s('font-size: 12px; font-weight: 700; letter-spacing: 0.08em; color: #a07a3c')}>{step.num}</span>
                  <span style={s('font-size: 15px; line-height: 1.55; color: #14202b')}>{step.text}</span>
                </div>
              ))}
            </div>
            <div style={s('display: flex; align-items: center; gap: 12px; margin-bottom: 22px')}>
              <span aria-hidden="true" style={s('font-size: 14px; letter-spacing: 0.18em; color: #c9a45c')}>
                ★★★★★
              </span>
              <span style={s('font-size: 14.5px; color: #55606b')}>
                {t.rich('leadBand.rating', {
                  b: (chunks) => <strong style={s('color: #14202b; font-weight: 600')}>{chunks}</strong>,
                  n: (chunks) => <bdi dir="ltr">{chunks}</bdi>,
                })}
              </span>
            </div>
            <div style={s('display: flex; flex-direction: column; gap: 10px; font-size: 15.5px')}>
              <a href={FIRM.telAvivHref} style={s('text-decoration: none')}>
                {t('util.telAviv')} <bdi>{t('phones.telAviv')}</bdi>
              </a>
              <a href={FIRM.jerusalemHref} style={s('text-decoration: none')}>
                {t('util.jerusalem')} <bdi>{t('phones.jerusalem')}</bdi>
              </a>
              <a href={FIRM.mailto} style={s('text-decoration: none')}>
                {FIRM.email}
              </a>
            </div>
          </div>

          <div style={s('background: #fff; border: 1px solid #ded7ca; padding: clamp(22px, 3vw, 36px)')}>
            {sent ? (
              <div ref={sentRef} tabIndex={-1} role="status" aria-live="polite" style={s('padding: 14px 0 6px')}>
                <div style={s('width: 44px; height: 44px; border: 1px solid #3f6b4f; display: grid; place-items: center; margin-bottom: 20px')}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#3f6b4f" strokeWidth="1.6" aria-hidden="true">
                    <path d="m4 12 5 5L20 6" />
                  </svg>
                </div>
                <div style={s("font-family: 'Newsreader', Georgia, serif; font-size: 28px; line-height: 1.15; color: #14202b; margin-bottom: 12px")}>
                  {t.rich('leadBand.sentTitle', { name: sent.name, n: bdi })}
                </div>
                <p style={s('font-size: 16.5px; line-height: 1.7; color: #55606b; margin: 0 0 24px')}>
                  {t.rich('leadBand.sentLine', {
                    phone: sent.phone,
                    email: sent.email,
                    n: (chunks) => <bdi dir="ltr">{chunks}</bdi>,
                  })}
                </p>
                <button
                  type="button"
                  onClick={another}
                  data-linkbtn
                  {...x(
                    `background: none; border: 0; padding: 0; ${FONT}; font-size: 15.5px; font-weight: 600; color: #7a5c2c; cursor: pointer; border-bottom: 1px solid #ded7ca`,
                    { hover: 'border-bottom-color: #7a5c2c' },
                  )}
                >
                  {t('leadBand.another')}
                </button>
              </div>
            ) : (
              <form onSubmit={onSubmit} noValidate>
                <div data-resp="2" style={s('display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; margin-bottom: 16px')}>
                  <div>
                    <label style={s('display: block')}>
                      <span style={s(LABEL)}>{t('leadBand.labels.name')}</span>
                      <input
                        {...fieldProps('name')}
                        type="text"
                        autoComplete="name"
                        value={values.name}
                        onChange={(e: ChangeEvent<HTMLInputElement>) => set({ name: autoCapitalize(e.target.value) })}
                        placeholder={t('leadBand.placeholders.name')}
                        style={s(input(shown('name')))}
                      />
                    </label>
                    {shown('name') && (
                      <p id={errId('name')} style={s(ERROR)}>
                        {t('leadBand.errors.name')}
                      </p>
                    )}
                  </div>
                  <div>
                    <label style={s('display: block')}>
                      <span style={s(LABEL)}>{t('leadBand.labels.phone')}</span>
                      <input
                        {...fieldProps('phone')}
                        type="tel"
                        inputMode="tel"
                        dir="ltr"
                        autoComplete="tel"
                        value={values.phone}
                        onChange={(e) => set({ phone: e.target.value })}
                        placeholder={t('leadBand.placeholders.phone')}
                        style={s(input(shown('phone')))}
                      />
                    </label>
                    {shown('phone') && (
                      <p id={errId('phone')} style={s(ERROR)}>
                        {t('leadBand.errors.phone')}
                      </p>
                    )}
                  </div>
                </div>
                <div data-resp="2" style={s('display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; margin-bottom: 18px')}>
                  <div>
                    <label style={s('display: block')}>
                      <span style={s(LABEL)}>{t('leadBand.labels.email')}</span>
                      <input
                        {...fieldProps('email')}
                        type="email"
                        inputMode="email"
                        dir="ltr"
                        autoComplete="email"
                        value={values.email}
                        onChange={(e) => set({ email: e.target.value })}
                        placeholder={t('leadBand.placeholders.email')}
                        style={s(input(shown('email')))}
                      />
                    </label>
                    {shown('email') && (
                      <p id={errId('email')} style={s(ERROR)}>
                        {t('leadBand.errors.email')}
                      </p>
                    )}
                  </div>
                  <label style={s('display: block')}>
                    <span style={s(LABEL)}>{t('leadBand.labels.matter')}</span>
                    <select
                      name="matter"
                      value={String(values.matterIndex)}
                      onChange={(e) => set({ matterIndex: Number(e.target.value) })}
                      style={s(input(false))}
                    >
                      {matters.map((label, i) => (
                        <option key={label} value={String(i)}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

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

                <label style={s('display: flex; align-items: flex-start; gap: 12px; cursor: pointer; margin-bottom: 20px')}>
                  <input
                    ref={consentRef}
                    id={`${uid}-consent`}
                    type="checkbox"
                    name="consent"
                    checked={values.consent}
                    onChange={(e) => set({ consent: e.target.checked })}
                    required
                    aria-required="true"
                    aria-invalid={shown('consent') ? true : undefined}
                    aria-describedby={shown('consent') ? errId('consent') : undefined}
                    style={s('width: 18px; height: 18px; margin: 2px 0 0; accent-color: #a07a3c; flex: none')}
                  />
                  <span style={s('font-size: 14px; line-height: 1.6; color: #55606b')}>
                    {t.rich('leadBand.consent', {
                      privacy: (chunks) => (
                        <Link href="/privacy" data-linkbtn style={s('display: inline-block; font-size: 14px; color: #7a5c2c; cursor: pointer; text-decoration: underline; text-underline-offset: auto')}>
                          {chunks}
                        </Link>
                      ),
                    })}
                  </span>
                </label>
                {shown('consent') && (
                  <p id={errId('consent')} style={s(`${ERROR}; margin: -10px 0 18px`)}>
                    {t('leadBand.errors.consent')}
                  </p>
                )}

                {failure && (
                  <p
                    role="alert"
                    style={s('font-size: 14px; line-height: 1.55; color: #7a2418; background: #fbf3f1; border-left: 3px solid #9b2c1f; padding: 12px 14px; margin: 0 0 16px')}
                  >
                    {t.rich(failure === 'rate' ? 'leadBand.errors.rate' : 'leadBand.errors.failed', {
                      phone: phoneTel,
                      n: (chunks) => <bdi dir="ltr">{chunks}</bdi>,
                    })}
                  </p>
                )}

                <button
                  type="submit"
                  aria-disabled={!ready || sending}
                  aria-busy={sending}
                  style={s(
                    `border-radius: 999px; width: 100%; background: #14202b; color: #f8f5f0; border: 1px solid #14202b; ${FONT}; font-weight: 700; font-size: 15.5px; letter-spacing: 0.05em; padding: 18px; cursor: pointer; opacity: ${sending ? 0.7 : ready ? 1 : 0.35}; pointer-events: ${ready && !sending ? 'auto' : 'none'}`,
                  )}
                >
                  {sending ? t('leadBand.sending') : t('leadBand.submit')}
                </button>
                <p style={s('font-size: 12.5px; line-height: 1.6; color: #736d64; margin: 12px 0 0')}>{t('leadBand.disclaimer')}</p>
              </form>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
