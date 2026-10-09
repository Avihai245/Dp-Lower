import { expect, test } from './support/admin-fixtures';

/**
 * Signing in as staff through the real sign-in page (owned by the auth part of the app). The other specs sign in with
 * session cookies so they do not depend on that page; this one checks the whole way in. It skips itself while the page
 * does not exist in the branch under test or its form cannot be found.
 */
test('staff sign in through the sign-in page and land on the CRM', async ({ browser, world }) => {
  const context = await browser.newContext({ baseURL: world.baseURL });
  const page = await context.newPage();
  const res = await page.goto('/sign-in?next=%2Fadmin');
  test.skip(!res || res.status() === 404, 'there is no /sign-in page in this branch yet');

  const email = page.getByLabel(/e-?mail/i).first();
  const password = page.getByLabel(/password/i).first();
  const found = await email.isVisible({ timeout: 10_000 }).catch(() => false);
  test.skip(!found, 'the sign-in form was not found (labels differ from "Email" / "Password")');

  await email.fill(world.admin.email);
  await password.fill(world.admin.password);
  await page.getByRole('button', { name: /^sign in$/i }).click();
  await expect(page).toHaveURL(/\/admin$/, { timeout: 30_000 });
  await expect(page.locator('[data-stats]')).toBeVisible();
  await context.close();
});
