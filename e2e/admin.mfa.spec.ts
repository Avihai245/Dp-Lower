import { expect, test, type Browser, type Page } from '@playwright/test';
import { spawn, type ChildProcess } from 'node:child_process';
import path from 'node:path';
import enAuth from '../apps/campaign/messages/en/auth.json';
import { ANON_KEY, BASE_URL, SERVICE_KEY, SUPABASE_URL, cleanup, createAuthUser, makeStaff, newEmail, newIp } from './support/funnel';
import { totpCode } from './support/totp';

/**
 * Two-step verification for the firm's staff (an authenticator app, TOTP): switching it on from /two-step, the code that
 * every later sign-in asks for after the password, and the two places that enforce it: the CRM (pages and actions) and the
 * database (a password-only session of somebody who enrolled is not staff to the Data API either). The firm can also make
 * it compulsory (STAFF_MFA_REQUIRED=1), which is tried on a second copy of the portal started with that setting.
 *
 *   CAMPAIGN_URL=http://localhost:3001 pnpm exec playwright test e2e/admin.mfa.spec.ts
 */
test.describe.configure({ mode: 'serial' });
test.setTimeout(120_000);
test.afterAll(cleanup);

const mfa = enAuth.mfa;
const PASSWORD = 'Staff-Pass-9!z';
const sp = (key: string) => (mfa.setup as unknown as Record<string, string>)[key]!;

const admin = () => ({ apikey: SERVICE_KEY, authorization: `Bearer ${SERVICE_KEY}`, 'content-type': 'application/json' });

/** A staff member (case manager) with a password; the account and the staff row are removed again by cleanup(). */
async function newStaff(label: string) {
  const email = newEmail(`mfa-${label}`);
  const id = await createAuthUser(email, PASSWORD);
  await makeStaff(id, email);
  return { id, email };
}

/** The auth server's own list of the factors of an account. */
async function factorsOf(userId: string): Promise<Array<{ factor_type: string; status: string }>> {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, { headers: admin() });
  return ((await res.json()) as { factors?: Array<{ factor_type: string; status: string }> }).factors ?? [];
}

async function visitor(browser: Browser) {
  const context = await browser.newContext({ baseURL: BASE_URL, viewport: { width: 1280, height: 900 }, extraHTTPHeaders: { 'x-forwarded-for': newIp() } });
  return { context, page: await context.newPage() };
}

/** The sign-in form with a password, from the first page (the portal's `site`, default BASE_URL). */
async function signIn(page: Page, email: string, site = BASE_URL) {
  await page.goto(`${site}/sign-in`);
  await page.locator('#si-email').fill(email);
  await page.locator('#si-password').fill(PASSWORD);
  await page.getByRole('button', { name: enAuth.signIn.submit }).click();
}

const codeBox = (page: Page) => page.locator('#mfa-code');

/** A code that is wrong for this secret at the moment (the auth server accepts the step before and the one after as well). */
const wrongCode = (key: string): string => {
  const valid = new Set([-1, 0, 1].map((o) => totpCode(key, o)));
  return ['000000', '111111', '222222'].find((c) => !valid.has(c))!;
};

/** Fills the code box with `code` and presses the form's button. */
async function enter(page: Page, code: string, button: string) {
  await codeBox(page).fill(code);
  await page.getByRole('button', { name: button, exact: true }).click();
}

/** Switches two-step verification on for the signed-in member (the page is /two-step); returns the secret of the app. */
async function enrol(page: Page, site = BASE_URL): Promise<string> {
  await page.goto(`${site}/two-step`);
  await page.getByRole('button', { name: sp('start') }).click();
  await expect(page.locator('#mfa-secret')).toBeVisible();
  const secret = (await page.locator('#mfa-secret').innerText()).trim();
  await enter(page, totpCode(secret), sp('confirm'));
  await expect(page.getByText(sp('done'))).toBeVisible();
  return secret;
}

// the member and the secret of the authenticator app are shared by the tests below, in order
let member: { id: string; email: string };
let secret = '';
let leadId = '';

test('without an app, the password alone opens the CRM, and the header offers the setting', async ({ browser }) => {
  member = await newStaff('main');
  const res = await fetch(`${SUPABASE_URL}/rest/v1/leads`, {
    method: 'POST',
    headers: { ...admin(), prefer: 'return=representation' },
    body: JSON.stringify({ full_name: 'E2E Mfa', email: newEmail('mfa-lead') }),
  });
  leadId = ((await res.json()) as Array<{ id: string }>)[0]!.id;

  const { context, page } = await visitor(browser);
  await signIn(page, member.email);
  await page.waitForURL(`${BASE_URL}/admin`);
  await expect(page.locator('[data-admin-security]')).toBeVisible();
  // not enrolled: the page says so and offers the setup
  await page.locator('[data-admin-security]').click();
  await expect(page).toHaveURL(/\/two-step\?next=(%2F|\/)admin$/);
  await expect(page.locator('[data-status]')).toHaveAttribute('data-status', 'off');
  await expect(page.getByRole('button', { name: sp('start') })).toBeVisible();
  await context.close();
});

test('setting it up: a wrong code is refused, the right one switches it on, and the setup shows up in the account', async ({ browser }) => {
  const { context, page } = await visitor(browser);
  await signIn(page, member.email);
  await page.waitForURL(`${BASE_URL}/admin`);
  await page.goto(`${BASE_URL}/two-step`);
  await page.getByRole('button', { name: sp('start') }).click();

  // the QR code and the key to type in by hand
  await expect(page.getByRole('img', { name: sp('qrAlt') })).toBeVisible();
  secret = (await page.locator('#mfa-secret').innerText()).trim();
  expect(secret).toMatch(/^[A-Z2-7]{16,}$/);
  const naturalWidth = await page.getByRole('img', { name: sp('qrAlt') }).evaluate((img) => (img as HTMLImageElement).naturalWidth);
  expect(naturalWidth, 'the QR code image decodes').toBeGreaterThan(0);

  // the button waits for six digits; a wrong code is refused with a message and the field is cleared
  const wrong = wrongCode(secret);
  await codeBox(page).fill('12345');
  await expect(page.getByRole('button', { name: sp('confirm') })).toBeDisabled();
  await enter(page, wrong, sp('confirm'));
  await expect(page.locator('#mfa-note')).toHaveText(sp('invalid'));
  await expect(codeBox(page)).toHaveValue('');
  expect((await factorsOf(member.id)).filter((f) => f.status === 'verified')).toHaveLength(0);

  // the right code (with spaces, the way an app shows it) switches it on
  const good = totpCode(secret);
  await enter(page, `${good.slice(0, 3)} ${good.slice(3)}`, sp('confirm'));
  await expect(page.getByText(sp('done'))).toBeVisible();
  await expect(page.locator('[data-status]')).toHaveAttribute('data-status', 'on');
  expect(await factorsOf(member.id)).toEqual([expect.objectContaining({ factor_type: 'totp', status: 'verified' })]);

  // the session that did it is already fully signed in
  await page.getByRole('button', { name: sp('continue') }).click();
  await page.waitForURL(`${BASE_URL}/admin`);
  await context.close();
});

test('the next sign-in asks for the code after the password, and only the right code opens the CRM', async ({ browser }) => {
  const { context, page } = await visitor(browser);
  await signIn(page, member.email);
  await page.waitForURL(/\/verify\?next=(%2F|\/)admin$/);
  await expect(page.locator('h1')).toHaveText(mfa.verify.title);

  // a deep link into the CRM meanwhile goes to the same place and comes back to /admin
  await page.goto(`${BASE_URL}/admin/inbox`);
  await expect(page).toHaveURL(/\/verify\?next=(%2F|\/)admin$/);

  // a wrong code: refused, nothing opens
  await enter(page, wrongCode(secret), mfa.verify.submit);
  await expect(page.locator('#mfa-note')).toHaveText(mfa.verify.invalid);
  expect((await page.request.get(`${BASE_URL}/admin`, { maxRedirects: 0 })).status()).toBe(307);

  // the right code (a neighbouring step: the auth server accepts one step either way)
  await enter(page, totpCode(secret, 1), mfa.verify.submit);
  await page.waitForURL(`${BASE_URL}/admin`);
  await expect(page.locator('[data-admin-security]')).toBeVisible();
  // and the page for the setting is open for a verified session, showing "on"
  await page.goto(`${BASE_URL}/two-step`);
  await expect(page.locator('[data-status]')).toHaveAttribute('data-status', 'on');
  await context.close();
});

test('a password-only session of an enrolled member opens nothing: not the CRM routes, not the database', async ({ browser }) => {
  // the password grant gives the same thing a browser gets before it types the code: a session at assurance level aal1
  const grant = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: ANON_KEY, 'content-type': 'application/json' },
    body: JSON.stringify({ email: member.email, password: PASSWORD }),
  });
  const aal1 = (await grant.json()) as { access_token: string; user: { factors?: Array<{ id: string; factor_type: string; status: string }> } };
  expect(grant.status).toBe(200);
  const asUser = (token: string) => ({ apikey: ANON_KEY, authorization: `Bearer ${token}` });

  // Data API: the staff rules of every table answer "no" and the helpers say so
  const leads1 = await fetch(`${SUPABASE_URL}/rest/v1/leads?select=id&id=eq.${leadId}`, { headers: asUser(aal1.access_token) });
  expect(await leads1.json()).toEqual([]);
  const staff1 = await fetch(`${SUPABASE_URL}/rest/v1/rpc/is_staff`, { method: 'POST', headers: { ...asUser(aal1.access_token), 'content-type': 'application/json' }, body: '{}' });
  expect(await staff1.json()).toBe(false);

  // ...and the same account, once it has given the code (the auth server's own endpoints), is staff again
  const factor = aal1.user.factors!.find((f) => f.factor_type === 'totp' && f.status === 'verified')!;
  const challenge = await fetch(`${SUPABASE_URL}/auth/v1/factors/${factor.id}/challenge`, { method: 'POST', headers: { ...asUser(aal1.access_token), 'content-type': 'application/json' }, body: '{}' });
  const { id: challengeId } = (await challenge.json()) as { id: string };
  const verify = await fetch(`${SUPABASE_URL}/auth/v1/factors/${factor.id}/verify`, {
    method: 'POST',
    headers: { ...asUser(aal1.access_token), 'content-type': 'application/json' },
    body: JSON.stringify({ challenge_id: challengeId, code: totpCode(secret, -1) }),
  });
  expect(verify.status).toBe(200);
  const aal2 = (await verify.json()) as { access_token: string };
  const leads2 = await fetch(`${SUPABASE_URL}/rest/v1/leads?select=id&id=eq.${leadId}`, { headers: asUser(aal2.access_token) });
  expect(await leads2.json()).toEqual([{ id: leadId }]);
  const staff2 = await fetch(`${SUPABASE_URL}/rest/v1/rpc/is_staff`, { method: 'POST', headers: { ...asUser(aal2.access_token), 'content-type': 'application/json' }, body: '{}' });
  expect(await staff2.json()).toBe(true);

  // the CRM's own routes: the page of a session still at aal1 is sent to the code, a document download answers 403
  const { context, page } = await visitor(browser);
  await signIn(page, member.email);
  await page.waitForURL(/\/verify/);
  const download = await page.request.get(`${BASE_URL}/admin/leads/${leadId}/documents/passport`, { maxRedirects: 0 });
  expect([307, 403, 404], 'no document is handed out before the code').toContain(download.status());
  expect(download.status()).not.toBe(200);
  // and the setting cannot be reached to switch the protection off: /two-step sends it to the code first
  await page.goto(`${BASE_URL}/two-step`);
  await expect(page).toHaveURL(/\/verify\?next=(%2F|\/)two-step$/);
  await context.close();
});

test('turning it off needs the code first; afterwards the password alone opens the CRM again', async ({ browser }) => {
  const { context, page } = await visitor(browser);
  await signIn(page, member.email);
  await page.waitForURL(/\/verify/);
  await enter(page, totpCode(secret, -1) === totpCode(secret, 1) ? totpCode(secret) : totpCode(secret, 1), mfa.verify.submit);
  await page.waitForURL(`${BASE_URL}/admin`);

  await page.goto(`${BASE_URL}/two-step`);
  await page.getByRole('button', { name: sp('turnOff'), exact: true }).click();
  await expect(page.getByText(sp('turnOffAsk'))).toBeVisible();
  await page.getByRole('button', { name: sp('turnOffYes') }).click();
  await expect(page.getByText(sp('turnedOff'))).toBeVisible();
  await expect(page.locator('[data-status]')).toHaveAttribute('data-status', 'off');
  expect((await factorsOf(member.id)).filter((f) => f.status === 'verified')).toHaveLength(0);
  await context.close();

  // a new browser: the password is enough again
  const again = await visitor(browser);
  await signIn(again.page, member.email);
  await again.page.waitForURL(`${BASE_URL}/admin`);
  await again.context.close();
});

test('the people who are not staff never see these pages', async ({ browser, request }) => {
  // anonymous: sent to sign-in; an applicant's session (not staff): the 404 page
  const anon = await request.get(`${BASE_URL}/verify`, { maxRedirects: 0 });
  expect(anon.status()).toBe(307);
  expect(new URL(anon.headers().location!, BASE_URL).pathname).toBe('/sign-in');
  const anon2 = await request.get(`${BASE_URL}/two-step`, { maxRedirects: 0 });
  expect(anon2.status()).toBe(307);

  const email = newEmail('mfa-applicant');
  await createAuthUser(email, PASSWORD);
  const { context, page } = await visitor(browser);
  await signIn(page, email);
  await page.waitForLoadState('networkidle');
  for (const p of ['/verify', '/two-step']) {
    const res = await page.goto(`${BASE_URL}${p}`);
    expect(res?.status(), p).toBe(404);
  }
  await context.close();
});

// -- compulsory: STAFF_MFA_REQUIRED=1 on a second copy of the portal ----------------------------------------------------

test.describe('when the firm makes it compulsory', () => {
  const PORT = 3102;
  const SITE = `http://localhost:${PORT}`;
  let server: ChildProcess | undefined;

  test.beforeAll(async () => {
    const campaign = path.resolve(__dirname, '../apps/campaign');
    server = spawn('node', [path.resolve(__dirname, '../node_modules/next/dist/bin/next'), 'start', '-p', String(PORT)], {
      cwd: campaign,
      env: { ...process.env, STAFF_MFA_REQUIRED: '1' },
      stdio: 'ignore',
    });
    const until = Date.now() + 60_000;
    for (;;) {
      const up = await fetch(`${SITE}/sign-in`).then((r) => r.ok).catch(() => false);
      if (up) break;
      if (Date.now() > until) throw new Error('the second portal did not start');
      await new Promise((r) => setTimeout(r, 500));
    }
  });
  test.afterAll(() => {
    server?.kill('SIGTERM');
  });

  test('a member who has not enrolled is taken to the setup first, cannot skip it, and then goes on', async ({ browser }) => {
    const staff = await newStaff('required');
    const { context, page } = await visitor(browser);
    await signIn(page, staff.email, SITE);
    // the sign-in sends staff to /admin; the CRM sends them on to the setup
    await page.waitForURL(/\/two-step\?next=(%2F|\/)admin$/);
    await expect(page.getByText(mfa.setup.lede.required)).toBeVisible();
    await expect(page.locator('[data-status]')).toHaveAttribute('data-status', 'off');
    // no way back into the CRM before it is done
    expect((await page.request.get(`${SITE}/admin`, { maxRedirects: 0 })).status()).toBe(307);
    await expect(page.getByRole('link', { name: sp('back') })).toHaveCount(0);

    const own = await enrol(page, SITE);
    expect(own).toMatch(/^[A-Z2-7]{16,}$/);
    // done: the CRM opens, and the switch to turn it off is not offered
    await page.goto(`${SITE}/admin`);
    await expect(page).toHaveURL(`${SITE}/admin`);
    await page.goto(`${SITE}/two-step`);
    await expect(page.getByText(sp('turnOffRequired'))).toBeVisible();
    await expect(page.getByRole('button', { name: sp('turnOff'), exact: true })).toHaveCount(0);
    await context.close();
  });
});
