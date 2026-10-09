import { createAdminSupabase } from '@dpl/db/admin';
import { deliverPending } from '@dpl/db/dispatch';
import { ApiError, handle, json } from '@dpl/db/http';
import { isAuthorizedCron } from '../../../../server/cron-auth';
import { scheduleDueEmails, syncSequenceDelivery, type ScheduleResult } from '../../../../server/drip';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * The dispatcher: `Authorization: Bearer $CRON_SECRET`.
 *  1. schedules the nurture emails that are due (planDrip) into the outbox,
 *  2. delivers pending outbox events (CRM events and rendered emails) to the Zapier webhooks,
 *  3. marks the delivered sequence emails as sent.
 * Safe to call as often as every minute and from two places at once: every email has a dedupe key and the outbox rows
 * are claimed with `for update skip locked`. Vercel Cron calls with GET, the database cron (pg_net) with POST.
 */
const run = handle(async (req) => {
  if (!isAuthorizedCron(req)) throw new ApiError(401, 'unauthorized');
  const db = createAdminSupabase();
  const failures: string[] = [];
  const message = (e: unknown) => (e instanceof Error ? e.message : String(e)).slice(0, 300);

  let schedule: ScheduleResult = { leads: 0, scheduled: 0, skipped: 0, stopped: 0, errors: 0 };
  try {
    schedule = await scheduleDueEmails(db);
  } catch (e) {
    console.error('[cron] scheduling failed', e);
    failures.push(`schedule: ${message(e)}`);
  }

  let dispatch = { claimed: 0, sent: 0, failed: 0, dead: 0, cancelled: 0 } as Awaited<ReturnType<typeof deliverPending>>;
  try {
    dispatch = await deliverPending(db);
  } catch (e) {
    console.error('[cron] delivery failed', e);
    failures.push(`deliver: ${message(e)}`);
  }

  let sequenceSent = 0;
  try {
    sequenceSent = await syncSequenceDelivery(db);
  } catch (e) {
    console.error('[cron] sequence sync failed', e);
    failures.push(`sync: ${message(e)}`);
  }

  const body = {
    scheduled: schedule.scheduled,
    skipped: schedule.skipped,
    delivered: dispatch.sent,
    failed: dispatch.failed + dispatch.dead,
    // details
    leads: schedule.leads,
    stopped: schedule.stopped,
    scheduleErrors: schedule.errors,
    claimed: dispatch.claimed,
    dead: dispatch.dead,
    cancelled: dispatch.cancelled,
    sequenceSent,
    ...(dispatch.skipped ? { deliveryNote: dispatch.skipped } : {}),
  };
  if (failures.length > 0)
    return json({ ...body, error: 'dispatch_failed', details: failures }, { status: 500 });
  return json(body);
});

export const POST = run;
export const GET = run;
