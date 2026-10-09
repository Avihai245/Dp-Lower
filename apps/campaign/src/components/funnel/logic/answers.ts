import { QUIZ, QUIZ_ORDER, type QuizAnswers } from '@dpl/core';

/**
 * Keeps only the answers that are valid keys of the quiz. Stored JSON can outlive a change to the questions, so a
 * stale or foreign value is dropped instead of making the whole record unreadable.
 */
export function cleanAnswers(raw: unknown): QuizAnswers {
  const out: Record<string, string> = {};
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    for (const id of QUIZ_ORDER) {
      const v = (raw as Record<string, unknown>)[id];
      if (typeof v === 'string' && (QUIZ[id] as readonly string[]).includes(v)) out[id] = v;
    }
  }
  return out as QuizAnswers;
}

/** New answers win over the stored ones; answers that are not part of the update are kept. */
export const mergeAnswers = (existing: unknown, incoming: unknown): QuizAnswers => ({
  ...cleanAnswers(existing),
  ...cleanAnswers(incoming),
});

/** True when merging `incoming` into `existing` would change anything. */
export function answersDiffer(existing: unknown, incoming: unknown): boolean {
  const a = cleanAnswers(existing) as Record<string, string>;
  const b = mergeAnswers(existing, incoming) as Record<string, string>;
  return QUIZ_ORDER.some((id) => a[id] !== b[id]);
}
