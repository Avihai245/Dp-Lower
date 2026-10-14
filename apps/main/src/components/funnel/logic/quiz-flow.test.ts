import type { QuizAnswers } from '@dpl/core';
import { describe, expect, it } from 'vitest';
import { LAST_INDEX, QUESTION_COUNT, canSeeResult, nudgeFor, progressPercent, questionsLeft, startIndex } from './quiz-flow';

const three: QuizAnswers = { country: 'germany', relative: 'parent', when: 'before_1933' };
const all: QuizAnswers = { ...three, persecution: 'yes', records: 'none', residence: 'il' };

describe('quiz flow', () => {
  it('has six questions, the last one at index 5', () => {
    expect(QUESTION_COUNT).toBe(6);
    expect(LAST_INDEX).toBe(5);
  });

  describe('nudgeFor', () => {
    it('reassures after "I am not sure", before anything else', () => {
      expect(nudgeFor(0, { country: 'unsure' })).toBe('unsure');
      expect(nudgeFor(3, { ...three, persecution: 'unsure' })).toBe('unsure');
    });
    it('says "halfway" on the fourth question once three are answered', () => {
      expect(nudgeFor(3, three)).toBe('halfway');
      expect(nudgeFor(3, { country: 'germany' })).toBeNull();
    });
    it('says "last one" on the last question', () => {
      expect(nudgeFor(5, all)).toBe('last');
      expect(nudgeFor(5, { ...all, residence: undefined })).toBe('last');
    });
    it('is quiet everywhere else', () => {
      expect(nudgeFor(0, {})).toBeNull();
      expect(nudgeFor(1, { country: 'austria' })).toBeNull();
      expect(nudgeFor(4, { ...three, persecution: 'no' })).toBeNull();
      expect(nudgeFor(9, all)).toBeNull();
    });
  });

  describe('progressPercent', () => {
    it('counts a question as done once it is answered', () => {
      expect(progressPercent(0, {})).toBe(0);
      expect(progressPercent(0, { country: 'germany' })).toBe(17);
      expect(progressPercent(1, { country: 'germany' })).toBe(17);
      expect(progressPercent(3, three)).toBe(50);
      expect(progressPercent(5, all)).toBe(100);
    });
  });

  it('opens at the first unanswered question, or the last one when everything is answered', () => {
    expect(startIndex({})).toBe(0);
    expect(startIndex(three)).toBe(3);
    expect(startIndex({ country: 'germany', when: 'after_1945' })).toBe(1);
    expect(startIndex(all)).toBe(5);
  });

  it('counts the questions left, never off by one', () => {
    expect([0, 1, 2, 3, 4, 5].map(questionsLeft)).toEqual([5, 4, 3, 2, 1, 0]);
  });

  it('offers "See my result" only on an answered last question', () => {
    expect(canSeeResult(5, all)).toBe(true);
    expect(canSeeResult(5, { ...all, residence: undefined })).toBe(false);
    expect(canSeeResult(4, all)).toBe(false);
    expect(canSeeResult(0, {})).toBe(false);
  });
});
