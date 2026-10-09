'use client';
import { phoneSchema, type Locale } from '@dpl/core';
import { s, x } from '@dpl/ui';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { formatClock } from './model/format';
import { fullNameSchema } from './model/schemas';
import { richTags, useFocusTrap } from './shared';

const FIELD_BASE =
  "width: 100%; padding: 14px 16px; font-size: 16px; font-family: 'Manrope', system-ui, sans-serif; color: #14202b; border: 1px solid #ddd5c8; background: #fff; border-radius: 12px; box-sizing: border-box";
const LABEL = 'display: block; font-size: 13.5px; font-weight: 600; color: #14202b; margin-bottom: 7px';
const ERROR = 'display: block; font-size: 13px; color: #a03a2c; margin-top: 6px';

const Check = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#2f5a3e" strokeWidth="2" aria-hidden="true" style={s('flex: none; margin-top: 2px')}>
    <path d="m4 12.5 5 5L20 6.5" />
  </svg>
);

export interface DetailsValues {
  fullName: string;
  phone: string | null;
}

/**
 * "My details": the applicant corrects their name and phone (the prototype's rules: a first and a last name, seven
 * digits). The email is shown but not editable here: changing it needs verification, which the firm does. The password
 * section sends the same reset link as "Forgot it?" on the sign-in page.
 */
export function MyDetailsModal({
  lead,
  onClose,
  onSaved,
}: {
  lead: { fullName: string; email: string; phone: string | null };
  onClose: () => void;
  onSaved: (values: DetailsValues) => void;
}) {
  const t = useTranslations('portal.details');
  const locale = useLocale() as Locale;
  const [name, setName] = useState(lead.fullName);
  const [phone, setPhone] = useState(lead.phone ?? '');
  const [tried, setTried] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [resetAt, setResetAt] = useState<string | null>(null);
  const [resetFailed, setResetFailed] = useState(false);

  const cardRef = useRef<HTMLDivElement>(null);
  useFocusTrap(cardRef, true);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const nameOk = fullNameSchema.safeParse(name).success;
  const phoneOk = phoneSchema.safeParse(phone).success;
  const edit = (setter: (v: string) => void) => (e: { target: { value: string } }) => {
    setter(e.target.value);
    setSaved(false);
    setSaveFailed(false);
  };

  const save = async () => {
    if (!nameOk || !phoneOk) {
      setTried(true);
      return;
    }
    setSaving(true);
    setSaveFailed(false);
    const res = await api<{ lead: { fullName: string; phone: string | null } }>('/api/portal/details', {
      method: 'PATCH',
      body: { fullName: name.trim(), phone: phone.trim() },
    });
    setSaving(false);
    if (!res.ok || !res.data) {
      setSaveFailed(true);
      return;
    }
    setTried(false);
    setSaved(true);
    setName(res.data.lead.fullName);
    onSaved({ fullName: res.data.lead.fullName, phone: res.data.lead.phone });
  };

  const sendReset = async () => {
    setResetting(true);
    setResetFailed(false);
    const res = await api('/api/auth/forgot', { method: 'POST', body: { email: lead.email, locale } });
    setResetting(false);
    if (!res.ok) {
      setResetFailed(true);
      return;
    }
    setResetAt(formatClock(new Date(), locale));
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t('title')}
      style={s("position: fixed; inset: 0; z-index: 95; display: flex; align-items: center; justify-content: center; padding: 16px; font-family: 'Manrope', system-ui, sans-serif")}
    >
      <div onClick={onClose} aria-hidden="true" style={s('position: absolute; inset: 0; background: rgba(20,32,43,0.55); animation: fadeIn 200ms ease both')} />
      <div
        ref={cardRef}
        data-edit-card
        style={s(
          'position: relative; width: 100%; max-width: 480px; max-height: calc(100vh - 32px); overflow-y: auto; box-sizing: border-box; background: #fff; border-radius: 22px; padding: 28px 28px 26px; box-shadow: 0 24px 60px rgba(20,32,43,0.28); color: #14202b; animation: qIn 260ms cubic-bezier(0.2,0,0,1) both',
        )}
      >
        <div style={s('display: flex; align-items: flex-start; gap: 16px; margin-bottom: 22px')}>
          <div style={s('flex: 1; min-width: 0')}>
            <div style={s('font-size: 12px; font-weight: 600; letter-spacing: 0.14em; text-transform: uppercase; color: #a07a3c; margin-bottom: 6px')}>
              {t('kicker')}
            </div>
            <div style={s("font-family: 'Newsreader', Georgia, serif; font-size: 27px; line-height: 1.15")}>{t('title')}</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('close')}
            {...x('width: 40px; height: 40px; flex: none; border-radius: 50%; border: 1px solid #e2dbcf; background: #fff; cursor: pointer; display: grid; place-items: center; color: #14202b', {
              hover: 'border-color: #14202b',
            })}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </div>

        <div style={s('display: flex; flex-direction: column; gap: 16px; margin-bottom: 20px')}>
          <div>
            <label htmlFor="portal-details-name" style={s(LABEL)}>
              {t('name')}
            </label>
            <input
              id="portal-details-name"
              type="text"
              autoComplete="name"
              value={name}
              onChange={edit(setName)}
              aria-invalid={tried && !nameOk}
              {...x(FIELD_BASE, { focus: 'border-color: #14202b; outline: none' })}
            />
            {tried && !nameOk && <span style={s(ERROR)}>{t('nameError')}</span>}
          </div>
          <div>
            <label htmlFor="portal-details-email" style={s(LABEL)}>
              {t('email')}
            </label>
            <input
              id="portal-details-email"
              type="email"
              dir="ltr"
              readOnly
              value={lead.email}
              aria-describedby="portal-details-email-note"
              style={s(`${FIELD_BASE}; background: #f8f5f0; color: #5f5a52; cursor: default; text-align: left`)}
            />
            <span id="portal-details-email-note" style={s('display: block; font-size: 13px; line-height: 1.5; color: #736d64; margin-top: 6px')}>
              {t('emailNote')}
            </span>
          </div>
          <div>
            <label htmlFor="portal-details-phone" style={s(LABEL)}>
              {t('phone')}
            </label>
            <input
              id="portal-details-phone"
              type="tel"
              dir="ltr"
              inputMode="tel"
              autoComplete="tel"
              value={phone}
              onChange={edit(setPhone)}
              aria-invalid={tried && !phoneOk}
              {...x(`${FIELD_BASE}; text-align: left`, { focus: 'border-color: #14202b; outline: none' })}
            />
            {tried && !phoneOk && <span style={s(ERROR)}>{t('phoneError')}</span>}
          </div>
        </div>

        <button
          type="button"
          onClick={save}
          disabled={saving}
          {...x(
            `width: 100%; background: #14202b; color: #f8f5f0; border: 1px solid #14202b; border-radius: 999px; padding: 16px; font-family: 'Manrope', system-ui, sans-serif; font-size: 14.5px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; cursor: pointer; opacity: ${saved || saving ? '0.6' : '1'}`,
            { hover: 'background: #1e2f3f' },
          )}
        >
          {saving ? t('saving') : saved ? t('saved') : t('save')}
        </button>
        <div role="status" aria-live="polite">
          {saved && (
            <div style={s('display: flex; gap: 8px; align-items: flex-start; margin-top: 12px; font-size: 14px; line-height: 1.5; color: #2f5a3e')}>
              <Check />
              <span>{t('savedLine')}</span>
            </div>
          )}
          {saveFailed && <div style={s('margin-top: 12px; font-size: 14px; line-height: 1.5; color: #a03a2c')}>{t('saveError')}</div>}
        </div>

        <div style={s('border-top: 1px solid #ece6dc; margin-top: 24px; padding-top: 20px')}>
          <div style={s('font-size: 15px; font-weight: 600; margin-bottom: 4px')}>{t('passwordTitle')}</div>
          <p style={s('font-size: 14px; line-height: 1.55; color: #5f5a52; margin: 0 0 14px')}>{t('passwordHelp')}</p>
          {resetAt === null ? (
            <button
              type="button"
              onClick={sendReset}
              disabled={resetting}
              {...x(
                "width: 100%; background: #fff; color: #14202b; border: 1px solid #14202b; border-radius: 999px; padding: 15px; font-family: 'Manrope', system-ui, sans-serif; font-size: 14px; font-weight: 600; letter-spacing: 0.04em; cursor: pointer",
                { hover: 'background: #f6f0e4' },
              )}
            >
              {t('reset')}
            </button>
          ) : (
            <div
              role="status"
              style={s('display: flex; gap: 8px; align-items: flex-start; background: #eef4ef; border-radius: 12px; padding: 13px 15px; font-size: 14px; line-height: 1.5; color: #2f5a3e')}
            >
              <Check />
              <span>{t.rich('resetSent', { email: lead.email, time: resetAt, ...richTags })}</span>
            </div>
          )}
          {resetFailed && <div style={s('margin-top: 10px; font-size: 14px; line-height: 1.5; color: #a03a2c')}>{t('resetError')}</div>}
        </div>
      </div>
    </div>
  );
}
