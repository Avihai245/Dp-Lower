import 'server-only';
import { hmacSha256Hex } from '@dpl/core';
import type { Db, EventRow } from './types';

const BACKOFF_MINUTES = [2, 10, 60, 360, 1440];
export const MAX_ATTEMPTS = BACKOFF_MINUTES.length + 1;

export interface DispatchResult {
  claimed: number;
  sent: number;
  failed: number;
  dead: number;
  skipped?: 'no_webhook';
}

function webhookFor(channel: string): string | undefined {
  const specific = channel === 'email' ? process.env.ZAPIER_EMAIL_WEBHOOK_URL : process.env.ZAPIER_CRM_WEBHOOK_URL;
  return specific || process.env.ZAPIER_WEBHOOK_URL || undefined;
}

async function post(url: string, e: EventRow): Promise<void> {
  const body = JSON.stringify({
    event: e.type,
    id: e.id,
    created_at: e.created_at,
    lead_id: e.lead_id,
    data: e.payload,
  });
  const headers: Record<string, string> = { 'content-type': 'application/json', 'x-dpl-event': e.type, 'x-dpl-delivery': e.id };
  const secret = process.env.ZAPIER_SIGNING_SECRET;
  if (secret) headers['x-dpl-signature'] = `sha256=${await hmacSha256Hex(secret, body)}`;
  const res = await fetch(url, { method: 'POST', headers, body, signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`webhook ${res.status}`);
}

/**
 * Delivers due outbox events to the Zapier webhooks (ZAPIER_CRM_WEBHOOK_URL / ZAPIER_EMAIL_WEBHOOK_URL, falling
 * back to ZAPIER_WEBHOOK_URL). With no webhook configured nothing is claimed, so events wait instead of being lost.
 * Failures retry with backoff (2m, 10m, 1h, 6h, 24h) and then become 'dead'.
 */
export async function deliverPending(db: Db, limit = 25): Promise<DispatchResult> {
  const result: DispatchResult = { claimed: 0, sent: 0, failed: 0, dead: 0 };
  if (!webhookFor('crm') && !webhookFor('email')) return { ...result, skipped: 'no_webhook' };

  const { data, error } = await db.rpc('claim_events', { p_limit: limit });
  if (error) throw new Error(`claim_events: ${error.message}`);
  const events = (data ?? []) as EventRow[];
  result.claimed = events.length;

  for (const e of events) {
    const url = webhookFor(e.channel);
    try {
      if (!url) throw new Error(`no webhook configured for channel ${e.channel}`);
      await post(url, e);
      await db.from('events').update({ status: 'sent', delivered_at: new Date().toISOString(), last_error: null, locked_at: null }).eq('id', e.id);
      result.sent++;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const dead = e.attempts >= MAX_ATTEMPTS;
      const wait = BACKOFF_MINUTES[Math.min(e.attempts, BACKOFF_MINUTES.length) - 1] ?? 1440;
      await db
        .from('events')
        .update({
          status: dead ? 'dead' : 'pending',
          last_error: message.slice(0, 500),
          locked_at: null,
          next_attempt_at: new Date(Date.now() + wait * 60_000).toISOString(),
        })
        .eq('id', e.id);
      if (dead) result.dead++;
      else result.failed++;
    }
  }
  return result;
}
