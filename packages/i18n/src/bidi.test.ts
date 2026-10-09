import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import * as he from './content/he';

/**
 * A citation like "116(2)" inside Hebrew text is laid out by the bidirectional algorithm as "(2)116": the parentheses are
 * neutral and take the direction of the numbers around them. It has to be wrapped in a left-to-right isolate
 * (U+2066 ... U+2069), written as \u escapes in the sources so they stay visible. This guards every Hebrew string of the
 * content and of both apps' messages.
 */
const LRI = '⁦';
const PDI = '⁩';
const CITATION = /\d+\([0-9A-Za-z]{1,3}\)/g;

function strings(value: unknown, trail: string, out: Array<[string, string]> = []): Array<[string, string]> {
  if (typeof value === 'string') out.push([trail, value]);
  else if (Array.isArray(value)) value.forEach((v, i) => strings(v, `${trail}[${i}]`, out));
  else if (value && typeof value === 'object') for (const [k, v] of Object.entries(value)) strings(v, `${trail}.${k}`, out);
  return out;
}

function messageStrings(dir: string): Array<[string, string]> {
  return readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .flatMap((f) => strings(JSON.parse(readFileSync(path.join(dir, f), 'utf8')), f));
}

const ROOT = path.join(import.meta.dirname, '../../..');
const sources: Array<[string, Array<[string, string]>]> = [
  ['content/he.ts', strings({ ...he }, 'he')],
  ['apps/main/messages/he', messageStrings(path.join(ROOT, 'apps/main/messages/he'))],
  ['apps/campaign/messages/he', messageStrings(path.join(ROOT, 'apps/campaign/messages/he'))],
];

describe('Hebrew citations are isolated', () => {
  it.each(sources)('%s: every "116(2)"-style citation sits inside a left-to-right isolate', (_name, list) => {
    const bare: string[] = [];
    for (const [where, text] of list) {
      for (const m of text.matchAll(CITATION)) {
        const i = m.index ?? 0;
        // the whole run of digits before the parenthesis is part of the citation
        if (text[i - 1] !== LRI || text[i + m[0].length] !== PDI) bare.push(`${where}: …${text.slice(Math.max(0, i - 12), i + m[0].length + 6)}…`);
      }
    }
    expect(bare).toEqual([]);
  });

  it('the guard sees the citations it exists for', () => {
    const all = sources.flatMap(([, list]) => list).filter(([, text]) => text.includes(`${LRI}116(2)${PDI}`));
    expect(all.length).toBeGreaterThanOrEqual(8);
  });
});
