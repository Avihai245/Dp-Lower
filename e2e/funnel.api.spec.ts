import { expect, test, type APIRequestContext } from '@playwright/test';
import {
  BASE_URL,
  cleanup,
  createAuthUser,
  eventually,
  eventsOf,
  leadBody,
  leadByEmail,
  linkIn,
  makeStaff,
  newClient,
  newEmail,
  newIp,
  passwordSignIn,
  recoveryTokenHash,
  rest,
  setCookies,
  signAppToken,
  uuid,
} from './support/funnel';

/**
 * API integration tests of the campaign funnel against a running dev/prod server (FUNNEL_BASE_URL, default
 * http://localhost:3103) and the local Supabase. Every "browser" is its own APIRequestContext with its own cookie jar
 * and its own x-forwarded-for address, so the per-IP rate limits of one test never affect another.
 *
 *   FUNNEL_BASE_URL=http://localhost:3103 pnpm exec playwright test e2e/funnel.api.spec.ts
 */
test.describe.configure({ mode: 'serial' });
test.use({ baseURL: BASE_URL });
test.afterAll(cleanup);

interface Slot {
  startsAt: string;
  firmTime: string;
  remaining: number;
}
interface Day {
  date: string;
  weekday: number;
  slots: Slot[];
}

async function availability(request: APIRequestContext): Promise<{ days: Day[]; seatsLeft: number; timezone: string; callMinutes: number }> {
  const res = await request.get('/api/availability');
  expect(res.status()).toBe(200);
  return res.json();
}

/** A slot that is still completely free (2 seats), counted from the back so tests rarely meet each other. */
async function freeSlot(request: APIRequestContext, fromEnd = 0): Promise<Slot> {
  const slots = (await availability(request)).days.flatMap((d) => d.slots).filter((s) => s.remaining === 2);
  const slot = slots[slots.length - 1 - fromEnd];
  if (!slot) throw new Error('no completely free slot left in the next days');
  return slot;
}

async function createLead(client: APIRequestContext, label: string, extra: Record<string, unknown> = {}) {
  const email = newEmail(label);
  const res = await client.post('/api/leads', { data: leadBody(email, extra) });
  expect(res.status(), await res.text()).toBe(201);
  const body = (await res.json()) as { status: string; leadId: string; caseRef: string };
  return { email, ...body };
}

async function leadEvent(leadId: string, type: string) {
  return eventually(async () => (await eventsOf(leadId)).find((e) => e.type === type), `${type} for ${leadId}`);
}
async function emailEvent(leadId: string, template: string) {
  return eventually(
    async () => (await eventsOf(leadId)).find((e) => e.type === 'email.send' && e.payload.template === template),
    `${template} email for ${leadId}`,
  );
}

test.describe('availability', () => {
  test('returns the next bookable days with real free slots as UTC instants', async ({ request }) => {
    const res = await request.get('/api/availability');
    expect(res.status()).toBe(200);
    expect(res.headers()['cache-control']).toContain('no-store');
    const body = await res.json();

    expect(body.timezone).toBe('Asia/Jerusalem');
    expect(body.callMinutes).toBe(20);
    expect(body.days.length).toBeGreaterThan(0);
    expect(body.days.length).toBeLessThanOrEqual(5);

    let seats = 0;
    let previous = '';
    for (const day of body.days as Day[]) {
      expect(day.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(day.date > previous).toBe(true);
      previous = day.date;
      expect(day.weekday).toBe(new Date(`${day.date}T12:00:00Z`).getUTCDay());
      expect(day.slots.length).toBeGreaterThan(0);
      for (const s of day.slots) {
        expect(s.startsAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00\.000Z$/);
        expect(Date.parse(s.startsAt)).toBeGreaterThan(Date.now());
        expect(s.firmTime).toMatch(/^\d{2}:\d{2}$/);
        expect(s.remaining).toBeGreaterThanOrEqual(1);
        expect(s.remaining).toBeLessThanOrEqual(2);
        seats += s.remaining;
      }
    }
    expect(body.seatsLeft).toBe(seats);
  });
});

test.describe('POST /api/leads', () => {
  test('creates a lead: capitalised name, route, cookie, outbox event, activity', async ({ request }) => {
    const email = newEmail('create');
    const res = await request.post('/api/leads', { data: leadBody(email, { source: 'e2e-test', utm: { utm_source: 'unit' } }), headers: { 'x-forwarded-for': newIp() } });
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.status).toBe('created');
    expect(body.leadId).toMatch(/^[0-9a-f-]{36}$/);
    expect(body.caseRef).toMatch(/^DPL-\d{2}-\d{4}$/);

    const cookie = setCookies(res).find((c) => c.startsWith('dpl_lead='));
    expect(cookie, 'lead cookie').toBeTruthy();
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=lax/i);

    const lead = await leadByEmail(email);
    expect(lead).toMatchObject({
      id: body.leadId,
      full_name: 'Anna Reinhardt',
      email,
      phone: '+1 555 000 0000',
      locale: 'en',
      route: 'germany',
      source: 'e2e-test',
      stage: 'lead',
      status: 'enquiry',
      consented_at: null,
    });
    expect(lead?.answers).toEqual({ country: 'germany', relative: 'grandparent' });
    expect(lead?.utm).toEqual({ utm_source: 'unit' });

    const created = await leadEvent(body.leadId, 'lead.created');
    expect(created.channel).toBe('crm');
    expect(created.dedupe_key).toBe(`lead.created:${body.leadId}`);
    expect((created.payload.lead as { caseRef: string }).caseRef).toBe(body.caseRef);

    const activity = await rest<{ code: string }>('activity_log', `lead_id=eq.${body.leadId}&select=code`);
    expect(activity.map((a) => a.code)).toContain('lead_created');
  });

  test('takes the source and utm from the first-touch cookies when the body has none', async ({ playwright }) => {
    const client = await newClient(playwright);
    const email = newEmail('firsttouch');
    const res = await client.post('/api/leads', {
      data: leadBody(email),
      headers: { cookie: `dpl_src=main-site; dpl_utm=${encodeURIComponent(JSON.stringify({ utm_campaign: 'spring', utm_medium: 'cpc' }))}` },
    });
    expect(res.status()).toBe(201);
    const lead = await leadByEmail(email);
    expect(lead?.source).toBe('main-site');
    expect(lead?.utm).toEqual({ utm_campaign: 'spring', utm_medium: 'cpc' });
    await client.dispose();
  });

  test('the same browser updates name, phone and merges answers', async ({ playwright }) => {
    const client = await newClient(playwright);
    const first = await createLead(client, 'update');
    const res = await client.post('/api/leads', {
      data: leadBody(first.email, { fullName: "mary o'neil-smith", phone: '+44 20 7946 0000', answers: { when: 'before_1933', relative: 'parent' }, locale: 'he' }),
    });
    expect(res.status()).toBe(200);
    expect(await res.json()).toMatchObject({ status: 'updated', leadId: first.leadId, caseRef: first.caseRef });

    const lead = await leadByEmail(first.email);
    expect(lead?.full_name).toBe("Mary O'Neil-Smith");
    expect(lead?.phone).toBe('+44 20 7946 0000');
    expect(lead?.locale).toBe('he');
    expect(lead?.answers).toEqual({ country: 'germany', relative: 'parent', when: 'before_1933' });

    const me = await (await client.get('/api/lead')).json();
    expect(me).toMatchObject({ leadId: first.leadId, fullName: "Mary O'Neil-Smith", firstName: 'Mary', locale: 'he' });
    await client.dispose();
  });

  test('a known email from another browser changes NOTHING, answers existing and emails a link', async ({ playwright }) => {
    const owner = await newClient(playwright);
    const first = await createLead(owner, 'existing');
    const before = await leadByEmail(first.email);

    const stranger = await newClient(playwright);
    const res = await stranger.post('/api/leads', {
      data: leadBody(first.email, { fullName: 'Mallory Mallory', phone: '+1 555 999 9999', answers: { country: 'austria', when: 'after_1945' }, locale: 'he' }),
    });
    expect(res.status()).toBe(200);
    // the response reveals nothing but the outcome: no id, no case reference, no name, no cookie
    expect(await res.json()).toEqual({ status: 'existing' });
    expect(setCookies(res)).toEqual([]);

    const after = await leadByEmail(first.email);
    expect(after).toEqual(before);
    expect(await stranger.get('/api/lead').then((r) => r.status())).toBe(401);

    const returned = await leadEvent(first.leadId, 'lead.returned');
    expect(returned.channel).toBe('crm');
    const mail = await emailEvent(first.leadId, 'file-open');
    expect(mail.payload.to?.email).toBe(first.email);
    expect(linkIn(mail.payload, /https?:\/\/[^\s"'<>]+\/go\/[\w.-]+/), 'portal link in the email').toBeTruthy();

    // asking again within the hour does not send a second email (no inbox flooding)
    await stranger.post('/api/leads', { data: leadBody(first.email) });
    const mails = (await eventsOf(first.leadId)).filter((e) => e.type === 'email.send' && e.payload.template === 'file-open');
    expect(mails).toHaveLength(1);
    await owner.dispose();
    await stranger.dispose();
  });

  test('rejects invalid input, a bad origin and answers outside the quiz', async ({ request }) => {
    const ip = newIp();
    const post = (data: unknown, headers: Record<string, string> = {}) =>
      request.post('/api/leads', { data, headers: { 'x-forwarded-for': ip, ...headers } });

    const badEmail = await post(leadBody('not-an-email'));
    expect(badEmail.status()).toBe(400);
    expect((await badEmail.json()).error).toBe('invalid_body');
    expect((await post(leadBody(newEmail('x'), { fullName: 'A' }))).status()).toBe(400);
    expect((await post(leadBody(newEmail('x'), { phone: '123' }))).status()).toBe(400);
    expect((await post(leadBody(newEmail('x'), { answers: { country: 'mars' } }))).status()).toBe(400);
    expect((await post(leadBody(newEmail('x'), { answers: { unknown: 'x' } }))).status()).toBe(400);

    const evil = await post(leadBody(newEmail('evil')), { origin: 'https://evil.example' });
    expect(evil.status()).toBe(403);
    expect((await evil.json()).error).toBe('bad_origin');
  });

  test('a filled honeypot looks like a success but stores nothing', async ({ request }) => {
    const email = newEmail('bot');
    const res = await request.post('/api/leads', { data: leadBody(email, { website: 'https://spam.example' }), headers: { 'x-forwarded-for': newIp() } });
    expect(res.status()).toBe(201);
    expect(await leadByEmail(email)).toBeNull();
  });

  test('is rate limited to 10 requests a minute per address (429)', async ({ request }) => {
    const ip = newIp();
    const statuses: number[] = [];
    for (let i = 0; i < 12; i++) {
      const res = await request.post('/api/leads', { data: {}, headers: { 'x-forwarded-for': ip } });
      statuses.push(res.status());
    }
    expect(statuses.slice(0, 10).every((s) => s === 400)).toBe(true);
    expect(statuses.slice(10)).toEqual([429, 429]);
    const limited = await request.post('/api/leads', { data: {}, headers: { 'x-forwarded-for': ip } });
    expect((await limited.json()).error).toBe('rate_limited');
    // another address is unaffected
    const other = await request.post('/api/leads', { data: {}, headers: { 'x-forwarded-for': newIp() } });
    expect(other.status()).toBe(400);
  });
});

test.describe('GET /api/lead and PUT /api/lead/answers', () => {
  test('401 without a cookie or session; the summary has no secrets', async ({ playwright }) => {
    const anonymous = await newClient(playwright);
    expect((await anonymous.get('/api/lead')).status()).toBe(401);

    const client = await newClient(playwright);
    const lead = await createLead(client, 'summary');
    const me = await (await client.get('/api/lead')).json();
    expect(me).toMatchObject({
      leadId: lead.leadId,
      caseRef: lead.caseRef,
      email: lead.email,
      route: 'germany',
      stage: 'lead',
      status: 'enquiry',
      accountCreated: false,
      passwordSet: false,
      emailVerified: false,
      booking: null,
    });
    expect(Object.keys(me)).not.toContain('session_epoch');
    expect(Object.keys(me)).not.toContain('user_id');
    await anonymous.dispose();
    await client.dispose();
  });

  test('PUT /api/lead/answers merges and recomputes the route', async ({ playwright }) => {
    const client = await newClient(playwright);
    const lead = await createLead(client, 'answers');
    const res = await client.put('/api/lead/answers', { data: { answers: { country: 'both', residence: 'uk' } } });
    expect(res.status()).toBe(200);
    const me = await (await client.get('/api/lead')).json();
    expect(me.answers).toEqual({ country: 'both', relative: 'grandparent', residence: 'uk' });
    expect(me.route).toBe('both');
    expect((await client.put('/api/lead/answers', { data: { answers: { country: 'mars' } } })).status()).toBe(400);
    expect((await (await newClient(playwright)).put('/api/lead/answers', { data: { answers: {} } })).status()).toBe(401);
    expect(lead.leadId).toBeTruthy();
    await client.dispose();
  });
});

test.describe('bookings', () => {
  test('happy path: books a real slot, shows on the lead, queues the confirmation, takes a seat', async ({ playwright }) => {
    const client = await newClient(playwright);
    const lead = await createLead(client, 'book');
    const slot = await freeSlot(client, 3);

    const res = await client.post('/api/bookings', { data: { startsAt: slot.startsAt, timezone: 'America/New_York' } });
    expect(res.status(), await res.text()).toBe(201);
    const { booking } = await res.json();
    expect(booking).toMatchObject({ startsAt: slot.startsAt, timezone: 'America/New_York' });
    expect(Date.parse(booking.endsAt) - Date.parse(booking.startsAt)).toBe(20 * 60_000);

    const me = await (await client.get('/api/lead')).json();
    expect(me.booking).toEqual(booking);

    const created = await leadEvent(lead.leadId, 'booking.created');
    expect(created.dedupe_key).toBe(`booking.created:${booking.id}`);
    const mail = await emailEvent(lead.leadId, 'booking-confirmation');
    expect(mail.payload.to?.email).toBe(lead.email);
    const activity = await rest<{ code: string }>('activity_log', `lead_id=eq.${lead.leadId}&select=code`);
    expect(activity.map((a) => a.code)).toContain('booking_created');

    const day = (await availability(client)).days.flatMap((d) => d.slots).find((s) => s.startsAt === slot.startsAt);
    expect(day?.remaining).toBe(1);

    // asking for the slot you already hold changes nothing
    const again = await client.post('/api/bookings', { data: { startsAt: slot.startsAt, timezone: 'America/New_York' } });
    expect(again.status()).toBe(200);
    expect((await again.json()).booking.id).toBe(booking.id);

    // moving the call replaces the booking and tells the CRM
    const other = await freeSlot(client, 4);
    const moved = await client.post('/api/bookings', { data: { startsAt: other.startsAt, timezone: 'Europe/London' } });
    expect(moved.status()).toBe(201);
    const movedBooking = (await moved.json()).booking;
    expect(movedBooking.id).not.toBe(booking.id);
    const cancelled = await leadEvent(lead.leadId, 'booking.cancelled');
    expect(cancelled.dedupe_key).toBe(`booking.cancelled:${booking.id}`);
    expect((await (await client.get('/api/lead')).json()).booking.id).toBe(movedBooking.id);
    const old = (await availability(client)).days.flatMap((d) => d.slots).find((s) => s.startsAt === slot.startsAt);
    expect(old?.remaining).toBe(2);

    // and it can be cancelled
    expect((await client.delete('/api/bookings')).status()).toBe(200);
    expect((await (await client.get('/api/lead')).json()).booking).toBeNull();
    expect((await client.delete('/api/bookings')).status()).toBe(404);
    await emailEvent(lead.leadId, 'booking-cancelled');
    await client.dispose();
  });

  test('a slot has two seats: the third booking gets 409 slot_unavailable', async ({ playwright }) => {
    const slot = await freeSlot(await newClient(playwright), 0);
    const clients: APIRequestContext[] = [];
    const results: number[] = [];
    for (let i = 0; i < 3; i++) {
      const c = await newClient(playwright);
      clients.push(c);
      await createLead(c, `seat${i}`);
      const res = await c.post('/api/bookings', { data: { startsAt: slot.startsAt, timezone: 'Asia/Jerusalem' } });
      results.push(res.status());
      if (i === 2) expect((await res.json()).error).toBe('slot_unavailable');
    }
    expect(results).toEqual([201, 201, 409]);
    const listed = (await availability(clients[0]!)).days.flatMap((d) => d.slots).some((s) => s.startsAt === slot.startsAt);
    expect(listed, 'a full slot disappears from the availability').toBe(false);
    await Promise.all(clients.map((c) => c.dispose()));
  });

  test('concurrent requests for the last seats never overbook', async ({ playwright }) => {
    const slot = await freeSlot(await newClient(playwright), 1);
    const clients = await Promise.all([0, 1, 2, 3].map(() => newClient(playwright)));
    await Promise.all(clients.map((c, i) => createLead(c, `race${i}`)));
    const results = await Promise.all(clients.map((c) => c.post('/api/bookings', { data: { startsAt: slot.startsAt, timezone: 'Asia/Jerusalem' } })));
    const statuses = results.map((r) => r.status()).sort();
    expect(statuses).toEqual([201, 201, 409, 409]);
    await Promise.all(clients.map((c) => c.dispose()));
  });

  test('rejects slots that are not on offer, malformed input and anonymous callers', async ({ playwright }) => {
    const client = await newClient(playwright);
    await createLead(client, 'invalid');
    const slot = await freeSlot(client, 5);
    const post = (data: unknown) => client.post('/api/bookings', { data });

    // a quarter past a real slot, the past, a Friday (outside the weekly template), and too soon
    const offTemplate = new Date(Date.parse(slot.startsAt) + 15 * 60_000).toISOString();
    for (const startsAt of [offTemplate, '2020-01-05T07:00:00.000Z', new Date(Date.now() + 30 * 60_000).toISOString()]) {
      const res = await post({ startsAt, timezone: 'Asia/Jerusalem' });
      expect(res.status(), startsAt).toBe(409);
      expect((await res.json()).error).toBe('slot_unavailable');
    }
    expect((await post({ startsAt: 'next tuesday', timezone: 'Asia/Jerusalem' })).status()).toBe(400);
    expect((await post({ startsAt: slot.startsAt, timezone: 'Mars/Olympus' })).status()).toBe(400);
    expect((await post({})).status()).toBe(400);

    const anonymous = await newClient(playwright);
    expect((await anonymous.post('/api/bookings', { data: { startsAt: slot.startsAt, timezone: 'Asia/Jerusalem' } })).status()).toBe(401);
    expect((await anonymous.delete('/api/bookings')).status()).toBe(401);
    await client.dispose();
    await anonymous.dispose();
  });
});

test.describe('callbacks', () => {
  test('stores a request, emits callback.requested, links the lead when there is a cookie', async ({ playwright }) => {
    const anonymous = await newClient(playwright);
    const name = `e2e-funnel-${Date.now()}`;
    const res = await anonymous.post('/api/callbacks', { data: { name, phone: '+1 (718) 555-0142', locale: 'en', source: 'advisor' } });
    expect(res.status()).toBe(201);
    expect(await res.json()).toEqual({ ok: true });
    const rows = await rest<{ id: string; lead_id: string | null; phone: string; source: string | null; status: string }>(
      'callback_requests',
      `name=eq.${encodeURIComponent(name)}&select=*`,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ lead_id: null, phone: '+1 (718) 555-0142', source: 'advisor', status: 'new' });
    const ev = await eventually(async () => (await rest<{ type: string }>('events', `dedupe_key=eq.callback.requested:${rows[0]!.id}&select=type`))[0], 'callback.requested event');
    expect(ev.type).toBe('callback.requested');

    const client = await newClient(playwright);
    const lead = await createLead(client, 'callback');
    const linked = await client.post('/api/callbacks', { data: { phone: '+44 20 7946 0000', locale: 'en' } });
    expect(linked.status()).toBe(201);
    const row = (await rest<{ lead_id: string | null; name: string | null }>('callback_requests', `lead_id=eq.${lead.leadId}&select=lead_id,name`))[0];
    expect(row?.lead_id).toBe(lead.leadId);
    expect(row?.name).toBe('Anna Reinhardt');
    await leadEvent(lead.leadId, 'callback.requested');

    expect((await anonymous.post('/api/callbacks', { data: { phone: '12' } })).status()).toBe(400);
    expect((await anonymous.post('/api/callbacks', { data: { phone: '+1 555 000 1234', website: 'x' } })).status()).toBe(201);
    await anonymous.dispose();
    await client.dispose();
  });

  test('is rate limited to 5 requests a minute per address', async ({ request }) => {
    const ip = newIp();
    const statuses: number[] = [];
    for (let i = 0; i < 7; i++) {
      statuses.push((await request.post('/api/callbacks', { data: { phone: 'x' }, headers: { 'x-forwarded-for': ip } })).status());
    }
    expect(statuses).toEqual([400, 400, 400, 400, 400, 429, 429]);
  });
});

test.describe('result email', () => {
  test('queues the file-open email once, marks result_emailed_at and tells the CRM', async ({ playwright }) => {
    const client = await newClient(playwright);
    const lead = await createLead(client, 'result');
    const res = await client.post('/api/results/email');
    expect(res.status()).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    const mail = await emailEvent(lead.leadId, 'file-open');
    expect(mail.payload.to?.email).toBe(lead.email);
    expect(linkIn(mail.payload, /https?:\/\/[^\s"'<>]+\/go\/[\w.-]+/)).toBeTruthy();
    await leadEvent(lead.leadId, 'result.requested');
    expect((await leadByEmail(lead.email))?.result_emailed_at).toBeTruthy();

    // a second click in the same hour answers ok without a second email
    expect((await client.post('/api/results/email')).status()).toBe(200);
    const mails = (await eventsOf(lead.leadId)).filter((e) => e.type === 'email.send');
    expect(mails.filter((e) => e.payload.template === 'file-open')).toHaveLength(1);
    // creating the lead also started the nurture sequence: welcome-1, queued exactly once
    expect(mails.filter((e) => e.payload.template === 'welcome-1')).toHaveLength(1);

    const anonymous = await newClient(playwright);
    expect((await anonymous.post('/api/results/email')).status()).toBe(401);
    await client.dispose();
    await anonymous.dispose();
  });
});

test.describe('portal entry, passwords and emailed links', () => {
  test('POST /api/portal/enter signs the lead-cookie browser in, without a password', async ({ playwright }) => {
    const anonymous = await newClient(playwright);
    expect((await anonymous.post('/api/portal/enter')).status()).toBe(401);

    const client = await newClient(playwright);
    const lead = await createLead(client, 'enter');
    const res = await client.post('/api/portal/enter');
    expect(res.status(), await res.text()).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    const cookies = setCookies(res);
    expect(cookies.some((c) => /^sb-[\w-]+-auth-token/.test(c)), 'supabase session cookie').toBe(true);
    expect(cookies.some((c) => c.startsWith('dpl_lead=')), 'renewed lead cookie').toBe(true);

    const me = await (await client.get('/api/lead')).json();
    expect(me).toMatchObject({ leadId: lead.leadId, accountCreated: true, stage: 'account', status: 'account_created' });
    const account = await leadEvent(lead.leadId, 'account.created');
    expect(account.dedupe_key).toBe(`account.created:${lead.leadId}`);
    await anonymous.dispose();
    await client.dispose();
  });

  test('POST /api/auth/set-password needs a session, validates, and really sets the password', async ({ playwright }) => {
    const client = await newClient(playwright);
    const lead = await createLead(client, 'password');
    // the lead cookie alone is not enough
    expect((await client.post('/api/auth/set-password', { data: { password: 'correct-horse-9' } })).status()).toBe(401);

    await client.post('/api/portal/enter');
    expect((await client.post('/api/auth/set-password', { data: { password: 'short' } })).status()).toBe(400);
    expect((await client.post('/api/auth/set-password', { data: {} })).status()).toBe(400);
    const ok = await client.post('/api/auth/set-password', { data: { password: 'correct-horse-9' } });
    expect(ok.status(), await ok.text()).toBe(200);

    // this browser stays signed in, the lead records it, and the password works against the auth server
    const me = await (await client.get('/api/lead')).json();
    expect(me.passwordSet).toBe(true);
    expect((await leadByEmail(lead.email))?.password_set_at).toBeTruthy();
    expect(await passwordSignIn(lead.email, 'correct-horse-9')).toBe(true);
    expect(await passwordSignIn(lead.email, 'wrong-password-1')).toBe(false);
    const activity = await rest<{ code: string }>('activity_log', `lead_id=eq.${lead.leadId}&select=code`);
    expect(activity.map((a) => a.code)).toContain('password_set');
    await client.dispose();
  });

  test('POST /api/auth/forgot always answers 200 and only queues a reset for a known address', async ({ playwright }) => {
    const client = await newClient(playwright);
    const lead = await createLead(client, 'forgot');
    const stranger = await newClient(playwright);

    const known = await stranger.post('/api/auth/forgot', { data: { email: lead.email, locale: 'en' } });
    const unknown = await stranger.post('/api/auth/forgot', { data: { email: newEmail('nobody'), locale: 'en' } });
    expect(known.status()).toBe(200);
    expect(unknown.status()).toBe(200);
    expect(await known.json()).toEqual({ ok: true });
    expect(await unknown.json()).toEqual(await known.json());

    const mail = await emailEvent(lead.leadId, 'password-reset');
    expect(mail.payload.to?.email).toBe(lead.email);
    expect(mail.channel).toBe('email');
    expect((await stranger.post('/api/auth/forgot', { data: { email: 'nope' } })).status()).toBe(400);
    await client.dispose();
    await stranger.dispose();
  });

  test('forgot is rate limited to 5 requests a minute per address', async ({ request }) => {
    const ip = newIp();
    const statuses: number[] = [];
    for (let i = 0; i < 7; i++) {
      statuses.push((await request.post('/api/auth/forgot', { data: { email: newEmail('rl') }, headers: { 'x-forwarded-for': ip } })).status());
    }
    expect(statuses).toEqual([200, 200, 200, 200, 200, 429, 429]);
  });

  test('the recovery link signs the owner in and the new password replaces the old one', async ({ playwright }) => {
    const owner = await newClient(playwright);
    const lead = await createLead(owner, 'recovery');
    await owner.post('/api/portal/enter');
    await owner.post('/api/auth/set-password', { data: { password: 'first-password-1' } });

    const row = await leadByEmail(lead.email);
    const tokenHash = await recoveryTokenHash(lead.email);

    // a mail scanner "clicks" the link with a GET: that only forwards to the confirmation page and uses nothing up
    const url = `/auth/callback?token_hash=${encodeURIComponent(tokenHash)}&type=recovery&next=${encodeURIComponent('/create-password?mode=reset')}`;
    const scan = await (await newClient(playwright)).get(url, { maxRedirects: 0 });
    expect(scan.status()).toBe(303);
    expect(new URL(scan.headers().location!).pathname).toBe('/open-link');
    expect(setCookies(scan).some((c) => /auth-token/.test(c))).toBe(false);

    // the owner opens the reset link in the browser that created the lead and presses the button: no revocation,
    // lands on the reset screen
    const res = await owner.post('/auth/callback', { form: { token_hash: tokenHash, type: 'recovery', next: '/create-password?mode=reset' }, maxRedirects: 0 });
    expect(res.status()).toBe(303);
    expect(new URL(res.headers().location!).pathname + new URL(res.headers().location!).search).toBe('/create-password?mode=reset');
    expect((await leadByEmail(lead.email))?.email_verified_at).toBeTruthy();
    expect((await leadByEmail(lead.email))?.session_epoch).toBe(row?.session_epoch);

    expect((await owner.post('/api/auth/set-password', { data: { password: 'second-password-2' } })).status()).toBe(200);
    expect(await passwordSignIn(lead.email, 'first-password-1')).toBe(false);
    expect(await passwordSignIn(lead.email, 'second-password-2')).toBe(true);

    // a Hebrew link keeps the language prefix; a tampered or unknown token goes back to sign-in with a message
    const heGet = await (await newClient(playwright)).get('/he/auth/callback?token_hash=garbage&type=recovery', { maxRedirects: 0 });
    expect(new URL(heGet.headers().location!).pathname).toBe('/he/open-link');
    const he = await (await newClient(playwright)).post('/he/auth/callback', { form: { token_hash: 'garbage', type: 'recovery' }, maxRedirects: 0 });
    expect(he.status()).toBe(303);
    expect(new URL(he.headers().location!).pathname + new URL(he.headers().location!).search).toBe('/he/sign-in?error=link');
    const oauthDenied = await (await newClient(playwright)).get('/auth/callback?error=access_denied', { maxRedirects: 0 });
    expect(new URL(oauthDenied.headers().location!).pathname + new URL(oauthDenied.headers().location!).search).toBe('/sign-in?error=oauth');
    await owner.dispose();
  });

  test('an emailed /go link opens the portal; a link used on another browser revokes what was set before', async ({ playwright }) => {
    // attacker pre-registers somebody else's email in browser X and sets a password
    const attacker = await newClient(playwright);
    const lead = await createLead(attacker, 'prereg');
    await attacker.post('/api/portal/enter');
    expect((await attacker.post('/api/auth/set-password', { data: { password: 'attacker-pass-1' } })).status()).toBe(200);
    expect(await passwordSignIn(lead.email, 'attacker-pass-1')).toBe(true);
    expect((await attacker.get('/api/lead')).status()).toBe(200);

    // the real owner types the email in their own browser: "existing", and the mailbox receives a link
    const owner = await newClient(playwright);
    const existing = await owner.post('/api/leads', { data: leadBody(lead.email) });
    expect((await existing.json()).status).toBe('existing');
    const mail = await emailEvent(lead.leadId, 'file-open');
    const link = linkIn(mail.payload, /https?:\/\/[^\s"'<>]+\/go\/[\w.-]+/)!;
    expect(link).toBeTruthy();

    // a mail scanner opening the link (GET, no cookies) must change nothing: it is forwarded to the confirmation page
    const before = await leadByEmail(lead.email);
    const scan = await (await newClient(playwright)).get(new URL(link).pathname, { maxRedirects: 0 });
    expect(scan.status()).toBe(303);
    expect(new URL(scan.headers().location!).pathname).toBe('/open-link');
    expect(setCookies(scan).some((c) => /auth-token/.test(c))).toBe(false);
    expect(await leadByEmail(lead.email)).toMatchObject({ email_verified_at: null, session_epoch: before?.session_epoch });
    expect(await passwordSignIn(lead.email, 'attacker-pass-1')).toBe(true);

    // ...a person presses "Open my portal" (the form POST): signed in, sent to the portal
    const go = await owner.post(new URL(link).pathname, { maxRedirects: 0 });
    expect(go.status()).toBe(303);
    expect(new URL(go.headers().location!).pathname).toBe('/portal');
    expect(setCookies(go).some((c) => /^sb-[\w-]+-auth-token/.test(c))).toBe(true);

    const after = await leadByEmail(lead.email);
    expect(after?.email_verified_at).toBeTruthy();
    // opened on a different browser than the creator's: the attacker's password, sessions and cookie are gone
    expect(after?.session_epoch).toBe((before?.session_epoch ?? 0) + 1);
    expect(after?.password_set_at).toBeNull();
    expect(await passwordSignIn(lead.email, 'attacker-pass-1')).toBe(false);
    expect((await attacker.get('/api/lead')).status(), 'the attacker is locked out').toBe(401);
    expect((await owner.get('/api/lead')).status()).toBe(200);

    // the old link is bound to the old epoch: it now lands on the "request a new link" page
    const old = await (await newClient(playwright)).get(new URL(link).pathname, { maxRedirects: 0 });
    expect(old.status()).toBe(303);
    expect(new URL(old.headers().location!).pathname).toBe('/link-expired');
    await attacker.dispose();
    await owner.dispose();
  });

  test('bad /go tokens go to the link-expired page, never to the portal', async ({ playwright }) => {
    const client = await newClient(playwright);
    for (const [path, expected] of [
      ['/go/not-a-token', '/link-expired'],
      ['/he/go/not-a-token', '/he/link-expired'],
      [`/go/${signAppToken({ lid: uuid(), ep: 0, p: 'portal', n: '/portal' }, 3600)}`, '/link-expired'],
      [`/go/${signAppToken({ lid: uuid(), ep: 0, p: 'unsub' }, 3600)}`, '/link-expired'],
    ] as const) {
      const res = await client.get(path, { maxRedirects: 0 });
      expect(res.status(), path).toBe(303);
      expect(new URL(res.headers().location!).pathname, path).toBe(expected);
      expect(setCookies(res).some((c) => /auth-token/.test(c))).toBe(false);
    }
    await client.dispose();
  });

  test('a "next" smuggled into an emailed token cannot leave the site', async ({ playwright }) => {
    const owner = await newClient(playwright);
    const lead = await createLead(owner, 'nextsafe');
    const row = (await leadByEmail(lead.email))!;
    for (const n of ['https://evil.example/', '//evil.example', '/\\evil.example', 'javascript:alert(1)']) {
      const token = signAppToken({ lid: row.id, ep: row.session_epoch, p: 'portal', n }, 3600);
      const res = await owner.post(`/go/${token}`, { maxRedirects: 0 });
      expect(res.status()).toBe(303);
      const location = new URL(res.headers().location!);
      expect(location.origin).toBe(BASE_URL);
      expect(location.pathname).toBe('/portal');
    }
    await owner.dispose();
  });

  test('POST /api/auth/link always answers 200 and emails a fresh link only to a known address', async ({ playwright }) => {
    const client = await newClient(playwright);
    const lead = await createLead(client, 'newlink');
    const stranger = await newClient(playwright);
    const known = await stranger.post('/api/auth/link', { data: { email: lead.email } });
    const unknown = await stranger.post('/api/auth/link', { data: { email: newEmail('ghost') } });
    expect([known.status(), unknown.status()]).toEqual([200, 200]);
    expect(await known.json()).toEqual(await unknown.json());
    const mail = await emailEvent(lead.leadId, 'file-open');
    expect(mail.payload.to?.email).toBe(lead.email);
    await client.dispose();
    await stranger.dispose();
  });

  test('creating a new lead in a browser signed in as another lead ends that session', async ({ playwright }) => {
    const client = await newClient(playwright);
    const a = await createLead(client, 'sharedA');
    await client.post('/api/portal/enter');
    expect((await (await client.get('/api/lead')).json()).leadId).toBe(a.leadId);

    const b = await createLead(client, 'sharedB');
    const me = await (await client.get('/api/lead')).json();
    expect(me.leadId, 'the browser now acts as the new lead, not the old session').toBe(b.leadId);
    const slot = await freeSlot(client, 6);
    const booked = await client.post('/api/bookings', { data: { startsAt: slot.startsAt, timezone: 'Asia/Jerusalem' } });
    expect(booked.status()).toBe(201);
    expect((await rest<{ lead_id: string }>('bookings', `lead_id=eq.${b.leadId}&select=lead_id`)).length).toBe(1);
    expect((await rest<{ lead_id: string }>('bookings', `lead_id=eq.${a.leadId}&select=lead_id`)).length).toBe(0);
    await client.dispose();
  });
});

test.describe('staff', () => {
  test('a staff member has no lead: forgot-password still emails a reset link and the callback sends them to /admin', async ({ playwright }) => {
    const email = newEmail('staff');
    const userId = await createAuthUser(email, 'staff-pass-123');
    await makeStaff(userId, email);

    const client = await newClient(playwright);
    expect((await client.post('/api/auth/forgot', { data: { email, locale: 'en' } })).status()).toBe(200);
    const mail = await eventually(
      async () =>
        (await rest<{ lead_id: string | null; payload: { template?: string } }>('events', `type=eq.email.send&payload->to->>email=eq.${encodeURIComponent(email)}&select=lead_id,payload`))[0],
      'the staff reset email',
    );
    expect(mail.lead_id).toBeNull();
    expect(mail.payload.template).toBe('password-reset');

    // the recovery link signs the staff member in and goes to the admin area; no lead is invented for them
    const res = await client.post('/auth/callback', { form: { token_hash: await recoveryTokenHash(email), type: 'recovery' }, maxRedirects: 0 });
    expect(res.status()).toBe(303);
    expect(new URL(res.headers().location!).pathname).toBe('/admin');
    expect(setCookies(res).some((c) => /^sb-[\w-]+-auth-token/.test(c))).toBe(true);
    expect(await leadByEmail(email)).toBeNull();

    // an explicit next is validated like everybody else's: it can never leave the site
    const again = await client.post('/auth/callback', { form: { token_hash: await recoveryTokenHash(email), type: 'recovery', next: '//evil.example' }, maxRedirects: 0 });
    expect(new URL(again.headers().location!).origin).toBe(BASE_URL);
    await client.dispose();
  });
});

test.describe('unsubscribe', () => {
  test('opening the link never unsubscribes; the confirm POST does, once', async ({ playwright }) => {
    const client = await newClient(playwright);
    const lead = await createLead(client, 'unsub');
    const token = signAppToken({ lid: lead.leadId, p: 'unsub' });

    const page = await client.get(`/unsubscribe?t=${token}`);
    expect(page.status()).toBe(200);
    expect((await leadByEmail(lead.email))?.unsubscribed_at).toBeNull();

    expect((await client.post('/api/unsubscribe', { data: { token } })).status()).toBe(200);
    expect((await leadByEmail(lead.email))?.unsubscribed_at).toBeTruthy();
    const ev = await leadEvent(lead.leadId, 'unsubscribed');
    expect(ev.dedupe_key).toBe(`unsubscribed:${lead.leadId}`);
    expect((await client.post('/api/unsubscribe', { data: { token } })).status()).toBe(200);
    expect((await eventsOf(lead.leadId)).filter((e) => e.type === 'unsubscribed')).toHaveLength(1);

    expect((await client.post('/api/unsubscribe', { data: { token: 'x'.repeat(40) } })).status()).toBe(400);
    expect((await client.post('/api/unsubscribe', { data: { token: signAppToken({ lid: lead.leadId, p: 'portal' }) } })).status()).toBe(400);
    await client.dispose();
  });
});

test.describe('hardening', () => {
  test('state-changing routes refuse a cross-site Origin', async ({ playwright }) => {
    const client = await newClient(playwright);
    await createLead(client, 'origin');
    const evil = { origin: 'https://evil.example' };
    for (const [method, path, data] of [
      ['post', '/api/leads', leadBody(newEmail('o'))],
      ['post', '/api/bookings', { startsAt: new Date().toISOString(), timezone: 'UTC' }],
      ['delete', '/api/bookings', undefined],
      ['post', '/api/callbacks', { phone: '+1 555 000 1234' }],
      ['post', '/api/results/email', undefined],
      ['post', '/api/portal/enter', undefined],
      ['post', '/api/auth/set-password', { password: 'correct-horse-9' }],
      ['post', '/api/auth/forgot', { email: 'a@b.co' }],
      ['post', '/api/auth/link', { email: 'a@b.co' }],
      ['post', '/api/unsubscribe', { token: 'x'.repeat(20) }],
      ['put', '/api/lead/answers', { answers: {} }],
    ] as const) {
      const res = await client[method](path, { data, headers: { ...evil, 'x-forwarded-for': newIp() } });
      expect(res.status(), `${method} ${path}`).toBe(403);
    }
    await client.dispose();
  });

  test('malformed JSON is a 400, not a 500', async ({ request }) => {
    const res = await request.post('/api/leads', { data: '{not json', headers: { 'content-type': 'application/json', 'x-forwarded-for': newIp() } });
    expect(res.status()).toBe(400);
  });
});
