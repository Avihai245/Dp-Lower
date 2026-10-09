import { uploadRequestSchema } from '@dpl/core';
import { handle, json, parseJson } from '@dpl/db/http';
import { requirePortalWrite } from '@/server/portal';
import { createUploadUrl } from '@/server/portal-documents';

export const dynamic = 'force-dynamic';

/** POST /api/portal/documents/upload-url: a signed upload URL for one file in the applicant's own folder. */
export const POST = handle(async (req) => {
  const { db, lead } = await requirePortalWrite(req, 'upload-url', { windowSeconds: 60, max: 40 });
  const input = await parseJson(req, uploadRequestSchema);
  return json(await createUploadUrl(db, lead, input));
});
