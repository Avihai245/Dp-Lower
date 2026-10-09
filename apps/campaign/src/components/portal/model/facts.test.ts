import { describe, expect, it } from 'vitest';
import { ancestorSummary } from './facts';

describe('ancestorSummary', () => {
  it('names the ancestor with the city and the year of birth, like the prototype', () => {
    expect(ancestorSummary({ anName: 'Ruth Weiss', anBirthPlace: 'Vienna, Austria', anDob: '04/05/1911' })).toBe('Ruth Weiss, Vienna 1911');
  });

  it('copes with missing parts', () => {
    expect(ancestorSummary({ anName: 'Ruth Weiss' })).toBe('Ruth Weiss');
    expect(ancestorSummary({ anName: 'Ruth Weiss', anBirthPlace: 'Graz' })).toBe('Ruth Weiss, Graz');
    expect(ancestorSummary({ anName: 'Ruth Weiss', anDob: 'around 1911' })).toBe('Ruth Weiss, 1911');
    expect(ancestorSummary({ anName: '  Ruth Weiss  ', anBirthPlace: ' , Austria' })).toBe('Ruth Weiss');
  });

  it('does not mistake other numbers for a year', () => {
    expect(ancestorSummary({ anName: 'Ruth Weiss', anDob: '12/03/88' })).toBe('Ruth Weiss');
    expect(ancestorSummary({ anName: 'Ruth Weiss', anDob: '1911-12-31' })).toBe('Ruth Weiss, 1911');
    expect(ancestorSummary({ anName: 'Ruth Weiss', anDob: '191100' })).toBe('Ruth Weiss');
  });

  it('is null without a name', () => {
    expect(ancestorSummary({})).toBeNull();
    expect(ancestorSummary({ anName: '   ', anBirthPlace: 'Vienna' })).toBeNull();
    expect(ancestorSummary(null)).toBeNull();
  });
});
