import 'server-only';
import {
  DOC_MAX_BYTES,
  DOC_TYPES,
  DOCS_BUCKET,
  documentPath,
  type DocType,
  type UploadRequest,
} from '@dpl/core';
import { ApiError } from '@dpl/db/http';
import { enqueueEvent, leadSnapshot, logActivity } from '@dpl/db/outbox';
import type { Db, DocumentRow, LeadRow } from '@dpl/db/types';
import { randomUUID } from 'node:crypto';
import { mimeOfFamily, sniffFamily } from '@/components/portal/model/file-types';
import { cleanFileName, type ConfirmUploadInput } from '@/components/portal/model/schemas';
import { toPortalDocuments } from '@/components/portal/model/state';
import type { PortalDocument } from '@/components/portal/model/types';
import en from '../../messages/en/portal.json';

/**
 * Documents. The browser never talks to storage on its own authority: the server builds the object path from the
 * signed-in lead's id, hands out a one-shot signed upload URL for exactly that path, and registers the file only after it
 * has checked the object (exists, size, real file type). Applicants never receive download links, only names and states.
 */

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
/** unconfirmed objects tolerated in one slot's folder before the stale ones are swept (cancelled or abandoned uploads) */
const ORPHAN_LIMIT = 3;
/** how many leading bytes are read to recognise the kind of file */
const HEAD_BYTES = 32;

function fail(what: string, message: string): never {
  throw new Error(`portal: ${what} failed: ${message}`);
}

const folderOf = (leadId: string, docType: DocType): string => `${leadId}/${docType}`;

/** Is `path` exactly what documentPath() produces for this lead and slot? (Rejects other leads' folders and traversal.) */
export function isOwnDocumentPath(leadId: string, docType: DocType, path: string): boolean {
  return new RegExp(`^${leadId}/${docType}/${UUID}-[\\w.\\-]{1,80}$`).test(path);
}

/** Objects currently stored in a slot's folder, as full paths. */
async function listSlot(db: Db, leadId: string, docType: DocType): Promise<string[]> {
  const folder = folderOf(leadId, docType);
  const { data, error } = await db.storage.from(DOCS_BUCKET).list(folder, { limit: 100 });
  if (error) fail('listing the documents', error.message);
  return (data ?? []).filter((o) => o.id).map((o) => `${folder}/${o.name}`);
}

async function removeObjects(db: Db, paths: string[]): Promise<void> {
  if (paths.length === 0) return;
  const { error } = await db.storage.from(DOCS_BUCKET).remove(paths);
  if (error) console.error('[portal] removing files failed', error.message);
}

/** Sweeps what earlier cancelled or abandoned uploads left behind, keeping the registered file. */
async function pruneOrphans(db: Db, leadId: string, docType: DocType): Promise<void> {
  const objects = await listSlot(db, leadId, docType);
  if (objects.length <= ORPHAN_LIMIT) return;
  const { data: row } = await db
    .from('documents')
    .select('file_path')
    .eq('lead_id', leadId)
    .eq('doc_type', docType)
    .maybeSingle();
  await removeObjects(
    db,
    objects.filter((p) => p !== row?.file_path),
  );
}

export interface UploadUrl {
  uploadUrl: string;
  token: string;
  path: string;
}

/** POST /api/portal/documents/upload-url: a signed upload URL for a new object in this lead's own slot folder. */
export async function createUploadUrl(db: Db, lead: LeadRow, request: UploadRequest): Promise<UploadUrl> {
  await pruneOrphans(db, lead.id, request.docType);
  const path = documentPath(lead.id, request.docType, randomUUID(), request.fileName);
  const { data, error } = await db.storage.from(DOCS_BUCKET).createSignedUploadUrl(path);
  if (error || !data) {
    console.error('[portal] createSignedUploadUrl failed', error?.message);
    throw new ApiError(502, 'storage_unavailable');
  }
  return { uploadUrl: data.signedUrl, token: data.token, path };
}

/**
 * The first bytes of an object, read through a short-lived signed URL with a Range request, so the file is not
 * downloaded. (The stream is not cancelled: cancelling a body that Next's patched fetch has split in two waits until
 * the connection closes. A 206 answer is tiny and is read whole.)
 */
async function readHead(db: Db, path: string): Promise<Uint8Array | null> {
  const { data, error } = await db.storage.from(DOCS_BUCKET).createSignedUrl(path, 60);
  if (error || !data) return null;
  try {
    const res = await fetch(data.signedUrl, { headers: { Range: `bytes=0-${HEAD_BYTES - 1}` }, cache: 'no-store' });
    if (res.status === 206) return new Uint8Array(await res.arrayBuffer()).slice(0, HEAD_BYTES);
    if (res.status !== 200 || !res.body) return null;
    // storage ignored the Range header and is sending the whole file: take the first chunk and walk away from the rest
    const reader = res.body.getReader();
    const { value } = await reader.read();
    void reader.cancel().catch(() => undefined);
    return value ? value.slice(0, HEAD_BYTES) : null;
  } catch {
    return null;
  }
}

const enTitle = (docType: DocType): string => en.documents.slots[docType].title;

export interface ConfirmResult {
  document: PortalDocument;
  docsReceived: number;
}

/**
 * POST /api/portal/documents/confirm: the browser says it has uploaded `path`. The slot is only marked received after
 * the object is found in storage, is within the size limit and really is one of the accepted kinds of file (its first
 * bytes are checked: the declared type is only the browser's word). An older file in the slot is removed.
 */
export async function confirmUpload(db: Db, lead: LeadRow, input: ConfirmUploadInput): Promise<ConfirmResult> {
  const { docType, path } = input;
  if (!isOwnDocumentPath(lead.id, docType, path)) throw new ApiError(400, 'invalid_path');

  const storage = db.storage.from(DOCS_BUCKET);
  const { data: info, error } = await storage.info(path);
  if (error || !info) throw new ApiError(409, 'upload_missing');

  const size = Number(info.size ?? 0);
  if (!Number.isFinite(size) || size <= 0 || size > DOC_MAX_BYTES) {
    await removeObjects(db, [path]);
    throw new ApiError(400, 'invalid_file');
  }
  const head = await readHead(db, path);
  if (!head) throw new ApiError(502, 'verify_failed');
  const family = sniffFamily(head);
  if (!family) {
    await removeObjects(db, [path]);
    throw new ApiError(400, 'invalid_file_type');
  }
  const mimeType = mimeOfFamily(family, info.contentType);
  const stored = path.split('/')[2] as string; // {uuid}-{safe name}
  const uuid = stored.slice(0, 36);
  const fileName = cleanFileName(input.fileName, stored.slice(37));

  const { data: row, error: upsertError } = await db
    .from('documents')
    .upsert(
      {
        lead_id: lead.id,
        doc_type: docType,
        status: 'received',
        file_name: fileName,
        file_path: path,
        file_size: size,
        mime_type: mimeType,
        uploaded_at: new Date().toISOString(),
        review_note: null,
        reviewed_at: null,
        reviewed_by: null,
      },
      { onConflict: 'lead_id,doc_type' },
    )
    .select('*')
    .single();
  if (upsertError || !row) fail('registering the document', upsertError?.message ?? 'no row');

  // replace: whatever else is in the slot (the old file, abandoned uploads) goes
  const others = (await listSlot(db, lead.id, docType)).filter((p) => p !== path);
  await removeObjects(db, others);

  const { count } = await db
    .from('documents')
    .select('id', { count: 'exact', head: true })
    .eq('lead_id', lead.id)
    .eq('status', 'received');
  const docsReceived = count ?? 0;

  await logActivity(db, {
    leadId: lead.id,
    code: 'document_uploaded',
    text: `Document uploaded: ${enTitle(docType)}`,
    meta: { docType, fileName, size, replaced: others.length > 0 },
  });
  await enqueueEvent(db, {
    type: 'document.uploaded',
    leadId: lead.id,
    payload: {
      lead: leadSnapshot(lead),
      docType,
      fileName,
      size,
      mimeType,
      docsReceived,
      docsTotal: DOC_TYPES.length,
    },
    dedupeKey: `document.uploaded:${lead.id}:${docType}:${uuid}`,
  });

  const document = toPortalDocuments([row as DocumentRow]).find((d) => d.docType === docType) as PortalDocument;
  return { document, docsReceived };
}

/** DELETE /api/portal/documents/[docType]: removes the file(s) of a slot; the slot is "missing" again. */
export async function removeDocument(db: Db, lead: LeadRow, docType: DocType): Promise<void> {
  await removeObjects(db, await listSlot(db, lead.id, docType));
  const { data, error } = await db
    .from('documents')
    .update({
      status: 'missing',
      file_name: null,
      file_path: null,
      file_size: null,
      mime_type: null,
      uploaded_at: null,
      review_note: null,
      reviewed_at: null,
      reviewed_by: null,
    })
    .eq('lead_id', lead.id)
    .eq('doc_type', docType)
    .not('file_path', 'is', null)
    .select('id');
  if (error) fail('removing the document', error.message);
  if ((data?.length ?? 0) > 0) {
    await logActivity(db, {
      leadId: lead.id,
      code: 'document_removed',
      text: `Document removed by the applicant: ${enTitle(docType)}`,
      meta: { docType },
    });
  }
}
