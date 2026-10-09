'use client';

import { DOC_TYPES, LEAD_STAGES, type LeadStage } from '@dpl/core';
import { s, x } from '@dpl/ui';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Link, useRouter } from '@/i18n/navigation';
import { useAdmin } from './AdminProvider';
import { boardColumns, type LeadRow } from './model';
import { sub, useAgo, useIsolate, useWaitingLabel } from './rowbits';
import { Arrow, useRouteLabels } from './ui';

const arrowBtn = (on: boolean) =>
  `width:30px;height:30px;border-radius:50%;border:1px solid #e2dbcf;background:#fff;color:#14202b;cursor:pointer;font-size:13px;line-height:1;display:grid;place-items:center;padding:0;opacity:${on ? '1' : '0.3'};pointer-events:${on ? 'auto' : 'none'}`;

/**
 * The "Board" view: six stage columns. A card can be dragged to another column (HTML5 drag and drop, the stage changes
 * at once and is saved by the Server Action) or moved with its arrow buttons.
 */
export function LeadsBoard({ rows }: { rows: LeadRow[] }) {
  const t = useTranslations('admin');
  const router = useRouter();
  const { moveStage, editLead, listQuery, notify } = useAdmin();
  const route = useRouteLabels();
  const waitingLabel = useWaitingLabel();
  const ago = useAgo();
  const isolate = useIsolate();
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<LeadStage | null>(null);

  const move = async (r: LeadRow, stage: LeadStage) => {
    if (r.stage === stage) return;
    if (await moveStage(r.id, stage)) notify(t('board.moved', { name: r.fullName, stage: t(`stage.${stage}`) }));
  };

  return (
    <div
      data-board
      style={s('display:grid;grid-auto-flow:column;grid-auto-columns:minmax(250px, 1fr);gap:12px;overflow-x:auto;padding-bottom:12px;align-items:start')}
    >
      {boardColumns(rows).map((col) => {
        const over = dragOver === col.stage;
        return (
          <section
            key={col.stage}
            data-board-col={col.stage}
            aria-label={t(`stage.${col.stage}`)}
            onDragOver={(e) => {
              e.preventDefault();
              if (dragOver !== col.stage) setDragOver(col.stage);
            }}
            onDragLeave={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node | null) && dragOver === col.stage) setDragOver(null);
            }}
            onDrop={(e) => {
              e.preventDefault();
              const id = e.dataTransfer.getData('text/plain');
              setDragOver(null);
              setDragId(null);
              const card = rows.find((r) => r.id === id);
              if (card) void move(card, col.stage);
            }}
            style={s(
              `background:${over ? '#efe7d8' : '#f2efe9'};border:1px solid ${over ? '#a07a3c' : '#e8e1d5'};border-radius:16px;padding:10px;transition:background 140ms ease, border-color 140ms ease`,
            )}
          >
            <div style={s('display:flex;align-items:center;gap:8px;padding:4px 6px 12px')}>
              <span style={s(`width:9px;height:9px;border-radius:50%;background:${col.dot};flex:none`)} />
              <h3 style={s("font-size:13px;font-weight:700;letter-spacing:0.02em;margin:0;font-family:'Manrope',system-ui,sans-serif")}>{t(`stage.${col.stage}`)}</h3>
              <span
                style={s(
                  'margin-left:auto;min-width:24px;height:22px;padding:0 7px;box-sizing:border-box;border-radius:999px;background:#fff;border:1px solid #e2dbcf;display:grid;place-items:center;font-size:12px;font-weight:600',
                )}
              >
                {col.rows.length}
              </span>
            </div>
            <div style={s('display:flex;flex-direction:column;gap:8px;min-height:64px')}>
              {col.rows.map((r) => {
                const k = LEAD_STAGES.indexOf(r.stage);
                const prev = LEAD_STAGES[k - 1];
                const next = LEAD_STAGES[k + 1];
                return (
                  <div
                    key={r.id}
                    data-lead-card={r.id}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData('text/plain', r.id);
                      e.dataTransfer.effectAllowed = 'move';
                      setDragId(r.id);
                    }}
                    onDragEnd={() => {
                      setDragId(null);
                      setDragOver(null);
                    }}
                    onClick={() => router.push(`/admin/leads/${r.id}${listQuery}`)}
                    {...x(
                      `background:#fff;border:1px solid ${r.attention ? '#e4c9a3' : '#e8e1d5'};border-radius:14px;padding:12px 12px 10px;cursor:grab;transition:border-color 140ms ease, box-shadow 140ms ease;opacity:${dragId === r.id ? '0.45' : '1'}`,
                      { hover: 'border-color:#c9bfae;box-shadow:0 6px 18px rgba(20,32,43,0.08)' },
                    )}
                  >
                    <div style={s('display:flex;align-items:center;gap:8px;margin-bottom:8px')}>
                      <span style={s(`font-size:11.5px;letter-spacing:0.04em;color:${sub(55)}`)}>
                        <bdi>{r.caseRef}</bdi>
                      </span>
                      <span
                        style={s(
                          'font-size:10.5px;font-weight:600;letter-spacing:0.1em;padding:2px 7px;border-radius:999px;background:var(--color-accent-100);color:var(--color-accent-800)',
                        )}
                      >
                        {route.short(r.route)}
                      </span>
                      <span style={s(`margin-left:auto;font-size:11.5px;color:${sub(50)}`)}>{ago(r.updatedAt)}</span>
                    </div>
                    <div style={s('font-size:15px;font-weight:600;line-height:1.25;overflow-wrap:anywhere')}>
                      <Link
                        href={`/admin/leads/${r.id}${listQuery}`}
                        onClick={(e) => e.stopPropagation()}
                        draggable={false}
                        style={s('color:inherit;text-decoration:none')}
                      >
                        {r.fullName}
                      </Link>
                    </div>
                    {r.where && <div style={s(`font-size:12.5px;color:${sub(58)};margin-top:2px`)}>{r.where}</div>}
                    <div style={s('display:flex;align-items:center;flex-wrap:wrap;gap:4px 10px;margin-top:12px;padding-top:10px;border-top:1px solid #f0ebe2')}>
                      <span style={s(`font-size:12px;white-space:nowrap;color:${sub(62)}`)}>
                        {t('board.docs', { value: isolate(`${r.docsReceived}/${DOC_TYPES.length}`) })}
                      </span>
                      {r.notesCount > 0 && (
                        <span
                          title={t('board.notes', { count: r.notesCount })}
                          style={s('display:inline-flex;align-items:center;gap:4px;font-size:12px;font-weight:600;color:#7a5c2c')}
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
                            <path d="M4 4h16v12H8l-4 4z" />
                          </svg>
                          {r.notesCount}
                        </span>
                      )}
                      <span
                        style={s(
                          `margin-left:auto;font-size:12px;font-weight:${r.attention ? '600' : '400'};color:${r.attention ? '#8a4b1f' : sub(50)};text-align:right`,
                        )}
                      >
                        {r.waiting === 'nothing' ? t('waiting.nothingPending') : t('waiting.pending', { what: waitingLabel(r) })}
                      </span>
                    </div>
                    <div style={s('display:flex;align-items:center;gap:6px;margin-top:10px')}>
                      <button
                        type="button"
                        aria-label={t('board.back')}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (prev) void move(r, prev);
                        }}
                        {...x(arrowBtn(k > 0), { hover: 'border-color:#14202b' })}
                      >
                        <Arrow back />
                      </button>
                      <button
                        type="button"
                        aria-label={t('board.forward')}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (next) void move(r, next);
                        }}
                        {...x(arrowBtn(k < LEAD_STAGES.length - 1), { hover: 'border-color:#14202b' })}
                      >
                        <Arrow />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          editLead(r.id);
                        }}
                        {...x(
                          "background:#fff;border:1px solid #e2dbcf;border-radius:999px;font-family:'Manrope',system-ui,sans-serif;font-weight:600;color:#14202b;cursor:pointer;margin-left:auto;font-size:12px;padding:5px 12px",
                          { hover: 'border-color:#14202b' },
                        )}
                      >
                        {t('board.edit')}
                      </button>
                    </div>
                  </div>
                );
              })}
              {col.rows.length === 0 && (
                <div
                  style={s(
                    `border:1px dashed #d8cfc0;border-radius:12px;padding:16px;text-align:center;font-size:12.5px;color:${sub(50)}`,
                  )}
                >
                  {t('board.empty')}
                </div>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}
