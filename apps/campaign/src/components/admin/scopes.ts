/**
 * Calendars of the availability page. Pure (no React, no I/O): the page and the Server Actions share these rules, and
 * scopes.test.ts covers them.
 *
 * A calendar ("scope") is either a lawyer's own (their staff id: weekly hours, one call at a time, and days off) or the
 * unassigned template (null: calls not tied to a lawyer, `capacity` per slot). A blocked day in the unassigned calendar
 * is closed for everyone.
 */

export type CalendarScope = string | null;

/** `?calendar=` value of the unassigned template */
export const UNASSIGNED = 'unassigned';

export interface CalendarEditor {
  id: string;
  role: 'admin' | 'lawyer' | 'case_manager';
}

/** Admins edit every calendar; a lawyer only their own (never the template or a closure for everyone); case managers read. */
export function canEditScope(editor: CalendarEditor, scope: CalendarScope): boolean {
  if (editor.role === 'admin') return true;
  return editor.role === 'lawyer' && scope !== null && scope === editor.id;
}

/** Whether this person edits any calendar at all (the Server Actions' first check). */
export const editsCalendars = (role: CalendarEditor['role']): boolean =>
  role === 'admin' || role === 'lawyer';

/** The calendar a page opens on: a lawyer's own, everyone else the unassigned template. */
export function defaultScope(editor: CalendarEditor, lawyers: readonly { id: string }[]): CalendarScope {
  return editor.role === 'lawyer' && lawyers.some((l) => l.id === editor.id) ? editor.id : null;
}

/** `?calendar=` back to a calendar that exists (the template, or a listed lawyer), else `fallback`. */
export function parseScope(
  value: string | null | undefined,
  lawyers: readonly { id: string }[],
  fallback: CalendarScope,
): CalendarScope {
  if (value === UNASSIGNED) return null;
  return value && lawyers.some((l) => l.id === value) ? value : fallback;
}

export const scopeParam = (scope: CalendarScope): string => scope ?? UNASSIGNED;

/** Rows that belong to a calendar. */
export const inScope = <T extends { staffId: string | null }>(
  rows: readonly T[],
  scope: CalendarScope,
): T[] => rows.filter((r) => r.staffId === scope);

/** Blocked days shown in a calendar: its own, plus (in a lawyer's calendar) the days closed for everyone, by date. */
export function blockedFor<T extends { staffId: string | null; onDate: string; startTime: string | null }>(
  rows: readonly T[],
  scope: CalendarScope,
): T[] {
  return rows
    .filter((r) => r.staffId === scope || r.staffId === null)
    .sort((a, b) => a.onDate.localeCompare(b.onDate) || (a.startTime ?? '').localeCompare(b.startTime ?? ''));
}
