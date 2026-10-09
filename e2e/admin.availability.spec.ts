import { expect, test } from './support/admin-fixtures';
import { eq, remove, select } from './support/admin-db';

/**
 * Availability (admins): the weekly template and blocked days. The test rows are Saturday 03:07 / 03:09, capacity 0 or
 * inactive, and a day in 2031, so they are never offered to a visitor on the shared local database.
 */

const SAT = 6;
const rules = (time: string) => select<{ id: string; weekday: number; start_time: string; capacity: number; active: boolean }>('availability_rules', `weekday=eq.${SAT}&start_time=${eq(`${time}:00`)}&select=*`);

test.describe('availability', () => {
  // this spec owns Saturday 03:07 / 03:09 in the weekly template: a failed run must not leave them behind
  test.afterEach(async () => {
    await remove('availability_rules', `weekday=eq.${SAT}&start_time=in.(03:07:00,03:09:00)`);
  });

  test('an admin edits the weekly template: add, validate, edit, delete', async ({ adminPage: page }) => {
    await page.goto('/admin/availability');
    await expect(page.locator('[data-realtime="subscribed"]')).toHaveCount(1, { timeout: 15_000 });
    const card = page.locator(`[data-weekday="${SAT}"]`);
    await expect(card.getByRole('heading', { name: 'Saturday' })).toBeVisible();
    // the firm's working week is Sunday to Thursday: six slots each from the seed
    await expect(page.locator('[data-weekday="0"] [data-rule]')).not.toHaveCount(0);

    const add = card.locator('[data-add-rule]');
    // invalid time is refused before anything is sent
    await add.getByPlaceholder('HH:MM').fill('25:99');
    await add.getByLabel('Capacity').fill('0');
    await add.locator('[data-rule-add]').click();
    await expect(add.getByRole('alert')).toContainText('Check the time (HH:MM)');
    expect(await select('availability_rules', `weekday=eq.${SAT}&select=id`)).toHaveLength(0);

    await add.getByPlaceholder('HH:MM').fill('03:07');
    await add.locator('[data-rule-add]').click();
    await expect(card.locator('[data-rule]')).toHaveCount(1);
    const [created] = await rules('03:07');
    expect(created).toMatchObject({ weekday: SAT, capacity: 0, active: true });

    // the same weekday and time twice is refused by the unique rule
    await add.getByPlaceholder('HH:MM').fill('03:07');
    await add.locator('[data-rule-add]').click();
    await expect(add.getByRole('alert')).toContainText('That time already exists.');
    expect(await rules('03:07')).toHaveLength(1);

    // edit: capacity, active and time (kept inactive so it is never offered)
    const rule = card.locator('[data-rule]');
    await rule.getByLabel('Active').uncheck();
    await rule.getByLabel('Capacity').fill('3');
    await rule.locator('[data-rule-save]').click();
    await expect.poll(async () => (await rules('03:07'))[0]).toMatchObject({ capacity: 3, active: false });
    await rule.getByLabel('Time').fill('03:09');
    await rule.locator('[data-rule-save]').click();
    await expect.poll(async () => (await rules('03:09')).length).toBe(1);
    expect(await rules('03:07')).toHaveLength(0);
    // a bad capacity or time on an existing row is refused client side
    await rule.getByLabel('Time').fill('9:9');
    await rule.locator('[data-rule-save]').click();
    await expect(rule.getByRole('alert')).toContainText('Check the time (HH:MM)');
    expect(await rules('03:09')).toHaveLength(1);

    await page.reload();
    await expect(card.locator('[data-rule]')).toHaveCount(1);
    await card.locator('[data-rule-delete]').click();
    await expect(card.locator('[data-rule]')).toHaveCount(0);
    expect(await rules('03:09')).toHaveLength(0);
  });

  test('blocked days and slots', async ({ adminPage: page, world }) => {
    await page.goto('/admin/availability');
    const form = page.locator('[data-add-exception]');
    const reason = `e2e ${world.tag} holiday`;

    // invalid input
    await form.getByLabel('Time (leave empty for the whole day)').fill('7pm');
    await form.getByLabel('Date').fill('2031-01-05');
    await form.locator('[data-exception-add]').click();
    await expect(form.getByRole('alert')).toContainText('Check the time (HH:MM)');

    await form.getByLabel('Time (leave empty for the whole day)').fill('');
    await form.getByLabel('Reason (optional)').fill(reason);
    await form.locator('[data-exception-add]').click();
    const row = page.locator('[data-exception]', { hasText: reason }).filter({ hasNotText: 'slot' });
    await expect(row).toBeVisible();
    await expect(form.getByLabel('Date')).toHaveValue(''); // the form is cleared once the block is saved
    await expect(row).toContainText('Whole day');
    await expect(row).toContainText('Jan 5, 2031');
    const rows = await select<{ id: string; start_time: string | null; on_date: string }>('availability_exceptions', `reason=${eq(reason)}&select=*`);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ on_date: '2031-01-05', start_time: null });

    // the same day twice is refused
    await form.getByLabel('Date').fill('2031-01-05');
    await form.locator('[data-exception-add]').click();
    await expect(form.getByRole('alert')).toContainText('That time already exists.');

    // a single slot on another day
    await form.getByLabel('Date').fill('2031-01-06');
    await form.getByLabel('Time (leave empty for the whole day)').fill('10:30');
    await form.getByLabel('Reason (optional)').fill(`${reason} slot`);
    await form.locator('[data-exception-add]').click();
    const slot = page.locator('[data-exception]', { hasText: `${reason} slot` });
    await expect(slot).toContainText('10:30');
    await expect(form.getByLabel('Date')).toHaveValue('');
    expect((await select<{ start_time: string }>('availability_exceptions', `reason=${eq(`${reason} slot`)}&select=start_time`))[0]!.start_time).toBe('10:30:00');

    await slot.locator('[data-exception-delete]').click();
    await expect(slot).toHaveCount(0);
    await row.locator('[data-exception-delete]').click();
    await expect(page.locator('[data-exception]', { hasText: reason })).toHaveCount(0);
    expect(await select('availability_exceptions', `reason=like.${encodeURIComponent(`e2e ${world.tag}%`)}&select=id`)).toHaveLength(0);
  });

  test('upcoming bookings are listed in the firm time zone with a link to the lead', async ({ managerPage: page, world }) => {
    await page.goto('/admin/availability');
    const booking = page.locator('[data-booking]', { hasText: world.beta.name });
    await expect(booking).toBeVisible();
    const clock = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Jerusalem', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(world.bookingStartsAt));
    await expect(booking).toContainText(clock);
    await expect(booking.getByRole('link', { name: /Call with/ })).toHaveAttribute('href', new RegExp(`/admin/leads/${world.beta.id}`));
    await expect(page.getByText(/Times are in the firm's time zone \(Asia\/Jerusalem\)\. Calls last \d+ minutes\./)).toBeVisible();
  });

  test('Hebrew availability', async ({ adminPage: page }) => {
    await page.goto('/he/admin/availability');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.getByRole('heading', { name: 'זמינות' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'יום שבת' })).toBeVisible();
  });
});
