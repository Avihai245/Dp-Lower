import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { LeadsView } from '@/components/admin/LeadsView';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'admin.meta' });
  return { title: `${t('leads')} · ${t('suffix')}` };
}

/** /admin: the lead list and board. The data comes from the layout (one load shared by the list, board and counters). */
export default async function AdminHome({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <LeadsView />;
}
