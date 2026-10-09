import { emailSchema } from '@dpl/core';
import { assertSameOrigin, handle, json, limitOrThrow, parseJson } from '@dpl/db/http';
import { after } from 'next/server';
import { z } from 'zod';
import { sendNewPortalLink } from '@/server/auth';

export const dynamic = 'force-dynamic';

const body = z.object({
  email: emailSchema,
  /** honeypot: real visitors never fill it */
  website: z.string().max(200).optional(),
});

/**
 * "Send me a new link" on the expired-link page: emails the owner of the address a fresh link into their file.
 * Always answers 200 `{ ok: true }` and does its work after the response, like /api/auth/forgot.
 */
export const POST = handle(async (req) => {
  assertSameOrigin(req);
  await limitOrThrow(req, 'auth-link', { windowSeconds: 60, max: 5 });
  const input = await parseJson(req, body);
  if (!input.website) after(() => sendNewPortalLink(input.email));
  return json({ ok: true });
});
