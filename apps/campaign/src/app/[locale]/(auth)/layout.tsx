import { setRequestLocale } from 'next-intl/server';
import type { ReactNode } from 'react';
import { ClientMessages } from '@/components/ClientMessages';
import '@/styles/funnel.css';

/** Set password, sign in and the expired-link page: the screens are Client Components and read the `auth` messages. */
export default async function AuthLayout({ children, params }: { children: ReactNode; params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale);
  return <ClientMessages namespaces={['auth']}>{children}</ClientMessages>;
}
