import { expect as baseExpect, test, type Browser, type Page } from '@playwright/test';
import enAuth from '../apps/campaign/messages/en/auth.json';
import enFunnel from '../apps/campaign/messages/en/funnel.json';
import enPortal from '../apps/campaign/messages/en/portal.json';
import heAuth from '../apps/campaign/messages/he/auth.json';
import heFunnel from '../apps/campaign/messages/he/funnel.json';
import hePortal from '../apps/campaign/messages/he/portal.json';
import { bootstrapStaff, deleteUserByEmail } from '../scripts/bootstrap-admin';
import { FULL_APPLICATION, storedObjects, tinyPdf } from './portal.helpers';
import { BASE_URL, SERVICE_KEY, SUPABASE_URL, cleanup, eventsOf, leadByEmail, newEmail, newIp, rest } from './support/funnel';

/**
 * The whole product in one story, in English and in Hebrew (RTL): a visitor goes from the landing page through the six
 * questions, leaves her details, books a call, opens the portal, fills in the application, uploads a record and
 * submits; a lawyer signs in to the CRM, sees the case, asks for another record, rejects the one that was uploaded and
 * sets the status; and the applicant, back in her own browser, sees exactly that. Along the way the database and the
 * outbox are checked for what each step must leave behind.
 *
 *   pnpm exec playwright test e2e/journey.spec.ts     (campaign app on CAMPAIGN_URL, default http://localhost:3001)
 */
test.use({ baseURL: BASE_URL });
test.describe.configure({ mode: 'serial' });
const expect = baseExpect.configure({ timeout: 20_000 });

const COMPLETE_STAFF_PASSWORD = 'Journey-staff-pass-1';
const staffEmail = (tag: string) => `e2e-funnel-journey-staff-${tag}@example.com`;
const staffEmails: string[] = [];

test.afterAll(async () => {
  for (const email of staffEmails) await deleteUserByEmail(email).catch(() => undefined);
  await cleanup();
});

const LOCALES = [
  { locale: 'en' as const, prefix: '', tz: 'America/New_York', funnel: enFunnel, portal: enPortal, auth: enAuth, name: 'anna reinhardt', first: 'Anna', lang: 'en', dir: 'ltr' },
  { locale: 'he' as const, prefix: '/he', tz: 'Asia/Jerusalem', funnel: heFunnel, portal: hePortal, auth: heAuth, name: 'דנה כהן', first: 'דנה', lang: 'he', dir: 'rtl' },
];

const options = (page: Page) => page.locator('[role=group] button[aria-pressed]');

async function context(browser: Browser, L: (typeof LOCALES)[number], viewport = { width: 1440, height: 900 }) {
  const ctx = await browser.newContext({
    baseURL: BASE_URL,
    viewport,
    locale: L.locale === 'he' ? 'he-IL' : 'en-US',
    timezoneId: L.tz,
    extraHTTPHeaders: { 'x-forwarded-for': newIp() },
  });
  const page = await ctx.newPage();
  const problems: string[] = [];
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error' && !/Failed to load resource|net::ERR_/.test(m.text())) problems.push(`console: ${m.text()}`);
  });
  return { ctx, page, problems };
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

for (const L of LOCALES) {
  test(`${L.locale}: from the landing page to a reviewed case`, async ({ browser }) => {
    test.setTimeout(300_000);
    const email = newEmail(`journey-${L.locale}`);

    // ---- 1. the visitor: landing page, six questions, details ---------------------------------------------------
    const visitor = await context(browser, L);
    const page = visitor.page;
    await page.goto(`${L.prefix}/`);
    await expect(page.locator('html')).toHaveAttribute('dir', L.dir);
    await page.locator('a[href$="/eligibility"]').first().click();
    await expect(page).toHaveURL(new RegExp(`${L.prefix}/eligibility$`));

    for (let i = 0; i < 6; i++) {
      await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow', String(Math.round((i / 6) * 100)));
      const question = (await page.locator('h1').textContent()) ?? '';
      await options(page).nth(1).click();
      // the next question slides in by itself after a moment
      if (i < 5) await expect(page.locator('h1')).not.toHaveText(question);
    }
    await expect(page).toHaveURL(new RegExp(`${L.prefix}/details$`));

    await page.locator('#lead-name').fill(L.name);
    await page.locator('#lead-email').fill(email);
    await page.locator('#lead-phone').fill('+1 555 000 0000');
    await page.locator('form button[type=submit]').click();
    await expect(page).toHaveURL(new RegExp(`${L.prefix}/booking$`));

    const lead = await leadByEmail(email);
    expect(lead, 'the lead exists').toBeTruthy();
    expect(lead).toMatchObject({ locale: L.locale, stage: 'lead', status: 'enquiry' });
    expect(lead!.case_ref).toMatch(/^DPL-\d{2}-\d{4}$/);
    const leadId = lead!.id;

    // ---- 2. booking: five days, a real slot, the confirmation ----------------------------------------------------
    const days = page.locator('[aria-labelledby=book-day] button');
    await expect(days).toHaveCount(5);
    await days.nth(2).click();
    const slots = page.locator('[aria-labelledby=book-time] button');
    const chosen = ((await slots.nth(1).textContent()) ?? '').trim();
    await slots.nth(1).click();
    await page.getByRole('button', { name: L.funnel.booking.bookFor.replace('{time}', chosen) }).click();
    await expect(page.locator('h1')).toHaveText(L.funnel.booking.done.title);
    const [booking] = await rest<{ status: string; starts_at: string }>('bookings', `lead_id=eq.${leadId}&select=status,starts_at`);
    expect(booking?.status).toBe('confirmed');

    // ---- 3. the offer, and into the portal without a password ---------------------------------------------------
    await page.locator('button.btn').last().click(); // "See my result"
    await expect(page).toHaveURL(new RegExp(`${L.prefix}/offer$`));
    await page.locator('button.btn.btn-primary').click(); // "Go to my portal"
    await expect(page).toHaveURL(new RegExp(`${L.prefix}/portal$`));
    expect(await leadByEmail(email)).toMatchObject({ stage: 'account', status: 'account_created' });

    // the portal greets her in her language and starts its tour once
    await expect(page.locator('html')).toHaveAttribute('lang', L.lang);
    await expect(page.getByRole('dialog', { name: L.portal.tour.label })).toBeVisible({ timeout: 15_000 });
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog', { name: L.portal.tour.label })).toBeHidden();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(L.portal.dashboard.headline.start);

    // ---- 4. the application (saved as the five sections are completed) ------------------------------------------
    const origin = new URL(BASE_URL).origin;
    const saved = await page.request.put('/api/portal/application', { headers: { origin }, data: { data: FULL_APPLICATION, currentSection: 4 } });
    expect(saved.status()).toBe(200);
    expect(await saved.json()).toMatchObject({ ok: true, complete: true });
    expect(await leadByEmail(email)).toMatchObject({ stage: 'application', status: 'application_incomplete' });

    // ---- 5. a record from the phone or the desk ------------------------------------------------------------------
    await page.goto(`${L.prefix}/portal/documents`);
    const slot = L.portal.documents.slots.birth_certificate.title;
    const upload = L.portal.documents.actions.upload;
    const [chooser] = await Promise.all([
      page.waitForEvent('filechooser'),
      page.getByRole('button', { name: new RegExp(`^${escapeRe(`${upload}: ${slot}`)}`) }).click(),
    ]);
    await chooser.setFiles({ name: 'Geburtsurkunde 1911.pdf', mimeType: 'application/pdf', buffer: tinyPdf('journey') });
    await expect(page.getByText('Geburtsurkunde 1911.pdf')).toBeVisible({ timeout: 30_000 });
    // "1 of 8 received" appears once the server has confirmed the stored file
    await expect(page.getByText(L.portal.documents.received.replace('{done}', '1').replace('{total}', '8'))).toBeVisible({ timeout: 30_000 });
    const objects = await storedObjects(leadId);
    expect(objects).toHaveLength(1);

    // ---- 6. submit: the firm takes over, the nurture sequence stops ---------------------------------------------
    await page.getByRole('button', { name: L.portal.documents.submit.button }).click();
    await page.waitForURL(new RegExp(`${L.prefix}/portal$`), { timeout: 30_000 });
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(L.portal.status.application_submitted);
    expect(await leadByEmail(email)).toMatchObject({ stage: 'review', status: 'application_submitted' });
    const afterSubmit = (await eventsOf(leadId)).map((e) => e.type);
    expect(afterSubmit).toEqual(expect.arrayContaining(['lead.created', 'booking.created', 'account.created', 'application.started', 'document.uploaded', 'application.submitted']));

    // ---- 7. the lawyer: sign in to the CRM, find the case, act ---------------------------------------------------
    const tag = `${L.locale}-${Date.now().toString(36)}`;
    const staff = staffEmail(tag);
    staffEmails.push(staff);
    await bootstrapStaff({ email: staff, fullName: 'Journey Lawyer', password: COMPLETE_STAFF_PASSWORD, role: 'admin' });
    const lawyer = await context(browser, { ...LOCALES[0], locale: 'en', prefix: '', tz: 'Asia/Jerusalem' });
    const crm = lawyer.page;
    await crm.goto('/sign-in?next=%2Fadmin');
    await crm.getByLabel(enAuth.signIn.email, { exact: true }).fill(staff);
    await crm.getByLabel(enAuth.signIn.password, { exact: true }).fill(COMPLETE_STAFF_PASSWORD);
    await crm.getByRole('button', { name: enAuth.signIn.submit }).click();
    await expect(crm).toHaveURL(/\/admin$/);

    await crm.goto(`/admin/leads/${leadId}`);
    await expect(crm.locator('h1')).toContainText(L.first);
    await expect(crm.locator('body')).toContainText(lead!.case_ref);
    await expect(crm.locator('[data-doc-type="birth_certificate"]')).toHaveAttribute('data-doc-status', 'received');
    await expect(crm.locator('[data-doc-type="marriage_certificates"]')).toBeVisible();

    // she is asked for another record, and the one she sent is sent back with a note
    await crm.locator('[data-doc-type="marriage_certificates"] [data-doc-action="request"]').click();
    await expect(crm.locator('[data-doc-type="marriage_certificates"]')).toHaveAttribute('data-doc-status', 'requested');
    await crm.locator('[data-doc-type="birth_certificate"] [data-doc-action="reject"]').click();
    const note = L.locale === 'he' ? 'הסריקה חתוכה בצד ימין. נא לצלם מחדש.' : 'The scan is cut off on the right. Please photograph it again.';
    await crm.locator('#reject-birth_certificate').fill(note);
    await crm.locator('[data-reject-confirm]').click();
    await expect(crm.locator('[data-doc-type="birth_certificate"]')).toHaveAttribute('data-doc-status', 'reupload');

    // and the status she sees is set
    await crm.locator('[data-status-option="info_required"]').click();
    await expect(crm.locator('[data-status-option="info_required"]')).toHaveAttribute('aria-pressed', 'true');
    await expect.poll(async () => (await leadByEmail(email))?.status).toBe('info_required');

    // ---- 8. the applicant, in her own browser, sees what the lawyer did -----------------------------------------
    await page.goto(`${L.prefix}/portal`);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(L.portal.status.info_required);
    await page.goto(`${L.prefix}/portal/documents`);
    await expect(page.getByText(note)).toBeVisible();
    const requested = page.locator('[data-doc-row]', { hasText: L.portal.documents.slots.marriage_certificates.title });
    await expect(requested).toContainText(L.portal.documents.tags.requested);

    // ---- 9. what the journey left in the outbox: every email that had to go out went, once --------------------
    // (the nurture sequence ends by itself at the next scheduler run for a lead that has submitted: drip.test.ts)
    const templates = (await eventsOf(leadId))
      .filter((e) => e.type === 'email.send')
      .map((e) => (e.payload as { template?: string }).template)
      .filter(Boolean) as string[];
    for (const t of ['welcome-1', 'booking-confirmation', 'application-received', 'document-requested', 'document-rejected', 'status-update']) {
      expect(templates, `email ${t} queued`).toContain(t);
      expect(templates.filter((x) => x === t).length, `email ${t} queued once`).toBe(1);
    }
    // ---- clean up what storage holds (rows go with the lead) ----------------------------------------------------
    for (const path of await storedObjects(leadId)) {
      await fetch(`${SUPABASE_URL}/storage/v1/object/documents/${path}`, { method: 'DELETE', headers: { apikey: SERVICE_KEY, authorization: `Bearer ${SERVICE_KEY}` } });
    }
    expect(visitor.problems).toEqual([]);
    expect(lawyer.problems).toEqual([]);
    await visitor.ctx.close();
    await lawyer.ctx.close();
  });
}
