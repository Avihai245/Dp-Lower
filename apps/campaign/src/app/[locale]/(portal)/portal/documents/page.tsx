import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { DocumentsScreen } from '@/components/portal/DocumentsScreen';
import { loadPortalState, requirePortalPage } from '@/server/portal';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'portal.meta' });
  return { title: t('documents') };
}

/** /portal/documents: the eight document slots and the submit panel. Documents can still be added after submission. */
export default async function DocumentsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { db, lead } = await requirePortalPage(locale);
  return <DocumentsScreen initial={await loadPortalState(db, lead)} />;
}
