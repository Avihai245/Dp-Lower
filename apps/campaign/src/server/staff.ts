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
 * Two-step verification: an active staff member who has enrolled an authenticator app (a verified TOTP factor) is only
 * `staff` once the session has passed the second step (assurance level aal2); until then the answer is `second-step` with
 * step `verify`. With STAFF_MFA_REQUIRED on, staff who have not enrolled yet get step `enroll`. The database applies the
 * same rule to its own staff checks (migration 20261019000001), so a password alone does not open the Data API either.
 *
 * Memoised per request (React cache): the layout and the page both ask, GoTrue is called once.
 * Page-level redirects live in staff-page.ts.
 */
export type StaffAccess =
  | { kind: 'anonymous' }
  | { kind: 'forbidden'; user: User }
  | { kind: 'second-step'; user: User; staff: StaffRow; step: 'verify' | 'enroll' }
  | { kind: 'staff'; user: User; staff: StaffRow };

/** The firm can insist that every staff member protects the account with an authenticator app (STAFF_MFA_REQUIRED=1). */
export const secondStepRequired = (): boolean => ['1', 'true', 'yes'].includes((process.env.STAFF_MFA_REQUIRED ?? '').trim().toLowerCase());

/** Has this user finished enrolling an authenticator app? (An enrolment that was never confirmed protects nothing.) */
export const hasVerifiedTotp = (user: User): boolean => (user.factors ?? []).some((f) => f.factor_type === 'totp' && f.status === 'verified');

export const resolveStaff = cache(async (): Promise<StaffAccess> => {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { kind: 'anonymous' };
  const { data: staff } = await supabase.from('staff').select('*').eq('user_id', user.id).maybeSingle();
  if (!staff || !staff.active) return { kind: 'forbidden', user };
  if (hasVerifiedTotp(user)) {
    const { data: level } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (level?.currentLevel !== 'aal2') return { kind: 'second-step', user, staff, step: 'verify' };
  } else if (secondStepRequired()) {
    return { kind: 'second-step', user, staff, step: 'enroll' };
  }
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
 * Throws ApiError 401 (no session) or 403 (signed in, but not an active staff member, or the second step not done yet).
 */
export async function requireStaff(): Promise<StaffSession> {
  const a = await resolveStaff();
  if (a.kind === 'anonymous') throw new ApiError(401, 'unauthorized');
  if (a.kind === 'forbidden') throw new ApiError(403, 'forbidden');
  // signed in with a password, the second step still to do: nothing in the CRM answers yet
  if (a.kind === 'second-step') throw new ApiError(403, 'second_step_required');
  return toSession(a);
}

/** Admin-only operations: availability edits, staff management. */
export async function requireAdmin(): Promise<StaffSession> {
  const s = await requireStaff();
  if (s.staff.role !== 'admin') throw new ApiError(403, 'forbidden');
  return s;
}

/**
 * Availability edits: admins (every calendar) and lawyers (their own hours and days off only; each Server Action checks
 * the calendar of the row it changes, see crm-availability.ts). Case managers read.
 */
export async function requireCalendarEditor(): Promise<StaffSession> {
  const s = await requireStaff();
  if (s.staff.role !== 'admin' && s.staff.role !== 'lawyer') throw new ApiError(403, 'forbidden');
  return s;
}

/** Maps a thrown value to the error code a Server Action returns to the browser. */
export function errorCode(e: unknown): 'unauthorized' | 'forbidden' | 'internal' {
  if (e instanceof ApiError) return e.status === 401 ? 'unauthorized' : e.status === 403 ? 'forbidden' : 'internal';
  return 'internal';
}
