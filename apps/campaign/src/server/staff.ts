import 'server-only';
import { ApiError } from '@dpl/db/http';
import { createServerSupabase } from '@dpl/db/server';
import type { StaffRow } from '@dpl/db/types';
import type { User } from '@supabase/supabase-js';
import { cache } from 'react';

/**
 * Who is asking, as far as the CRM is concerned. Read through the caller's OWN Supabase session, so the `staff` row
 * is only visible when the row-level-security rule `staff_select` allows it (staff see everybody, others only
 * themselves), and `active` is checked here on top.
 *
 * Memoised per request (React cache): the layout and the page both ask, GoTrue is called once.
 * Page-level redirects live in staff-page.ts.
 */
export type StaffAccess =
  | { kind: 'anonymous' }
  | { kind: 'forbidden'; user: User }
  | { kind: 'staff'; user: User; staff: StaffRow };

export const resolveStaff = cache(async (): Promise<StaffAccess> => {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { kind: 'anonymous' };
  const { data: staff } = await supabase.from('staff').select('*').eq('user_id', user.id).maybeSingle();
  if (!staff || !staff.active) return { kind: 'forbidden', user };
  return { kind: 'staff', user, staff };
});

export interface StaffSession {
  user: User;
  staff: StaffRow;
  /** what is written to activity_log / lead_notes / handled_by */
  actor: { id: string; name: string };
}

export const toSession = (a: Extract<StaffAccess, { kind: 'staff' }>): StaffSession => ({
  user: a.user,
  staff: a.staff,
  actor: { id: a.staff.user_id, name: a.staff.full_name },
});

/**
 * First line of every Server Action and Route Handler in the CRM (never trust the page that rendered the button).
 * Throws ApiError 401 (no session) or 403 (signed in, but not an active staff member).
 */
export async function requireStaff(): Promise<StaffSession> {
  const a = await resolveStaff();
  if (a.kind === 'anonymous') throw new ApiError(401, 'unauthorized');
  if (a.kind === 'forbidden') throw new ApiError(403, 'forbidden');
  return toSession(a);
}

/** Admin-only operations: availability edits, staff management. */
export async function requireAdmin(): Promise<StaffSession> {
  const s = await requireStaff();
  if (s.staff.role !== 'admin') throw new ApiError(403, 'forbidden');
  return s;
}

/** Maps a thrown value to the error code a Server Action returns to the browser. */
export function errorCode(e: unknown): 'unauthorized' | 'forbidden' | 'internal' {
  if (e instanceof ApiError) return e.status === 401 ? 'unauthorized' : e.status === 403 ? 'forbidden' : 'internal';
  return 'internal';
}
