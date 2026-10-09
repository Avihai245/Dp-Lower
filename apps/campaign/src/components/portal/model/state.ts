import {
  APPLICATION_FIELD_IDS,
  DOC_TYPES,
  firstNameOf,
  isApplicationComplete,
  sectionsDone as countSectionsDone,
  type ApplicationData,
  type DocType,
} from '@dpl/core';
import type { ApplicationRow, BookingRow, DocumentRow, LeadRow } from '@dpl/db/types';
import { toPortalActivity, type ActivityRowLike } from './activity';
import { applicationPercent, portalPercent, SECTIONS_TOTAL } from './progress';
import { buildStatusSteps, buildTimeline } from './timeline';
import type { PortalApplication, PortalDocument, PortalState } from './types';

/** How many entries "Case activity" shows. */
export const ACTIVITY_LIMIT = 8;

export interface PortalRows {
  lead: LeadRow;
  application: Pick<ApplicationRow, 'data' | 'current_section' | 'completed_at'> | null;
  documents: Array<
    Pick<DocumentRow, 'doc_type' | 'status' | 'file_name' | 'uploaded_at' | 'review_note' | 'file_size' | 'mime_type'>
  >;
  booking: Pick<BookingRow, 'id' | 'starts_at' | 'ends_at' | 'timezone'> | null;
  ownerName: string | null;
  activity: ActivityRowLike[];
}

/** applications.data as the known string fields only (anything else in the jsonb is ignored). */
export function cleanApplicationData(raw: unknown): ApplicationData {
  const out: ApplicationData = {};
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const record = raw as Record<string, unknown>;
    for (const id of APPLICATION_FIELD_IDS) {
      const v = record[id];
      if (typeof v === 'string') out[id] = v;
    }
  }
  return out;
}

export function toPortalApplication(row: PortalRows['application']): PortalApplication | null {
  if (!row) return null;
  const data = cleanApplicationData(row.data);
  return {
    data,
    currentSection: Math.max(0, Math.min(4, row.current_section ?? 0)),
    completedAt: row.completed_at,
    sectionsDone: countSectionsDone(data),
    complete: isApplicationComplete(data),
  };
}

/** One entry per slot in DOC_TYPES order; slots without a row are "missing". */
export function toPortalDocuments(rows: PortalRows['documents']): PortalDocument[] {
  const byType = new Map(rows.map((r) => [r.doc_type, r]));
  return DOC_TYPES.map((docType: DocType) => {
    const r = byType.get(docType);
    return {
      docType,
      status: r?.status ?? 'missing',
      fileName: r?.file_name ?? null,
      uploadedAt: r?.uploaded_at ?? null,
      reviewNote: r?.review_note ?? null,
      size: r?.file_size ?? null,
      mimeType: r?.mime_type ?? null,
    };
  });
}

/** Everything the dashboard needs, from the rows the server read. Pure, so it is tested without a database. */
export function buildPortalState(rows: PortalRows): PortalState {
  const { lead } = rows;
  const application = toPortalApplication(rows.application);
  const documents = toPortalDocuments(rows.documents);
  const docsReceived = documents.filter((d) => d.status === 'received').length;
  const docsTotal = documents.length;
  const sectionsDone = application?.sectionsDone ?? 0;
  const applicationComplete = application?.complete ?? false;
  const lastUploadAt =
    documents
      .filter((d) => d.status === 'received' && d.uploadedAt)
      .map((d) => d.uploadedAt as string)
      .sort()
      .at(-1) ?? null;

  const booking = rows.booking
    ? { id: rows.booking.id, startsAt: rows.booking.starts_at, endsAt: rows.booking.ends_at, timezone: rows.booking.timezone }
    : null;

  return {
    lead: {
      caseRef: lead.case_ref,
      fullName: lead.full_name,
      firstName: firstNameOf(lead.full_name),
      email: lead.email,
      phone: lead.phone,
      locale: lead.locale,
      route: lead.route,
      stage: lead.stage,
      status: lead.status,
      accountCreated: !!lead.account_created_at,
      passwordSet: !!lead.password_set_at,
      emailVerified: !!lead.email_verified_at,
      tourDone: lead.tour_done,
      createdAt: lead.created_at,
      applicationStartedAt: lead.application_started_at,
      submittedAt: lead.submitted_at,
    },
    application,
    documents,
    booking,
    caseHandler: rows.ownerName ? { name: rows.ownerName } : null,
    activity: rows.activity
      .map(toPortalActivity)
      .filter((a): a is NonNullable<typeof a> => a !== null)
      .slice(0, ACTIVITY_LIMIT),
    timeline: buildTimeline({
      sectionsDone,
      sectionsTotal: SECTIONS_TOTAL,
      applicationComplete,
      docsReceived,
      docsTotal,
      submittedAt: lead.submitted_at,
      status: lead.status,
      booking: booking ? { startsAt: booking.startsAt, timezone: booking.timezone } : null,
    }),
    statusSteps: buildStatusSteps({
      stage: lead.stage,
      createdAt: lead.created_at,
      submittedAt: lead.submitted_at,
      docsReceived,
      docsTotal,
      lastUploadAt,
    }),
    progress: {
      percent: portalPercent(sectionsDone, docsReceived, docsTotal),
      applicationPercent: applicationPercent(sectionsDone),
      sectionsDone,
      sectionsTotal: SECTIONS_TOTAL,
      docsReceived,
      docsTotal,
    },
  };
}
