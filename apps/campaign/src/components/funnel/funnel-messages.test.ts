import { QUIZ, QUIZ_ORDER } from '@dpl/core';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The funnel and auth screens read a lot of ICU messages (plurals, selects, rich tags). messages.test.ts checks that
 * English and Hebrew have the same keys; this checks what that cannot:
 *  - every message parses, and Hebrew uses exactly the same placeholders and tags as English (a Hebrew message that
 *    forgot {name} would silently drop the name),
 *  - every key a component asks for exists in both languages, including the keys built at run time.
 */
const root = join(__dirname, '../../..');
const read = (locale: string, ns: string) => JSON.parse(readFileSync(join(root, 'messages', locale, `${ns}.json`), 'utf8')) as Record<string, unknown>;

// intl-messageformat is a dependency of next-intl, not of this app: resolve it the way next-intl does
const nextIntl = createRequire(import.meta.url).resolve('next-intl');
const useIntl = createRequire(nextIntl).resolve('use-intl');
const { IntlMessageFormat } = createRequire(useIntl)('intl-messageformat') as {
  IntlMessageFormat: new (message: string, locale: string) => { getAst(): AstNode[] };
};

interface AstNode {
  type: number;
  value?: string;
  options?: Record<string, { value: AstNode[] }>;
  children?: AstNode[];
}

function variables(ast: AstNode[], out = { args: new Set<string>(), tags: new Set<string>() }) {
  for (const el of ast) {
    if (el.type >= 1 && el.type <= 4 && el.value) out.args.add(el.value);
    if ((el.type === 5 || el.type === 6) && el.value) {
      out.args.add(el.value);
      for (const o of Object.values(el.options ?? {})) variables(o.value, out);
    }
    if (el.type === 8 && el.value) {
      out.tags.add(el.value);
      variables(el.children ?? [], out);
    }
  }
  return out;
}

function leaves(value: unknown, prefix = ''): Array<[string, string]> {
  if (typeof value === 'string') return [[prefix, value]];
  if (Array.isArray(value)) return value.flatMap((v, i) => leaves(v, `${prefix}.${i}`));
  if (value && typeof value === 'object') return Object.entries(value).flatMap(([k, v]) => leaves(v, prefix ? `${prefix}.${k}` : k));
  return [];
}

const has = (messages: Record<string, unknown>, key: string): boolean => {
  let cur: unknown = messages;
  for (const part of key.split('.')) {
    if (cur === null || typeof cur !== 'object' || !(part in cur)) return false;
    cur = (cur as Record<string, unknown>)[part];
  }
  return true;
};

describe.each(['funnel', 'auth'])('%s messages', (ns) => {
  const en = leaves(read('en', ns));
  const he = new Map(leaves(read('he', ns)));

  it('every message parses in both languages', () => {
    for (const [key, text] of en) expect(() => new IntlMessageFormat(text, 'en'), `en ${ns}.${key}`).not.toThrow();
    for (const [key, text] of he) expect(() => new IntlMessageFormat(text, 'he'), `he ${ns}.${key}`).not.toThrow();
  });

  it('Hebrew uses the same placeholders and tags as English', () => {
    for (const [key, text] of en) {
      const a = variables(new IntlMessageFormat(text, 'en').getAst());
      const b = variables(new IntlMessageFormat(he.get(key) ?? '', 'he').getAst());
      expect([...b.args].sort(), `placeholders of ${ns}.${key}`).toEqual([...a.args].sort());
      expect([...b.tags].sort(), `tags of ${ns}.${key}`).toEqual([...a.tags].sort());
    }
  });

  it('Hebrew messages are Hebrew (apart from the strings that are the same everywhere)', () => {
    const SAME = /^(you@(example|email)\.com|\+1 555 000 0000)$/;
    for (const [key, text] of he) {
      if (SAME.test(text)) continue;
      // "{date} · {time}" has no words to translate
      const words = text.replace(/\{[^}]*\}/g, '').replace(/<\/?\w+>/g, '');
      if (!/[A-Za-z\u0590-\u05ff]/.test(words)) continue;
      expect(text, `${ns}.${key}`).toMatch(/[\u0590-\u05ff]/);
    }
  });
});

/** Keys a component builds at run time, with every value each one can take. */
const DYNAMIC: Record<string, string[]> = {
  'quiz.questions.${id}.text': QUIZ_ORDER.map((id) => `quiz.questions.${id}.text`),
  'quiz.questions.${id}.help': QUIZ_ORDER.map((id) => `quiz.questions.${id}.help`),
  'quiz.questions.${id}.options.${option}': QUIZ_ORDER.flatMap((id) => QUIZ[id].map((o) => `quiz.questions.${id}.options.${o}`)),
  'quiz.questions.${v.quiz}.options.${v.option}': (['country', 'when', 'records'] as const).flatMap((id) => QUIZ[id].map((o) => `quiz.questions.${id}.options.${o}`)),
  'quiz.nudge.${nudge}': ['unsure', 'halfway', 'last'].map((k) => `quiz.nudge.${k}`),
  'lead.errors.${error}': ['rateLimited', 'network', 'captcha', 'generic'].map((k) => `lead.errors.${k}`),
  'booking.notice.${notice}': ['taken', 'failed', 'rateLimited', 'network'].map((k) => `booking.notice.${k}`),
  'offer.headline.${offer.claim}': ['unknown', 'both', 'german', 'austrian'].map((k) => `offer.headline.${k}`),
  'offer.file.values.${v.key}': ['toConfirm', 'datedFromRecords', 'noneYetSearch', 'germanyAndAustria'].map((k) => `offer.file.values.${k}`),
  'offer.file.who.${v.relative}': ['parent', 'grandparent', 'great_grandparent', 'further'].map((k) => `offer.file.who.${k}`),
  'offer.file.rows.${row.id}': ['route', 'who', 'departure', 'records'].map((k) => `offer.file.rows.${k}`),
  '${copy}.kicker': ['password.kicker', 'password.reset.kicker'],
  '${copy}.title': ['password.title', 'password.reset.title'],
  '${copy}.lede': ['password.lede', 'password.reset.lede'],
  'password.errors.${error}': ['rejected', 'rateLimited', 'network', 'generic'].map((k) => `password.errors.${k}`),
  'password.hint.${state.hint}': ['default', 'short', 'mismatch'].map((k) => `password.hint.${k}`),
  'signIn.lede.${mode}': ['form', 'reset', 'sent'].map((k) => `signIn.lede.${k}`),
  'signIn.notice.${notice}': ['link', 'oauth', 'googleUnavailable', 'rateLimited', 'network', 'generic'].map((k) => `signIn.notice.${k}`),
  'signIn.notice.${error}': ['link', 'oauth', 'googleUnavailable', 'rateLimited', 'network', 'generic'].map((k) => `signIn.notice.${k}`),
  'signIn.hints.${hint}': ['invalid', 'noPassword'].map((k) => `signIn.hints.${k}`),
};

function sources(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) sources(p, out);
    else if (/\.tsx?$/.test(name) && !/\.test\./.test(name)) out.push(p);
  }
  return out;
}

describe('message keys used by the screens', () => {
  const files = [
    ...sources(join(root, 'src/components/funnel')),
    ...sources(join(root, 'src/app/[locale]/(funnel)')),
    ...sources(join(root, 'src/app/[locale]/(auth)')),
    join(root, 'src/app/[locale]/unsubscribe/page.tsx'),
  ];
  const messages = { funnel: { en: read('en', 'funnel'), he: read('he', 'funnel') }, auth: { en: read('en', 'auth'), he: read('he', 'auth') } };

  for (const file of files) {
    const code = readFileSync(file, 'utf8');
    const ns = /useTranslations\('(\w+)'\)/.exec(code)?.[1] ?? /namespace: '(\w+)'/.exec(code)?.[1];
    if (!ns || !(ns in messages)) continue;
    const keys = [...code.matchAll(/\bt(?:\.rich|\.raw)?\(\s*(['"`])((?:(?!\1).)+)\1/g)].map((m) => m[2]!);
    if (keys.length === 0) continue;

    it(`${file.slice(file.indexOf('/src/') + 1)} (${ns})`, () => {
      for (const key of keys) {
        const expanded = key.includes('${') ? DYNAMIC[key] : [key];
        expect(expanded, `${key} is built at run time: list its values in DYNAMIC`).toBeDefined();
        for (const k of expanded!) {
          expect(has(messages[ns as 'funnel' | 'auth'].en, k), `en ${ns}.${k}`).toBe(true);
          expect(has(messages[ns as 'funnel' | 'auth'].he, k), `he ${ns}.${k}`).toBe(true);
        }
      }
    });
  }

  it('found the screens', () => {
    expect(files.length).toBeGreaterThan(15);
  });
});
