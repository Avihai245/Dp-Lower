import type { Locale } from '@dpl/core';
import { createServerSupabase } from '@dpl/db/server';
import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { InboxView } from '@/components/admin/InboxView';
import { loadInbox } from '@/server/crm-inbox';
import { requireStaffPage } from '@/server/staff-page';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'admin.meta' });
  return { title: `${t('inbox')} · ${t('suffix')}` };
}

/** /admin/inbox: callback requests and website contact submissions. */
export default async function InboxPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireStaffPage(locale as Locale, '/admin/inbox');
  const data = await loadInbox(await createServerSupabase());
  return <InboxView data={data} />;
}
