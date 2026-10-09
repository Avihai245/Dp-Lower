import { DEPARTMENTS, TEAM_SLUGS, departmentOf, getContent, getMember } from '@dpl/i18n';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  ALL,
  DEPARTMENT_ORDER,
  cut,
  departmentCounts,
  departmentKey,
  filterByDepartment,
  initialsOf,
  orderedDepartments,
  teamStaticParams,
} from './team';

interface PagesMessages {
  team: { departments: Record<string, string> };
}
const pagesMessages = (locale: 'en' | 'he') =>
  JSON.parse(
    readFileSync(join(__dirname, '../../../messages', locale, 'pages.json'), 'utf8'),
  ) as PagesMessages;

describe('department counts and filtering (real content)', () => {
  const en = getContent('en').team;
  const people = en.map((m) => ({ slug: m.slug, name: m.name, dept: departmentOf(m.slug) }));

  it('has 37 people and every one belongs to a department', () => {
    expect(en).toHaveLength(37);
    expect(people.every((p) => p.dept !== '')).toBe(true);
  });

  it('counts add up to the whole team and match the filter', () => {
    const counts = departmentCounts(people.map((p) => p.dept));
    expect(Object.values(counts).reduce((a, b) => a + b, 0)).toBe(37);
    for (const dept of DEPARTMENTS) {
      expect(counts[dept], dept).toBe(filterByDepartment(people, dept).length);
      expect(counts[dept], dept).toBeGreaterThan(0);
    }
    expect(counts['Partners']).toBe(3);
  });

  it('"All" returns everybody in content order, and an unknown department returns nobody', () => {
    expect(filterByDepartment(people, ALL).map((p) => p.slug)).toEqual(TEAM_SLUGS);
    expect(filterByDepartment(people, 'Nope')).toEqual([]);
  });

  it('filters on the English department even in Hebrew, where the dept strings differ', () => {
    const he = getContent('he').team.map((m) => ({
      slug: m.slug,
      heDept: m.dept,
      dept: departmentOf(m.slug),
    }));
    expect(
      filterByDepartment(he, 'Partners')
        .map((p) => p.slug)
        .sort(),
    ).toEqual(['anat-levi', 'joshua-pex', 'michael-decker']);
    // every Hebrew member is reachable through some English department
    expect(he.every((m) => DEPARTMENTS.includes(m.dept))).toBe(true);
  });

  it('keeps the designed pill order, and appends a department the design does not know', () => {
    expect(orderedDepartments(DEPARTMENTS)).toEqual([...DEPARTMENT_ORDER]);
    expect(orderedDepartments(['Finance', 'Partners'])).toEqual(['Partners', 'Finance']);
    expect(orderedDepartments(['Partners', 'Brand new', 'Finance'])).toEqual([
      'Partners',
      'Finance',
      'Brand new',
    ]);
    // the designed order names exactly the departments of the content
    expect([...DEPARTMENT_ORDER].sort()).toEqual([...DEPARTMENTS].sort());
  });
});

describe('department labels in messages', () => {
  it('has a label for every department in both languages, and the Hebrew label is the one the Hebrew content uses', () => {
    const enLabels = pagesMessages('en').team.departments;
    const heLabels = pagesMessages('he').team.departments;
    for (const dept of DEPARTMENTS) {
      const key = departmentKey(dept);
      expect(enLabels[key], `en ${key}`).toBe(dept);
      expect(typeof heLabels[key], `he ${key}`).toBe('string');
    }
    // Hebrew people of one department all carry the same Hebrew dept string, and the pill says the same
    for (const dept of DEPARTMENTS) {
      const used = new Set(
        getContent('he')
          .team.filter((m) => departmentOf(m.slug) === dept)
          .map((m) => m.dept),
      );
      expect([...used], dept).toEqual([heLabels[departmentKey(dept)]]);
    }
  });

  it('turns department names into message keys', () => {
    expect(departmentKey('Austria and Germany')).toBe('austria-and-germany');
    expect(departmentKey('Partners')).toBe('partners');
    expect(departmentKey(' Client  relations ')).toBe('client-relations');
  });
});

describe('initialsOf', () => {
  it('uses the first letters of the first two words', () => {
    expect(initialsOf('Shira Gray')).toBe('SG');
    expect(initialsOf('Maria Chernin Dekel')).toBe('MC');
    expect(initialsOf('Einat S.')).toBe('ES');
    expect(initialsOf('Cher')).toBe('C');
    expect(initialsOf('')).toBe('');
  });

  it('ignores the Hebrew honorific', () => {
    expect(initialsOf('עו"ד שירה גריי')).toBe('שג');
    expect(initialsOf('עו״ד אריאל גלילי')).toBe('אג');
    expect(initialsOf('מרים לקסמן')).toBe('מל');
    expect(initialsOf('עינת ש.')).toBe('עש');
  });

  it('gives every member a non-empty monogram in both languages', () => {
    for (const locale of ['en', 'he'] as const) {
      for (const m of getContent(locale).team)
        expect(initialsOf(m.name), `${locale} ${m.slug}`.trim()).not.toBe('');
    }
  });
});

describe('teamStaticParams', () => {
  it('covers 37 slugs in 2 locales', () => {
    const params = teamStaticParams(['en', 'he'], TEAM_SLUGS);
    expect(params).toHaveLength(74);
    expect(new Set(params.map((p) => `${p.locale}/${p.slug}`)).size).toBe(74);
  });

  it('only produces pages that exist in both languages', () => {
    for (const { locale, slug } of teamStaticParams(['en', 'he'] as const, TEAM_SLUGS)) {
      expect(getMember(locale, slug), `${locale}/${slug}`).toBeDefined();
    }
    expect(getMember('en', 'nobody')).toBeUndefined();
  });
});

describe('cut', () => {
  it('leaves short text alone and shortens long text at a word boundary', () => {
    expect(cut('  A   short   text ', 50)).toBe('A short text');
    const long = 'word '.repeat(60);
    const out = cut(long, 158);
    expect(out.length).toBeLessThanOrEqual(158);
    expect(out.endsWith('…')).toBe(true);
    expect(out.endsWith(' …')).toBe(false);
    expect(cut(null, 10)).toBe('');
  });
});
