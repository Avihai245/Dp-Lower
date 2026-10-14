import { QUIZ_ORDER, answeredCount, firstUnansweredIndex, type QuizAnswers } from '@dpl/core';

/** Pure rules of the eligibility screen, ported from the prototype's renderVals (nudges, progress, footer text). */
export const QUESTION_COUNT = QUIZ_ORDER.length;
export const LAST_INDEX = QUESTION_COUNT - 1;
/** The selected option stays visible for this long before the next question slides in. */
export const ADVANCE_MS = 340;

export type Nudge = 'unsure' | 'halfway' | 'last';

/**
 * The short line under the help text: reassurance for "I am not sure", "halfway" on the fourth question (once three
 * are answered) and "last one" on the sixth. In that order of precedence, as in the prototype.
 */
export function nudgeFor(index: number, answers: QuizAnswers): Nudge | null {
  const id = QUIZ_ORDER[index];
  if (!id) return null;
  if (answers[id] === 'unsure') return 'unsure';
  if (index === 3 && answeredCount(answers) >= 3) return 'halfway';
  if (index === LAST_INDEX) return 'last';
  return null;
}

/** Width of the progress line: a question counts as done as soon as it is answered. */
export function progressPercent(index: number, answers: QuizAnswers): number {
  const id = QUIZ_ORDER[index];
  const picked = id ? answers[id] !== undefined : false;
  return Math.round(((index + (picked ? 1 : 0)) / QUESTION_COUNT) * 100);
}

/** Where the quiz opens: the first unanswered question, or the last one when everything is answered. */
export const startIndex = (answers: QuizAnswers): number => Math.min(firstUnansweredIndex(answers), LAST_INDEX);

export const questionsLeft = (index: number): number => QUESTION_COUNT - index - 1;

/** "See my result" only exists on the last question, and only once it has an answer. */
export function canSeeResult(index: number, answers: QuizAnswers): boolean {
  const id = QUIZ_ORDER[index];
  return index === LAST_INDEX && !!id && answers[id] !== undefined;
}
