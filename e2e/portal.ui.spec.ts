/**
 * Portal UI tests in a real browser: the guided tour, autosave and resume, uploads, submission and sign-out, in English,
 * and the mirrored Hebrew page. They use the real routes and the real local Supabase (see portal.helpers.ts); run with
 *
 *   pnpm exec playwright test e2e/portal.ui.spec.ts
 *
 * One browser at a time (workers: 1 is the default for a single file); every applicant is removed at the end.
 */
import { expect as baseExpect, test, type Browser, type Page } from '@playwright/test';
import { adminDb, BASE_URL, createApplicant, FULL_APPLICATION, storedObjects, tinyPdf, type Applicant } from './portal.helpers';

/* The app usually runs in development mode here, where the first visit to a page compiles it, on a busy machine: allow for that. */
const expect = baseExpect.configure({ timeout: 20_000 });
test.describe.configure({ mode: 'serial', timeout: 120_000 });

async function signedIn(browser: Browser, a: Applicant): Promise<{ page: Page; errors: string[]; close: () => Promise<void> }> {
  const context = await browser.newContext({ baseURL: BASE_URL, viewport: { width: 1280, height: 900 }, storageState: { cookies: a.cookies, origins: [] } });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  return { page, errors, close: () => context.close() };
}

const leadRow = async (id: string) => (await adminDb().from('leads').select('*').eq('id', id).single()).data as Record<string, unknown>;
const appRow = async (id: string) => (await adminDb().from('applications').select('*').eq('lead_id', id).maybeSingle()).data as { data: Record<string, string>; current_section: number; completed_at: string | null } | null;
const dialog = (page: Page) => page.getByRole('dialog', { name: 'Portal tour' });

test.describe('guided tour', () => {
  let a: Applicant;
  test.beforeAll(async () => {
    a = await createApplicant();
  });
  test.afterAll(async () => {
    await a.dispose();
  });

  test('starts by itself once, follows the keyboard and is remembered', async ({ browser }) => {
    const { page, errors, close } = await signedIn(browser, a);
    await page.goto('/portal');
    await expect(page).toHaveTitle(/Your application/);
    await expect(dialog(page)).toBeVisible({ timeout: 10_000 });
    await expect(dialog(page).getByText('Welcome to your portal')).toBeVisible();
    await expect(dialog(page).getByText('Quick tour')).toBeVisible();

    // each arrow key moves one step, and the spotlight follows the target
    const steps = ['Where your case stands', 'Your to-do list', 'Your next step, always here', 'Upload what you have', 'Saved automatically, updates by email'];
    for (const [i, title] of steps.entries()) {
      await page.keyboard.press('ArrowRight');
      await expect(dialog(page).getByText(title)).toBeVisible();
      await expect(dialog(page).getByText(`Step ${i + 1} of 5`)).toBeVisible();
    }
    await expect(dialog(page).getByRole('button', { name: "Got it, let's start" })).toBeVisible();
    await page.keyboard.press('ArrowLeft');
    await expect(dialog(page).getByText('Upload what you have')).toBeVisible();
    await page.keyboard.press('ArrowRight');
    // past the last step the tour closes, and the server remembers it
    await page.keyboard.press('ArrowRight');
    await expect(dialog(page)).toBeHidden();
    await expect.poll(async () => (await leadRow(a.leadId)).tour_done).toBe(true);

    // it does not start again, but the button brings it back, and Escape closes it
    await page.reload();
    await page.waitForTimeout(1500);
    await expect(dialog(page)).toBeHidden();
    await page.getByRole('button', { name: 'Show me around' }).click();
    await expect(dialog(page)).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog(page)).toBeHidden();
    expect(errors).toEqual([]);
    await close();
  });

  test('a click outside the card skips the tour; Tab stays inside it', async ({ browser }) => {
    const { page, close } = await signedIn(browser, a);
    await page.goto('/portal');
    await page.getByRole('button', { name: 'Show me around' }).click();
    await expect(dialog(page)).toBeVisible();
    for (let i = 0; i < 8; i++) {
      await page.keyboard.press('Tab');
      expect(await page.evaluate(() => !!document.activeElement?.closest('[role="dialog"]'))).toBe(true);
    }
    await page.mouse.click(5, 400);
    await expect(dialog(page)).toBeHidden();
    await close();
  });
});

test.describe('application, documents and submission', () => {
  let a: Applicant;
  test.beforeAll(async () => {
    a = await createApplicant();
    await adminDb().from('leads').update({ tour_done: true }).eq('id', a.leadId);
  });
  test.afterAll(async () => {
    await a.dispose();
  });

  test('autosaves while typing and resumes on the section where it was left', async ({ browser }) => {
    const { page, errors, close } = await signedIn(browser, a);
    await page.goto('/portal');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Your application is ready to start.');
    await page.getByRole('link', { name: 'Start my application' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('About you');

    await page.fill('#app-fullName', 'Portal Tester');
    await page.fill('#app-dob', '12/03/1988');
    // no blur, no button: the pause after typing saves it
    await expect.poll(async () => (await appRow(a.leadId))?.data.dob).toBe('12/03/1988');
    expect(await leadRow(a.leadId)).toMatchObject({ stage: 'application', status: 'application_incomplete' });
    await expect(page.getByText('Complete', { exact: true })).toHaveCount(0);

    await page.fill('#app-birthPlace', FULL_APPLICATION.birthPlace!);
    await page.fill('#app-citizenship', FULL_APPLICATION.citizenship!);
    await expect(page.getByRole('button', { name: /About you/ })).toContainText('Complete');
    await page.getByRole('button', { name: 'Save and continue' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Your ancestor');
    await expect.poll(async () => (await appRow(a.leadId))?.current_section).toBe(1);

    await page.reload();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Your ancestor');
    await page.goto('/portal');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Welcome back. Pick up where you left off.');
    await expect(page.getByText('Application and documents · 18% complete')).toBeVisible();
    await expect(page.getByText('Next: Your ancestor.')).toBeVisible();
    expect(errors).toEqual([]);
    await close();
  });

  test('finishing the sections unlocks the documents and the review lists every section', async ({ browser }) => {
    const { page, close } = await signedIn(browser, a);
    await page.goto('/portal/application');
    for (const id of ['anName', 'anRel', 'anDob', 'anBirthPlace', 'anLeft']) await page.fill(`#app-${id}`, FULL_APPLICATION[id]!);
    await page.getByRole('button', { name: 'Save and continue' }).click();
    await page.fill('#app-nameChanges', 'None');
    await page.getByRole('button', { name: 'Save and continue' }).click();
    for (const id of ['email', 'phone', 'address']) await page.fill(`#app-${id}`, FULL_APPLICATION[id]!);
    await page.getByRole('button', { name: 'Save and continue' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Review and records');
    await expect(page.getByText('All questions answered')).toHaveCount(4);
    // the review links back to a section
    await page.getByRole('button', { name: 'Go to Your ancestor' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Your ancestor');
    await page.getByRole('button', { name: /Review and records/ }).click();
    await page.getByRole('button', { name: 'Continue to documents' }).click();
    await page.waitForURL(/\/portal\/documents$/);
    await expect(page.getByRole('button', { name: 'Submit my application' })).toBeEnabled();
    expect((await appRow(a.leadId))?.completed_at).toBeTruthy();
    await close();
  });

  test('uploads a file straight to storage, refuses wrong files and replaces a document', async ({ browser }) => {
    const { page, errors, close } = await signedIn(browser, a);
    await page.goto('/portal/documents');
    const pick = async (name: string | RegExp, file: { name: string; mimeType: string; buffer: Buffer }) => {
      const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.getByRole('button', { name }).click()]);
      await chooser.setFiles(file);
    };

    await pick(/^Upload: Ancestor's birth certificate/, { name: 'Geburtsurkunde 1911.pdf', mimeType: 'application/pdf', buffer: tinyPdf('one') });
    await expect(page.getByText('Geburtsurkunde 1911.pdf')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText('1 of 8 received')).toBeVisible();
    const objects = await storedObjects(a.leadId);
    expect(objects).toHaveLength(1);
    expect(objects[0]).toMatch(new RegExp(`^${a.leadId}/birth_certificate/`));

    // wrong type and too big: refused in the browser, nothing is sent or stored
    await pick(/^Upload: Marriage certificates/, { name: 'setup.exe', mimeType: 'application/octet-stream', buffer: Buffer.from('MZ') });
    await expect(page.getByText('setup.exe: this file type is not supported')).toBeVisible();
    await expect(page.getByText('Upload failed')).toBeVisible();
    await pick(/^Try again: Marriage certificates/, { name: 'big.pdf', mimeType: 'application/pdf', buffer: Buffer.alloc(21 * 1024 * 1024, 1) });
    await expect(page.getByText('big.pdf: this file is larger than 20 MB.')).toBeVisible();
    // a file whose content is not what its name says: the server refuses it after the upload
    await pick(/^Try again: Marriage certificates/, { name: 'fake.pdf', mimeType: 'application/pdf', buffer: Buffer.from('<html><script>1</script></html>') });
    await expect(page.getByText('fake.pdf: we could not accept this file')).toBeVisible({ timeout: 30_000 });
    expect(await storedObjects(a.leadId)).toEqual(objects);

    // replacing keeps one file in the slot
    await pick(/^Replace: Ancestor's birth certificate/, { name: 'second.pdf', mimeType: 'application/pdf', buffer: tinyPdf('two') });
    await expect(page.getByText('second.pdf')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText('Geburtsurkunde 1911.pdf')).toHaveCount(0);
    await expect.poll(async () => (await storedObjects(a.leadId)).length).toBe(1);
    expect(errors).toEqual([]);
    await close();
  });

  test('submits through the sending screen, then shows the case and closes the application', async ({ browser }) => {
    const { page, errors, close } = await signedIn(browser, a);
    await page.goto('/portal/documents');
    await page.getByRole('button', { name: 'Submit my application' }).click();
    await expect(page.getByRole('heading', { name: 'Sending your application to the firm' })).toBeVisible();
    await page.waitForURL(/\/portal$/, { timeout: 30_000 });
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Application Submitted');
    await expect(page.getByText(`Case ${a.caseRef} · Decker Pex Levi is handling your application.`)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Show me around' })).toHaveCount(0);
    expect(await leadRow(a.leadId)).toMatchObject({ stage: 'review', status: 'application_submitted' });

    await page.goto('/portal/application');
    await page.waitForURL(/\/portal$/);

    // documents can still be added, and the panel says where things stand
    await page.goto('/portal/documents');
    await expect(page.getByText('Your application is with the firm.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Submit my application' })).toHaveCount(0);
    expect(errors).toEqual([]);
    await close();
  });

  test('"My details" saves name and phone, and shows the email read-only', async ({ browser }) => {
    const { page, close } = await signedIn(browser, a);
    await page.goto('/portal');
    await page.getByRole('button', { name: 'My details' }).click();
    const modal = page.getByRole('dialog', { name: 'My details' });
    await expect(modal).toBeVisible();
    await expect(modal.getByLabel('Email')).toHaveAttribute('readonly', '');
    await modal.getByLabel('Full name').fill('Anna');
    await modal.getByRole('button', { name: 'Save changes' }).click();
    await expect(modal.getByText('Please enter a first and last name.')).toBeVisible();
    await modal.getByLabel('Full name').fill('anna maria reinhardt');
    await modal.getByLabel('Phone').fill('123');
    await modal.getByRole('button', { name: 'Save changes' }).click();
    await expect(modal.getByText('Please enter a phone number with at least 7 digits.')).toBeVisible();
    await modal.getByLabel('Phone').fill('+49 30 5550 0163');
    await modal.getByRole('button', { name: 'Save changes' }).click();
    await expect(modal.getByText('Your details are updated. Our team sees the change straight away.')).toBeVisible();
    expect(await leadRow(a.leadId)).toMatchObject({ full_name: 'Anna Maria Reinhardt', phone: '+49 30 5550 0163', email: a.email });
    await page.keyboard.press('Escape');
    await expect(modal).toBeHidden();
    await close();
  });

  test('signing out ends the session and clears the lead cookie', async ({ browser }) => {
    const { page, close } = await signedIn(browser, a);
    await page.goto('/portal');
    await page.getByRole('button', { name: 'Sign out' }).click();
    await page.waitForURL((u) => u.pathname === '/');
    const names = (await page.context().cookies()).map((c) => c.name);
    expect(names.some((n) => n.startsWith('sb-'))).toBe(false);
    expect(names).not.toContain('dpl_lead');
    const res = await page.request.get('/api/portal/state');
    expect(res.status()).toBe(401);
    await close();
  });
});

test.describe('Hebrew', () => {
  let a: Applicant;
  test.beforeAll(async () => {
    a = await createApplicant({ locale: 'he', fullName: 'דנה כהן' });
  });
  test.afterAll(async () => {
    await a.dispose();
  });

  test('is mirrored, translated and keeps its own arrow keys in the tour', async ({ browser }) => {
    const { page, errors, close } = await signedIn(browser, a);
    await page.goto('/he/portal');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.locator('html')).toHaveAttribute('lang', 'he');
    const tour = page.getByRole('dialog', { name: 'סיור בפורטל' });
    await expect(tour).toBeVisible({ timeout: 10_000 });
    await expect(tour.getByText('ברוכים הבאים לפורטל שלכם')).toBeVisible();
    // in a right-to-left page the arrow that moves on points left
    await page.keyboard.press('ArrowLeft');
    await expect(tour.getByText('איפה התיק שלכם עומד')).toBeVisible();
    await page.keyboard.press('ArrowRight');
    await expect(tour.getByText('ברוכים הבאים לפורטל שלכם')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(tour).toBeHidden();

    // the dashboard is mirrored: the timeline starts at the right edge
    const first = await page.getByText('בדיקת זכאות').first().boundingBox();
    const last = await page.getByText('בדיקה במשרד').first().boundingBox();
    expect(first!.x).toBeGreaterThan(last!.x);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('הבקשה שלכם מוכנה להתחלה.');

    await page.goto('/he/portal/documents');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('שלחו לנו את מה שכבר יש לכם.');
    await expect(page.getByText('מסמכי המפתח נושאים את התיק.')).toBeVisible();
    // no horizontal scrolling on a phone
    await page.setViewportSize({ width: 390, height: 844 });
    for (const path of ['/he/portal', '/he/portal/application', '/he/portal/documents']) {
      await page.goto(path);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    }
    expect(errors).toEqual([]);
    await close();
  });
});
