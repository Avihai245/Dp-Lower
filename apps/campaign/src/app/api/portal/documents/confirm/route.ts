import { handle, json, parseJson } from '@dpl/db/http';
import { confirmUploadSchema } from '@/components/portal/model/schemas';
import { requirePortalWrite } from '@/server/portal';
import { confirmUpload } from '@/server/portal-documents';

export const dynamic = 'force-dynamic';

/** POST /api/portal/documents/confirm: registers an uploaded file once the server has checked it. */
export const POST = handle(async (req) => {
  const { db, lead } = await requirePortalWrite(req, 'confirm', { windowSeconds: 60, max: 40 });
  const input = await parseJson(req, confirmUploadSchema);
  const result = await confirmUpload(db, lead, input);
  return json({ ok: true, document: result.document, docsReceived: result.docsReceived });
});
