import { setRequestLocale } from 'next-intl/server';
import type { ReactNode } from 'react';
import { ClientMessages } from '@/components/ClientMessages';
import '@/styles/funnel.css';

/** Eligibility questions, details, booking and result. The screens are Client Components and read the `funnel` messages. */
export default async function FunnelLayout({ children, params }: { children: ReactNode; params: Promise<{ locale: string }> }) {
  // layouts and pages render in parallel: the locale must be set here too for the group to stay statically renderable
  setRequestLocale((await params).locale);
  return <ClientMessages namespaces={['funnel']}>{children}</ClientMessages>;
}
