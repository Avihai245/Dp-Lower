import type { ApplicationData } from '@dpl/core';

/**
 * "Ancestor: Ruth Weiss, Vienna 1911", from the answers in the application (name, the city of birth and the year of
 * birth when the date contains one). Null when the application has no ancestor name.
 */
export function ancestorSummary(data: ApplicationData | null | undefined): string | null {
  const name = (data?.anName ?? '').trim();
  if (!name) return null;
  const city = (data?.anBirthPlace ?? '').split(',')[0]?.trim() ?? '';
  const year = /(?<!\d)(1[5-9]\d{2}|20\d{2})(?!\d)/.exec(data?.anDob ?? '')?.[1] ?? '';
  const tail = [city, year].filter(Boolean).join(' ');
  return tail ? `${name}, ${tail}` : name;
}
