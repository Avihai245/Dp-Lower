import 'server-only';
import { campaignUrl } from '@dpl/db/links';
import { AccountEmailInUse, ensureAuthUser } from '@dpl/db/portal-session';
import { cancelPendingEmails, logActivity } from '@dpl/db/outbox';
import { rateLimit } from '@dpl/db/rate-limit';
import type { Db } from '@dpl/db/types';
import { randomUUID } from 'node:crypto';
import type { ActionResult } from '@/components/admin/types';
import { queueEmail } from './email';
import { announceUpdate } from './lead-events';
import { done, fail, getLead } from './crm-util';
import { buildResetUrl } from './crm-links';
import type { StaffSession } from './staff';

type Actor = StaffSession['actor'];

/** The auth server's answer to an address that already has an account: its own code, or (this version) a raw unique violation. */
const isEmailTaken = (e: { code?: string | number; message?: string }): boolean =>
  e.code === 'email_exists' || e.code === 'user_already_exists' || String(e.code) === '23505' || /already (been )?registered|already exists|duplicate key|users_email/i.test(e.message ?? '');

/**
 * "Edit details & password" -> Save. Updates the lead AND the Supabase user, so the applicant signs in with the new
 * address. A changed email address is treated as a change of mailbox owner: the new address is unproven again
 * (email_verified_at cleared), every emailed link and lead cookie issued before dies (session_epoch + 1) and the
 * user's sessions are ended. The applicant gets the `details-changed` email, as the prototype promises ("{first} gets an
 * email confirming the change"); after an email change the OLD address gets a short notice too, with no link into the file.
 */
export async function updateContact(
  db: Db,
  actor: Actor,
  a: { leadId: string; fullName: string; email: string; phone: string },
): Promise<ActionResult<{ changed: string[] }>> {
  const lead = await getLead(db, a.leadId);
  if (!lead) return fail('not_found');

  const phone = a.phone.trim() === '' ? null : a.phone.trim();
  if (!phone && lead.phone) return fail('invalid', 'phone');
  const fullName = a.fullName.trim();

  const changed: string[] = [];
  if (fullName !== lead.full_name) changed.push('name');
  if (a.email !== lead.email) changed.push('email');
  if ((phone ?? '') !== (lead.phone ?? '')) changed.push('phone');
  if (changed.length === 0) return done({ changed });

  const emailChanged = changed.includes('email');
  if (emailChanged) {
    const { data: clash } = await db.from('leads').select('id').eq('email', a.email).neq('id', a.leadId).maybeSingle();
    if (clash) return fail('email_taken', 'email');
    // an address that already has a sign-in account (a member of staff, someone else's) cannot become this lead's address:
    // a lead without an account would be the way into it, one with an account cannot be moved onto a second account
    const owner = (await db.rpc('auth_user_id_by_email', { p_email: a.email })).data as string | null;
    if (owner && owner !== lead.user_id) return fail('email_taken', 'email');
  }

  if (lead.user_id && (emailChanged || changed.includes('name'))) {
    const { error } = await db.auth.admin.updateUserById(lead.user_id, {
      ...(emailChanged ? { email: a.email, email_confirm: true } : {}),
      user_metadata: { full_name: fullName },
    });
    if (error) return fail(isEmailTaken(error) ? 'email_taken' : 'internal', emailChanged ? 'email' : undefined);
  }

  const patch = {
    full_name: fullName,
    email: a.email,
    phone,
    ...(emailChanged ? { email_verified_at: null, session_epoch: lead.session_epoch + 1 } : {}),
  };
  const { error } = await db.from('leads').update(patch).eq('id', a.leadId);
  if (error) {
    // keep the two records consistent: put the Supabase user back
    if (lead.user_id && emailChanged) await db.auth.admin.updateUserById(lead.user_id, { email: lead.email, email_confirm: true });
    return fail(error.code === '23505' ? 'email_taken' : 'internal', error.code === '23505' ? 'email' : undefined);
  }
  if (lead.user_id && emailChanged) await db.rpc('revoke_user_sessions', { p_user: lead.user_id });

  // the firm's external CRM keeps the same address, name and phone number as the application (the old address is named)
  const updated = { ...lead, full_name: fullName, email: a.email, phone, ...(emailChanged ? { session_epoch: lead.session_epoch + 1 } : {}) };
  await announceUpdate(db, updated, changed, emailChanged ? { email: lead.email } : undefined);
  const fields = changed as Array<'name' | 'email' | 'phone'>;
  // what was queued for the old address (a booking confirmation, a status update) is no longer for their mailbox; the notice
  // to the old address below is queued after this, on purpose
  if (emailChanged) await cancelPendingEmails(db, lead.id, 'cancelled: the address was changed by the team', { notTo: a.email });
  const key = randomUUID();
  await queueEmail({ template: 'details-changed', lead: updated, data: { variant: 'current', changed: fields }, dedupeKey: `staff:details-changed:${lead.id}:${key}:current` });
  // the address the file had until now: told, with nothing in the mail that opens the file
  if (emailChanged) {
    await queueEmail({ template: 'details-changed', lead: { ...updated, email: lead.email }, data: { variant: 'previous', changed: fields }, dedupeKey: `staff:details-changed:${lead.id}:${key}:previous` });
  }
  await logActivity(db, {
    leadId: a.leadId,
    kind: 'staff',
    code: 'contact_updated',
    text: 'Contact details updated',
    actor,
    meta: { fields: changed, ...(emailChanged ? { emailFrom: lead.email, emailTo: a.email } : {}) },
  });
  return done({ changed });
}

/**
 * "Send password reset link": a Supabase recovery link, rewritten to this app's /auth/callback so the applicant lands on
 * /create-password?mode=reset, emailed with the `password-reset` template. A lead that has no account yet gets one
 * (the same way "Go to my portal" creates it); the link proves mailbox ownership when it is used.
 */
export async function sendResetLink(db: Db, actor: Actor, leadId: string): Promise<ActionResult<{ sentAt: string; email: string }>> {
  const found = await getLead(db, leadId);
  if (!found) return fail('not_found');
  // an applicant is never flooded with reset emails, whoever on the team clicks
  if (!(await rateLimit(db, `admin-reset:${leadId}`, { windowSeconds: 3600, max: 5 }))) return fail('rate_limited');

  let lead = found;
  try {
    lead = (await ensureAuthUser(db, found)).lead;
  } catch (e) {
    // the address already has a sign-in account that is not this lead's: nothing is linked, and the link below, which
    // only the owner of the mailbox receives, is for that account
    if (!(e instanceof AccountEmailInUse)) return fail('internal');
  }
  const { data, error } = await db.auth.admin.generateLink({ type: 'recovery', email: lead.email });
  const tokenHash = data?.properties?.hashed_token;
  if (error || !tokenHash) return fail('internal');

  const resetUrl = buildResetUrl(campaignUrl('/auth/callback', lead.locale), tokenHash);
  await queueEmail({ template: 'password-reset', lead, data: { resetUrl }, dedupeKey: `staff:password-reset:${lead.id}:${randomUUID()}` });
  await logActivity(db, {
    leadId,
    kind: 'staff',
    code: 'password_reset_sent',
    text: `Password reset link sent to ${lead.email}`,
    actor,
    meta: { email: lead.email },
  });
  return done({ sentAt: new Date().toISOString(), email: lead.email });
}
