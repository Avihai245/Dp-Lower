import type { Locale } from '@dpl/core';
import { createAdminSupabase } from '@dpl/db/admin';
import { resolveLead } from '@dpl/db/lead-session';
import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { LeadForm } from '@/components/funnel/LeadForm';
import { pageMetadata } from '@/lib/seo';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'funnel' });
  return pageMetadata({ locale: locale as Locale, path: '/details', title: t('meta.details.title'), description: t('meta.details.description'), noindex: true });
}

/**
 * A browser that already holds a lead (it came back, or pressed Back from the booking) sees its details filled in.
 * Reading the lead cookie here, on the server, avoids a failing request from visitors who have none yet.
 */
export default async function DetailsPage({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale);
  const who = await resolveLead(createAdminSupabase());
  return <LeadForm initialLead={who ? { fullName: who.lead.full_name, email: who.lead.email, phone: who.lead.phone ?? '' } : null} />;
}
