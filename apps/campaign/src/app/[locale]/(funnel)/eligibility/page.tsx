import type { Locale } from '@dpl/core';
import { createAdminSupabase } from '@dpl/db/admin';
import { resolveLead } from '@dpl/db/lead-session';
import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { EligibilityQuiz } from '@/components/funnel/EligibilityQuiz';
import { cleanAnswers } from '@/components/funnel/logic/answers';
import { pageMetadata } from '@/lib/seo';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'funnel' });
  return pageMetadata({ locale: locale as Locale, path: '/eligibility', title: t('meta.eligibility.title'), description: t('meta.eligibility.description'), noindex: true });
}

/**
 * A browser that already holds a lead continues from the answers on the file (also on a computer where the draft was
 * cleared), and its changes are saved to the file as they are made. Reading the lead cookie here, on the server, spares
 * visitors who have none a failing request.
 */
export default async function EligibilityPage({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale);
  const who = await resolveLead(createAdminSupabase());
  return <EligibilityQuiz savedAnswers={who ? cleanAnswers(who.lead.answers) : null} />;
}
