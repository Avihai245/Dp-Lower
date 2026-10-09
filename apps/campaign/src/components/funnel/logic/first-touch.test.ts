import { describe, expect, it } from 'vitest';
import { parseFirstTouch, parseSource, parseUtm } from './first-touch';

describe('parseSource', () => {
  it('reads a plain label, decoded', () => {
    expect(parseSource('main-site')).toBe('main-site');
    expect(parseSource(encodeURIComponent('campaign ger/aus'))).toBe('campaign ger/aus');
  });
  it('ignores empty, oversized and control-character values', () => {
    expect(parseSource('')).toBeUndefined();
    expect(parseSource(undefined)).toBeUndefined();
    expect(parseSource('   ')).toBeUndefined();
    expect(parseSource('x'.repeat(81))).toBeUndefined();
    expect(parseSource('a\u0000b')).toBeUndefined();
    expect(parseSource('a\nb')).toBeUndefined();
  });
  it('survives a malformed escape', () => {
    expect(parseSource('50%')).toBe('50%');
  });
});

describe('parseUtm', () => {
  it('reads a JSON object, raw or URI-encoded', () => {
    const utm = { utm_source: 'google', utm_campaign: 'spring' };
    expect(parseUtm(JSON.stringify(utm))).toEqual(utm);
    expect(parseUtm(encodeURIComponent(JSON.stringify(utm)))).toEqual(utm);
  });
  it('keeps only short strings, at most 12 keys', () => {
    const many = Object.fromEntries(Array.from({ length: 20 }, (_, i) => [`k${i}`, `v${i}`]));
    expect(Object.keys(parseUtm(JSON.stringify(many))!)).toHaveLength(12);
    expect(parseUtm(JSON.stringify({ a: 1, b: null, c: 'ok', ['k'.repeat(41)]: 'x' }))).toEqual({ c: 'ok' });
    expect(parseUtm(JSON.stringify({ a: 'x'.repeat(400) }))!.a).toHaveLength(300);
  });
  it('ignores anything that is not an object', () => {
    for (const raw of ['', 'not json', '[]', '"x"', '123', 'null', '{}', undefined]) expect(parseUtm(raw)).toBeUndefined();
  });
});

it('parseFirstTouch combines the two cookies', () => {
  expect(parseFirstTouch('main-site', '{"utm_medium":"cpc"}')).toEqual({ source: 'main-site', utm: { utm_medium: 'cpc' } });
  expect(parseFirstTouch(undefined, undefined)).toEqual({ source: undefined, utm: undefined });
});
