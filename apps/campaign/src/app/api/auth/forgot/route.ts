import { emailSchema, localeSchema } from '@dpl/core';
import { assertSameOrigin, handle, json, limitOrThrow, parseJson } from '@dpl/db/http';
import { after } from 'next/server';
import { z } from 'zod';
import { sendPasswordReset } from '@/server/auth';

export const dynamic = 'force-dynamic';

const body = z.object({
  email: emailSchema,
  locale: localeSchema.default('en'),
  /** honeypot: real visitors never fill it */
  website: z.string().max(200).optional(),
});

/**
 * "Forgot it?": always answers 200 `{ ok: true }`, whether or not the address belongs to anybody. The work (lookup,
 * recovery link, email) runs after the response, so neither the body nor the timing tells an address apart.
 */
export const POST = handle(async (req) => {
  assertSameOrigin(req);
  await limitOrThrow(req, 'forgot', { windowSeconds: 60, max: 5 });
  const input = await parseJson(req, body);
  if (!input.website) after(() => sendPasswordReset(input.email, input.locale));
  return json({ ok: true });
});
