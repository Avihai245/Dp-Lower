import { callbackInputSchema } from '@dpl/core';
import { createAdminSupabase } from '@dpl/db/admin';
import { ApiError, assertSameOrigin, clientIp, handle, json, limitOrThrow, parseJson, verifyTurnstile } from '@dpl/db/http';
import { resolveLead } from '@dpl/db/lead-session';
import { enqueueEvent, leadSnapshot, logActivity } from '@dpl/db/outbox';
import { z } from 'zod';
import { readFirstTouch } from '@/server/leads';

export const dynamic = 'force-dynamic';

const body = callbackInputSchema.extend({
  /** honeypot: real visitors never fill it */
  website: z.string().max(200).optional(),
  turnstileToken: z.string().max(2048).optional(),
});

/**
 * "Speak with an AI Advisor / get a call in seconds": a phone number to ring back. Public; when the visitor already
 * has a lead (cookie or session) the request is attached to it.
 */
export const POST = handle(async (req) => {
  assertSameOrigin(req);
  await limitOrThrow(req, 'callbacks', { windowSeconds: 60, max: 5 });
  const input = await parseJson(req, body);
  if (input.website) return json({ ok: true }, { status: 201 });
  if (!(await verifyTurnstile(input.turnstileToken, clientIp(req)))) throw new ApiError(400, 'captcha_failed');

  const db = createAdminSupabase();
  const lead = (await resolveLead(db))?.lead ?? null;
  const source = input.source ?? (await readFirstTouch()).source ?? null;
  const { data, error } = await db
    .from('callback_requests')
    .insert({
      lead_id: lead?.id ?? null,
      name: input.name ?? lead?.full_name ?? null,
      phone: input.phone,
      locale: input.locale,
      source,
    })
    .select('id')
    .single();
  if (error || !data) throw new Error(`callback insert failed: ${error?.message ?? 'no row'}`);

  await enqueueEvent(db, {
    type: 'callback.requested',
    leadId: lead?.id ?? null,
    payload: {
      ...(lead ? { lead: leadSnapshot(lead) } : {}),
      callback: { id: data.id, name: input.name ?? lead?.full_name ?? null, phone: input.phone, locale: input.locale, source },
    },
    dedupeKey: `callback.requested:${data.id}`,
  });
  if (lead) await logActivity(db, { leadId: lead.id, code: 'callback_requested', text: 'Asked for a call back right away', meta: { callbackId: data.id } });
  return json({ ok: true }, { status: 201 });
});
