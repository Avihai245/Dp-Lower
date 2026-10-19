import type { Locale } from '@dpl/core';

/**
 * One JSON file per area and language in /messages/{en,he}/{namespace}.json. Add a namespace here and create the two
 * files; messages.test.ts fails when the English and Hebrew key sets differ.
 *
 * `funnel` is a copy of apps/main/messages/{en,he}/funnel.json (the eligibility funnel lives on the firm's site now): the
 * CRM shows the applicants' quiz answers with the funnel's own wording. Keep the two copies equal
 * (apps/main/src/i18n/funnel-copy.test.ts).
 */
export const NAMESPACES = ['common', 'auth', 'portal', 'admin', 'seo', 'funnel'] as const;
export type Namespace = (typeof NAMESPACES)[number];

export async function loadMessages(locale: Locale): Promise<Record<string, unknown>> {
  const entries = await Promise.all(
    NAMESPACES.map(async (ns) => [ns, (await import(`../../messages/${locale}/${ns}.json`)).default] as const),
  );
  return Object.fromEntries(entries);
}
