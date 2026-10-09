import type { CallStatus, CallView } from './types';

/** The booked call on the lead page: which one is shown and what the team can do with it. Pure, see calls.test.ts. */

export interface CallRow {
  id: string;
  starts_at: string;
  ends_at: string;
  status: string;
  timezone: string | null;
  lawyer: { user_id: string; full_name: string } | null;
}

const isStatus = (v: string): v is CallStatus => v === 'confirmed' || v === 'completed' || v === 'no_show';

/**
 * The upcoming call (confirmed, not over yet), or else the latest one whose time has come: held, a no-show, or
 * confirmed and waiting for the team to mark it. Cancelled calls are left to the activity.
 */
export function pickCall(rows: readonly CallRow[], now: Date): CallView | null {
  const ahead = (r: CallRow) => new Date(r.ends_at).getTime() > now.getTime();
  const row =
    rows.find((r) => r.status === 'confirmed' && ahead(r)) ??
    rows
      .filter((r) => isStatus(r.status) && !ahead(r))
      .sort((a, b) => new Date(b.starts_at).getTime() - new Date(a.starts_at).getTime())[0];
  if (!row || !isStatus(row.status)) return null;
  return {
    id: row.id,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    status: row.status,
    upcoming: row.status === 'confirmed' && ahead(row),
    started: new Date(row.starts_at).getTime() <= now.getTime(),
    timezone: row.timezone,
    lawyer: row.lawyer ? { id: row.lawyer.user_id, name: row.lawyer.full_name } : null,
  };
}

/** How the call reads in the panel: booked (ahead), waiting to be marked (its time has come), held, no-show. */
export type CallPhase = 'booked' | 'awaiting' | 'held' | 'no_show';

export const callPhase = (c: CallView): CallPhase =>
  c.status === 'completed' ? 'held' : c.status === 'no_show' ? 'no_show' : c.started ? 'awaiting' : 'booked';

/**
 * The buttons the panel offers (the Server Action checks the same against the stored row): a call that has started can
 * be marked held or a no-show, and either can be corrected to the other; a call that is not over can be cancelled.
 */
export function callActions(c: CallView): Array<'held' | 'no_show' | 'cancel'> {
  const out: Array<'held' | 'no_show' | 'cancel'> = [];
  if (c.started && c.status !== 'completed') out.push('held');
  if (c.started && c.status !== 'no_show') out.push('no_show');
  if (c.upcoming) out.push('cancel');
  return out;
}
