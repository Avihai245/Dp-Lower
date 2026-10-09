import { z } from 'zod';
import type { LeadRoute } from './statuses';

/**
 * The six eligibility questions, one per screen. Answers are stored as stable keys (never display text) so the
 * same record reads correctly in English, Hebrew and the CRM.
 *
 * NOTE (from the design): the legal Germany/Austria eligibility criteria are supplied by Decker Pex Levi and drop
 * in at `evaluateEligibility` below unchanged. Until then the quiz is purely structural intake.
 */
export const QUIZ = {
  country: ['germany', 'austria', 'both', 'unsure'],
  relative: ['parent', 'grandparent', 'great_grandparent', 'further'],
  when: ['before_1933', 'between_1933_1945', 'after_1945', 'unsure'],
  persecution: ['yes', 'no', 'unsure'],
  records: ['several', 'one_or_two', 'none'],
  residence: ['us', 'ca', 'uk', 'il', 'other'],
} as const;

export const QUIZ_ORDER = ['country', 'relative', 'when', 'persecution', 'records', 'residence'] as const;
export type QuizId = (typeof QUIZ_ORDER)[number];
export type QuizOption<K extends QuizId> = (typeof QUIZ)[K][number];
export type QuizAnswers = { [K in QuizId]?: QuizOption<K> };

export const quizAnswersSchema = z
  .object({
    country: z.enum(QUIZ.country),
    relative: z.enum(QUIZ.relative),
    when: z.enum(QUIZ.when),
    persecution: z.enum(QUIZ.persecution),
    records: z.enum(QUIZ.records),
    residence: z.enum(QUIZ.residence),
  })
  .partial()
  .strict();

export const quizOptions = <K extends QuizId>(id: K): readonly QuizOption<K>[] => QUIZ[id];

export const answeredCount = (a: QuizAnswers): number => QUIZ_ORDER.filter((id) => a[id] !== undefined).length;
export const isQuizComplete = (a: QuizAnswers): boolean => answeredCount(a) === QUIZ_ORDER.length;

/** Index of the first unanswered question (the chat resumes here); QUIZ_ORDER.length when all are answered. */
export const firstUnansweredIndex = (a: QuizAnswers): number => {
  const i = QUIZ_ORDER.findIndex((id) => a[id] === undefined);
  return i === -1 ? QUIZ_ORDER.length : i;
};

export const routeFromAnswers = (a: QuizAnswers): LeadRoute => a.country ?? 'unsure';

export interface Eligibility {
  route: LeadRoute;
  /** The family history clearly points to Germany, Austria or both. */
  routeKnown: boolean;
  /** Which archives the personalised offer names. */
  archives: 'german' | 'austrian' | 'both';
  /** Closest relative who left; null when "further back" or unanswered. */
  relative: 'parent' | 'grandparent' | 'great_grandparent' | null;
}

export function evaluateEligibility(a: QuizAnswers): Eligibility {
  const route = routeFromAnswers(a);
  const routeKnown = route === 'germany' || route === 'austria' || route === 'both';
  const archives = !routeKnown || route === 'both' ? 'both' : route === 'austria' ? 'austrian' : 'german';
  const relative = a.relative === undefined || a.relative === 'further' ? null : a.relative;
  return { route, routeKnown, archives, relative };
}
