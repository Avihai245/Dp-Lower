import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import type { ReactNode } from 'react';

/**
 * Sends only the listed message namespaces to the browser. The root layout provides `common`/`site`; route-group
 * layouts that contain Client Components wrap their children in this with every namespace those components use.
 */
export async function ClientMessages({ namespaces, children }: { namespaces: string[]; children: ReactNode }) {
  const all = (await getMessages()) as Record<string, unknown>;
  const messages = Object.fromEntries(namespaces.filter((n) => n in all).map((n) => [n, all[n]]));
  return <NextIntlClientProvider messages={messages}>{children}</NextIntlClientProvider>;
}
