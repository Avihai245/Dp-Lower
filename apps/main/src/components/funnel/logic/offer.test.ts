import { evaluateEligibility } from '@dpl/core';
import { describe, expect, it } from 'vitest';
import { caseFileRows, claimKind, offerFor, relativeKey } from './offer';

describe('claimKind', () => {
  it('names the route the answers point to', () => {
    expect(claimKind(evaluateEligibility({ country: 'germany' }))).toBe('german');
    expect(claimKind(evaluateEligibility({ country: 'austria' }))).toBe('austrian');
    expect(claimKind(evaluateEligibility({ country: 'both' }))).toBe('both');
  });
  it('says "a lawyer can tell you which one" when the route is not known', () => {
    expect(claimKind(evaluateEligibility({ country: 'unsure' }))).toBe('unknown');
    expect(claimKind(evaluateEligibility({}))).toBe('unknown');
  });
});

describe('relativeKey', () => {
  it('names the closest relative, or falls back to "your family\'s"', () => {
    expect(relativeKey(evaluateEligibility({ relative: 'parent' }))).toBe('parent');
    expect(relativeKey(evaluateEligibility({ relative: 'grandparent' }))).toBe('grandparent');
    expect(relativeKey(evaluateEligibility({ relative: 'great_grandparent' }))).toBe('great_grandparent');
    expect(relativeKey(evaluateEligibility({ relative: 'further' }))).toBe('other');
    expect(relativeKey(evaluateEligibility({}))).toBe('other');
  });
});

describe('caseFileRows', () => {
  it('echoes the answers back', () => {
    const rows = caseFileRows({ country: 'germany', relative: 'grandparent', when: 'before_1933', records: 'one_or_two' });
    expect(rows).toEqual([
      { id: 'route', value: { kind: 'option', quiz: 'country', option: 'germany' } },
      { id: 'who', value: { kind: 'who', relative: 'grandparent' } },
      { id: 'departure', value: { kind: 'option', quiz: 'when', option: 'before_1933' } },
      { id: 'records', value: { kind: 'option', quiz: 'records', option: 'one_or_two' } },
    ]);
  });
  it('names both countries for "Both"', () => {
    expect(caseFileRows({ country: 'both' })[0]?.value).toEqual({ kind: 'text', key: 'germanyAndAustria' });
  });
  it('never echoes "I am not sure": it becomes a calm fallback', () => {
    const rows = caseFileRows({ country: 'unsure', when: 'unsure' });
    expect(rows[0]?.value).toEqual({ kind: 'text', key: 'toConfirm' });
    expect(rows[2]?.value).toEqual({ kind: 'text', key: 'datedFromRecords' });
  });
  it('has a fallback for every unanswered question', () => {
    expect(caseFileRows({}).map((r) => r.value)).toEqual([
      { kind: 'text', key: 'toConfirm' },
      { kind: 'text', key: 'toConfirm' },
      { kind: 'text', key: 'datedFromRecords' },
      { kind: 'text', key: 'toConfirm' },
    ]);
  });
  it('says "None yet, we search for them" for no records', () => {
    expect(caseFileRows({ records: 'none' })[3]?.value).toEqual({ kind: 'text', key: 'noneYetSearch' });
  });
  it('shows "further back" as an answer', () => {
    expect(caseFileRows({ relative: 'further' })[1]?.value).toEqual({ kind: 'who', relative: 'further' });
  });
});

it('offerFor bundles the three', () => {
  const o = offerFor({ country: 'austria', relative: 'parent' });
  expect(o.claim).toBe('austrian');
  expect(o.relative).toBe('parent');
  expect(o.file).toHaveLength(4);
  expect(o.eligibility.archives).toBe('austrian');
});
