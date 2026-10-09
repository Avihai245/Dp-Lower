import type { DocStatus } from '@dpl/core';
import type { PortalDocument } from './types';

/**
 * How one document slot looks: the prototype's `empty`, `uploading`, `uploaded` and `error` states, plus `requested`
 * (the firm asked for the record) and `failed` (this browser's upload did not work; nothing is wrong with the file on
 * record). A live upload in this browser wins over what the server holds, so a replacement shows its progress.
 */
export type SlotVisual = 'empty' | 'requested' | 'uploading' | 'uploaded' | 'error' | 'failed';

export type LocalUpload = 'uploading' | 'failed' | undefined;

export function slotVisual(status: DocStatus, upload: LocalUpload): SlotVisual {
  if (upload) return upload;
  switch (status) {
    case 'received':
      return 'uploaded';
    case 'reupload':
      return 'error';
    case 'requested':
      return 'requested';
    default:
      return 'empty';
  }
}

/**
 * "Not yet sent" and "Received": a slot is received when the server holds an accepted file, even while a replacement is
 * on its way (it moves back to "Not yet sent" only if the team asks for a new copy).
 */
export function splitSlots<T extends Pick<PortalDocument, 'status'>>(docs: T[]): { todo: T[]; got: T[] } {
  return { todo: docs.filter((d) => d.status !== 'received'), got: docs.filter((d) => d.status === 'received') };
}

/** Milliseconds the progress bar takes to crawl towards done: longer for bigger files (storage reports no progress). */
export function crawlDuration(bytes: number): number {
  return Math.round(Math.min(60_000, Math.max(3200, bytes / 250)));
}
