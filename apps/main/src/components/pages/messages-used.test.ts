import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Every message key that the pages and the contact form look up with a literal t('...') exists in both languages.
 * (messages.test.ts already checks that English and Hebrew have the same keys; this catches a key that is misspelt in
 * the code, which would only show up as a raw key on the page.)
 */
const root = join(__dirname, '../../..');
const read = (path: string) => readFileSync(path, 'utf8');
const messages = (locale: 'en' | 'he', ns: string): unknown =>
  JSON.parse(read(join(root, 'messages', locale, `${ns}.json`)));

function lookup(tree: unknown, dotted: string): unknown {
  return dotted.split('.').reduce<unknown>((node, key) => {
    if (node && typeof node === 'object' && key in node) return (node as Record<string, unknown>)[key];
    return undefined;
  }, tree);
}

/** [file, namespace the file's `t` is bound to] */
const SOURCES: Array<[string, string, string]> = [
  ...readdirSync(__dirname)
    .filter((f) => /\.tsx?$/.test(f) && !/\.test\./.test(f))
    .map((f): [string, string, string] => [join(__dirname, f), 'pages', '']),
  [join(__dirname, '../contact/ContactForm.tsx'), 'forms', 'contact.'],
  [join(root, 'src/app/[locale]/(site)/team/[slug]/page.tsx'), 'pages', ''],
];

describe('message keys used by the code', () => {
  for (const [file, ns, prefix] of SOURCES) {
    const name = file.replace(root + '/', '');
    const keys = [...read(file).matchAll(/\bt(?:\.rich|\.raw|\.has)?\(\s*(['"`])([^'"`$]+)\1/g)].map(
      (m) => m[2]!,
    );

    it(`${name} (${keys.length} keys)`, () => {
      for (const locale of ['en', 'he'] as const) {
        const tree = messages(locale, ns);
        for (const key of keys) {
          expect(lookup(tree, prefix + key), `${locale} ${ns}.${prefix}${key}`).not.toBeUndefined();
        }
      }
    });
  }

  it('finds the keys it is meant to check (the scan itself works)', () => {
    const about = read(join(__dirname, 'AboutPage.tsx'));
    expect([...about.matchAll(/\bt(?:\.rich|\.raw)?\(\s*(['"`])([^'"`$]+)\1/g)].length).toBeGreaterThan(10);
  });
});

describe('the consultation form copy', () => {
  it('offers the ten matters of the design, in this order, as the values sent to the firm', () => {
    const en = (messages('en', 'forms') as { matters: string[] }).matters;
    expect(en).toEqual([
      'German or Austrian passport',
      'Polish passport',
      'Portuguese passport',
      'Romanian, French or Bulgarian passport',
      'Immigration to Israel or Aliyah',
      'Status for a foreign spouse',
      'Work permit for a foreign expert',
      'Notarial translation',
      'Inheritance or family matter',
      'Something else',
    ]);
    expect((messages('he', 'forms') as { matters: string[] }).matters).toHaveLength(10);
  });

  it('keeps the placeholders (name, phone, email, number) in every language', () => {
    for (const locale of ['en', 'he'] as const) {
      const sent = (
        messages(locale, 'forms') as {
          contact: { sent: Record<string, string>; failed: Record<string, string> };
        }
      ).contact;
      expect(sent.sent.title, locale).toContain('{name}');
      expect(sent.sent.line, locale).toContain('{phone}');
      expect(sent.sent.line, locale).toContain('{email}');
      for (const key of ['urgent']) expect(sent.sent[key], `${locale} ${key}`).toContain('{number}');
      for (const key of ['rate', 'generic', 'captcha'])
        expect(sent.failed[key], `${locale} ${key}`).toContain('{number}');
    }
  });
});
