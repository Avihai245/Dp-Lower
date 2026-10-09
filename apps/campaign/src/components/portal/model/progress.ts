import { APPLICATION_INPUT_SECTIONS, APPLICATION_SECTIONS, sectionDone, type ApplicationData } from '@dpl/core';
import type { StepState } from './types';

/**
 * Progress maths of the portal, ported from the prototype's renderVals() (portalPct, appPct, checklist, momentum, ...).
 *
 * One deliberate difference: the prototype divides by all five sections including "Review and records", a section
 * that has no fields and therefore can never be "done" (so its progress stops at 80% and its submit button can never
 * enable). Here the application counts the four sections that collect answers (APPLICATION_INPUT_SECTIONS), which is also
 * what isApplicationComplete() in @dpl/core requires. The "x of 5 sections" wording is kept (SECTIONS_TOTAL).
 */

export const APP_WEIGHT = 0.7;
export const DOCS_WEIGHT = 0.3;
/** sections shown in the application, including the review step ("1 of 5 sections") */
export const SECTIONS_TOTAL = APPLICATION_SECTIONS.length;

const clampPercent = (n: number): number => Math.max(0, Math.min(100, Math.round(n)));

/** Application header: "Application · N% complete". */
export const applicationPercent = (sectionsDone: number): number => clampPercent((sectionsDone / APPLICATION_INPUT_SECTIONS) * 100);

/** Dashboard bar: the application weighs 70%, the documents 30%. */
export function portalPercent(sectionsDone: number, docsReceived: number, docsTotal: number): number {
  const docs = docsTotal > 0 ? docsReceived / docsTotal : 0;
  return clampPercent(((sectionsDone / APPLICATION_INPUT_SECTIONS) * APP_WEIGHT + docs * DOCS_WEIGHT) * 100);
}

/** Index of the first input section that is not done yet, or null when all four are. */
export function firstOpenSection(data: ApplicationData): number | null {
  for (let i = 0; i < APPLICATION_INPUT_SECTIONS; i++) if (!sectionDone(data, i)) return i;
  return null;
}

export type ChecklistId = 'eligibility' | 'account' | 'application' | 'documents' | 'review';
export interface ChecklistItem {
  id: ChecklistId;
  state: StepState;
}

export function buildChecklist(p: { applicationComplete: boolean; docsReceived: number; docsTotal: number }): ChecklistItem[] {
  const docsAll = p.docsTotal > 0 && p.docsReceived >= p.docsTotal;
  return [
    { id: 'eligibility', state: 'done' },
    { id: 'account', state: 'done' },
    { id: 'application', state: p.applicationComplete ? 'done' : 'current' },
    { id: 'documents', state: !p.applicationComplete ? 'next' : docsAll ? 'done' : 'current' },
    { id: 'review', state: 'next' },
  ];
}

/** The line under the application title: "4 sections to go, and everything saves as you type." */
export type Momentum = { kind: 'start' } | { kind: 'almost' } | { kind: 'pastHalf'; left: number } | { kind: 'toGo'; left: number };

export function momentum(sectionsDone: number): Momentum {
  const left = SECTIONS_TOTAL - sectionsDone;
  if (sectionsDone === 0) return { kind: 'start' };
  if (sectionsDone >= SECTIONS_TOTAL - 1) return { kind: 'almost' };
  if (sectionsDone >= 2) return { kind: 'pastHalf', left };
  return { kind: 'toGo', left };
}

export type DashboardHeadline = 'start' | 'back' | 'ready';

/**
 * "Your application is ready to start." / "Welcome back. Pick up where you left off." / "... ready to submit.".
 * `started` is true once something was saved (the prototype used "no section done yet", which told a person
 * with half a section typed that their application was "ready to start").
 */
export function dashboardHeadline(p: { started: boolean; applicationComplete: boolean }): DashboardHeadline {
  if (!p.started) return 'start';
  return p.applicationComplete ? 'ready' : 'back';
}

export type NextLine = { kind: 'section'; index: number } | { kind: 'allIn' } | { kind: 'docsLeft'; count: number };

/** "Next: About you." / "Your information is complete. 4 documents left to add." / "Everything is in. ..." */
export function nextLine(p: { data: ApplicationData; docsReceived: number; docsTotal: number }): NextLine {
  const open = firstOpenSection(p.data);
  if (open !== null) return { kind: 'section', index: open };
  if (p.docsReceived >= p.docsTotal) return { kind: 'allIn' };
  return { kind: 'docsLeft', count: p.docsTotal - p.docsReceived };
}

export type SubmitLine = 'finishApplication' | 'unreadable' | 'allIn' | 'canSubmit';

/** The sentence above the submit button on the documents screen. */
export function docsSubmitLine(p: {
  applicationComplete: boolean;
  hasReupload: boolean;
  docsReceived: number;
  docsTotal: number;
}): SubmitLine {
  if (!p.applicationComplete) return 'finishApplication';
  if (p.hasReupload) return 'unreadable';
  if (p.docsReceived >= p.docsTotal) return 'allIn';
  return 'canSubmit';
}

/** Which documents carry the "Key record" tag; the rest are "Helpful" (the prototype's KEY array, by slot). */
export const KEY_RECORDS: ReadonlySet<string> = new Set([
  'birth_certificate',
  'marriage_certificates',
  'emigration_naturalization',
  'persecution_proof',
  'passport',
  'photo_id',
]);
