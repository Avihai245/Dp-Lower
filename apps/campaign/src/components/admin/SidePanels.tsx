'use client';

import { STATUS_OPTIONS } from './model';
import { s, x } from '@dpl/ui';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { addNoteAction, assignOwnerAction, deleteNoteAction, setStatusAction } from '@/app/[locale]/(admin)/admin/actions';
import { useAdmin } from './AdminProvider';
import { formatDateTime, initials } from './format';
import { relTime } from './model';
import { useAgo } from './rowbits';
import type { LeadDetailData, LeadRowData } from './types';
import { CARD, HelpTip } from './ui';
import { useRun } from './useRun';

const H2 =
  "font-size:12px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:#7a5c2c;margin:0;font-family:'Manrope',system-ui,sans-serif;line-height:inherit";

/** Contact: mailto / tel links (and the postal address from the application). Editing happens in the dialog. */
export function ContactPanel({ detail }: { detail: LeadDetailData }) {
  const t = useTranslations('admin');
  const { lead } = detail;
  const link = "color:#14202b;text-decoration:none;overflow-wrap:anywhere";
  return (
    <div data-contact-panel style={s(CARD)}>
      <div style={s('display:flex;align-items:center;margin-bottom:12px')}>
        <h2 style={s(H2)}>{t('contact.title')}</h2>
        <span style={s('margin-left:auto')}>
          <HelpTip id="contact" />
        </span>
      </div>
      <div style={s('display:flex;flex-direction:column;gap:10px;font-size:14.5px')}>
        <a href={`mailto:${lead.email}`} {...x(link, { hover: 'color:#7a5c2c' })}>
          <bdi>{lead.email}</bdi>
        </a>
        {lead.phone && (
          <a href={`tel:${lead.phone.replace(/[^0-9+]/g, '')}`} {...x("color:#14202b;text-decoration:none", { hover: 'color:#7a5c2c' })}>
            <bdi>{lead.phone}</bdi>
          </a>
        )}
        {detail.address && (
          <span style={s('font-size:13.5px;color:#736d64;overflow-wrap:anywhere;white-space:pre-line')}>
            <span style={s('display:block;font-size:12px;color:#9a948a')}>{t('contact.address')}</span>
            {detail.address}
          </span>
        )}
        {(detail.origin.source || Object.keys(detail.origin.utm).length > 0) && (
          <span data-lead-origin style={s('font-size:13.5px;color:#736d64;overflow-wrap:anywhere')}>
            <span style={s('display:block;font-size:12px;color:#9a948a')}>{t('contact.origin')}</span>
            <bdi>{[detail.origin.source, ...Object.entries(detail.origin.utm).map(([k, v]) => `${k.replace(/^utm_/, '')}: ${v}`)].filter(Boolean).join(' · ')}</bdi>
          </span>
        )}
      </div>
    </div>
  );
}

/** Case owner: who on the team is responsible (new: the brief asks for owner assignment). */
export function OwnerPanel({ lead }: { lead: LeadRowData }) {
  const t = useTranslations('admin');
  const { staff } = useAdmin();
  const { pending, run } = useRun();
  const current = lead.ownerId ?? '';
  return (
    <div data-owner-panel style={s(CARD)}>
      <div style={s('display:flex;align-items:center;gap:8px;margin:0 0 14px')}>
        <h2 style={s(H2)}>{t('owner.title')}</h2>
        <span style={s('margin-left:auto')}>
          <HelpTip id="owner" />
        </span>
      </div>
      <label htmlFor="owner-select" className="adm-sr">
        {t('owner.label')}
      </label>
      <select
        id="owner-select"
        data-owner-select
        value={current}
        disabled={pending}
        onChange={(e) => run(() => assignOwnerAction({ leadId: lead.id, ownerId: e.target.value || null }))}
        {...x(
          "width:100%;padding:11px 14px;font-size:14px;font-family:'Manrope',system-ui,sans-serif;color:#14202b;border:1px solid #ddd5c8;background:#fff;border-radius:12px;box-sizing:border-box;cursor:pointer",
          { focus: 'border-color:#14202b;outline:none' },
        )}
      >
        <option value="">{t('owner.unassigned')}</option>
        {staff.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name}
          </option>
        ))}
        {lead.ownerId && !staff.some((m) => m.id === lead.ownerId) && <option value={lead.ownerId}>{lead.ownerId.slice(0, 8)}</option>}
      </select>
    </div>
  );
}

/** Status shown to the applicant: the five statuses the team picks from; changing one emails the applicant. */
export function StatusPanel({ lead }: { lead: LeadRowData }) {
  const t = useTranslations('admin');
  const { pending, run } = useRun();
  const isOption = (STATUS_OPTIONS as readonly string[]).includes(lead.status);
  return (
    <div data-status-panel style={s(CARD)}>
      <div style={s('display:flex;align-items:center;gap:8px;margin:0 0 14px')}>
        <h2 style={s(H2)}>{t('statusPanel.title')}</h2>
        <span style={s('margin-left:auto')}>
          <HelpTip id="status" />
        </span>
      </div>
      <div style={s('display:flex;flex-wrap:wrap;gap:6px')}>
        {STATUS_OPTIONS.map((st) => {
          const on = lead.status === st;
          return (
            <button
              key={st}
              type="button"
              data-status-option={st}
              aria-pressed={on}
              disabled={pending}
              onClick={() => !on && run(() => setStatusAction({ leadId: lead.id, status: st }))}
              style={s(
                `cursor:pointer;border-radius:999px;padding:7px 12px;font-family:'Manrope',system-ui,sans-serif;font-size:12.5px;font-weight:600;border:1px solid ${on ? '#14202b' : '#e2dbcf'};background:${on ? '#14202b' : '#fff'};color:${on ? '#f8f5f0' : '#14202b'}`,
              )}
            >
              {t(`status.${st}`)}
            </button>
          );
        })}
      </div>
      <p style={s('font-size:12.5px;color:#9a948a;margin:10px 0 0;line-height:1.5')}>
        {t('statusPanel.note')}
        {!isOption && <> {t('statusPanel.current', { status: t(`status.${lead.status}`) })}</>}
      </p>
    </div>
  );
}

/** Notes: internal only. Ctrl/Cmd + Enter saves. */
export function NotesPanel({ detail }: { detail: LeadDetailData }) {
  const t = useTranslations('admin');
  const locale = useLocale();
  const ago = useAgo();
  const { now } = useAdmin();
  const { pending, run } = useRun();
  const [draft, setDraft] = useState('');
  const { lead, notes } = detail;
  const ok = draft.trim().length > 0 && !pending;

  const add = () => {
    const body = draft.trim();
    if (!body || pending) return;
    run(() => addNoteAction({ leadId: lead.id, body }), () => setDraft(''));
  };
  const noteWhen = (iso: string) => {
    const r = relTime(new Date(iso).getTime(), now.getTime());
    return r.kind === 'now' || r.kind === 'min' ? ago(iso) : formatDateTime(iso, locale);
  };

  return (
    <div data-notes-panel style={s(CARD)}>
      <div style={s('display:flex;align-items:baseline;gap:8px;margin-bottom:12px')}>
        <h2 style={s(H2)}>{t('notes.title')}</h2>
        <span style={s('font-size:13px;color:#9a948a')}>{notes.length ? t('notes.count', { count: notes.length }) : ''}</span>
        <span style={s('margin-left:auto')}>
          <HelpTip id="notes" />
        </span>
      </div>
      <textarea
        aria-label={t('notes.title')}
        data-note-input
        dir="auto"
        placeholder={t('notes.placeholder')}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            add();
          }
        }}
        rows={3}
        maxLength={5000}
        {...x(
          "width:100%;padding:13px 15px;font-size:15px;line-height:1.5;font-family:'Manrope',system-ui,sans-serif;color:#14202b;border:1px solid #ddd5c8;background:#fff;border-radius:12px;box-sizing:border-box;resize:vertical;min-height:84px",
          { focus: 'border-color:#14202b;outline:none' },
        )}
      />
      <div style={s('display:flex;align-items:center;gap:10px;margin-top:10px')}>
        <span data-hide-xs style={s('font-size:12px;color:#9a948a')}>
          {t('notes.hint')}
        </span>
        <button
          type="button"
          data-note-add
          onClick={add}
          aria-disabled={!ok}
          {...x(
            `margin-left:auto;background:#14202b;color:#f8f5f0;border:1px solid #14202b;border-radius:999px;padding:11px 20px;font-family:'Manrope',system-ui,sans-serif;font-size:13.5px;font-weight:600;cursor:pointer;opacity:${ok ? '1' : '0.35'};pointer-events:${ok ? 'auto' : 'none'}`,
            { hover: 'background:#1e2f3f' },
          )}
        >
          {t('notes.add')}
        </button>
      </div>
      <div style={s('display:flex;flex-direction:column;gap:8px;margin-top:14px')}>
        {notes.map((n) => {
          const author = n.authorName ?? t('notes.unknownAuthor');
          return (
            <div key={n.id} data-note={n.id} style={s('background:#f8f5f0;border:1px solid #efe8dc;border-radius:12px;padding:12px 14px')}>
              <div style={s('display:flex;align-items:center;gap:8px;margin-bottom:5px')}>
                <span
                  aria-hidden
                  style={s('width:22px;height:22px;border-radius:50%;background:#14202b;color:#f8f5f0;display:grid;place-items:center;font-size:10.5px;font-weight:700;flex:none')}
                >
                  {initials(author)}
                </span>
                <span style={s('font-size:12.5px;font-weight:600')}>{author}</span>
                <span style={s('font-size:12px;color:#9a948a')}>{noteWhen(n.createdAt)}</span>
                <button
                  type="button"
                  aria-label={t('notes.deleteAria')}
                  onClick={() => run(() => deleteNoteAction({ noteId: n.id }))}
                  {...x(
                    "margin-left:auto;background:none;border:0;padding:4px 6px;font-family:'Manrope',system-ui,sans-serif;font-size:12px;color:#9a948a;cursor:pointer;text-decoration:underline;text-underline-offset:3px",
                    { hover: 'color:#a03a2c' },
                  )}
                >
                  {t('notes.delete')}
                </button>
              </div>
              <div dir="auto" style={s('font-size:14.5px;line-height:1.55;color:#14202b;white-space:pre-wrap;overflow-wrap:anywhere;text-align:start')}>{n.body}</div>
            </div>
          );
        })}
        {notes.length === 0 && <div style={s('font-size:13.5px;color:#9a948a')}>{t('notes.empty')}</div>}
      </div>
    </div>
  );
}
