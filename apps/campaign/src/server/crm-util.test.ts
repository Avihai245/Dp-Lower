import type { DocType } from '@dpl/core';
import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { asObject, asStringMap, done, fail, fetchAll, missingDocTypes } from './crm-util';

describe('fetchAll', () => {
  const pageOf = (total: number) => async (from: number, to: number) => ({
    data: Array.from({ length: Math.max(0, Math.min(to + 1, total) - from) }, (_v, i) => from + i),
    error: null,
  });

  it('walks every page of 1000 rows until a short page', async () => {
    const out = await fetchAll(pageOf(2250));
    expect(out).toHaveLength(2250);
    expect(out[0]).toBe(0);
    expect(out[2249]).toBe(2249);
  });

  it('stops after a page that is exactly full and the next one empty', async () => {
    const spy = vi.fn(pageOf(1000));
    expect(await fetchAll(spy)).toHaveLength(1000);
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it('returns nothing for an empty table and throws the database error otherwise', async () => {
    expect(await fetchAll(pageOf(0))).toEqual([]);
    await expect(fetchAll(async () => ({ data: null, error: { message: 'permission denied' } }))).rejects.toThrow('permission denied');
  });
});

describe('json helpers', () => {
  it('keeps only string values of an object', () => {
    expect(asStringMap({ a: 'x', b: 2, c: null, d: ['y'], e: '' })).toEqual({ a: 'x', e: '' });
    expect(asStringMap(null)).toEqual({});
    expect(asStringMap(['a'])).toEqual({});
    expect(asStringMap('text')).toEqual({});
  });
  it('treats anything but a plain object as empty', () => {
    expect(asObject({ residence: 'us' })).toEqual({ residence: 'us' });
    expect(asObject(null)).toEqual({});
    expect(asObject([1])).toEqual({});
    expect(asObject(5)).toEqual({});
  });
});

describe('results and documents', () => {
  it('builds the two result shapes of a Server Action', () => {
    expect(done({ stage: 'review' })).toEqual({ ok: true, data: { stage: 'review' } });
    expect(done()).toEqual({ ok: true, data: undefined });
    expect(fail('conflict')).toEqual({ ok: false, error: 'conflict', field: undefined });
    expect(fail('invalid', 'phone')).toEqual({ ok: false, error: 'invalid', field: 'phone' });
  });
  it('lists the document slots that have not been received, in display order', () => {
    expect(missingDocTypes(new Set<DocType>(['passport', 'birth_certificate']))).toEqual([
      'marriage_certificates',
      'emigration_naturalization',
      'persecution_proof',
      'family_tree',
      'photo_id',
      'other',
    ]);
    expect(missingDocTypes(new Set<DocType>())).toHaveLength(8);
  });
});
