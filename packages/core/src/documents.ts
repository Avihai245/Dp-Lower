/** The eight document slots of a case, in display order. Titles and explanations live in i18n. */
export const DOC_TYPES = [
  'birth_certificate',
  'marriage_certificates',
  'emigration_naturalization',
  'persecution_proof',
  'passport',
  'family_tree',
  'photo_id',
  'other',
] as const;
export type DocType = (typeof DOC_TYPES)[number];
export const isDocType = (v: unknown): v is DocType => (DOC_TYPES as readonly unknown[]).includes(v);

export const DOC_STATUSES = ['missing', 'requested', 'received', 'reupload'] as const;
export type DocStatus = (typeof DOC_STATUSES)[number];

export const DOC_MAX_BYTES = 20 * 1024 * 1024;
export const DOC_ALLOWED_MIME = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/heic',
  'image/heif',
  'image/webp',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
] as const;

export const DOCS_BUCKET = 'documents';

/** Storage object path: {lead_id}/{doc_type}/{uuid}-{safe file name}. */
export function documentPath(leadId: string, docType: DocType, uuid: string, fileName: string): string {
  const safe = fileName
    .normalize('NFKD')
    .replace(/[^\w.\-]+/g, '_')
    .replace(/\.{2,}/g, '.')
    .replace(/^[._-]+|[_-]+$/g, '')
    .slice(-80);
  return `${leadId}/${docType}/${uuid}-${safe || 'file'}`;
}
