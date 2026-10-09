import type { Locale } from '@dpl/core';
import { createServerSupabase } from '@dpl/db/server';
import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { TeamView } from '@/components/admin/TeamView';
import { loadTeam } from '@/server/crm-team';
import { requireStaffPage } from '@/server/staff-page';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'admin.meta' });
  return { title: `${t('team')} · ${t('suffix')}` };
}

/** /admin/team: admins only (everybody else gets the 404 page). */
export default async function TeamPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireStaffPage(locale as Locale, '/admin/team', { adminOnly: true });
  const team = await loadTeam(await createServerSupabase());
  return <TeamView team={team} />;
}
