import { DOC_TYPES, nameSchema, phoneSchema } from '@dpl/core';
import { z } from 'zod';

/**
 * Request bodies of the portal API that @dpl/core does not define (it has applicationSaveSchema and
 * uploadRequestSchema). Shared by the routes and the "My details" form so both apply the same rules.
 */

/** The prototype's rule: a first and a last name. */
export const fullNameSchema = nameSchema.refine((v) => v.split(/\s+/).length >= 2, 'invalid_name');

/** PATCH /api/portal/details: name and phone are editable; the email is not (changing it needs verification). */
export const detailsSchema = z
  .object({
    fullName: fullNameSchema.optional(),
    phone: phoneSchema.optional(),
  })
  .refine((d) => d.fullName !== undefined || d.phone !== undefined, 'nothing_to_update');
export type DetailsInput = z.infer<typeof detailsSchema>;

/** POST /api/portal/documents/confirm. `fileName` is the original name, which the sanitised storage path cannot carry. */
export const confirmUploadSchema = z.object({
  docType: z.enum(DOC_TYPES),
  path: z.string().min(10).max(300),
  fileName: z.string().max(180).optional(),
});
export type ConfirmUploadInput = z.infer<typeof confirmUploadSchema>;

/** Control characters, line/paragraph separators and the bidi overrides used to disguise a file's real extension. */
function isUnsafeChar(code: number): boolean {
  return (
    code < 0x20 ||
    code === 0x7f ||
    code === 0x2028 ||
    code === 0x2029 ||
    (code >= 0x202a && code <= 0x202e) ||
    (code >= 0x2066 && code <= 0x2069)
  );
}

/** Display name for a stored file: no control characters or path separators, one line, at most 180 characters. */
export function cleanFileName(raw: string | undefined | null, fallback: string): string {
  const cleaned = Array.from(raw ?? '', (ch) => (isUnsafeChar(ch.codePointAt(0) ?? 0) ? ' ' : ch))
    .join('')
    .replace(/[\\/]+/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 180);
  return cleaned || fallback;
}
