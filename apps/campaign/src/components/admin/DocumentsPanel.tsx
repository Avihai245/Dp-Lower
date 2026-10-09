'use client';

import { DOC_TYPES, type DocStatus } from '@dpl/core';
import { s, x } from '@dpl/ui';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { documentAction } from '@/app/[locale]/(admin)/admin/actions';
import type { DocView, LeadDetailData } from './types';
import { CARD, HelpTip } from './ui';
import { useRun } from './useRun';

/** chip label colours, icon glyph and icon colour per status, as designed */
const CHIP: Record<DocStatus, { bg: string; fg: string; icon: string; dot: string }> = {
  received: { bg: '#eef4ef', fg: '#2f5a3e', icon: '✓', dot: '#3f6b4f' },
  missing: { bg: '#f6f2ec', fg: '#736d64', icon: '–', dot: '#b4ada2' },
  requested: { bg: '#f6f0e4', fg: '#7a5c2c', icon: '↗', dot: '#a07a3c' },
  reupload: { bg: '#fbeeea', fg: '#8a3b2c', icon: '!', dot: '#a03a2c' },
};

const SMALL =
  "background:#fff;color:#14202b;border:1px solid #e2dbcf;border-radius:999px;padding:6px 11px;font-family:'Manrope',system-ui,sans-serif;font-size:12px;font-weight:600;cursor:pointer;white-space:nowrap";

/** Documents: one row per slot with its state and the actions the team can take (request, remind, mark received, reject, view). */
export function DocumentsPanel({ detail }: { detail: LeadDetailData }) {
  const t = useTranslations('admin');
  const { documents, lead } = detail;
  const received = documents.filter((d) => d.status === 'received').length;
  const pct = Math.round((received / DOC_TYPES.length) * 100);

  return (
    <div data-docs-panel style={s(CARD)}>
      <div style={s('display:flex;align-items:baseline;gap:10px;margin-bottom:14px')}>
        <h2 style={s('font-size:12px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:#7a5c2c;margin:0;font-family:\'Manrope\',system-ui,sans-serif;line-height:inherit')}>{t('docs.title')}</h2>
        <span style={s('font-size:13px;color:#736d64')}>{t('docs.summary', { count: received, total: DOC_TYPES.length })}</span>
        <span style={s('margin-left:auto')}>
          <HelpTip id="docs" />
        </span>
      </div>
      <div style={s('height:6px;border-radius:999px;background:#f0ebe2;overflow:hidden;margin-bottom:8px')}>
        <span style={s(`display:block;height:6px;border-radius:999px;background:#3f6b4f;width:${pct}%;transition:width 400ms ease`)} />
      </div>
      {documents.map((d) => (
        <DocRow key={d.docType} leadId={lead.id} doc={d} />
      ))}
    </div>
  );
}

function DocRow({ leadId, doc }: { leadId: string; doc: DocView }) {
  const t = useTranslations('admin');
  const { pending, run } = useRun();
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState('');
  const chip = CHIP[doc.status];
  const name = t(`docs.name.${doc.docType}`);

  const act = (action: 'request' | 'remind' | 'receive' | 'reject', extra?: { note?: string }) =>
    run(() => documentAction({ leadId, docType: doc.docType, action, ...extra }), () => setRejecting(false));

  const sub =
    doc.status === 'received'
      ? (doc.fileName ?? t('docs.sub.onFile'))
      : doc.status === 'requested'
        ? t('docs.sub.requested')
        : doc.status === 'reupload'
          ? (doc.reviewNote ?? t('docs.sub.reupload'))
          : t('docs.sub.missing');

  const button = (label: string, onClick: () => void, key: string) => (
    <button key={key} type="button" data-doc-action={key} disabled={pending} onClick={onClick} {...x(`${SMALL};opacity:${pending ? '0.5' : '1'}`, { hover: 'border-color:#14202b' })}>
      {label}
    </button>
  );

  return (
    <div
      data-doc-row
      data-doc-type={doc.docType}
      data-doc-status={doc.status}
      style={s('display:grid;grid-template-columns:28px minmax(0, 1fr) auto auto;gap:10px 12px;align-items:center;padding:12px 0;border-bottom:1px solid #f3eee6')}
    >
      <span
        aria-hidden
        style={s(`width:26px;height:26px;border-radius:50%;display:grid;place-items:center;font-size:12px;font-weight:700;color:#fff;background:${chip.dot}`)}
      >
        {chip.icon}
      </span>
      <span style={s('min-width:0')}>
        <span style={s('display:block;font-size:14.5px;font-weight:600;line-height:1.3')}>{name}</span>
        <span style={s('display:block;font-size:12.5px;color:#736d64;margin-top:2px;overflow-wrap:anywhere')}>
          <bdi>{sub}</bdi>
        </span>
      </span>
      <span data-doc-chip style={s(`font-size:12px;font-weight:600;padding:4px 10px;border-radius:999px;white-space:nowrap;background:${chip.bg};color:${chip.fg}`)}>
        {t(`docs.chip.${doc.status}`)}
      </span>
      <span data-doc-act style={s('display:flex;gap:6px;justify-content:flex-end;flex-wrap:wrap')}>
        {doc.hasFile && (
          <a
            href={`/admin/leads/${leadId}/documents/${doc.docType}`}
            target="_blank"
            rel="noopener noreferrer"
            data-doc-action="view"
            {...x(`${SMALL};text-decoration:none;display:inline-flex;align-items:center`, { hover: 'border-color:#14202b' })}
          >
            {t('docs.action.view')}
          </a>
        )}
        {doc.status === 'received'
          ? button(t('docs.action.reject'), () => setRejecting((v) => !v), 'reject')
          : doc.status === 'requested'
            ? button(t('docs.action.remind'), () => act('remind'), 'remind')
            : button(t('docs.action.request'), () => act('request'), 'request')}
        {doc.status !== 'received' && button(t('docs.action.receive'), () => act('receive'), 'receive')}
      </span>
      {rejecting && (
        <div data-reject-form style={s('grid-column:1 / -1;background:#faf7f2;border:1px solid #efe8dc;border-radius:12px;padding:12px 14px')}>
          <label htmlFor={`reject-${doc.docType}`} style={s('display:block;font-size:13px;font-weight:600;margin-bottom:6px')}>
            {t('docs.rejectTitle', { name })}
          </label>
          <div style={s('font-size:12.5px;color:#736d64;margin-bottom:6px')}>{t('docs.rejectNote')}</div>
          <textarea
            id={`reject-${doc.docType}`}
            rows={2}
            maxLength={1000}
            dir="auto"
            value={note}
            placeholder={t('docs.rejectNotePlaceholder')}
            onChange={(e) => setNote(e.target.value)}
            {...x(
              "width:100%;padding:10px 12px;font-size:14px;line-height:1.5;font-family:'Manrope',system-ui,sans-serif;color:#14202b;border:1px solid #ddd5c8;background:#fff;border-radius:12px;box-sizing:border-box;resize:vertical",
              { focus: 'border-color:#14202b;outline:none' },
            )}
          />
          <div style={s('display:flex;gap:8px;margin-top:8px;flex-wrap:wrap')}>
            <button
              type="button"
              data-reject-confirm
              disabled={pending}
              onClick={() => act('reject', { note: note.trim() || undefined })}
              {...x(
                "background:#14202b;color:#f8f5f0;border:1px solid #14202b;border-radius:999px;padding:7px 14px;font-family:'Manrope',system-ui,sans-serif;font-size:12.5px;font-weight:600;cursor:pointer",
                { hover: 'background:#1e2f3f' },
              )}
            >
              {t('docs.rejectConfirm')}
            </button>
            <button type="button" onClick={() => setRejecting(false)} {...x(SMALL, { hover: 'border-color:#14202b' })}>
              {t('docs.rejectCancel')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

