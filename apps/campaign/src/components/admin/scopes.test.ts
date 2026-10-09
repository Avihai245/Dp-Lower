import { describe, expect, it } from 'vitest';
import {
  blockedFor,
  canEditScope,
  defaultScope,
  editsCalendars,
  inScope,
  parseScope,
  scopeParam,
  UNASSIGNED,
} from './scopes';

const ANNA = '0b6c2d60-0000-4000-8000-00000000000a';
const BEN = '0b6c2d60-0000-4000-8000-00000000000b';
const lawyers = [{ id: ANNA }, { id: BEN }];

describe('who edits which calendar', () => {
  it('an admin edits every calendar, including the template and the days closed for everyone', () => {
    const admin = { id: 'x', role: 'admin' as const };
    expect([null, ANNA, BEN].map((s) => canEditScope(admin, s))).toEqual([true, true, true]);
  });
  it('a lawyer edits their own calendar only', () => {
    const anna = { id: ANNA, role: 'lawyer' as const };
    expect(canEditScope(anna, ANNA)).toBe(true);
    expect(canEditScope(anna, BEN)).toBe(false);
    expect(canEditScope(anna, null)).toBe(false);
  });
  it('a case manager reads only', () => {
    const cm = { id: ANNA, role: 'case_manager' as const };
    expect([null, ANNA, BEN].some((s) => canEditScope(cm, s))).toBe(false);
    expect(editsCalendars('case_manager')).toBe(false);
    expect(editsCalendars('lawyer')).toBe(true);
    expect(editsCalendars('admin')).toBe(true);
  });
});

describe('the calendar in the address', () => {
  it('opens a lawyer on their own calendar, everyone else on the template', () => {
    expect(defaultScope({ id: ANNA, role: 'lawyer' }, lawyers)).toBe(ANNA);
    expect(defaultScope({ id: 'other', role: 'lawyer' }, lawyers)).toBeNull(); // not (or no longer) taking calls
    expect(defaultScope({ id: ANNA, role: 'admin' }, lawyers)).toBeNull();
  });
  it('reads back only calendars that exist', () => {
    expect(parseScope(UNASSIGNED, lawyers, ANNA)).toBeNull();
    expect(parseScope(BEN, lawyers, null)).toBe(BEN);
    expect(parseScope('0b6c2d60-0000-4000-8000-0000000000ff', lawyers, ANNA)).toBe(ANNA);
    expect(parseScope(null, lawyers, null)).toBeNull();
    expect(parseScope('', lawyers, ANNA)).toBe(ANNA);
    expect(scopeParam(null)).toBe('unassigned');
    expect(scopeParam(BEN)).toBe(BEN);
  });
});

describe('rows of a calendar', () => {
  const rows = [
    { id: '1', staffId: null, onDate: '2026-10-12', startTime: null },
    { id: '2', staffId: ANNA, onDate: '2026-10-11', startTime: '10:00' },
    { id: '3', staffId: BEN, onDate: '2026-10-11', startTime: null },
    { id: '4', staffId: ANNA, onDate: '2026-10-11', startTime: null },
  ];
  it('weekly hours belong to exactly one calendar', () => {
    expect(inScope(rows, null).map((r) => r.id)).toEqual(['1']);
    expect(inScope(rows, ANNA).map((r) => r.id)).toEqual(['2', '4']);
  });
  it('a lawyer’s blocked days come with the days closed for everyone, by date and whole days first', () => {
    expect(blockedFor(rows, ANNA).map((r) => r.id)).toEqual(['4', '2', '1']);
    expect(blockedFor(rows, null).map((r) => r.id)).toEqual(['1']);
  });
});
