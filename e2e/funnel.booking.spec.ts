import { expect as baseExpect, devices, test, type Browser, type Page } from '@playwright/test';
import enAuth from '../apps/campaign/messages/en/auth.json';
import enFunnel from '../apps/campaign/messages/en/funnel.json';
import heAuth from '../apps/campaign/messages/he/auth.json';
import heFunnel from '../apps/campaign/messages/he/funnel.json';
import {
  BASE_URL,
  cleanup,
  eventsOf,
  eventually,
  leadBody,
  leadByEmail,
  linkIn,
  newEmail,
  newIp,
  rest,
} from './support/funnel';

/**
 * The booked call on the funnel's booking step, in English and Hebrew: book, see the call again after a reload, change
 * it, cancel it (with the second click), and get back to the free times with a line saying it was cancelled; the
 * confirmation email's "Change or cancel" opens the same step in another browser (through the signed link and its
 * confirmation page). The database and the outbox are checked for what each step leaves behind.
 *
 *   CAMPAIGN_URL=http://localhost:3001 pnpm exec playwright test e2e/funnel.booking.spec.ts
 */
test.describe.configure({ mode: 'serial' });
test.setTimeout(120_000);
test.use({ baseURL: BASE_URL });
test.afterAll(cleanup);
const expect = baseExpect.configure({ timeout: 20_000 });

const LOCALES = [
  { locale: 'en' as const, prefix: '', tz: 'America/New_York', funnel: enFunnel, auth: enAuth },
  { locale: 'he' as const, prefix: '/he', tz: 'Asia/Jerusalem', funnel: heFunnel, auth: heAuth },
];

async function visitor(browser: Browser, L: (typeof LOCALES)[number], phone = false) {
  const context = await browser.newContext({
    ...(phone ? devices['Pixel 7'] : { viewport: { width: 1440, height: 900 } }),
    baseURL: BASE_URL,
    locale: L.locale === 'he' ? 'he-IL' : 'en-US',
    timezoneId: L.tz,
    extraHTTPHeaders: { 'x-forwarded-for': newIp() },
  });
  const page = await context.newPage();
  const problems: string[] = [];
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error' && !/Failed to load resource/.test(m.text()))
      problems.push(`console: ${m.text()}`);
  });
  return { context, page, problems };
}

interface AvailabilityBody {
  days: Array<{ date: string; slots: Array<{ startsAt: string; remaining: number }> }>;
}

/** Two completely free slots counted from the back of the calendar (where nobody else is competing), as UI positions. */
async function freeSlots(page: Page) {
  const av = (await (await page.request.get('/api/availability')).json()) as AvailabilityBody;
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
    const phone = info.project.name === 'mobile';
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
      (await context.request.post('/api/leads', { data: leadBody(email, { locale: L.locale }) })).status(),
    ).toBe(201);
    const lead = (await leadByEmail(email))!;
    const [first, second] = await freeSlots(page);

    // book through the screen
    await page.goto(`${L.prefix}/booking`);
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
    const api = (await (await context.request.get('/api/lead')).json()) as {
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
    expect(linkIn(mail.payload, /https?:\/\/[^\s"<]+\/go\/[\w.-]+/)).toBeTruthy();

    // after a reload there is no call any more
    await page.reload();
    await expect(page.locator('[aria-labelledby=book-day] button').first()).toBeVisible();
    await expect(page.locator('[data-current-call]')).toHaveCount(0);
    expect(
      ((await (await context.request.get('/api/lead')).json()) as { booking: unknown }).booking,
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

test('the confirmation email’s "Change or cancel" opens the booking step with the call, in another browser', async ({
  browser,
}) => {
  const L = LOCALES[1]!; // in Hebrew
  const owner = await visitor(browser, L);
  const email = newEmail('manage-link');
  expect(
    (await owner.context.request.post('/api/leads', { data: leadBody(email, { locale: 'he' }) })).status(),
  ).toBe(201);
  const lead = (await leadByEmail(email))!;
  const [slot] = await freeSlots(owner.page);
  expect(
    (
      await owner.context.request.post('/api/bookings', {
        data: { startsAt: slot!.startsAt, timezone: 'Asia/Jerusalem' },
      })
    ).status(),
  ).toBe(201);
  const [booking] = await bookingsOf(lead.id);
  const mail = await eventually(
    async () => (await eventsOf(lead.id)).find((e) => e.dedupe_key === `booking-confirmation:${booking!.id}`),
    'the confirmation email',
  );
  const html = mail.payload.html ?? '';
  const href = /<a href="([^"]+)"[^>]*>שינוי או ביטול<\/a>/.exec(html)?.[1]?.replace(/&amp;/g, '&');
  expect(href).toMatch(new RegExp(`^${BASE_URL.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/he/go/[\\w.-]+$`));
  await owner.context.close();

  // a different browser: the link asks for a click first (mail scanners open links), then lands on the booking step
  const other = await visitor(browser, L);
  await other.page.goto(href!);
  await expect(other.page).toHaveURL(/\/he\/open-link\?t=/);
  await other.page.getByRole('button', { name: L.auth.openLink.portal.submit }).click();
  await expect(other.page).toHaveURL(/\/he\/booking$/);
  await expect(other.page.locator('h1')).toHaveText(L.funnel.booking.done.title);
  await other.page.getByRole('button', { name: L.funnel.booking.manage.cancel }).click();
  await other.page
    .locator('[data-cancel-confirm]')
    .getByRole('button', { name: L.funnel.booking.manage.confirmYes })
    .click();
  await expect(other.page.locator('[data-call-cancelled]')).toBeVisible();
  expect((await bookingsOf(lead.id)).map((r) => r.status)).toEqual(['cancelled']);
  expect(other.problems).toEqual([]);
  await other.context.close();
});
