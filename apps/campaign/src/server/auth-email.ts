import 'server-only';
import { isLocale, normalizeEmail, type Locale } from '@dpl/core';
import { createAdminSupabase } from '@dpl/db/admin';
import { ApiError } from '@dpl/db/http';
import { campaignUrl, safeNext } from '@dpl/db/links';
import type { Db } from '@dpl/db/types';
import type { AuthLinkKind } from '@dpl/emails';
import { z } from 'zod';
import { queueEmailToAddress, type Recipient } from './email';
import { verifyStandardWebhook } from './standard-webhooks';

/**
 * Supabase Auth "Send Email" hook (HTTP): Supabase calls it instead of its own SMTP for password recovery, magic
 * links, signup / email-change confirmations and one-time codes. Each call becomes an `email.send` outbox event in the
 * recipient's language (the lead's, else English), delivered by the same dispatcher as every other email.
 *
 * Payload and field naming: https://supabase.com/docs/guides/auth/auth-hooks/send-email-hook
 */

const hookSchema = z.object({
  user: z
    .object({
      id: z.string().optional(),
      email: z.string().optional().default(''),
      new_email: z.string().optional().nullable(),
      user_metadata: z.record(z.string(), z.unknown()).optional().nullable(),
    })
    .passthrough(),
  email_data: z
    .object({
      token: z.string().optional().default(''),
      token_hash: z.string().optional().default(''),
      redirect_to: z.string().optional().default(''),
      email_action_type: z.string(),
      site_url: z.string().optional().default(''),
      token_new: z.string().optional().default(''),
      token_hash_new: z.string().optional().default(''),
    })
    .passthrough(),
});

type Hook = z.infer<typeof hookSchema>;

/** The error shape Supabase surfaces to the person who triggered the email. */
function failure(status: number, message: string): Response {
  return Response.json({ error: { http_code: status, message } }, { status });
}

const metaString = (meta: Hook['user']['user_metadata'], key: string): string => {
  const v = meta?.[key];
  return typeof v === 'string' ? v.trim() : '';
};

/** The path to send the person to after the link was verified: the `next` of the redirect URL when it is a safe local path. */
function nextPath(redirectTo: string, fallback: string): string {
  let candidate: string | null = null;
  try {
    candidate = new URL(redirectTo).searchParams.get('next');
  } catch {
    candidate = null;
  }
  return safeNext(candidate, fallback);
}

/** `${campaign}/auth/callback?token_hash=…&type=…&next=…` (the page verifies the token and opens the session). */
export function authCallbackUrl(o: { locale: Locale; tokenHash: string; type: string; next: string }): string {
  const q = new URLSearchParams({ token_hash: o.tokenHash, type: o.type, next: o.next });
  return `${campaignUrl('/auth/callback', o.locale)}?${q.toString()}`;
}

const KIND_TYPES = ['magiclink', 'signup', 'invite', 'email_change', 'email', 'reauthentication', 'recovery'] as const;
const isKind = (t: string): t is (typeof KIND_TYPES)[number] => (KIND_TYPES as readonly string[]).includes(t);

interface Outgoing {
  to: Recipient;
  template: 'password-reset' | 'auth-link';
  data: Record<string, unknown>;
  suffix: string;
}

/** Which emails a hook call stands for (email change can need two: see the Supabase docs on the reversed token names). */
function outgoing(hook: Hook, base: Omit<Recipient, 'email'>): Outgoing[] {
  const { email_data: d, user } = hook;
  const type = d.email_action_type;
  const current = normalizeEmail(user.email ?? '');
  const to = (email: string): Recipient => ({ ...base, email });
  const next = (fallback: string) => nextPath(d.redirect_to, fallback);

  if (type === 'recovery') {
    const url = authCallbackUrl({ locale: base.locale, tokenHash: d.token_hash, type, next: next('/create-password?mode=reset') });
    return [{ to: to(current), template: 'password-reset', data: { resetUrl: url }, suffix: 'recovery' }];
  }
  if (type === 'reauthentication') {
    return [{ to: to(current), template: 'auth-link', data: { kind: 'reauthentication', code: d.token }, suffix: 'reauth' }];
  }
  if (type === 'email_change') {
    const fresh = normalizeEmail(user.new_email ?? '');
    const link = (tokenHash: string) => authCallbackUrl({ locale: base.locale, tokenHash, type, next: next('/portal') });
    if (fresh && d.token_hash && d.token_hash_new) {
      // secure email change: both addresses confirm. The names are reversed (token_hash_new belongs to the CURRENT address)
      return [
        { to: to(current), template: 'auth-link', data: { kind: 'email_change', url: link(d.token_hash_new) }, suffix: 'current' },
        { to: to(fresh), template: 'auth-link', data: { kind: 'email_change', url: link(d.token_hash) }, suffix: 'new' },
      ];
    }
    return [{ to: to(fresh || current), template: 'auth-link', data: { kind: 'email_change', url: link(d.token_hash || d.token_hash_new) }, suffix: 'new' }];
  }
  if (type === 'magiclink' || type === 'signup' || type === 'invite' || type === 'email') {
    const url = authCallbackUrl({ locale: base.locale, tokenHash: d.token_hash, type, next: next('/portal') });
    const kind: AuthLinkKind = type;
    return [{ to: to(current), template: 'auth-link', data: { kind, url, ...(type === 'email' ? { code: d.token } : {}) }, suffix: type }];
  }
  return [];
}

async function recipientBase(db: Db, hook: Hook): Promise<Omit<Recipient, 'email'>> {
  const email = normalizeEmail(hook.user.email ?? '');
  const { data: lead } = email ? await db.from('leads').select('id, full_name, locale').eq('email', email).maybeSingle() : { data: null };
  const metaLocale = metaString(hook.user.user_metadata, 'locale');
  const locale: Locale = lead ? (lead.locale as Locale) : isLocale(metaLocale) ? metaLocale : 'en';
  const name = lead?.full_name || metaString(hook.user.user_metadata, 'full_name') || metaString(hook.user.user_metadata, 'name') || email.split('@')[0] || '';
  return { name, locale, leadId: lead?.id ?? null };
}

/**
 * The route handler. 401 for a missing or wrong signature (or a timestamp more than five minutes off), 400 for a body
 * that is not a hook payload, 200 `{}` once the email is in the outbox (also for a redelivered webhook: the dedupe key
 * is the webhook id), 500 when the outbox could not be written so that Supabase reports the failure.
 */
export async function handleSendEmailHook(req: Request): Promise<Response> {
  const secret = process.env.SEND_EMAIL_HOOK_SECRET;
  if (!secret) {
    console.error('[auth-hook] SEND_EMAIL_HOOK_SECRET is not configured');
    return failure(500, 'hook_not_configured');
  }
  const body = await req.text();
  const id = req.headers.get('webhook-id');
  const verified = verifyStandardWebhook({ secret, id, timestamp: req.headers.get('webhook-timestamp'), signature: req.headers.get('webhook-signature'), body });
  if (!verified || !id) return failure(401, 'invalid_signature');

  let parsed: Hook;
  try {
    parsed = hookSchema.parse(JSON.parse(body));
  } catch {
    return failure(400, 'invalid_payload');
  }
  if (!isKind(parsed.email_data.email_action_type)) {
    // security notifications (password changed, identity linked, ...) have no template: acknowledge and move on
    return Response.json({});
  }
  if (!normalizeEmail(parsed.user.email ?? '') && !normalizeEmail(parsed.user.new_email ?? '')) return Response.json({});

  try {
    const db = createAdminSupabase();
    const base = await recipientBase(db, parsed);
    for (const mail of outgoing(parsed, base)) {
      await queueEmailToAddress({
        template: mail.template,
        to: mail.to,
        data: mail.data,
        dedupeKey: `auth:${id}:${mail.suffix}`,
      });
    }
    return Response.json({});
  } catch (e) {
    if (e instanceof ApiError) return failure(e.status, e.code);
    console.error('[auth-hook] could not queue the email', e);
    return failure(500, 'internal_error');
  }
}
