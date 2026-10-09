'use client';

import { s, x } from '@dpl/ui';
import { useTranslations } from 'next-intl';
import { useEffect, useId, useState } from 'react';
import { updateStaffAction } from '@/app/[locale]/(admin)/admin/actions';
import { useAdmin } from './AdminProvider';
import { settle } from './settle';
import type { StaffView } from './types';
import { CARD, PageFrame } from './ui';

const ROLES = ['admin', 'lawyer', 'case_manager'] as const;

/** /admin/team (admins only): who has access, with role and active switch. Accounts are created with the bootstrap script. */
export function TeamView({ team }: { team: StaffView[] }) {
  const t = useTranslations('admin');
  return (
    <PageFrame title={t('team.title')} help="team" lead={t('team.addHint')}>
      <div data-team style={s(CARD)}>
        {team.map((m, i) => (
          <MemberRow key={m.id} member={m} first={i === 0} />
        ))}
      </div>
    </PageFrame>
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
