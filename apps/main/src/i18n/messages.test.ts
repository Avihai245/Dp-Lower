import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { NAMESPACES } from './messages';

const root = join(__dirname, '../../messages');

function keys(value: unknown, prefix = ''): string[] {
  if (Array.isArray(value)) return value.flatMap((v, i) => keys(v, `${prefix}[${i}]`));
  if (value && typeof value === 'object') return Object.entries(value).flatMap(([k, v]) => keys(v, prefix ? `${prefix}.${k}` : k));
  return [prefix];
}
function leaves(value: unknown, prefix = ''): Array<[string, unknown]> {
  if (Array.isArray(value)) return value.flatMap((v, i) => leaves(v, `${prefix}[${i}]`));
  if (value && typeof value === 'object') return Object.entries(value).flatMap(([k, v]) => leaves(v, prefix ? `${prefix}.${k}` : k));
  return [[prefix, value]];
}
const read = (locale: string, ns: string) => JSON.parse(readFileSync(join(root, locale, `${ns}.json`), 'utf8'));

describe('messages', () => {
  it('has a file for every namespace in both languages and no stray files', () => {
    for (const locale of ['en', 'he']) {
      const files = readdirSync(join(root, locale)).filter((f) => f.endsWith('.json')).map((f) => f.replace('.json', '')).sort();
      expect(files).toEqual([...NAMESPACES].sort());
    }
  });

  for (const ns of NAMESPACES) {
    it(`${ns}: English and Hebrew have identical keys`, () => {
      const en = keys(read('en', ns)).sort();
      const he = keys(read('he', ns)).sort();
      expect(he.filter((k) => !en.includes(k)), 'only in Hebrew').toEqual([]);
      expect(en.filter((k) => !he.includes(k)), 'missing in Hebrew').toEqual([]);
    });

    it(`${ns}: no empty strings, and Hebrew text is actually Hebrew`, () => {
      for (const [k, v] of leaves(read('he', ns))) {
        if (typeof v !== 'string') continue;
        expect(v.trim(), `he ${ns}.${k} is empty`).not.toBe('');
      }
      for (const [k, v] of leaves(read('en', ns))) {
        if (typeof v !== 'string') continue;
        expect(v.trim(), `en ${ns}.${k} is empty`).not.toBe('');
      }
    });
  }
});
