import type { Locale, QuizId } from '@dpl/core';
import { createServerSupabase } from '@dpl/db/server';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { cache } from 'react';
import { LeadDetail } from '@/components/admin/LeadDetail';
import { loadLeadDetail } from '@/server/crm';
import { requireStaffPage } from '@/server/staff-page';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** One load per request, shared by the page and its metadata. */
const load = cache(async (locale: string, id: string) => {
  const db = await createServerSupabase();
  const funnel = await getTranslations({ locale, namespace: 'funnel' });
  const text = (path: string): string | null => (funnel.has(path) ? funnel(path) : null);
  return loadLeadDetail(db, id, {
    residence: (key) => text(`quiz.questions.residence.options.${key}`),
    question: (qid: QuizId) => text(`quiz.questions.${qid}.text`) ?? qid,
    answer: (qid: QuizId, key: string) => text(`quiz.questions.${qid}.options.${key}`),
  });
});

type Props = { params: Promise<{ locale: string; id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, id } = await params;
  const t = await getTranslations({ locale, namespace: 'admin.meta' });
  const detail = UUID.test(id) ? await load(locale, id).catch(() => null) : null;
  return { title: `${detail ? `${detail.lead.fullName} · ` : ''}${t('leads')} · ${t('suffix')}` };
}

/** /admin/leads/[id]: the lead's page. Layout has checked the session; this checks again before reading a lead. */
export default async function LeadPage({ params }: Props) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  await requireStaffPage(locale as Locale, `/admin/leads/${id}`);
  if (!UUID.test(id)) notFound();
  const detail = await load(locale, id);
  if (!detail) notFound();
  return <LeadDetail detail={detail} />;
}
