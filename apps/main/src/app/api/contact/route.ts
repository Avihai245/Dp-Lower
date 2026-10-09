import { contactSubmissionSchema } from '@dpl/core';
import { createAdminSupabase } from '@dpl/db/admin';
import { ApiError, assertSameOrigin, clientIp, handle, json, limitOrThrow, parseJson, verifyTurnstile } from '@dpl/db/http';
import { enqueueEvent } from '@dpl/db/outbox';
import { z } from 'zod';
import { queueContactAck } from '@/server/contact-ack';

export const dynamic = 'force-dynamic';

const body = z.intersection(contactSubmissionSchema, z.object({ turnstileToken: z.string().max(2048).optional() }));

/**
 * Forms on the firm's website (consultation form, lead band, chat) -> contact_submissions + CRM event.
 * A filled honeypot ("website") is answered with success and discarded, so bots learn nothing.
 */
export const POST = handle(async (req) => {
  assertSameOrigin(req);
  await limitOrThrow(req, 'contact', { windowSeconds: 60, max: 5 });

  let input;
  try {
    input = await parseJson(req, body);
  } catch (e) {
    // a filled honeypot fails validation (website must be empty): treat as a silent success
    if (e instanceof ApiError && JSON.stringify(e.details ?? '').includes('"path":"website"')) return json({ ok: true }, { status: 201 });
    throw e;
  }
  if (!(await verifyTurnstile(input.turnstileToken, clientIp(req)))) throw new ApiError(400, 'captcha_failed');

  const db = createAdminSupabase();
  const { data, error } = await db
    .from('contact_submissions')
    .insert({
      kind: input.kind,
      name: input.name,
      email: input.email ?? null,
      phone: input.phone,
      matter: input.matter ?? null,
      note: input.note ?? null,
      locale: input.locale,
      page: input.page ?? null,
      source: input.source ?? null,
      utm: input.utm ?? {},
      consented_at: new Date().toISOString(),
    })
    .select('id')
    .single();
  if (error || !data) throw new Error(`contact insert failed: ${error?.message}`);

  await enqueueEvent(db, {
    type: 'contact.created',
    payload: { submission: { id: data.id, kind: input.kind, name: input.name, email: input.email ?? null, phone: input.phone, matter: input.matter ?? null, note: input.note ?? null, locale: input.locale, page: input.page ?? null } },
    dedupeKey: `contact.created:${data.id}`,
  });
  await queueContactAck({ submissionId: data.id, name: input.name, email: input.email ?? null, locale: input.locale });
  return json({ ok: true }, { status: 201 });
});
