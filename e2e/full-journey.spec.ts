import { test } from '@playwright/test';
import enAuth from '../apps/campaign/messages/en/auth.json';
import enPortal from '../apps/campaign/messages/en/portal.json';
import heAuth from '../apps/campaign/messages/he/auth.json';
import hePortal from '../apps/campaign/messages/he/portal.json';
import enFunnel from '../apps/main/messages/en/funnel.json';
import heFunnel from '../apps/main/messages/he/funnel.json';
import { bootstrapStaff, deleteUserByEmail } from '../scripts/bootstrap-admin';
import { FULL_APPLICATION, storedObjects, tinyPdf } from './portal.helpers';
import { SERVICE_KEY, SUPABASE_URL, campaignIsBilingual, cleanup, eventsOf, funnelIsBilingual, leadByEmail, newEmail, rest, type EventRecord } from './support/funnel';
import {
  EN,
  FIRM_URL,
  HE,
  PORTAL_URL,
  answerSixQuestions,
  applyPath,
  bookACall,
  escapeRe,
  expect,
  leaveDetails,
  onFirm,
  onPortal,
  originOf,
  person,
  seeResultAndEnterPortal,
  urlIs,
  type StoryLocale,
} from './support/journey';

/**
 * The customer journey as the firm defined it (Lead Flow, ARCHITECTURE section 10), from the first click on the firm's
 * website to the lawyer's decision, checked at every step in all three places a lead lives:
 *   - the database (leads: stage, status, source, utm; bookings; documents; the activity log),
 *   - the outbox (the CRM events and the emails, each once, in the right order, none left that must not go),
 *   - the two screens people use (the CRM for the team, the portal for the applicant).
 * Two sites take part: the firm's site (its pages, the eligibility funnel under /apply, the lead and booking APIs) and the
 * portal (sign-in, the portal, the CRM). One run in English and one in Hebrew (RTL).
 *
 *   CAMPAIGN_URL=http://localhost:3001 MAIN_URL=http://localhost:3000 pnpm exec playwright test e2e/full-journey.spec.ts
 */
test.describe.configure({ mode: 'serial' });
test.setTimeout(300_000);

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

const STORIES = [
  { ...EN, funnel: enFunnel, portal: enPortal, auth: enAuth },
  { ...HE, funnel: heFunnel, portal: hePortal, auth: heAuth },
];

const templatesOf = (events: EventRecord[]) =>
  events.filter((e) => e.type === 'email.send').map((e) => (e.payload as { template?: string }).template ?? '?');
const types = (events: EventRecord[]) => events.filter((e) => e.type !== 'email.send').map((e) => e.type);
const rank = (list: string[], item: string) => list.indexOf(item);

/** The Hebrew edition needs both sites built bilingual (NEXT_PUBLIC_CAMPAIGN_LOCALES=en,he); the English one runs anywhere. */
async function skipUnlessLanguage(L: StoryLocale): Promise<void> {
  if (L.locale === 'en') return;
  test.skip(!(await funnelIsBilingual()) || !(await campaignIsBilingual()), 'the Hebrew edition is switched off in this build (NEXT_PUBLIC_CAMPAIGN_LOCALES): see english-only.spec.ts');
}

for (const L of STORIES) {
  test(`${L.locale}: firm website -> /apply funnel -> portal -> CRM, every step accounted for`, async ({ browser }) => {
    await skipUnlessLanguage(L);
    const email = newEmail(`full-${L.locale}`);
    const v = await person(browser, L);
    const page = v.page;
    const origin = originOf(PORTAL_URL);

    // ---- 1. the firm's website: an ad click lands on a page, the visitor opens the eligibility check ------------------
    await page.goto(onFirm(`${L.prefix}/services/german-citizenship?utm_source=newsletter&utm_campaign=autumn`));
    await expect(page.locator('html')).toHaveAttribute('dir', L.dir);
    await page.waitForFunction(() => window.sessionStorage.getItem('dpl-attribution'));
    // the firm's own middleware keeps the ad as the first touch of this browser (the funnel is on the same site now)
    const cookies = Object.fromEntries((await v.ctx.cookies(FIRM_URL)).map((c) => [c.name, decodeURIComponent(c.value)]));
    expect(JSON.parse(cookies['dpl_utm'] ?? '{}')).toMatchObject({ utm_source: 'newsletter', utm_campaign: 'autumn' });
    // the button is an internal link of the firm's site (the funnel lives under /apply), not a link to the portal
    const cta = page.locator('a[href*="/eligibility"]').first();
    await expect(cta).toHaveAttribute('href', `${applyPath(L, '/eligibility')}?source=main-site`);
    await cta.click();
    await expect(page).toHaveURL(urlIs(FIRM_URL, applyPath(L, '/eligibility')));
    // the link names only the source: the ad is not repeated in the address, it stays in the firm's own first-touch cookie
    // (written by the middleware on the service page, first touch wins) and is read from there when the lead is created
    const arrived = new URL(page.url()).searchParams;
    expect(arrived.get('source')).toBe('main-site');
    expect(arrived.has('utm_source')).toBe(false);
    expect(arrived.has('utm_campaign')).toBe(false);
    const kept = Object.fromEntries((await v.ctx.cookies(FIRM_URL)).map((c) => [c.name, decodeURIComponent(c.value)]));
    expect(JSON.parse(kept['dpl_utm'] ?? '{}'), 'the ad is still the first touch after the click').toMatchObject({ utm_source: 'newsletter', utm_campaign: 'autumn' });
    expect(kept['dpl_src']).toBe('main-site');
    await expect(page.locator('html')).toHaveAttribute('dir', L.dir);

    // ---- 2. six questions, then the details ------------------------------------------------------------------------
    await answerSixQuestions(page, FIRM_URL, L);
    await leaveDetails(page, FIRM_URL, L, { name: L.name, email });

    const lead = await leadByEmail(email);
    expect(lead, 'the lead exists').toBeTruthy();
    const leadId = lead!.id;
    // Lead Flow step 1: an enquiry, attributed to the ad that brought the visitor to the firm's site. The first touch wins:
    // the ad named no source and the page is one of the firm's own, so the label is "main-site" (on the landing pages under
    // /apply the same ad would be the campaign's "campaign-ger-aus"); the ad itself (utm_*) is on the file
    expect(lead).toMatchObject({ locale: L.locale, stage: 'lead', status: 'enquiry', source: 'main-site', route: expect.any(String) });
    expect(lead!.utm).toMatchObject({ utm_source: 'newsletter', utm_campaign: 'autumn' });
    expect(lead!.case_ref).toMatch(/^DPL-\d{2}-\d{4}$/);
    expect(Object.keys(lead!.answers ?? {}).length, 'the six answers are on the file').toBe(6);
    let ledger = await eventsOf(leadId);
    expect(types(ledger)).toEqual(['lead.created']);
    expect(templatesOf(ledger)).toEqual(['welcome-1']);
    expect(ledger.find((e) => e.type === 'lead.created')?.payload).toMatchObject({ lead: { caseRef: lead!.case_ref, source: lead!.source }, utm: { utm_source: 'newsletter' } });
    expect(ledger.find((e) => e.type === 'email.send')?.payload).toMatchObject({ to: { email }, locale: L.locale, category: 'nurture' });

    // ---- 3. the call ------------------------------------------------------------------------------------------------
    await bookACall(page, L.funnel.booking);
    const [booking] = await rest<{ id: string; status: string; assigned_to: string | null }>('bookings', `lead_id=eq.${leadId}&select=id,status,assigned_to`);
    expect(booking?.status).toBe('confirmed');
    ledger = await eventsOf(leadId);
    expect(types(ledger)).toEqual(['lead.created', 'booking.created']);
    expect(templatesOf(ledger)).toEqual(['welcome-1', 'booking-confirmation']);

    // ---- 4. the result, and across to the portal without a password (Lead Flow: account created) --------------------
    await seeResultAndEnterPortal(page, FIRM_URL, L, L.funnel);
    expect(await leadByEmail(email)).toMatchObject({ stage: 'account', status: 'account_created' });
    expect(types(await eventsOf(leadId))).toContain('account.created');
    await page.keyboard.press('Escape');

    // ---- 5. the application, a record, the submission ----------------------------------------------------------------
    const saved = await page.request.put(onPortal('/api/portal/application'), { headers: { origin }, data: { data: FULL_APPLICATION, currentSection: 4 } });
    expect(saved.status()).toBe(200);
    expect(await leadByEmail(email)).toMatchObject({ stage: 'application', status: 'application_incomplete' });

    await page.goto(onPortal(`${L.prefix}/portal/documents`));
    const slot = L.portal.documents.slots.birth_certificate.title;
    const [chooser] = await Promise.all([
      page.waitForEvent('filechooser'),
      page.getByRole('button', { name: new RegExp(`^${escapeRe(`${L.portal.documents.actions.upload}: ${slot}`)}`) }).click(),
    ]);
    await chooser.setFiles({ name: 'Geburtsurkunde.pdf', mimeType: 'application/pdf', buffer: tinyPdf('full-journey') });
    await expect(page.getByText(L.portal.documents.received.replace('{done}', '1').replace('{total}', '8'))).toBeVisible({ timeout: 30_000 });
    await page.getByRole('button', { name: L.portal.documents.submit.button }).click();
    await page.waitForURL(urlIs(PORTAL_URL, `${L.prefix}/portal`), { timeout: 30_000 });
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
    const contactApi = await page.context().request.post(onFirm('/api/contact'), {
      headers: { origin: originOf(FIRM_URL) },
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
    const lawyer = await person(browser, { locale: 'en', tz: 'Asia/Jerusalem' });
    const crm = lawyer.page;
    await crm.goto(onPortal('/sign-in?next=%2Fadmin'));
    await crm.getByLabel(enAuth.signIn.email, { exact: true }).fill(staff);
    await crm.getByLabel(enAuth.signIn.password, { exact: true }).fill(PASSWORD);
    await crm.getByRole('button', { name: enAuth.signIn.submit }).click();
    await expect(crm).toHaveURL(urlIs(PORTAL_URL, '/admin'));

    await crm.goto(onPortal(`/admin?q=${encodeURIComponent(email)}`));
    await expect(crm.locator(`[data-lead-row="${leadId}"]`)).toBeVisible();
    await crm.goto(onPortal(`/admin?view=board&q=${encodeURIComponent(email)}`));
    await expect(crm.locator('[data-board-col="review"]').locator(`[data-lead-card="${leadId}"]`)).toBeVisible();

    await crm.goto(onPortal(`/admin/leads/${leadId}`));
    await expect(crm.locator('body')).toContainText(lead!.case_ref);
    // where the lead came from: the source label and the ad before it
    await expect(crm.locator('[data-lead-origin]')).toContainText(lead!.source);
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
    await crm.goto(onPortal('/admin/inbox'));
    const inboxItem = crm.locator(`[data-inbox-item="${submission!.id}"]`);
    await expect(inboxItem).toBeVisible();
    await expect(inboxItem.locator('[data-inbox-lead]')).toContainText(lead!.case_ref);

    // ---- 8. back in the applicant's browser: exactly what the team did ----------------------------------------------
    await page.goto(onPortal(`${L.prefix}/portal`));
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(L.portal.status.info_required);
    await page.goto(onPortal(`${L.prefix}/portal/documents`));
    await expect(page.locator('[data-doc-row]', { hasText: L.portal.documents.slots.marriage_certificates.title })).toContainText(L.portal.documents.tags.requested);

    // ---- 8b. steps 07 and 13: she sets a password and follows the case from a fresh browser --------------------------
    const pw = await page.request.post(onPortal('/api/auth/set-password'), { headers: { origin }, data: { password: 'Applicant-pass-1' } });
    expect(pw.status()).toBe(200);
    const returning = await person(browser, L);
    // she types the portal's own address: with no session that is its sign-in page (the portal has no landing page any more)
    await returning.page.goto(onPortal(L.prefix || '/'));
    await expect(returning.page).toHaveURL(urlIs(PORTAL_URL, `${L.prefix}/sign-in`));
    await returning.page.getByLabel(L.auth.signIn.email, { exact: true }).fill(email);
    await returning.page.getByLabel(L.auth.signIn.password, { exact: true }).fill('Applicant-pass-1');
    await returning.page.getByRole('button', { name: L.auth.signIn.submit }).click();
    await expect(returning.page).toHaveURL(urlIs(PORTAL_URL, `${L.prefix}/portal`));
    await expect(returning.page.getByRole('heading', { level: 1 })).toHaveText(L.portal.status.info_required);
    // signed in, the same bare address is the portal itself
    await returning.page.goto(onPortal(L.prefix || '/'));
    await expect(returning.page).toHaveURL(urlIs(PORTAL_URL, `${L.prefix}/portal`));
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

/**
 * A visitor who reaches the funnel from the firm's pages without any advertisement is the firm's own traffic: the lead is
 * attributed to the website ("main-site") and carries no campaign parameters.
 */
test('an organic visitor: from a service page of the firm to the funnel, the lead is attributed to the website', async ({ browser }) => {
  const email = newEmail('full-organic');
  const v = await person(browser, EN);
  const page = v.page;
  await page.goto(onFirm('/services/german-citizenship'));
  const cta = page.locator('a[href*="/eligibility"]').first();
  await expect(cta).toHaveAttribute('href', `${applyPath(EN, '/eligibility')}?source=main-site`);
  await cta.click();
  await expect(page).toHaveURL(urlIs(FIRM_URL, applyPath(EN, '/eligibility')));
  await answerSixQuestions(page, FIRM_URL, EN);
  await leaveDetails(page, FIRM_URL, EN, { name: EN.name, email });
  const lead = await leadByEmail(email);
  expect(lead).toMatchObject({ locale: 'en', stage: 'lead', status: 'enquiry', source: 'main-site' });
  expect(lead!.utm ?? {}).toEqual({});
  expect(v.problems).toEqual([]);
  await v.ctx.close();
});
