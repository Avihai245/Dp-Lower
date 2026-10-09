import type { BrowserContext, Page } from '@playwright/test';
import enAdmin from '../apps/campaign/messages/en/admin.json';
import heAdmin from '../apps/campaign/messages/he/admin.json';
import { addDays, zonedParts, zonedTimeToUtc } from '../packages/core/src/timezone';
import { bootstrapStaff, deleteUserByEmail } from '../scripts/bootstrap-admin';
import { sessionCookies } from './support/admin-auth';
import { activity, emails, eq, events, eventually, insert, remove, select } from './support/admin-db';
import { expect, openLead, test } from './support/admin-fixtures';
import { SOURCE } from './support/admin-world';
import { cleanup as cleanupFunnel, leadBody, newEmail, newIp } from './support/funnel';

/**
 * Calendars per lawyer and the call on the lead page.
 *  - An admin opens a lawyer's calendar, gives the lawyer a day off and weekly hours (no capacity: one call at a time) and
 *    closes a day for everyone from there; the unassigned template does not show the lawyer's hours.
 *  - The lawyer signs in and edits their own calendar; the Server Action refuses another lawyer's calendar and the
 *    template even when the request is replayed with the lawyer's own action id; other calendars are read-only.
 *  - A visitor books the lawyer's time through the public API: the call is assigned to them, the lead page and the
 *    upcoming calls say so; the team cancels it (the applicant is emailed), and marks a past call no-show and held.
 *  - The same in Hebrew.
 * The shared database: the lawyers, their hours (04:10 and 04:30 on a weekday 8 to 10 days ahead, Sunday to Thursday, with
 * the lawyer away a week earlier, so the visitor calendar never offers them) and every lead are this run's own and removed.
 */

const TZ = 'Asia/Jerusalem';
const PASSWORD = 'E2e-Lawyer-Pass-1!';
const today = zonedParts(new Date(), TZ).date;
// the first Sunday to Thursday at least eight days ahead: past the five days the booking screen shows
const DAY = [8, 9, 10]
  .map((n) => addDays(today, n))
  .find((d) => new Date(`${d}T12:00:00Z`).getUTCDay() <= 4)!;
const WEEKDAY = new Date(`${DAY}T12:00:00Z`).getUTCDay();
const AWAY = addDays(DAY, -7);
const at = (time: string) => zonedTimeToUtc(DAY, time, TZ).toISOString();

interface Lawyer {
  id: string;
  email: string;
  name: string;
}

let lawyerA: Lawyer;
let lawyerB: Lawyer;
let lawyerContext: BrowserContext | null = null;

test.describe.configure({ mode: 'serial' });

test.beforeAll(async ({ world }) => {
  const make = async (key: string): Promise<Lawyer> => {
    const email = `e2e-admin-lawyer-${key}-${world.tag}@example.com`;
    const name = `E2E Lawyer ${key.toUpperCase()} ${world.tag}`;
    const r = await bootstrapStaff({ email, fullName: name, password: PASSWORD, role: 'lawyer' });
    return { id: r.userId, email, name };
  };
  lawyerA = await make('a');
  lawyerB = await make('b');
});

test.afterAll(async () => {
  await lawyerContext?.close();
  // the hours first: nothing of this run is offered once its calls are gone
  for (const l of [lawyerA, lawyerB])
    if (l) await remove('availability_rules', `staff_id=${eq(l.id)}`).catch(() => undefined);
  await cleanupFunnel();
  for (const l of [lawyerA, lawyerB]) if (l) await deleteUserByEmail(l.email).catch(() => undefined);
});

const rulesOf = (staffId: string) =>
  select<{ weekday: number; start_time: string; capacity: number; active: boolean }>(
    'availability_rules',
    `staff_id=${eq(staffId)}&order=start_time&select=*`,
  );

async function lawyerPage(browser: import('@playwright/test').Browser, baseURL: string): Promise<Page> {
  lawyerContext ??= await browser.newContext({
    baseURL,
    locale: 'en-US',
    viewport: { width: 1440, height: 900 },
  });
  await lawyerContext.addCookies(await sessionCookies(baseURL, lawyerA.email, PASSWORD));
  return lawyerContext.newPage();
}

/** A lead of this world with a call whose time has come (assigned to lawyer A). */
async function leadWithPastCall(tag: string, key: string) {
  const [lead] = await insert<{ id: string }>('leads', {
    full_name: `Call ${key} ${tag}`,
    email: `e2e-admin-call-${key}-${tag}@example.com`,
    phone: '+1 718 555 0199',
    source: SOURCE,
    stage: 'account',
    status: 'account_created',
  });
  const starts = new Date(Date.now() - 2 * 3_600_000);
  const [booking] = await insert<{ id: string }>('bookings', {
    lead_id: lead!.id,
    starts_at: starts.toISOString(),
    ends_at: new Date(starts.getTime() + 20 * 60_000).toISOString(),
    status: 'confirmed',
    assigned_to: lawyerA.id,
    timezone: 'Europe/London',
  });
  return { leadId: lead!.id, bookingId: booking!.id };
}

test('an admin gives a lawyer hours and a day off in the lawyer’s own calendar, and closes a day for everyone', async ({
  adminPage: page,
  world,
}) => {
  const t = enAdmin.availability;
  await page.goto('/admin/availability');
  await expect(page.locator('[data-realtime="subscribed"]')).toHaveCount(1, { timeout: 15_000 });
  const calendars = page.getByRole('group', { name: t.scopes.label });
  await expect(calendars.locator('[data-calendar="unassigned"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(calendars.locator('[data-calendar="unassigned"]')).toHaveText(t.scopes.unassigned);
  await calendars.locator(`[data-calendar="${lawyerA.id}"]`).click();
  await expect(page).toHaveURL(new RegExp(`calendar=${lawyerA.id}`));
  await expect(
    page.getByRole('heading', { name: t.scopes.weeklyOf.replace('{name}', lawyerA.name) }),
  ).toBeVisible();

  // the day off first, so the hours added next are never offered a week early
  const form = page.locator('[data-add-exception]');
  await form.getByLabel(t.date).fill(AWAY);
  await expect(form.getByLabel(t.scopes.appliesTo)).toHaveValue(lawyerA.id);
  await form.getByLabel(t.reason).fill(`e2e ${world.tag} away`);
  await form.locator('[data-exception-add]').click();
  const away = page.locator('[data-exception]', { hasText: `e2e ${world.tag} away` });
  await expect(away).toHaveAttribute('data-applies', 'lawyer');
  await expect(away).toContainText(t.wholeDay);
  expect(
    await select(
      'availability_exceptions',
      `reason=${eq(`e2e ${world.tag} away`)}&select=staff_id,on_date,start_time`,
    ),
  ).toEqual([{ staff_id: lawyerA.id, on_date: AWAY, start_time: null }]);

  // weekly hours: one call at a time, so there is no capacity field
  const card = page.locator(`[data-weekly] [data-weekday="${WEEKDAY}"]`);
  await expect(card.getByLabel(t.capacity)).toHaveCount(0);
  await card.getByPlaceholder('HH:MM').fill('04:10');
  await card.locator('[data-rule-add]').click();
  await expect(card.locator('[data-rule]')).toHaveCount(1);
  expect(await rulesOf(lawyerA.id)).toMatchObject([
    { weekday: WEEKDAY, start_time: '04:10:00', capacity: 1, active: true },
  ]);
  // the same time twice in one calendar is refused
  await card.getByPlaceholder('HH:MM').last().fill('04:10');
  await card.locator('[data-rule-add]').click();
  await expect(card.getByRole('alert')).toContainText(t.errors.duplicate);

  // the unassigned template does not show the lawyer's hours
  await calendars.locator('[data-calendar="unassigned"]').click();
  await expect(page.getByRole('heading', { name: t.weekly })).toBeVisible();
  await expect(page.locator('[data-weekly] [data-rule] input[value="04:10"]')).toHaveCount(0);

  // closed for everyone, from the lawyer's calendar: listed (and marked) in every calendar
  await calendars.locator(`[data-calendar="${lawyerA.id}"]`).click();
  await form.getByLabel(t.date).fill('2031-02-04');
  await form.getByLabel(t.scopes.appliesTo).selectOption('');
  await form.getByLabel(t.reason).fill(`e2e ${world.tag} closed`);
  await form.locator('[data-exception-add]').click();
  const closed = page.locator('[data-exception]', { hasText: `e2e ${world.tag} closed` });
  await expect(closed).toHaveAttribute('data-applies', 'everyone');
  await expect(closed).toContainText(t.scopes.everyone);
  expect(
    await select('availability_exceptions', `reason=${eq(`e2e ${world.tag} closed`)}&select=staff_id`),
  ).toEqual([{ staff_id: null }]);
  await calendars.locator(`[data-calendar="${lawyerB.id}"]`).click();
  await expect(page.locator('[data-exception]', { hasText: `e2e ${world.tag} closed` })).toBeVisible();
  await expect(page.locator('[data-exception]', { hasText: `e2e ${world.tag} away` })).toHaveCount(0);
  await page
    .locator('[data-exception]', { hasText: `e2e ${world.tag} closed` })
    .locator('[data-exception-delete]')
    .click();
  await expect(page.locator('[data-exception]', { hasText: `e2e ${world.tag} closed` })).toHaveCount(0);
  expect(await select('availability_exceptions', `reason=${eq(`e2e ${world.tag} closed`)}`)).toEqual([]);

  // the calendar is kept in the address: a reload opens the same one
  await page.reload();
  await expect(calendars.locator(`[data-calendar="${lawyerB.id}"]`)).toHaveAttribute('aria-pressed', 'true');
});

test('a lawyer edits their own calendar only, and the Server Action refuses any other', async ({
  browser,
  world,
}) => {
  const t = enAdmin.availability;
  const page = await lawyerPage(browser, world.baseURL);
  await page.goto('/admin/availability');
  const calendars = page.getByRole('group', { name: t.scopes.label });
  // a lawyer opens their own calendar
  await expect(calendars.locator(`[data-calendar="${lawyerA.id}"]`)).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('[data-own-only]')).toHaveCount(0);
  const card = page.locator(`[data-weekly] [data-weekday="${WEEKDAY}"]`);
  await expect(card.locator('[data-rule]')).toHaveCount(1);

  const captured: { url: string; headers: Record<string, string>; body: string }[] = [];
  page.on('request', (r) => {
    const h = r.headers();
    if (r.method() === 'POST' && h['next-action'])
      captured.push({ url: r.url(), headers: h, body: r.postData() ?? '' });
  });
  await card.getByPlaceholder('HH:MM').last().fill('04:30');
  await card.locator('[data-rule-add]').click();
  await expect(card.locator('[data-rule]')).toHaveCount(2);
  expect((await rulesOf(lawyerA.id)).map((r) => r.start_time)).toEqual(['04:10:00', '04:30:00']);
  const add = captured.find((c) => c.body.includes('"04:30"') && c.body.includes(lawyerA.id))!;
  expect(add, 'the add request was seen').toBeTruthy();

  // the same action, replayed with the lawyer's own session for another calendar and for the template
  const cookie = (await page.context().cookies()).map((c) => `${c.name}=${c.value}`).join('; ');
  const replay = (body: string) =>
    page.request.post(add.url, {
      headers: {
        'next-action': add.headers['next-action']!,
        'content-type': add.headers['content-type'] ?? 'text/plain;charset=UTF-8',
        cookie,
        origin: world.baseURL,
      },
      data: body,
    });
  const other = await replay(add.body.replace(lawyerA.id, lawyerB.id).replace('04:30', '04:31'));
  expect(await other.text()).toMatch(/"ok":false,"error":"forbidden"/);
  const template = await replay(add.body.replace(`"${lawyerA.id}"`, 'null').replace('04:30', '04:32'));
  expect(await template.text()).toMatch(/"ok":false,"error":"forbidden"/);
  expect(await rulesOf(lawyerB.id)).toEqual([]);
  expect(await select('availability_rules', `start_time=in.(04:31:00,04:32:00)&select=id`)).toEqual([]);

  // other calendars are read-only for them
  for (const scope of [lawyerB.id, 'unassigned']) {
    await calendars.locator(`[data-calendar="${scope}"]`).click();
    await expect(page.locator('[data-own-only]')).toHaveText(t.scopes.ownOnly);
    await expect(page.locator('[data-rule-add]')).toHaveCount(0);
    await expect(page.locator('[data-rule-delete]')).toHaveCount(0);
    await expect(page.locator('[data-exception-add]')).toHaveCount(0);
  }
  // the day off a week earlier is theirs to lift; the template's closures are not
  await calendars.locator(`[data-calendar="${lawyerA.id}"]`).click();
  await expect(
    page.locator('[data-exception]', { hasText: `e2e ${world.tag} away` }).locator('[data-exception-delete]'),
  ).toBeVisible();
  await page.close();
});

test('a booked call goes to the lawyer, shows them on the lead page and in the upcoming calls, and the team cancels it', async ({
  adminPage: page,
  playwright,
  world,
}) => {
  const client = await playwright.request.newContext({
    baseURL: world.baseURL,
    extraHTTPHeaders: { 'x-forwarded-for': newIp() },
  });
  const email = newEmail('crm-call');
  const created = await client.post('/api/leads', { data: leadBody(email) });
  expect(created.status()).toBe(201);
  const { leadId } = (await created.json()) as { leadId: string };
  const booked = await client.post('/api/bookings', {
    data: { startsAt: at('04:10'), timezone: 'Europe/Berlin' },
  });
  expect(booked.status(), await booked.text()).toBe(201);
  const { booking } = (await booked.json()) as { booking: { id: string } };
  expect(
    (await select<{ assigned_to: string }>('bookings', `id=${eq(booking.id)}&select=assigned_to`))[0]!
      .assigned_to,
  ).toBe(lawyerA.id);
  const [createdEvent] = await events(leadId, 'booking.created');
  expect(createdEvent!.payload).toMatchObject({
    booking: { id: booking.id, lawyer: { id: lawyerA.id, name: lawyerA.name } },
  });
  const [confirmation] = await emails(leadId, 'booking-confirmation');
  expect((confirmation!.payload as { html: string }).html).toContain(`Your call is with ${lawyerA.name}.`);
  await client.dispose();

  // the upcoming calls name the lawyer
  await page.goto('/admin/availability');
  await expect(page.locator(`[data-booking="${booking.id}"]`)).toContainText(
    enAdmin.availability.scopes.lawyer.replace('{name}', lawyerA.name),
  );
  await expect(page.locator(`[data-booking="${booking.id}"] [data-booking-lawyer]`)).toHaveAttribute(
    'data-booking-lawyer',
    lawyerA.id,
  );

  // the lead page: the chip, and the call with its lawyer
  const c = enAdmin.callPanel;
  await openLead(page, leadId);
  await expect(page.locator('[data-call-chip]')).toBeVisible();
  const panel = page.locator('[data-call-panel]');
  await expect(panel).toContainText(c.with.replace('{name}', lawyerA.name));
  await expect(panel.locator('[data-call-phase]')).toHaveText(c.phase.booked);
  await expect(panel.locator('[data-call-action]')).toHaveText([c.cancel]); // not started: it can only be cancelled

  // cancelling asks once more, then emails the applicant and tells the CRM
  await panel.locator('[data-call-action="cancel"]').click();
  await expect(panel.locator('[data-call-confirm]')).toContainText(c.cancelConfirm);
  await panel.locator('[data-call-confirm-yes]').click();
  await expect(page.locator('[data-call-panel]')).toHaveCount(0);
  await expect(page.locator('[data-call-chip]')).toHaveCount(0);
  expect(
    (await select<{ status: string }>('bookings', `id=${eq(booking.id)}&select=status`))[0]!.status,
  ).toBe('cancelled');
  const [cancelled] = await eventually(
    () => events(leadId, 'booking.cancelled'),
    (r) => r.length === 1,
  );
  expect(cancelled!.payload).toMatchObject({ reason: 'staff', booking: { id: booking.id } });
  expect(
    await eventually(
      () => emails(leadId, 'booking-cancelled'),
      (r) => r.length === 1,
    ),
  ).toHaveLength(1);
  const [line] = await activity(leadId, 'booking_cancelled');
  expect(line).toMatchObject({ kind: 'staff', actor_name: world.admin.name });
});

test('the team marks a past call a no-show and then held; a no-show emails nobody', async ({
  adminPage: page,
  world,
}) => {
  const c = enAdmin.callPanel;
  const { leadId, bookingId } = await leadWithPastCall(world.tag, 'en');
  await openLead(page, leadId);
  const panel = page.locator('[data-call-panel]');
  await expect(panel.locator('[data-call-phase]')).toHaveText(c.phase.awaiting);
  await expect(panel).toContainText(c.with.replace('{name}', lawyerA.name));
  await expect(panel.locator('[data-call-action]')).toHaveText([c.held, c.noShow]);

  await panel.locator('[data-call-action="no_show"]').click();
  await expect(panel.locator('[data-call-phase]')).toHaveText(c.phase.no_show);
  expect((await select<{ status: string }>('bookings', `id=${eq(bookingId)}&select=status`))[0]!.status).toBe(
    'no_show',
  );
  const [noShow] = await eventually(
    () => events(leadId, 'booking.no_show'),
    (r) => r.length === 1,
  );
  expect(noShow).toMatchObject({ dedupe_key: `booking.no_show:${bookingId}`, channel: 'crm' });
  expect(await emails(leadId)).toEqual([]);
  await expect(page.locator('[data-activity="booking_no_show"]')).toContainText(world.admin.name);

  await panel.locator('[data-call-action="held"]').click();
  await expect(panel.locator('[data-call-phase]')).toHaveText(c.phase.held);
  expect((await select<{ status: string }>('bookings', `id=${eq(bookingId)}&select=status`))[0]!.status).toBe(
    'completed',
  );
  await expect(panel.locator('[data-call-action]')).toHaveText([c.noShow]);
  expect((await activity(leadId, 'booking_held')).length).toBe(1);
});

test('Hebrew: the calendars and the call panel are translated and mirrored', async ({
  adminPage: page,
  world,
}) => {
  const t = heAdmin.availability;
  await page.goto(`/he/admin/availability?calendar=${lawyerA.id}`);
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  const calendars = page.getByRole('group', { name: t.scopes.label });
  await expect(calendars.locator('[data-calendar="unassigned"]')).toHaveText(t.scopes.unassigned);
  await expect(calendars.locator(`[data-calendar="${lawyerA.id}"]`)).toHaveAttribute('aria-pressed', 'true');
  await expect(
    page.getByRole('heading', { name: t.scopes.weeklyOf.replace('{name}', lawyerA.name) }),
  ).toBeVisible();
  await expect(page.locator('[data-add-exception]').getByLabel(t.scopes.appliesTo)).toBeVisible();

  const c = heAdmin.callPanel;
  const { leadId, bookingId } = await leadWithPastCall(world.tag, 'he');
  await openLead(page, leadId, '/he');
  const panel = page.locator('[data-call-panel]');
  await expect(panel.getByRole('heading', { name: c.title })).toBeVisible();
  await expect(panel).toContainText(c.with.replace('{name}', lawyerA.name));
  await expect(panel.locator('[data-call-phase]')).toHaveText(c.phase.awaiting);
  await panel.getByRole('button', { name: c.noShow }).click();
  await expect(panel.locator('[data-call-phase]')).toHaveText(c.phase.no_show);
  expect((await select<{ status: string }>('bookings', `id=${eq(bookingId)}&select=status`))[0]!.status).toBe(
    'no_show',
  );
  await expect(page.locator('[data-activity="booking_no_show"]')).toContainText(
    heAdmin.activity.codes.booking_no_show,
  );
  // no sideways scroll at phone width
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await expect(page.locator('[data-call-panel]')).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth),
  ).toBeLessThanOrEqual(0);
});
