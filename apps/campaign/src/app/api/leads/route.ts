import { leadInputSchema } from '@dpl/core';
import { createAdminSupabase } from '@dpl/db/admin';
import { ApiError, assertSameOrigin, clientIp, handle, json, limitOrThrow, parseJson, verifyTurnstile } from '@dpl/db/http';
import { setLeadCookie } from '@dpl/db/lead-session';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { endForeignSession, readFirstTouch, submitLead } from '@/server/leads';

export const dynamic = 'force-dynamic';

const body = leadInputSchema.extend({
  /** honeypot: real visitors never fill it */
  website: z.string().max(200).optional(),
  turnstileToken: z.string().max(2048).optional(),
});

/**
 * End of the eligibility questions + contact details. Three outcomes (docs/ARCHITECTURE.md section 7):
 *  201 created  - a new lead; this browser receives the lead cookie
 *  200 updated  - the lead of this browser (cookie / session): name, phone and answers are updated
 *  200 existing - the email has a file that this browser did not create: NOTHING changes, the address owner gets a
 *                 link by email. The body carries nothing else, so it reveals no detail of the file.
 */
export const POST = handle(async (req) => {
  assertSameOrigin(req);
  await limitOrThrow(req, 'leads', { windowSeconds: 60, max: 10 });
  const input = await parseJson(req, body);
  // a filled honeypot gets the shape of a success and is discarded, so bots learn nothing
  if (input.website) return json({ status: 'created', leadId: randomUUID(), caseRef: 'DPL-00-0000' }, { status: 201 });
  if (!(await verifyTurnstile(input.turnstileToken, clientIp(req)))) throw new ApiError(400, 'captcha_failed');

  const db = createAdminSupabase();
  const outcome = await submitLead(db, input, await readFirstTouch());
  if (outcome.status === 'existing') return json({ status: 'existing' });

  await setLeadCookie(outcome.lead);
  await endForeignSession(db, outcome.lead);
  return json(
    { status: outcome.status, leadId: outcome.lead.id, caseRef: outcome.lead.case_ref },
    { status: outcome.status === 'created' ? 201 : 200 },
  );
});
