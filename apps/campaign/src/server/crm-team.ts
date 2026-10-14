import 'server-only';
import type { Locale } from '@dpl/core';
import { campaignUrl } from '@dpl/db/links';
import type { Db } from '@dpl/db/types';
import { randomBytes, randomUUID } from 'node:crypto';
import type { ActionResult, StaffView } from '@/components/admin/types';
import { queueStaffReset } from './auth';
import { buildResetUrl } from './crm-links';
import { done, fail } from './crm-util';

const randomPassword = () => randomBytes(24).toString('base64url');

export async function loadTeam(db: Db): Promise<StaffView[]> {
  const { data, error } = await db.from('staff').select('*').order('created_at');
  if (error) throw new Error(error.message);
  return (data ?? []).map((s) => ({
    id: s.user_id,
    name: s.full_name,
    email: s.email,
    role: s.role,
    active: s.active,
    createdAt: s.created_at,
  }));
}

/** Role and active flag of a staff member (admins only). The firm can never be left without an active admin. */
export async function updateStaff(
  db: Db,
  a: { userId: string; role: 'admin' | 'lawyer' | 'case_manager'; active: boolean },
): Promise<ActionResult> {
  const { data: target } = await db.from('staff').select('user_id,role,active').eq('user_id', a.userId).maybeSingle();
  if (!target) return fail('not_found');

  const staysAdmin = a.role === 'admin' && a.active;
  if (!staysAdmin && target.role === 'admin' && target.active) {
    const { count } = await db
      .from('staff')
      .select('user_id', { count: 'exact', head: true })
      .eq('role', 'admin')
      .eq('active', true)
      .neq('user_id', a.userId);
    if (!count) return fail('conflict');
  }
  const { error } = await db.from('staff').update({ role: a.role, active: a.active }).eq('user_id', a.userId);
  return error ? fail('internal') : done();
}

/**
 * Admins only: invites a new staff member by email. Creates their Supabase account if none exists yet; for an
 * existing non-staff account (say, a former applicant's) the password is reset and its sessions revoked first, the
 * same safeguard the bootstrap script uses, so staff access can never be claimed by whoever merely guesses an email
 * address that already has an account. A "set your password" link is emailed to them; nobody here ever sees or sets
 * their password. The account and the staff row are saved even if the invite email itself fails to send.
 */
export async function inviteStaff(
  db: Db,
  a: { email: string; fullName: string; role: 'admin' | 'lawyer' | 'case_manager'; locale: Locale },
): Promise<ActionResult> {
  const email = a.email.toLowerCase();
  const fullName = a.fullName.trim();

  let userId = ((await db.rpc('auth_user_id_by_email', { p_email: email })).data as string | null) ?? null;

  if (userId) {
    const { data: already } = await db.from('staff').select('user_id').eq('user_id', userId).maybeSingle();
    if (already) return fail('duplicate');
    // independent of each other: both only need the existing user id, so they go together, not one after the other
    const [{ error }] = await Promise.all([
      db.auth.admin.updateUserById(userId, { password: randomPassword(), email_confirm: true }),
      db.rpc('revoke_user_sessions', { p_user: userId }),
    ]);
    if (error) return fail('internal');
  } else {
    const { data } = await db.auth.admin.createUser({
      email,
      password: randomPassword(),
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });
    if (data?.user) {
      userId = data.user.id;
    } else {
      // a concurrent invite created it a moment ago: that one is the account to use
      userId = ((await db.rpc('auth_user_id_by_email', { p_email: email })).data as string | null) ?? null;
      if (!userId) return fail('internal');
    }
  }

  const uid = userId;
  // the staff row and the invite email are independent of each other too: run them together
  const [{ error: upsertError }] = await Promise.all([
    db.from('staff').upsert({ user_id: uid, full_name: fullName, email, role: a.role, active: true }, { onConflict: 'user_id' }),
    sendInviteEmail(db, { uid, email, locale: a.locale }),
  ]);
  if (upsertError) return fail('internal');

  return done();
}

/** Best-effort: the account and the role above are saved regardless of whether this succeeds. */
async function sendInviteEmail(db: Db, a: { uid: string; email: string; locale: Locale }): Promise<void> {
  try {
    const { data, error } = await db.auth.admin.generateLink({ type: 'recovery', email: a.email });
    const tokenHash = data?.properties?.hashed_token;
    if (error || !tokenHash) throw new Error(`generateLink failed: ${error?.message ?? 'no token'}`);
    const resetUrl = buildResetUrl(campaignUrl('/auth/callback', a.locale), tokenHash);
    await queueStaffReset(db, { email: a.email, userId: a.uid, locale: a.locale, resetUrl, dedupeKey: `staff-invite:${a.uid}:${randomUUID()}` });
  } catch (e) {
    console.error('[crm-team] inviteStaff: sending the invite email failed', e);
  }
}
