import 'server-only';
import { createAdminSupabase } from '@dpl/db/admin';
import { ApiError, assertSameOrigin, limitOrThrow } from '@dpl/db/http';
import { getSessionLead } from '@dpl/db/lead-session';
import { logActivity } from '@dpl/db/outbox';
import { createServerSupabase } from '@dpl/db/server';
import type { Db, LeadRow } from '@dpl/db/types';
import { capitalizeName, firstNameOf } from '@dpl/core';
import type { NextRequest } from 'next/server';
import { cache } from 'react';
import { redirect } from '@/i18n/navigation';
import { APPLICANT_ACTIVITY_CODES, type PortalState } from '@/components/portal/model/types';
import { buildPortalState } from '@/components/portal/model/state';
import type { DetailsInput } from '@/components/portal/model/schemas';

/**
 * The portal's server core: who is asking, and what the dashboard needs. Every portal route and page starts with
 * getSessionLead(): the lead comes from the signed-in Supabase user, never from the lead cookie and never from anything
 * the client sends (docs/ARCHITECTURE.md section 7).
 */

export interface PortalContext {
  db: Db;
  lead: LeadRow;
}

/** For Server Components (memoised per request, so the layout and the page share one lookup). */
export const getPortalContext = cache(async (): Promise<PortalContext | null> => {
  const db = createAdminSupabase();
  const lead = await getSessionLead(db);
  return lead ? { db, lead } : null;
});

/**
 * For pages and layouts: the signed-in applicant, or a redirect. Layouts are not re-rendered on every navigation inside
 * their group, so every page calls this itself instead of trusting the layout. Anonymous visitors go to the sign-in page;
 * a signed-in user who has no lead (a staff member, say) goes home, which also keeps the two pages from redirecting to
 * each other.
 */
export async function requirePortalPage(locale: string): Promise<PortalContext> {
  const ctx = await getPortalContext();
  if (ctx) return ctx;
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return redirect({ href: user ? '/' : { pathname: '/sign-in', query: { next: '/portal' } }, locale });
}

/** For Route Handlers: 401 unless a Supabase session belongs to a lead. */
export async function requirePortalSession(): Promise<PortalContext> {
  const db = createAdminSupabase();
  const lead = await getSessionLead(db);
  if (!lead) throw new ApiError(401, 'unauthorized');
  return { db, lead };
}

/** A state-changing route: same-origin, then the session, then a rate limit per lead and address. */
export async function requirePortalWrite(
  req: NextRequest,
  bucket: string,
  limit: { windowSeconds: number; max: number },
): Promise<PortalContext> {
  assertSameOrigin(req);
  const ctx = await requirePortalSession();
  await limitOrThrow(req, `portal-${bucket}:${ctx.lead.id}`, limit);
  return ctx;
}

function fail(what: string, message: string): never {
  throw new Error(`portal: ${what} failed: ${message}`);
}

/** Reads everything the dashboard shows and assembles it (see buildPortalState). */
export async function loadPortalState(db: Db, lead: LeadRow): Promise<PortalState> {
  const [application, documents, booking, owner, activity] = await Promise.all([
    db.from('applications').select('data, current_section, completed_at').eq('lead_id', lead.id).maybeSingle(),
    db
      .from('documents')
      .select('doc_type, status, file_name, uploaded_at, review_note, file_size, mime_type')
      .eq('lead_id', lead.id),
    db
      .from('bookings')
      .select('id, starts_at, ends_at, timezone')
      .eq('lead_id', lead.id)
      .in('status', ['confirmed', 'completed'])
      .order('starts_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    lead.owner_id
      ? db.from('staff').select('full_name').eq('user_id', lead.owner_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    db
      .from('activity_log')
      .select('id, code, created_at, meta')
      .eq('lead_id', lead.id)
      .in('code', [...APPLICANT_ACTIVITY_CODES])
      .order('created_at', { ascending: false })
      .limit(40),
  ]);
  if (application.error) fail('reading the application', application.error.message);
  if (documents.error) fail('reading the documents', documents.error.message);
  if (booking.error) fail('reading the booking', booking.error.message);
  if (owner.error) fail('reading the case handler', owner.error.message);
  if (activity.error) fail('reading the activity', activity.error.message);

  return buildPortalState({
    lead,
    application: application.data,
    documents: documents.data ?? [],
    booking: booking.data,
    ownerName: owner.data?.full_name ?? null,
    activity: activity.data ?? [],
  });
}

/** The tour has been seen (closed or finished): it no longer starts by itself. */
export async function markTourDone(db: Db, lead: LeadRow): Promise<void> {
  if (lead.tour_done) return;
  const { error } = await db.from('leads').update({ tour_done: true }).eq('id', lead.id);
  if (error) fail('saving the tour flag', error.message);
}

/** "My details": the applicant corrects their own name and phone (the email changes only through the firm). */
export async function updateDetails(
  db: Db,
  lead: LeadRow,
  input: DetailsInput,
): Promise<{ fullName: string; firstName: string; phone: string | null }> {
  const patch: { full_name?: string; phone?: string } = {};
  if (input.fullName !== undefined) patch.full_name = capitalizeName(input.fullName);
  if (input.phone !== undefined) patch.phone = input.phone.trim();
  const { data, error } = await db.from('leads').update(patch).eq('id', lead.id).select('full_name, phone').single();
  if (error || !data) return fail('saving the details', error?.message ?? 'no row');
  await logActivity(db, {
    leadId: lead.id,
    code: 'details_updated',
    text: 'Contact details updated by the applicant',
    meta: { fields: Object.keys(patch) },
  });
  return { fullName: data.full_name, firstName: firstNameOf(data.full_name), phone: data.phone };
}
