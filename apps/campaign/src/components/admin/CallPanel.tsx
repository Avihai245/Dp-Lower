'use client';

import { s, x } from '@dpl/ui';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { callActionAction } from '@/app/[locale]/(admin)/admin/actions';
import { useAdmin } from './AdminProvider';
import { callActions, callPhase, type CallPhase } from './calls';
import { formatCall } from './format';
import type { CallView } from './types';
import { CARD, HelpTip } from './ui';
import { useRun } from './useRun';

const H2 =
  "font-size:12px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:#7a5c2c;margin:0;font-family:'Manrope',system-ui,sans-serif;line-height:inherit";
const BUTTON =
  "background:#fff;color:#14202b;border:1px solid #e2dbcf;border-radius:999px;padding:7px 12px;font-family:'Manrope',system-ui,sans-serif;font-size:12.5px;font-weight:600;cursor:pointer;white-space:nowrap";
const CONFIRM =
  "border-radius:999px;padding:9px 16px;font-family:'Manrope',system-ui,sans-serif;font-size:13px;font-weight:600;cursor:pointer";

/** chip colours per phase, from the document chips' palette */
const CHIP: Record<CallPhase, { bg: string; fg: string }> = {
  booked: { bg: '#f6f0e4', fg: '#7a5c2c' },
  awaiting: { bg: '#f6f2ec', fg: '#736d64' },
  held: { bg: '#eef4ef', fg: '#2f5a3e' },
  no_show: { bg: '#fbeeea', fg: '#8a3b2c' },
};

/**
 * The free call: when, with which lawyer (or any lawyer, for a seat of the unassigned template), where it stands, and
 * what the team can do with it. Cancelling emails the applicant, so it asks once more. Whether the call has started or
 * is over follows the CRM's clock, so a page left open offers the right buttons; the Server Action checks again.
 */
export function CallPanel({ leadId, call: stored }: { leadId: string; call: CallView }) {
  const t = useTranslations('admin');
  const locale = useLocale();
  const { now } = useAdmin();
  const { pending, run } = useRun();
  const [confirming, setConfirming] = useState(false);
  const call: CallView = {
    ...stored,
    started: Date.parse(stored.startsAt) <= now.getTime(),
    upcoming: stored.status === 'confirmed' && Date.parse(stored.endsAt) > now.getTime(),
  };
  const phase = callPhase(call);
  const actions = callActions(call);
  const act = (action: 'held' | 'no_show' | 'cancel') =>
    run(
      () => callActionAction({ leadId, bookingId: call.id, action }),
      () => setConfirming(false),
    );

  return (
    <div data-call-panel={call.id} data-call-status={call.status} style={s(CARD)}>
      <div style={s('display:flex;align-items:center;gap:8px;margin:0 0 14px')}>
        <h2 style={s(H2)}>{t('callPanel.title')}</h2>
        <span style={s('margin-left:auto')}>
          <HelpTip id="call" />
        </span>
      </div>
      <div style={s('display:flex;align-items:center;gap:8px;flex-wrap:wrap')}>
        <span style={s('font-size:15px;font-weight:600')}>{formatCall(call.startsAt, locale)}</span>
        <span
          data-call-phase={phase}
          style={s(
            `font-size:12px;font-weight:600;padding:4px 10px;border-radius:999px;white-space:nowrap;background:${CHIP[phase].bg};color:${CHIP[phase].fg}`,
          )}
        >
          {t(`callPanel.phase.${phase}`)}
        </span>
      </div>
      <div
        data-call-lawyer={call.lawyer?.id ?? ''}
        style={s('font-size:13.5px;color:#736d64;margin-top:6px')}
      >
        {call.lawyer ? t('callPanel.with', { name: call.lawyer.name }) : t('callPanel.anyLawyer')}
      </div>

      {actions.length > 0 && !confirming && (
        <div style={s('display:flex;flex-wrap:wrap;gap:6px;margin-top:14px')}>
          {actions.includes('held') && (
            <button
              type="button"
              data-call-action="held"
              disabled={pending}
              onClick={() => act('held')}
              {...x(BUTTON, { hover: 'border-color:#14202b' })}
            >
              {t('callPanel.held')}
            </button>
          )}
          {actions.includes('no_show') && (
            <button
              type="button"
              data-call-action="no_show"
              disabled={pending}
              onClick={() => act('no_show')}
              {...x(BUTTON, { hover: 'border-color:#14202b' })}
            >
              {t('callPanel.noShow')}
            </button>
          )}
          {actions.includes('cancel') && (
            <button
              type="button"
              data-call-action="cancel"
              disabled={pending}
              onClick={() => setConfirming(true)}
              {...x(BUTTON, { hover: 'border-color:#a03a2c;color:#a03a2c' })}
            >
              {t('callPanel.cancel')}
            </button>
          )}
        </div>
      )}
      {confirming && (
        <div data-call-confirm style={s('margin-top:14px')}>
          <p style={s('font-size:13.5px;line-height:1.55;color:#736d64;margin:0 0 10px')}>
            {t('callPanel.cancelConfirm')}
          </p>
          <div style={s('display:flex;gap:8px;flex-wrap:wrap')}>
            <button
              type="button"
              data-call-confirm-yes
              disabled={pending}
              onClick={() => act('cancel')}
              style={s(
                `${CONFIRM};background:#8a3b2c;color:#fff;border:1px solid #8a3b2c;opacity:${pending ? '0.4' : '1'}`,
              )}
            >
              {t('callPanel.cancelYes')}
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              {...x(`${CONFIRM};background:#fff;color:#14202b;border:1px solid #e2dbcf`, {
                hover: 'border-color:#14202b',
              })}
            >
              {t('callPanel.cancelNo')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
