'use client';
import { DOCS_BUCKET, type DocType } from '@dpl/core';
import { createBrowserSupabase } from '@dpl/db/browser';
import { useCallback, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { checkFile, type FileRejection } from './model/file-types';
import type { PortalDocument } from './model/types';

export type FailureReason = FileRejection | 'network' | 'rejected';

export type SlotUpload =
  | { phase: 'uploading'; fileName: string; size: number }
  | {
      phase: 'failed';
      fileName: string;
      reason: FailureReason;
      /** kept for a retry when the file itself was fine (a dropped connection); null when another file has to be chosen */
      file: File | null;
    };

interface UploadUrl {
  uploadUrl: string;
  token: string;
  path: string;
}

/**
 * The browser side of a document upload, the three steps of the contract:
 *   1. POST /api/portal/documents/upload-url  -> a signed URL for a path the server built from the applicant's own id
 *   2. uploadToSignedUrl(path, token, file)   -> the bytes go straight to Supabase Storage
 *   3. POST /api/portal/documents/confirm     -> the server checks the object and registers the file
 * One upload per slot at a time. "Cancel" stops waiting: storage gives no way to abort, so a file that was already on its
 * way is simply never confirmed (the server sweeps such leftovers on the next upload to the slot).
 */
export function useDocumentUploads(initial: PortalDocument[]) {
  const [docs, setDocs] = useState<PortalDocument[]>(initial);
  const [uploads, setUploads] = useState<Partial<Record<DocType, SlotUpload>>>({});
  const [announcement, setAnnouncement] = useState('');
  const sequence = useRef(0);
  const current = useRef<Partial<Record<DocType, number>>>({});

  const setUpload = useCallback((docType: DocType, value: SlotUpload | undefined) => {
    setUploads((prev) => {
      const next = { ...prev };
      if (value) next[docType] = value;
      else delete next[docType];
      return next;
    });
  }, []);

  const start = useCallback(
    async (docType: DocType, file: File): Promise<void> => {
      const check = checkFile(file);
      if (!check.ok) {
        setUpload(docType, { phase: 'failed', fileName: file.name, reason: check.reason, file: null });
        return;
      }
      const id = ++sequence.current;
      current.current[docType] = id;
      const alive = () => current.current[docType] === id;
      const fail = (reason: FailureReason) => {
        if (!alive()) return;
        delete current.current[docType];
        setUpload(docType, { phase: 'failed', fileName: file.name, reason, file: reason === 'rejected' ? null : file });
      };
      setUpload(docType, { phase: 'uploading', fileName: file.name, size: file.size });

      const url = await api<UploadUrl>('/api/portal/documents/upload-url', {
        method: 'POST',
        body: { docType, fileName: file.name, mimeType: check.mimeType, size: file.size },
      });
      if (!alive()) return;
      if (!url.ok || !url.data) return fail(url.status === 400 ? 'rejected' : 'network');

      try {
        // a File with the type the server was told: browsers leave HEIC and DOCX files without one, and storage refuses those
        const body = new File([file], file.name, { type: check.mimeType });
        const { error } = await createBrowserSupabase().storage.from(DOCS_BUCKET).uploadToSignedUrl(url.data.path, url.data.token, body, {
          contentType: check.mimeType,
        });
        if (!alive()) return;
        if (error) {
          const status = (error as { status?: number; statusCode?: number | string }).status ?? Number((error as { statusCode?: string }).statusCode);
          return fail(status >= 400 && status < 500 ? 'rejected' : 'network');
        }
      } catch {
        return fail('network');
      }

      const confirmed = await api<{ document: PortalDocument }>('/api/portal/documents/confirm', {
        method: 'POST',
        body: { docType, path: url.data.path, fileName: file.name },
      });
      if (confirmed.ok && confirmed.data) {
        // the server holds the file now, whatever happened to the person's patience meanwhile
        const saved = confirmed.data.document;
        setDocs((prev) => prev.map((d) => (d.docType === docType ? saved : d)));
        if (alive()) {
          delete current.current[docType];
          setUpload(docType, undefined);
        }
        setAnnouncement(`${saved.fileName ?? file.name}`);
        return;
      }
      if (!alive()) return;
      fail(confirmed.status === 400 ? 'rejected' : 'network');
    },
    [setUpload],
  );

  /** Stops waiting for an upload (and forgets a failed one). */
  const cancel = useCallback(
    (docType: DocType) => {
      delete current.current[docType];
      setUpload(docType, undefined);
    },
    [setUpload],
  );

  return { docs, uploads, start, cancel, announcement };
}
