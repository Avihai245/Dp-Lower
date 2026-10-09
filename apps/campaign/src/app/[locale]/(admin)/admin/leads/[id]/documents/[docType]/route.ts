import { DOCS_BUCKET, isDocType } from '@dpl/core';
import { createAdminSupabase } from '@dpl/db/admin';
import { ApiError, handle } from '@dpl/db/http';
import { NextResponse } from 'next/server';
import { requireStaff } from '@/server/staff';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** How long the link stays valid: just long enough for the browser to follow it. */
const LINK_SECONDS = 60;

/**
 * GET /admin/leads/[id]/documents/[docType]: the "View" action on the lead page. Staff only (checked here, not just by
 * the page). The applicant's file lives in a private bucket; this answers with a redirect to a short-lived signed URL
 * made on the server, so the bucket is never opened up and the link is useless a minute later.
 */
export const GET = handle<{ params: Promise<{ id: string; docType: string }> }>(async (_req, ctx) => {
  await requireStaff();
  const { id, docType } = await ctx.params;
  if (!UUID.test(id) || !isDocType(docType)) throw new ApiError(404, 'not_found');

  const db = createAdminSupabase();
  const { data: doc } = await db.from('documents').select('file_path').eq('lead_id', id).eq('doc_type', docType).maybeSingle();
  if (!doc?.file_path) throw new ApiError(404, 'not_found');

  const { data, error } = await db.storage.from(DOCS_BUCKET).createSignedUrl(doc.file_path, LINK_SECONDS);
  if (error || !data?.signedUrl) throw new ApiError(404, 'not_found');

  const res = NextResponse.redirect(data.signedUrl, 302);
  res.headers.set('Cache-Control', 'no-store');
  res.headers.set('Referrer-Policy', 'no-referrer');
  return res;
});
