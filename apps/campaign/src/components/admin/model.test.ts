import { describe, expect, it } from 'vitest';
import {
  FILTERS,
  TIME_RE,
  ancestorLine,
  boardColumns,
  computeStats,
  deriveRow,
  filterCounts,
  matchesQuery,
  nextActionFor,
  pagerOrder,
  parseFilter,
  parseView,
  relTime,
  stageNeighbours,
  trimRuleDraft,
  visibleRows,
  type LeadRow,
} from './model';
import type { LeadRowData } from './types';

const NOW = new Date('2026-10-09T12:00:00Z');
const ago = (days: number, hours = 0) => new Date(NOW.getTime() - days * 86_400_000 - hours * 3_600_000).toISOString();

const lead = (over: Partial<LeadRowData> = {}): LeadRowData => ({
  id: 'id-1',
  caseRef: 'DPL-26-1001',
  fullName: 'Sarah Weiss',
  email: 'sarah.weiss@example.com',
  phone: '+1 718 555 0142',
  locale: 'en',
  route: 'austria',
  where: 'United States',
  ancestor: 'Ruth Weiss · Vienna 1911',
  stage: 'application',
  stageSince: ago(1),
  status: 'application_incomplete',
  ownerId: null,
  missingDocTypes: ['birth_certificate', 'passport', 'other'],
  hasRejectedDoc: false,
  notesCount: 0,
  createdAt: ago(10),
  updatedAt: ago(0, 2),
  nextCallAt: null,
  applicationComplete: false,
  nextActionDoneAt: null,
  ...over,
});
const row = (over: Partial<LeadRowData> = {}) => deriveRow(lead(over), NOW);

describe('deriveRow', () => {
  it('counts documents and works out what the lead is waiting on', () => {
    const r = row();
    expect(r.missingDocs).toBe(3);
    expect(r.docsReceived).toBe(5);
    expect(r.waiting).toBe('documents');
    expect(row({ missingDocTypes: [], applicationComplete: true }).waiting).toBe('nothing');
    expect(row({ missingDocTypes: [], applicationComplete: false }).waiting).toBe('application');
    expect(row({ stage: 'lead' }).waiting).toBe('portal');
    expect(row({ stage: 'account' }).waiting).toBe('application');
    expect(row({ stage: 'review' }).waiting).toBe('nothing');
    expect(row({ stage: 'review', status: 'info_required' }).waiting).toBe('applicant');
  });

  it('flags cases that need attention', () => {
    expect(row().attention).toBe(false);
    expect(row({ hasRejectedDoc: true }).attention).toBe(true);
    expect(row({ status: 'info_required' }).attention).toBe(true);
    // stuck for a week (two stages: application/account 7 days, review 5 days)
    expect(row({ stage: 'application', stageSince: ago(7) }).attention).toBe(true);
    expect(row({ stage: 'review', stageSince: ago(5) }).attention).toBe(true);
    expect(row({ stage: 'review', stageSince: ago(4) }).attention).toBe(false);
    // filed cases are waiting on the authority, granted ones are done
    expect(row({ stage: 'filed', stageSince: ago(60) }).attention).toBe(false);
    expect(row({ stage: 'granted', hasRejectedDoc: true }).attention).toBe(false);
  });

  it('builds a lower-case search haystack from name, case ref, email, phone, ancestor and residence', () => {
    const r = row();
    for (const part of ['sarah weiss', 'dpl-26-1001', 'sarah.weiss@example.com', '+1 718 555 0142', 'ruth weiss', 'united states']) {
      expect(r.haystack).toContain(part);
    }
  });
});

describe('filters, counts and stats', () => {
  const rows: LeadRow[] = [
    row({ id: 'a', stage: 'lead', route: 'germany', status: 'enquiry', missingDocTypes: [] }),
    row({ id: 'b', stage: 'account', route: 'austria', status: 'account_created' }),
    row({ id: 'c', stage: 'application', route: 'both', hasRejectedDoc: true }),
    row({ id: 'd', stage: 'review', route: 'germany', status: 'under_review', missingDocTypes: [] }),
    row({ id: 'e', stage: 'filed', route: 'austria', status: 'review_completed', missingDocTypes: [] }),
    row({ id: 'f', stage: 'granted', route: 'germany', status: 'review_completed', missingDocTypes: [] }),
    row({ id: 'g', stage: 'review', route: null, status: 'info_required', missingDocTypes: [] }),
  ];
  const ids = (list: LeadRow[]) => list.map((r) => r.id);

  it('"All open" hides granted cases; "New" is lead and account; "Needs attention" follows the flag', () => {
    expect(ids(rows.filter(FILTERS.open))).toEqual(['a', 'b', 'c', 'd', 'e', 'g']);
    expect(ids(rows.filter(FILTERS.new))).toEqual(['a', 'b']);
    expect(ids(rows.filter(FILTERS.attention))).toEqual(['c', 'g']);
  });

  it('a lead whose history touches both countries is in both route filters', () => {
    expect(ids(rows.filter(FILTERS.germany))).toEqual(['a', 'c', 'd', 'f']);
    expect(ids(rows.filter(FILTERS.austria))).toEqual(['b', 'c', 'e']);
  });

  it('filter counts ignore the search, stats are totals over every lead', () => {
    expect(filterCounts(rows)).toEqual({ open: 6, attention: 2, new: 2, germany: 4, austria: 3 });
    // waiting: a (account), b (application), c (documents), g (applicant's reply); granted and filed never wait
    expect(computeStats(rows)).toEqual({ attention: 2, waiting: 4, review: 2, newLeads: 1 });
  });

  it('the visible list applies the filter and the search together', () => {
    expect(ids(visibleRows(rows, 'germany', ''))).toEqual(['a', 'c', 'd', 'f']);
    expect(ids(visibleRows(rows, 'open', 'DPL-26-1001'))).toEqual(['a', 'b', 'c', 'd', 'e', 'g']);
    expect(ids(visibleRows(rows, 'open', 'no-such-person'))).toEqual([]);
  });

  it('groups the board by stage in column order', () => {
    const cols = boardColumns(rows);
    expect(cols.map((c) => c.stage)).toEqual(['lead', 'account', 'application', 'review', 'filed', 'granted']);
    expect(cols.map((c) => ids(c.rows))).toEqual([['a'], ['b'], ['c'], ['d', 'g'], ['e'], ['f']]);
  });
});

describe('search', () => {
  const r = row({ id: 'x', fullName: 'Miriam K. Bloch', ancestor: 'Elsa Bloch · Graz 1919', email: 'miriam@example.com', caseRef: 'DPL-26-1064' });
  it('matches every word anywhere in the lead, ignoring case', () => {
    expect(matchesQuery(r, '')).toBe(true);
    expect(matchesQuery(r, 'MIRIAM')).toBe(true);
    expect(matchesQuery(r, 'dpl-26-1064')).toBe(true);
    expect(matchesQuery(r, 'elsa graz')).toBe(true);
    expect(matchesQuery(r, 'miriam@example')).toBe(true);
    expect(matchesQuery(r, '555 0142')).toBe(true);
    expect(matchesQuery(r, 'miriam hoffmann')).toBe(false);
    expect(matchesQuery(r, '  bloch   1919 ')).toBe(true);
  });
});

describe('pager', () => {
  const all = ['a', 'b', 'c', 'd'].map((id) => row({ id }));
  const visible = [all[1]!, all[3]!];
  it('walks the filtered list when the lead is in it', () => {
    expect(pagerOrder(all, visible, 'd')).toEqual({ order: ['b', 'd'], pos: 1 });
  });
  it('falls back to every lead when the open lead is outside the filter', () => {
    expect(pagerOrder(all, visible, 'c')).toEqual({ order: ['a', 'b', 'c', 'd'], pos: 2 });
  });
});

describe('stages and next action', () => {
  it('knows the neighbours of a stage', () => {
    expect(stageNeighbours('lead')).toEqual({ prev: null, next: 'account' });
    expect(stageNeighbours('review')).toEqual({ prev: 'application', next: 'filed' });
    expect(stageNeighbours('granted')).toEqual({ prev: 'filed', next: null });
  });
  it('picks the next action from the stage and the missing documents', () => {
    expect(nextActionFor({ stage: 'lead', missingDocTypes: [] }).code).toBe('send_portal_invite');
    expect(nextActionFor({ stage: 'account', missingDocTypes: [] }).code).toBe('send_reminder');
    expect(nextActionFor({ stage: 'application', missingDocTypes: ['passport'] })).toEqual({ code: 'send_document_reminder', missing: ['passport'] });
    expect(nextActionFor({ stage: 'application', missingDocTypes: [] }).code).toBe('move_to_review');
    expect(nextActionFor({ stage: 'review', missingDocTypes: [] }).code).toBe('assign_to_me');
    expect(nextActionFor({ stage: 'filed', missingDocTypes: [] }).code).toBe('send_status_update');
    expect(nextActionFor({ stage: 'granted', missingDocTypes: [] }).code).toBe('send_closing_email');
  });
});

describe('ancestorLine', () => {
  it('shows name, place and year as designed', () => {
    expect(ancestorLine({ anName: 'Ruth Weiss', anBirthPlace: 'Vienna, Austria', anDob: '04 / 06 / 1911' })).toBe('Ruth Weiss · Vienna 1911');
    expect(ancestorLine({ anName: 'Josef Ackermann', anBirthPlace: 'Berlin', anDob: '1908' })).toBe('Josef Ackermann · Berlin 1908');
    expect(ancestorLine({ anName: 'Hugo Feldman', anBirthPlace: 'Linz' })).toBe('Hugo Feldman · Linz');
    expect(ancestorLine({ anName: 'Hugo Feldman', anDob: '1916' })).toBe('Hugo Feldman · 1916');
    expect(ancestorLine({ anName: '  Lotte Steiner ' })).toBe('Lotte Steiner');
  });
  it('is empty until a name is recorded', () => {
    expect(ancestorLine({})).toBeNull();
    expect(ancestorLine(null)).toBeNull();
    expect(ancestorLine({ anBirthPlace: 'Graz', anDob: '1919' })).toBeNull();
  });
});

describe('relTime', () => {
  const at = (minutes: number) => relTime(NOW.getTime() - minutes * 60_000, NOW.getTime());
  it('follows the prototype: just now, minutes, hours, yesterday, days, weeks, then a date', () => {
    expect(at(0)).toEqual({ kind: 'now' });
    expect(at(-5)).toEqual({ kind: 'now' }); // a clock slightly ahead is still "just now"
    expect(at(1)).toEqual({ kind: 'min', n: 1 });
    expect(at(59)).toEqual({ kind: 'min', n: 59 });
    expect(at(120)).toEqual({ kind: 'hour', n: 2 });
    expect(at(23 * 60)).toEqual({ kind: 'hour', n: 23 });
    expect(at(24 * 60)).toEqual({ kind: 'yesterday' });
    expect(at(3 * 24 * 60)).toEqual({ kind: 'day', n: 3 });
    expect(at(7 * 24 * 60)).toEqual({ kind: 'week', n: 1 });
    expect(at(21 * 24 * 60)).toEqual({ kind: 'week', n: 3 });
    expect(at(90 * 24 * 60)).toEqual({ kind: 'date' });
  });
});

describe('url state and inputs', () => {
  it('falls back to the defaults for anything unknown', () => {
    expect(parseFilter('attention')).toBe('attention');
    expect(parseFilter('nonsense')).toBe('open');
    expect(parseFilter(null)).toBe('open');
    expect(parseView('board')).toBe('board');
    expect(parseView('grid')).toBe('table');
  });
  it('accepts only 24-hour HH:MM', () => {
    for (const ok of ['00:00', '09:30', '12:00', '23:59']) expect(TIME_RE.test(ok), ok).toBe(true);
    for (const bad of ['24:00', '9:30', '12:60', '1230', '12:3', '', '12:00:00', 'ab:cd', ' 12:00']) expect(TIME_RE.test(bad), bad).toBe(false);
  });
});

describe('weekly template draft', () => {
  const stored = { startTime: '03:07', capacity: 3, active: false };

  it('holds only the fields that differ from the stored rule', () => {
    expect(trimRuleDraft({}, stored)).toEqual({});
    expect(trimRuleDraft({ time: '03:09', capacity: '3', active: false }, stored)).toEqual({ time: '03:09' });
    expect(trimRuleDraft({ time: '03:07', capacity: '4', active: true }, stored)).toEqual({ capacity: '4', active: true });
  });

  it('compares the capacity as a number, and keeps text that is not one', () => {
    expect(trimRuleDraft({ capacity: '03' }, stored)).toEqual({});
    expect(trimRuleDraft({ capacity: '' }, stored)).toEqual({ capacity: '' });
    expect(trimRuleDraft({ capacity: '3x' }, stored)).toEqual({ capacity: '3x' });
  });

  it('lets a stored change show through, while typing in other fields stays', () => {
    // the person typed a new time while their own save of the capacity was still on its way
    const typed = { time: '03:09', capacity: '3', active: false };
    const afterSave = { startTime: '03:07', capacity: 3, active: false };
    expect(trimRuleDraft(typed, afterSave)).toEqual({ time: '03:09' });
    // and once the time is stored too, nothing is left of the draft
    expect(trimRuleDraft(typed, { startTime: '03:09', capacity: 3, active: false })).toEqual({});
  });
});
