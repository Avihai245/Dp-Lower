import { DOC_ALLOWED_MIME, DOC_MAX_BYTES } from '@dpl/core';

export type DocMime = (typeof DOC_ALLOWED_MIME)[number];

const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' as const;

const BY_EXTENSION: Record<string, DocMime> = {
  pdf: 'application/pdf',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  heic: 'image/heic',
  heif: 'image/heif',
  webp: 'image/webp',
  docx: DOCX,
};

/** The accept= value of the file inputs: extensions first (HEIC and DOCX often arrive without a MIME type), then types. */
export const FILE_ACCEPT = [
  ...Object.keys(BY_EXTENSION).map((e) => `.${e}`),
  ...DOC_ALLOWED_MIME,
].join(',');

/** accept= for the phone camera button */
export const CAMERA_ACCEPT = 'image/*';

const isAllowed = (t: string): t is DocMime => (DOC_ALLOWED_MIME as readonly string[]).includes(t);

/**
 * The MIME type to upload a file as. Browsers give HEIC, HEIF and DOCX files an empty or generic type
 * (application/octet-stream) on many systems, and the storage bucket accepts only the listed types, so fall back to the
 * file name's extension.
 */
export function resolveMimeType(file: { name: string; type: string }): DocMime | null {
  const type = (file.type ?? '').trim().toLowerCase();
  if (isAllowed(type)) return type;
  if (type === 'image/jpg' || type === 'image/pjpeg') return 'image/jpeg';
  const ext = file.name.toLowerCase().split('.').pop() ?? '';
  return BY_EXTENSION[ext] ?? null;
}

export type FileRejection = 'type' | 'size' | 'empty';

export function checkFile(file: { name: string; type: string; size: number }):
  | { ok: true; mimeType: DocMime }
  | { ok: false; reason: FileRejection } {
  if (file.size <= 0) return { ok: false, reason: 'empty' };
  const mimeType = resolveMimeType(file);
  if (!mimeType) return { ok: false, reason: 'type' };
  if (file.size > DOC_MAX_BYTES) return { ok: false, reason: 'size' };
  return { ok: true, mimeType };
}

/** The kinds of file the portal accepts, as told by their first bytes (the declared MIME type is only the browser's word). */
export type FileFamily = 'pdf' | 'jpeg' | 'png' | 'webp' | 'heic' | 'docx';

const startsWith = (b: Uint8Array, sig: readonly number[], at = 0): boolean => sig.every((v, i) => b[at + i] === v);
const ascii = (b: Uint8Array, from: number, to: number): string => String.fromCharCode(...Array.from(b.slice(from, to)));

const HEIF_BRANDS = new Set(['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis', 'hevm', 'hevs', 'mif1', 'msf1']);

/** Recognises the allowed file kinds from the first bytes of the file; null for anything else. */
export function sniffFamily(bytes: Uint8Array): FileFamily | null {
  if (bytes.length < 4) return null;
  if (startsWith(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d])) return 'pdf'; // %PDF-
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return 'jpeg';
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'png';
  if (bytes.length >= 12 && ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 12) === 'WEBP') return 'webp';
  if (bytes.length >= 12 && ascii(bytes, 4, 8) === 'ftyp' && HEIF_BRANDS.has(ascii(bytes, 8, 12))) return 'heic';
  if (startsWith(bytes, [0x50, 0x4b, 0x03, 0x04])) return 'docx'; // a zip container; a .docx is one
  return null;
}

/** The family a declared MIME type belongs to. */
export function familyOfMime(mime: string): FileFamily | null {
  switch (mime) {
    case 'application/pdf':
      return 'pdf';
    case 'image/jpeg':
      return 'jpeg';
    case 'image/png':
      return 'png';
    case 'image/webp':
      return 'webp';
    case 'image/heic':
    case 'image/heif':
      return 'heic';
    case DOCX:
      return 'docx';
    default:
      return null;
  }
}

/** The canonical MIME type for a sniffed family (HEIC keeps whichever of heic/heif the browser declared). */
export function mimeOfFamily(family: FileFamily, declared?: string): DocMime {
  switch (family) {
    case 'pdf':
      return 'application/pdf';
    case 'jpeg':
      return 'image/jpeg';
    case 'png':
      return 'image/png';
    case 'webp':
      return 'image/webp';
    case 'docx':
      return DOCX;
    case 'heic':
      return declared === 'image/heif' ? 'image/heif' : 'image/heic';
  }
}
