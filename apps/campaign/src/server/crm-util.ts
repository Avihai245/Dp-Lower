import 'server-only';
import { DOC_TYPES, isDocType, type DocType } from '@dpl/core';
import type { Db, LeadRow } from '@dpl/db/types';
import type { ActionError, ActionResult } from '@/components/admin/types';

const PAGE = 1000;

/** PostgREST returns at most 1000 rows a call: walk the pages of a deterministic query. */
export async function fetchAll<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; from < 50 * PAGE; from += PAGE) {
    const { data, error } = await page(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    out.push(...(data ?? []));
    if (!data || data.length < PAGE) break;
  }
  return out;
}

export const asStringMap = (v: unknown): Record<string, string> => {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return {};
  return Object.fromEntries(Object.entries(v).filter((e): e is [string, string] => typeof e[1] === 'string'));
};

export const asObject = (v: unknown): Record<string, unknown> =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};

export const fail = (error: ActionError, field?: string): { ok: false; error: ActionError; field?: string } => ({
  ok: false,
  error,
  field,
});
export const done = <T = void>(data?: T): ActionResult<T> => ({ ok: true, data: data as T });

export async function getLead(db: Db, id: string): Promise<LeadRow | null> {
  const { data } = await db.from('leads').select('*').eq('id', id).maybeSingle();
  return data;
}

/** The document slots of a lead that have a received file (or a paper copy marked received). */
export async function receivedDocTypes(db: Db, leadId: string): Promise<Set<DocType>> {
  const { data } = await db.from('documents').select('doc_type').eq('lead_id', leadId).eq('status', 'received');
  return new Set((data ?? []).map((d) => d.doc_type).filter(isDocType));
}

export const missingDocTypes = (received: Set<DocType>): DocType[] => DOC_TYPES.filter((t) => !received.has(t));
