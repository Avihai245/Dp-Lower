import { createAdminSupabase } from '@dpl/db/admin';
import type { Db, LeadRow } from '@dpl/db/types';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { cleanupLeads, loadLocalEnv, makeLead } from './test-env';

vi.mock('server-only', () => ({}));

const hasDb = loadLocalEnv();
const DAY = 86_400_000;
const HOUR = 3_600_000;

describe.skipIf(!hasDb)('nurture sequence (local Supabase)', () => {
  let db: Db;
  let drip: typeof import('./drip');
  const created: string[] = [];

  beforeAll(async () => {
    db = createAdminSupabase();
    drip = await import('./drip');
  });
  afterAll(async () => {
    await cleanupLeads(db, created);
  });

  const lead = async (o: Parameters<typeof makeLead>[1]): Promise<LeadRow> => {
    const l = await makeLead(db, o);
    created.push(l.id);
    return l;
  };
  const stateOf = async (l: LeadRow) => {
    const { data } = await db.from('email_sequence_state').select('*').eq('lead_id', l.id).order('number');
    return data ?? [];
  };
  const eventsOf = async (l: LeadRow) => {
    const { data } = await db
      .from('events')
      .select('*')
      .like('dedupe_key', `welcome:${l.id}:%`)
      .order('dedupe_key');
    return data ?? [];
  };
  /** the sequence record of an email that already went out `ago` ms before `now` */
  const sent = async (l: LeadRow, number: number, at: Date) => {
    const { error } = await db.from('email_sequence_state').insert({
      lead_id: l.id,
      number,
      status: 'sent',
      scheduled_for: at.toISOString(),
      created_at: at.toISOString(),
    });
    expect(error).toBeNull();
  };
  const run = (l: LeadRow[], now: Date) =>
    drip.scheduleDueEmails(db, now, { onlyLeadIds: l.map((x) => x.id) });

  describe('restartForNewAddress', () => {
    it('cancels what waits for the old address and sends welcome-1 to the new one, keeping what was already delivered', async () => {
      const now = new Date();
      const l = await lead({ createdAt: new Date(now.getTime() - 4 * DAY), name: 'anna reinhardt' });
      await drip.startWelcomeSequence(l); // welcome-1, queued for the old address
      await run([l], now); // whatever is due after four days is queued too
      await sent(l, 15, new Date(now.getTime() - 2 * DAY)); // a row for an email that really went out stays

      // the applicant corrects the address: the lead row carries it, with the new epoch
      const fixed = `fixed-${l.email}`;
      const { data: moved } = await db.from('leads').update({ email: fixed, session_epoch: l.session_epoch + 1 }).eq('id', l.id).select('*').single();
      await drip.restartForNewAddress(moved!);

      const { data: events } = await db.from('events').select('status, dedupe_key, payload').like('dedupe_key', `welcome:${l.id}:%`);
      const pending = (events ?? []).filter((e) => e.status === 'pending');
      expect(pending, 'only the new welcome-1 is left to send').toHaveLength(1);
      expect(pending[0]?.dedupe_key).toBe(`welcome:${l.id}:1:e${l.session_epoch + 1}`);
      expect((pending[0]?.payload as { to: { email: string } }).to.email).toBe(fixed);
      expect((events ?? []).filter((e) => e.status === 'cancelled').length).toBeGreaterThan(0);

      const state = await stateOf(l);
      expect(state.find((r) => r.number === 1)).toMatchObject({ status: 'queued' });
      expect(state.find((r) => r.number === 15), 'a delivered email stays recorded').toMatchObject({ status: 'sent' });
      // doing it twice does not queue a second welcome-1
      await drip.restartForNewAddress(moved!);
      const again = await db.from('events').select('id').eq('dedupe_key', `welcome:${l.id}:1:e${l.session_epoch + 1}`);
      expect(again.data).toHaveLength(1);
    });

    it('sends nothing to an unsubscribed applicant', async () => {
      const now = new Date();
      const l = await lead({ createdAt: new Date(now.getTime() - HOUR), unsubscribedAt: new Date(now.getTime() - 60_000) });
      await drip.restartForNewAddress(l);
      expect(await eventsOf(l)).toHaveLength(0);
    });
  });

  describe('startWelcomeSequence', () => {
    it('queues welcome-1 immediately and records it, once', async () => {
      const l = await lead({ createdAt: new Date(), name: 'david cohen' });
      await drip.startWelcomeSequence(l);
      await drip.startWelcomeSequence(l); // a retried request must not send twice

      const events = await eventsOf(l);
      expect(events).toHaveLength(1);
      const e = events[0]!;
      expect(e).toMatchObject({
        type: 'email.send',
        channel: 'email',
        status: 'pending',
        lead_id: l.id,
        dedupe_key: `welcome:${l.id}:1`,
      });
      const p = e.payload as {
        template: string;
        category: string;
        to: { email: string };
        subject: string;
        html: string;
        text: string;
        locale: string;
        replyTo: string;
        from: { name: string };
      };
      expect(p).toMatchObject({
        template: 'welcome-1',
        category: 'nurture',
        locale: 'en',
        to: { email: l.email },
      });
      expect(p.from.name).toBe('Decker Pex Levi');
      expect(p.subject).toBe('Thank you — your citizenship file is open');
      expect(p.html).toContain('David, thank you for your details.');
      expect(p.html).toMatch(/\/unsubscribe\?t=/);
      expect(p.html).toMatch(/\/go\/[\w.-]+"/);
      expect(p.text).toContain('Unsubscribe');

      const state = await stateOf(l);
      expect(state).toHaveLength(1);
      expect(state[0]).toMatchObject({ number: 1, status: 'queued', event_id: e.id });
    });

    it('writes the email in the lead’s language', async () => {
      const l = await lead({ createdAt: new Date(), locale: 'he', name: 'דוד כהן' });
      await drip.startWelcomeSequence(l);
      const p = (await eventsOf(l))[0]!.payload as { html: string; locale: string; subject: string };
      expect(p.locale).toBe('he');
      expect(p.html).toContain('<html lang="he" dir="rtl">');
      expect(p.html).toContain(
        '<span dir="auto" style="unicode-bidi:isolate;">דוד</span>, תודה על הפרטים שמסרתם.',
      );
      expect(p.html).toContain('/he/unsubscribe?t=');
    });

    it('does nothing for an unsubscribed lead', async () => {
      const l = await lead({ createdAt: new Date(), unsubscribedAt: new Date() });
      await drip.startWelcomeSequence(l);
      expect(await eventsOf(l)).toHaveLength(0);
      expect(await stateOf(l)).toHaveLength(0);
    });
  });

  describe('scheduleDueEmails', () => {
    it('sends email 2 on day 2 and is idempotent', async () => {
      const now = new Date();
      const l = await lead({ createdAt: new Date(now.getTime() - 2 * DAY - HOUR) });
      await sent(l, 1, new Date(l.created_at));

      const first = await run([l], now);
      expect(first).toMatchObject({ leads: 1, scheduled: 1, skipped: 0, stopped: 0, errors: 0 });
      const events = await eventsOf(l);
      expect(events.map((e) => e.dedupe_key)).toEqual([`welcome:${l.id}:2`]);
      expect((events[0]!.payload as { template: string }).template).toBe('welcome-2');
      const state = await stateOf(l);
      expect(state.map((s) => [s.number, s.status])).toEqual([
        [1, 'sent'],
        [2, 'queued'],
      ]);
      expect(new Date(state[1]!.scheduled_for).getTime()).toBe(new Date(l.created_at).getTime() + 2 * DAY);
      expect(state[1]!.event_id).toBe(events[0]!.id);

      // a second run, and a third a minute later, change nothing
      expect(await run([l], now)).toMatchObject({ scheduled: 0, skipped: 0, errors: 0 });
      expect(await run([l], new Date(now.getTime() + 60_000))).toMatchObject({
        scheduled: 0,
        skipped: 0,
        errors: 0,
      });
      expect(await eventsOf(l)).toHaveLength(1);
      expect(await stateOf(l)).toHaveLength(2);
    });

    it('does nothing before the next email is due', async () => {
      const now = new Date();
      const l = await lead({ createdAt: new Date(now.getTime() - DAY) });
      await sent(l, 1, new Date(l.created_at));
      expect(await run([l], now)).toMatchObject({ leads: 1, scheduled: 0, skipped: 0, stopped: 0 });
      expect(await eventsOf(l)).toHaveLength(0);
    });

    it('skips email 3 when a call is booked and records why', async () => {
      const now = new Date();
      const l = await lead({ createdAt: new Date(now.getTime() - 3 * DAY - HOUR) });
      await sent(l, 1, new Date(l.created_at));
      await sent(l, 2, new Date(now.getTime() - DAY - HOUR)); // 24h ago: clear of the minimum gap
      const starts = new Date(now.getTime() + 2 * DAY);
      const { error } = await db.from('bookings').insert({
        lead_id: l.id,
        starts_at: starts.toISOString(),
        ends_at: new Date(starts.getTime() + 20 * 60_000).toISOString(),
        timezone: 'Asia/Jerusalem',
      });
      expect(error).toBeNull();

      expect(await run([l], now)).toMatchObject({ scheduled: 0, skipped: 1, errors: 0 });
      const three = (await stateOf(l)).find((s) => s.number === 3)!;
      expect(three).toMatchObject({ status: 'skipped', reason: 'already_booked', event_id: null });
      expect(await eventsOf(l)).toHaveLength(0);
      expect(await run([l], now)).toMatchObject({ scheduled: 0, skipped: 0 });
    });

    it('skips the document nudge (email 2) as soon as a document is in', async () => {
      const now = new Date();
      const l = await lead({ createdAt: new Date(now.getTime() - 2 * DAY - HOUR) });
      await sent(l, 1, new Date(l.created_at));
      const { error } = await db.from('documents').insert({ lead_id: l.id, doc_type: 'passport', status: 'received' as const });
      expect(error).toBeNull();

      expect(await run([l], now)).toMatchObject({ scheduled: 0, skipped: 1 });
      expect((await stateOf(l)).find((s) => s.number === 2)).toMatchObject({
        status: 'skipped',
        reason: 'documents_started',
      });
    });

    it('does not send a burst after downtime: old emails are skipped, one current email goes out', async () => {
      const now = new Date();
      const l = await lead({ createdAt: new Date(now.getTime() - 12 * DAY) });
      await sent(l, 1, new Date(l.created_at));

      expect(await run([l], now)).toMatchObject({ scheduled: 1, skipped: 4, errors: 0 });
      const state = await stateOf(l);
      expect(state.filter((s) => s.status === 'skipped').map((s) => [s.number, s.reason])).toEqual([
        [2, 'missed_window'],
        [3, 'missed_window'],
        [4, 'missed_window'],
        [5, 'missed_window'],
      ]);
      expect(state.find((s) => s.number === 6)).toMatchObject({ status: 'queued' });
      expect((await eventsOf(l)).map((e) => e.dedupe_key)).toEqual([`welcome:${l.id}:6`]);
    });

    it('keeps the minimum gap between two emails', async () => {
      const now = new Date();
      const tooSoon = await lead({ createdAt: new Date(now.getTime() - 3 * DAY - HOUR) });
      await sent(tooSoon, 1, new Date(tooSoon.created_at));
      await sent(tooSoon, 2, new Date(now.getTime() - 14 * HOUR));
      const fine = await lead({ createdAt: new Date(now.getTime() - 3 * DAY - HOUR) });
      await sent(fine, 1, new Date(fine.created_at));
      await sent(fine, 2, new Date(now.getTime() - 21 * HOUR));

      expect(await run([tooSoon, fine], now)).toMatchObject({ leads: 2, scheduled: 1, skipped: 0 });
      expect(await eventsOf(tooSoon)).toHaveLength(0);
      expect((await eventsOf(fine)).map((e) => e.dedupe_key)).toEqual([`welcome:${fine.id}:3`]);
    });

    it('stops for good: unsubscribed, submitted and past-the-application leads get nothing', async () => {
      const now = new Date();
      const old = new Date(now.getTime() - 5 * DAY);
      const unsub = await lead({ createdAt: old, unsubscribedAt: new Date(now.getTime() - DAY) });
      const submitted = await lead({ createdAt: old, submittedAt: new Date(now.getTime() - DAY) });
      const review = await lead({ createdAt: old, stage: 'review' });
      const result = await run([unsub, submitted, review], now);
      // the first two are filtered out by the query, the third by the plan
      expect(result).toMatchObject({ leads: 1, scheduled: 0, skipped: 0, stopped: 1 });
      for (const l of [unsub, submitted, review]) {
        expect(await eventsOf(l)).toHaveLength(0);
        expect(await stateOf(l)).toHaveLength(0);
      }
    });

    it('stops when the team has set a status, although the case is still at an early stage; the applicant\'s own statuses carry on', async () => {
      const now = new Date();
      const old = new Date(now.getTime() - 5 * DAY);
      const closed = await lead({ createdAt: old, status: 'review_completed' });
      const contacting = await lead({ createdAt: old, status: 'contacting' });
      const own = await lead({ createdAt: old, status: 'application_incomplete' });
      const result = await run([closed, contacting, own], now);
      expect(result).toMatchObject({ leads: 3, stopped: 2 });
      for (const l of [closed, contacting]) expect(await eventsOf(l)).toHaveLength(0);
      expect((await eventsOf(own)).length).toBeGreaterThan(0);
    });

    it('ignores leads older than 47 days and leads created by Google sign-in that never answered the questions', async () => {
      const now = new Date();
      const ancient = await lead({ createdAt: new Date(now.getTime() - 48 * DAY) });
      const oauth = await lead({ createdAt: new Date(now.getTime() - 3 * DAY), source: 'oauth' });
      expect(await run([ancient, oauth], now)).toMatchObject({ leads: 0, scheduled: 0 });
      expect(await eventsOf(ancient)).toHaveLength(0);
      expect(await eventsOf(oauth)).toHaveLength(0);
    });

    it('a Google sign-in lead that has answered the eligibility questions is a lead like any other', async () => {
      const now = new Date();
      const oauth = await lead({
        createdAt: new Date(now.getTime() - 10 * 60_000),
        source: 'oauth',
        answers: { country: 'germany', relative: 'grandparent' },
      });
      expect(await run([oauth], now)).toMatchObject({ leads: 1, scheduled: 1 });
      expect((await eventsOf(oauth)).map((e) => e.dedupe_key)).toEqual([`welcome:${oauth.id}:1`]);
    });

    it('sends email 1 to a lead that was never started (the lead creation could not queue it)', async () => {
      const now = new Date();
      const l = await lead({ createdAt: new Date(now.getTime() - 10 * 60_000) });
      expect(await run([l], now)).toMatchObject({ scheduled: 1 });
      expect((await eventsOf(l)).map((e) => e.dedupe_key)).toEqual([`welcome:${l.id}:1`]);
      expect(await run([l], now)).toMatchObject({ scheduled: 0 });
    });

    it('recovers when the event exists but its sequence row was never written', async () => {
      const now = new Date();
      const l = await lead({ createdAt: new Date(now.getTime() - 2 * DAY - HOUR) });
      await sent(l, 1, new Date(l.created_at));
      const { data: event } = await db
        .from('events')
        .insert({
          type: 'email.send',
          channel: 'email',
          lead_id: l.id,
          payload: { template: 'welcome-2' },
          dedupe_key: `welcome:${l.id}:2`,
        })
        .select('*')
        .single();
      expect(await run([l], now)).toMatchObject({ scheduled: 1, errors: 0 });
      expect(await eventsOf(l)).toHaveLength(1); // no second email
      expect((await stateOf(l)).find((s) => s.number === 2)).toMatchObject({
        status: 'queued',
        event_id: event!.id,
      });
    });
  });

  describe('syncSequenceDelivery', () => {
    it('marks a queued email as sent once its event was delivered', async () => {
      const l = await lead({ createdAt: new Date() });
      await drip.startWelcomeSequence(l);
      const [event] = await eventsOf(l);
      await db
        .from('events')
        .update({ status: 'sent', delivered_at: new Date().toISOString() })
        .eq('id', event!.id);
      expect(await drip.syncSequenceDelivery(db)).toBeGreaterThanOrEqual(1);
      expect((await stateOf(l))[0]).toMatchObject({ number: 1, status: 'sent' });
    });
  });
});
