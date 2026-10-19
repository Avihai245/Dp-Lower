import { expect as baseExpect, devices, test, type Browser, type Page } from '@playwright/test';
import enAuth from '../apps/campaign/messages/en/auth.json';
import heAuth from '../apps/campaign/messages/he/auth.json';
import enFunnel from '../apps/main/messages/en/funnel.json';
import heFunnel from '../apps/main/messages/he/funnel.json';
import {
  BASE_URL,
  FUNNEL_URL,
  SERVICE_KEY,
  SUPABASE_URL,
  cleanup,
  decodeAppToken,
  eventsOf,
  eventually,
  hebrewIsOn,
  leadBody,
  leadByEmail,
  linkIn,
  newEmail,
  newIp,
  NO_HEBREW,
  rest,
} from './support/funnel';
import { applyPath, isolatedFunnelUrl, onFunnel, originOf, watchProblems } from './support/funnel-ui';

/**
 * The booked call on the funnel's booking step (on the firm's site, /apply/booking), in English and Hebrew: book, see the
 * call again after a reload, change it, cancel it (with the second click), and get back to the free times with a line saying
 * it was cancelled; the confirmation email's "Change or cancel" (a link into the portal's site, /go/<token>, which hands over to
 * the booking step) opens the same step in another browser. The database and the outbox are checked for what each step leaves
 * behind.
 *
 *   CAMPAIGN_URL=http://localhost:3001 MAIN_URL=http://localhost:3000 pnpm exec playwright test e2e/funnel.booking.spec.ts
 */
test.describe.configure({ mode: 'serial' });
test.setTimeout(120_000);
test.afterAll(cleanup);
const expect = baseExpect.configure({ timeout: 20_000 });

const LOCALES = [
  { locale: 'en' as const, prefix: '', tz: 'America/New_York', funnel: enFunnel, auth: enAuth },
  { locale: 'he' as const, prefix: '/he', tz: 'Asia/Jerusalem', funnel: heFunnel, auth: heAuth },
];
type Loc = (typeof LOCALES)[number];

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** A visitor with an own address; no baseURL: every address names the firm's site (onFunnel) or the portal's site (BASE_URL). */
async function visitor(browser: Browser, L: Loc, phone = false) {
  const context = await browser.newContext({
    ...(phone ? devices['Pixel 7'] : { viewport: { width: 1440, height: 900 } }),
    locale: L.locale === 'he' ? 'he-IL' : 'en-US',
    timezoneId: L.tz,
    extraHTTPHeaders: { 'x-forwarded-for': newIp() },
  });
  const page = await context.newPage();
  return { context, page, problems: watchProblems(page) };
}

interface AvailabilityBody {
  days: Array<{ date: string; slots: Array<{ startsAt: string; remaining: number }> }>;
}

/** Two completely free slots counted from the back of the calendar (where nobody else is competing), as UI positions. */
async function freeSlots(page: Page) {
  const av = (await (await page.request.get(onFunnel('/api/availability'))).json()) as AvailabilityBody;
  const out: Array<{ day: number; index: number; startsAt: string }> = [];
  for (let d = av.days.length - 1; d >= 0 && out.length < 2; d--) {
    const slots = av.days[d]!.slots;
    for (let i = slots.length - 1; i >= 0 && out.length < 2; i--)
      if (slots[i]!.remaining === 2) out.push({ day: d, index: i, startsAt: slots[i]!.startsAt });
  }
  if (out.length < 2) throw new Error('not enough completely free slots');
  return out;
}

const bookingsOf = (leadId: string) =>
  rest<{ id: string; status: string; starts_at: string; cancelled_at: string | null }>(
    'bookings',
    `lead_id=eq.${leadId}&order=created_at.asc&select=id,status,starts_at,cancelled_at`,
  );

for (const L of LOCALES) {
  test(`${L.locale}: book, find the call again after a reload, change it and cancel it from the booking step @mobile`, async ({
    browser,
  }, info) => {
    test.skip(L.locale === 'he' && !(await hebrewIsOn()), NO_HEBREW);
    const phone = info.project.name === 'mobile';
    // (on the phone the page must not be wider than the screen: see the test "the booking step does not scroll sideways" below)
    const { context, page, problems } = await visitor(browser, L, phone);
    const b = L.funnel.booking;
    const bookButton = page.getByRole('button', {
      name: new RegExp(
        `^${b.bookFor
          .replace('{time}', '')
          .trim()
          .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`,
      ),
    });
    const email = newEmail(`manage-${L.locale}${phone ? '-m' : ''}`);
    expect(
      (await context.request.post(onFunnel('/api/leads'), { data: leadBody(email, { locale: L.locale }) })).status(),
    ).toBe(201);
    const lead = (await leadByEmail(email))!;
    const [first, second] = await freeSlots(page);

    // book through the screen
    await page.goto(onFunnel(applyPath(L.locale, '/booking')));
    await page.locator('[aria-labelledby=book-day] button').nth(first!.day).click();
    await page.locator('[aria-labelledby=book-time] button').nth(first!.index).click();
    await bookButton.click();
    await expect(page.locator('h1')).toHaveText(b.done.title);
    expect((await bookingsOf(lead.id)).map((r) => r.status)).toEqual(['confirmed']);

    // a reload shows the same call, with both ways out
    await page.reload();
    await expect(page.locator('h1')).toHaveText(b.done.title);
    await expect(page.locator('[data-confetti]')).toHaveCount(0);
    await expect(page.getByRole('button', { name: b.done.change })).toBeVisible();
    await expect(page.getByRole('button', { name: b.manage.cancel })).toBeVisible();
    const api = (await (await context.request.get(onFunnel('/api/lead'))).json()) as {
      booking: { startsAt: string } | null;
    };
    expect(api.booking?.startsAt).toBe(first!.startsAt);

    // change it: the held call is shown above the times; "keep" goes back without changing anything
    await page.getByRole('button', { name: b.done.change }).click();
    const current = page.locator('[data-current-call]');
    await expect(current).toContainText(b.manage.yourCall.split('{date}')[0]!.trim());
    await current.getByRole('button', { name: b.manage.keep }).click();
    await expect(page.locator('h1')).toHaveText(b.done.title);
    await page.getByRole('button', { name: b.done.change }).click();
    await page.locator('[aria-labelledby=book-day] button').nth(second!.day).click();
    await page.locator('[aria-labelledby=book-time] button').nth(second!.index).click();
    await bookButton.click();
    await expect(page.locator('h1')).toHaveText(b.done.title);
    await expect
      .poll(async () => (await bookingsOf(lead.id)).map((r) => r.status))
      .toEqual(['cancelled', 'confirmed']);

    // cancel it: the first click only asks
    await page.getByRole('button', { name: b.manage.cancel }).click();
    const confirm = page.locator('[data-cancel-confirm]');
    await expect(confirm).toBeVisible();
    await confirm.getByRole('button', { name: b.manage.confirmNo }).click();
    await expect(confirm).toHaveCount(0);
    expect((await bookingsOf(lead.id)).map((r) => r.status)).toEqual(['cancelled', 'confirmed']);
    await page.getByRole('button', { name: b.manage.cancel }).click();
    await page.locator('[data-cancel-confirm]').getByRole('button', { name: b.manage.confirmYes }).click();

    // back to the free times, with the cancelled call named
    await expect(page.locator('[data-call-cancelled]')).toBeVisible();
    await expect(page.locator('[data-current-call]')).toHaveCount(0);
    await expect(page.locator('[aria-labelledby=book-day] button').first()).toBeVisible();
    const rows = await bookingsOf(lead.id);
    expect(rows.map((r) => r.status)).toEqual(['cancelled', 'cancelled']);
    expect(rows[1]!.cancelled_at).toBeTruthy();

    // the outbox: booking.cancelled for the CRM and the booking-cancelled email, each once
    const cancelledId = rows[1]!.id;
    const events = await eventually(async () => {
      const all = await eventsOf(lead.id);
      return all.some((e) => e.dedupe_key === `booking-cancelled:${cancelledId}`) ? all : null;
    }, 'the cancellation email');
    expect(events.filter((e) => e.dedupe_key === `booking.cancelled:${cancelledId}`)).toHaveLength(1);
    expect(events.find((e) => e.dedupe_key === `booking.cancelled:${cancelledId}`)?.payload).toMatchObject({
      reason: 'cancelled',
    });
    const mail = events.find((e) => e.dedupe_key === `booking-cancelled:${cancelledId}`)!;
    expect(mail.payload.template).toBe('booking-cancelled');
    // the emailed link opens the portal's site (/go/<token>), not the firm's
    const goLink = linkIn(mail.payload, /https?:\/\/[^\s"<]+\/go\/[\w.-]+/);
    expect(goLink).toBeTruthy();
    expect(originOf(goLink!)).toBe(originOf(BASE_URL));

    // after a reload there is no call any more
    await page.reload();
    await expect(page.locator('[aria-labelledby=book-day] button').first()).toBeVisible();
    await expect(page.locator('[data-current-call]')).toHaveCount(0);
    expect(
      ((await (await context.request.get(onFunnel('/api/lead'))).json()) as { booking: unknown }).booking,
    ).toBeNull();

    // nothing scrolls sideways at this width
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
    expect(problems).toEqual([]);
    await context.close();
  });
}

/**
 * The phone-width rules of the funnel screens (`@media (max-width: 640px)` in apps/main/src/styles/landing.css: [data-step-label]
 * { display: none }, [data-stepper] { gap: 6px }, [data-step-line] ..., [data-slots] { 2 columns }) keep the booking step's
 * four-step header (Answers / Details / Call / Result) within a 390-412 px screen, with the free times and with a booked call,
 * in English and Hebrew (without them it is 554 px wide and the page scrolls sideways by 142-164 px).
 * It is a separate test, not part of the flow above, so that the flow keeps covering what it covers.
 */
test('the booking step does not scroll sideways at phone width, with times and with a booked call, in both languages', async ({
  browser,
}) => {
  for (const L of LOCALES) {
    if (L.locale === 'he' && !(await hebrewIsOn())) continue;
    const { context, page } = await visitor(browser, L, true);
    expect(
      (await context.request.post(onFunnel('/api/leads'), { data: leadBody(newEmail(`narrow-${L.locale}`), { locale: L.locale }) })).status(),
    ).toBe(201);
    const overflow = () =>
      page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    await page.goto(onFunnel(applyPath(L.locale, '/booking')));
    await expect(page.locator('[aria-labelledby=book-day] button').first()).toBeVisible();
    expect(await overflow(), `${L.locale}: free times`).toBeLessThanOrEqual(0);
    const [slot] = await freeSlots(page);
    expect((await context.request.post(onFunnel('/api/bookings'), { data: { startsAt: slot!.startsAt, timezone: L.tz } })).status()).toBe(201);
    await page.reload();
    await expect(page.locator('h1')).toHaveText(L.funnel.booking.done.title);
    expect(await overflow(), `${L.locale}: booked call`).toBeLessThanOrEqual(0);
    await context.close();
  }
});

/** The booking-confirmation email of a lead with a call, and the "Change or cancel" address in it. */
async function confirmationLink(browser: Browser, L: Loc, label: string) {
  const owner = await visitor(browser, L);
  const email = newEmail(label);
  expect(
    (await owner.context.request.post(onFunnel('/api/leads'), { data: leadBody(email, { locale: L.locale }) })).status(),
  ).toBe(201);
  const lead = (await leadByEmail(email))!;
  const [slot] = await freeSlots(owner.page);
  expect(
    (
      await owner.context.request.post(onFunnel('/api/bookings'), {
        data: { startsAt: slot!.startsAt, timezone: L.tz },
      })
    ).status(),
  ).toBe(201);
  const [booking] = await bookingsOf(lead.id);
  const mail = await eventually(
    async () => (await eventsOf(lead.id)).find((e) => e.dedupe_key === `booking-confirmation:${booking!.id}`),
    'the confirmation email',
  );
  const html = mail.payload.html ?? '';
  const text = L.locale === 'he' ? 'שינוי או ביטול' : 'Change or cancel';
  const href = new RegExp(`<a href="([^"]+)"[^>]*>${text}</a>`).exec(html)?.[1]?.replace(/&amp;/g, '&');
  await owner.context.close();
  return { lead, booking: booking!, href: href! };
}

/** Marks the mailbox of a lead as proven (the state after the applicant has opened one emailed link before). */
async function verifyMailbox(leadId: string) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/leads?id=eq.${leadId}`, {
    method: 'PATCH',
    headers: { apikey: SERVICE_KEY, authorization: `Bearer ${SERVICE_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({ email_verified_at: new Date().toISOString() }),
  });
  if (!res.ok) throw new Error(`verifying the mailbox failed: ${res.status}`);
}

const HE = LOCALES[1]!;

test('the confirmation email’s "Change or cancel" is a link into the portal’s site; in another browser it asks for a click first', async ({
  browser,
}) => {
  test.skip(!(await hebrewIsOn()), NO_HEBREW);
  const { href } = await confirmationLink(browser, HE, 'manage-link');
  expect(href).toMatch(new RegExp(`^${escapeRe(BASE_URL)}/he/go/[\\w.-]+$`));

  // a different browser: the link asks for a click first (mail scanners open links), on the portal's site
  const other = await visitor(browser, HE);
  await other.page.goto(href);
  await expect(other.page).toHaveURL(new RegExp(`^${escapeRe(BASE_URL)}/he/open-link\\?t=`));
  await expect(other.page.locator('h1')).toHaveText(HE.auth.openLink.portal.title);
  await expect(other.page.getByRole('button', { name: HE.auth.openLink.portal.submit })).toBeVisible();
  // looking at it changed nothing: the link is still good
  expect(other.problems).toEqual([]);
  await other.context.close();
});

/**
 * The click on the confirmation page (/open-link, a plain form POST to /go/<token>) is answered with a 303 to the firm's site
 * (/api/lead/resume, which goes on to /apply/booking). The portal's Content-Security-Policy applies `form-action` to the
 * redirects that follow a form submission, so it has to name the firm's origin as well as 'self' (apps/campaign/next.config.ts):
 * with `form-action 'self'` alone Chromium refuses the cross-site hop and the button does nothing. EVERY first click on an
 * emailed "Change or cancel" / "Book my free call" link goes through this page (this browser is never the one that created the
 * lead in production, where the lead cookie belongs to the firm's domain), so the whole chain is walked in a real browser.
 */
test('the confirmation email’s "Change or cancel": pressing the button on the confirmation page opens the booking step with the call, in another browser', async ({
  browser,
}) => {
  test.skip(!(await hebrewIsOn()), NO_HEBREW);
  const { lead, href } = await confirmationLink(browser, HE, 'manage-press');
  const other = await visitor(browser, HE);
  await other.page.goto(href);
  await expect(other.page).toHaveURL(/\/he\/open-link\?t=/);
  await other.page.getByRole('button', { name: HE.auth.openLink.portal.submit }).click();
  await expect(other.page).toHaveURL(new RegExp(`^${escapeRe(FUNNEL_URL)}/he/apply/booking$`));
  await expect(other.page.locator('h1')).toHaveText(HE.funnel.booking.done.title);
  await other.page.getByRole('button', { name: HE.funnel.booking.manage.cancel }).click();
  await other.page
    .locator('[data-cancel-confirm]')
    .getByRole('button', { name: HE.funnel.booking.manage.confirmYes })
    .click();
  await expect(other.page.locator('[data-call-cancelled]')).toBeVisible();
  expect((await bookingsOf(lead.id)).map((r) => r.status)).toEqual(['cancelled']);
  expect(other.problems).toEqual([]);
  await other.context.close();
});

test('the confirmation email’s "Change or cancel" with a proven mailbox opens the booking step on the firm’s site, in the same language, and cancelling works there', async ({
  browser,
}) => {
  test.skip(!(await hebrewIsOn()), NO_HEBREW);
  const { lead, booking, href } = await confirmationLink(browser, HE, 'manage-open');
  await verifyMailbox(lead.id);

  // a different browser, mailbox already proven: no confirmation page, /he/go -> the firm's /api/lead/resume -> /he/apply/booking.
  // (On localhost both sites share their cookies, so the session that /go opens is also seen by the firm's site; the next
  // test is the same walk with the sites kept apart, as they are in production.)
  const other = await visitor(browser, HE);
  await other.page.goto(href);
  await expect(other.page).toHaveURL(new RegExp(`^${escapeRe(FUNNEL_URL)}/he/apply/booking$`));
  await expect(other.page.locator('h1')).toHaveText(HE.funnel.booking.done.title);
  await other.page.getByRole('button', { name: HE.funnel.booking.manage.cancel }).click();
  await other.page
    .locator('[data-cancel-confirm]')
    .getByRole('button', { name: HE.funnel.booking.manage.confirmYes })
    .click();
  await expect(other.page.locator('[data-call-cancelled]')).toBeVisible();
  expect((await bookingsOf(lead.id)).map((r) => ({ id: r.id, status: r.status }))).toEqual([{ id: booking.id, status: 'cancelled' }]);
  expect(other.problems).toEqual([]);
  await other.context.close();
});

/**
 * /go/<token> opens the applicant's session on the PORTAL's site and the booking step is on the FIRM's site. In production those
 * are two domains (euro-passports.com, lawoffice.org.il) that share no cookies, so the firm's site sees neither the portal
 * session nor a lead cookie: without a hand-over GET /api/lead answers 401 and the booking step replaces itself with
 * /apply/details (and /apply/eligibility). So /go answers 303 to the firm's GET /api/lead/resume?t=<2-minute token> (the target
 * /he/apply/booking is signed into it), which sets the firm's own lead cookie and goes to the step. On localhost both sites
 * share one cookie jar, which would hide a missing hand-over, so the test opens the firm's site under its other host name
 * (127.0.0.1 instead of localhost), as in production: first the /go link on the portal's site (which opens the session there
 * and answers with the redirect to the hand-over), then the firm's site, which knows nobody until the hand-over has run.
 */
test('the confirmation email\u2019s "Change or cancel" shows the call even though the firm\u2019s site shares no cookies with the portal\u2019s site', async ({
  browser,
}) => {
  test.skip(!(await hebrewIsOn()), NO_HEBREW);
  const funnel = isolatedFunnelUrl();
  test.skip(!funnel, 'needs the firm\u2019s site on localhost, to address it under a second host name');
  const { lead, href } = await confirmationLink(browser, HE, 'manage-apart');
  await verifyMailbox(lead.id);
  const other = await visitor(browser, HE);
  const go = await other.context.request.get(href, { maxRedirects: 0 });
  expect(go.status()).toBe(303);
  // the portal's answer is the hand-over to the firm's site, with a short-lived token that names the lead and the step
  const resume = new URL(go.headers()['location']!, href);
  expect(resume.origin).toBe(originOf(FUNNEL_URL));
  expect(resume.pathname).toBe('/api/lead/resume');
  const token = decodeAppToken(resume.searchParams.get('t')!);
  expect(token).toMatchObject({ p: 'resume', lid: lead.id, n: '/he/apply/booking' });
  expect((token.exp ?? 0) - Math.floor(Date.now() / 1000)).toBeLessThanOrEqual(120);

  // nothing the portal set reaches the firm's site (another host name): before the hand-over the browser is nobody there
  expect((await other.context.request.get(`${funnel}/api/lead`)).status()).toBe(401);
  // the hand-over, replayed on the firm's site under its other host name (the redirect itself names the configured host)
  const resumed = await other.context.request.get(`${funnel}/api/lead/resume${resume.search}`, { maxRedirects: 0 });
  expect(resumed.status()).toBe(303);
  expect(new URL(resumed.headers()['location']!, funnel!).pathname).toBe('/he/apply/booking');
  expect(resumed.headersArray().some((h) => h.name.toLowerCase() === 'set-cookie' && /^dpl_lead=/.test(h.value))).toBe(true);
  expect((await other.context.request.get(`${funnel}/api/lead`)).status()).toBe(200);

  await other.page.goto(`${funnel}/he/apply/booking`);
  await expect(other.page).toHaveURL(new RegExp(`^${escapeRe(funnel!)}/he/apply/booking$`));
  await expect(other.page.locator('h1')).toHaveText(HE.funnel.booking.done.title);
  expect((await bookingsOf(lead.id)).map((r) => r.status)).toEqual(['confirmed']);
  expect(other.problems).toEqual([]);
  await other.context.close();
});
