'use client';

import { digitsOf, firstNameOf } from '@dpl/core';
import { s, x } from '@dpl/ui';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useRef, useState, useTransition } from 'react';
import { sendResetLinkAction, updateContactAction } from '@/app/[locale]/(admin)/admin/actions';
import { useAdmin } from './AdminProvider';
import { formatClock } from './format';
import { settle } from './settle';
import type { LeadRowData } from './types';

/**
 * "Edit details & password" (opened from the list, the board and the lead page). A native <dialog>: focus is trapped,
 * Escape closes it, the page behind is inert. Saving updates the lead and the applicant's sign-in; the second block
 * emails a secure link to set a new password.
 */
export function EditDetailsModal() {
  const { editingId, editLead, rowsById } = useAdmin();
  const dialog = useRef<HTMLDialogElement>(null);
  const row = editingId ? rowsById.get(editingId) : undefined;

  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (row && !d.open) {
      d.showModal();
      d.querySelector<HTMLInputElement>('input')?.focus();
    }
    if (!row && d.open) d.close();
  }, [row]);

  return (
    <dialog
      ref={dialog}
      className="adm-dialog"
      aria-labelledby="edit-title"
      onCancel={(e) => {
        e.preventDefault();
        editLead(null);
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) editLead(null);
      }}
    >
      {row && <EditForm key={row.id} lead={row} onClose={() => editLead(null)} />}
    </dialog>
  );
}

const INPUT =
  "width:100%;padding:14px 16px;font-size:16px;font-family:'Manrope',system-ui,sans-serif;color:#14202b;border:1px solid #ddd5c8;background:#fff;border-radius:12px;box-sizing:border-box";
const LABEL = 'display:block;font-size:13.5px;font-weight:600;color:#14202b;margin-bottom:7px';
const ERROR = 'display:block;font-size:13px;color:#a03a2c;margin-top:6px';
const FOCUS = 'border-color:#14202b;outline:none';

function Check({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#2f5a3e" strokeWidth="2" style={s('flex:none;margin-top:2px')} aria-hidden>
      <path d="m4 12.5 5 5L20 6.5" />
    </svg>
  );
}

function EditForm({ lead, onClose }: { lead: LeadRowData; onClose: () => void }) {
  const t = useTranslations('admin');
  const locale = useLocale();
  const { fail } = useAdmin();
  const [name, setName] = useState(lead.fullName);
  const [email, setEmail] = useState(lead.email);
  const [phone, setPhone] = useState(lead.phone ?? '');
  const [tried, setTried] = useState(false);
  const [saved, setSaved] = useState<null | 'plain' | 'email'>(null);
  const [emailTaken, setEmailTaken] = useState(false);
  const [resetAt, setResetAt] = useState<{ time: string; email: string } | null>(null);
  const [saving, startSave] = useTransition();
  const [sending, startSend] = useTransition();

  const nameOk = name.trim().split(/\s+/).length >= 2 && name.trim().length >= 3;
  const emailOk = /.+@.+\..+/.test(email.trim());
  const phoneOk = phone.trim() === '' ? !lead.phone : digitsOf(phone).length >= 7;
  const valid = nameOk && emailOk && phoneOk;
  const dirty = name.trim() !== lead.fullName || email.trim().toLowerCase() !== lead.email || phone.trim() !== (lead.phone ?? '');

  const touch = (set: (v: string) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
    set(e.target.value);
    setSaved(null);
    setEmailTaken(false);
  };

  /** Saves the form; resolves true when the stored lead now matches it. */
  const save = async (): Promise<boolean> => {
    if (!valid) {
      setTried(true);
      return false;
    }
    if (!dirty) return true;
    const res = await settle(() =>
      updateContactAction({ leadId: lead.id, fullName: name.trim(), email: email.trim(), phone: phone.trim() }),
    );
    if (!res.ok) {
      if (res.error === 'email_taken') setEmailTaken(true);
      else if (res.error === 'invalid') setTried(true);
      else fail(res.error);
      return false;
    }
    setSaved(res.data.changed.includes('email') ? 'email' : 'plain');
    return true;
  };

  return (
    <div
      data-edit-card
      style={s(
        'position:relative;width:100%;max-width:480px;max-height:calc(100vh - 32px);overflow-y:auto;box-sizing:border-box;background:#fff;border-radius:22px;padding:28px 28px 26px;box-shadow:0 24px 60px rgba(20,32,43,0.28);color:#14202b;animation:qIn 260ms cubic-bezier(0.2,0,0,1) both;font-family:\'Manrope\',system-ui,sans-serif',
      )}
    >
      <div style={s('display:flex;align-items:flex-start;gap:16px;margin-bottom:22px')}>
        <div style={s('flex:1;min-width:0')}>
          <div style={s('font-size:12px;font-weight:600;letter-spacing:0.14em;text-transform:uppercase;color:#a07a3c;margin-bottom:6px')}>
            {t('edit.kicker', { caseRef: lead.caseRef })}
          </div>
          <div id="edit-title" style={s("font-family:'Newsreader',Georgia,serif;font-size:27px;line-height:1.15")}>
            {name.trim() || t('edit.titleFallback')}
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={t('edit.close')}
          {...x('width:40px;height:40px;flex:none;border-radius:50%;border:1px solid #e2dbcf;background:#fff;cursor:pointer;display:grid;place-items:center;color:#14202b', {
            hover: 'border-color:#14202b',
          })}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
            <path d="M6 6l12 12M18 6 6 18" />
          </svg>
        </button>
      </div>

      <div style={s('display:flex;flex-direction:column;gap:16px;margin-bottom:20px')}>
        <div>
          <label htmlFor="edit-name" style={s(LABEL)}>
            {t('edit.name')}
          </label>
          <input
            id="edit-name"
            type="text"
            autoComplete="name"
            value={name}
            onChange={touch(setName)}
            aria-invalid={tried && !nameOk}
            aria-describedby={tried && !nameOk ? 'edit-name-err' : undefined}
            {...x(INPUT, { focus: FOCUS })}
          />
          {tried && !nameOk && (
            <span id="edit-name-err" role="alert" style={s(ERROR)}>
              {t('edit.nameError')}
            </span>
          )}
        </div>
        <div>
          <label htmlFor="edit-email" style={s(LABEL)}>
            {t('edit.email')}
          </label>
          <input
            id="edit-email"
            type="email"
            dir="ltr"
            autoComplete="email"
            inputMode="email"
            value={email}
            onChange={touch(setEmail)}
            aria-invalid={(tried && !emailOk) || emailTaken}
            aria-describedby={(tried && !emailOk) || emailTaken ? 'edit-email-err' : undefined}
            {...x(INPUT, { focus: FOCUS })}
          />
          {((tried && !emailOk) || emailTaken) && (
            <span id="edit-email-err" role="alert" style={s(ERROR)}>
              {emailTaken ? t('edit.emailTaken') : t('edit.emailError')}
            </span>
          )}
        </div>
        <div>
          <label htmlFor="edit-phone" style={s(LABEL)}>
            {t('edit.phone')}
          </label>
          <input
            id="edit-phone"
            type="tel"
            dir="ltr"
            autoComplete="tel"
            inputMode="tel"
            value={phone}
            onChange={touch(setPhone)}
            aria-invalid={tried && !phoneOk}
            aria-describedby={tried && !phoneOk ? 'edit-phone-err' : undefined}
            {...x(INPUT, { focus: FOCUS })}
          />
          {tried && !phoneOk && (
            <span id="edit-phone-err" role="alert" style={s(ERROR)}>
              {t('edit.phoneError')}
            </span>
          )}
        </div>
      </div>

      <button
        type="button"
        disabled={saving}
        onClick={() => startSave(async () => void (await save()))}
        {...x(
          `width:100%;background:#14202b;color:#f8f5f0;border:1px solid #14202b;border-radius:999px;padding:16px;font-family:'Manrope',system-ui,sans-serif;font-size:14.5px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;cursor:pointer;opacity:${saved || saving ? '0.6' : '1'}`,
          { hover: 'background:#1e2f3f' },
        )}
      >
        {saving ? t('edit.saving') : saved ? t('edit.saved') : t('edit.save')}
      </button>
      {saved && (
        <div role="status" style={s('display:flex;gap:8px;align-items:flex-start;margin-top:12px;font-size:14px;line-height:1.5;color:#2f5a3e')}>
          <Check />
          <span>{saved === 'email' ? t('edit.savedEmailLine', { first: (firstNameOf(name) || name.trim()) }) : t('edit.savedLine', { first: (firstNameOf(name) || name.trim()) })}</span>
        </div>
      )}

      <div style={s('border-top:1px solid #ece6dc;margin-top:24px;padding-top:20px')}>
        <div style={s('font-size:15px;font-weight:600;margin-bottom:4px')}>{t('edit.password')}</div>
        <p style={s('font-size:14px;line-height:1.55;color:#5f5a52;margin:0 0 14px')}>{t('edit.resetHelp')}</p>
        {!resetAt ? (
          <button
            type="button"
            disabled={sending}
            onClick={() =>
              startSend(async () => {
                // the link goes to the address on file: store pending edits first, so "the typed email" is the one used
                if (!(await save())) return;
                const res = await settle(() => sendResetLinkAction({ leadId: lead.id }));
                if (!res.ok) return fail(res.error);
                setResetAt({ time: formatClock(res.data.sentAt, locale), email: res.data.email });
              })
            }
            {...x(
              "width:100%;background:#fff;color:#14202b;border:1px solid #14202b;border-radius:999px;padding:15px;font-family:'Manrope',system-ui,sans-serif;font-size:14px;font-weight:600;letter-spacing:0.04em;cursor:pointer",
              { hover: 'background:#f6f0e4' },
            )}
          >
            {sending ? t('edit.resetSending') : t('edit.resetButton')}
          </button>
        ) : (
          <div
            role="status"
            style={s('display:flex;gap:8px;align-items:flex-start;background:#eef4ef;border-radius:12px;padding:13px 15px;font-size:14px;line-height:1.5;color:#2f5a3e')}
          >
            <Check />
            <span>{t('edit.resetSent', { email: resetAt.email, time: resetAt.time })}</span>
          </div>
        )}
      </div>
    </div>
  );
}
