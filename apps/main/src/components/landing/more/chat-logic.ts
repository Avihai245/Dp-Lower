import { answeredCount, firstUnansweredIndex, QUIZ_ORDER, type QuizAnswers, type QuizId } from '@dpl/core';

/**
 * The scripted conversation of the floating chat, as pure functions so it can be tested without a browser.
 *
 * Where the visitor is in the six questions is NOT kept here: it is derived from the shared quiz answers
 * (@/lib/quiz-store), so a visitor who answers three questions in the chat continues at question four in the form, and
 * the chat resumes at the first unanswered question. What this reducer owns is only the script around the questions:
 * the greeting, the optional "What will you ask me?" detour and the fake typing indicator.
 */

export type ChatPhase = 'intro' | 'about' | 'asking';

export interface ChatState {
  phase: ChatPhase;
  /** the phase the typing indicator is about to switch to; null while the assistant is not "typing" */
  typing: 'about' | 'asking' | null;
}

export const INITIAL_CHAT: ChatState = { phase: 'intro', typing: null };

/** How long the typing indicator shows before the assistant answers, per target phase (ms), as in the prototype. */
export const TYPING_MS = { asking: 900, about: 750 } as const;

export type ChatAction =
  /** "Yes, let's check my eligibility" / "Fine, let's start" */
  | { type: 'ask' }
  /** "What will you ask me?" */
  | { type: 'about' }
  /** the typing indicator has run its course */
  | { type: 'typed' };

export function chatReducer(state: ChatState, action: ChatAction): ChatState {
  switch (action.type) {
    case 'ask':
      return state.typing ? state : { ...state, typing: 'asking' };
    case 'about':
      return state.typing ? state : { ...state, typing: 'about' };
    case 'typed':
      return state.typing ? { phase: state.typing, typing: null } : state;
  }
}

export interface ChatView {
  /** effective phase: anyone who already answered a question is taken straight to the questions */
  phase: ChatPhase;
  typing: boolean;
  total: number;
  /** the question being asked; equals `total` once every question is answered */
  index: number;
  answered: number;
  /** progress bar width, 0-100 */
  pct: number;
  /** greeting bubbles (also shown during the "about" detour) */
  showIntro: boolean;
  showAbout: boolean;
  /** "Yes, let's check my eligibility" + "What will you ask me?" */
  showStart: boolean;
  /** "Fine, let's start" */
  showStartOnly: boolean;
  asking: boolean;
  finished: boolean;
  current: QuizId | null;
  /** answered questions listed above the current one */
  history: QuizId[];
  canGoBack: boolean;
  /** what the header status line says */
  status: 'idle' | 'question' | 'done';
}

export function chatView(state: ChatState, answers: QuizAnswers): ChatView {
  const total = QUIZ_ORDER.length;
  const index = firstUnansweredIndex(answers);
  const answered = answeredCount(answers);
  const phase: ChatPhase = answered > 0 ? 'asking' : state.phase;
  const typing = state.typing !== null;
  const asking = phase === 'asking' && index < total;
  const finished = phase === 'asking' && index >= total;
  return {
    phase,
    typing,
    total,
    index,
    answered,
    pct: Math.round((answered / total) * 100),
    showIntro: phase !== 'asking',
    showAbout: phase === 'about',
    showStart: phase === 'intro' && !typing,
    showStartOnly: phase === 'about' && !typing,
    asking,
    finished,
    current: index < total ? QUIZ_ORDER[index]! : null,
    history: QUIZ_ORDER.slice(0, index),
    canGoBack: index > 0,
    status: phase === 'asking' ? (index < total ? 'question' : 'done') : 'idle',
  };
}

/** The question whose answer "Back" removes, or null on the first question. */
export function previousQuestion(index: number): QuizId | null {
  return index > 0 ? QUIZ_ORDER[index - 1]! : null;
}
