'use client';

import { LEAD_STAGES, firstNameOf, needsAttention, type LeadStage, type NextActionCode } from '@dpl/core';
import { s, x } from '@dpl/ui';
import { useLocale, useTranslations } from 'next-intl';
import { nextActionAction } from '@/app/[locale]/(admin)/admin/actions';
import { Link } from '@/i18n/navigation';
import { useAdmin } from './AdminProvider';
import { CallPanel } from './CallPanel';
import { DocumentsPanel } from './DocumentsPanel';
import { ErasePanel } from './ErasePanel';
import { formatCall } from './format';
import { ActivityPanel, AnswersPanel, ApplicationPanel } from './InfoPanels';
import { nextActionFor, pagerOrder, stageNeighbours } from './model';
import { useAgo } from './rowbits';
import { ContactPanel, NotesPanel, OwnerPanel, StatusPanel } from './SidePanels';
import type { LeadDetailData } from './types';
import { Arrow, HelpTip, PILL, useRouteLabels } from './ui';
import { useRun } from './useRun';

const nav = (on: boolean) =>
  `width:38px;height:38px;border-radius:50%;border:1px solid #e2dbcf;background:#fff;color:#14202b;cursor:pointer;font-size:14px;display:grid;place-items:center;padding:0;text-decoration:none;opacity:${on ? '1' : '0.3'};pointer-events:${on ? 'auto' : 'none'}`;
const stageBtn = (on: boolean, dark: boolean) =>
  `${dark ? 'background:#14202b;color:#f8f5f0;border:1px solid #14202b;' : 'background:#fff;color:#14202b;border:1px solid #e2dbcf;'}border-radius:999px;padding:10px 16px;font-family:'Manrope',system-ui,sans-serif;font-size:13px;font-weight:600;cursor:pointer;opacity:${on ? '1' : '0.35'};pointer-events:${on ? 'auto' : 'none'}`;

/** /admin/leads/[id]: everything about one lead, as designed. `detail` comes from the page (server), refreshed live. */
export function LeadDetail({ detail }: { detail: LeadDetailData }) {
  const t = useTranslations('admin');
  const locale = useLocale();
  const ago = useAgo();
  const route = useRouteLabels();
  const { rows, visible, rowsById, listQuery, moveStage, now } = useAdmin();
  const { pending: acting, run } = useRun();

  const { lead } = detail;
  // the stage may have just been moved here or on the board: the shared rows carry the optimistic value
  const live = rowsById.get(lead.id);
  const stage: LeadStage = live?.stage ?? lead.stage;
  const stageSince = live?.stageSince ?? lead.stageSince;
  const attention = needsAttention({ stage, status: lead.status, stageSince: new Date(stageSince), now, hasRejectedDoc: lead.hasRejectedDoc });

  const k = LEAD_STAGES.indexOf(stage);
  const { prev: prevStage, next: nextStage } = stageNeighbours(stage);
  const { order, pos } = pagerOrder(rows, visible, lead.id);
  const prevId = pos > 0 ? order[pos - 1] : undefined;
  const nextId = pos >= 0 && pos < order.length - 1 ? order[pos + 1] : undefined;

  const first = firstNameOf(lead.fullName);
  const action = nextActionFor({ stage, missingDocTypes: lead.missingDocTypes });
  const lower = (v: string) => v.toLocaleLowerCase(locale);
  const docLabel = (codeDocs: typeof lead.missingDocTypes) => {
    const firstDoc = lower(t(`docs.name.${codeDocs[0]}`));
    return codeDocs.length > 1 ? t('next.docAndRest', { doc: firstDoc }) : firstDoc;
  };
  const actionText = (code: NextActionCode): string =>
    code === 'send_document_reminder'
      ? t('next.send_document_reminder.text', { count: action.missing.length, name: first, doc: docLabel(action.missing) })
      : t(`next.${code}.text`, { name: first });

  const doneAt = lead.nextActionDoneAt;
  const where = [lead.where, t('lead.ancestor', { value: lead.ancestor ?? t('answers.notRecorded') })].filter(Boolean).join(' · ');

  const move = (to: LeadStage | null) => {
    if (to) void moveStage(lead.id, to);
  };

  return (
    <div
      data-pad
      style={s("padding:18px 24px 64px;max-width:1440px;margin:0 auto;box-sizing:border-box;font-family:'Manrope',system-ui,sans-serif;color:#14202b")}
    >
      {/* back, position, previous / next */}
      <div style={s('display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:16px')}>
        <Link href={`/admin${listQuery}`} {...x(`${PILL};font-size:13px;padding:9px 16px;text-decoration:none;display:inline-flex;align-items:center;gap:6px`, { hover: 'border-color:#14202b' })}>
          <Arrow back /> {t('lead.back')}
        </Link>
        <span style={s('font-size:13px;color:#9a948a')}>{pos >= 0 ? t('lead.position', { pos: pos + 1, total: order.length }) : ''}</span>
        <HelpTip id="nav" align="left" />
        <span style={s('margin-left:auto;display:flex;gap:6px')}>
          <Link
            href={prevId ? `/admin/leads/${prevId}${listQuery}` : `/admin/leads/${lead.id}${listQuery}`}
            aria-label={t('lead.prev')}
            aria-disabled={!prevId}
            tabIndex={prevId ? undefined : -1}
            {...x(nav(!!prevId), { hover: 'border-color:#14202b' })}
          >
            <Arrow back />
          </Link>
          <Link
            href={nextId ? `/admin/leads/${nextId}${listQuery}` : `/admin/leads/${lead.id}${listQuery}`}
            aria-label={t('lead.next')}
            aria-disabled={!nextId}
            tabIndex={nextId ? undefined : -1}
            {...x(nav(!!nextId), { hover: 'border-color:#14202b' })}
          >
            <Arrow />
          </Link>
        </span>
      </div>

      {/* identity and case stages */}
      <div style={s('background:#fff;border:1px solid #e8e1d5;border-radius:18px;padding:24px 26px;margin-bottom:14px')}>
        <div style={s('display:flex;align-items:flex-start;gap:16px 24px;flex-wrap:wrap')}>
          <div style={s('flex:1;min-width:240px')}>
            <div style={s('display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:6px')}>
              <span style={s('font-size:12.5px;letter-spacing:0.04em;color:#736d64')}>
                <bdi>{lead.caseRef}</bdi>
              </span>
              <span
                style={s(
                  'font-size:10.5px;font-weight:700;letter-spacing:0.1em;padding:2px 8px;border-radius:999px;background:var(--color-accent-100);color:var(--color-accent-800);text-transform:uppercase',
                )}
              >
                {route.long(lead.route)}
              </span>
              {attention && (
                <span style={s('font-size:11px;font-weight:700;padding:3px 9px;border-radius:999px;background:#fbeeea;color:#8a3b2c')}>{t('lead.attention')}</span>
              )}
              {detail.call?.upcoming && (
                <span
                  data-call-chip
                  style={s('font-size:11px;font-weight:700;padding:3px 9px;border-radius:999px;background:#f6f0e4;color:#7a5c2c')}
                >
                  {t('lead.callBooked', { when: formatCall(detail.call.startsAt, locale) })}
                </span>
              )}
            </div>
            <h1 style={s("font-family:'Newsreader',Georgia,serif;font-size:34px;line-height:1.1;font-weight:400;letter-spacing:0;margin:0")}>{lead.fullName}</h1>
            <div style={s('font-size:14px;color:#736d64;margin-top:4px')}>{where}</div>
          </div>
          <div style={s('display:flex;gap:8px;align-items:center')}>
            <EditButton id={lead.id} label={t('lead.edit')} />
            <HelpTip id="edit" />
          </div>
        </div>

        <div style={s('border-top:1px solid #f0ebe2;margin-top:20px;padding-top:18px')}>
          <ol data-lp-stages aria-label={t('lead.stageTrack')} style={s('display:grid;grid-template-columns:repeat(6, minmax(0, 1fr));gap:6px;list-style:none;margin:0;padding:0')}>
            {LEAD_STAGES.map((st, j) => (
              <li key={st} aria-current={j === k ? 'step' : undefined} style={s('display:flex;flex-direction:column;gap:8px')}>
                <span style={s(`display:block;height:5px;border-radius:999px;background:${j < k ? '#3f6b4f' : j === k ? '#a07a3c' : '#ece6dc'}`)} />
                <span style={s('display:flex;align-items:center;gap:7px')}>
                  <span
                    style={s(
                      `width:22px;height:22px;border-radius:50%;display:grid;place-items:center;flex:none;font-size:11px;font-weight:700;${j < k ? 'background:#3f6b4f;color:#fff' : j === k ? 'background:#a07a3c;color:#fff' : 'background:#f2efe9;color:#9a948a'}`,
                    )}
                  >
                    {j < k ? '✓' : String(j + 1)}
                  </span>
                  <span style={s(`font-size:12.5px;line-height:1.25;font-weight:${j === k ? '700' : '500'};color:${j <= k ? '#14202b' : '#9a948a'}`)}>{t(`stage.${st}`)}</span>
                </span>
              </li>
            ))}
          </ol>
          <div style={s('display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:16px')}>
            <button type="button" onClick={() => move(prevStage)} {...x(stageBtn(k > 0, false), { hover: 'border-color:#14202b' })}>
              <Arrow back /> {t('lead.stageBack')}
            </button>
            <button type="button" data-stage-forward onClick={() => move(nextStage)} {...x(stageBtn(k < LEAD_STAGES.length - 1, true), { hover: 'background:#1e2f3f' })}>
              {nextStage ? (
                <>
                  {t('lead.stageForward', { stage: t(`stage.${nextStage}`) })} <Arrow />
                </>
              ) : (
                t('lead.stageFinal')
              )}
            </button>
            <span style={s('font-size:13px;color:#736d64;margin-left:4px')}>
              {t('lead.stageSince', { when: ago(stageSince, { long: true }).toLocaleLowerCase(locale) })}
            </span>
            <span style={s('margin-left:auto')}>
              <HelpTip id="stages" />
            </span>
          </div>
        </div>
      </div>

      {/* next action */}
      <div style={s('display:flex;align-items:flex-start;gap:14px;background:#14202b;color:#f8f5f0;border-radius:18px;padding:18px 22px;margin-bottom:14px;flex-wrap:wrap')}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#c9a45c" strokeWidth="1.7" style={s('flex:none;margin-top:2px;transform:scaleX(var(--dir, 1))')} aria-hidden>
          <path d="M5 12h14M13 6l6 6-6 6" />
        </svg>
        <div style={s('flex:1;min-width:220px')}>
          <div
            style={s(
              'display:flex;align-items:center;gap:8px;font-size:11.5px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:#c9a45c;margin-bottom:4px',
            )}
          >
            {t('next.title')} <HelpTip id="next" align="left" />
          </div>
          <div data-next-text style={s('font-size:17px;line-height:1.4')}>
            {actionText(action.code)}
          </div>
        </div>
        {!doneAt ? (
          <button
            type="button"
            data-next-action={action.code}
            disabled={acting}
            onClick={() => run(() => nextActionAction({ leadId: lead.id, expected: action.code }))}
            {...x(
              "background:#c9a45c;color:#14202b;border:1px solid #c9a45c;border-radius:999px;padding:12px 20px;font-family:'Manrope',system-ui,sans-serif;font-size:13.5px;font-weight:700;cursor:pointer;align-self:center",
              { hover: 'background:#d6b46e' },
            )}
          >
            {t(`next.${action.code}.button`)}
          </button>
        ) : (
          <span data-next-done style={s('align-self:center;font-size:14px;color:#b9d3be')}>
            {t('next.done', { when: ago(doneAt, { long: true }).toLocaleLowerCase(locale) })}
          </span>
        )}
      </div>

      <div data-resp="2" style={s('display:grid;grid-template-columns:minmax(0, 1.5fr) minmax(0, 1fr);gap:14px;align-items:start')}>
        <div style={s('display:flex;flex-direction:column;gap:14px')}>
          <DocumentsPanel detail={detail} />
          <div data-resp="2" style={s('display:grid;grid-template-columns:minmax(0, 1fr) minmax(0, 1fr);gap:14px')}>
            <ApplicationPanel sections={detail.sections} />
            <AnswersPanel answers={detail.answers} />
          </div>
          <ActivityPanel activity={detail.activity} />
        </div>
        <div style={s('display:flex;flex-direction:column;gap:14px')}>
          <ContactPanel detail={detail} />
          {detail.call && <CallPanel key={detail.call.id} leadId={lead.id} call={detail.call} />}
          <OwnerPanel lead={lead} />
          <StatusPanel lead={lead} />
          <NotesPanel detail={detail} />
          <ErasePanel lead={lead} />
        </div>
      </div>
    </div>
  );
}

function EditButton({ id, label }: { id: string; label: string }) {
  const { editLead } = useAdmin();
  return (
    <button type="button" data-edit-lead onClick={() => editLead(id)} {...x(`${PILL};font-size:13px;padding:10px 16px`, { hover: 'border-color:#14202b' })}>
      {label}
    </button>
  );
}

