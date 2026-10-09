import {
  APPLICANT_STATUS_OPTIONS,
  DOC_TYPES,
  LEAD_STAGES,
  needsAttention,
  nextAction,
  stageIndex,
  waitingOn,
  type DocType,
  type LeadStage,
  type NextActionCode,
  type WaitingOn,
} from '@dpl/core';
import type { LeadRowData } from './types';

/** Pure derivations for the CRM list, board and pager. No I/O, no React: unit-tested in model.test.ts. */

export const FILTER_KEYS = ['open', 'attention', 'new', 'germany', 'austria'] as const;
export type FilterKey = (typeof FILTER_KEYS)[number];
export const DEFAULT_FILTER: FilterKey = 'open';

export const VIEW_KEYS = ['table', 'board'] as const;
export type ViewKey = (typeof VIEW_KEYS)[number];
export const DEFAULT_VIEW: ViewKey = 'table';

export const parseFilter = (v: string | null | undefined): FilterKey => FILTER_KEYS.find((k) => k === v) ?? DEFAULT_FILTER;
export const parseView = (v: string | null | undefined): ViewKey => VIEW_KEYS.find((k) => k === v) ?? DEFAULT_VIEW;

/** Board columns: stage key, i18n key lives under `stage.<key>`, dot colour as designed. */
export const BOARD_COLUMNS: ReadonlyArray<{ stage: LeadStage; dot: string }> = [
  { stage: 'lead', dot: '#b4ada2' },
  { stage: 'account', dot: '#a07a3c' },
  { stage: 'application', dot: '#c9a45c' },
  { stage: 'review', dot: '#5980a6' },
  { stage: 'filed', dot: '#14202b' },
  { stage: 'granted', dot: '#3f6b4f' },
];

/** A row with everything derived from the stored columns (and the clock). */
export interface LeadRow extends LeadRowData {
  missingDocs: number;
  docsReceived: number;
  waiting: WaitingOn;
  attention: boolean;
  /** lower-cased haystack for the search box */
  haystack: string;
}

export function deriveRow(d: LeadRowData, now: Date): LeadRow {
  const missingDocs = d.missingDocTypes.length;
  const waiting = waitingOn({
    stage: d.stage,
    status: d.status,
    missingDocs,
    applicationComplete: d.applicationComplete,
  });
  const attention = needsAttention({
    stage: d.stage,
    status: d.status,
    stageSince: new Date(d.stageSince),
    now,
    hasRejectedDoc: d.hasRejectedDoc,
  });
  return {
    ...d,
    missingDocs,
    docsReceived: DOC_TYPES.length - missingDocs,
    waiting,
    attention,
    haystack: [d.caseRef, d.fullName, d.email, d.phone, d.ancestor, d.where].filter(Boolean).join(' ').toLowerCase(),
  };
}

export const FILTERS: Record<FilterKey, (r: LeadRow) => boolean> = {
  open: (r) => r.stage !== 'granted',
  attention: (r) => r.attention,
  new: (r) => r.stage === 'lead' || r.stage === 'account',
  // a lead whose family history touches both countries is in both lists
  germany: (r) => r.route === 'germany' || r.route === 'both',
  austria: (r) => r.route === 'austria' || r.route === 'both',
};

export function filterCounts(rows: readonly LeadRow[]): Record<FilterKey, number> {
  return Object.fromEntries(FILTER_KEYS.map((k) => [k, rows.filter(FILTERS[k]).length])) as Record<FilterKey, number>;
}

/** Every whitespace separated word must appear somewhere in the lead's name, case ref, email, phone or ancestor. */
export function matchesQuery(r: Pick<LeadRow, 'haystack'>, query: string): boolean {
  const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  return tokens.every((t) => r.haystack.includes(t));
}

export function visibleRows(rows: readonly LeadRow[], filter: FilterKey, query: string): LeadRow[] {
  return rows.filter((r) => FILTERS[filter](r) && matchesQuery(r, query));
}

export interface Stats {
  attention: number;
  waiting: number;
  review: number;
  newLeads: number;
}

/** The four counters above the list: live totals over all leads, independent of filter and search. */
export function computeStats(rows: readonly LeadRow[]): Stats {
  return {
    attention: rows.filter((r) => r.attention).length,
    waiting: rows.filter((r) => r.waiting !== 'nothing' && r.stage !== 'granted').length,
    review: rows.filter((r) => r.stage === 'review').length,
    newLeads: rows.filter((r) => r.stage === 'lead').length,
  };
}

export function boardColumns(rows: readonly LeadRow[]): Array<{ stage: LeadStage; dot: string; rows: LeadRow[] }> {
  return BOARD_COLUMNS.map((c) => ({ ...c, rows: rows.filter((r) => r.stage === c.stage) }));
}

/**
 * The order the "previous / next lead" arrows walk: the leads of the current filter and search; when the open lead is
 * not part of it (arrived by link), all leads.
 */
export function pagerOrder(all: readonly LeadRow[], visible: readonly LeadRow[], id: string): { order: string[]; pos: number } {
  const vis = visible.map((r) => r.id);
  const order = vis.includes(id) ? vis : all.map((r) => r.id);
  return { order, pos: order.indexOf(id) };
}

export const stageNeighbours = (s: LeadStage): { prev: LeadStage | null; next: LeadStage | null } => {
  const i = stageIndex(s);
  return { prev: LEAD_STAGES[i - 1] ?? null, next: LEAD_STAGES[i + 1] ?? null };
};

/** Next-action card for a lead: what to do and (for documents) which slots are open. */
export interface NextActionInfo {
  code: NextActionCode;
  missing: DocType[];
}
export const nextActionFor = (r: Pick<LeadRow, 'stage' | 'missingDocTypes'>): NextActionInfo => ({
  code: nextAction(r.stage, r.missingDocTypes.length),
  missing: r.missingDocTypes,
});

/** The statuses that staff pick from in "Status shown to the applicant". */
export const STATUS_OPTIONS = APPLICANT_STATUS_OPTIONS;

// -- ancestor line ---------------------------------------------------------------------------------------------------

type Data = Partial<Record<string, string>>;

/** "Ruth Weiss · Vienna 1911" from the application's ancestor fields; null until a name is recorded. */
export function ancestorLine(data: Data | null | undefined): string | null {
  const name = (data?.anName ?? '').trim();
  if (!name) return null;
  const place = (data?.anBirthPlace ?? '').split(',')[0]!.trim();
  const year = /\b(1[0-9]{3}|20[0-9]{2})\b/.exec(data?.anDob ?? '')?.[1] ?? '';
  const tail = [place, year].filter(Boolean).join(' ');
  return tail ? `${name} · ${tail}` : name;
}

// -- relative time -------------------------------------------------------------------------------------------------

export type Rel =
  | { kind: 'now' }
  | { kind: 'min'; n: number }
  | { kind: 'hour'; n: number }
  | { kind: 'yesterday' }
  | { kind: 'day'; n: number }
  | { kind: 'week'; n: number }
  | { kind: 'date' };

/** The prototype's `ago()`: "Just now", "N min ago", "Nh ago", "Yesterday", "N days ago", then weeks, then a date. */
export function relTime(thenMs: number, nowMs: number): Rel {
  const m = Math.round((nowMs - thenMs) / 60000);
  if (m < 1) return { kind: 'now' };
  if (m < 60) return { kind: 'min', n: m };
  const hr = Math.round(m / 60);
  if (hr < 24) return { kind: 'hour', n: hr };
  const d = Math.round(hr / 24);
  if (d === 1) return { kind: 'yesterday' };
  if (d < 7) return { kind: 'day', n: d };
  if (d < 35) return { kind: 'week', n: Math.max(1, Math.round(d / 7)) };
  return { kind: 'date' };
}

/** 'HH:MM' for any 'HH:MM[:SS]' Postgres time. */
export const hhmm = (t: string): string => t.slice(0, 5);

/** A valid 24-hour 'HH:MM' (the availability editor and its Server Actions). */
export const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/** What has been typed into one row of the weekly template; only the fields the person touched are held. */
export interface RuleDraft {
  time?: string;
  capacity?: string;
  active?: boolean;
}

/**
 * Keeps only the fields of a row's draft that still differ from the stored rule, so a stored change (a save arriving,
 * or another admin's edit) shows at once while what is being typed into the other fields stays. The capacity compares
 * as a number: "03" is the stored 3.
 */
export function trimRuleDraft(d: RuleDraft, rule: { startTime: string; capacity: number; active: boolean }): RuleDraft {
  const sameCapacity = d.capacity !== undefined && /^\d{1,2}$/.test(d.capacity) && Number(d.capacity) === rule.capacity;
  return {
    ...(d.time !== undefined && d.time !== rule.startTime ? { time: d.time } : {}),
    ...(d.capacity !== undefined && !sameCapacity ? { capacity: d.capacity } : {}),
    ...(d.active !== undefined && d.active !== rule.active ? { active: d.active } : {}),
  };
}
