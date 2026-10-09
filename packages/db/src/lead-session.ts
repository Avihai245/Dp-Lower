import 'server-only';
import { signToken, verifyToken } from '@dpl/core';
import { cookies } from 'next/headers';
import { appSecret, secureCookies } from './env';
import { createServerSupabase } from './server';
import type { Db, LeadRow } from './types';

/**
 * The "lead session": proof that THIS browser created (or was let into) the lead. It lets the visitor continue the
 * funnel (book a call, open the portal) without a password, and nothing else. The cookie carries the lead's
 * `session_epoch`; when the mailbox owner proves control of the email the epoch is bumped and every older cookie dies.
 */
export const LEAD_COOKIE = 'dpl_lead';
const MAX_AGE = 60 * 60 * 24 * 30;

const cookieOptions = (maxAge: number) => ({
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: secureCookies(),
  path: '/',
  maxAge,
});

/** Call from a Route Handler or Server Action (cookies are read-only in Server Components). */
export async function setLeadCookie(lead: Pick<LeadRow, 'id' | 'session_epoch'>): Promise<void> {
  const token = await signToken({ lid: lead.id, ep: lead.session_epoch, v: 1 }, appSecret(), MAX_AGE);
  (await cookies()).set(LEAD_COOKIE, token, cookieOptions(MAX_AGE));
}

export async function clearLeadCookie(): Promise<void> {
  (await cookies()).set(LEAD_COOKIE, '', cookieOptions(0));
}

export async function readLeadSession(): Promise<{ leadId: string; epoch: number } | null> {
  const store = await cookies();
  const payload = await verifyToken<{ lid?: string; ep?: number }>(store.get(LEAD_COOKIE)?.value, appSecret());
  return payload?.lid ? { leadId: payload.lid, epoch: payload.ep ?? 0 } : null;
}

/** The lead this browser's cookie belongs to, or null (no cookie, forged, or epoch no longer current). */
export async function getCookieLead(db: Db): Promise<LeadRow | null> {
  const s = await readLeadSession();
  if (!s) return null;
  const { data } = await db.from('leads').select('*').eq('id', s.leadId).maybeSingle();
  return data && data.session_epoch === s.epoch ? data : null;
}

/** The lead belonging to the signed-in Supabase user, or null. */
export async function getSessionLead(db: Db): Promise<LeadRow | null> {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await db.from('leads').select('*').eq('user_id', user.id).maybeSingle();
  return data;
}

/**
 * Who is asking? The lead cookie (funnel) or the signed-in user (portal). `via: 'session'` is the stronger proof.
 * Every route that touches a lead's data starts here; never trust a lead id sent by the client.
 */
export async function resolveLead(db: Db): Promise<{ lead: LeadRow; via: 'cookie' | 'session' } | null> {
  const bySession = await getSessionLead(db);
  if (bySession) return { lead: bySession, via: 'session' };
  const byCookie = await getCookieLead(db);
  return byCookie ? { lead: byCookie, via: 'cookie' } : null;
}
