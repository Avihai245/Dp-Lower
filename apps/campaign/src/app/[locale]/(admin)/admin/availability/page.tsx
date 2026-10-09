import type { Locale } from '@dpl/core';
import { createServerSupabase } from '@dpl/db/server';
import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { AvailabilityView } from '@/components/admin/AvailabilityView';
import { loadAvailability } from '@/server/crm-availability';
import { requireStaffPage } from '@/server/staff-page';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'admin.meta' });
  return { title: `${t('availability')} · ${t('suffix')}` };
}

/**
 * /admin/availability: every member of staff can see the calendars (each lawyer's weekly hours and days off, the
 * unassigned template, the days closed for everyone) and the next bookings. Admins change every calendar, a lawyer only
 * their own; the controls are not rendered for anyone else, and the Server Actions refuse them.
 */
export default async function AvailabilityPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await requireStaffPage(locale as Locale, '/admin/availability');
  const data = await loadAvailability(await createServerSupabase());
  return <AvailabilityView data={data} viewer={{ id: session.actor.id, role: session.staff.role }} />;
}
