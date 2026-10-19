import { createHmac } from 'node:crypto';
import { expect, test, type APIRequestContext, type APIResponse } from '@playwright/test';
import {
  APP_SECRET,
  APPLY,
  FUNNEL_ORIGIN,
  PORTAL_ORIGIN,
  SERVICE_KEY,
  SUPABASE_URL,
  cleanup,
  decodeAppToken,
  eventually,
  eventsOf,
  funnelIsBilingual,
  goToPortal,
  leadBody,
  leadByEmail,
  linkIn,
  newEmail,
  newFunnelClient,
  newIp,
  newPortalClient,
  newVisitor,
  redirectUrl,
  rest,
  setCookies,
  signAppToken,
  uuid,
} from './support/funnel';

/**
 * The three routes of the firm's site that carry a browser between the two sites, which share no cookies in production:
 *
 *   GET  /api/lead/resume?t=<token>   where the portal's emailed /go link hands over a verified lead (a 2-minute 'resume' token
 *                                     whose destination is signed into it): sets the firm's own lead cookie, goes to the step
 *                                     (or back to the portal's /portal). Anything wrong with the token restarts the funnel.
 *   GET  /api/lead/forget?l=<locale>  the second half of "Sign out" in the portal: clears the firm's lead cookie and goes to the
 *                                     portal's sign-in page (/he/sign-in for Hebrew in the bilingual build).
 *   POST /api/auth/link               "Send the link again" on the details form: always 200, emails a fresh link to a known address.
 *
 * (The emailed-link chain through the portal's /go is in funnel.api.spec.ts and funnel.booking.spec.ts; the browser chain of
 * sign-out is in funnel.ui.spec.ts.) Each test makes its own lead and its own client addresses.
 *
 *   CAMPAIGN_URL=http://localhost:3001 MAIN_URL=http://localhost:3000 pnpm exec playwright test e2e/lead-handover.spec.ts
 */
test.afterAll(cleanup);

const RESTART = `${FUNNEL_ORIGIN}${APPLY}/details`;
const headers = () => ({ apikey: SERVICE_KEY, authorization: `Bearer ${SERVICE_KEY}`, 'content-type': 'application/json' });

/** A lead made through the funnel API, by a client of the firm's site that the caller can dispose of. */
async function makeLead(playwright: Parameters<typeof newFunnelClient>[0], label: string) {
  const creator = await newFunnelClient(playwright);
  const email = newEmail(label);
  const res = await creator.post('/api/leads', { data: leadBody(email) });
  expect(res.status(), await res.text()).toBe(201);
  const lead = (await leadByEmail(email))!;
  await creator.dispose();
  return lead;
}

/** What the portal would hand over: a resume token for the lead, signed with the app secret (2 minutes). (`jti`: two tokens made in the same second differ.) */
const resumeToken = (lead: { id: string; session_epoch: number }, target: string, over: Record<string, unknown> = {}, ttl = 120) =>
  signAppToken({ lid: lead.id, ep: lead.session_epoch, p: 'resume', n: target, jti: uuid(), ...over }, ttl);

const resume = (client: APIRequestContext, token: string, extra = '') =>
  client.get(`/api/lead/resume?t=${encodeURIComponent(token)}${extra}`, { maxRedirects: 0 });

const leadCookieOf = (res: APIResponse): string | undefined => setCookies(res).find((c) => c.startsWith('dpl_lead='));
const locationOf = (res: APIResponse): string => redirectUrl(res).href;

test.describe('GET /api/lead/resume', () => {
  test('a good token sets the firm\'s lead cookie for that lead and goes to the step named inside the token', async ({ playwright }) => {
    const lead = await makeLead(playwright, 'resume-ok');
    const steps = ['/apply/booking', '/apply/offer', '/apply/details', '/apply/eligibility', '/he/apply/booking', '/he/apply/offer', '/he/apply/details', '/he/apply/eligibility'];
    for (const step of steps) {
      const browser = await newFunnelClient(playwright);
      expect((await browser.get('/api/lead')).status(), `${step}: nobody before`).toBe(401);
      const res = await resume(browser, resumeToken(lead, step));
      expect(res.status(), step).toBe(303);
      expect(locationOf(res), step).toBe(`${FUNNEL_ORIGIN}${step}`);
      // the cookie is the firm's lead cookie: private to the server, for the lead and the epoch the token named
      const cookie = leadCookieOf(res);
      expect(cookie, step).toMatch(/HttpOnly/i);
      expect(cookie, step).toMatch(/SameSite=Lax/i);
      expect(cookie, step).toMatch(/Path=\//i);
      const value = decodeURIComponent(/^dpl_lead=([^;]*)/.exec(cookie!)![1]!);
      expect(decodeAppToken(value), step).toMatchObject({ p: 'lead', lid: lead.id, ep: lead.session_epoch });
      // ...and the firm's site knows the browser from now on
      const who = await browser.get('/api/lead');
      expect(who.status(), `${step}: known after`).toBe(200);
      expect((await who.json()).leadId).toBe(lead.id);
      await browser.dispose();
    }
  });

  test('"/portal" goes back to the portal\'s own page (also /he/portal): the firm\'s site only renews its cookie on the way', async ({ playwright }) => {
    const lead = await makeLead(playwright, 'resume-portal');
    for (const target of ['/portal', '/he/portal']) {
      const browser = await newFunnelClient(playwright);
      const res = await resume(browser, resumeToken(lead, target));
      expect(res.status(), target).toBe(303);
      expect(locationOf(res), target).toBe(`${PORTAL_ORIGIN}${target}`);
      expect(leadCookieOf(res), target).toBeTruthy();
      expect((await browser.get('/api/lead')).status(), target).toBe(200);
      await browser.dispose();
    }
  });

  test('a good token replaces the cookie of another lead (the browser acts as the verified owner from then on)', async ({ playwright }) => {
    const first = await makeLead(playwright, 'resume-first');
    const second = await makeLead(playwright, 'resume-second');
    const browser = await newFunnelClient(playwright);
    await resume(browser, resumeToken(first, '/apply/booking'));
    expect((await (await browser.get('/api/lead')).json()).leadId).toBe(first.id);
    await resume(browser, resumeToken(second, '/apply/booking'));
    expect((await (await browser.get('/api/lead')).json()).leadId).toBe(second.id);
    await browser.dispose();
  });

  test('a bad token starts the funnel over and sets nothing: missing, garbage, tampered, expired, another purpose, unknown lead', async ({ playwright }) => {
    const lead = await makeLead(playwright, 'resume-bad');
    const good = resumeToken(lead, '/apply/booking');
    const [data, sig] = good.split('.') as [string, string];
    // a signature of another secret, and a payload changed after signing
    const otherSecret = createHmac('sha256', `${APP_SECRET}-not`).update(data).digest('base64url');
    const changed = Buffer.from(JSON.stringify({ ...decodeAppToken(good), n: '/apply/offer' })).toString('base64url');
    const cases: Array<[string, string | null]> = [
      ['no token at all', null],
      ['empty', ''],
      ['garbage', 'not-a-token'],
      ['only a dot', '.'],
      ['signed with another secret', `${data}.${otherSecret}`],
      ['payload changed after signing', `${changed}.${sig}`],
      ['truncated signature', `${data}.${sig.slice(0, 10)}`],
      ['expired', resumeToken(lead, '/apply/booking', {}, -30)],
      ['unknown lead', resumeToken({ id: uuid(), session_epoch: lead.session_epoch }, '/apply/booking')],
      ['no destination', signAppToken({ lid: lead.id, ep: lead.session_epoch, p: 'resume' }, 120)],
      ['no lead', signAppToken({ ep: lead.session_epoch, p: 'resume', n: '/apply/booking' }, 120)],
    ];
    // a valid signature for something else is no resume token: the emailed portal link, the hand-over to the portal, the lead
    // cookie and the unsubscribe link carry the same lead id but are only good for their own purpose
    for (const p of ['portal', 'enter', 'lead', 'unsub']) {
      cases.push([`purpose "${p}"`, signAppToken({ lid: lead.id, ep: lead.session_epoch, p, n: '/apply/booking' }, 120)]);
    }
    for (const [name, token] of cases) {
      const browser = await newFunnelClient(playwright);
      const res = token === null ? await browser.get('/api/lead/resume', { maxRedirects: 0 }) : await resume(browser, token);
      expect(res.status(), name).toBe(303);
      expect(locationOf(res), name).toBe(RESTART);
      expect(leadCookieOf(res), `${name}: no cookie`).toBeUndefined();
      expect((await browser.get('/api/lead')).status(), `${name}: still nobody`).toBe(401);
      await browser.dispose();
    }
  });

  test('a token of an old session epoch is dead: the link was replaced, the mailbox proved again', async ({ playwright }) => {
    const lead = await makeLead(playwright, 'resume-epoch');
    const token = resumeToken(lead, '/apply/booking');
    // a newer epoch (what proving the mailbox from another browser does) kills the token; one from the future is no good either
    const bump = await fetch(`${SUPABASE_URL}/rest/v1/leads?id=eq.${lead.id}`, { method: 'PATCH', headers: { ...headers(), prefer: 'return=minimal' }, body: JSON.stringify({ session_epoch: lead.session_epoch + 1 }) });
    expect(bump.ok).toBe(true);
    const browser = await newFunnelClient(playwright);
    for (const [name, t] of [['the old epoch', token], ['an epoch not reached yet', resumeToken(lead, '/apply/booking', { ep: lead.session_epoch + 5 })]] as const) {
      const res = await resume(browser, t);
      expect(res.status(), name).toBe(303);
      expect(locationOf(res), name).toBe(RESTART);
      expect(leadCookieOf(res), name).toBeUndefined();
    }
    expect((await browser.get('/api/lead')).status()).toBe(401);
    // the current epoch works
    const now = await resume(browser, resumeToken({ id: lead.id, session_epoch: lead.session_epoch + 1 }, '/apply/booking'));
    expect(locationOf(now)).toBe(`${FUNNEL_ORIGIN}/apply/booking`);
    expect((await browser.get('/api/lead')).status()).toBe(200);
    await browser.dispose();
  });

  test('the destination cannot be forged: only the funnel\'s four steps and /portal pass, the query string cannot name another one', async ({ playwright }) => {
    const lead = await makeLead(playwright, 'resume-target');
    // (all of these are signed with the real secret: the check is the route's own, on top of the signature)
    const forged = [
      'https://evil.example/',
      'https://evil.example/apply/booking',
      '//evil.example',
      '//evil.example/apply/booking',
      '/\\evil.example',
      '\\\\evil.example',
      'javascript:alert(1)',
      'http://localhost:3000.evil.example/apply/booking',
      '/apply',
      '/apply/',
      '/apply/privacy',
      '/apply/booking/',
      '/apply/booking?next=https://evil.example',
      '/apply/booking#x',
      '/apply/booking/../../admin',
      '/apply/../portal',
      '/apply/%2e%2e/portal',
      '/he/he/apply/booking',
      '/HE/apply/booking',
      '/APPLY/booking',
      '/portal/documents',
      '/portal?x=1',
      '/portal/',
      '/he/portal/documents',
      '/admin',
      '/he/admin',
      '/api/lead/forget',
      '/sign-in',
      '/',
      '',
      ' /apply/booking',
      '/apply/booking\n',
      '/apply/booking%0d%0aLocation: https://evil.example',
    ];
    for (const target of forged) {
      const browser = await newFunnelClient(playwright);
      const res = await resume(browser, resumeToken(lead, target));
      expect(res.status(), JSON.stringify(target)).toBe(303);
      expect(locationOf(res), JSON.stringify(target)).toBe(RESTART);
      expect(leadCookieOf(res), `${JSON.stringify(target)}: no cookie`).toBeUndefined();
      await browser.dispose();
    }
    // the address is only a carrier: parameters next to the token cannot change where it ends
    const browser = await newFunnelClient(playwright);
    for (const extra of ['&n=https://evil.example', '&next=https://evil.example/', '&target=//evil.example', '&redirect=https://evil.example', '&to=/admin', '&t=other']) {
      const res = await resume(browser, resumeToken(lead, '/apply/booking'), extra);
      expect(res.status(), extra).toBe(303);
      expect(locationOf(res), extra).toBe(`${FUNNEL_ORIGIN}/apply/booking`);
    }
    // and the host that answers does not come from the request either
    const spoofed = await browser.get(`/api/lead/resume?t=${encodeURIComponent(resumeToken(lead, '/apply/booking'))}`, {
      maxRedirects: 0,
      headers: { 'x-forwarded-host': 'evil.example', 'x-forwarded-proto': 'https', host: 'evil.example' },
    });
    expect(spoofed.status()).toBe(303);
    expect(new URL(locationOf(spoofed)).origin).toBe(FUNNEL_ORIGIN);
    await browser.dispose();
  });

  test('the portal\'s own tokens cannot be forged into a hand-over to somewhere else: /go only hands over the funnel\'s four steps and /portal', async ({ playwright }) => {
    const lead = await makeLead(playwright, 'resume-go');
    const portal = await newPortalClient(playwright);
    // a portal link whose destination is not one of the steps never reaches the firm's resume route with it
    for (const n of ['/portal/documents', '/portal/application', '/admin', '/sign-in', '/apply/booking', '//evil.example', 'https://evil.example/apply/booking']) {
      const row = (await leadByEmail(lead.email))!;
      const res = await portal.post(`/go/${signAppToken({ lid: row.id, ep: row.session_epoch, p: 'portal', n }, 3600)}`, { maxRedirects: 0 });
      expect(res.status(), n).toBe(303);
      const to = redirectUrl(res);
      if (to.origin === FUNNEL_ORIGIN) {
        // (only the renewal of the cookie on the first proof of the mailbox, and only for /portal)
        expect(to.pathname, n).toBe('/api/lead/resume');
        expect(decodeAppToken(to.searchParams.get('t')!), n).toMatchObject({ p: 'resume', n: '/portal' });
      } else {
        expect(to.origin, n).toBe(PORTAL_ORIGIN);
      }
    }
    await portal.dispose();
  });
});

test.describe('GET /api/lead/forget', () => {
  test('clears the lead cookie, is never cached, and goes to the portal\'s sign-in page', async ({ playwright }) => {
    const browser = await newFunnelClient(playwright);
    const email = newEmail('forget');
    expect((await browser.post('/api/leads', { data: leadBody(email) })).status()).toBe(201);
    expect((await browser.get('/api/lead')).status()).toBe(200);
    expect((await browser.post('/api/portal/enter')).status(), 'the cookie opens the hand-over to the portal').toBe(200);

    const res = await browser.get('/api/lead/forget', { maxRedirects: 0 });
    expect(res.status()).toBe(303);
    expect(locationOf(res)).toBe(`${PORTAL_ORIGIN}/sign-in`);
    expect(res.headers()['cache-control']).toMatch(/no-store/);
    // the cookie is expired by the answer (an empty value that is gone at once)
    const cleared = leadCookieOf(res);
    expect(cleared, 'the answer clears dpl_lead').toBeTruthy();
    expect(cleared).toMatch(/^dpl_lead=;/);
    expect(cleared).toMatch(/Max-Age=0|Expires=Thu, 01 Jan 1970/i);
    expect((await browser.storageState()).cookies.filter((c) => c.name === 'dpl_lead')).toEqual([]);
    // ...so the firm's site no longer knows this browser
    expect((await browser.get('/api/lead')).status()).toBe(401);
    expect((await browser.post('/api/portal/enter')).status()).toBe(401);
    // the page it ends on is the portal's sign-in
    const portal = await newPortalClient(playwright);
    const page = await portal.get(locationOf(res), { maxRedirects: 0, headers: { accept: 'text/html' } });
    expect(page.status()).toBe(200);
    await portal.dispose();
    await browser.dispose();
  });

  test('without any cookie it is harmless and ends the same way (so a stranger cannot learn anything from it)', async ({ playwright }) => {
    const browser = await newFunnelClient(playwright);
    const res = await browser.get('/api/lead/forget', { maxRedirects: 0 });
    expect(res.status()).toBe(303);
    expect(locationOf(res)).toBe(`${PORTAL_ORIGIN}/sign-in`);
    await browser.dispose();
  });

  test('in Hebrew (?l=he) it ends on the Hebrew sign-in page in the bilingual build, on the English one otherwise; any other value is English', async ({ playwright }) => {
    const bilingual = await funnelIsBilingual();
    const browser = await newFunnelClient(playwright);
    const hebrew = await browser.get('/api/lead/forget?l=he', { maxRedirects: 0 });
    expect(hebrew.status()).toBe(303);
    expect(locationOf(hebrew)).toBe(`${PORTAL_ORIGIN}${bilingual ? '/he' : ''}/sign-in`);
    for (const l of ['en', 'fr', 'HE', 'he ', ' he', 'he,en', '../he', '%00he', '']) {
      const res = await browser.get(`/api/lead/forget?l=${encodeURIComponent(l)}`, { maxRedirects: 0 });
      expect(locationOf(res), JSON.stringify(l)).toBe(`${PORTAL_ORIGIN}/sign-in`);
    }
    // the first value counts and nothing else is read from the query
    expect(locationOf(await browser.get('/api/lead/forget?l=en&l=he', { maxRedirects: 0 }))).toBe(`${PORTAL_ORIGIN}/sign-in`);
    await browser.dispose();

    // the Hebrew page it names really is a page of the portal (a redirect to the English one when the build has no Hebrew)
    const portal = await newPortalClient(playwright);
    const page = await portal.get(locationOf(hebrew), { maxRedirects: 0, headers: { accept: 'text/html' } });
    expect(page.status()).toBe(200);
    await portal.dispose();
  });

  test('the destination is fixed: nothing in the query or the headers can send the browser elsewhere', async ({ playwright }) => {
    const browser = await newFunnelClient(playwright);
    for (const query of ['next=https://evil.example', 'url=https://evil.example', 'redirect=//evil.example', 'return=/admin', 'l=https://evil.example', 'l=he&next=https://evil.example']) {
      const res = await browser.get(`/api/lead/forget?${query}`, { maxRedirects: 0 });
      expect(res.status(), query).toBe(303);
      expect(new URL(locationOf(res)).origin, query).toBe(PORTAL_ORIGIN);
      expect(new URL(locationOf(res)).pathname, query).toMatch(/^(\/he)?\/sign-in$/);
      expect(new URL(locationOf(res)).search, query).toBe('');
    }
    const spoofed = await browser.get('/api/lead/forget', { maxRedirects: 0, headers: { 'x-forwarded-host': 'evil.example', 'x-forwarded-proto': 'https', host: 'evil.example' } });
    expect(new URL(locationOf(spoofed)).origin).toBe(PORTAL_ORIGIN);
    await browser.dispose();
  });

  test('sign-out then forget, with the two sites\' cookies kept apart: the firm\'s cookie outlives the portal\'s sign-out until the browser passes through /api/lead/forget', async ({ playwright }) => {
    const person = await newVisitor(playwright);
    const email = newEmail('forget-chain');
    expect((await person.funnel.post('/api/leads', { data: leadBody(email) })).status()).toBe(201);
    await goToPortal(person);
    expect((await person.portal.get('/api/portal/state')).status()).toBe(200);

    // the portal's own sign-out cannot reach the firm's cookie (another domain): it names where the browser goes next
    const out = await person.portal.post('/api/portal/sign-out');
    expect(out.status()).toBe(200);
    const { forgetUrl } = (await out.json()) as { forgetUrl: string };
    expect(forgetUrl).toBe(`${FUNNEL_ORIGIN}/api/lead/forget`);
    expect((await person.portal.get('/api/portal/state')).status(), 'the portal session is closed').toBe(401);
    expect((await person.funnel.post('/api/portal/enter')).status(), 'without the hop the firm\'s cookie would let the next person in').toBe(200);

    // the button navigates to forgetUrl?l=<locale>: the firm's site forgets, and the browser ends on the portal's sign-in
    const hop = await person.funnel.get(`${forgetUrl}?l=en`, { maxRedirects: 0 });
    expect(hop.status()).toBe(303);
    expect(locationOf(hop)).toBe(`${PORTAL_ORIGIN}/sign-in`);
    expect((await person.funnel.post('/api/portal/enter')).status()).toBe(401);
    expect((await person.funnel.get('/api/lead')).status()).toBe(401);
    await person.dispose();
  });
});

test.describe('POST /api/auth/link on the firm\'s site', () => {
  const fileOpenMails = async (leadId: string) =>
    (await eventsOf(leadId)).filter((e) => e.type === 'email.send' && e.payload.template === 'file-open');
  const mailsTo = (email: string) => rest<{ id: string; payload: Record<string, unknown> }>('events', `type=eq.email.send&payload->to->>email=eq.${encodeURIComponent(email)}&select=id,payload`);

  test('always answers 200 { ok: true }, the same for a known and an unknown address, and emails a fresh link only to the known one', async ({ playwright }) => {
    const lead = await makeLead(playwright, 'link-known');
    const ghost = newEmail('link-ghost');
    const stranger = await newFunnelClient(playwright);
    const known = await stranger.post('/api/auth/link', { data: { email: lead.email } });
    const unknown = await stranger.post('/api/auth/link', { data: { email: ghost } });
    expect([known.status(), unknown.status()]).toEqual([200, 200]);
    expect(await known.json()).toEqual({ ok: true });
    expect(await unknown.json()).toEqual({ ok: true });
    expect(known.headers()['content-type']).toBe(unknown.headers()['content-type']);

    // the mail goes to the owner of the address (after the response), with a link into the portal
    const mail = await eventually(async () => (await fileOpenMails(lead.id))[0], 'the new link email');
    expect(mail.payload.to?.email).toBe(lead.email);
    expect(mail.dedupe_key).toMatch(new RegExp(`^file-open:resend:${lead.id}:`));
    const link = linkIn(mail.payload, /https?:\/\/[^\s"'<>]+\/go\/[\w.-]+/)!;
    expect(new URL(link).origin, 'the link opens the portal').toBe(PORTAL_ORIGIN);
    expect(decodeAppToken(new URL(link).pathname.split('/').pop()!)).toMatchObject({ p: 'portal', lid: lead.id, ep: lead.session_epoch, n: '/portal' });
    // an unknown address gets nothing (give the work that runs after the response a moment to show itself)
    await new Promise((r) => setTimeout(r, 1500));
    expect(await mailsTo(ghost)).toEqual([]);
    await stranger.dispose();
  });

  test('the address is matched the way a person types it (capitals, spaces), and asking again within the hour sends no second email', async ({ playwright }) => {
    const lead = await makeLead(playwright, 'link-case');
    const hourBefore = new Date().getUTCHours();
    const client = await newFunnelClient(playwright);
    const typed = `  ${lead.email.toUpperCase()}  `;
    expect((await client.post('/api/auth/link', { data: { email: typed } })).status()).toBe(200);
    await eventually(async () => (await fileOpenMails(lead.id))[0], 'the new link email');
    expect((await client.post('/api/auth/link', { data: { email: lead.email } })).status()).toBe(200);
    await new Promise((r) => setTimeout(r, 1500));
    // (at most one per reason and hour, so repeating a request can not flood somebody's inbox; the hour may have turned meanwhile)
    const sent = await fileOpenMails(lead.id);
    expect(sent.length).toBe(new Date().getUTCHours() === hourBefore ? 1 : sent.length);
    expect(sent.length).toBeLessThanOrEqual(2);
    await client.dispose();
  });

  test('a filled honeypot looks like a success and queues nothing', async ({ playwright }) => {
    const lead = await makeLead(playwright, 'link-bot');
    const bot = await newFunnelClient(playwright);
    const res = await bot.post('/api/auth/link', { data: { email: lead.email, website: 'http://spam.example' } });
    expect(res.status()).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    await new Promise((r) => setTimeout(r, 1500));
    expect(await fileOpenMails(lead.id)).toEqual([]);
    await bot.dispose();
  });

  test('refuses what is not an address (400), another site\'s Origin (403) and answers 429 from the sixth request in a minute', async ({ playwright }) => {
    for (const data of [{}, { email: 'nope' }, { email: '' }, { email: 'a b@example.com' }, { email: 42 }]) {
      const client = await newFunnelClient(playwright);
      const res = await client.post('/api/auth/link', { data });
      expect(res.status(), JSON.stringify(data)).toBe(400);
      await client.dispose();
    }
    // (a request from another site, or from the portal, is refused before anything else is read)
    const client = await newFunnelClient(playwright);
    for (const origin of ['https://evil.example', PORTAL_ORIGIN]) {
      const res = await client.post('/api/auth/link', { data: { email: 'a@b.co' }, headers: { origin } });
      expect(res.status(), origin).toBe(403);
      expect((await res.json()).error).toBe('bad_origin');
    }
    // 5 a minute per address
    const limited = await newFunnelClient(playwright);
    for (let i = 0; i < 5; i++) {
      expect((await limited.post('/api/auth/link', { data: { email: newEmail('link-limit') } })).status(), `#${i + 1}`).toBe(200);
    }
    const sixth = await limited.post('/api/auth/link', { data: { email: newEmail('link-limit') } });
    expect(sixth.status()).toBe(429);
    expect((await sixth.json()).error).toBe('rate_limited');
    expect(sixth.headers()['retry-after']).toBe('60');
    // another address is not affected
    const other = await newFunnelClient(playwright);
    expect((await other.post('/api/auth/link', { data: { email: newEmail('link-limit') } })).status()).toBe(200);
    await limited.dispose();
    await other.dispose();
    await client.dispose();
  });

  test('the portal\'s own /api/auth/link (expired-link page) still works next to it and does not take the firm\'s Origin', async ({ playwright }) => {
    const lead = await makeLead(playwright, 'link-both');
    const portal = await newPortalClient(playwright);
    expect((await portal.post('/api/auth/link', { data: { email: lead.email } })).status()).toBe(200);
    await eventually(async () => (await fileOpenMails(lead.id))[0], 'the new link email from the portal\'s route');
    // each route is same-origin only: the firm's page cannot call the portal's route and the other way round
    const cross = await portal.post('/api/auth/link', { data: { email: lead.email }, headers: { origin: FUNNEL_ORIGIN } });
    expect(cross.status()).toBe(403);
    await portal.dispose();
  });
});
