import { handle, json } from '@dpl/db/http';
import { requirePortalWrite } from '@/server/portal';
import { submitApplication } from '@/server/portal-application';

export const dynamic = 'force-dynamic';

/** POST /api/portal/submit: sends the finished application to the firm (once; repeating it changes nothing). */
export const POST = handle(async (req) => {
  const { db, lead } = await requirePortalWrite(req, 'submit', { windowSeconds: 60, max: 10 });
  const result = await submitApplication(db, lead);
  return json({ ok: true, submittedAt: result.submittedAt, alreadySubmitted: result.alreadySubmitted });
});
