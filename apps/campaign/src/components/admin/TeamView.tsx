'use client';

import { isEmail } from '@dpl/core';
import { s, x } from '@dpl/ui';
import { useTranslations } from 'next-intl';
import { useEffect, useId, useRef, useState, useTransition } from 'react';
import { inviteStaffAction, updateStaffAction } from '@/app/[locale]/(admin)/admin/actions';
import { useAdmin } from './AdminProvider';
import { settle } from './settle';
import type { StaffView } from './types';
import { CARD, PageFrame } from './ui';

const ROLES = ['admin', 'lawyer', 'case_manager'] as const;

/** /admin/team (admins only): who has access, with role and active switch, plus inviting a new team member. */
export function TeamView({ team }: { team: StaffView[] }) {
  const t = useTranslations('admin');
  const [inviting, setInviting] = useState(false);
  return (
    <PageFrame title={t('team.title')} help="team" lead={t('team.addHint')}>
      <div style={s('display:flex;justify-content:flex-end;margin-bottom:14px')}>
        <button
          type="button"
          data-invite-open
          onClick={() => setInviting(true)}
          {...x(
            "background:#14202b;color:#f8f5f0;border:1px solid #14202b;border-radius:999px;padding:10px 18px;font-family:'Manrope',system-ui,sans-serif;font-size:13px;font-weight:600;cursor:pointer",
            { hover: 'background:#1e2f3f' },
          )}
        >
          {t('team.invite.button')}
        </button>
      </div>
      <div data-team style={s(CARD)}>
        {team.map((m, i) => (
          <MemberRow key={m.id} member={m} first={i === 0} />
        ))}
      </div>
      {inviting && <InviteDialog onClose={() => setInviting(false)} />}
    </PageFrame>
  );
}

const F_INPUT =
  "width:100%;padding:12px 14px;font-size:15px;font-family:'Manrope',system-ui,sans-serif;color:#14202b;border:1px solid #ddd5c8;background:#fff;border-radius:12px;box-sizing:border-box";
const F_LABEL = 'display:block;font-size:13.5px;font-weight:600;color:#14202b;margin-bottom:7px';
const F_ERROR = 'display:block;font-size:13px;color:#a03a2c;margin-top:6px';
const F_FOCUS = 'border-color:#14202b;outline:none';

/** "Add team member": a native <dialog>, same pattern as EditDetailsModal. Closes itself once the invite is sent. */
function InviteDialog({ onClose }: { onClose: () => void }) {
  const t = useTranslations('admin');
  const { fail } = useAdmin();
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = dialog.current;
    if (d && !d.open) {
      d.showModal();
      d.querySelector<HTMLInputElement>('input')?.focus();
    }
  }, []);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<StaffView['role']>('case_manager');
  const [tried, setTried] = useState(false);
  const [already, setAlready] = useState(false);
  const [sent, setSent] = useState<string | null>(null);
  const [saving, startSave] = useTransition();

  const nameOk = name.trim().length >= 2;
  // the same rule as the server's: an address the form accepts but the server refuses would fail without a word
  const emailOk = isEmail(email.trim());
  const valid = nameOk && emailOk;

  const send = () => {
    if (!valid) {
      setTried(true);
      return;
    }
    startSave(async () => {
      const res = await settle(() => inviteStaffAction({ email: email.trim(), fullName: name.trim(), role }));
      if (!res.ok) {
        if (res.error === 'duplicate') setAlready(true);
        else if (res.error === 'invalid') setTried(true);
        else fail(res.error);
        return;
      }
      setSent(email.trim());
    });
  };

  return (
    <dialog
      ref={dialog}
      className="adm-dialog"
      aria-labelledby="invite-title"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        data-invite-card
        style={s(
          'position:relative;width:100%;max-width:440px;box-sizing:border-box;background:#fff;border-radius:22px;padding:28px 28px 26px;box-shadow:0 24px 60px rgba(20,32,43,0.28);color:#14202b;animation:qIn 260ms cubic-bezier(0.2,0,0,1) both;font-family:\'Manrope\',system-ui,sans-serif',
        )}
      >
        <div style={s('display:flex;align-items:flex-start;gap:16px;margin-bottom:18px')}>
          <div id="invite-title" style={s("flex:1;font-family:'Newsreader',Georgia,serif;font-size:24px;line-height:1.15")}>
            {t('team.invite.title')}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('edit.close')}
            {...x(
              'width:36px;height:36px;flex:none;border-radius:50%;border:1px solid #e2dbcf;background:#fff;cursor:pointer;display:grid;place-items:center;color:#14202b',
              { hover: 'border-color:#14202b' },
            )}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </div>

        {sent ? (
          <div
            role="status"
            style={s(
              'display:flex;gap:8px;align-items:flex-start;background:#eef4ef;border-radius:12px;padding:13px 15px;font-size:14px;line-height:1.5;color:#2f5a3e',
            )}
          >
            {t('team.invite.sentLine', { email: sent })}
          </div>
        ) : (
          <>
            <div style={s('display:flex;flex-direction:column;gap:14px;margin-bottom:18px')}>
              <div>
                <label htmlFor="invite-name" style={s(F_LABEL)}>
                  {t('team.invite.name')}
                </label>
                <input
                  id="invite-name"
                  type="text"
                  autoComplete="name"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    setAlready(false);
                  }}
                  aria-invalid={tried && !nameOk}
                  aria-describedby={tried && !nameOk ? 'invite-name-err' : undefined}
                  {...x(F_INPUT, { focus: F_FOCUS })}
                />
                {tried && !nameOk && (
                  <span id="invite-name-err" role="alert" style={s(F_ERROR)}>
                    {t('team.invite.nameError')}
                  </span>
                )}
              </div>
              <div>
                <label htmlFor="invite-email" style={s(F_LABEL)}>
                  {t('team.invite.email')}
                </label>
                <input
                  id="invite-email"
                  type="email"
                  dir="ltr"
                  autoComplete="email"
                  inputMode="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setAlready(false);
                  }}
                  aria-invalid={(tried && !emailOk) || already}
                  aria-describedby={(tried && !emailOk) || already ? 'invite-email-err' : undefined}
                  {...x(F_INPUT, { focus: F_FOCUS })}
                />
                {((tried && !emailOk) || already) && (
                  <span id="invite-email-err" role="alert" style={s(F_ERROR)}>
                    {already ? t('team.invite.alreadyStaff') : t('team.invite.emailError')}
                  </span>
                )}
              </div>
              <div>
                <label htmlFor="invite-role" style={s(F_LABEL)}>
                  {t('team.role')}
                </label>
                <select
                  id="invite-role"
                  value={role}
                  onChange={(e) => setRole(e.target.value as StaffView['role'])}
                  {...x(
                    "width:100%;padding:12px 14px;font-size:15px;font-family:'Manrope',system-ui,sans-serif;color:#14202b;border:1px solid #ddd5c8;background:#fff;border-radius:12px;box-sizing:border-box;cursor:pointer",
                    { focus: F_FOCUS },
                  )}
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {t(`team.roles.${r}`)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div style={s('display:flex;gap:10px')}>
              <button
                type="button"
                onClick={onClose}
                {...x(
                  "flex:1;background:#fff;color:#14202b;border:1px solid #e2dbcf;border-radius:999px;padding:13px;font-family:'Manrope',system-ui,sans-serif;font-size:13.5px;font-weight:600;cursor:pointer",
                  { hover: 'background:#f6f0e4' },
                )}
              >
                {t('team.invite.cancel')}
              </button>
              <button
                type="button"
                data-invite-send
                disabled={saving}
                onClick={send}
                {...x(
                  `flex:1;background:#14202b;color:#f8f5f0;border:1px solid #14202b;border-radius:999px;padding:13px;font-family:'Manrope',system-ui,sans-serif;font-size:13.5px;font-weight:600;cursor:pointer;opacity:${saving ? '0.6' : '1'}`,
                  { hover: 'background:#1e2f3f' },
                )}
              >
                {saving ? t('team.invite.sending') : t('team.invite.send')}
              </button>
            </div>
          </>
        )}
      </div>
    </dialog>
  );
}

/** What has been changed in a member's row and not saved yet. */
interface MemberDraft {
  role?: StaffView['role'];
  active?: boolean;
}

/** Only the fields that still differ from the stored member count as changed. */
function trimDraft(d: MemberDraft, member: StaffView): MemberDraft {
  return {
    ...(d.role !== undefined && d.role !== member.role ? { role: d.role } : {}),
    ...(d.active !== undefined && d.active !== member.active ? { active: d.active } : {}),
  };
}

function MemberRow({ member, first }: { member: StaffView; first: boolean }) {
  const t = useTranslations('admin');
  const id = useId();
  const { fail } = useAdmin();
  // not re-created when the stored member changes (a save arriving): the stored values show at once
  const [changed, setChanged] = useState<MemberDraft>({});
  const draft = trimDraft(changed, member);
  const role = draft.role ?? member.role;
  const active = draft.active ?? member.active;
  const dirty = Object.keys(draft).length > 0;
  const change = (patch: MemberDraft) => setChanged({ ...draft, ...patch });
  useEffect(() => {
    setChanged((d) => (Object.keys(trimDraft(d, member)).length === Object.keys(d).length ? d : trimDraft(d, member)));
  }, [member]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    setError(null);
    const res = await settle(() => updateStaffAction({ userId: member.id, role, active }));
    setBusy(false);
    if (res.ok) return;
    if (res.error === 'conflict') setError(t('team.lastAdmin'));
    else fail(res.error);
  };

  return (
    <div data-member={member.id} style={s(`${first ? '' : 'border-top:1px solid #f3eee6;'}padding:${first ? '0' : '12px'} 0 12px`)}>
      <div style={s('display:flex;align-items:center;gap:10px 16px;flex-wrap:wrap')}>
        <span style={s('flex:1;min-width:200px')}>
          <span style={s('display:block;font-size:14.5px;font-weight:600')}>{member.name}</span>
          <span style={s('display:block;font-size:13px;color:#736d64;overflow-wrap:anywhere')}>
            <bdi>{member.email}</bdi>
          </span>
        </span>
        <span>
          <label htmlFor={`${id}-r`} className="adm-sr">
            {t('team.role')}
          </label>
          <select
            id={`${id}-r`}
            value={role}
            onChange={(e) => change({ role: e.target.value as StaffView['role'] })}
            {...x(
              "min-width:150px;padding:8px 10px;font-size:13.5px;font-family:'Manrope',system-ui,sans-serif;color:#14202b;border:1px solid #ddd5c8;background:#fff;border-radius:10px;cursor:pointer",
              { focus: 'border-color:#14202b;outline:none' },
            )}
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {t(`team.roles.${r}`)}
              </option>
            ))}
          </select>
        </span>
        <label style={s('display:inline-flex;align-items:center;gap:6px;font-size:13px;cursor:pointer')}>
          <input type="checkbox" checked={active} onChange={(e) => change({ active: e.target.checked })} />
          {t('team.active')}
        </label>
        <span style={s('min-width:76px;text-align:right')}>
          {dirty && (
            <button
              type="button"
              data-member-save
              disabled={busy}
              onClick={() => void save()}
              {...x(
                "background:#14202b;color:#f8f5f0;border:1px solid #14202b;border-radius:999px;padding:7px 14px;font-family:'Manrope',system-ui,sans-serif;font-size:12.5px;font-weight:600;cursor:pointer",
                { hover: 'background:#1e2f3f' },
              )}
            >
              {t('team.save')}
            </button>
          )}
        </span>
      </div>
      {error && (
        <div role="alert" style={s('font-size:12.5px;color:#a03a2c;margin-top:6px')}>
          {error}
        </div>
      )}
    </div>
  );
}
