import { expect, test, type APIRequestContext, type APIResponse } from '@playwright/test';
import {
  BASE_URL,
  APPLY,
  FUNNEL_ORIGIN,
  FUNNEL_URL,
  PORTAL_ORIGIN,
  RUN,
  campaignIsBilingual,
  cleanup,
  createAuthUser,
  createAuthUserWith,
  decodeAppToken,
  eventually,
  eventsOf,
  funnelIsBilingual,
  goToPortal,
  leadBody,
  leadByEmail,
  linkIn,
  makeStaff,
  newClient as newPortalClient,
  newClientWithCookiesOf,
  newEmail,
  newFunnelClient,
  newIp,
  newVisitor,
  passwordSignIn,
  recoveryTokenHash,
  redirectPath,
  redirectUrl,
  rest,
  setCookies,
  signAppToken,
  uuid,
} from './support/funnel';

/**
 * API integration tests of the funnel and of the auth / unsubscribe routes against the two running production builds and
 * the local Supabase. The funnel lives on the firm's site (apps/main, FUNNEL_URL, default http://localhost:3000): the
 * lead / booking / availability / callback / result APIs and "Go to my portal" (POST /api/portal/enter, which only hands
 * out a link). The portal site (apps/campaign, BASE_URL, default http://localhost:3001) keeps sign-in, set-password, the
 * emailed /go links, /enter/<token> (where the hand-over opens the session), /auth/callback, /unsubscribe and the portal
 * APIs. The default `request` fixture below talks to the firm's site; the portal is reached through its own clients.
 *
 * In production the two sites are on different domains, so a person has two cookie jars (see newVisitor): the firm's
 * site only ever sees the lead cookie, the portal only the session (and the lead cookie its own /enter and /go renew).
 * Every "browser" is its own set of APIRequestContexts with its own x-forwarded-for address, so the per-IP rate limits of
 * one test never affect another.
 *
 *   CAMPAIGN_URL=http://localhost:3001 MAIN_URL=http://localhost:3000 pnpm exec playwright test e2e/funnel.api.spec.ts
 */
test.describe.configure({ mode: 'serial' });
test.use({ baseURL: FUNNEL_URL });
test.afterAll(cleanup);

/** The firm's site client; the portal's own is newPortalClient(). */
const newClient = newFunnelClient;

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

/** The value of a cookie in a client's jar (an httpOnly cookie too), or undefined. */
async function cookieValue(client: APIRequestContext, name: string): Promise<string | undefined> {
  return (await client.storageState()).cookies.find((c) => c.name === name)?.value;
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

    // seatsLeft is the number behind "N free calls left this week": the free seats from now to the Saturday that ends the firm's week
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: body.timezone }).format(new Date());
    const noon = new Date(`${today}T12:00:00Z`);
    const weekEnd = new Date(noon.getTime() + (6 - noon.getUTCDay()) * 86_400_000).toISOString().slice(0, 10);
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
        if (day.date <= weekEnd) seats += s.remaining;
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
    expect(cookie).toMatch(/Path=\/(;|$)/);

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

  test('a deep link sets where "Back to the site" goes, even after an earlier first visit; the portal\'s deep link hops to the firm\'s site with its attribution', async ({ request, playwright }) => {
    // the portal's own domain no longer has a funnel: ?entry=eligibility leaves for the firm's /apply, everything but `entry` survives the hop
    const portal = await newPortalClient(playwright);
    const hop = await portal.get('/?entry=eligibility&source=main-site&utm_campaign=spring', { maxRedirects: 0 });
    expect([301, 302, 303, 307, 308]).toContain(hop.status());
    const target = redirectUrl(hop);
    expect(target.origin).toBe(FUNNEL_ORIGIN);
    expect(target.pathname).toBe(APPLY);
    expect(Object.fromEntries(target.searchParams)).toEqual({ source: 'main-site', utm_campaign: 'spring' });
    // the old funnel addresses are permanent redirects to the same step under /apply, query intact
    for (const step of ['eligibility', 'details', 'booking', 'offer', 'privacy']) {
      const old = await portal.get(`/${step}?source=newsletter`, { maxRedirects: 0 });
      expect([301, 308], step).toContain(old.status());
      const to = redirectUrl(old);
      expect(`${to.origin}${to.pathname}${to.search}`, step).toBe(`${FUNNEL_ORIGIN}${APPLY}/${step}?source=newsletter`);
    }
    // the campaign path used in the email footers, and the Hebrew edition of all of this (bilingual builds)
    const footer = await portal.get('/ger-aus', { maxRedirects: 0 });
    expect([301, 308]).toContain(footer.status());
    expect(redirectUrl(footer).origin + redirectUrl(footer).pathname).toBe(`${FUNNEL_ORIGIN}${APPLY}`);
    if (await campaignIsBilingual()) {
      const he = await portal.get('/he?entry=eligibility&source=main-site&utm_campaign=spring', { maxRedirects: 0 });
      expect(redirectUrl(he).origin + redirectUrl(he).pathname).toBe(`${FUNNEL_ORIGIN}/he${APPLY}`);
      expect(Object.fromEntries(redirectUrl(he).searchParams)).toEqual({ source: 'main-site', utm_campaign: 'spring' });
      const heOld = await portal.get('/he/booking', { maxRedirects: 0 });
      expect(redirectUrl(heOld).origin + redirectUrl(heOld).pathname).toBe(`${FUNNEL_ORIGIN}/he${APPLY}/booking`);
    }
    await portal.dispose();

    // on the firm's site: an earlier visit from an advertisement left the first-touch cookie behind
    const arrived = await request.get(`${target.pathname}${target.search}`, { headers: { cookie: 'dpl_src=campaign-ger-aus' }, maxRedirects: 0 });
    expect(arrived.status()).toBe(200);
    const cookies = setCookies(arrived);
    expect(cookies.some((c) => /^dpl_from=main-site;/.test(c)), 'the way back is the website').toBe(true);
    expect(cookies.some((c) => /^dpl_src=/.test(c)), 'the first touch is never overwritten').toBe(false);
    // the next deep link from somewhere else replaces the way back
    const other = await request.get(`${APPLY}?source=newsletter`, { headers: { cookie: 'dpl_src=main-site; dpl_from=main-site' }, maxRedirects: 0 });
    expect(setCookies(other).some((c) => /^dpl_from=newsletter;/.test(c))).toBe(true);
    // a visit that names no origin leaves both cookies alone
    expect(setCookies(await request.get(APPLY, { headers: { cookie: 'dpl_src=main-site; dpl_from=main-site' }, maxRedirects: 0 })).filter((c) => /^dpl_(src|from|utm)=/.test(c))).toEqual([]);
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
    // the emailed link opens the PORTAL (its own site), not the firm's
    const link = linkIn(mail.payload, /https?:\/\/[^\s"'<>]+\/go\/[\w.-]+/);
    expect(link, 'portal link in the email').toBeTruthy();
    expect(new URL(link!).origin).toBe(PORTAL_ORIGIN);

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
    // a client (and a mail provider) is told when to come back
    expect(limited.headers()['retry-after']).toBe('60');
    // another address is unaffected
    const other = await request.post('/api/leads', { data: {}, headers: { 'x-forwarded-for': newIp() } });
    expect(other.status()).toBe(400);
  });
});

test.describe('the confirmation of a call that no longer exists', () => {
  const confirmations = async (leadId: string) =>
    (await eventsOf(leadId)).filter((e) => e.type === 'email.send' && e.payload.template === 'booking-confirmation');

  test('moving the call withdraws the confirmation that was still waiting; only the new time is announced', async ({ playwright }) => {
    const owner = await newClient(playwright);
    const lead = await createLead(owner, 'moved');
    const first = await freeSlot(owner, 11);
    const second = await freeSlot(owner, 12);
    expect((await owner.post('/api/bookings', { data: { startsAt: first.startsAt, timezone: 'Asia/Jerusalem' } })).status()).toBe(201);
    expect((await owner.post('/api/bookings', { data: { startsAt: second.startsAt, timezone: 'Asia/Jerusalem' } })).status()).toBe(201);
    const mails = await confirmations(lead.leadId);
    expect(mails).toHaveLength(2);
    expect(mails.filter((e) => e.status === 'pending')).toHaveLength(1);
    expect(mails.filter((e) => e.status === 'cancelled')).toHaveLength(1);
    expect(String(mails.find((e) => e.status === 'pending')!.dedupe_key)).toContain((await rest<{ id: string }>('bookings', `lead_id=eq.${lead.leadId}&status=eq.confirmed&select=id`))[0]!.id);
    await owner.dispose();
  });

  test('cancelling the call withdraws its confirmation as well (the cancellation email still goes out)', async ({ playwright }) => {
    const owner = await newClient(playwright);
    const lead = await createLead(owner, 'cancelled');
    const slot = await freeSlot(owner, 13);
    expect((await owner.post('/api/bookings', { data: { startsAt: slot.startsAt, timezone: 'Asia/Jerusalem' } })).status()).toBe(201);
    expect((await owner.delete('/api/bookings')).status()).toBe(200);
    const mails = await confirmations(lead.leadId);
    expect(mails).toHaveLength(1);
    expect(mails[0]!.status).toBe('cancelled');
    expect((await eventsOf(lead.leadId)).filter((e) => e.type === 'email.send' && e.payload.template === 'booking-cancelled')).toHaveLength(1);
    await owner.dispose();
  });
});

test.describe('correcting the email on the details page', () => {
  test('the same lead moves to the corrected address: no second lead, old links die, the new address gets welcome 1', async ({ playwright }) => {
    const owner = await newClient(playwright);
    const lead = await createLead(owner, 'typo');
    const before = await leadByEmail(lead.email);
    const welcomeBefore = (await eventsOf(lead.leadId)).filter((e) => e.type === 'email.send' && e.payload.template === 'welcome-1');
    expect(welcomeBefore).toHaveLength(1);
    // a link emailed to the mistyped address, with the epoch it had
    const oldLink = `/go/${signAppToken({ lid: lead.leadId, ep: before!.session_epoch, p: 'portal', n: '/portal' }, 3600)}`;

    // the visitor pressed Back from the booking, fixed the address and sent the form again (same name)
    const fixed = newEmail('typo-fixed');
    const res = await owner.post('/api/leads', { data: leadBody(fixed) });
    expect(res.status()).toBe(200);
    expect(await res.json()).toMatchObject({ status: 'updated', leadId: lead.leadId, caseRef: lead.caseRef });

    // one lead, now at the new address, unproven, with every earlier link and cookie dead
    expect(await leadByEmail(lead.email)).toBeNull();
    const after = await leadByEmail(fixed);
    expect(after).toMatchObject({ id: lead.leadId, case_ref: lead.caseRef, email_verified_at: null });
    expect(after?.session_epoch).toBe((before?.session_epoch ?? 0) + 1);
    expect((await owner.get('/api/lead')).status(), 'the browser got a fresh cookie and still acts as the lead').toBe(200);
    expect(((await (await owner.get('/api/lead')).json()) as { email: string }).email).toBe(fixed);
    const stranger = await newPortalClient(playwright);
    const old = await stranger.get(oldLink, { maxRedirects: 0 });
    expect(redirectUrl(old).pathname, 'a link sent to the mistyped address no longer opens the file').toBe('/link-expired');
    expect(setCookies(old).some((c) => /auth-token/.test(c))).toBe(false);
    await stranger.dispose();

    // emails: what waited for the old address is cancelled, welcome 1 goes to the new one, exactly once
    const events = await eventsOf(lead.leadId);
    const welcome = events.filter((e) => e.type === 'email.send' && e.payload.template === 'welcome-1');
    expect(welcome.filter((e) => e.payload.to?.email === fixed)).toHaveLength(1);
    expect(welcome.filter((e) => e.payload.to?.email === lead.email && e.status === 'pending'), 'nothing is left for the old address').toHaveLength(0);
    // the firm's CRM is told what changed
    const updated = events.filter((e) => e.type === 'lead.updated');
    expect(updated).toHaveLength(1);
    expect(updated[0]?.payload).toMatchObject({ changed: ['email'], previous: { email: lead.email }, lead: { id: lead.leadId, email: fixed } });
    expect(await rest('activity_log', `lead_id=eq.${lead.leadId}&code=eq.email_changed`)).toHaveLength(1);

    // sending the same form again changes nothing and tells nobody
    const again = await owner.post('/api/leads', { data: leadBody(fixed) });
    expect((await again.json()).status).toBe('updated');
    expect((await eventsOf(lead.leadId)).filter((e) => e.type === 'lead.updated')).toHaveLength(1);
    await owner.dispose();
  });

  test('the corrected address also receives the confirmation of the call the lead already holds', async ({ playwright }) => {
    const owner = await newClient(playwright);
    const lead = await createLead(owner, 'typo-booked');
    const slot = await freeSlot(owner, 9);
    expect((await owner.post('/api/bookings', { data: { startsAt: slot.startsAt, timezone: 'Asia/Jerusalem' } })).status()).toBe(201);
    const fixed = newEmail('typo-booked-fixed');
    expect((await owner.post('/api/leads', { data: leadBody(fixed) })).status()).toBe(200);
    const confirmations = (await eventsOf(lead.leadId)).filter((e) => e.type === 'email.send' && e.payload.template === 'booking-confirmation');
    expect(confirmations.map((e) => e.payload.to?.email).sort()).toEqual([fixed, lead.email].sort());
    // the one queued for the mistyped address is withdrawn (it carries the name, the phone number and the time of the call);
    // the one for the corrected address waits to be sent
    expect(confirmations.find((e) => e.payload.to?.email === lead.email)?.status).toBe('cancelled');
    expect(confirmations.find((e) => e.payload.to?.email === fixed)?.status).toBe('pending');
    expect((await eventsOf(lead.leadId)).filter((e) => e.type === 'email.send' && e.payload.to?.email === lead.email && e.status === 'pending')).toEqual([]);
    // still one lead, one booking
    expect(await rest('bookings', `lead_id=eq.${lead.leadId}&status=eq.confirmed&select=id`)).toHaveLength(1);
    await owner.dispose();
  });

  test('another name is another person: a second lead of their own, and the first one is untouched', async ({ playwright }) => {
    const shared = await newClient(playwright);
    const a = await createLead(shared, 'spouse-a');
    const b = await createLead(shared, 'spouse-b', { fullName: 'berta reinhardt' });
    expect(b.leadId).not.toBe(a.leadId);
    expect(await leadByEmail(a.email)).toMatchObject({ id: a.leadId, full_name: 'Anna Reinhardt', email_verified_at: null });
    expect(await leadByEmail(b.email)).toMatchObject({ id: b.leadId, full_name: 'Berta Reinhardt' });
    await shared.dispose();
  });

  test('an address that already has a file is never taken over: the owner is emailed, this lead keeps its own address', async ({ playwright }) => {
    const other = await newClient(playwright);
    const victim = await createLead(other, 'victim');
    const owner = await newClient(playwright);
    const mine = await createLead(owner, 'mine');
    const res = await owner.post('/api/leads', { data: leadBody(victim.email) });
    expect(res.status()).toBe(200);
    expect(await res.json()).toEqual({ status: 'existing' });
    expect(await leadByEmail(mine.email)).toMatchObject({ id: mine.leadId });
    expect(await leadByEmail(victim.email)).toMatchObject({ id: victim.leadId });
    expect(await emailEvent(victim.leadId, 'file-open')).toBeTruthy();
    await other.dispose();
    await owner.dispose();
  });

  test('a lead with a password, or a browser signed in as it, keeps its address (409 email_locked)', async ({ playwright }) => {
    const person = await newVisitor(playwright);
    const lead = await createLead(person.funnel, 'locked');
    await goToPortal(person);
    // the person is signed in at the portal, no password yet. The firm's site cannot see that session in production (another
    // domain); on localhost the cookie is sent to both ports, which is the only way to put a session in front of this rule
    // (submitLead: `via === 'session'`), so a browser built from both jars stands in for "signed in as the lead".
    const signedIn = await newClientWithCookiesOf(playwright, FUNNEL_URL, [person.funnel, person.portal]);
    const viaSession = await signedIn.post('/api/leads', { data: leadBody(newEmail('locked-new')) });
    expect(viaSession.status()).toBe(409);
    expect(await viaSession.json()).toMatchObject({ error: 'email_locked' });

    // with a password the lead keeps its address for the one thing the firm's site really sees: the lead cookie
    expect((await person.portal.post('/api/auth/set-password', { data: { password: 'locked-password-1' } })).status()).toBe(200);
    expect(((await (await person.funnel.get('/api/lead')).json()) as { passwordSet: boolean }).passwordSet, 'the cookie alone still identifies the lead').toBe(true);
    const again = await person.funnel.post('/api/leads', { data: leadBody(newEmail('locked-new2')) });
    expect(again.status()).toBe(409);
    expect(await again.json()).toMatchObject({ error: 'email_locked' });
    expect(await leadByEmail(lead.email)).toMatchObject({ id: lead.leadId });
    await signedIn.dispose();
    await person.dispose();
  });
});

test.describe('GET /api/lead and PUT /api/lead/answers', () => {
  test('401 without a cookie or session; the summary has no secrets', async ({ playwright }) => {
    const anonymous = await newClient(playwright);
    expect((await anonymous.get('/api/lead')).status()).toBe(401);

    const client = await newClient(playwright);
    const lead = await createLead(client, 'summary');
    const meRes = await client.get('/api/lead');
    expect(meRes.headers()['cache-control'], 'a personal answer is never cached').toContain('no-store');
    const me = await meRes.json();
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
    // (named after this run, so that cleanup() finds the row again)
    const name = `e2e-funnel-${RUN}-callback`;
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
    const link = linkIn(mail.payload, /https?:\/\/[^\s"'<>]+\/go\/[\w.-]+/);
    expect(link, 'a link into the portal').toBeTruthy();
    expect(new URL(link!).origin, 'the portal is its own site').toBe(PORTAL_ORIGIN);
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

test.describe('"Go to my portal": the hand-over from the firm\'s site to the portal', () => {
  test('POST /api/portal/enter (firm\'s site) only hands out a short-lived link; /enter/<token> (portal) opens the session', async ({ playwright }) => {
    const anonymous = await newFunnelClient(playwright);
    expect((await anonymous.post('/api/portal/enter')).status()).toBe(401);

    const person = await newVisitor(playwright);
    const lead = await createLead(person.funnel, 'enter');
    const row = (await leadByEmail(lead.email))!;
    const res = await person.funnel.post('/api/portal/enter');
    expect(res.status(), await res.text()).toBe(200);
    const body = (await res.json()) as { url: string };
    expect(Object.keys(body)).toEqual(['url']);

    // the link points at the portal's own site, signs nobody in on the firm's site and has changed nothing yet
    const link = new URL(body.url);
    expect(link.origin).toBe(PORTAL_ORIGIN);
    expect(link.pathname).toMatch(/^\/enter\/[\w-]+\.[\w-]+$/);
    expect(setCookies(res).filter((c) => /auth-token/.test(c))).toEqual([]);
    expect(await (await person.funnel.get('/api/lead')).json()).toMatchObject({ accountCreated: false, stage: 'lead', status: 'enquiry' });
    expect((await leadByEmail(lead.email))?.user_id).toBeNull();
    expect((await eventsOf(lead.leadId)).filter((e) => e.type === 'account.created')).toEqual([]);
    expect((await person.portal.get('/api/portal/state')).status(), 'nothing on the portal knows this browser yet').toBe(401);

    // the token: purpose "enter", this lead and its epoch, good for two minutes at most
    const payload = decodeAppToken(link.pathname.split('/').pop()!);
    expect(payload).toMatchObject({ p: 'enter', lid: lead.leadId, ep: row.session_epoch });
    const secondsLeft = (payload.exp ?? 0) - Date.now() / 1000;
    expect(secondsLeft).toBeGreaterThan(0);
    expect(secondsLeft).toBeLessThanOrEqual(120);

    // following it (a full-page navigation, with the portal's own cookies: none) opens the real session
    const landed = await person.portal.get(body.url, { maxRedirects: 0 });
    expect(landed.status()).toBe(303);
    expect(redirectUrl(landed).pathname).toBe('/portal');
    const cookies = setCookies(landed);
    expect(cookies.some((c) => /^sb-[\w-]+-auth-token/.test(c)), 'supabase session cookie').toBe(true);
    expect(cookies.some((c) => c.startsWith('dpl_lead=')), 'the portal\'s own lead cookie').toBe(true);

    const state = (await (await person.portal.get('/api/portal/state')).json()) as { lead: { caseRef: string; email: string } };
    expect(state.lead).toMatchObject({ caseRef: lead.caseRef, email: lead.email });
    // the file now has an account; the firm's site, with its own lead cookie, sees the same file
    expect(await (await person.funnel.get('/api/lead')).json()).toMatchObject({ leadId: lead.leadId, accountCreated: true, stage: 'account', status: 'account_created' });
    const account = await leadEvent(lead.leadId, 'account.created');
    expect(account.dedupe_key).toBe(`account.created:${lead.leadId}`);
    // "Go to my portal" proves nothing about the mailbox, unlike an emailed link
    expect((await leadByEmail(lead.email))?.email_verified_at).toBeNull();
    await anonymous.dispose();
    await person.dispose();
  });

  test('a Hebrew lead gets a Hebrew link and lands on the Hebrew portal', async ({ playwright }) => {
    test.skip(!(await campaignIsBilingual()) || !(await funnelIsBilingual()), 'needs the bilingual builds (NEXT_PUBLIC_CAMPAIGN_LOCALES=en,he on both sites)');
    const person = await newVisitor(playwright);
    await createLead(person.funnel, 'enter-he', { locale: 'he' });
    const { url, landed } = await goToPortal(person);
    expect(new URL(url).pathname).toMatch(/^\/he\/enter\//);
    expect(landed.status()).toBe(303);
    expect(redirectUrl(landed).pathname).toBe('/he/portal');
    expect(setCookies(landed).some((c) => /^sb-[\w-]+-auth-token/.test(c))).toBe(true);
    await person.dispose();
  });

  test('bad /enter tokens go to sign-in with the link message, never to the portal; a probe signs nobody in', async ({ playwright }) => {
    const person = await newVisitor(playwright);
    const lead = await createLead(person.funnel, 'badenter');
    const row = (await leadByEmail(lead.email))!;
    const mine = { lid: row.id, ep: row.session_epoch };
    const good = signAppToken({ ...mine, p: 'enter' }, 120);
    const [data, signature] = good.split('.') as [string, string];
    const cases: Array<[string, string]> = [
      ['not a token', 'not-a-token'],
      ['a tampered signature', `${data}.${signature[0] === 'A' ? 'B' : 'A'}${signature.slice(1)}`],
      ['expired', signAppToken({ ...mine, p: 'enter' }, -60)],
      ['a lead whose epoch moved on (address corrected, emailed link used)', signAppToken({ lid: row.id, ep: row.session_epoch + 1, p: 'enter' }, 120)],
      ['a lead that does not exist', signAppToken({ lid: uuid(), ep: 0, p: 'enter' }, 120)],
      ['the lead cookie of this very lead', signAppToken({ ...mine, p: 'lead', v: 1 }, 3600)],
      ['an emailed portal link', signAppToken({ ...mine, p: 'portal', n: '/portal' }, 3600)],
      ['an unsubscribe token', signAppToken({ lid: row.id, p: 'unsub' })],
    ];
    for (const [what, token] of cases) {
      const res = await person.portal.get(`/enter/${token}`, { maxRedirects: 0 });
      expect(res.status(), what).toBe(303);
      expect(redirectPath(res), what).toBe('/sign-in?error=link&source=main-site');
      expect(setCookies(res).some((c) => /auth-token/.test(c)), what).toBe(false);
    }
    if (await campaignIsBilingual()) {
      const he = await person.portal.get('/he/enter/not-a-token', { maxRedirects: 0 });
      expect(redirectPath(he)).toBe('/he/sign-in?error=link&source=main-site');
    }

    // link checkers and prefetchers probe with HEAD: that must not sign anybody in or create the account
    const probe = await person.portal.head(`/enter/${good}`);
    expect(probe.status()).toBe(200);
    expect(setCookies(probe).some((c) => /auth-token/.test(c))).toBe(false);
    expect(await leadByEmail(lead.email)).toMatchObject({ user_id: null, account_created_at: null, stage: 'lead' });
    await person.dispose();
  });

  test('an /enter token opens nothing else: no emailed /go link, no lead cookie, no unsubscribe token (and the lead cookie is no /enter token)', async ({ playwright }) => {
    const person = await newVisitor(playwright);
    const lead = await createLead(person.funnel, 'crosstoken');
    const row = (await leadByEmail(lead.email))!;
    const token = signAppToken({ lid: row.id, ep: row.session_epoch, p: 'enter' }, 120);

    for (const res of [await person.portal.get(`/go/${token}`, { maxRedirects: 0 }), await person.portal.post(`/go/${token}`, { maxRedirects: 0 })]) {
      expect(res.status()).toBe(303);
      expect(redirectUrl(res).pathname).toBe('/link-expired');
      expect(setCookies(res).some((c) => /auth-token/.test(c))).toBe(false);
    }
    const thief = await playwright.request.newContext({ baseURL: FUNNEL_URL, extraHTTPHeaders: { 'x-forwarded-for': newIp(), cookie: `dpl_lead=${token}` } });
    expect((await thief.get('/api/lead')).status()).toBe(401);
    await thief.dispose();
    expect((await person.portal.post('/api/unsubscribe', { data: { token } })).status()).toBe(400);
    expect((await leadByEmail(lead.email))?.unsubscribed_at).toBeNull();

    // and the lead cookie the firm's site gave this browser cannot be presented to /enter
    const cookie = (await person.funnel.storageState()).cookies.find((c) => c.name === 'dpl_lead')!;
    const res = await person.portal.get(`/enter/${cookie.value}`, { maxRedirects: 0 });
    expect(redirectPath(res)).toBe('/sign-in?error=link&source=main-site');
    expect((await leadByEmail(lead.email))?.user_id).toBeNull();
    await person.dispose();
  });
});

test.describe('passwords and emailed links', () => {
  test('POST /api/auth/set-password needs a session, validates, and really sets the password', async ({ playwright }) => {
    const person = await newVisitor(playwright);
    const lead = await createLead(person.funnel, 'password');
    // the lead cookie alone is not enough
    const cookieOnly = await newClientWithCookiesOf(playwright, BASE_URL, [person.funnel]);
    expect((await cookieOnly.post('/api/auth/set-password', { data: { password: 'correct-horse-9' } })).status()).toBe(401);
    await cookieOnly.dispose();

    await goToPortal(person);
    expect((await person.portal.post('/api/auth/set-password', { data: { password: 'short' } })).status()).toBe(400);
    expect((await person.portal.post('/api/auth/set-password', { data: {} })).status()).toBe(400);
    const ok = await person.portal.post('/api/auth/set-password', { data: { password: 'correct-horse-9' } });
    expect(ok.status(), await ok.text()).toBe(200);

    // this browser stays signed in, the lead records it, and the password works against the auth server
    expect((await person.portal.get('/api/portal/state')).status()).toBe(200);
    expect(((await (await person.funnel.get('/api/lead')).json()) as { passwordSet: boolean }).passwordSet).toBe(true);
    expect((await leadByEmail(lead.email))?.password_set_at).toBeTruthy();
    expect(await passwordSignIn(lead.email, 'correct-horse-9')).toBe(true);
    expect(await passwordSignIn(lead.email, 'wrong-password-1')).toBe(false);
    const activity = await rest<{ code: string }>('activity_log', `lead_id=eq.${lead.leadId}&select=code`);
    expect(activity.map((a) => a.code)).toContain('password_set');
    await person.dispose();
  });

  test('POST /api/auth/forgot always answers 200 and only queues a reset for a known address', async ({ playwright }) => {
    const client = await newClient(playwright);
    const lead = await createLead(client, 'forgot');
    const stranger = await newPortalClient(playwright);

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
      statuses.push((await request.post(`${BASE_URL}/api/auth/forgot`, { data: { email: newEmail('rl') }, headers: { 'x-forwarded-for': ip } })).status());
    }
    expect(statuses).toEqual([200, 200, 200, 200, 200, 429, 429]);
  });

  test('the recovery link signs the owner in and the new password replaces the old one', async ({ playwright }) => {
    const owner = await newVisitor(playwright);
    const lead = await createLead(owner.funnel, 'recovery');
    await goToPortal(owner);
    await owner.portal.post('/api/auth/set-password', { data: { password: 'first-password-1' } });

    const row = await leadByEmail(lead.email);
    const tokenHash = await recoveryTokenHash(lead.email);

    // a mail scanner "clicks" the link with a GET: that only forwards to the confirmation page and uses nothing up
    const url = `/auth/callback?token_hash=${encodeURIComponent(tokenHash)}&type=recovery&next=${encodeURIComponent('/create-password?mode=reset')}`;
    const scanner = await newPortalClient(playwright);
    const scan = await scanner.get(url, { maxRedirects: 0 });
    expect(scan.status()).toBe(303);
    expect(redirectUrl(scan).pathname).toBe('/open-link');
    expect(setCookies(scan).some((c) => /auth-token/.test(c))).toBe(false);

    // the owner opens the reset link in the browser that went through "Go to my portal" and presses the button: no
    // revocation, lands on the reset screen
    const res = await owner.portal.post('/auth/callback', { form: { token_hash: tokenHash, type: 'recovery', next: '/create-password?mode=reset' }, maxRedirects: 0 });
    expect(res.status()).toBe(303);
    expect(redirectPath(res)).toBe('/create-password?mode=reset');
    expect((await leadByEmail(lead.email))?.email_verified_at).toBeTruthy();
    expect((await leadByEmail(lead.email))?.session_epoch).toBe(row?.session_epoch);

    expect((await owner.portal.post('/api/auth/set-password', { data: { password: 'second-password-2' } })).status()).toBe(200);
    expect(await passwordSignIn(lead.email, 'first-password-1')).toBe(false);
    expect(await passwordSignIn(lead.email, 'second-password-2')).toBe(true);

    // a Hebrew link keeps the language prefix; a tampered or unknown token goes back to sign-in with a message
    // (in the English-only setting a /he address is only redirected to the English one)
    if (await campaignIsBilingual()) {
      const heGet = await scanner.get('/he/auth/callback?token_hash=garbage&type=recovery', { maxRedirects: 0 });
      expect(redirectUrl(heGet).pathname).toBe('/he/open-link');
      const he = await scanner.post('/he/auth/callback', { form: { token_hash: 'garbage', type: 'recovery' }, maxRedirects: 0 });
      expect(he.status()).toBe(303);
      expect(redirectPath(he)).toBe('/he/sign-in?error=link');
    } else {
      const heGet = await scanner.get('/he/auth/callback?token_hash=garbage&type=recovery', { maxRedirects: 0 });
      expect([307, 308]).toContain(heGet.status());
      expect(redirectUrl(heGet).pathname).toBe('/auth/callback');
    }
    const oauthDenied = await scanner.get('/auth/callback?error=access_denied', { maxRedirects: 0 });
    expect(redirectPath(oauthDenied)).toBe('/sign-in?error=oauth');
    await scanner.dispose();
    await owner.dispose();
  });

  test('a reset link is an account too: a lead that never pressed "Go to my portal" reaches Account created when it uses one', async ({ playwright }) => {
    const owner = await newVisitor(playwright);
    const lead = await createLead(owner.funnel, 'acct-reset');
    expect(await leadByEmail(lead.email)).toMatchObject({ account_created_at: null, stage: 'lead', status: 'enquiry' });

    // "Forgot it?" gives the lead its sign-in user but is not yet an account: nothing is claimed until the link is used
    expect((await owner.portal.post('/api/auth/forgot', { data: { email: lead.email } })).status()).toBe(200);
    await emailEvent(lead.leadId, 'password-reset');
    expect(await leadByEmail(lead.email)).toMatchObject({ account_created_at: null, status: 'enquiry' });

    const tokenHash = await recoveryTokenHash(lead.email);
    const res = await owner.portal.post('/auth/callback', { form: { token_hash: tokenHash, type: 'recovery', next: '/create-password?mode=reset' }, maxRedirects: 0 });
    expect(res.status()).toBe(303);
    expect(redirectUrl(res).pathname).toBe('/create-password');
    expect((await owner.portal.get('/api/portal/state')).status(), 'the reset link signed the browser in').toBe(200);

    const after = await leadByEmail(lead.email);
    expect(after).toMatchObject({ stage: 'account', status: 'account_created' });
    expect(after?.account_created_at).toBeTruthy();
    expect(after?.email_verified_at).toBeTruthy();
    const created = (await eventsOf(lead.leadId)).filter((e) => e.type === 'account.created');
    expect(created, 'the firm CRM hears about the account once').toHaveLength(1);
    expect(created[0]?.payload).toMatchObject({ lead: { id: lead.leadId } });
    const log = await rest('activity_log', `lead_id=eq.${lead.leadId}&code=eq.account_created`);
    expect(log).toHaveLength(1);

    // using a second reset link changes nothing about it
    const again = await recoveryTokenHash(lead.email);
    await owner.portal.post('/auth/callback', { form: { token_hash: again, type: 'recovery', next: '/create-password?mode=reset' }, maxRedirects: 0 });
    expect((await eventsOf(lead.leadId)).filter((e) => e.type === 'account.created')).toHaveLength(1);
    await owner.dispose();
  });

  test('an emailed /go link opens the portal; a link used on another browser revokes what was set before', async ({ playwright }) => {
    // attacker pre-registers somebody else's email in browser X and sets a password
    const attacker = await newVisitor(playwright);
    const lead = await createLead(attacker.funnel, 'prereg');
    await goToPortal(attacker);
    expect((await attacker.portal.post('/api/auth/set-password', { data: { password: 'attacker-pass-1' } })).status()).toBe(200);
    expect(await passwordSignIn(lead.email, 'attacker-pass-1')).toBe(true);
    expect((await attacker.funnel.get('/api/lead')).status()).toBe(200);
    expect((await attacker.portal.get('/api/portal/state')).status()).toBe(200);

    // the real owner types the email in their own browser: "existing", and the mailbox receives a link
    const owner = await newVisitor(playwright);
    const existing = await owner.funnel.post('/api/leads', { data: leadBody(lead.email) });
    expect((await existing.json()).status).toBe('existing');
    const mail = await emailEvent(lead.leadId, 'file-open');
    const link = linkIn(mail.payload, /https?:\/\/[^\s"'<>]+\/go\/[\w.-]+/)!;
    expect(link).toBeTruthy();
    expect(new URL(link).origin, 'the link opens the portal').toBe(PORTAL_ORIGIN);

    // a mail scanner opening the link (GET, no cookies) must change nothing: it is forwarded to the confirmation page
    const before = await leadByEmail(lead.email);
    const scanner = await newPortalClient(playwright);
    const scan = await scanner.get(new URL(link).pathname, { maxRedirects: 0 });
    expect(scan.status()).toBe(303);
    expect(redirectUrl(scan).pathname).toBe('/open-link');
    expect(setCookies(scan).some((c) => /auth-token/.test(c))).toBe(false);
    expect(await leadByEmail(lead.email)).toMatchObject({ email_verified_at: null, session_epoch: before?.session_epoch });
    expect(await passwordSignIn(lead.email, 'attacker-pass-1')).toBe(true);

    // the attacker's cookie on the firm's site names the epoch the lead has now
    const attackerCookie = await cookieValue(attacker.funnel, 'dpl_lead');
    expect(attackerCookie, 'the attacker holds a lead cookie of the firm\'s site').toBeTruthy();
    expect(decodeAppToken(attackerCookie!)).toMatchObject({ p: 'lead', lid: lead.leadId, ep: before?.session_epoch });
    // the real owner has no cookie of the firm's site yet: the details form only answered "existing"
    expect((await owner.funnel.get('/api/lead')).status()).toBe(401);

    // ...a person presses "Open my portal" (the form POST): the mailbox is proven and the portal session opens
    const go = await owner.portal.post(new URL(link).pathname, { maxRedirects: 0 });
    expect(go.status()).toBe(303);
    expect(setCookies(go).some((c) => /^sb-[\w-]+-auth-token/.test(c))).toBe(true);

    const after = await leadByEmail(lead.email);
    expect(after?.email_verified_at).toBeTruthy();
    // opened on a different browser than the creator's: the attacker's password, sessions and cookie are gone
    expect(after?.session_epoch).toBe((before?.session_epoch ?? 0) + 1);
    expect(after?.password_set_at).toBeNull();
    expect(await passwordSignIn(lead.email, 'attacker-pass-1')).toBe(false);
    expect((await attacker.funnel.get('/api/lead')).status(), 'the attacker\'s lead cookie on the firm\'s site is dead').toBe(401);
    expect((await attacker.portal.get('/api/portal/state')).status(), 'and so is the attacker\'s portal session').toBe(401);
    expect((await owner.portal.get('/api/portal/state')).status(), 'the owner is in on the portal').toBe(200);

    // The proof renewed the epoch, which ended the cookie the firm's site gives whoever fills in the form, so the portal does
    // not go straight to /portal: it hands the browser to the firm's site with a 2-minute resume token for the new epoch
    // (the other half of the redirect chain: firm's site -> sets its own fresh lead cookie -> back to the portal)
    const resume = redirectUrl(go);
    expect(resume.origin, 'the hand-over runs on the firm\'s site').toBe(FUNNEL_ORIGIN);
    expect(resume.pathname).toBe('/api/lead/resume');
    const token = resume.searchParams.get('t')!;
    expect(decodeAppToken(token)).toMatchObject({ p: 'resume', lid: lead.leadId, ep: after?.session_epoch, n: '/portal' });
    const lifetime = (decodeAppToken(token).exp ?? 0) - Math.floor(Date.now() / 1000);
    expect(lifetime, 'the token lives for two minutes at most').toBeLessThanOrEqual(120);

    const resumed = await owner.funnel.get(resume.href, { maxRedirects: 0 });
    expect(resumed.status()).toBe(303);
    expect(redirectUrl(resumed).origin + redirectUrl(resumed).pathname, 'and back to the portal').toBe(`${PORTAL_ORIGIN}/portal`);
    const issued = setCookies(resumed).find((c) => c.startsWith('dpl_lead='));
    expect(issued, 'the firm\'s site issues its own lead cookie').toBeTruthy();
    expect(issued).toMatch(/HttpOnly/i);
    // the owner's cookie belongs to the NEW epoch, the attacker's still names the old one
    const ownerCookie = (await cookieValue(owner.funnel, 'dpl_lead'))!;
    expect(decodeAppToken(ownerCookie)).toMatchObject({ p: 'lead', lid: lead.leadId, ep: after?.session_epoch });
    expect(ownerCookie).not.toBe(attackerCookie);
    expect((await owner.funnel.get('/api/lead')).status(), 'the owner is known to the firm\'s site now').toBe(200);
    expect((await (await owner.funnel.get('/api/lead')).json()).leadId).toBe(lead.leadId);
    expect((await attacker.funnel.get('/api/lead')).status(), 'the attacker\'s old cookie is still dead').toBe(401);
    // ...and the portal page the chain ends on opens for the owner, not for the attacker
    expect((await owner.portal.get('/portal', { maxRedirects: 0 })).status()).toBe(200);
    expect((await attacker.portal.get('/portal', { maxRedirects: 0 })).status()).toBe(307);

    // the old link is bound to the old epoch: it now lands on the "request a new link" page
    const old = await scanner.get(new URL(link).pathname, { maxRedirects: 0 });
    expect(old.status()).toBe(303);
    expect(redirectUrl(old).pathname).toBe('/link-expired');
    await scanner.dispose();
    await attacker.dispose();
    await owner.dispose();
  });

  test('bad /go tokens go to the link-expired page, never to the portal', async ({ playwright }) => {
    const client = await newPortalClient(playwright);
    // (without the Hebrew edition of the portal a /he address is only redirected to the English one)
    const hebrew = await campaignIsBilingual();
    for (const [path, expected] of [
      ['/go/not-a-token', '/link-expired'],
      ...(hebrew ? [['/he/go/not-a-token', '/he/link-expired'] as const] : []),
      [`/go/${signAppToken({ lid: uuid(), ep: 0, p: 'portal', n: '/portal' }, 3600)}`, '/link-expired'],
      [`/go/${signAppToken({ lid: uuid(), ep: 0, p: 'unsub' }, 3600)}`, '/link-expired'],
      [`/go/${signAppToken({ lid: uuid(), ep: 0, p: 'enter' }, 3600)}`, '/link-expired'],
    ] as const) {
      const res = await client.get(path, { maxRedirects: 0 });
      expect(res.status(), path).toBe(303);
      expect(redirectUrl(res).pathname, path).toBe(expected);
      expect(setCookies(res).some((c) => /auth-token/.test(c))).toBe(false);
    }
    await client.dispose();
  });

  test('a "next" smuggled into an emailed token cannot leave the site', async ({ playwright }) => {
    const owner = await newVisitor(playwright);
    const lead = await createLead(owner.funnel, 'nextsafe');
    for (const n of ['https://evil.example/', '//evil.example', '/\\evil.example', 'javascript:alert(1)']) {
      // (the first press verifies the mailbox, which moves the lead on to a new epoch: every token is signed for the current one)
      const row = (await leadByEmail(lead.email))!;
      const token = signAppToken({ lid: row.id, ep: row.session_epoch, p: 'portal', n }, 3600);
      const res = await owner.portal.post(`/go/${token}`, { maxRedirects: 0 });
      expect(res.status(), n).toBe(303);
      let location = redirectUrl(res);
      // A browser that did not create the lead passes once through the firm's site on the way (its own lead cookie is renewed
      // there). That is the only other place the link may lead, and what it carries is the portal's own /portal, not the
      // smuggled value.
      if (location.origin === FUNNEL_ORIGIN) {
        expect(location.pathname, n).toBe('/api/lead/resume');
        expect(decodeAppToken(location.searchParams.get('t')!).n, n).toBe('/portal');
        const back = await owner.funnel.get(location.href, { maxRedirects: 0 });
        expect(back.status(), n).toBe(303);
        location = redirectUrl(back);
      }
      expect(location.origin, n).toBe(PORTAL_ORIGIN);
      expect(location.pathname, n).toBe('/portal');
    }
    await owner.dispose();
  });

  test('POST /api/auth/link always answers 200 and emails a fresh link only to a known address', async ({ playwright }) => {
    const client = await newClient(playwright);
    const lead = await createLead(client, 'newlink');
    const stranger = await newPortalClient(playwright);
    const known = await stranger.post('/api/auth/link', { data: { email: lead.email } });
    const unknown = await stranger.post('/api/auth/link', { data: { email: newEmail('ghost') } });
    expect([known.status(), unknown.status()]).toEqual([200, 200]);
    expect(await known.json()).toEqual(await unknown.json());
    const mail = await emailEvent(lead.leadId, 'file-open');
    expect(mail.payload.to?.email).toBe(lead.email);
    await client.dispose();
    await stranger.dispose();
  });

  test('creating a new lead in a browser holding another lead\'s portal session ends that session (one jar shared by both sites)', async ({ playwright }) => {
    // Only a browser that presents the portal's session to the firm's site can be signed out by it. Production never does
    // (two domains); localhost shares cookies between the ports, which is what puts this rule (endForeignSession) in reach.
    const person = await newVisitor(playwright);
    const a = await createLead(person.funnel, 'sharedA');
    await goToPortal(person);
    const shared = await newClientWithCookiesOf(playwright, FUNNEL_URL, [person.funnel, person.portal]);
    expect((await (await shared.get('/api/lead')).json()).leadId).toBe(a.leadId);

    // a second person on the same computer: another name (the same name with another address would be a correction)
    const b = await createLead(shared, 'sharedB', { fullName: 'berta schmidt' });
    const me = await (await shared.get('/api/lead')).json();
    expect(me.leadId, 'the browser now acts as the new lead, not the old session').toBe(b.leadId);
    const slot = await freeSlot(shared, 6);
    const booked = await shared.post('/api/bookings', { data: { startsAt: slot.startsAt, timezone: 'Asia/Jerusalem' } });
    expect(booked.status()).toBe(201);
    expect((await rest<{ lead_id: string }>('bookings', `lead_id=eq.${b.leadId}&select=lead_id`)).length).toBe(1);
    expect((await rest<{ lead_id: string }>('bookings', `lead_id=eq.${a.leadId}&select=lead_id`)).length).toBe(0);
    await shared.dispose();
    await person.dispose();
  });

  test('a second person on the same computer: the firm\'s site follows the newest lead and "Go to my portal" then replaces the first person\'s portal session', async ({ playwright }) => {
    const person = await newVisitor(playwright);
    const a = await createLead(person.funnel, 'sameComputerA');
    await goToPortal(person);
    const stateOf = async () => ((await (await person.portal.get('/api/portal/state')).json()) as { lead: { caseRef: string } }).lead.caseRef;
    expect(await stateOf()).toBe(a.caseRef);

    const b = await createLead(person.funnel, 'sameComputerB', { fullName: 'berta schmidt' });
    expect((await (await person.funnel.get('/api/lead')).json()).leadId, 'the funnel cookie follows the newest lead').toBe(b.leadId);
    const slot = await freeSlot(person.funnel, 7);
    expect((await person.funnel.post('/api/bookings', { data: { startsAt: slot.startsAt, timezone: 'Asia/Jerusalem' } })).status()).toBe(201);
    expect((await rest('bookings', `lead_id=eq.${a.leadId}&select=lead_id`)).length).toBe(0);
    expect((await rest('bookings', `lead_id=eq.${b.leadId}&select=lead_id`)).length).toBe(1);

    // the second person's own hand-over opens their file, not the first person's
    await goToPortal(person);
    expect(await stateOf()).toBe(b.caseRef);
    await person.dispose();
  });
});

test.describe('emailed links that continue the funnel', () => {
  /** The /go links of an email, with the `next` path each one carries. */
  const goLinks = (payload: { text?: string; html?: string }) =>
    [...new Set(`${payload.text ?? ''}\n${payload.html ?? ''}`.replace(/&amp;/g, '&').match(/https?:\/\/[^\s"'<>]+\/go\/[\w.-]+/g) ?? [])].map((href) => ({
      href,
      next: decodeAppToken(new URL(href).pathname.split('/').pop()!).n as string | undefined,
    }));

  /** Follows the hand-over a /go answer points at: the firm's /api/lead/resume with the browser's firm-site jar. */
  async function followResume(go: APIResponse, funnel: APIRequestContext): Promise<{ resume: URL; landed: APIResponse }> {
    const resume = redirectUrl(go);
    expect(resume.origin, 'the hand-over runs on the firm\'s site').toBe(FUNNEL_ORIGIN);
    expect(resume.pathname).toBe('/api/lead/resume');
    return { resume, landed: await funnel.get(resume.href, { maxRedirects: 0 }) };
  }

  test('"Change or cancel" in the confirmation email: the signed link opens the portal session, then the firm\'s site gives the browser its lead cookie and lands on /apply/booking', async ({ playwright }) => {
    const creator = await newVisitor(playwright);
    const lead = await createLead(creator.funnel, 'mailbooking');
    const slot = await freeSlot(creator.funnel, 14);
    expect((await creator.funnel.post('/api/bookings', { data: { startsAt: slot.startsAt, timezone: 'Asia/Jerusalem' } })).status()).toBe(201);
    const links = goLinks((await emailEvent(lead.leadId, 'booking-confirmation')).payload);
    const change = links.find((l) => l.next === '/booking');
    expect(change, 'a signed link whose destination is the booking step').toBeTruthy();
    expect(new URL(change!.href).origin).toBe(PORTAL_ORIGIN);

    // the person opens it on their phone: a browser with no cookie of either site, and a person presses the confirmation button
    const phone = await newVisitor(playwright);
    expect((await phone.funnel.get('/api/lead')).status(), 'the phone is nobody on the firm\'s site yet').toBe(401);
    const go = await phone.portal.post(new URL(change!.href).pathname, { maxRedirects: 0 });
    expect(go.status()).toBe(303);
    expect(setCookies(go).some((c) => /^sb-[\w-]+-auth-token/.test(c)), 'the portal session is open').toBe(true);
    // the booking step is on the firm's site, which cannot see that session: 303 to its /api/lead/resume with a 2-minute token
    const { resume, landed } = await followResume(go, phone.funnel);
    const token = decodeAppToken(resume.searchParams.get('t')!);
    expect(token).toMatchObject({ p: 'resume', lid: lead.leadId, n: '/apply/booking' });
    expect((token.exp ?? 0) - Math.floor(Date.now() / 1000)).toBeLessThanOrEqual(120);
    expect(landed.status()).toBe(303);
    expect(redirectUrl(landed).href).toBe(`${FUNNEL_ORIGIN}${APPLY}/booking`);
    expect(setCookies(landed).some((c) => /^dpl_lead=.+HttpOnly/i.test(c))).toBe(true);
    // ...and the step now knows whose call this is
    const who = await phone.funnel.get('/api/lead');
    expect(who.status()).toBe(200);
    expect(await who.json()).toMatchObject({ leadId: lead.leadId, booking: { startsAt: slot.startsAt } });
    expect((await phone.funnel.get(`${APPLY}/booking`, { maxRedirects: 0 })).status(), 'the booking page opens for the phone').toBe(200);

    // the portal's own old /booking address still leaves for the firm's step
    const hop = await phone.portal.get('/booking', { maxRedirects: 0 });
    expect([301, 308]).toContain(hop.status());
    expect(redirectUrl(hop).origin + redirectUrl(hop).pathname).toBe(`${FUNNEL_ORIGIN}${APPLY}/booking`);
    await phone.dispose();
    await creator.dispose();
  });

  test('every funnel step an emailed link can name is handed over to the firm\'s site: /booking, /offer, /details, /eligibility', async ({ playwright }) => {
    const owner = await newVisitor(playwright);
    const lead = await createLead(owner.funnel, 'steps');
    for (const step of ['/booking', '/offer', '/details', '/eligibility']) {
      const row = (await leadByEmail(lead.email))!;
      const phone = await newVisitor(playwright);
      const go = await phone.portal.post(`/go/${signAppToken({ lid: row.id, ep: row.session_epoch, p: 'portal', n: step }, 3600)}`, { maxRedirects: 0 });
      expect(go.status(), step).toBe(303);
      const { resume, landed } = await followResume(go, phone.funnel);
      expect(decodeAppToken(resume.searchParams.get('t')!), step).toMatchObject({ p: 'resume', lid: lead.leadId, n: `${APPLY}${step}` });
      expect(redirectUrl(landed).href, step).toBe(`${FUNNEL_ORIGIN}${APPLY}${step}`);
      expect((await phone.funnel.get('/api/lead')).status(), `${step}: the firm's site knows the browser`).toBe(200);
      await phone.dispose();
    }
    // a step that is not on the list is not handed over (and a made-up one cannot be: see the resume route's own tests)
    const row = (await leadByEmail(lead.email))!;
    const other = await newVisitor(playwright);
    const go = await other.portal.post(`/go/${signAppToken({ lid: row.id, ep: row.session_epoch, p: 'portal', n: '/portal/documents' }, 3600)}`, { maxRedirects: 0 });
    expect(go.status()).toBe(303);
    expect(redirectUrl(go).origin).toBe(PORTAL_ORIGIN);
    expect(redirectUrl(go).pathname).toBe('/portal/documents');
    await other.dispose();
    await owner.dispose();
  });

  // The booking step on the firm's site identifies the visitor with the lead cookie of ITS OWN domain (GET /api/lead). A
  // browser that arrives from an emailed booking link opens a session on the PORTAL's domain only, so /go hands it over
  // (the test above): without the hand-over the step would send it to /apply/details. Here the jars are kept apart.
  test('an emailed booking link opens a booking step that knows the lead (a browser holding only the portal session)', async ({ playwright }) => {
    const creator = await newVisitor(playwright);
    const lead = await createLead(creator.funnel, 'mailbooking2');
    const slot = await freeSlot(creator.funnel, 15);
    expect((await creator.funnel.post('/api/bookings', { data: { startsAt: slot.startsAt, timezone: 'Asia/Jerusalem' } })).status()).toBe(201);
    const change = goLinks((await emailEvent(lead.leadId, 'booking-confirmation')).payload).find((l) => l.next === '/booking')!;

    const phone = await newVisitor(playwright);
    const go = await phone.portal.post(new URL(change.href).pathname, { maxRedirects: 0 });
    expect(go.status()).toBe(303);
    // what the booking step on the firm's site asks first: nobody, until the hand-over has run
    expect((await phone.funnel.get('/api/lead')).status()).toBe(401);
    await followResume(go, phone.funnel);
    const who = await phone.funnel.get('/api/lead');
    expect(who.status(), 'the firm\'s booking step must know whose call this is').toBe(200);
    expect(await who.json()).toMatchObject({ leadId: lead.leadId, booking: { startsAt: slot.startsAt } });
    await phone.dispose();
    await creator.dispose();
  });

  // Second face of the same cause: /go decides "is this the browser that created the lead?" from the lead cookie of the
  // PORTAL's domain, which the funnel never sets. The person who filled in the form and then opens the first email in the
  // same browser is treated as a stranger: the pre-registration defence runs (epoch + 1), which ends the firm's cookie of
  // that very browser. The portal therefore passes it through the firm's site once (/api/lead/resume) for a fresh cookie.
  test('opening the first emailed link in the browser that filled in the form keeps that browser known to the firm\'s site', async ({ playwright }) => {
    const person = await newVisitor(playwright);
    const lead = await createLead(person.funnel, 'mailsame');
    const before = (await leadByEmail(lead.email))!;
    const link = goLinks((await emailEvent(lead.leadId, 'welcome-1')).payload).find((l) => l.next === '/portal')!;
    const go = await person.portal.post(new URL(link.href).pathname, { maxRedirects: 0 });
    expect(go.status()).toBe(303);
    // the epoch moved on, so the cookie the firm's site gave this browser is dead until the hand-over has run
    const after = (await leadByEmail(lead.email))!;
    expect(after.session_epoch).toBe(before.session_epoch + 1);
    expect((await person.funnel.get('/api/lead')).status(), 'the old cookie of the firm\'s site died with the old epoch').toBe(401);
    const { resume, landed } = await followResume(go, person.funnel);
    expect(decodeAppToken(resume.searchParams.get('t')!)).toMatchObject({ n: '/portal', ep: after.session_epoch });
    expect(landed.status()).toBe(303);
    expect(redirectUrl(landed).href, 'and back to the portal, signed in').toBe(`${PORTAL_ORIGIN}/portal`);
    expect((await person.funnel.get('/api/lead')).status(), 'the lead cookie of the firm\'s site identifies the lead again').toBe(200);
    expect((await person.portal.get('/api/portal/state')).status()).toBe(200);

    // a later press of a link of the NEW epoch (the mailbox is proven already, nothing is renewed) goes straight to the portal
    const again = (await leadByEmail(lead.email))!;
    const direct = await person.portal.post(`/go/${signAppToken({ lid: again.id, ep: again.session_epoch, p: 'portal', n: '/portal' }, 3600)}`, { maxRedirects: 0 });
    expect(direct.status()).toBe(303);
    expect(redirectUrl(direct).origin + redirectUrl(direct).pathname).toBe(`${PORTAL_ORIGIN}/portal`);
    await person.dispose();
  });
});

test.describe('staff', () => {
  test('a staff member has no lead: forgot-password still emails a reset link and the callback sends them to /admin', async ({ playwright }) => {
    const email = newEmail('staff');
    const userId = await createAuthUser(email, 'staff-pass-123');
    await makeStaff(userId, email);

    const client = await newPortalClient(playwright);
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
    expect(redirectUrl(res).pathname).toBe('/admin');
    expect(setCookies(res).some((c) => /^sb-[\w-]+-auth-token/.test(c))).toBe(true);
    expect(await leadByEmail(email)).toBeNull();

    // an explicit next is validated like everybody else's: it can never leave the site
    const again = await client.post('/auth/callback', { form: { token_hash: await recoveryTokenHash(email), type: 'recovery', next: '//evil.example' }, maxRedirects: 0 });
    expect(redirectUrl(again).origin).toBe(PORTAL_ORIGIN);
    await client.dispose();
  });
});

test.describe('unsubscribe', () => {
  test('opening the link never unsubscribes; the confirm POST does, once', async ({ playwright }) => {
    const funnel = await newClient(playwright);
    const lead = await createLead(funnel, 'unsub');
    await funnel.dispose();
    const client = await newPortalClient(playwright);
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

  test('RFC 8058 one-click: the POST of a mail provider to the List-Unsubscribe address stops the nurture emails', async ({ playwright }) => {
    const owner = await newClient(playwright);
    const lead = await createLead(owner, 'oneclick');
    const welcome = await emailEvent(lead.leadId, 'welcome-1');
    const address = welcome.payload.listUnsubscribe as string;
    expect(address).toMatch(/\/api\/unsubscribe\/one-click\?t=[\w.-]+$/);
    // the emails are queued by the firm's site, but the unsubscribe address is the portal's (that is where the route lives)
    expect(new URL(address).origin).toBe(PORTAL_ORIGIN);
    // the link in the body is the page that asks first, with the same token
    const token = address.split('?t=')[1]!;
    expect(String(welcome.payload.html)).toContain(`${PORTAL_ORIGIN}/unsubscribe?t=${token}`);

    // the provider's request comes from its own servers: no cookie, no Origin
    const provider = await playwright.request.newContext({ extraHTTPHeaders: { 'x-forwarded-for': newIp() } });
    // a request without the fixed body, or with a token that is not an unsubscribe token, changes nothing
    expect((await provider.post(address, { form: { other: 'x' } })).status()).toBe(400);
    expect((await provider.post(address, { data: '' })).status()).toBe(400);
    expect((await provider.post(`${BASE_URL}/api/unsubscribe/one-click?t=${'x'.repeat(40)}`, { form: { 'List-Unsubscribe': 'One-Click' } })).status()).toBe(400);
    expect((await provider.post(`${BASE_URL}/api/unsubscribe/one-click?t=${signAppToken({ lid: lead.leadId, p: 'portal' })}`, { form: { 'List-Unsubscribe': 'One-Click' } })).status()).toBe(400);
    expect((await leadByEmail(lead.email))?.unsubscribed_at).toBeNull();

    const done = await provider.post(address, { form: { 'List-Unsubscribe': 'One-Click' } });
    expect(done.status()).toBe(200);
    expect((await leadByEmail(lead.email))?.unsubscribed_at).toBeTruthy();
    // what was still queued for this person is cancelled, and the CRM hears of it once (a repeated POST changes nothing)
    expect((await eventsOf(lead.leadId)).filter((e) => e.type === 'email.send' && e.payload.category === 'nurture' && e.status === 'pending')).toEqual([]);
    expect((await provider.post(address, { form: { 'List-Unsubscribe': 'One-Click' } })).status()).toBe(200);
    expect((await eventsOf(lead.leadId)).filter((e) => e.type === 'unsubscribed')).toHaveLength(1);

    // opened in a browser, the same address is the confirmation page, not an unsubscribe
    const second = await newClient(playwright);
    const other = await createLead(second, 'oneclick-get');
    const otherAddress = ((await emailEvent(other.leadId, 'welcome-1')).payload.listUnsubscribe as string);
    const get = await provider.get(otherAddress, { maxRedirects: 0 });
    expect(get.status()).toBe(303);
    expect(redirectUrl(get).pathname).toBe('/unsubscribe');
    expect((await leadByEmail(other.email))?.unsubscribed_at).toBeNull();
    await provider.dispose();
    await second.dispose();
    await owner.dispose();
  });
});

test.describe('hardening', () => {
  test('a token from an email is not a login: neither the unsubscribe link nor the portal link nor the hand-over link works as the lead cookie', async ({ playwright }) => {
    const owner = await newClient(playwright);
    const lead = await createLead(owner, 'tokens');
    const row = (await leadByEmail(lead.email))!;
    const stolen = [
      signAppToken({ lid: lead.leadId, p: 'unsub' }), // sits in every nurture email, never expires
      signAppToken({ lid: lead.leadId, ep: row.session_epoch, p: 'portal', n: '/portal' }, 3600), // the emailed portal link
      signAppToken({ lid: lead.leadId, ep: row.session_epoch, p: 'enter' }, 120), // the "Go to my portal" hand-over link
      signAppToken({ lid: lead.leadId, ep: row.session_epoch }, 3600), // no purpose at all
      signAppToken({ lid: lead.leadId, p: 'lead' }, 3600), // right purpose, no epoch
    ];
    for (const token of stolen) {
      const thief = await playwright.request.newContext({ baseURL: FUNNEL_URL, extraHTTPHeaders: { 'x-forwarded-for': newIp(), cookie: `dpl_lead=${token}` } });
      expect((await thief.get('/api/lead')).status()).toBe(401);
      expect((await thief.post('/api/portal/enter', { headers: { origin: FUNNEL_ORIGIN } })).status()).toBe(401);
      await thief.dispose();
    }
    // the real cookie of the person who filled in the form still works
    expect((await owner.get('/api/lead')).status()).toBe(200);
    await owner.dispose();
  });

  test('state-changing routes refuse a cross-site Origin, and the two sites refuse each other\'s', async ({ playwright }) => {
    const funnel = await newClient(playwright);
    const portal = await newPortalClient(playwright);
    await createLead(funnel, 'origin');
    const evil = 'https://evil.example';
    const routes = {
      funnel: [
        ['post', '/api/leads', leadBody(newEmail('o'))],
        ['post', '/api/bookings', { startsAt: new Date().toISOString(), timezone: 'UTC' }],
        ['delete', '/api/bookings', undefined],
        ['post', '/api/callbacks', { phone: '+1 555 000 1234' }],
        ['post', '/api/results/email', undefined],
        ['post', '/api/portal/enter', undefined],
        ['put', '/api/lead/answers', { answers: {} }],
        ['post', '/api/auth/link', { email: 'a@b.co' }],
      ],
      portal: [
        ['post', '/api/auth/set-password', { password: 'correct-horse-9' }],
        ['post', '/api/auth/forgot', { email: 'a@b.co' }],
        ['post', '/api/auth/link', { email: 'a@b.co' }],
        ['post', '/api/unsubscribe', { token: 'x'.repeat(20) }],
      ],
    } as const;
    // (an unrelated address, and the OTHER site of the pair: the portal's pages never call the funnel's API, nor the reverse)
    for (const [client, list, other] of [
      [funnel, routes.funnel, PORTAL_ORIGIN],
      [portal, routes.portal, FUNNEL_ORIGIN],
    ] as const) {
      for (const [method, path, data] of list) {
        for (const origin of [evil, other]) {
          const res = await client[method](path, { data, headers: { origin, 'x-forwarded-for': newIp() } });
          expect(res.status(), `${method} ${path} from ${origin}`).toBe(403);
          expect((await res.json()).error).toBe('bad_origin');
        }
      }
    }
    await funnel.dispose();
    await portal.dispose();
  });

  test('the other write routes are rate limited per address too, and say when to come back', async ({ playwright }) => {
    const funnel = await newClient(playwright);
    const portal = await newPortalClient(playwright);
    // (anonymous or invalid requests: they change nothing, and the limit is checked before anything else)
    const routes = [
      [funnel, 'post', '/api/portal/enter', undefined, 20],
      [funnel, 'post', '/api/results/email', undefined, 5],
      [funnel, 'post', '/api/bookings', {}, 20],
      [funnel, 'put', '/api/lead/answers', { answers: {} }, 30],
      [funnel, 'post', '/api/auth/link', { email: 'nope' }, 5],
      [portal, 'post', '/api/auth/set-password', { password: 'correct-horse-9' }, 10],
      [portal, 'post', '/api/auth/link', { email: 'nope' }, 5],
      [portal, 'post', '/api/unsubscribe', { token: 'x'.repeat(40) }, 10],
    ] as const;
    for (const [client, method, path, data, max] of routes) {
      for (let i = 0; i < max; i++) {
        const res = await client[method](path, { data });
        expect(res.status(), `${method} ${path} #${i + 1} is within the limit`).not.toBe(429);
      }
      const limited = await client[method](path, { data });
      expect(limited.status(), `${method} ${path} #${max + 1}`).toBe(429);
      expect((await limited.json()).error).toBe('rate_limited');
      expect(limited.headers()['retry-after']).toBe('60');
    }
    await funnel.dispose();
    await portal.dispose();
  });

  test('malformed JSON is a 400, not a 500', async ({ request }) => {
    const res = await request.post('/api/leads', { data: '{not json', headers: { 'content-type': 'application/json', 'x-forwarded-for': newIp() } });
    expect(res.status()).toBe(400);
    const portal = await request.post(`${BASE_URL}/api/auth/forgot`, { data: '{not json', headers: { 'content-type': 'application/json', 'x-forwarded-for': newIp() } });
    expect(portal.status()).toBe(400);
  });
});

test.describe('which site serves what', () => {
  const FUNNEL_API = [
    ['get', '/api/availability'],
    ['post', '/api/leads'],
    ['get', '/api/lead'],
    ['put', '/api/lead/answers'],
    ['post', '/api/bookings'],
    ['delete', '/api/bookings'],
    ['post', '/api/callbacks'],
    ['post', '/api/results/email'],
    ['post', '/api/portal/enter'],
    // the two halves of the hand-over between the sites that end on the firm's site (see lead-handover.spec.ts)
    ['get', '/api/lead/resume'],
    ['get', '/api/lead/forget'],
  ] as const;
  /** Routes of the same name on both sites: the portal's "send me a new link" (expired-link page) and the funnel's (details form). */
  const BOTH_API = [['post', '/api/auth/link']] as const;
  const PORTAL_API = [
    ['post', '/api/auth/forgot'],
    ['post', '/api/auth/set-password'],
    ['post', '/api/unsubscribe'],
    ['post', '/api/unsubscribe/one-click'],
    ['get', '/api/portal/state'],
    ['post', '/api/portal/sign-out'],
    ['post', '/api/cron/dispatch'],
  ] as const;
  const PORTAL_PAGES = ['/sign-in', '/portal', '/admin', '/go/x', '/enter/x', '/auth/callback', '/open-link', '/link-expired', '/create-password', '/unsubscribe'];

  test('the funnel APIs exist on the firm\'s site only, the portal APIs on the portal only', async ({ playwright }) => {
    const funnel = await newClient(playwright);
    const portal = await newPortalClient(playwright);
    // (never the other host's cron route with a body: it is only asked on the firm's site, where it must not exist)
    for (const [method, path] of FUNNEL_API) {
      const res = await portal[method](path, { data: method === 'get' ? undefined : {} });
      expect(res.status(), `portal ${method} ${path}`).toBe(404);
    }
    for (const [method, path] of PORTAL_API) {
      const res = await funnel[method](path, { data: method === 'get' ? undefined : {} });
      expect(res.status(), `firm's site ${method} ${path}`).toBe(404);
    }
    // (an empty body is refused with 400 by both: the route exists, it is not a 404)
    for (const [method, path] of BOTH_API) {
      for (const [name, client] of [['firm\'s site', funnel], ['portal', portal]] as const) {
        const res = await client[method](path, { data: {} });
        expect(res.status(), `${name} ${method} ${path}`).toBe(400);
      }
    }
    await funnel.dispose();
    await portal.dispose();
  });

  test('the portal\'s pages are not on the firm\'s site, and the funnel\'s pages are not on the portal', async ({ playwright }) => {
    const funnel = await newClient(playwright);
    const portal = await newPortalClient(playwright);
    for (const path of PORTAL_PAGES) {
      expect((await funnel.get(path, { maxRedirects: 0 })).status(), `firm's site ${path}`).toBe(404);
    }
    for (const path of [APPLY, `${APPLY}/eligibility`, `${APPLY}/details`, `${APPLY}/booking`, `${APPLY}/offer`]) {
      expect((await portal.get(path, { maxRedirects: 0 })).status(), `portal ${path}`).toBe(404);
      expect((await funnel.get(path, { maxRedirects: 0 })).status(), `firm's site ${path}`).toBe(200);
    }
    // the portal's bare address is its sign-in
    const root = await portal.get('/', { maxRedirects: 0 });
    expect([302, 303, 307]).toContain(root.status());
    expect(redirectPath(root)).toBe('/sign-in');
    await funnel.dispose();
    await portal.dispose();
  });
});

test.describe('an address that already has a sign-in account of someone else', () => {
  const SIGN_IN_EXISTS = '/sign-in?error=accountExists&source=main-site';

  test('a member of staff: a lead made with the address gets a hand-over link that opens nothing ("account exists" at sign-in), links nothing and opens no session', async ({ playwright }) => {
    const email = newEmail('staff-takeover');
    const staffId = await createAuthUser(email, 'Staff-Pass-1!');
    await makeStaff(staffId, email);
    const stranger = await newVisitor(playwright);
    // a lead may still be started for any address, as before (the owner can unsubscribe from what it sends)
    const created = await stranger.funnel.post('/api/leads', { data: leadBody(email) });
    expect(created.status()).toBe(201);

    // the firm's site only checks the lead cookie and hands out the link; the portal's /enter is where the account is looked at
    const { enter, landed } = await goToPortal(stranger);
    expect(enter.status()).toBe(200);
    expect(landed.status()).toBe(303);
    expect(redirectPath(landed)).toBe(SIGN_IN_EXISTS);
    expect(setCookies(landed).filter((c) => c.startsWith('sb-'))).toEqual([]);
    expect((await leadByEmail(email))!.user_id).toBeNull();
    expect((await stranger.portal.get('/api/portal/state')).status()).toBe(401);

    // the browser is not signed in to anything: the CRM sends it to the sign-in page
    const admin = await stranger.portal.get('/admin', { maxRedirects: 0 });
    expect([302, 303, 307, 308]).toContain(admin.status());
    expect(redirectUrl(admin).pathname).toMatch(/\/sign-in$/);
    // and the staff member's own password is untouched
    expect(await passwordSignIn(email, 'Staff-Pass-1!')).toBe(true);
    await stranger.dispose();
  });

  test('not even the emailed link of such a lead signs anyone in as the staff account', async ({ playwright }) => {
    const email = newEmail('staff-link');
    const staffId = await createAuthUser(email, 'Staff-Pass-2!');
    await makeStaff(staffId, email);
    const stranger = await newVisitor(playwright);
    expect((await stranger.funnel.post('/api/leads', { data: leadBody(email) })).status()).toBe(201);
    const row = (await leadByEmail(email))!;
    const res = await stranger.portal.post(`/go/${signAppToken({ lid: row.id, ep: row.session_epoch, p: 'portal', n: '/portal' }, 3600)}`, { maxRedirects: 0 });
    expect(redirectUrl(res).pathname).toBe('/link-expired');
    expect(setCookies(res).filter((c) => c.startsWith('sb-'))).toEqual([]);
    expect((await leadByEmail(email))!.user_id).toBeNull();
    await stranger.dispose();
  });

  test('an account somebody made by hand: the cookie holder is refused; the mailbox owner, through the emailed link, gets it and the old password stops working', async ({ playwright }) => {
    const email = newEmail('handmade');
    await createAuthUser(email, 'Known-To-Someone-1!');
    const visitor = await newVisitor(playwright);
    expect((await visitor.funnel.post('/api/leads', { data: leadBody(email) })).status()).toBe(201);
    const { landed } = await goToPortal(visitor);
    expect(redirectPath(landed)).toBe(SIGN_IN_EXISTS);
    expect(setCookies(landed).filter((c) => c.startsWith('sb-'))).toEqual([]);
    expect((await leadByEmail(email))!.user_id).toBeNull();
    expect(await passwordSignIn(email, 'Known-To-Someone-1!')).toBe(true);

    const row = (await leadByEmail(email))!;
    const open = await visitor.portal.post(`/go/${signAppToken({ lid: row.id, ep: row.session_epoch, p: 'portal', n: '/portal' }, 3600)}`, { maxRedirects: 0 });
    expect(open.status()).toBe(303);
    expect(setCookies(open).some((c) => c.startsWith('sb-'))).toBe(true);
    // the mailbox was proven by a browser that did not create the lead: the firm's site renews its cookie on the way to /portal
    expect(redirectUrl(open).origin + redirectUrl(open).pathname).toBe(`${FUNNEL_ORIGIN}/api/lead/resume`);
    const back = await visitor.funnel.get(redirectUrl(open).href, { maxRedirects: 0 });
    expect(back.status()).toBe(303);
    expect(redirectUrl(back).href).toBe(`${PORTAL_ORIGIN}/portal`);
    expect((await leadByEmail(email))!.user_id).not.toBeNull();
    // whoever registered the address first no longer holds it
    expect(await passwordSignIn(email, 'Known-To-Someone-1!')).toBe(false);
    await visitor.dispose();
  });

  test('an applicant whose account the server made (cut off before it was linked) still gets it', async ({ playwright }) => {
    const visitor = await newVisitor(playwright);
    const lead = await createLead(visitor.funnel, 'cutoff');
    const row = (await leadByEmail(lead.email))!;
    // what an interrupted "Go to my portal" leaves behind: the account, with the lead named in app_metadata, not yet linked
    const made = await createAuthUserWith(lead.email, 'cutoff-Password-1!', { lead_id: row.id });
    const { landed } = await goToPortal(visitor);
    expect(landed.status()).toBe(303);
    expect(redirectUrl(landed).pathname).toBe('/portal');
    expect((await leadByEmail(lead.email))!.user_id).toBe(made);
    await visitor.dispose();
  });
});

test.describe('free text in the forms', () => {
  test('a name with line breaks cannot reach a mail header: it is stored and queued on one line', async ({ playwright }) => {
    const client = await newClient(playwright);
    const email = newEmail('crlf');
    const res = await client.post('/api/leads', { data: leadBody(email, { fullName: 'Anna\r\nBcc: someone-else@example.com\r\nX-Injected: yes Reinhardt', phone: '+49 30\r\n5550 0100' }) });
    expect(res.status()).toBe(201);
    const lead = (await leadByEmail(email))!;
    // (names are capitalised word by word on the way in)
    expect(lead.full_name).toBe('Anna Bcc: Someone-Else@example.com X-Injected: Yes Reinhardt');
    expect(lead.full_name).not.toMatch(/[\r\n]/);
    expect(lead.phone).toBe('+49 30 5550 0100');
    const mail = await emailEvent(lead.id, 'welcome-1');
    expect(JSON.stringify(mail.payload.to)).not.toMatch(/\\r|\\n/);
    expect(mail.payload.subject ?? '').not.toMatch(/[\r\n]/);
    await client.dispose();
  });
});
