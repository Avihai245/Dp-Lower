import { evaluateEligibility, type Eligibility, type QuizAnswers } from '@dpl/core';

export type ClaimKind = 'unknown' | 'both' | 'german' | 'austrian';

/** Which headline the result screen shows: the route named back to the visitor, or "a lawyer can tell you which one". */
export function claimKind(e: Eligibility): ClaimKind {
  if (!e.routeKnown) return 'unknown';
  if (e.route === 'both') return 'both';
  return e.archives === 'austrian' ? 'austrian' : 'german';
}

/** The relative the lede names ("your grandparent's paperwork"); null falls back to "your family's". */
export type RelativeKey = 'parent' | 'grandparent' | 'great_grandparent' | 'other';
export const relativeKey = (e: Eligibility): RelativeKey => e.relative ?? 'other';

export type FileRowId = 'route' | 'who' | 'departure' | 'records';
export type FileValue =
  | { kind: 'text'; key: 'toConfirm' | 'datedFromRecords' | 'noneYetSearch' | 'germanyAndAustria' }
  | { kind: 'option'; quiz: 'country' | 'when' | 'records'; option: string }
  | { kind: 'who'; relative: string };

export interface FileRow {
  id: FileRowId;
  value: FileValue;
}

/**
 * "Review the answers I gave": what the file holds so far. "I am not sure" is never echoed back, it becomes a
 * calm fallback ("To confirm", "We date it from the records"), as in the prototype.
 */
export function caseFileRows(a: QuizAnswers): FileRow[] {
  const known = <T extends string | undefined>(v: T): v is Exclude<T, 'unsure' | undefined> => v !== undefined && v !== 'unsure';
  return [
    {
      id: 'route',
      value:
        a.country === 'both'
          ? { kind: 'text', key: 'germanyAndAustria' }
          : known(a.country)
            ? { kind: 'option', quiz: 'country', option: a.country }
            : { kind: 'text', key: 'toConfirm' },
    },
    { id: 'who', value: known(a.relative) ? { kind: 'who', relative: a.relative } : { kind: 'text', key: 'toConfirm' } },
    {
      id: 'departure',
      value: known(a.when) ? { kind: 'option', quiz: 'when', option: a.when } : { kind: 'text', key: 'datedFromRecords' },
    },
    {
      id: 'records',
      value:
        a.records === 'none'
          ? { kind: 'text', key: 'noneYetSearch' }
          : known(a.records)
            ? { kind: 'option', quiz: 'records', option: a.records }
            : { kind: 'text', key: 'toConfirm' },
    },
  ];
}

export const offerFor = (answers: QuizAnswers) => {
  const e = evaluateEligibility(answers);
  return { eligibility: e, claim: claimKind(e), relative: relativeKey(e), file: caseFileRows(answers) };
};
