import 'server-only';
import {
  DOC_TYPES,
  QUIZ_ORDER,
  isApplicationComplete,
  isDocType,
  sectionDone,
  type DocStatus,
  type DocType,
  type LeadRoute,
  type QuizId,
} from '@dpl/core';
import type { Db } from '@dpl/db/types';
import type {
  ActivityView,
  AnswerView,
  DocView,
  InboxCounts,
  LeadDetailData,
  LeadRowData,
  NoteView,
  StaffOption,
} from '@/components/admin/types';
import { ancestorLine } from '@/components/admin/model';
import { asObject, asStringMap, fetchAll } from './crm-util';

/**
 * Read side of the CRM. Every function takes the Supabase client to read with: the signed-in staff member's own
 * client (row-level security then decides what is visible) or the service client after requireStaff().
 */

export interface RowLabels {
  /** quiz answer label for "where does the applicant live", in the page language */
  residence: (key: string) => string | null;
}

const ROW_COLUMNS =
  'id,case_ref,full_name,email,phone,locale,route,answers,stage,stage_since,status,owner_id,notes_count,next_call_at,created_at,updated_at,application_data,application_completed_at,next_action_done_at';

/** All leads, newest first, with the document and note counters the list, board and pager need. */
export async function loadLeadRows(db: Db, labels: RowLabels): Promise<LeadRowData[]> {
  const [rows, docs] = await Promise.all([
    fetchAll((from, to) =>
      db.from('admin_lead_rows').select(ROW_COLUMNS).order('created_at', { ascending: false }).order('id').range(from, to),
    ),
    fetchAll((from, to) =>
      db
        .from('documents')
        .select('lead_id,doc_type,status')
        .in('status', ['received', 'reupload'])
        .order('lead_id')
        .order('doc_type')
        .range(from, to),
    ),
  ]);

  const received = new Map<string, Set<DocType>>();
  const rejected = new Set<string>();
  for (const d of docs) {
    if (d.status === 'reupload') rejected.add(d.lead_id);
    if (d.status === 'received' && isDocType(d.doc_type)) {
      const set = received.get(d.lead_id) ?? new Set<DocType>();
      set.add(d.doc_type);
      received.set(d.lead_id, set);
    }
  }

  const out: LeadRowData[] = [];
  for (const r of rows) {
    if (!r.id || !r.stage || !r.status || !r.created_at) continue;
    const have = received.get(r.id);
    const data = asStringMap(r.application_data);
    const residence = asObject(r.answers).residence;
    out.push({
      id: r.id,
      caseRef: r.case_ref ?? '',
      fullName: r.full_name ?? '',
      email: r.email ?? '',
      phone: r.phone,
      locale: r.locale ?? 'en',
      route: r.route as LeadRoute | null,
      where: typeof residence === 'string' ? labels.residence(residence) : null,
      ancestor: ancestorLine(data),
      stage: r.stage,
      stageSince: r.stage_since ?? r.created_at,
      status: r.status,
      ownerId: r.owner_id,
      missingDocTypes: DOC_TYPES.filter((t) => !have?.has(t)),
      hasRejectedDoc: rejected.has(r.id),
      notesCount: r.notes_count ?? 0,
      createdAt: r.created_at,
      updatedAt: r.updated_at ?? r.created_at,
      nextCallAt: r.next_call_at,
      applicationComplete: isApplicationComplete(data) || r.application_completed_at != null,
      nextActionDoneAt: r.next_action_done_at,
    });
  }
  return out;
}

export async function loadStaffOptions(db: Db): Promise<StaffOption[]> {
  const { data, error } = await db.from('staff').select('user_id,full_name,role').eq('active', true).order('full_name');
  if (error) throw new Error(error.message);
  return (data ?? []).map((s) => ({ id: s.user_id, name: s.full_name, role: s.role }));
}

export async function loadInboxCounts(db: Db): Promise<InboxCounts> {
  const [cb, ct] = await Promise.all([
    db.from('callback_requests').select('id', { count: 'exact', head: true }).eq('status', 'new'),
    db.from('contact_submissions').select('id', { count: 'exact', head: true }).eq('status', 'new'),
  ]);
  return { callbacks: cb.count ?? 0, contacts: ct.count ?? 0 };
}

export interface DetailLabels extends RowLabels {
  question: (id: QuizId) => string;
  answer: (id: QuizId, key: string) => string | null;
}

/** Everything the lead page shows, in one round of parallel queries. null when the lead does not exist. */
export async function loadLeadDetail(db: Db, id: string, labels: DetailLabels): Promise<LeadDetailData | null> {
  const [lead, app, docs, notes, activity, booking] = await Promise.all([
    db.from('leads').select('*').eq('id', id).maybeSingle(),
    db.from('applications').select('*').eq('lead_id', id).maybeSingle(),
    db.from('documents').select('*').eq('lead_id', id),
    db.from('lead_notes').select('*').eq('lead_id', id).order('created_at', { ascending: false }),
    db.from('activity_log').select('*').eq('lead_id', id).order('created_at', { ascending: false }).limit(200),
    db
      .from('bookings')
      .select('starts_at,ends_at')
      .eq('lead_id', id)
      .eq('status', 'confirmed')
      .gt('starts_at', new Date().toISOString())
      .order('starts_at')
      .limit(1)
      .maybeSingle(),
  ]);
  for (const r of [lead, app, docs, notes, activity, booking]) if (r.error) throw new Error(r.error.message);
  if (!lead.data) return null;

  const l = lead.data;
  const data = asStringMap(app.data?.data);
  const byType = new Map(
    (docs.data ?? []).filter((d) => isDocType(d.doc_type)).map((d) => [d.doc_type as DocType, d] as const),
  );
  const documents: DocView[] = DOC_TYPES.map((docType) => {
    const d = byType.get(docType);
    return {
      docType,
      status: (d?.status ?? 'missing') as DocStatus,
      fileName: d?.file_name ?? null,
      hasFile: !!d?.file_path,
      reviewNote: d?.review_note ?? null,
      uploadedAt: d?.uploaded_at ?? null,
      requestedAt: d?.requested_at ?? null,
    };
  });
  const received = new Set(documents.filter((d) => d.status === 'received').map((d) => d.docType));
  const residence = asObject(l.answers).residence;
  const answers = asObject(l.answers);

  const row: LeadRowData = {
    id: l.id,
    caseRef: l.case_ref,
    fullName: l.full_name,
    email: l.email,
    phone: l.phone,
    locale: l.locale,
    route: l.route,
    where: typeof residence === 'string' ? labels.residence(residence) : null,
    ancestor: ancestorLine(data),
    stage: l.stage,
    stageSince: l.stage_since,
    status: l.status,
    ownerId: l.owner_id,
    missingDocTypes: DOC_TYPES.filter((t) => !received.has(t)),
    hasRejectedDoc: documents.some((d) => d.status === 'reupload'),
    notesCount: (notes.data ?? []).length,
    createdAt: l.created_at,
    updatedAt: l.updated_at,
    nextCallAt: booking.data?.starts_at ?? null,
    applicationComplete: isApplicationComplete(data) || app.data?.completed_at != null,
    nextActionDoneAt: l.next_action_done_at,
  };

  const sections = [0, 1, 2, 3].map((i) => sectionDone(data, i));
  sections.push(l.submitted_at != null);

  const quiz: AnswerView[] = QUIZ_ORDER.map((qid) => {
    const v = answers[qid];
    return { id: qid, question: labels.question(qid), answer: typeof v === 'string' ? labels.answer(qid, v) : null };
  });

  const noteViews: NoteView[] = (notes.data ?? []).map((n) => ({
    id: n.id,
    authorId: n.author_id,
    authorName: n.author_name,
    body: n.body,
    createdAt: n.created_at,
  }));
  const activityViews: ActivityView[] = (activity.data ?? []).map((a) => ({
    id: a.id,
    kind: a.kind === 'staff' ? 'staff' : 'system',
    code: a.code,
    text: a.text,
    actorName: a.actor_name,
    meta: asObject(a.meta),
    createdAt: a.created_at,
  }));

  return {
    lead: row,
    documents,
    sections,
    address: data.address?.trim() || null,
    answers: quiz,
    notes: noteViews,
    activity: activityViews,
    call: booking.data ? { startsAt: booking.data.starts_at, endsAt: booking.data.ends_at } : null,
  };
}
