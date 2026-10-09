import type { Locale } from '@dpl/core';

/**
 * One JSON file per area and language in /messages/{en,he}/{namespace}.json. Add a namespace here and create the two
 * files; messages.test.ts fails when the English and Hebrew key sets differ.
 */
export const NAMESPACES = ['site', 'home', 'a11y', 'pages', 'forms', 'services', 'insights', 'legal', 'seo'] as const;
export type Namespace = (typeof NAMESPACES)[number];

export async function loadMessages(locale: Locale): Promise<Record<string, unknown>> {
  const entries = await Promise.all(
    NAMESPACES.map(async (ns) => [ns, (await import(`../../messages/${locale}/${ns}.json`)).default] as const),
  );
  return Object.fromEntries(entries);
}
