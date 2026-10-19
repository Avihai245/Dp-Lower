import AxeBuilder from '@axe-core/playwright';
import type { APIRequestContext, Locator, Page } from '@playwright/test';
import enAdmin from '../apps/campaign/messages/en/admin.json';
import heAdmin from '../apps/campaign/messages/he/admin.json';
import { sessionCookies } from './support/admin-auth';
import { createAuthUser, eq, insert, select } from './support/admin-db';
import { expect, test } from './support/admin-fixtures';
import { SOURCE, type World } from './support/admin-world';
import {
  accountById,
  accountIdByEmail,
  completePasswordLink,
  emailsTo,
  passwordGrant,
  passwordLinkOf,
  refreshGrant,
  removeTraces,
  type QueuedEmail,
} from './support/rest';

/**
 * Inviting a new team member from /admin/team ("Add team member", admins only; commit 58c79c1). The invite creates the
 * person's account (or, for an address that already has an account but is not staff, takes it over: new random password,
 * every session ended), grants the chosen role, and queues an email with a link to set a password. Nobody but the invitee
 * ever sets or sees the password. An address that is already on the team (active or not) is refused without touching the
 * account, and only an active admin can invite at all, even when the request of a real invite is replayed with other cookies.
 *
 *   CAMPAIGN_URL=http://localhost:3001 pnpm exec playwright test e2e/admin.team.spec.ts
 *
 * Everything it creates has an address e2e-admin-team-<label>-<tag>@example.com; the queued emails, the accounts and the
 * staff rows are removed again after each test.
 */

const t = enAdmin.team;
const th = heAdmin.team;
const NEW_PASSWORD = 'Invited-Pass-1!x';
const address = () =>
  `10.${Math.floor(Math.random() * 250) + 1}.${Math.floor(Math.random() * 250) + 1}.${Math.floor(Math.random() * 250) + 1}`;

const used: string[] = [];
/** A fresh invitee address; removed (account, staff row, outbox) after the test. */
function invitee(world: World, label: string): string {
  const email = `e2e-admin-team-${label}-${world.tag}@example.com`;
  used.push(email);
  return email;
}
/** The same address as a person might type it: capitals do not matter. */
const typedLike = (email: string): string =>
  email.replace(/^e2e-admin-team/, 'E2E-Admin-Team').replace('@example.com', '@Example.com');

test.afterEach(async () => {
  for (const email of used.splice(0)) await removeTraces(email);
});

const staffRows = (userId: string) => select<Record<string, unknown>>('staff', `user_id=${eq(userId)}`);

// -- the dialog ---------------------------------------------------------------------------------------------------------

/**
 * Types the new password into the "set a password" screen. The screen is rendered on the server and its two fields are
 * controlled by React: text typed before the page has hydrated is not seen by the form, and the save button (disabled
 * until both fields hold 8+ matching characters) then never goes live. So retry the typing until the button is enabled.
 */
async function typeNewPassword(page: Page, password: string) {
  const save = page.locator('button[type=submit]');
  await expect(async () => {
    await page.locator('#pw-new').fill(password);
    await page.locator('#pw-confirm').fill(password);
    await expect(save).toBeEnabled({ timeout: 1000 });
  }).toPass({ timeout: 20_000 });
}

type Texts = typeof t | typeof th;

async function openDialog(page: Page, prefix = ''): Promise<Locator> {
  await page.goto(`${prefix}/admin/team`);
  await page.locator('[data-invite-open]').click();
  const dialog = page.locator('dialog[open]');
  await expect(dialog).toBeVisible();
  return dialog;
}

async function fillDialog(
  dialog: Locator,
  texts: Texts,
  v: { name: string; email: string; role?: 'admin' | 'lawyer' | 'case_manager' },
) {
  await dialog.getByLabel(texts.invite.name).fill(v.name);
  await dialog.getByLabel(texts.invite.email).fill(v.email);
  if (v.role) await dialog.getByLabel(texts.role, { exact: true }).selectOption(v.role);
}

/** What the browser sent to the Server Action behind "Send invite" (for replaying it with other cookies). */
interface Captured {
  url: string;
  headers: Record<string, string>;
  body: string;
}
function captureActions(page: Page): Captured[] {
  const seen: Captured[] = [];
  page.on('request', (r) => {
    const h = r.headers();
    if (r.method() === 'POST' && h['next-action'])
      seen.push({ url: r.url(), headers: h, body: r.postData() ?? '' });
  });
  return seen;
}

/** A real invite through the dialog, as the signed-in admin. Returns the dialog (showing the confirmation). */
async function inviteThroughUi(
  page: Page,
  v: { name: string; email: string; role?: 'admin' | 'lawyer' | 'case_manager' },
  prefix = '',
  texts: Texts = t,
): Promise<Locator> {
  const dialog = await openDialog(page, prefix);
  await fillDialog(dialog, texts, v);
  await dialog.locator('[data-invite-send]').click();
  await expect(dialog.getByRole('status')).toHaveText(texts.invite.sentLine.replace('{email}', v.email));
  return dialog;
}

/** Replays a captured invite request with the given cookies (the page's own context) and returns the action's reply. */
async function replay(
  api: APIRequestContext,
  c: Captured,
  body: unknown[],
  origin: string,
): Promise<{ status: number; text: string }> {
  const res = await api.post(c.url, {
    headers: {
      'next-action': c.headers['next-action']!,
      'content-type': c.headers['content-type'] ?? 'text/plain;charset=UTF-8',
      origin,
    },
    data: JSON.stringify(body),
    maxRedirects: 0,
  });
  return { status: res.status(), text: await res.text() };
}

/** The emailed set-password link, checked: the app's own /auth/callback with a recovery token that continues to the reset screen. */
function expectPasswordLink(mail: QueuedEmail, world: World, prefix = ''): URL {
  const link = passwordLinkOf(mail);
  expect(link, 'the email carries a set-password link').not.toBeNull();
  expect(link!.origin).toBe(new URL(world.baseURL).origin);
  expect(link!.pathname).toBe(`${prefix}/auth/callback`);
  expect(link!.searchParams.get('type')).toBe('recovery');
  expect(link!.searchParams.get('token_hash') ?? '').not.toBe('');
  expect(link!.searchParams.get('next')).toBe('/create-password?mode=reset');
  return link!;
}

// -- inviting ---------------------------------------------------------------------------------------------------------

test.describe('inviting a new team member', () => {
  test('creates the account, grants the role, queues the set-password email, and the link lets the invitee in', async ({
    adminPage: page,
    browser,
    world,
  }) => {
    const email = invitee(world, 'new');
    const name = `Dana Newhire ${world.tag}`;
    expect(await accountIdByEmail(email)).toBeNull();

    const dialog = await inviteThroughUi(page, { name, email: typedLike(email), role: 'lawyer' });
    await expect(dialog.getByRole('status')).toHaveText(
      t.invite.sentLine.replace('{email}', typedLike(email)),
    );

    // the account: new, confirmed (so the emailed link is all that is needed), named, and the address stored in lower case
    const userId = await accountIdByEmail(email);
    expect(userId).not.toBeNull();
    const account = await accountById(userId!);
    expect(account.email).toBe(email);
    expect(account.email_confirmed_at).toBeTruthy();
    expect(account.user_metadata).toMatchObject({ full_name: name });

    // the role, active at once
    expect(await staffRows(userId!)).toEqual([
      expect.objectContaining({ user_id: userId, full_name: name, email, role: 'lawyer', active: true }),
    ]);

    // exactly one email, to the invitee only, with a set-password link and no password in it
    const mails = await emailsTo(email);
    expect(mails).toHaveLength(1);
    const mail = mails[0]!;
    expect(mail.lead_id).toBeNull();
    expect(mail.dedupe_key).toMatch(new RegExp(`^staff-invite:${userId}:`));
    expect(mail.payload).toMatchObject({
      template: 'password-reset',
      locale: 'en',
      subject: 'Set a new password',
      category: 'transactional',
      to: { email },
    });
    expect(mail.payload.to.name).toBe(name);
    expect(mail.payload.text).toContain('Dana');
    const link = expectPasswordLink(mail, world);

    // the team list shows the new member, with the role chosen
    await dialog.getByRole('button', { name: enAdmin.edit.close }).click();
    const member = page.locator(`[data-member="${userId}"]`);
    await expect(member).toContainText(name);
    await expect(member).toContainText(email);
    await expect(member.getByLabel(t.role)).toHaveValue('lawyer');
    await expect(member.getByLabel(t.active)).toBeChecked();

    // nobody knows the password yet: it is random. The emailed link is the only way in
    expect((await passwordGrant(email, 'Password-1!')).ok).toBe(false);
    const ctx = await browser.newContext({
      baseURL: world.baseURL,
      locale: 'en-US',
      viewport: { width: 1280, height: 900 },
      extraHTTPHeaders: { 'x-forwarded-for': address() },
    });
    const newcomer = await ctx.newPage();
    await newcomer.goto(`${link.pathname}${link.search}`);
    await expect(newcomer).toHaveURL(/\/open-link\?r=/); // a mail scanner's GET gets only this page, the token is still unused
    expect((await passwordGrant(email, NEW_PASSWORD)).ok).toBe(false);
    await newcomer.locator('form[method=post] button[type=submit]').click();
    await expect(newcomer).toHaveURL(/\/create-password\?mode=reset$/);
    await expect(newcomer.locator('#pw-email')).toHaveValue(email);
    await typeNewPassword(newcomer, NEW_PASSWORD);
    const saved = newcomer.waitForResponse((r) => r.url().endsWith('/api/auth/set-password'));
    await newcomer.locator('button[type=submit]').click();
    expect((await saved).status()).toBe(200);
    expect((await passwordGrant(email, NEW_PASSWORD)).ok).toBe(true);
    // saving sends the browser to /portal, which sends a team member (no applicant file) on to the CRM
    await expect(newcomer).toHaveURL(/\/admin(\/|$)/);

    // signed in as the invitee: a lawyer sees the CRM but not the admin-only team page
    expect((await newcomer.goto('/admin'))?.status()).toBe(200);
    await expect(newcomer.locator('[data-stats]')).toBeVisible();
    await expect(newcomer.getByRole('link', { name: 'Team' })).toHaveCount(0);
    expect((await newcomer.goto('/admin/team'))?.status()).toBe(404);
    await ctx.close();

    // and the link was single use
    const again = await completePasswordLink(world.baseURL, link, 'Another-Pass-1!x', address());
    expect(again.landedOn).toContain('/sign-in?error=link');
    await again.api.dispose();
  });

  test('after saving the password an invited team member ends up in the CRM, not in a redirect loop', async ({
    adminPage: page,
    browser,
    world,
  }) => {
    // The reset screen sends the browser to /portal after saving (SetPasswordForm: next defaults to '/portal'). A team member
    // has no applicant file, so requirePortalPage (src/server/portal.ts) sends them to /admin; they used to bounce between
    // / and /portal until the browser gave up (ERR_TOO_MANY_REDIRECTS).
    const email = invitee(world, 'loop');
    await inviteThroughUi(page, { name: `Loop Newhire ${world.tag}`, email, role: 'case_manager' });
    const link = expectPasswordLink((await emailsTo(email))[0]!, world);
    const ctx = await browser.newContext({
      baseURL: world.baseURL,
      extraHTTPHeaders: { 'x-forwarded-for': address() },
    });
    const invited = await ctx.newPage();
    await invited.goto(`${link.pathname}${link.search}`);
    await invited.locator('form[method=post] button[type=submit]').click();
    await expect(invited).toHaveURL(/\/create-password\?mode=reset$/);
    await typeNewPassword(invited, NEW_PASSWORD);
    await invited.locator('button[type=submit]').click();
    // saving sends the browser to /portal, which sends a team member (no applicant file) on to the CRM
    await expect(invited).toHaveURL(/\/admin(\/|$)/);
    await expect(invited.locator('[data-stats]')).toBeVisible();
    await ctx.close();
  });

  test('a signed-in team member who opens the portal address is not sent round in circles', async ({
    managerPage,
    world,
  }) => {
    // /portal and / used to redirect to each other for a signed-in staff member. Now /portal goes straight to the CRM
    // (requirePortalPage in src/server/portal.ts): /portal -> /admin, no loop.
    const api = managerPage.request;
    const hops: string[] = [];
    let url = `${world.baseURL}/portal`;
    for (let i = 0; i < 10; i++) {
      const res = await api.get(url, { maxRedirects: 0 });
      hops.push(`${res.status()} ${new URL(url).pathname}`);
      const location = res.headers().location;
      if (res.status() < 300 || res.status() >= 400 || !location) break;
      url = new URL(location, url).toString();
    }
    expect(hops.length, hops.join(' -> ')).toBeLessThan(6);
    expect(hops.at(-1), hops.join(' -> ')).toBe('200 /admin');
  });

  test('an existing account that is not staff is taken over: its password is replaced, its sessions end, and only the emailed link opens it', async ({
    adminPage: page,
    world,
  }) => {
    const email = invitee(world, 'claimed');
    const oldPassword = 'Applicants-Own-Pass-1';
    const userId = await createAuthUser(email, oldPassword, `Former Applicant ${world.tag}`);
    // a former applicant: the account has a lead file, and its owner is signed in somewhere
    await insert('leads', {
      full_name: `Former Applicant ${world.tag}`,
      email,
      source: SOURCE,
      user_id: userId,
      stage: 'account',
      status: 'account_created',
    });
    const session = await passwordGrant(email, oldPassword);
    expect(session.ok).toBe(true);
    expect((await refreshGrant(session.refreshToken!)).ok, 'the old session works before the invite').toBe(
      true,
    );
    const live = await passwordGrant(email, oldPassword); // another session, never refreshed
    expect(live.ok).toBe(true);

    const name = `Claimed Colleague ${world.tag}`;
    await inviteThroughUi(page, { name, email: typedLike(email), role: 'case_manager' });

    // the same account (no second one), now staff with the chosen role
    expect(await accountIdByEmail(email)).toBe(userId);
    expect(await staffRows(userId)).toEqual([
      expect.objectContaining({
        user_id: userId,
        full_name: name,
        email,
        role: 'case_manager',
        active: true,
      }),
    ]);
    // whoever knew the old password, or held a session, is shut out
    expect((await passwordGrant(email, oldPassword)).ok, 'the old password').toBe(false);
    expect((await refreshGrant(live.refreshToken!)).ok, 'a session of the old owner').toBe(false);
    expect((await refreshGrant(session.refreshToken!)).ok, 'the refreshed session of the old owner').toBe(
      false,
    );

    // the email goes to the invitee, and its link sets the new password
    const mails = await emailsTo(email);
    expect(mails).toHaveLength(1);
    const link = expectPasswordLink(mails[0]!, world);
    const done = await completePasswordLink(world.baseURL, link, NEW_PASSWORD, address());
    expect(done.landedOn).toBe('/create-password?mode=reset');
    expect(done.saved).toBe(200);
    expect((await passwordGrant(email, NEW_PASSWORD)).ok).toBe(true);
    expect((await passwordGrant(email, oldPassword)).ok).toBe(false);
    // signed in with the link's session, the CRM opens with the role granted
    expect((await done.api.get('/admin', { maxRedirects: 0 })).status()).toBe(200);
    expect((await done.api.get('/admin/team', { maxRedirects: 0 })).status()).toBe(404); // a case manager
    await done.api.dispose();
  });

  test('in Hebrew: the dialog is translated, the invitee gets the Hebrew email, and an invited admin can use the team page', async ({
    adminPage: page,
    browser,
    world,
  }) => {
    test.skip(
      !(await hebrewEdition(world)),
      'the Hebrew edition of the CRM needs the portal built with NEXT_PUBLIC_CAMPAIGN_LOCALES=en,he',
    );
    const email = invitee(world, 'he');
    const name = `Hebrew Newhire ${world.tag}`;
    const dialog = await openDialog(page, '/he');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(dialog.locator('#invite-title')).toHaveText(th.invite.title);
    await expect(dialog.getByLabel(th.invite.name)).toBeVisible();
    await expect(dialog.getByLabel(th.invite.email)).toBeVisible();
    await expect(dialog.getByLabel(th.role, { exact: true }).locator('option')).toHaveText([
      th.roles.admin,
      th.roles.lawyer,
      th.roles.case_manager,
    ]);

    // the form explains itself in Hebrew before anything is sent
    await dialog.locator('[data-invite-send]').click();
    await expect(dialog.getByRole('alert')).toHaveText([th.invite.nameError, th.invite.emailError]);

    await fillDialog(dialog, th, { name, email, role: 'admin' });
    await dialog.locator('[data-invite-send]').click();
    await expect(dialog.getByRole('status')).toHaveText(th.invite.sentLine.replace('{email}', email));

    const userId = await accountIdByEmail(email);
    expect(userId).not.toBeNull();
    expect(await staffRows(userId!)).toEqual([
      expect.objectContaining({ role: 'admin', active: true, full_name: name }),
    ]);
    const [mail] = await emailsTo(email);
    expect(mail!.payload).toMatchObject({
      template: 'password-reset',
      locale: 'he',
      subject: 'הגדרת סיסמה חדשה',
    });
    const link = expectPasswordLink(mail!, world, '/he');

    const done = await completePasswordLink(world.baseURL, link, NEW_PASSWORD, address());
    expect(done.landedOn).toBe('/he/create-password?mode=reset');
    expect(done.saved).toBe(200);
    await done.api.dispose();

    // the new admin may invite in turn: the team page opens and offers the button
    const ctx = await browser.newContext({ baseURL: world.baseURL });
    await ctx.addCookies(await sessionCookies(world.baseURL, email, NEW_PASSWORD));
    const admin = await ctx.newPage();
    expect((await admin.goto('/admin/team'))?.status()).toBe(200);
    await expect(admin.locator('[data-invite-open]')).toBeVisible();
    await expect(admin.locator(`[data-member="${userId}"]`)).toContainText(name);
    await ctx.close();
  });
});

// -- refusals -------------------------------------------------------------------------------------------------------

test.describe('refusals', () => {
  test('an address that is already on the team is refused, whatever the case, and nothing about that person changes', async ({
    adminPage: page,
    managerPage,
    world,
  }) => {
    const mails = (await emailsTo(world.manager.email)).length;
    const dialog = await openDialog(page);
    const alert = dialog.getByRole('alert');

    // an active member: refused even when the invite asks for a different name and the admin role
    await fillDialog(dialog, t, {
      name: 'Somebody Else',
      email: world.manager.email.toUpperCase(),
      role: 'admin',
    });
    await dialog.locator('[data-invite-send]').click();
    await expect(alert).toHaveText(t.invite.alreadyStaff);
    await expect(dialog.getByLabel(t.invite.email)).toHaveAttribute('aria-invalid', 'true');
    await expect(dialog.getByRole('status')).toHaveCount(0);
    // typing another address takes the message away again
    await dialog.getByLabel(t.invite.email).fill('someone.new@example.com');
    await expect(alert).toHaveCount(0);

    // a deactivated member is still on the team: the invite does not reactivate them
    await dialog.getByLabel(t.invite.email).fill(world.inactive.email);
    await dialog.locator('[data-invite-send]').click();
    await expect(alert).toHaveText(t.invite.alreadyStaff);

    // nothing changed: roles, names, the active flags, the password and the open session of the existing member
    const [manager] = await staffRows(world.manager.id);
    expect(manager).toMatchObject({ role: 'case_manager', active: true, full_name: world.manager.name });
    const [off] = await staffRows(world.inactive.id);
    expect(off).toMatchObject({ role: 'lawyer', active: false, full_name: world.inactive.name });
    expect(
      (await passwordGrant(world.manager.email, world.manager.password)).ok,
      'their password is untouched',
    ).toBe(true);
    expect((await managerPage.goto('/admin'))?.status(), 'their session is not ended').toBe(200);
    expect((await emailsTo(world.manager.email)).length, 'no email goes to them').toBe(mails);
    expect(await emailsTo(world.inactive.email)).toEqual([]);
  });

  test('inviting the same new address twice: the second is refused and only one email goes out', async ({
    adminPage: page,
    world,
  }) => {
    const email = invitee(world, 'twice');
    await inviteThroughUi(page, { name: `Twice Newhire ${world.tag}`, email, role: 'lawyer' });
    const userId = (await accountIdByEmail(email))!;

    const dialog = await openDialog(page);
    await fillDialog(dialog, t, { name: 'Another Name', email: typedLike(email), role: 'admin' });
    await dialog.locator('[data-invite-send]').click();
    await expect(dialog.getByRole('alert')).toHaveText(t.invite.alreadyStaff);

    expect(await staffRows(userId)).toEqual([
      expect.objectContaining({ role: 'lawyer', full_name: `Twice Newhire ${world.tag}` }),
    ]);
    expect(await emailsTo(email)).toHaveLength(1);
    expect(await select('staff', `email=${eq(email)}`)).toHaveLength(1);
  });

  test('only an active admin can invite: the page is a 404 for anyone else, and a replayed invite request is refused', async ({
    adminPage,
    managerPage,
    applicantPage,
    inactivePage,
    anonPage,
    playwright,
    world,
  }) => {
    // no way in through the interface
    for (const [who, page] of [
      ['case manager', managerPage],
      ['applicant', applicantPage],
      ['deactivated lawyer', inactivePage],
    ] as const) {
      expect((await page.goto('/admin/team'))?.status(), who).toBe(404);
      await expect(page.locator('[data-invite-open]'), who).toHaveCount(0);
    }
    const anon = await anonPage.goto('/admin/team');
    expect(new URL(anonPage.url()).pathname, 'a visitor without a session is sent to sign in').toBe(
      '/sign-in',
    );
    expect(anon?.status()).toBe(200);

    // a real invite by the admin, captured, then replayed by others for another address
    const actions = captureActions(adminPage);
    const first = invitee(world, 'captured');
    await inviteThroughUi(adminPage, { name: `Captured Newhire ${world.tag}`, email: first, role: 'lawyer' });
    expect(actions.length).toBeGreaterThan(0);
    const real = actions.find((a) => a.body.includes(first))!;
    expect(real, 'the invite request was captured').toBeTruthy();
    const payload = JSON.parse(real.body) as Array<{ email: string; fullName: string; role: string }>;
    const probe = invitee(world, 'probe');
    const forged = [{ ...payload[0]!, email: probe, fullName: `Probe Newhire ${world.tag}`, role: 'admin' }];
    const origin = new URL(world.baseURL).origin;

    for (const [who, api] of [
      ['case manager', managerPage.request],
      ['applicant', applicantPage.request],
      ['deactivated lawyer', inactivePage.request],
    ] as const) {
      const reply = await replay(api, real, forged, origin);
      expect(reply.text, who).toMatch(/"ok":false,"error":"forbidden"/);
    }
    const bare = await playwright.request.newContext({ baseURL: world.baseURL });
    const nobody = await replay(bare, real, forged, origin);
    expect(nobody.text, 'without a session').not.toContain('"ok":true');
    await bare.dispose();

    // nothing was created: no account, no staff row, no email, no admin by the back door
    expect(await accountIdByEmail(probe)).toBeNull();
    expect(await select('staff', `email=${eq(probe)}`)).toEqual([]);
    expect(await emailsTo(probe)).toEqual([]);

    // while the admin's own request, with the same body, does go through (the refusals above were about the caller)
    const ok = await replay(adminPage.request, real, forged, origin);
    expect(ok.text).toContain('"ok":true');
    expect(await accountIdByEmail(probe)).not.toBeNull();
    expect(await select('staff', `email=${eq(probe)}`)).toEqual([expect.objectContaining({ role: 'admin' })]);
  });

  test('the server checks what it is given: a bad address, a missing name or an unknown role is refused and creates nothing', async ({
    adminPage,
    world,
  }) => {
    const actions = captureActions(adminPage);
    const first = invitee(world, 'valid');
    await inviteThroughUi(adminPage, {
      name: `Valid Newhire ${world.tag}`,
      email: first,
      role: 'case_manager',
    });
    const real = actions.find((a) => a.body.includes(first))!;
    const base = (JSON.parse(real.body) as Array<{ email: string; fullName: string; role: string }>)[0]!;
    const origin = new URL(world.baseURL).origin;

    const probe = invitee(world, 'bad');
    const cases: Array<[string, Record<string, unknown>]> = [
      ['an address that is not one', { email: 'not-an-email' }],
      ['an address with a space in it', { email: `bad ${probe}` }],
      ['no name', { email: probe, fullName: '' }],
      ['a one-letter name', { email: probe, fullName: 'x' }],
      ['an unknown role', { email: probe, role: 'owner' }],
      ['a role that is not text', { email: probe, role: ['admin'] }],
    ];
    for (const [what, patch] of cases) {
      const reply = await replay(
        adminPage.request,
        real,
        [{ ...base, fullName: `Bad Newhire ${world.tag}`, ...patch }],
        origin,
      );
      expect(reply.text, what).toMatch(/"ok":false,"error":"invalid"/);
    }
    expect(await accountIdByEmail(probe)).toBeNull();
    expect(await emailsTo(probe)).toEqual([]);
    expect(
      await select('staff', `full_name=like.${encodeURIComponent(`*Bad Newhire ${world.tag}*`)}`),
    ).toEqual([]);
  });

  test('an address the server would refuse (a space in it) is explained by the form and nothing is sent', async ({
    adminPage: page,
    world,
  }) => {
    // The dialog checks the address with the server's own rule (isEmail from @dpl/core: no spaces, no "@@"...): it used to
    // pass the form's looser check, fail on the server and show nothing at all.
    const actions = captureActions(page);
    const dialog = await openDialog(page);
    await fillDialog(dialog, t, {
      name: 'Pat Example',
      email: `e2e admin team bad ${world.tag}@example.com`,
    });
    await dialog.locator('[data-invite-send]').click();
    await expect(dialog.getByRole('alert')).toHaveText([t.invite.emailError]);
    await expect(dialog.getByLabel(t.invite.email)).toHaveAttribute('aria-invalid', 'true');
    expect(actions, 'nothing was sent').toEqual([]);
    expect(await select('staff', `full_name=${eq('Pat Example')}`)).toEqual([]);
  });

  test('the dialog asks for a name and an address before it sends anything, and starts afresh when reopened', async ({
    adminPage: page,
    world,
  }) => {
    const actions = captureActions(page);
    const dialog = await openDialog(page);
    await dialog.locator('[data-invite-send]').click();
    await expect(dialog.getByRole('alert')).toHaveText([t.invite.nameError, t.invite.emailError]);
    await expect(dialog.getByLabel(t.invite.name)).toHaveAttribute('aria-invalid', 'true');
    await expect(dialog.getByLabel(t.invite.email)).toHaveAttribute('aria-invalid', 'true');

    // one field at a time: the message belongs to the field that is wrong
    await dialog.getByLabel(t.invite.name).fill('Pat Example');
    await dialog.getByLabel(t.invite.email).fill('not-an-email');
    await dialog.locator('[data-invite-send]').click();
    await expect(dialog.getByRole('alert')).toHaveText([t.invite.emailError]);
    expect(actions, 'nothing was sent').toEqual([]);

    // Cancel (and the X, and Escape) close it without inviting anyone; opening it again shows an empty form
    await dialog.getByRole('button', { name: t.invite.cancel }).click();
    await expect(page.locator('dialog[open]')).toHaveCount(0);
    await page.locator('[data-invite-open]').click();
    const again = page.locator('dialog[open]');
    await expect(again.getByLabel(t.invite.name)).toHaveValue('');
    await expect(again.getByLabel(t.invite.email)).toHaveValue('');
    await expect(again.getByRole('alert')).toHaveCount(0);
    await again.getByLabel(t.invite.name).fill('Pat Example');
    await page.keyboard.press('Escape');
    await expect(page.locator('dialog[open]')).toHaveCount(0);
    expect(actions).toEqual([]);
    expect(await select('staff', `full_name=${eq('Pat Example')}`)).toEqual([]);
    expect(world.tag).toBeTruthy();
  });
});

test.describe('the dialog', () => {
  for (const [prefix, texts] of [
    ['', t],
    ['/he', th],
  ] as const) {
    test(`${prefix || '/en'}: opens with the focus in the first field, is named, keeps the focus inside, closes with Escape, and has no accessibility violations`, async ({
      adminPage: page,
      world,
    }) => {
      test.skip(
        prefix === '/he' && !(await hebrewEdition(world)),
        'the Hebrew edition of the CRM needs the portal built with NEXT_PUBLIC_CAMPAIGN_LOCALES=en,he',
      );
      const dialog = await openDialog(page, prefix);
      await expect(page.getByRole('dialog', { name: texts.invite.title })).toBeVisible();
      await expect(dialog.getByLabel(texts.invite.name)).toBeFocused();

      // Tab walks the fields and buttons of the dialog and goes round again: it never reaches the page behind (the browser's
      // own controls show up as <body> for one press)
      const stops = new Set<string>();
      for (let i = 0; i < 9; i++) {
        await page.keyboard.press('Tab');
        stops.add(
          await page.evaluate(() =>
            document.activeElement?.closest('dialog')
              ? 'dialog'
              : (document.activeElement?.tagName ?? 'none'),
          ),
        );
      }
      expect([...stops].filter((x) => x !== 'BODY')).toEqual(['dialog']);

      // axe-core: every rule of WCAG 2.0/2.1 A and AA except colour contrast, which the design keeps (see e2e/a11y.spec.ts)
      const result = await new AxeBuilder({ page })
        .include('dialog[open]')
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .disableRules(['color-contrast'])
        .analyze();
      expect(result.violations.map((v) => `${v.id}: ${v.nodes[0]?.html.slice(0, 120)}`)).toEqual([]);
      // and with the messages showing
      await dialog.locator('[data-invite-send]').click();
      await expect(dialog.getByRole('alert')).toHaveCount(2);
      const withErrors = await new AxeBuilder({ page })
        .include('dialog[open]')
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .disableRules(['color-contrast'])
        .analyze();
      expect(withErrors.violations.map((v) => `${v.id}: ${v.nodes[0]?.html.slice(0, 120)}`)).toEqual([]);

      await page.keyboard.press('Escape');
      await expect(page.locator('dialog[open]')).toHaveCount(0);
      // the button that opened it can be used again from the keyboard
      await page.locator('[data-invite-open]').focus();
      await page.keyboard.press('Enter');
      await expect(page.locator('dialog[open]')).toBeVisible();
    });
  }
});

async function hebrewEdition(world: World): Promise<boolean> {
  const res = await fetch(`${world.baseURL}/he/sign-in`, {
    redirect: 'manual',
    headers: { accept: 'text/html' },
  });
  return res.status !== 307 && res.status !== 308;
}
