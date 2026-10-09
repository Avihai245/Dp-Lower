import { describe, expect, it } from 'vitest';
import { answersDiffer, cleanAnswers, mergeAnswers } from './answers';

describe('cleanAnswers', () => {
  it('keeps valid answers and drops everything else', () => {
    expect(cleanAnswers({ country: 'germany', relative: 'parent', bogus: 'x', when: 'mars', records: 7, residence: null })).toEqual({
      country: 'germany',
      relative: 'parent',
    });
  });
  it('survives nonsense', () => {
    expect(cleanAnswers(null)).toEqual({});
    expect(cleanAnswers(undefined)).toEqual({});
    expect(cleanAnswers('country')).toEqual({});
    expect(cleanAnswers([['country', 'germany']])).toEqual({});
  });
  it('does not pick up prototype keys', () => {
    expect(cleanAnswers(JSON.parse('{"__proto__":{"country":"germany"}}'))).toEqual({});
  });
});

describe('mergeAnswers', () => {
  it('lets the new answers win and keeps the others', () => {
    expect(mergeAnswers({ country: 'germany', relative: 'parent' }, { country: 'both', when: 'after_1945' })).toEqual({
      country: 'both',
      relative: 'parent',
      when: 'after_1945',
    });
  });
  it('repairs a stored record that no longer matches the quiz', () => {
    expect(mergeAnswers({ country: 'atlantis', relative: 'parent' }, { when: 'before_1933' })).toEqual({ relative: 'parent', when: 'before_1933' });
  });
});

describe('answersDiffer', () => {
  it('is false when nothing would change', () => {
    expect(answersDiffer({ country: 'germany' }, {})).toBe(false);
    expect(answersDiffer({ country: 'germany' }, { country: 'germany' })).toBe(false);
    expect(answersDiffer({}, { country: 'mars' })).toBe(false);
  });
  it('is true for a new or changed answer', () => {
    expect(answersDiffer({ country: 'germany' }, { country: 'austria' })).toBe(true);
    expect(answersDiffer({}, { country: 'germany' })).toBe(true);
    expect(answersDiffer({ country: 'germany' }, { when: 'after_1945' })).toBe(true);
  });
});
