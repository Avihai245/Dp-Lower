import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Dashboard } from '@/components/portal/Dashboard';
import { loadPortalState, requirePortalPage } from '@/server/portal';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'portal.meta' });
  return { title: t('dashboard') };
}

/** /portal: where the application stands (before submission: the next step; after: the status of the case). */
export default async function PortalPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { db, lead } = await requirePortalPage(locale);
  return <Dashboard initial={await loadPortalState(db, lead)} />;
}
