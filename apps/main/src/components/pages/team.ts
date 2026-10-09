/**
 * Pure logic for the team directory and the attorney pages. No imports from the app (no "@/" aliases) so it is unit
 * tested directly.
 */

/** Filter value that shows everybody. */
export const ALL = 'All';

/**
 * Order of the department pills, as designed. Departments are the ENGLISH `dept` of the content (see `departmentOf` in
 * @dpl/i18n: the Hebrew strings are not consistent with each other, so nothing here ever filters on them).
 * A department that is not listed is appended after the listed ones, so a new one in the content still gets its pill.
 */
export const DEPARTMENT_ORDER: readonly string[] = [
  'Partners',
  'Austria and Germany',
  'Immigration to Israel',
  'United States',
  'Foreign citizenship',
  'Commercial',
  'Notarial translations',
  'Client relations',
  'Operations',
  'Finance',
];

export function orderedDepartments(departments: readonly string[]): string[] {
  return [
    ...DEPARTMENT_ORDER.filter((d) => departments.includes(d)),
    ...departments.filter((d) => !DEPARTMENT_ORDER.includes(d)),
  ];
}

/** "Austria and Germany" -> "austria-and-germany": the key of the department's label in messages (pages.team.departments). */
export function departmentKey(dept: string): string {
  return dept
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** How many people each department has. */
export function departmentCounts(depts: Iterable<string>): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const d of depts) counts[d] = (counts[d] ?? 0) + 1;
  return counts;
}

export function filterByDepartment<T extends { dept: string }>(people: readonly T[], dept: string): T[] {
  return dept === ALL ? [...people] : people.filter((p) => p.dept === dept);
}

/** The Hebrew honorific "עו"ד" (with ASCII or Hebrew quotation marks) is not part of a name's initials. */
const HEBREW_ADVOCATE = /^עו["״']?ד$/;

/** "Shira Gray" -> "SG", "עו"ד שירה גריי" -> "שג". First letters of the first two words of the name. */
export function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .filter((word, i) => !(i === 0 && HEBREW_ADVOCATE.test(word)))
    .slice(0, 2)
    .map((word) => [...word][0] ?? '')
    .join('');
}

/** Static params of /[locale]/team/[slug]: every slug in every locale. */
export function teamStaticParams<L extends string>(
  locales: readonly L[],
  slugs: readonly string[],
): Array<{ locale: L; slug: string }> {
  return locales.flatMap((locale) => slugs.map((slug) => ({ locale, slug })));
}

/** Shortens text to `max` characters at a word boundary, with an ellipsis (meta descriptions). */
export function cut(text: string | null | undefined, max: number): string {
  const s = String(text ?? '')
    .replace(/\s+/g, ' ')
    .trim();
  return s.length > max ? s.slice(0, max - 1).replace(/\s+\S*$/, '') + '…' : s;
}
