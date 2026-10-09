import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import type { ReactNode } from 'react';
import { ClientMessages } from '@/components/ClientMessages';
import { requirePortalPage } from '@/server/portal';
import '@/styles/portal.css';

/** The applicant's own files: never indexed. */
export const metadata: Metadata = { robots: { index: false, follow: false } };

/**
 * Every page below is personal: it is rendered for the signed-in applicant on each request and never prerendered at
 * build time (the locale segment's generateStaticParams would otherwise list these pages as static).
 */
export const dynamic = 'force-dynamic';

/**
 * Everything under /portal needs a signed-in applicant. The middleware turns anonymous visitors away; this checks again
 * with the same rules as the API (a Supabase session that belongs to a lead), and every page checks for itself too,
 * because a layout is not re-rendered on each navigation inside the group.
 */
export default async function PortalLayout({ children, params }: { children: ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requirePortalPage(locale);
  return <ClientMessages namespaces={['portal']}>{children}</ClientMessages>;
}
