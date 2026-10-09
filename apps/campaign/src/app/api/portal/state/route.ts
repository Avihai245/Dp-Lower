import { handle, json, limitOrThrow } from '@dpl/db/http';
import { loadPortalState, requirePortalSession } from '@/server/portal';

export const dynamic = 'force-dynamic';

/** GET /api/portal/state: everything the dashboard shows, in one call (the signed-in applicant's own file only). */
export const GET = handle(async (req) => {
  await limitOrThrow(req, 'portal-state', { windowSeconds: 60, max: 300 });
  const { db, lead } = await requirePortalSession();
  return json(await loadPortalState(db, lead), { headers: { 'Cache-Control': 'no-store' } });
});
