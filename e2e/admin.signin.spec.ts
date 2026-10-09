import auth from '../apps/campaign/messages/en/auth.json';
import { expect, test } from './support/admin-fixtures';

/**
 * Signing in as staff through the real sign-in page. The other CRM specs sign in with session cookies so they do not
 * depend on that page; this one checks the whole way in: the form, the redirect to `next`, the CRM itself.
 */
test('staff sign in through the sign-in page and land on the CRM', async ({ browser, world }) => {
  const context = await browser.newContext({ baseURL: world.baseURL });
  const page = await context.newPage();
  await page.goto('/sign-in?next=%2Fadmin');

  await page.getByLabel(auth.signIn.email, { exact: true }).fill(world.admin.email);
  await page.getByLabel(auth.signIn.password, { exact: true }).fill(world.admin.password);
  await page.getByRole('button', { name: auth.signIn.submit }).click();
  await expect(page).toHaveURL(/\/admin$/, { timeout: 30_000 });
  await expect(page.locator('[data-stats]')).toBeVisible();
  await context.close();
});
