import { test } from '@playwright/test';
import enAuth from '../apps/campaign/messages/en/auth.json';
import enPortal from '../apps/campaign/messages/en/portal.json';
import hePortal from '../apps/campaign/messages/he/portal.json';
import enFunnel from '../apps/main/messages/en/funnel.json';
import enMore from '../apps/main/messages/en/landingMore.json';
import heFunnel from '../apps/main/messages/he/funnel.json';
import heMore from '../apps/main/messages/he/landingMore.json';
import { bootstrapStaff, deleteUserByEmail } from '../scripts/bootstrap-admin';
import { FULL_APPLICATION, storedObjects, tinyPdf } from './portal.helpers';
import { SERVICE_KEY, SUPABASE_URL, campaignIsBilingual, cleanup, eventsOf, funnelIsBilingual, leadByEmail, newEmail, rest } from './support/funnel';
import {
  EN,
  FIRM_URL,
  HE,
  PORTAL_URL,
  answerSixQuestions,
  applyPath,
  bookACall,
  cookieNames,
  escapeRe,
  expect,
  hasPortalSession,
  isolatedFirmUrl,
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
 * The whole product in one story, in English and in Hebrew (RTL), across the two sites: a visitor opens the landing page
 * on the firm's site (/apply), goes through the six questions, leaves her details, books a call and reads her result
 * there; "Go to my portal" takes her across to the portal, where she fills in the application, uploads a record and
 * submits; a lawyer signs in to the CRM, sees the case, asks for another record, rejects the one that was uploaded and
 * sets the status; and the applicant, back in her own browser, sees exactly that. Along the way the database and the
 * outbox are checked for what each step must leave behind.
 *
 * The visitor reaches the firm's site under a second host name (127.0.0.1 for localhost) so that, as in production, the
 * two sites do NOT share a cookie jar: the portal can only know what the hand-over carried across.
 *
 *   CAMPAIGN_URL=http://localhost:3001 MAIN_URL=http://localhost:3000 pnpm exec playwright test e2e/journey.spec.ts
 */
test.describe.configure({ mode: 'serial' });

const COMPLETE_STAFF_PASSWORD = 'Journey-staff-pass-1';
const staffEmail = (tag: string) => `e2e-funnel-journey-staff-${tag}@example.com`;
const staffEmails: string[] = [];

test.afterAll(async () => {
  for (const email of staffEmails) await deleteUserByEmail(email).catch(() => undefined);
  await cleanup();
});

/** The firm's site as this story reaches it: under its own host name when that is possible. */
const FIRM = isolatedFirmUrl() ?? FIRM_URL;
const ISOLATED = originOf(FIRM) !== originOf(FIRM_URL);

const STORIES = [
  { ...EN, funnel: enFunnel, portal: enPortal, more: enMore },
  { ...HE, funnel: heFunnel, portal: hePortal, more: heMore },
];

/** The Hebrew edition needs both sites built bilingual (NEXT_PUBLIC_CAMPAIGN_LOCALES=en,he); the English one runs anywhere. */
async function skipUnlessLanguage(L: StoryLocale): Promise<void> {
  if (L.locale === 'en') return;
  test.skip(!(await funnelIsBilingual()) || !(await campaignIsBilingual()), 'the Hebrew edition is switched off in this build (NEXT_PUBLIC_CAMPAIGN_LOCALES): see english-only.spec.ts');
}

for (const L of STORIES) {
  test(`${L.locale}: from the landing page to a reviewed case`, async ({ browser }) => {
    test.setTimeout(300_000);
    await skipUnlessLanguage(L);
    const email = newEmail(`journey-${L.locale}`);

    // ---- 1. the visitor: landing page on the firm's site, six questions, details ---------------------------------
    const visitor = await person(browser, L);
    const page = visitor.page;
    await page.goto(onFirm(applyPath(L), FIRM));
    await expect(page.locator('html')).toHaveAttribute('dir', L.dir);
    await expect(page.locator('html')).toHaveAttribute('lang', L.lang);
    await page.locator(`a[href$="${applyPath(L, '/eligibility')}"]`).first().click();
    await expect(page).toHaveURL(urlIs(FIRM, applyPath(L, '/eligibility')));

    await answerSixQuestions(page, FIRM, L);
    await leaveDetails(page, FIRM, L, { name: L.name, email });

    const lead = await leadByEmail(email);
    expect(lead, 'the lead exists').toBeTruthy();
    expect(lead).toMatchObject({ locale: L.locale, stage: 'lead', status: 'enquiry' });
    expect(lead!.case_ref).toMatch(/^DPL-\d{2}-\d{4}$/);
    const leadId = lead!.id;
    // the browser holds the lead on the firm's site (the cookie is set by the site that took the details), and the
    // portal has never heard of it: it knows nobody until the hand-over
    expect(await cookieNames(visitor.ctx, FIRM)).toContain('dpl_lead');
    if (ISOLATED) {
      expect(await cookieNames(visitor.ctx, PORTAL_URL)).not.toContain('dpl_lead');
      expect(await hasPortalSession(visitor.ctx)).toBe(false);
    }

    // ---- 2. booking: five days, a real slot, the confirmation ----------------------------------------------------
    await bookACall(page, L.funnel.booking);
    const [booking] = await rest<{ status: string; starts_at: string }>('bookings', `lead_id=eq.${leadId}&select=status,starts_at`);
    expect(booking?.status).toBe('confirmed');

    // ---- 3. the offer, and across to the portal without a password -----------------------------------------------
    await seeResultAndEnterPortal(page, FIRM, L, L.funnel);
    expect(await leadByEmail(email)).toMatchObject({ stage: 'account', status: 'account_created' });
    // the session was opened by the portal itself: only its own site holds it
    expect(await hasPortalSession(visitor.ctx)).toBe(true);
    if (ISOLATED) expect(await hasPortalSession(visitor.ctx, FIRM)).toBe(false);

    // the portal greets her in her language and starts its tour once
    await expect(page.locator('html')).toHaveAttribute('lang', L.lang);
    await expect(page.locator('html')).toHaveAttribute('dir', L.dir);
    await expect(page.getByRole('dialog', { name: L.portal.tour.label })).toBeVisible({ timeout: 15_000 });
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog', { name: L.portal.tour.label })).toBeHidden();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(L.portal.dashboard.headline.start);

    // ---- 4. the application (saved as the five sections are completed) ------------------------------------------
    const saved = await page.request.put(onPortal('/api/portal/application'), { headers: { origin: originOf(PORTAL_URL) }, data: { data: FULL_APPLICATION, currentSection: 4 } });
    expect(saved.status()).toBe(200);
    expect(await saved.json()).toMatchObject({ ok: true, complete: true });
    expect(await leadByEmail(email)).toMatchObject({ stage: 'application', status: 'application_incomplete' });

    // ---- 5. a record from the phone or the desk ------------------------------------------------------------------
    await page.goto(onPortal(`${L.prefix}/portal/documents`));
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
    await page.waitForURL(urlIs(PORTAL_URL, `${L.prefix}/portal`), { timeout: 30_000 });
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(L.portal.status.application_submitted);
    expect(await leadByEmail(email)).toMatchObject({ stage: 'review', status: 'application_submitted' });
    const afterSubmit = (await eventsOf(leadId)).map((e) => e.type);
    expect(afterSubmit).toEqual(expect.arrayContaining(['lead.created', 'booking.created', 'account.created', 'application.started', 'document.uploaded', 'application.submitted']));

    // ---- 7. the lawyer: sign in to the CRM, find the case, act ---------------------------------------------------
    const tag = `${L.locale}-${Date.now().toString(36)}`;
    const staff = staffEmail(tag);
    staffEmails.push(staff);
    await bootstrapStaff({ email: staff, fullName: 'Journey Lawyer', password: COMPLETE_STAFF_PASSWORD, role: 'admin' });
    const lawyer = await person(browser, { locale: 'en', tz: 'Asia/Jerusalem' });
    const crm = lawyer.page;
    await crm.goto(onPortal('/sign-in?next=%2Fadmin'));
    await crm.getByLabel(enAuth.signIn.email, { exact: true }).fill(staff);
    await crm.getByLabel(enAuth.signIn.password, { exact: true }).fill(COMPLETE_STAFF_PASSWORD);
    await crm.getByRole('button', { name: enAuth.signIn.submit }).click();
    await expect(crm).toHaveURL(urlIs(PORTAL_URL, '/admin'));

    await crm.goto(onPortal(`/admin/leads/${leadId}`));
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
    await page.goto(onPortal(`${L.prefix}/portal`));
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(L.portal.status.info_required);
    await page.goto(onPortal(`${L.prefix}/portal/documents`));
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

/**
 * The landing page's chat and the form are two ways into the same six questions (the answers are shared in the browser): the
 * visitor answers some of them in the chat, and carries on - in the form (English), or straight to the details when the
 * chat has asked everything (Hebrew). The lead that comes out has all six answers on its file.
 */
for (const [L, inChat] of [[STORIES[0]!, 3], [STORIES[1]!, 6]] as const) {
  test(`${L.locale}: the chat on the landing page answers ${inChat} of the six questions and the funnel carries on from there`, async ({ browser }) => {
    test.setTimeout(180_000);
    await skipUnlessLanguage(L);
    const email = newEmail(`journey-chat-${L.locale}`);
    const visitor = await person(browser, L);
    const page = visitor.page;
    await page.goto(onFirm(applyPath(L), FIRM));
    await page.locator('[data-chat-launcher]').click();
    const panel = page.locator('[data-chat-panel]');
    await expect(panel).toBeVisible();
    await panel.getByRole('button', { name: L.more.chat.start }).click();
    const progress = panel.getByRole('progressbar');
    for (let i = 0; i < inChat; i++) {
      // the questions appear after a moment of "typing"; the buttons of the open question are the only ones in the log
      await expect(progress).toHaveAttribute('aria-valuenow', String(Math.round((i / 6) * 100)));
      await panel.locator('[data-chat-log] button').nth(1).click();
    }
    await expect(progress).toHaveAttribute('aria-valuenow', String(Math.round((inChat / 6) * 100)));
    if (inChat < 6) {
      await panel.getByRole('link', { name: L.more.chat.continueForm }).click();
      await expect(page).toHaveURL(urlIs(FIRM, applyPath(L, '/eligibility')));
      // the form resumes at the first question the chat did not ask
      await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow', String(Math.round((inChat / 6) * 100)));
      await answerSixQuestions(page, FIRM, L, inChat);
    } else {
      await panel.getByRole('link', { name: L.more.chat.seeResult }).click();
      await expect(page).toHaveURL(urlIs(FIRM, applyPath(L, '/details')));
    }
    await leaveDetails(page, FIRM, L, { name: L.name, email });
    const lead = await leadByEmail(email);
    expect(lead).toMatchObject({ locale: L.locale, stage: 'lead', status: 'enquiry' });
    expect(Object.keys(lead!.answers ?? {}).length, 'the six answers, from the chat and from the form, are on the file').toBe(6);
    expect(visitor.problems).toEqual([]);
    await visitor.ctx.close();
  });
}

/**
 * An old advertisement still points at the campaign's former address (euro-passports.com/eligibility?...): it must land
 * on the funnel on the firm's site with the ad's attribution intact, and the lead that comes out of it carries that ad.
 */
test('an old campaign link (/eligibility?source=...&utm_...) leads into the funnel on the firm site and the lead keeps the ad', async ({ browser }) => {
  test.setTimeout(180_000);
  const email = newEmail('journey-oldlink');
  const visitor = await person(browser, EN);
  const page = visitor.page;
  // the redirect goes to the firm's canonical address (NEXT_PUBLIC_MAIN_SITE_URL), which is where the story continues
  await page.goto(onPortal('/eligibility?source=old-ad&utm_source=oldads&utm_campaign=2025'));
  await expect(page).toHaveURL(urlIs(FIRM_URL, applyPath(EN, '/eligibility')));
  expect(new URL(page.url()).searchParams.get('source')).toBe('old-ad');
  await answerSixQuestions(page, FIRM_URL, EN);
  await leaveDetails(page, FIRM_URL, EN, { name: EN.name, email });
  const lead = await leadByEmail(email);
  expect(lead).toMatchObject({ locale: 'en', stage: 'lead', source: 'old-ad' });
  expect(lead!.utm).toMatchObject({ utm_source: 'oldads', utm_campaign: '2025' });
  expect(visitor.problems).toEqual([]);
  await visitor.ctx.close();
});

/**
 * The landing page ("Track my application" in the header, "Sign in" in the footer) is on the firm's site, but the sign-in page
 * is on the portal's: both links are absolute links to the portal (campaignUrl(locale, 'sign-in'): the portal's origin, the
 * source, and in the bilingual build the language the page is in), so the href does not END in /sign-in.
 */
test('the sign-in links of the landing page lead to the portal\'s sign-in page', async ({ browser }) => {
  const visitor = await person(browser, EN);
  const page = visitor.page;
  await page.goto(onFirm(applyPath(EN), FIRM_URL));
  // (the links are built from the firm's own build setting)
  const bilingual = await funnelIsBilingual();
  for (const where of ['header', 'footer'] as const) {
    const link = page.locator(where === 'header' ? 'header nav a[href*="/sign-in"]' : 'footer a[href*="/sign-in"]').first();
    await link.scrollIntoViewIfNeeded();
    // an absolute link to the portal's sign-in (not a link of the firm's site), with where the visitor came from; the
    // English page passes its language on so that a visitor in Israel who chose English is not sent to the Hebrew edition
    await expect(link, where).toHaveAttribute('href', `${originOf(PORTAL_URL)}/sign-in?source=main-site${bilingual ? '&lang=en' : ''}`);
    await link.click();
    await expect(page).toHaveURL(urlIs(PORTAL_URL, '/sign-in'));
    expect(new URL(page.url()).searchParams.get('source'), where).toBe('main-site');
    await page.goto(onFirm(applyPath(EN), FIRM_URL));
  }
  expect(visitor.problems).toEqual([]);
  await visitor.ctx.close();
});
