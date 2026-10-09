import { expect, test } from './support/admin-fixtures';
import { eq, remove, select } from './support/admin-db';

/**
 * Who may open the CRM. Anonymous visitors are sent to the sign-in page, signed-in people who are not (active) staff get
 * the 404 page and cannot use the document route, case managers cannot reach the admin-only team page, and admin-only
 * Server Actions refuse a case manager even when the request is replayed with the admin's own action id.
 */

test.describe('access', () => {
  // the replay test below adds a Friday 03:11 rule: it never outlives a failed run
  test.afterEach(async () => {
    await remove('availability_rules', 'weekday=eq.5&start_time=in.(03:11:00,03:13:00)');
  });

  test('anonymous visitors are redirected to the sign-in page with a next parameter', async ({ playwright, world }) => {
    const api = await playwright.request.newContext({ baseURL: world.baseURL });
    for (const [path, expected] of [
      ['/admin', '/sign-in?next=%2Fadmin'],
      ['/he/admin', '/he/sign-in?next=%2Fhe%2Fadmin'],
      ['/admin/inbox', '/sign-in?next=%2Fadmin%2Finbox'],
      [`/admin/leads/${world.alpha.id}`, `/sign-in?next=%2Fadmin%2Fleads%2F${world.alpha.id}`],
      [`/admin/leads/${world.alpha.id}/documents/birth_certificate`, `/sign-in?next=%2Fadmin%2Fleads%2F${world.alpha.id}%2Fdocuments%2Fbirth_certificate`],
    ] as const) {
      const res = await api.get(path, { maxRedirects: 0 });
      expect(res.status(), path).toBeGreaterThanOrEqual(300);
      expect(res.status(), path).toBeLessThan(400);
      expect(res.headers().location, path).toContain(expected);
    }
    await api.dispose();
  });

  test('a signed-in applicant (not staff) gets 404 for every admin page and cannot read documents', async ({ applicantPage: page, world }) => {
    for (const path of ['/admin', '/admin/inbox', '/admin/availability', '/admin/team', `/admin/leads/${world.alpha.id}`, '/he/admin']) {
      const res = await page.goto(path);
      expect(res?.status(), path).toBe(404);
      await expect(page.getByText('404').first()).toBeVisible();
      // none of the CRM's data is in the page
      await expect(page.locator('body')).not.toContainText(world.alpha.name);
    }
    const doc = await page.request.get(`/admin/leads/${world.alpha.id}/documents/birth_certificate`, { maxRedirects: 0 });
    expect(doc.status()).toBe(403);
  });

  test('a deactivated staff member gets 404', async ({ inactivePage: page }) => {
    const res = await page.goto('/admin');
    expect(res?.status()).toBe(404);
  });

  test('an active staff member opens the CRM', async ({ managerPage: page, world }) => {
    const res = await page.goto('/admin');
    expect(res?.status()).toBe(200);
    await expect(page.locator('[data-stats]')).toBeVisible();
    await expect(page.getByText(world.alpha.name)).toBeVisible();
    // robots: the CRM is never indexed
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
  });

  test('a lead id that does not exist is a 404 for staff', async ({ managerPage: page }) => {
    const res = await page.goto('/admin/leads/00000000-0000-4000-8000-000000000000');
    expect(res?.status()).toBe(404);
    const bad = await page.goto('/admin/leads/not-a-uuid');
    expect(bad?.status()).toBe(404);
  });

  test('the team page is admin-only: a case manager gets 404 and sees no Team link, the admin sees both', async ({ managerPage, adminPage }) => {
    await managerPage.goto('/admin');
    await expect(managerPage.getByRole('link', { name: 'Team' })).toHaveCount(0);
    expect((await managerPage.goto('/admin/team'))?.status()).toBe(404);

    await adminPage.goto('/admin');
    await expect(adminPage.getByRole('link', { name: 'Team' })).toBeVisible();
    expect((await adminPage.goto('/admin/team'))?.status()).toBe(200);
    await expect(adminPage.locator('[data-team]')).toContainText('E2E Manager');
  });

  test("an admin changes a team member's role and active switch, and the new access applies at once", async ({ adminPage: page, inactivePage, world }) => {
    const stored = async () => (await select('staff', `user_id=${eq(world.inactive.id)}`))[0]!;
    await page.goto('/admin/team');
    const member = page.locator(`[data-member="${world.inactive.id}"]`);
    await expect(member).toContainText(world.inactive.name);
    await expect(member.locator('[data-member-save]')).toHaveCount(0); // nothing to save yet
    expect((await inactivePage.goto('/admin'))?.status()).toBe(404); // a deactivated lawyer

    await member.getByLabel('Role').selectOption('case_manager');
    await member.getByLabel('Active').check();
    await member.locator('[data-member-save]').click();
    await expect.poll(stored).toMatchObject({ role: 'case_manager', active: true });
    await expect(member.locator('[data-member-save]')).toHaveCount(0); // saved: the row is clean again
    expect((await inactivePage.goto('/admin'))?.status()).toBe(200);

    // and back: a deactivated person is refused again
    await member.getByLabel('Role').selectOption('lawyer');
    await member.getByLabel('Active').uncheck();
    await member.locator('[data-member-save]').click();
    await expect.poll(stored).toMatchObject({ role: 'lawyer', active: false });
    expect((await inactivePage.goto('/admin'))?.status()).toBe(404);
  });

  test('availability is read-only for a case manager (no edit controls)', async ({ managerPage: page }) => {
    await page.goto('/admin/availability');
    await expect(page.getByText('Only admins can change availability.')).toBeVisible();
    await expect(page.locator('[data-rule-add]')).toHaveCount(0);
    await expect(page.locator('[data-rule-delete]')).toHaveCount(0);
    await expect(page.locator('[data-exception-add]')).toHaveCount(0);
  });

  test('admin-only Server Actions refuse a case manager, even when an admin request is replayed with their cookies', async ({
    adminPage,
    managerPage,
    world,
  }) => {
    await adminPage.goto('/admin/availability');
    const captured: { url: string; headers: Record<string, string>; body: string }[] = [];
    adminPage.on('request', (r) => {
      const h = r.headers();
      if (r.method() === 'POST' && h['next-action']) captured.push({ url: r.url(), headers: h, body: r.postData() ?? '' });
    });

    // the admin adds an (invisible: capacity 0, Friday 03:11) rule through the UI; the availability spec owns Saturday
    const card = adminPage.locator('[data-weekday="5"]');
    await card.getByPlaceholder('HH:MM').fill('03:11');
    await card.locator('input').nth(1).fill('0');
    await card.locator('[data-rule-add]').click();
    await expect(card.locator('[data-rule]')).toHaveCount(1);
    expect(captured.length).toBeGreaterThan(0);
    const add = captured[0]!;

    // replay the same request as the case manager: the action id is valid, the caller is not an admin
    await managerPage.goto('/admin/availability');
    const cookies = await managerPage.context().cookies();
    const header = cookies.map((c) => `${c.name}=${c.value}`).join('; ');
    const replay = await managerPage.request.post(add.url, {
      headers: { 'next-action': add.headers['next-action']!, 'content-type': add.headers['content-type'] ?? 'text/plain;charset=UTF-8', cookie: header, origin: world.baseURL },
      data: add.body.replace('03:11', '03:13'),
    });
    expect(await replay.text()).toMatch(/"ok":false,"error":"forbidden"/);
    expect(await select('availability_rules', `weekday=eq.5&start_time=${eq('03:13:00')}`)).toHaveLength(0);

    // and with no cookies at all nothing is created either
    const bare = await managerPage.request.post(add.url, {
      headers: { 'next-action': add.headers['next-action']!, 'content-type': add.headers['content-type'] ?? 'text/plain;charset=UTF-8', origin: world.baseURL },
      data: add.body.replace('03:11', '03:13'),
      maxRedirects: 0,
    });
    expect(await bare.text()).not.toContain('"ok":true');
    expect(await select('availability_rules', `weekday=eq.5&start_time=${eq('03:13:00')}`)).toHaveLength(0);

    // clean up the rule the admin added
    await card.locator('[data-rule-delete]').click();
    await expect(card.locator('[data-rule]')).toHaveCount(0);
    expect(world.tag).toBeTruthy();
  });
});
