import { expect as baseExpect, test, type Browser, type Page } from '@playwright/test';
import enAuth from '../apps/campaign/messages/en/auth.json';
import heAuth from '../apps/campaign/messages/he/auth.json';
import enFunnel from '../apps/campaign/messages/en/funnel.json';
import hePortal from '../apps/campaign/messages/he/portal.json';
import enPortal from '../apps/campaign/messages/en/portal.json';
import heFunnel from '../apps/campaign/messages/he/funnel.json';
import { bootstrapStaff, deleteUserByEmail } from '../scripts/bootstrap-admin';
import { FULL_APPLICATION, storedObjects, tinyPdf } from './portal.helpers';
import { BASE_URL, SERVICE_KEY, SUPABASE_URL, cleanup, eventsOf, leadByEmail, newEmail, newIp, rest, type EventRecord } from './support/funnel';

/**
 * The customer journey as the firm defined it (Lead Flow, ARCHITECTURE section 10), from the first click on the firm's
 * website to the lawyer's decision, checked at every step in all three places a lead lives:
 *   - the database (leads: stage, status, source, utm; bookings; documents; the activity log),
 *   - the outbox (the CRM events and the emails, each once, in the right order, none left that must not go),
 *   - the two screens people use (the CRM for the team, the portal for the applicant).
 * One run in English and one in Hebrew (RTL).
 *
 *   pnpm exec playwright test e2e/full-journey.spec.ts   (campaign on CAMPAIGN_URL, firm site on MAIN_URL)
 */
const MAIN = process.env.MAIN_URL ?? 'http://localhost:3000';
test.use({ baseURL: BASE_URL });
test.describe.configure({ mode: 'serial' });
test.setTimeout(300_000);
const expect = baseExpect.configure({ timeout: 20_000 });

const PASSWORD = 'Full-journey-pass-1';
const staffEmails: string[] = [];
const contactEmails: string[] = [];

test.afterAll(async () => {
  for (const email of staffEmails) await deleteUserByEmail(email).catch(() => undefined);
  for (const email of contactEmails) {
    const headers = { apikey: SERVICE_KEY, authorization: `Bearer ${SERVICE_KEY}` };
    await fetch(`${SUPABASE_URL}/rest/v1/events?payload->submission->>email=eq.${encodeURIComponent(email)}`, { method: 'DELETE', headers });
    await fetch(`${SUPABASE_URL}/rest/v1/contact_submissions?email=eq.${encodeURIComponent(email)}`, { method: 'DELETE', headers });
  }
  await cleanup();
});

const LOCALES = [
  { locale: 'en' as const, prefix: '', tz: 'America/New_York', funnel: enFunnel, portal: enPortal, auth: enAuth, name: 'anna reinhardt', dir: 'ltr' },
  { locale: 'he' as const, prefix: '/he', tz: 'Asia/Jerusalem', funnel: heFunnel, portal: hePortal, auth: heAuth, name: 'דנה כהן', dir: 'rtl' },
];

const options = (page: Page) => page.locator('[role=group] button[aria-pressed]');
const templatesOf = (events: EventRecord[]) =>
  events.filter((e) => e.type === 'email.send').map((e) => (e.payload as { template?: string }).template ?? '?');
const types = (events: EventRecord[]) => events.filter((e) => e.type !== 'email.send').map((e) => e.type);
const rank = (list: string[], item: string) => list.indexOf(item);

async function visitorContext(browser: Browser, tz: string, locale: 'en' | 'he') {
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    locale: locale === 'he' ? 'he-IL' : 'en-US',
    timezoneId: tz,
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

for (const L of LOCALES) {
  test(`${L.locale}: firm website -> campaign -> portal -> CRM, every step accounted for`, async ({ browser }) => {
    const email = newEmail(`full-${L.locale}`);
    const v = await visitorContext(browser, L.tz, L.locale);
    const page = v.page;

    // ---- 1. the firm's website: an ad click lands on a page, the visitor opens the eligibility check ------------------
    await page.goto(`${MAIN}${L.prefix}/?utm_source=newsletter&utm_campaign=autumn`);
    await expect(page.locator('html')).toHaveAttribute('dir', L.dir);
    await page.waitForFunction(() => window.sessionStorage.getItem('dpl-attribution'));
    const cta = page.locator('a[href*="/eligibility"]').first();
    await expect(cta).toHaveAttribute('href', /source=main-site/);
    await cta.click();
    // the campaign is another domain: it learns the source and the ad from the link
    await expect(page).toHaveURL(new RegExp(`${L.prefix}/eligibility\\?`));
    const cookies = Object.fromEntries((await v.ctx.cookies()).map((c) => [c.name, decodeURIComponent(c.value)]));
    expect(cookies['dpl_src']).toBe('main-site');
    expect(JSON.parse(cookies['dpl_utm'] ?? '{}')).toMatchObject({ utm_source: 'newsletter', utm_campaign: 'autumn' });

    // ---- 2. six questions, then the details ------------------------------------------------------------------------
    for (let i = 0; i < 6; i++) {
      const question = (await page.locator('h1').textContent()) ?? '';
      await options(page).nth(1).click();
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
    const leadId = lead!.id;
    // Lead Flow step 1: an enquiry, attributed to the website and to the ad that brought the visitor there
    expect(lead).toMatchObject({ locale: L.locale, stage: 'lead', status: 'enquiry', source: 'main-site', route: expect.any(String) });
    expect(lead!.utm).toMatchObject({ utm_source: 'newsletter', utm_campaign: 'autumn' });
    expect(lead!.case_ref).toMatch(/^DPL-\d{2}-\d{4}$/);
    expect(Object.keys(lead!.answers ?? {}).length, 'the six answers are on the file').toBe(6);
    let ledger = await eventsOf(leadId);
    expect(types(ledger)).toEqual(['lead.created']);
    expect(templatesOf(ledger)).toEqual(['welcome-1']);
    expect(ledger.find((e) => e.type === 'lead.created')?.payload).toMatchObject({ lead: { caseRef: lead!.case_ref, source: 'main-site' }, utm: { utm_source: 'newsletter' } });
    expect(ledger.find((e) => e.type === 'email.send')?.payload).toMatchObject({ to: { email }, locale: L.locale, category: 'nurture' });

    // ---- 3. the call ------------------------------------------------------------------------------------------------
    await page.locator('[aria-labelledby=book-day] button').nth(2).click();
    const slots = page.locator('[aria-labelledby=book-time] button');
    const chosen = ((await slots.nth(1).textContent()) ?? '').trim();
    await slots.nth(1).click();
    await page.getByRole('button', { name: L.funnel.booking.bookFor.replace('{time}', chosen) }).click();
    await expect(page.locator('h1')).toHaveText(L.funnel.booking.done.title);
    const [booking] = await rest<{ id: string; status: string; assigned_to: string | null }>('bookings', `lead_id=eq.${leadId}&select=id,status,assigned_to`);
    expect(booking?.status).toBe('confirmed');
    ledger = await eventsOf(leadId);
    expect(types(ledger)).toEqual(['lead.created', 'booking.created']);
    expect(templatesOf(ledger)).toEqual(['welcome-1', 'booking-confirmation']);

    // ---- 4. the result, and into the portal without a password (Lead Flow: account created) -------------------------
    await page.locator('button.btn').last().click();
    await expect(page).toHaveURL(new RegExp(`${L.prefix}/offer$`));
    await page.locator('button.btn.btn-primary').click();
    await expect(page).toHaveURL(new RegExp(`${L.prefix}/portal$`));
    expect(await leadByEmail(email)).toMatchObject({ stage: 'account', status: 'account_created' });
    expect(types(await eventsOf(leadId))).toContain('account.created');
    await page.keyboard.press('Escape');

    // ---- 5. the application, a record, the submission ----------------------------------------------------------------
    const origin = new URL(BASE_URL).origin;
    const saved = await page.request.put('/api/portal/application', { headers: { origin }, data: { data: FULL_APPLICATION, currentSection: 4 } });
    expect(saved.status()).toBe(200);
    expect(await leadByEmail(email)).toMatchObject({ stage: 'application', status: 'application_incomplete' });

    await page.goto(`${L.prefix}/portal/documents`);
    const slot = L.portal.documents.slots.birth_certificate.title;
    const [chooser] = await Promise.all([
      page.waitForEvent('filechooser'),
      page.getByRole('button', { name: new RegExp(`^${(`${L.portal.documents.actions.upload}: ${slot}`).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`) }).click(),
    ]);
    await chooser.setFiles({ name: 'Geburtsurkunde.pdf', mimeType: 'application/pdf', buffer: tinyPdf('full-journey') });
    await expect(page.getByText(L.portal.documents.received.replace('{done}', '1').replace('{total}', '8'))).toBeVisible({ timeout: 30_000 });
    await page.getByRole('button', { name: L.portal.documents.submit.button }).click();
    await page.waitForURL(new RegExp(`${L.prefix}/portal$`), { timeout: 30_000 });
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(L.portal.status.application_submitted);
    expect(await leadByEmail(email)).toMatchObject({ stage: 'review', status: 'application_submitted' });

    // the whole story so far, in order, with nothing missing and nothing twice
    ledger = await eventsOf(leadId);
    const order = types(ledger);
    expect(order).toEqual(['lead.created', 'booking.created', 'account.created', 'application.started', 'document.uploaded', 'application.submitted']);
    expect(templatesOf(ledger)).toEqual(['welcome-1', 'booking-confirmation', 'application-received']);
    // submitting ends the nurture sequence: no welcome email is still waiting to go out
    const waiting = ledger.filter((e) => e.type === 'email.send' && (e.payload as { category?: string }).category === 'nurture' && ['pending', 'failed'].includes(e.status));
    expect(waiting, 'no nurture email left pending after submission').toEqual([]);
    for (const e of ledger) expect(e.status === 'pending' || e.status === 'cancelled' || e.status === 'sent' || e.status === 'delivered', `event ${e.type} has a sane status (${e.status})`).toBe(true);

    // ---- 6. the firm's website receives a message from the same person; the CRM links it to the file ---------------------
    const contactApi = await page.context().request.post(`${MAIN}/api/contact`, {
      headers: { origin: MAIN, 'x-forwarded-for': newIp() },
      data: { kind: 'contact', name: L.name, email, phone: '+15550000000', locale: L.locale, consent: true, matter: 'Citizenship by descent', note: 'One more question about my grandmother.', page: `${L.prefix}/contact`, source: 'main-site' },
    });
    expect(contactApi.status()).toBe(201);
    contactEmails.push(email);
    const [submission] = await rest<{ id: string; kind: string }>('contact_submissions', `email=eq.${encodeURIComponent(email)}&select=id,kind`);
    expect(submission?.kind).toBe('contact');

    // ---- 7. the team: sign in, find the file in the list and on the board, read it, act -------------------------------
    const staff = `e2e-funnel-${Date.now().toString(36)}-full-${L.locale}-staff@example.com`;
    staffEmails.push(staff);
    await bootstrapStaff({ email: staff, fullName: 'Full Journey Lawyer', password: PASSWORD, role: 'admin' });
    const lawyer = await visitorContext(browser, 'Asia/Jerusalem', 'en');
    const crm = lawyer.page;
    await crm.goto('/sign-in?next=%2Fadmin');
    await crm.getByLabel(enAuth.signIn.email, { exact: true }).fill(staff);
    await crm.getByLabel(enAuth.signIn.password, { exact: true }).fill(PASSWORD);
    await crm.getByRole('button', { name: enAuth.signIn.submit }).click();
    await expect(crm).toHaveURL(/\/admin$/);

    await crm.goto(`/admin?q=${encodeURIComponent(email)}`);
    await expect(crm.locator(`[data-lead-row="${leadId}"]`)).toBeVisible();
    await crm.goto(`/admin?view=board&q=${encodeURIComponent(email)}`);
    await expect(crm.locator('[data-board-col="review"]').locator(`[data-lead-card="${leadId}"]`)).toBeVisible();

    await crm.goto(`/admin/leads/${leadId}`);
    await expect(crm.locator('body')).toContainText(lead!.case_ref);
    // where the lead came from: the website, and the ad before it
    await expect(crm.locator('[data-lead-origin]')).toContainText('main-site');
    await expect(crm.locator('[data-lead-origin]')).toContainText('source: newsletter');
    await expect(crm.locator('[data-lead-origin]')).toContainText('campaign: autumn');
    await expect(crm.locator('[data-doc-type="birth_certificate"]')).toHaveAttribute('data-doc-status', 'received');
    for (const code of ['lead_created', 'booking_created', 'account_created', 'application_started', 'application_submitted']) {
      await expect(crm.locator(`[data-activity="${code}"]`), `activity ${code}`).toHaveCount(1);
    }

    // the team notes, asks for another record, and sets the status the applicant sees
    await crm.locator('[data-note-input]').fill('Spoke to the applicant; the grandmother was born in Vienna.');
    await crm.locator('[data-note-add]').click();
    await expect(crm.locator('[data-notes-panel]')).toContainText('born in Vienna');
    await expect(crm.locator('[data-activity="note_added"]')).toHaveCount(1);
    await crm.locator('[data-doc-type="marriage_certificates"] [data-doc-action="request"]').click();
    await expect(crm.locator('[data-doc-type="marriage_certificates"]')).toHaveAttribute('data-doc-status', 'requested');
    await crm.locator('[data-status-option="info_required"]').click();
    await expect.poll(async () => (await leadByEmail(email))?.status).toBe('info_required');

    // the person's website message sits in the inbox, tied to this file
    await crm.goto('/admin/inbox');
    const inboxItem = crm.locator(`[data-inbox-item="${submission!.id}"]`);
    await expect(inboxItem).toBeVisible();
    await expect(inboxItem.locator('[data-inbox-lead]')).toContainText(lead!.case_ref);

    // ---- 8. back in the applicant's browser: exactly what the team did ----------------------------------------------
    await page.goto(`${L.prefix}/portal`);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(L.portal.status.info_required);
    await page.goto(`${L.prefix}/portal/documents`);
    await expect(page.locator('[data-doc-row]', { hasText: L.portal.documents.slots.marriage_certificates.title })).toContainText(L.portal.documents.tags.requested);

    // ---- 8b. steps 07 and 13: she sets a password and follows the case from a fresh browser --------------------------
    const pw = await page.request.post('/api/auth/set-password', { headers: { origin }, data: { password: 'Applicant-pass-1' } });
    expect(pw.status()).toBe(200);
    const returning = await visitorContext(browser, L.tz, L.locale);
    await returning.page.goto(`${L.prefix}/sign-in`);
    await returning.page.getByLabel(L.auth.signIn.email, { exact: true }).fill(email);
    await returning.page.getByLabel(L.auth.signIn.password, { exact: true }).fill('Applicant-pass-1');
    await returning.page.getByRole('button', { name: L.auth.signIn.submit }).click();
    await expect(returning.page).toHaveURL(new RegExp(`${L.prefix}/portal$`));
    await expect(returning.page.getByRole('heading', { level: 1 })).toHaveText(L.portal.status.info_required);
    // one person, one file: signing in with the password did not create a second lead
    expect(await rest('leads', `email=eq.${encodeURIComponent(email)}&select=id`)).toHaveLength(1);
    await returning.ctx.close();

    // ---- 9. the final ledger ------------------------------------------------------------------------------------------
    ledger = await eventsOf(leadId);
    const finalTypes = types(ledger);
    for (const t of ['lead.created', 'booking.created', 'account.created', 'application.started', 'document.uploaded', 'application.submitted', 'document.reviewed', 'status.changed']) {
      expect(finalTypes, `CRM event ${t}`).toContain(t);
    }
    expect(rank(finalTypes, 'lead.created')).toBeLessThan(rank(finalTypes, 'booking.created'));
    expect(rank(finalTypes, 'application.submitted')).toBeLessThan(rank(finalTypes, 'status.changed'));
    const mails = templatesOf(ledger);
    for (const t of ['welcome-1', 'booking-confirmation', 'application-received', 'document-requested', 'status-update']) {
      expect(mails.filter((x) => x === t), `email ${t} once`).toHaveLength(1);
    }
    // every email went to the applicant, in the applicant's language
    for (const e of ledger.filter((x) => x.type === 'email.send')) {
      expect(e.payload).toMatchObject({ to: { email }, locale: L.locale });
    }

    for (const path of await storedObjects(leadId)) {
      await fetch(`${SUPABASE_URL}/storage/v1/object/documents/${path}`, { method: 'DELETE', headers: { apikey: SERVICE_KEY, authorization: `Bearer ${SERVICE_KEY}` } });
    }
    expect(v.problems).toEqual([]);
    expect(lawyer.problems).toEqual([]);
    await v.ctx.close();
    await lawyer.ctx.close();
  });
}
