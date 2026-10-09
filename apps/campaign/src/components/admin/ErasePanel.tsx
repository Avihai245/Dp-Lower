'use client';

import { s, x } from '@dpl/ui';
import { useTranslations } from 'next-intl';
import { useId, useState } from 'react';
import { deleteApplicantAction } from '@/app/[locale]/(admin)/admin/actions';
import { useRouter } from '@/i18n/navigation';
import { useAdmin } from './AdminProvider';
import type { LeadDetailData } from './types';
import { CARD } from './ui';
import { useRun } from './useRun';

const H2 =
  "font-size:12px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:#8a3b2c;margin:0;font-family:'Manrope',system-ui,sans-serif;line-height:inherit";
const BUTTON =
  "border-radius:999px;padding:9px 16px;font-family:'Manrope',system-ui,sans-serif;font-size:13px;font-weight:600;cursor:pointer";

/**
 * "Delete applicant": admins only. Everything held about the person is removed for good (crm-erase.ts), so the case
 * reference has to be typed back before the button works. The server checks the same thing and the role again.
 */
export function ErasePanel({ lead }: { lead: LeadDetailData['lead'] }) {
  const t = useTranslations('admin');
  const { me, notify, listQuery } = useAdmin();
  const router = useRouter();
  const { pending, run } = useRun();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState('');
  const id = useId();
  if (me.role !== 'admin') return null;

  const matches = typed.trim().toUpperCase() === lead.caseRef.toUpperCase();
  const erase = () => {
    if (!matches || pending) return;
    run(
      () => deleteApplicantAction({ leadId: lead.id, confirm: typed }),
      () => {
        notify(t('erase.done', { caseRef: lead.caseRef }));
        router.replace(`/admin${listQuery}`);
      },
    );
  };

  return (
    <div data-erase-panel style={s(`${CARD};border-color:#ecd5cf`)}>
      <h2 style={s(H2)}>{t('erase.title')}</h2>
      <p style={s('font-size:13.5px;line-height:1.55;color:#736d64;margin:10px 0 14px')}>{t('erase.text')}</p>
      {!open ? (
        <button type="button" data-erase-open onClick={() => setOpen(true)} {...x(`${BUTTON};background:#fff;color:#8a3b2c;border:1px solid #d9b5ac`, { hover: 'background:#fbeeea' })}>
          {t('erase.open')}
        </button>
      ) : (
        <div data-erase-form>
          <label htmlFor={id} style={s('display:block;font-size:13px;font-weight:600;margin-bottom:6px')}>
            {t('erase.confirmLabel', { caseRef: lead.caseRef })}
          </label>
          <input
            id={id}
            dir="ltr"
            autoComplete="off"
            spellCheck={false}
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder={lead.caseRef}
            {...x(
              "width:100%;padding:10px 12px;font-size:14px;font-family:'Manrope',system-ui,sans-serif;color:#14202b;border:1px solid #ddd5c8;background:#fff;border-radius:12px;box-sizing:border-box",
              { focus: 'border-color:#8a3b2c;outline:none' },
            )}
          />
          <div style={s('display:flex;gap:8px;margin-top:10px;flex-wrap:wrap')}>
            <button
              type="button"
              data-erase-confirm
              disabled={!matches || pending}
              onClick={erase}
              style={s(`${BUTTON};background:#8a3b2c;color:#fff;border:1px solid #8a3b2c;opacity:${matches && !pending ? '1' : '0.4'}`)}
            >
              {t('erase.confirm')}
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setTyped('');
              }}
              {...x(`${BUTTON};background:#fff;color:#14202b;border:1px solid #e2dbcf`, { hover: 'border-color:#14202b' })}
            >
              {t('erase.cancel')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
