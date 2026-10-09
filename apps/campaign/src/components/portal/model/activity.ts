import { isDocType, LEAD_STATUSES, type LeadStatus } from '@dpl/core';
import { APPLICANT_ACTIVITY_CODES, type ApplicantActivityCode, type PortalActivity } from './types';

export interface ActivityRowLike {
  id: string;
  code: string | null;
  created_at: string;
  meta: unknown;
}

export const isApplicantActivityCode = (code: string | null): code is ApplicantActivityCode =>
  (APPLICANT_ACTIVITY_CODES as readonly (string | null)[]).includes(code);

const asRecord = (v: unknown): Record<string, unknown> =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};

/**
 * A row of activity_log as the applicant may see it, or null when the row is not for applicants (only the codes in
 * APPLICANT_ACTIVITY_CODES are, and the text shown is localised from the code, never the English `text` column).
 *
 * status_changed carries the status that was set in meta.status (meta.to is accepted too).
 */
export function toPortalActivity(row: ActivityRowLike): PortalActivity | null {
  if (!isApplicantActivityCode(row.code)) return null;
  const meta = asRecord(row.meta);
  const base = { id: row.id, code: row.code, at: row.created_at };
  if (row.code === 'status_changed') {
    const raw = meta.status ?? meta.to;
    const status = (LEAD_STATUSES as readonly unknown[]).includes(raw) ? (raw as LeadStatus) : null;
    return status ? { ...base, status } : null;
  }
  if (row.code === 'document_uploaded') {
    return isDocType(meta.docType) ? { ...base, docType: meta.docType } : base;
  }
  return base;
}
