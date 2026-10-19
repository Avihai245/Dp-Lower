import { emailSchema } from '@dpl/core';
import { createAdminSupabase } from '@dpl/db/admin';
import { assertSameOrigin, handle, json, limitOrThrow, parseJson } from '@dpl/db/http';
import { findLeadByEmail, sendFileLink } from '@dpl/db/leads';
import { rateLimit } from '@dpl/db/rate-limit';
import { after } from 'next/server';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const body = z.object({
  email: emailSchema,
  /** honeypot: real visitors never fill it */
  website: z.string().max(200).optional(),
});

async function sendNewPortalLink(email: string): Promise<void> {
  try {
    const db = createAdminSupabase();
    if (!(await rateLimit(db, `link-email:${email}`, { windowSeconds: 3600, max: 5 }))) return;
    const lead = await findLeadByEmail(db, email);
    if (lead) await sendFileLink(db, lead, 'resend');
  } catch (e) {
    console.error('[auth/link] sendNewPortalLink failed', e);
  }
}

/**
 * "Send the link again" on the details form of the funnel (this site): emails the owner of the address a fresh link into
 * their file. The portal has the same route for its expired-link page. Always answers 200 `{ ok: true }` and does its work
 * after the response, so it cannot be used to find out which addresses are known.
 */
export const POST = handle(async (req) => {
  assertSameOrigin(req);
  await limitOrThrow(req, 'auth-link', { windowSeconds: 60, max: 5 });
  const input = await parseJson(req, body);
  if (!input.website) after(() => sendNewPortalLink(input.email));
  return json({ ok: true });
});
