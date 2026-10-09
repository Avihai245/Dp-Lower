'use client';

import { DOC_TYPES } from '@dpl/core';
import { s, x } from '@dpl/ui';
import { useTranslations } from 'next-intl';
import { Link, useRouter } from '@/i18n/navigation';
import { useAdmin } from './AdminProvider';
import type { LeadRow } from './model';
import { NotesBadge, sub, useAgo, useWaitingLabel } from './rowbits';
import { SMALL_BTN, useRouteLabels } from './ui';

const TD_MUTED = `font-size:12px;color:${sub(60)}`;

/** The "Table" view. Columns as designed; the whole row opens the lead, the name is a real link for keyboard users. */
export function LeadsTable({ rows }: { rows: LeadRow[] }) {
  const t = useTranslations('admin');
  const router = useRouter();
  const { listQuery, editLead } = useAdmin();
  const route = useRouteLabels();
  const waitingLabel = useWaitingLabel();
  const ago = useAgo();
  const href = (id: string) => `/admin/leads/${id}${listQuery}`;

  return (
    // position:relative keeps the visually hidden header text (position:absolute) inside this scroller; otherwise it
    // escapes the clipping and makes the whole page scroll sideways on a phone
    <div style={s('position:relative;background:var(--color-bg);border:1px solid var(--color-divider);overflow-x:auto')}>
      <table className="table" style={s('font-size:13px')}>
        <thead>
          <tr>
            <th style={s('padding-left:14px')}>{t('table.case')}</th>
            <th>{t('table.applicant')}</th>
            <th>{t('table.route')}</th>
            <th>{t('table.ancestor')}</th>
            <th>{t('table.docs')}</th>
            <th>{t('table.status')}</th>
            <th>{t('table.stage')}</th>
            <th>{t('table.waiting')}</th>
            <th style={s('text-align:right')}>{t('table.updated')}</th>
            <th style={s('padding-right:14px')}>
              <span className="adm-sr">{t('table.edit')}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.id}
              data-lead-row={r.id}
              onClick={() => router.push(href(r.id))}
              {...x('cursor:pointer;transition:background 120ms ease', { hover: 'background:var(--color-accent-100)' })}
            >
              <td style={s("padding-left:14px;font-family:'Manrope',system-ui,sans-serif;letter-spacing:0.04em;white-space:nowrap")}>
                <bdi>{r.caseRef}</bdi>
              </td>
              <td style={s('white-space:nowrap')}>
                <Link
                  href={href(r.id)}
                  onClick={(e) => e.stopPropagation()}
                  className="adm-rowlink"
                  style={s('font-weight:500;color:inherit;text-decoration:none')}
                >
                  {r.fullName}
                </Link>
                <NotesBadge count={r.notesCount} label={t('table.notes', { count: r.notesCount })} />
                {r.where && <span style={s(`display:block;font-size:11.5px;color:${sub(50)}`)}>{r.where}</span>}
              </td>
              <td>
                <span
                  style={s(
                    "font-family:'Manrope',system-ui,sans-serif;font-size:11px;letter-spacing:0.12em;padding:2px 7px;background:var(--color-accent-100);color:var(--color-accent-800)",
                  )}
                >
                  {route.short(r.route)}
                </span>
              </td>
              <td style={s(`font-size:12.5px;color:${sub(72)}`)}>{r.ancestor ?? t('table.notRecorded')}</td>
              <td style={s("font-family:'Manrope',system-ui,sans-serif;letter-spacing:0.04em")}>
                <bdi>
                  {r.docsReceived}/{DOC_TYPES.length}
                </bdi>
              </td>
              <td style={s('white-space:nowrap')}>{t(`status.${r.status}`)}</td>
              <td style={s(TD_MUTED)}>{t(`stage.${r.stage}`)}</td>
              <td style={s(`font-size:12.5px;color:${r.attention ? 'var(--color-accent-800)' : sub(45)};font-weight:${r.attention ? '500' : '400'}`)}>
                {waitingLabel(r)}
              </td>
              <td style={s(`text-align:right;font-size:12px;color:${sub(50)};white-space:nowrap`)}>{ago(r.updatedAt)}</td>
              <td style={s('padding-right:14px;text-align:right')}>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    editLead(r.id);
                  }}
                  {...x(SMALL_BTN, { hover: 'border-color:#14202b' })}
                >
                  {t('table.edit')}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
