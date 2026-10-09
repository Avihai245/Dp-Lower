import { handle, json, parseJson } from '@dpl/db/http';
import { detailsSchema } from '@/components/portal/model/schemas';
import { requirePortalWrite, updateDetails } from '@/server/portal';

export const dynamic = 'force-dynamic';

/** PATCH /api/portal/details: "My details". Name and phone only; the email is changed through the firm. */
export const PATCH = handle(async (req) => {
  const { db, lead } = await requirePortalWrite(req, 'details', { windowSeconds: 60, max: 20 });
  const input = await parseJson(req, detailsSchema);
  return json({ ok: true, lead: await updateDetails(db, lead, input) });
});
