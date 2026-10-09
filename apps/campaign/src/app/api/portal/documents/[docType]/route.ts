import { isDocType } from '@dpl/core';
import { ApiError, handle, json } from '@dpl/db/http';
import { requirePortalWrite } from '@/server/portal';
import { removeDocument } from '@/server/portal-documents';

export const dynamic = 'force-dynamic';

/** DELETE /api/portal/documents/[docType]: removes the file in that slot; the slot is "missing" again. */
export const DELETE = handle<{ params: Promise<{ docType: string }> }>(async (req, { params }) => {
  const { docType } = await params;
  if (!isDocType(docType)) throw new ApiError(404, 'not_found');
  const { db, lead } = await requirePortalWrite(req, 'delete-doc', { windowSeconds: 60, max: 30 });
  await removeDocument(db, lead, docType);
  return json({ ok: true });
});
