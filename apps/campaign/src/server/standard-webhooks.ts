import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Verification of Standard Webhooks signatures (https://www.standardwebhooks.com), the scheme Supabase Auth uses for
 * its HTTP hooks. Headers: webhook-id, webhook-timestamp (seconds) and webhook-signature ("v1,<base64 hmac-sha256>",
 * several signatures separated by spaces). The signed content is `${id}.${timestamp}.${body}`.
 */

/** Supabase shows the secret as `v1,whsec_<base64>`; the key is the base64 part. */
export function decodeWebhookSecret(secret: string): Buffer | null {
  const base64 = secret.trim().replace(/^v1,/, '').replace(/^whsec_/, '');
  if (!base64) return null;
  const key = Buffer.from(base64, 'base64');
  return key.length > 0 ? key : null;
}

export interface WebhookInput {
  secret: string;
  id: string | null;
  timestamp: string | null;
  signature: string | null;
  /** the raw request body, exactly as received */
  body: string;
  /** injectable clock for tests (ms) */
  now?: number;
  /** how far the timestamp may be from now, in seconds (either direction) */
  toleranceSeconds?: number;
}

export function verifyStandardWebhook(i: WebhookInput): boolean {
  if (!i.id || !i.timestamp || !i.signature) return false;
  if (!/^\d{1,12}$/.test(i.timestamp)) return false;
  const nowSeconds = Math.floor((i.now ?? Date.now()) / 1000);
  if (Math.abs(nowSeconds - Number(i.timestamp)) > (i.toleranceSeconds ?? 300)) return false;
  const key = decodeWebhookSecret(i.secret);
  if (!key) return false;
  const expected = createHmac('sha256', key).update(`${i.id}.${i.timestamp}.${i.body}`).digest();
  for (const part of i.signature.split(/\s+/)) {
    const comma = part.indexOf(',');
    if (comma < 0 || part.slice(0, comma) !== 'v1') continue;
    const candidate = Buffer.from(part.slice(comma + 1), 'base64');
    if (candidate.length === expected.length && timingSafeEqual(candidate, expected)) return true;
  }
  return false;
}

/** Signs a body the way Supabase does (used by the tests and by anyone who wants to replay a hook locally). */
export function signStandardWebhook(o: { secret: string; id: string; timestamp: number; body: string }): string {
  const key = decodeWebhookSecret(o.secret);
  if (!key) throw new Error('invalid webhook secret');
  return `v1,${createHmac('sha256', key).update(`${o.id}.${o.timestamp}.${o.body}`).digest('base64')}`;
}
