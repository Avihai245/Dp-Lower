/** Digits only, e.g. for the "at least 7 digits" phone rule. */
export const digitsOf = (s: string | null | undefined): string => (s ?? '').replace(/[^0-9]/g, '');

export const normalizeEmail = (s: string): string => s.trim().toLowerCase();

/**
 * The text of a one-line form field. Control characters (CR, LF, tab, NUL...) become a space, invisible format
 * characters (bidi marks, zero-width, soft hyphen) are dropped, runs of white space shrink to one space. A name with a
 * line break in it would otherwise travel into the headers of whatever sends the email addressed to it.
 */
export const oneLine = (s: string | null | undefined): string =>
  (s ?? '').replace(/\p{Cc}+/gu, ' ').replace(/\p{Cf}+/gu, '').replace(/\s+/g, ' ').trim();

/** The text of a multi-line field: line breaks are kept (as \n, at most one blank line in a row), every other control or format character is treated as in oneLine. */
export const multiLine = (s: string | null | undefined): string =>
  (s ?? '')
    .replace(/\r\n?|\u2028|\u2029/g, '\n')
    .replace(/[^\P{Cc}\n]+/gu, ' ')
    .replace(/\p{Cf}+/gu, '')
    .replace(/[^\S\n]+/g, ' ')
    .replace(/ ?\n ?/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

/**
 * Capitalise each word of a person's name ("anna reinhardt" -> "Anna Reinhardt", "o'neil-smith" -> "O'Neil-Smith").
 * Hebrew and other uncased scripts pass through untouched.
 */
export const capitalizeName = (s: string | null | undefined): string =>
  (s ?? '')
    .replace(/\p{Cc}+/gu, ' ')
    .replace(/\p{Cf}+/gu, '')
    .trim()
    .replace(/(^|[\s'\-])([a-zà-ÿ])/g, (_m, p: string, c: string) => p + c.toUpperCase());

export const firstNameOf = (full: string | null | undefined): string =>
  capitalizeName((full ?? '').trim().split(/\s+/)[0] ?? '');

export const initialsOf = (full: string): string =>
  full
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('');

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const isEmail = (s: string): boolean => EMAIL_RE.test(s.trim()) && s.trim().length <= 254;
export const isPhone = (s: string): boolean => digitsOf(s).length >= 7 && s.trim().length <= 40;
export const isName = (s: string): boolean => s.trim().length >= 2 && s.trim().length <= 120;
