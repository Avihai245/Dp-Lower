import type { Locale } from '@dpl/core';
import { createServerSupabase } from '@dpl/db/server';
import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import type { ReactNode } from 'react';
import { AdminShell } from '@/components/admin/AdminShell';
import { ClientMessages } from '@/components/ClientMessages';
import { loadInboxCounts, loadLeadRows, loadStaffOptions } from '@/server/crm';
import { requireStaffPage } from '@/server/staff-page';

import '@/styles/admin.css';

/** The CRM is for the firm only: never indexed, never cached. */
export const metadata: Metadata = { robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

/**
 * Everything under /admin: the layout requires a signed-in, active staff member (the middleware has already sent
 * anonymous visitors to the sign-in page; people without a staff row get the 404 page) and loads the leads once for
 * the list, the board, the counters and the lead pager. Every Server Action checks again.
 *
 * There is deliberately no loading.tsx under /admin: it wraps each page in a Suspense boundary, the response then starts
 * streaming before the page's own notFound() checks (admin-only pages, an unknown lead id) have run, and their 404
 * would go out as a 200.
 */
export default async function AdminLayout({ children, params }: { children: ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await requireStaffPage(locale as Locale);

  const db = await createServerSupabase();
  const funnel = await getTranslations({ locale, namespace: 'funnel' });
  const residence = (key: string) => {
    const path = `quiz.questions.residence.options.${key}`;
    return funnel.has(path) ? funnel(path) : null;
  };
  const [rows, staff, inbox] = await Promise.all([loadLeadRows(db, { residence }), loadStaffOptions(db), loadInboxCounts(db)]);

  return (
    <ClientMessages namespaces={['admin']}>
      <AdminShell
        rows={rows}
        staff={staff}
        inbox={inbox}
        me={{ id: session.actor.id, name: session.actor.name, role: session.staff.role }}
        nowIso={new Date().toISOString()}
      >
        {children}
      </AdminShell>
    </ClientMessages>
  );
}
