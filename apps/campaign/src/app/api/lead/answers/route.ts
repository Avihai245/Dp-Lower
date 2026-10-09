import { quizAnswersSchema, routeFromAnswers } from '@dpl/core';
import { createAdminSupabase } from '@dpl/db/admin';
import { ApiError, assertSameOrigin, handle, json, limitOrThrow, parseJson } from '@dpl/db/http';
import { resolveLead } from '@dpl/db/lead-session';
import { logActivity } from '@dpl/db/outbox';
import { asJson } from '@dpl/db/types';
import { z } from 'zod';
import { answersDiffer, mergeAnswers } from '@/components/funnel/logic/answers';

export const dynamic = 'force-dynamic';

const body = z.object({ answers: quizAnswersSchema });

/** Merges eligibility answers into the caller's file (the chat and the portal use it after the lead exists). */
export const PUT = handle(async (req) => {
  assertSameOrigin(req);
  await limitOrThrow(req, 'lead-answers', { windowSeconds: 60, max: 30 });
  const db = createAdminSupabase();
  const who = await resolveLead(db);
  if (!who) throw new ApiError(401, 'unauthorized');
  const { answers } = await parseJson(req, body);

  if (answersDiffer(who.lead.answers, answers)) {
    const merged = mergeAnswers(who.lead.answers, answers);
    const { error } = await db
      .from('leads')
      .update({ answers: asJson(merged), route: routeFromAnswers(merged) })
      .eq('id', who.lead.id);
    if (error) throw new Error(`answers update failed: ${error.message}`);
    await logActivity(db, { leadId: who.lead.id, code: 'answers_updated', text: 'Eligibility answers updated' });
  }
  return json({ ok: true });
});
