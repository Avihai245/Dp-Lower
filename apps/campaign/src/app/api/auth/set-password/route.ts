import { passwordSchema } from '@dpl/core';
import { createAdminSupabase } from '@dpl/db/admin';
import { ApiError, assertSameOrigin, handle, json, limitOrThrow, parseJson } from '@dpl/db/http';
import { logActivity } from '@dpl/db/outbox';
import { createServerSupabase } from '@dpl/db/server';
import { z } from 'zod';
import { reopenSession } from '@/server/auth';

export const dynamic = 'force-dynamic';

const body = z.object({ password: passwordSchema });

/**
 * Sets (or resets) the password of the signed-in user. Requires a Supabase session; nothing else authorises it, the
 * lead cookie does not. The session is verified with the auth server (getUser), not just decoded from the cookie.
 * Every other session of the user is ended by the password change; this browser gets a fresh one.
 */
export const POST = handle(async (req) => {
  assertSameOrigin(req);
  await limitOrThrow(req, 'set-password', { windowSeconds: 60, max: 10 });
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new ApiError(401, 'unauthorized');
  const { password } = await parseJson(req, body);

  const db = createAdminSupabase();
  const { data: lead } = await db.from('leads').select('id').eq('user_id', user.id).maybeSingle();
  const { error } = await db.auth.admin.updateUserById(user.id, { password });
  if (error) {
    // the auth server refuses a password that breaks its policy (422); anything else is ours to log
    if (error.status === 422) throw new ApiError(400, 'password_rejected');
    throw new Error(`updateUserById failed: ${error.message}`);
  }
  // the update ended every session of the user (this one too): keep this browser signed in with a fresh one
  if (user.email) await reopenSession(db, user.email);

  if (lead) {
    const { error: upErr } = await db.from('leads').update({ password_set_at: new Date().toISOString() }).eq('id', lead.id);
    if (upErr) throw new Error(`password_set_at update failed: ${upErr.message}`);
    await logActivity(db, { leadId: lead.id, code: 'password_set', text: 'Password set for the portal' });
  }
  return json({ ok: true });
});
