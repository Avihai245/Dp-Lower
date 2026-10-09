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

/**
 * The invisible direction marks (isolates, embeddings, overrides, LRM/RLM) that keep a number like "116(2)" in order on a
 * Hebrew page. Machines reading the text (structured data, the text files for AI answer engines) do not need them, and
 * they would end up inside the strings they quote.
 */
export const stripBidiControls = (s: string): string => s.replace(/[\u200E\u200F\u202A-\u202E\u2066-\u2069]/g, '');

/**
 * A person's name from a form: one line (see oneLine) without the characters that make a name look like markup or an address
 * header (`<`, `>`, `"`, `\`): "Tom & Jerry <tom@evil.com>" is not a name, and the name travels as the recipient name of
 * every email sent to the person.
 */
export const nameText = (s: string | null | undefined): string => oneLine(s).replace(/[<>"\\]/g, '').replace(/\s+/g, ' ').trim();

/** A phone number from a form: digits and the usual separators only (letters and markup are dropped). */
export const phoneText = (s: string | null | undefined): string => oneLine(s).replace(/[^0-9+().\- ]/g, '').replace(/\s+/g, ' ').trim();

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
    .replace(/[<>"\\]/g, '')
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

/**
 * An address a mail provider will take: ASCII letters, digits and the usual symbols before the @ (no quoted strings), a
 * domain of dot-separated ASCII labels (an international domain is written in its punycode form). The firm's website keeps
 * identical copies of this expression (it cannot import this package into the browser); a test checks they agree.
 */
export const EMAIL_RE = /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@(?:[A-Za-z0-9-]+\.)+[A-Za-z0-9-]{2,}$/;
export const isEmail = (s: string): boolean => EMAIL_RE.test(s.trim()) && s.trim().length <= 254;
export const isPhone = (s: string): boolean => digitsOf(s).length >= 7 && s.trim().length <= 40;
export const isName = (s: string): boolean => s.trim().length >= 2 && s.trim().length <= 120;
