import { getArticle } from '@dpl/i18n';

/**
 * Article dates are display text per language ("15 Jun 2026", "15 ביוני 2026"). Structured data needs ISO dates, and the
 * prototype's `new Date(art.date).toISOString()` throws a RangeError on the Hebrew text, so the dates are parsed by hand.
 */

const EN_MONTHS: Record<string, number> = {
  jan: 1,
  january: 1,
  feb: 2,
  february: 2,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12,
};

const HE_MONTHS: Record<string, number> = {
  ינואר: 1,
  פברואר: 2,
  מרץ: 3,
  מרס: 3,
  אפריל: 4,
  מאי: 5,
  יוני: 6,
  יולי: 7,
  אוגוסט: 8,
  ספטמבר: 9,
  אוקטובר: 10,
  נובמבר: 11,
  דצמבר: 12,
};

/** Hebrew attaches ב ("in") to the month: ביוני, במאי, באפריל. */
function hebrewMonth(word: string): number | undefined {
  return HE_MONTHS[word] ?? (word.length > 3 ? HE_MONTHS[word.slice(1)] : undefined);
}

function iso(year: number, month: number, day: number): string | null {
  if (!month || year < 1900 || year > 2100) return null;
  const d = new Date(Date.UTC(year, month - 1, day));
  if (d.getUTCFullYear() !== year || d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) return null;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** LRM, RLM and the embedding / isolate controls (written as escapes: they are invisible in the source). */
const BIDI_MARKS = new RegExp('[\\u200e\\u200f\\u202a-\\u202e\\u2066-\\u2069]', 'g');

/**
 * "15 Jun 2026", "15 June 2026", "June 15, 2026", "15 ביוני 2026", "6 במאי 2026" or an ISO date to "YYYY-MM-DD".
 * Returns null when the text is not a date this site writes.
 */
export function parseArticleDate(text: string): string | null {
  // direction marks and odd spaces sometimes ride along in Hebrew copy
  const s = text.normalize('NFC').replace(BIDI_MARKS, '').replace(/\s+/g, ' ').trim();

  let m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (m) return iso(Number(m[1]), Number(m[2]), Number(m[3]));

  m = /^(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]{3,9})\.?,?\s+(\d{4})$/.exec(s);
  if (m) return iso(Number(m[3]), EN_MONTHS[m[2]!.toLowerCase()] ?? 0, Number(m[1]));

  m = /^([A-Za-z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})$/.exec(s);
  if (m) return iso(Number(m[3]), EN_MONTHS[m[1]!.toLowerCase()] ?? 0, Number(m[2]));

  m = /^(\d{1,2})\s+([֐-׿]{3,10})\s+(\d{4})$/.exec(s);
  if (m) return iso(Number(m[3]), hebrewMonth(m[2]!) ?? 0, Number(m[1]));

  return null;
}

/**
 * ISO publication date of an article, always derived from the English article with the same slug (the Hebrew display
 * text is only a fallback), so both languages report the same date.
 */
export function articleIsoDate(slug: string, fallbackText?: string): string | undefined {
  const en = getArticle('en', slug);
  return (
    (en ? parseArticleDate(en.date) : null) ??
    (fallbackText ? parseArticleDate(fallbackText) : null) ??
    undefined
  );
}
