import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ApplicationEditor } from '@/components/portal/ApplicationEditor';
import { redirect } from '@/i18n/navigation';
import { loadPortalState, requirePortalPage } from '@/server/portal';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'portal.meta' });
  return { title: t('application') };
}

/** /portal/application: the five sections, resumed where the applicant left off. Closed once the application is with the firm. */
export default async function ApplicationPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { db, lead } = await requirePortalPage(locale);
  if (lead.submitted_at) redirect({ href: '/portal', locale });
  return <ApplicationEditor initial={await loadPortalState(db, lead)} />;
}
