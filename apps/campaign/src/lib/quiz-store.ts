'use client';
import { QUIZ_ORDER, quizAnswersSchema, type QuizAnswers, type QuizId, type QuizOption } from '@dpl/core';
import { useSyncExternalStore } from 'react';

/**
 * The eligibility answers live in the browser (localStorage) until the visitor submits their details; from then on
 * the server copy (leads.answers) is the record. The quiz page and the landing-page chat share this store, so a
 * visitor who answers three questions in the chat continues at question four in the form.
 */
const KEY = 'dpl-quiz-v1';
const EMPTY: QuizAnswers = {};

let cache: QuizAnswers | null = null;
const listeners = new Set<() => void>();

function read(): QuizAnswers {
  if (cache) return cache;
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed = raw ? quizAnswersSchema.safeParse(JSON.parse(raw)) : null;
    cache = parsed?.success ? parsed.data : EMPTY;
  } catch {
    cache = EMPTY;
  }
  return cache;
}

function write(next: QuizAnswers) {
  cache = next;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* private mode: keep it in memory */
  }
  listeners.forEach((l) => l());
}

export const getQuizAnswers = (): QuizAnswers => read();

export function setQuizAnswer<K extends QuizId>(id: K, value: QuizOption<K>): void {
  write({ ...read(), [id]: value });
}

/** Clears one answer and everything after it (going back and changing a choice). */
export function clearQuizFrom(id: QuizId): void {
  const from = QUIZ_ORDER.indexOf(id);
  const next: QuizAnswers = { ...read() };
  for (const k of QUIZ_ORDER.slice(from)) delete next[k];
  write(next);
}

export function resetQuiz(): void {
  write(EMPTY);
}

/** Replaces the local answers, e.g. with the server copy after sign-in. */
export function replaceQuizAnswers(a: QuizAnswers): void {
  write(a);
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) {
      cache = null;
      cb();
    }
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(cb);
    window.removeEventListener('storage', onStorage);
  };
}

/** React hook. Returns {} on the server and during hydration, then the stored answers. */
export function useQuizAnswers(): QuizAnswers {
  return useSyncExternalStore(subscribe, read, () => EMPTY);
}
