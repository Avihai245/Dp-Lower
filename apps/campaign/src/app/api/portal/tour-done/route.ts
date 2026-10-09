import { handle, json } from '@dpl/db/http';
import { markTourDone, requirePortalWrite } from '@/server/portal';

export const dynamic = 'force-dynamic';

/** POST /api/portal/tour-done: the guided tour was closed or finished, so it does not start by itself again. */
export const POST = handle(async (req) => {
  const { db, lead } = await requirePortalWrite(req, 'tour-done', { windowSeconds: 60, max: 20 });
  await markTourDone(db, lead);
  return json({ ok: true });
});
