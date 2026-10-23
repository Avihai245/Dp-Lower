'use client';
import { phoneSchema, type Locale } from '@dpl/core';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { IconCheck, IconClose, IconLock, IconUser } from '../ui/icons';
import { formatClock } from './model/format';
import { fullNameSchema } from './model/schemas';
import { richTags, useFocusTrap } from './shared';

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
    <div role="dialog" aria-modal="true" aria-label={t('title')} className="ui-modal">
      <div onClick={onClose} aria-hidden="true" className="ui-modal-veil" />
      <div ref={cardRef} data-edit-card className="ui-modal-card">
        <div className="ui-modal-head">
          <span className="ui-icon-chip ui-icon-chip-lg ui-icon-chip-ink" aria-hidden="true">
            <IconUser size={22} />
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="ui-kicker">{t('kicker')}</div>
            <div className="ui-modal-title">{t('title')}</div>
          </div>
          <button type="button" onClick={onClose} aria-label={t('close')} className="ui-btn ui-btn-icon ui-btn-quiet">
            <IconClose size={18} />
          </button>
        </div>

        <div className="ui-modal-body">
          <div className="ui-stack" style={{ gap: 16, marginBottom: 20 }}>
            <div>
              <label htmlFor="portal-details-name" className="ui-label">
                {t('name')}
              </label>
              <input
                id="portal-details-name"
                className="ui-input"
                type="text"
                autoComplete="name"
                value={name}
                onChange={edit(setName)}
                aria-invalid={tried && !nameOk}
              />
              {tried && !nameOk && <span className="ui-error">{t('nameError')}</span>}
            </div>
            <div>
              <label htmlFor="portal-details-email" className="ui-label">
                {t('email')}
              </label>
              <input
                id="portal-details-email"
                className="ui-input"
                type="email"
                dir="ltr"
                readOnly
                value={lead.email}
                aria-describedby="portal-details-email-note"
                style={{ textAlign: 'left' }}
              />
              <span id="portal-details-email-note" className="ui-hint">
                {t('emailNote')}
              </span>
            </div>
            <div>
              <label htmlFor="portal-details-phone" className="ui-label">
                {t('phone')}
              </label>
              <input
                id="portal-details-phone"
                className="ui-input"
                type="tel"
                dir="ltr"
                inputMode="tel"
                autoComplete="tel"
                value={phone}
                onChange={edit(setPhone)}
                aria-invalid={tried && !phoneOk}
                style={{ textAlign: 'left' }}
              />
              {tried && !phoneOk && <span className="ui-error">{t('phoneError')}</span>}
            </div>
          </div>

          <button type="button" onClick={save} disabled={saving} className="ui-btn ui-btn-primary ui-btn-lg ui-btn-block" style={saved ? { opacity: 0.6 } : undefined}>
            {saving ? t('saving') : saved ? t('saved') : t('save')}
          </button>
          <div role="status" aria-live="polite">
            {saved && (
              <div className="ui-note ui-note-ok" style={{ marginTop: 12 }}>
                <IconCheck size={16} strokeWidth={2.2} style={{ color: 'var(--ui-ok)' }} />
                <span>{t('savedLine')}</span>
              </div>
            )}
            {saveFailed && <p className="ui-error">{t('saveError')}</p>}
          </div>

          <div className="ui-modal-section">
            <div className="ui-row" style={{ marginBottom: 4 }}>
              <IconLock size={17} style={{ color: 'var(--ui-gold)' }} />
              <span style={{ fontSize: 15, fontWeight: 700 }}>{t('passwordTitle')}</span>
            </div>
            <p className="ui-small" style={{ fontSize: 14, margin: '0 0 14px' }}>
              {t('passwordHelp')}
            </p>
            {resetAt === null ? (
              <button type="button" onClick={sendReset} disabled={resetting} className="ui-btn ui-btn-block">
                {t('reset')}
              </button>
            ) : (
              <div role="status" className="ui-note ui-note-ok">
                <IconCheck size={16} strokeWidth={2.2} style={{ color: 'var(--ui-ok)' }} />
                <span>{t.rich('resetSent', { email: lead.email, time: resetAt, ...richTags })}</span>
              </div>
            )}
            {resetFailed && <p className="ui-error">{t('resetError')}</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
