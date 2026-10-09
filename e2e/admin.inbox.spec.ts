import { expect, test } from './support/admin-fixtures';
import { activity, eq, insert, remove, select, update } from './support/admin-db';

/** The inbox: callback requests and website contact forms, new -> in progress -> closed, handled by whoever picks them up. */

const item = (page: import('@playwright/test').Page, id: string) => page.locator(`[data-inbox-item="${id}"]`);
const badge = async (page: import('@playwright/test').Page) => {
  const el = page.locator('[data-inbox-badge]');
  return (await el.count()) ? Number(await el.first().innerText()) : 0;
};

test.describe('inbox', () => {
  test.beforeEach(async ({ world }) => {
    await update('callback_requests', `id=${eq(world.callbackId)}`, { status: 'new', handled_by: null });
    await update('contact_submissions', `id=${eq(world.contactId)}`, { status: 'new', handled_by: null });
  });

  test('lists callback requests and website contact forms, linking the lead when it is known', async ({ managerPage: page, world }) => {
    await page.goto('/admin/inbox');
    const cb = item(page, world.callbackId);
    await expect(cb).toBeVisible();
    await expect(cb).toContainText(`Callback ${world.tag}`);
    await expect(cb.getByRole('link', { name: '+1 212 555 0100' })).toHaveAttribute('href', 'tel:+12125550100');
    await expect(cb).toContainText('New');
    await expect(cb.locator('[data-inbox-lead]')).toContainText(`Open lead ${world.alpha.caseRef}`);
    await cb.locator('[data-inbox-lead]').click();
    await expect(page).toHaveURL(new RegExp(`/admin/leads/${world.alpha.id}`));

    await page.goto('/admin/inbox');
    const ct = item(page, world.contactId);
    await expect(ct).toBeVisible();
    await expect(ct).toContainText(`Contact ${world.tag}`);
    await expect(ct).toContainText('Consultation form');
    await expect(ct).toContainText('German citizenship');
    await expect(ct).toContainText(`Please call me back ${world.tag}`);
    await expect(ct.getByRole('link', { name: world.alpha.email })).toHaveAttribute('href', `mailto:${world.alpha.email}`);
    // no lead column on contact_submissions: matched by email address
    await expect(ct.locator('[data-inbox-lead]')).toContainText(world.alpha.caseRef);
  });

  test('status workflow: Start, Close, Reopen record who handled it, are filtered by status and are logged on the lead', async ({
    adminPage: page,
    world,
  }) => {
    await page.goto('/admin/inbox');
    await expect(page.locator('[data-realtime="subscribed"]')).toHaveCount(1, { timeout: 15_000 });
    const cb = item(page, world.callbackId);
    const startBadge = await badge(page);

    await cb.locator('[data-inbox-action="start"]').click();
    await expect(cb.locator('[data-inbox-status]')).toHaveAttribute('data-inbox-status', 'in_progress');
    await expect.poll(async () => (await select('callback_requests', `id=${eq(world.callbackId)}&select=status,handled_by`))[0]).toMatchObject({
      status: 'in_progress',
      handled_by: world.admin.id,
    });
    await expect(cb).toContainText(`Handled by ${world.admin.name}`);
    await expect.poll(() => badge(page)).toBeLessThan(startBadge); // one fewer new request (others may be added meanwhile)
    const log = await activity(world.alpha.id, 'callback_status');
    expect(log[0]).toMatchObject({ kind: 'staff', actor_id: world.admin.id, text: 'Callback request marked in progress' });

    // the filters
    await page.locator('[data-inbox-filter="new"]').click();
    await expect(cb).toHaveCount(0);
    await page.locator('[data-inbox-filter="in_progress"]').click();
    await expect(cb).toBeVisible();

    await cb.locator('[data-inbox-action="close"]').click();
    await expect.poll(async () => (await select('callback_requests', `id=${eq(world.callbackId)}&select=status`))[0]!.status).toBe('closed');
    await expect(cb).toHaveCount(0); // not in "In progress" any more
    await page.locator('[data-inbox-filter="closed"]').click();
    await expect(cb).toBeVisible();
    await expect(cb.locator('[data-inbox-status]')).toHaveAttribute('data-inbox-status', 'closed');
    expect((await activity(world.alpha.id, 'callback_status'))[0]!.text).toBe('Callback request marked closed');

    await cb.locator('[data-inbox-action="reopen"]').click();
    await expect.poll(async () => (await select('callback_requests', `id=${eq(world.callbackId)}&select=status`))[0]!.status).toBe('in_progress');

    // the same workflow for a contact form
    await page.locator('[data-inbox-filter="all"]').click();
    const ct = item(page, world.contactId);
    await ct.locator('[data-inbox-action="start"]').click();
    await expect.poll(async () => (await select('contact_submissions', `id=${eq(world.contactId)}&select=status,handled_by`))[0]).toMatchObject({
      status: 'in_progress',
      handled_by: world.admin.id,
    });
    await ct.locator('[data-inbox-action="close"]').click();
    await expect.poll(async () => (await select('contact_submissions', `id=${eq(world.contactId)}&select=status`))[0]!.status).toBe('closed');
  });

  test('a new request appears live and raises the count on the navigation', async ({ managerPage: page, world }) => {
    await page.goto('/admin/inbox');
    await expect(page.locator('[data-realtime="subscribed"]')).toHaveCount(1, { timeout: 15_000 });
    const before = await badge(page);
    const name = `Live callback ${world.tag}`;
    const [row] = await insert<{ id: string }>('callback_requests', { name, phone: '+1 646 555 0100', locale: 'en', source: 'e2e-admin' });
    await expect(page.getByText(name)).toBeVisible({ timeout: 15_000 });
    // other people's tests add to the same inbox: the count has to rise, whatever else came in meanwhile
    await expect.poll(() => badge(page), { timeout: 15_000 }).toBeGreaterThan(before);
    await remove('callback_requests', `id=${eq(row!.id)}`);
    await expect(page.getByText(name)).toHaveCount(0, { timeout: 15_000 });
  });

  test('Hebrew inbox', async ({ managerPage: page, world }) => {
    await page.goto('/he/admin/inbox');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.getByRole('heading', { name: 'תיבת פניות' })).toBeVisible();
    await expect(item(page, world.callbackId)).toContainText('חדשה');
    await expect(item(page, world.contactId)).toContainText('טופס ייעוץ');
  });
});
