import { QUIZ_ORDER, type QuizAnswers } from '@dpl/core';
import { describe, expect, it } from 'vitest';
import { chatReducer, chatView, INITIAL_CHAT, previousQuestion, TYPING_MS, type ChatState } from './chat-logic';

const answered = (n: number): QuizAnswers => {
  const all: QuizAnswers = { country: 'germany', relative: 'grandparent', when: 'between_1933_1945', persecution: 'yes', records: 'none', residence: 'il' };
  return Object.fromEntries(QUIZ_ORDER.slice(0, n).map((id) => [id, all[id]])) as QuizAnswers;
};

describe('chatReducer', () => {
  it('starts on the greeting with no typing indicator', () => {
    expect(INITIAL_CHAT).toEqual({ phase: 'intro', typing: null });
  });

  it('shows the typing indicator first, then moves to the target phase', () => {
    const typing = chatReducer(INITIAL_CHAT, { type: 'ask' });
    expect(typing).toEqual({ phase: 'intro', typing: 'asking' });
    expect(chatReducer(typing, { type: 'typed' })).toEqual({ phase: 'asking', typing: null });
  });

  it('"What will you ask me?" detours through the about phase and can still start afterwards', () => {
    const about = chatReducer(chatReducer(INITIAL_CHAT, { type: 'about' }), { type: 'typed' });
    expect(about).toEqual({ phase: 'about', typing: null });
    const asking = chatReducer(chatReducer(about, { type: 'ask' }), { type: 'typed' });
    expect(asking.phase).toBe('asking');
  });

  it('ignores a second click while the assistant is typing and a stray typed event', () => {
    const typing = chatReducer(INITIAL_CHAT, { type: 'about' });
    expect(chatReducer(typing, { type: 'ask' })).toBe(typing);
    expect(chatReducer(INITIAL_CHAT, { type: 'typed' })).toBe(INITIAL_CHAT);
  });

  it('uses the prototype timings', () => {
    expect(TYPING_MS).toEqual({ asking: 900, about: 750 });
  });
});

describe('chatView', () => {
  it('greeting: intro bubbles and both start buttons, no progress', () => {
    const v = chatView(INITIAL_CHAT, {});
    expect(v).toMatchObject({ phase: 'intro', showIntro: true, showStart: true, showStartOnly: false, showAbout: false, asking: false, finished: false, status: 'idle', pct: 0, canGoBack: false });
  });

  it('hides the buttons while typing but keeps the greeting', () => {
    const v = chatView({ phase: 'intro', typing: 'asking' }, {});
    expect(v).toMatchObject({ typing: true, showIntro: true, showStart: false });
  });

  it('about detour: shows the exchange and a single start button', () => {
    const v = chatView({ phase: 'about', typing: null }, {});
    expect(v).toMatchObject({ showIntro: true, showAbout: true, showStart: false, showStartOnly: true });
    expect(chatView({ phase: 'about', typing: 'asking' }, {}).showStartOnly).toBe(false);
  });

  it('asking: question N of 6, history above it, progress from the answers', () => {
    const v = chatView({ phase: 'asking', typing: null }, answered(2));
    expect(v).toMatchObject({ phase: 'asking', asking: true, finished: false, index: 2, current: 'when', status: 'question', answered: 2, pct: 33, canGoBack: true, showIntro: false });
    expect(v.history).toEqual(['country', 'relative']);
    expect(v.total).toBe(6);
  });

  it('resumes at the first unanswered question for a visitor who answered elsewhere', () => {
    const v = chatView(INITIAL_CHAT, answered(3));
    expect(v.phase).toBe('asking');
    expect(v.current).toBe('persecution');
    expect(v.showStart).toBe(false);
  });

  it('after the last answer it is finished', () => {
    const v = chatView({ phase: 'asking', typing: null }, answered(6));
    expect(v).toMatchObject({ asking: false, finished: true, current: null, status: 'done', pct: 100, index: 6 });
    expect(v.history).toHaveLength(6);
  });

  it('a gap in the answers resumes at the gap', () => {
    const v = chatView({ phase: 'asking', typing: null }, { country: 'austria', when: 'after_1945' });
    expect(v.index).toBe(1);
    expect(v.current).toBe('relative');
    expect(v.history).toEqual(['country']);
  });
});

describe('previousQuestion', () => {
  it('is what "Back" clears', () => {
    expect(previousQuestion(0)).toBeNull();
    expect(previousQuestion(1)).toBe('country');
    expect(previousQuestion(6)).toBe('residence');
  });
});

describe('chatReducer with chatView', () => {
  it('walks the whole script', () => {
    let state: ChatState = INITIAL_CHAT;
    state = chatReducer(state, { type: 'ask' });
    expect(chatView(state, {}).typing).toBe(true);
    state = chatReducer(state, { type: 'typed' });
    expect(chatView(state, {}).asking).toBe(true);
    expect(chatView(state, answered(5)).current).toBe('residence');
    expect(chatView(state, answered(6)).finished).toBe(true);
  });
});
