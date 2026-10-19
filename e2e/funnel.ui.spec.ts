import { expect as baseExpect, test, type Browser, type Page } from '@playwright/test';
import { BASE_URL, cleanup, createAuthUser, eventually, eventsOf, FUNNEL_URL, leadBody, leadByEmail, makeStaff, newEmail, rest, signAppToken } from './support/funnel';
import { applyPath, enterPortal, isolatedFunnelUrl, newVisitor, onFunnel, onPortal, originOf, prefixOf, type UiLocale } from './support/funnel-ui';

/**
 * Browser tests of the funnel screens: the six questions, the details form, the booking, the result and the
 * sign-in family, in English and Hebrew (RTL). The funnel pages (under /apply) and their APIs are on the firm's site
 * (FUNNEL_URL, apps/main); sign-in, set-password, unsubscribe, the portal and the CRM are on the portal's site
 * (BASE_URL, apps/campaign). Run against a dev or production server:
 *
 *   CAMPAIGN_URL=http://localhost:3001 MAIN_URL=http://localhost:3000 pnpm exec playwright test e2e/funnel.ui.spec.ts
 */
test.describe.configure({ mode: 'serial' });
test.setTimeout(120_000);
test.afterAll(cleanup);
/** Dev servers compile each route on first use: give assertions room. */
const expect = baseExpect.configure({ timeout: 20_000 });

/** A browser context with its own address (the API rate-limits per IP) and a fixed visitor time zone. */
const visitor = newVisitor;

const COMPLETE = { country: 'germany', relative: 'grandparent', when: 'before_1933', persecution: 'yes', records: 'one_or_two', residence: 'ca' };
const options = (page: Page) => page.locator('[role=group] button[aria-pressed]');
const heading = (page: Page) => page.locator('h1');
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** The exact address of a page on the funnel / portal site, as a pattern that ignores a trailing query. */
const urlOf = (site: string, path: string) => new RegExp(`^${escapeRe(site)}${escapeRe(path)}(\\?.*)?$`);

test('the whole English journey: six questions, details, booking, result, portal', async ({ browser }) => {
  const { context, page, problems } = await visitor(browser);
  await page.goto(onFunnel('/apply/eligibility'));

  // question 1: nothing selected, progress at 0, "Back to the site" on the left
  await expect(heading(page)).toHaveText('Which country is your family connection to?');
  await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0');
  await expect(page.getByText('5 questions left')).toBeVisible();
  await expect(page.getByRole('button', { name: '← Back to the site' })).toBeVisible();
  await expect(page.getByText('No payment · No obligation · Your answers stay private')).toBeVisible();

  // "I am not sure" is a normal answer: reassurance, progress moves, and the next question slides in on its own
  await options(page).nth(3).click();
  await expect(page.getByText('That is completely fine. Most families begin without the records.')).toBeVisible();
  await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '17');
  await expect(heading(page)).toHaveText('Who in your family left Germany or Austria?');

  // going back keeps the answer, and changing it replaces it
  await page.getByRole('button', { name: '← Previous' }).click();
  await expect(heading(page)).toHaveText('Which country is your family connection to?');
  await expect(options(page).nth(3)).toHaveAttribute('aria-pressed', 'true');
  await options(page).nth(0).click();
  await expect(heading(page)).toHaveText('Who in your family left Germany or Austria?');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('dpl-quiz-v1') ?? '{}'))).toEqual({ country: 'germany' });

  await options(page).nth(1).click(); // grandparent
  await expect(heading(page)).toHaveText('Roughly when did they leave?');
  await options(page).nth(0).click(); // before 1933
  await expect(heading(page)).toHaveText('Was their departure connected to persecution?');
  await expect(page.getByText('You are halfway through.')).toBeVisible();
  await options(page).nth(0).click();
  await expect(heading(page)).toHaveText('Which family records do you already have?');
  await options(page).nth(1).click();
  await expect(heading(page)).toHaveText('Where do you live today?');
  await expect(page.getByText('Last question')).toBeVisible();
  await expect(page.getByText("Last one, then we'll ask where to send your result.")).toBeVisible();
  // the result button exists only on the last question, and only once it is answered
  await expect(page.getByRole('button', { name: 'See my result' })).toBeHidden();
  await options(page).nth(1).click(); // Canada
  await expect(page).toHaveURL(urlOf(FUNNEL_URL, '/apply/details'));

  // details: errors only after the first attempt, name capitalised as typed
  await expect(heading(page)).toHaveText('Where should we send your result?');
  await expect(page.getByText('Please enter your first and last name.')).toBeHidden();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByText('Please enter your first and last name.')).toBeVisible();
  await expect(page.getByText('Please enter a valid email address.')).toBeVisible();
  await expect(page.getByText('Please enter a phone number so the lawyer can call you.')).toBeVisible();
  await page.getByLabel('Full name').fill('anna reinhardt');
  await expect(page.getByLabel('Full name')).toHaveValue('Anna Reinhardt');
  await page.getByLabel('Email').fill('anna.reinhardt');
  await expect(page.getByText('Please enter a valid email address.')).toBeVisible();
  const email = newEmail('journey');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Phone').fill('+1 555 000 0000');
  await expect(page.getByText('Please enter a valid email address.')).toBeHidden();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page).toHaveURL(urlOf(FUNNEL_URL, '/apply/booking'));

  // booking: five real days, slots in the visitor's zone, a confirmation
  await expect(heading(page)).toHaveText('Anna, choose a time for your free call.');
  const days = page.locator('[aria-labelledby=book-day] button');
  await expect(days).toHaveCount(5);
  await expect(page.getByText('Times are in your local time zone (America/New_York).')).toBeVisible();
  // the honest "N free calls left this week": the real number, whatever it is, and nothing when the week is over
  const left = ((await (await page.request.get(onFunnel('/api/availability'))).json()) as { seatsLeft: number }).seatsLeft;
  const leftLine = page.getByText(/free calls? left this week$/);
  if (left > 0) await expect(leftLine).toHaveText(left === 1 ? 'One free call left this week' : `${left} free calls left this week`);
  else await expect(leftLine).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Choose a time above' })).toBeDisabled();
  await days.nth(3).click();
  const slots = page.locator('[aria-labelledby=book-time] button');
  await expect(slots.first()).toHaveText(/^\d{1,2}:\d{2} (am|pm)/);
  const chosen = ((await slots.nth(1).textContent()) ?? '').trim();
  await slots.nth(1).click();
  await expect(page.getByRole('button', { name: `Book my call for ${chosen}` })).toBeEnabled();
  await page.getByRole('button', { name: `Book my call for ${chosen}` }).click();
  await expect(heading(page)).toHaveText('Your call is booked.');
  await expect(page.getByText('We will call +1 555 000 0000 and ask for Anna.')).toBeVisible();
  await expect(page.locator('[data-confetti] i')).toHaveCount(46);
  await expect(page.getByText(`We have sent the details to`, { exact: false })).toContainText(email);
  expect((await rest('bookings', `lead_id=eq.${(await leadByEmail(email))!.id}&select=status`)).length).toBe(1);

  await page.getByRole('button', { name: 'See my result' }).click();
  await expect(page).toHaveURL(urlOf(FUNNEL_URL, '/apply/offer'));

  // result: personalised, with the booking, the placeholder disclaimers and the answers panel
  await expect(heading(page)).toHaveText('Anna, you may have a claim to German citizenship.');
  await expect(page.getByText("What decides it now is your grandparent's paperwork.")).toBeVisible();
  await expect(page.getByText(/Your free call is booked for \w{3} \w{3} \d+ at \d{1,2}:\d{2} (am|pm)\./)).toBeVisible();
  await expect(page.getByText('Up to 30% off our fee')).toBeVisible();
  await expect(page.getByText('Marketing placeholder, pending legal approval. Replace before launch.')).toBeVisible();
  await expect(page.getByText('Not a legal assessment. Eligibility and the granting of citizenship are not guaranteed.')).toBeVisible();
  await page.getByRole('button', { name: 'Review the answers I gave' }).click();
  await expect(page.getByText('Germany', { exact: true })).toBeVisible();
  await expect(page.getByText('Grandparent', { exact: true })).toBeVisible();
  await expect(page.getByText('Before 1933', { exact: true })).toBeVisible();
  await expect(page.getByText('One or two', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Hide my answers' }).click();
  await expect(page.getByText('Grandparent', { exact: true })).toBeHidden();

  await page.getByRole('button', { name: 'Email me my result instead' }).click();
  await expect(page.getByText(`Sent to ${email}.`, { exact: false })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Email me my result instead' })).toBeHidden();
  expect((await leadByEmail(email))?.result_emailed_at).toBeTruthy();

  // "Go to my portal" hands the browser over to the portal's own site, which opens the real session there
  await page.getByRole('button', { name: 'Go to my portal' }).click();
  await expect(page).toHaveURL(urlOf(BASE_URL, '/portal'));
  expect(originOf(page.url())).toBe(originOf(BASE_URL));
  expect((await context.cookies(BASE_URL)).some((c) => /^sb-.*-auth-token/.test(c.name))).toBe(true);
  expect((await leadByEmail(email))?.stage).toBe('account');
  expect(problems).toEqual([]);
  await context.close();
});

test('Hebrew: the funnel is right-to-left, translated, and the Hebrew path is kept', async ({ browser }) => {
  const { context, page, problems } = await visitor(browser, { locale: 'he', answers: COMPLETE, timezone: 'Asia/Jerusalem' });
  await page.goto(onFunnel('/he/apply/eligibility'));
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.locator('html')).toHaveAttribute('lang', 'he');
  await expect(heading(page)).toHaveText('היכן אתם גרים כיום?');
  await expect(page.getByText('שאלה אחרונה')).toBeVisible();
  await expect(page.getByRole('button', { name: 'לתוצאה שלי' })).toBeVisible();
  await page.getByRole('button', { name: 'לתוצאה שלי' }).click();
  await expect(page).toHaveURL(urlOf(FUNNEL_URL, '/he/apply/details'));

  await expect(heading(page)).toHaveText('לאן לשלוח את התוצאה?');
  await page.getByLabel('שם מלא').fill('מיכל כהן');
  await page.getByLabel('אימייל').fill(newEmail('he'));
  await page.getByLabel('טלפון').fill('052-123-4567');
  expect(await page.getByLabel('אימייל').getAttribute('dir')).toBe('ltr');
  await page.getByRole('button', { name: 'המשך' }).click();
  await expect(page).toHaveURL(urlOf(FUNNEL_URL, '/he/apply/booking'));

  await expect(heading(page)).toHaveText('מיכל, בחרו מועד לשיחת הייעוץ החינמית שלכם.');
  await page.locator('[aria-labelledby=book-time] button').first().waitFor();
  await expect(page.locator('[aria-labelledby=book-time] button').first()).toHaveText(/^\d{2}:\d{2}/);
  await page.locator('[aria-labelledby=book-time] button').nth(0).click();
  await page.getByRole('button', { name: /^לקבוע את השיחה ל-\d{2}:\d{2}$/ }).click();
  await expect(heading(page)).toHaveText('השיחה שלכם נקבעה.');
  await page.getByRole('button', { name: 'לתוצאה שלי' }).click();
  await expect(page).toHaveURL(urlOf(FUNNEL_URL, '/he/apply/offer'));
  await expect(heading(page)).toHaveText('מיכל, ייתכן שיש לכם זכאות לאזרחות גרמנית.');
  await expect(page.getByText('מה שמכריע עכשיו הם המסמכים של הסבא או הסבתא שלכם.')).toBeVisible();
  await expect(page.getByText('זו אינה חוות דעת משפטית. הזכאות והענקת האזרחות אינן מובטחות.')).toBeVisible();
  // the hand-over to the portal keeps the language: /he/enter/<token> on the portal's site, then the Hebrew portal
  await page.getByRole('button', { name: 'לפורטל שלי' }).click();
  await expect(page).toHaveURL(urlOf(BASE_URL, '/he/portal'));
  expect(problems).toEqual([]);
  await context.close();
});

test('"Back to the site" on the first question leaves to the landing page, or to the firm\'s homepage for a visit that came from there', async ({ browser }) => {
  const plain = await visitor(browser);
  await plain.page.goto(onFunnel('/apply/eligibility'));
  await plain.page.getByRole('button', { name: '← Back to the site' }).click();
  await expect(plain.page).toHaveURL(urlOf(FUNNEL_URL, '/apply'));
  await plain.context.close();

  // a visit that arrived from the firm's own website (dpl_from=main-site, written by the middleware from ?source=) goes home
  const fromSite = await visitor(browser);
  await fromSite.page.goto(onFunnel('/apply/eligibility?source=main-site'));
  await fromSite.page.getByRole('button', { name: '← Back to the site' }).click();
  await expect(fromSite.page).toHaveURL(urlOf(FUNNEL_URL, '/'));
  await fromSite.context.close();
});

test('a known email from another browser shows the inbox state and changes nothing', async ({ browser }) => {
  const owner = await visitor(browser);
  const email = newEmail('ui-existing');
  const created = await owner.context.request.post(onFunnel('/api/leads'), { data: leadBody(email) });
  expect(created.status()).toBe(201);
  const before = await leadByEmail(email);

  const { context, page, problems } = await visitor(browser, { answers: COMPLETE });
  await page.goto(onFunnel('/apply/details'));
  await page.getByLabel('Full name').fill('Someone Else');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Phone').fill('+49 30 1234567');
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(heading(page)).toHaveText('Check your inbox.');
  await expect(page.getByText('There is already a file open for')).toContainText(email);
  await expect(page).toHaveURL(urlOf(FUNNEL_URL, '/apply/details'));
  expect(await leadByEmail(email)).toEqual(before);
  // the owner of the address was told, by email, how to get back in (that is all that happens)
  const lead = (await leadByEmail(email))!;
  await eventually(async () => (await eventsOf(lead.id)).find((e) => e.payload.template === 'file-open'), 'the "your file is open" email');

  await page.getByRole('button', { name: 'Use a different email' }).click();
  await expect(heading(page)).toHaveText('Where should we send your result?');
  expect(problems).toEqual([]);
  await context.close();
  await owner.context.close();
});

/**
 * The funnel lives on the firm's site, so "Send the link again" (LeadForm.tsx, sendAgain(): a relative `api('/api/auth/link')`)
 * needs the firm's own POST /api/auth/link (the portal has one of its own for its expired-link page); the route's unit of
 * behaviour is in lead-handover.spec.ts. Here the whole button is exercised.
 */
test('"Send the link again" on the inbox state emails the owner of the address a new link and says so', async ({ browser }) => {
  const owner = await visitor(browser);
  const email = newEmail('ui-resend');
  expect((await owner.context.request.post(onFunnel('/api/leads'), { data: leadBody(email) })).status()).toBe(201);
  const lead = (await leadByEmail(email))!;
  const { context, page, problems } = await visitor(browser, { answers: COMPLETE });
  await page.goto(onFunnel('/apply/details'));
  await page.getByLabel('Full name').fill('Someone Else');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Phone').fill('+49 30 1234567');
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(heading(page)).toHaveText('Check your inbox.');
  await page.getByRole('button', { name: 'Send the link again' }).click();
  await expect(page.getByText('We sent it again.')).toBeVisible();
  await eventually(async () => (await eventsOf(lead.id)).find((e) => e.dedupe_key?.startsWith(`file-open:resend:${lead.id}`)), 'the new link email');
  expect(problems).toEqual([]);
  await context.close();
  await owner.context.close();
});

test('direct visits go where they can continue: no answers -> questions, no lead -> details', async ({ browser }) => {
  // nothing answered yet: every later step sends the visitor back to the questions
  const fresh = await visitor(browser);
  await fresh.page.goto(onFunnel('/apply/details'));
  await expect(fresh.page).toHaveURL(urlOf(FUNNEL_URL, '/apply/eligibility'));
  await fresh.context.close();

  // questions answered but no lead yet: booking and the offer need the details first
  const answered = await visitor(browser, { answers: COMPLETE });
  await answered.page.goto(onFunnel('/apply/booking'));
  await expect(answered.page).toHaveURL(urlOf(FUNNEL_URL, '/apply/details'));
  await answered.page.goto(onFunnel('/apply/offer'));
  await expect(answered.page).toHaveURL(urlOf(FUNNEL_URL, '/apply/details'));
  await answered.context.close();
});

test('Back from the booking returns to the details form with the lead filled in (and the address can be corrected)', async ({ browser }) => {
  const { context, page } = await visitor(browser, { answers: COMPLETE });
  await page.goto(onFunnel('/apply/details'));
  await page.getByLabel('Full name').fill('Dana Back');
  await page.getByLabel('Email').fill(newEmail('back'));
  await page.getByLabel('Phone').fill('+1 555 000 0042');
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page).toHaveURL(urlOf(FUNNEL_URL, '/apply/booking'));
  await page.goBack();
  await expect(page).toHaveURL(urlOf(FUNNEL_URL, '/apply/details'));
  await expect(page.getByLabel('Full name')).toHaveValue('Dana Back');
  await context.close();
});

test('the quiz resumes at the first unanswered question (shared with the landing chat)', async ({ browser }) => {
  const { context, page } = await visitor(browser, { answers: { country: 'austria', relative: 'parent' } });
  await page.goto(onFunnel('/apply/eligibility'));
  await expect(heading(page)).toHaveText('Roughly when did they leave?');
  await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '33');
  await context.close();
});

test('no answers are left in the browser once the details are saved; the quiz resumes from the file', async ({ browser }) => {
  // (no init script here: it would put the answers back on every page load and hide what this test is about)
  const { context, page, problems } = await visitor(browser);
  await page.goto(onFunnel('/apply/eligibility'));
  await page.evaluate((a) => localStorage.setItem('dpl-quiz-v1', JSON.stringify(a)), COMPLETE);
  await page.goto(onFunnel('/apply/details'));
  const email = newEmail('draft');
  await page.getByLabel('Full name').fill('anna reinhardt');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Phone').fill('+1 555 000 0000');
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page).toHaveURL(urlOf(FUNNEL_URL, '/apply/booking'));
  // the answers are on the file; the next person at this computer finds nothing about this one
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('dpl-quiz-v1') ?? '{}'))).toEqual({});
  expect(await page.evaluate(() => localStorage.getItem('dpl-lead-draft-v1'))).toBeNull();
  expect((await leadByEmail(email))?.answers).toMatchObject({ country: 'germany', residence: 'ca' });

  // back at the questions the lead's own answers are there (read from the file), and a change is saved to it
  await page.goto(onFunnel('/apply/eligibility'));
  await expect(heading(page)).toHaveText('Where do you live today?');
  await expect(options(page).nth(1)).toHaveAttribute('aria-pressed', 'true'); // Canada, from the file
  await options(page).nth(0).click();
  await expect.poll(async () => (await leadByEmail(email))?.answers['residence'], { timeout: 15_000 }).not.toBe('ca');
  expect(problems).toEqual([]);
  await context.close();
});

test('signing out of the portal ends the session and returns to sign-in, in the person\'s language, by way of the firm\'s site; the portal asks for a sign-in again', async ({ browser }) => {
  for (const locale of ['en', 'he'] as const) {
    const { context, page, problems } = await visitor(browser, { locale });
    const email = newEmail(`ui-signout-${locale}`);
    expect((await context.request.post(onFunnel('/api/leads'), { data: leadBody(email, { locale }) })).status()).toBe(201);
    await enterPortal(context.request);
    await page.goto(onPortal(`${prefixOf(locale)}/portal`));
    // the button signs out on the portal and then takes the browser through the firm's /api/lead/forget (which clears the
    // firm's own lead cookie) on to the portal's sign-in page
    const forget = page.waitForResponse((r) => new URL(r.url()).pathname === '/api/lead/forget');
    await page.getByRole('button', { name: locale === 'he' ? 'התנתקות' : 'Sign out' }).click();
    const hop = await forget;
    expect(hop.url(), 'the browser passes through the firm\'s site, saying which language it was reading').toBe(`${originOf(FUNNEL_URL)}/api/lead/forget?l=${locale}`);
    expect(hop.status()).toBe(303);
    // the final address is the portal's sign-in page in the language the person was reading (it has no landing page of its own any more)
    await page.waitForURL((url) => url.origin === originOf(BASE_URL) && url.pathname === `${prefixOf(locale)}/sign-in`);
    await expect(page.locator('html')).toHaveAttribute('lang', locale);
    await expect(page.locator('html')).toHaveAttribute('dir', locale === 'he' ? 'rtl' : 'ltr');
    expect((await context.cookies(BASE_URL)).some((c) => /^sb-.*-auth-token/.test(c.name))).toBe(false);
    expect((await context.cookies(FUNNEL_URL)).some((c) => c.name === 'dpl_lead' && c.value !== ''), 'no lead cookie is left behind').toBe(false);
    await page.goto(onPortal(`${prefixOf(locale)}/portal`));
    await expect(page).toHaveURL(new RegExp(`${escapeRe(`${prefixOf(locale)}/sign-in`)}\\?next=`));
    expect(problems).toEqual([]);
    await context.close();
  }
});

/**
 * Shared computer: the lead cookie (dpl_lead) belongs to the FIRM's site, which the portal cannot reach, so "Sign out" on the
 * portal sends the browser through the firm's GET /api/lead/forget before it lands on the portal's sign-in page. Without that
 * hop the firm's site would keep answering POST /api/portal/enter and "Go to my portal" on /apply/offer would sign the next
 * person at the computer in as the previous applicant, no password asked. On localhost the two sites share one cookie jar (the
 * firm's site cannot be put under another host name here: the sign-out link names the configured firm origin), so this test walks
 * the real browser chain and checks its result; the separate-jar proof of the same rule is in lead-handover.spec.ts.
 */
test('after signing out of the portal, "Go to my portal" on the firm\'s site no longer lets the same browser straight back in', async ({ browser }) => {
  const { context, page, problems } = await visitor(browser);
  const email = newEmail('ui-signout-shared');
  expect((await context.request.post(onFunnel('/api/leads'), { data: leadBody(email) })).status()).toBe(201);
  await page.goto(onFunnel('/apply/offer'));
  await page.getByRole('button', { name: 'Go to my portal' }).click();
  await expect(page).toHaveURL(urlOf(BASE_URL, '/portal'));
  const forget = page.waitForResponse((r) => new URL(r.url()).pathname === '/api/lead/forget');
  await page.getByRole('button', { name: 'Sign out' }).click();
  expect((await forget).status()).toBe(303);
  await page.waitForURL(urlOf(BASE_URL, '/sign-in'));
  // the next person at this computer opens the firm's site: the previous applicant's file must not open for them
  expect((await context.request.post(onFunnel('/api/portal/enter'))).status()).toBe(401);
  await page.goto(onFunnel('/apply/offer'));
  await expect(page).not.toHaveURL(urlOf(FUNNEL_URL, '/apply/offer'));
  expect(problems).toEqual([]);
  await context.close();
});

test('"Go to my portal" works when the two sites share no cookies (as in production), and carries only the entry token across', async ({ browser }) => {
  const funnel = isolatedFunnelUrl();
  test.skip(!funnel, 'needs the firm\'s site on localhost, to address it under a second host name');
  const { context, page, problems } = await visitor(browser);
  const email = newEmail('ui-isolated');
  expect((await context.request.post(`${funnel}/api/leads`, { data: leadBody(email) })).status()).toBe(201);
  // before the hand-over only the firm's site knows this browser
  expect((await context.cookies(BASE_URL)).map((c) => c.name)).not.toContain('dpl_lead');
  expect((await context.cookies(funnel!)).map((c) => c.name)).toContain('dpl_lead');

  await page.goto(`${funnel}/apply/offer`);
  await expect(heading(page)).toHaveText('Anna, you may have a claim to German citizenship.');
  await page.getByRole('button', { name: 'Go to my portal' }).click();
  await expect(page).toHaveURL(urlOf(BASE_URL, '/portal'));
  await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible();
  // the portal's session exists on the portal's site only; the firm's site did not get signed in
  expect((await context.cookies(BASE_URL)).some((c) => /^sb-.*-auth-token/.test(c.name))).toBe(true);
  expect((await context.cookies(funnel!)).some((c) => /^sb-.*-auth-token/.test(c.name))).toBe(false);
  expect((await leadByEmail(email))?.stage).toBe('account');
  expect(problems).toEqual([]);
  await context.close();
});

test('the entry address of "Go to my portal" is checked: garbage, expired, another purpose and a replaced session all land on sign-in', async ({ browser }) => {
  const owner = await visitor(browser);
  const email = newEmail('ui-enter');
  const created = await owner.context.request.post(onFunnel('/api/leads'), { data: leadBody(email) });
  const { leadId } = (await created.json()) as { leadId: string };
  const lead = (await leadByEmail(email))!;
  await owner.context.close();

  const bad = [
    ['garbage', 'garbage'],
    ['expired', signAppToken({ lid: leadId, ep: lead.session_epoch, p: 'enter' }, -60)],
    ['an emailed portal token', signAppToken({ lid: leadId, ep: lead.session_epoch, p: 'portal' }, 120)],
    ['a replaced session (older epoch)', signAppToken({ lid: leadId, ep: lead.session_epoch + 1, p: 'enter' }, 120)],
  ] as const;
  const { context, page, problems } = await visitor(browser);
  for (const [what, token] of bad) {
    await page.goto(onPortal(`/enter/${token}`));
    await expect(page, what).toHaveURL(urlOf(BASE_URL, '/sign-in'));
    expect(new URL(page.url()).searchParams.get('error'), what).toBe('link');
    expect(new URL(page.url()).searchParams.get('source'), what).toBe('main-site');
    await expect(page.locator('p[role=alert]'), what).toContainText('That link is no longer valid.');
    expect((await context.cookies(BASE_URL)).some((c) => /^sb-.*-auth-token/.test(c.name)), what).toBe(false);
  }
  // somebody who came from the firm's site gets a way back to it
  await expect(page.getByRole('link', { name: 'Back to site' })).toHaveAttribute('href', new RegExp(`^${escapeRe(FUNNEL_URL)}/?$`));
  // in Hebrew too (the language prefix is kept)
  await page.goto(onPortal('/he/enter/garbage'));
  await expect(page).toHaveURL(urlOf(BASE_URL, '/he/sign-in'));
  expect(problems).toEqual([]);
  await context.close();
  // a valid token still works, and does not sign anybody in until it is followed with a GET
  const other = await visitor(browser);
  expect((await other.context.request.post(onFunnel('/api/leads'), { data: leadBody(newEmail('ui-enter-ok')) })).status()).toBe(201);
  await enterPortal(other.context.request);
  await other.context.close();
});

test('an address that already has a sign-in account is not taken over by "Go to my portal": the portal explains and offers sign-in', async ({ browser }) => {
  const email = newEmail('ui-account');
  await createAuthUser(email, 'somebody-elses-pass-1');
  const { context, page, problems } = await visitor(browser);
  expect((await context.request.post(onFunnel('/api/leads'), { data: leadBody(email) })).status()).toBe(201);
  await page.goto(onFunnel('/apply/offer'));
  await page.getByRole('button', { name: 'Go to my portal' }).click();
  await expect(page).toHaveURL(urlOf(BASE_URL, '/sign-in'));
  expect(new URL(page.url()).searchParams.get('error')).toBe('accountExists');
  await expect(page.locator('p[role=alert]')).toContainText('This email address already has a sign-in account.');
  expect((await context.cookies(BASE_URL)).some((c) => /^sb-.*-auth-token/.test(c.name))).toBe(false);
  expect((await leadByEmail(email))?.user_id).toBeNull();
  expect(problems).toEqual([]);
  await context.close();
});

test('the portal\'s bare address is its sign-in (or the portal), and the old funnel addresses lead to the firm\'s /apply pages', async ({ browser }) => {
  const { context, page } = await visitor(browser);
  const request = context.request;
  // signed out: the root shows sign-in, in both languages
  await page.goto(onPortal('/'));
  await expect(page).toHaveURL(urlOf(BASE_URL, '/sign-in'));
  await expect(heading(page)).toHaveText('Follow your case.');
  await page.goto(onPortal('/he'));
  await expect(page).toHaveURL(urlOf(BASE_URL, '/he/sign-in'));

  // the pages that used to be here are permanent redirects to the firm's site, with the language prefix kept
  for (const sub of ['/eligibility', '/details', '/booking', '/offer', '/privacy']) {
    for (const locale of ['en', 'he'] as const) {
      const res = await request.get(onPortal(`${prefixOf(locale)}${sub}`), { maxRedirects: 0 });
      expect([301, 308], `${locale} ${sub}`).toContain(res.status());
      expect(res.headers()['location'], `${locale} ${sub}`).toBe(onFunnel(applyPath(locale, sub)));
    }
  }
  await page.goto(onPortal('/eligibility'));
  await expect(page).toHaveURL(urlOf(FUNNEL_URL, '/apply/eligibility'));
  await expect(heading(page)).toHaveText('Which country is your family connection to?');
  // a deep link that names the funnel goes to the landing page on the firm's site
  await page.goto(onPortal('/?entry=eligibility&source=main-site'));
  await expect(page).toHaveURL(urlOf(FUNNEL_URL, '/apply'));

  // signed in: the root opens the portal
  expect((await request.post(onFunnel('/api/leads'), { data: leadBody(newEmail('ui-root')) })).status()).toBe(201);
  await enterPortal(request);
  await page.goto(onPortal('/'));
  await expect(page).toHaveURL(urlOf(BASE_URL, '/portal'));
  await context.close();
});

test('sign-in: wrong password, forgot-password flow, Google unavailable locally, expired-link page', async ({ browser }) => {
  const { context, page, problems } = await visitor(browser);
  await page.goto(onPortal('/sign-in'));
  await expect(heading(page)).toHaveText('Follow your case.');
  await expect(page.getByRole('button', { name: 'Go to my application' })).toBeDisabled();
  await page.getByLabel('Email', { exact: true }).fill('nobody@example.com');
  await page.getByLabel('Password').fill('not-the-password');
  await page.getByRole('button', { name: 'Go to my application' }).click();
  await expect(page.getByText('We could not match that email and password.')).toBeVisible();

  // an address the button cannot accept says so once the field is left (the button itself stays disabled, as designed)
  await page.getByLabel('Email', { exact: true }).fill('üser@exämple.com');
  await page.getByLabel('Password').click();
  await expect(page.locator('#si-email-note')).toHaveText('Please enter a valid email address.');
  await expect(page.getByRole('button', { name: 'Go to my application' })).toBeDisabled();
  await page.getByLabel('Email', { exact: true }).fill('nobody@example.com');
  await expect(page.locator('#si-email-note')).toHaveCount(0);

  // Google: the local auth server has the provider switched off, so the page says so instead of landing on a JSON error
  await page.getByRole('button', { name: 'Continue with Google' }).click();
  await expect(page.getByText('Sign in with Google is not available right now.')).toBeVisible();
  await expect(page).toHaveURL(urlOf(BASE_URL, '/sign-in'));

  await page.getByRole('button', { name: 'Forgot it?' }).click();
  await expect(page.getByText('Enter the email you registered and we will send you a link to set a new password.')).toBeVisible();
  // the email typed on the sign-in form carries over, as in the prototype
  await expect(page.getByLabel('Email on your file')).toHaveValue('nobody@example.com');
  await page.getByLabel('Email on your file').fill('');
  await expect(page.getByRole('button', { name: 'Email me a reset link' })).toBeDisabled();
  await page.getByLabel('Email on your file').fill('nobody@example.com');
  await page.getByRole('button', { name: 'Email me a reset link' }).click();
  await expect(page.getByText('We sent a reset link to nobody@example.com. It is valid for one hour.')).toBeVisible();
  await page.getByRole('button', { name: '← Back to sign in' }).click();
  await expect(page.getByRole('button', { name: 'Continue with Google' })).toBeVisible();

  await page.goto(onPortal('/sign-in?error=link'));
  // Next.js adds its own role=alert route announcer, so only the page's own alerts are looked at
  await expect(page.locator('p[role=alert]')).toContainText('That link is no longer valid.');
  await page.goto(onPortal('/link-expired'));
  await expect(heading(page)).toHaveText('This link has expired.');
  await page.getByLabel('Email on your file').fill('nobody@example.com');
  await page.getByRole('button', { name: 'Email me a new link' }).click();
  await expect(page.getByText('If that address is on file, a new link is on its way.')).toBeVisible();
  expect(problems).toEqual([]);
  await context.close();
});

test('sign-in with a password, to next; staff and "next" are validated', async ({ browser }) => {
  const owner = await visitor(browser);
  const email = newEmail('ui-signin');
  expect((await owner.context.request.post(onFunnel('/api/leads'), { data: leadBody(email) })).status()).toBe(201);
  await enterPortal(owner.context.request);
  expect((await owner.context.request.post(onPortal('/api/auth/set-password'), { data: { password: 'correct-horse-9' } })).status()).toBe(200);
  await owner.context.close();

  const { context, page, problems } = await visitor(browser);
  // an unsafe next is ignored: after signing in we land on the portal, never on another site
  await page.goto(onPortal('/sign-in?next=' + encodeURIComponent('https://evil.example/steal')));
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password').fill('correct-horse-9');
  await page.getByRole('button', { name: 'Go to my application' }).click();
  await expect(page).toHaveURL(urlOf(BASE_URL, '/portal'));
  expect(new URL(page.url()).origin).toBe(originOf(BASE_URL));

  // signed in: the sign-in page does not ask again
  await page.goto(onPortal('/sign-in'));
  await expect(page).toHaveURL(urlOf(BASE_URL, '/portal'));
  expect(problems).toEqual([]);
  await context.close();
});

test('set a password: needs a session, validates as you type, saves and goes back to the portal', async ({ browser }) => {
  const anonymous = await visitor(browser);
  await anonymous.page.goto(onPortal('/create-password'));
  await expect(anonymous.page).toHaveURL(urlOf(BASE_URL, '/sign-in?next=%2Fcreate-password'));
  await anonymous.context.close();

  const { context, page, problems } = await visitor(browser);
  const email = newEmail('ui-password');
  expect((await context.request.post(onFunnel('/api/leads'), { data: leadBody(email) })).status()).toBe(201);
  await enterPortal(context.request);
  await page.goto(onPortal('/create-password'));
  await expect(heading(page)).toHaveText('Set a password.');
  await expect(page.getByLabel('Email')).toHaveValue(email);
  await expect(page.getByLabel('Email')).toHaveAttribute('readonly', '');
  const save = page.getByRole('button', { name: 'Save my password' });
  await expect(save).toBeDisabled();
  await expect(page.getByText('Eight characters or more. Use something you will remember.')).toBeVisible();
  await page.getByLabel('Password', { exact: true }).fill('abc');
  await expect(page.getByText('Use at least 8 characters.')).toBeVisible();
  await page.getByLabel('Confirm password').fill('abd');
  await expect(page.getByText('Both passwords need to match.')).toBeVisible();
  await expect(save).toBeDisabled();
  await page.getByLabel('Password', { exact: true }).fill('a-long-password-1');
  await page.getByLabel('Confirm password').fill('a-long-password-1');
  await expect(save).toBeEnabled();
  await save.click();
  await expect(page).toHaveURL(urlOf(BASE_URL, '/portal'));
  expect((await leadByEmail(email))?.password_set_at).toBeTruthy();

  // the reset flavour of the same screen
  await page.goto(onPortal('/create-password?mode=reset'));
  await expect(heading(page)).toHaveText('Choose a new password.');
  expect(problems).toEqual([]);
  await context.close();
});

test('unsubscribe: opening the link only asks; the button does it', async ({ browser }) => {
  const { context, page, problems } = await visitor(browser);
  const email = newEmail('ui-unsub');
  const created = await context.request.post(onFunnel('/api/leads'), { data: leadBody(email) });
  const { leadId } = (await created.json()) as { leadId: string };
  const token = signAppToken({ lid: leadId, p: 'unsub' });

  await page.goto(onPortal(`/unsubscribe?t=${token}`));
  await expect(heading(page)).toHaveText('Stop these emails?');
  await page.waitForTimeout(500);
  expect((await leadByEmail(email))?.unsubscribed_at).toBeNull();
  await page.getByRole('button', { name: 'Yes, unsubscribe me' }).click();
  await expect(heading(page)).toHaveText('You are unsubscribed.');
  expect((await leadByEmail(email))?.unsubscribed_at).toBeTruthy();

  await page.goto(onPortal('/unsubscribe?t=garbage'));
  await expect(heading(page)).toHaveText('This link is not valid.');
  await expect(page.getByRole('button', { name: 'Yes, unsubscribe me' })).toBeHidden();
  expect(problems).toEqual([]);
  await context.close();
});

interface AvailabilityBody {
  days: Array<{ date: string; slots: Array<{ startsAt: string; remaining: number }> }>;
}

/** The last completely free slot (counted from the back, where nobody else is competing) and where it sits in the UI. */
async function lastFreeSlot(page: Page) {
  const av = (await (await page.request.get(onFunnel('/api/availability'))).json()) as AvailabilityBody;
  for (let d = av.days.length - 1; d >= 0; d--) {
    const slots = av.days[d]!.slots;
    for (let i = slots.length - 1; i >= 0; i--) if (slots[i]!.remaining === 2) return { day: d, index: i, count: slots.length, startsAt: slots[i]!.startsAt };
  }
  throw new Error('no completely free slot');
}

test('a booked call survives a reload, can be changed, and the old booking is replaced', async ({ browser }) => {
  const { context, page, problems } = await visitor(browser);
  const email = newEmail('ui-rebook');
  await context.request.post(onFunnel('/api/leads'), { data: leadBody(email) });
  const slot = await lastFreeSlot(page);
  expect((await context.request.post(onFunnel('/api/bookings'), { data: { startsAt: slot.startsAt, timezone: 'America/New_York' } })).status()).toBe(201);

  await page.goto(onFunnel('/apply/booking'));
  await expect(heading(page)).toHaveText('Your call is booked.');
  await expect(page.locator('[data-confetti]')).toHaveCount(0);
  await page.getByRole('button', { name: 'Change the time' }).click();
  await expect(heading(page)).toHaveText('Anna, choose a time for your free call.');
  await page.locator('[aria-labelledby=book-day] button').nth(0).click();
  await page.locator('[aria-labelledby=book-time] button').nth(0).click();
  await page.getByRole('button', { name: /^Book my call for/ }).click();
  await expect(heading(page)).toHaveText('Your call is booked.');

  const lead = (await leadByEmail(email))!;
  const rows = await rest<{ status: string }>('bookings', `lead_id=eq.${lead.id}&select=status`);
  expect(rows.map((r) => r.status).sort()).toEqual(['cancelled', 'confirmed']);
  expect(problems).toEqual([]);
  await context.close();
});

test('the "free calls left this week" line tells the real number, in both languages, and is absent when there is none', async ({ browser }) => {
  const cases = [
    { locale: 'en' as const, timezone: 'America/New_York', lines: { 3: '3 free calls left this week', 1: 'One free call left this week', 40: '40 free calls left this week' } },
    { locale: 'he' as const, timezone: 'Asia/Jerusalem', lines: { 3: 'נותרו 3 שיחות ייעוץ חינם השבוע', 2: 'נותרו שתי שיחות ייעוץ חינם השבוע', 1: 'נותרה שיחת ייעוץ חינם אחת השבוע' } },
  ];
  for (const c of cases) {
    const { context, page, problems } = await visitor(browser, { locale: c.locale, timezone: c.timezone });
    await context.request.post(onFunnel('/api/leads'), { data: leadBody(newEmail(`ui-left-${c.locale}`)) });
    let seatsLeft = 0;
    await page.route('**/api/availability', async (route) => {
      const res = await route.fetch();
      await route.fulfill({ response: res, json: { ...(await res.json()), seatsLeft } });
    });
    const line = page.getByText(/free calls? left this week$|שיחות ייעוץ חינם השבוע$|שיחת ייעוץ חינם אחת השבוע$/);
    for (const [n, text] of Object.entries(c.lines)) {
      seatsLeft = Number(n);
      await page.goto(onFunnel(applyPath(c.locale, '/booking')));
      await expect(page.locator('[aria-labelledby=book-day] button')).toHaveCount(5);
      await expect(line).toHaveText(text);
    }
    seatsLeft = 0;
    await page.goto(onFunnel(applyPath(c.locale, '/booking')));
    await expect(page.locator('[aria-labelledby=book-day] button')).toHaveCount(5);
    await expect(line).toHaveCount(0);
    expect(problems).toEqual([]);
    await context.close();
  }
});

test('skipping the call goes straight to the result, without a booking', async ({ browser }) => {
  const { context, page, problems } = await visitor(browser);
  await context.request.post(onFunnel('/api/leads'), { data: leadBody(newEmail('ui-skip')) });
  await page.goto(onFunnel('/apply/booking'));
  await page.getByRole('button', { name: 'Skip for now and see my result' }).click();
  await expect(page).toHaveURL(urlOf(FUNNEL_URL, '/apply/offer'));
  await expect(heading(page)).toHaveText('Anna, you may have a claim to German citizenship.');
  await expect(page.getByText(/Your free call is booked/)).toBeHidden();
  expect(problems).toEqual([]);
  await context.close();
});

test('a slot taken while the page is open: a friendly message and the times that are still free', async ({ browser }) => {
  const { context, page, problems } = await visitor(browser);
  await context.request.post(onFunnel('/api/leads'), { data: leadBody(newEmail('ui-taken')) });
  await page.goto(onFunnel('/apply/booking'));
  await expect(page.locator('[aria-labelledby=book-day] button')).toHaveCount(5);
  const target = await lastFreeSlot(page);

  await page.locator('[aria-labelledby=book-day] button').nth(target.day).click();
  const slots = page.locator('[aria-labelledby=book-time] button');
  await expect(slots).toHaveCount(target.count);
  await slots.nth(target.index).click();

  // two other visitors take both seats while this page stays open
  for (const who of ['a', 'b']) {
    const rival = await visitor(browser);
    await rival.context.request.post(onFunnel('/api/leads'), { data: leadBody(newEmail(`ui-rival-${who}`)) });
    expect((await rival.context.request.post(onFunnel('/api/bookings'), { data: { startsAt: target.startsAt, timezone: 'Asia/Jerusalem' } })).status()).toBe(201);
    await rival.context.close();
  }

  await page.getByRole('button', { name: /^Book my call for/ }).click();
  await expect(page.getByText('That time was just taken. Here are the times that are still free.')).toBeVisible();
  await expect(slots).toHaveCount(target.count - 1);
  await expect(page.getByRole('button', { name: 'Choose a time above' })).toBeDisabled();
  expect(problems).toEqual([]);
  await context.close();
});

test('staff sign in with their password and land on /admin', async ({ browser }) => {
  const email = newEmail('ui-staff');
  await makeStaff(await createAuthUser(email, 'staff-pass-123'), email);
  const { context, page } = await visitor(browser);
  await page.goto(onPortal('/sign-in'));
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password').fill('staff-pass-123');
  await page.getByRole('button', { name: 'Go to my application' }).click();
  await expect(page).toHaveURL(urlOf(BASE_URL, '/admin'));
  await context.close();
});

/** Opens each screen at phone width (390 px) with a lead and a full set of answers, and measures how far the page scrolls sideways. */
async function sidewaysOverflow(browser: Browser, screens: (locale: UiLocale) => Array<{ site: 'funnel' | 'portal'; path: string }>) {
  const found: Record<string, number> = {};
  for (const locale of ['en', 'he'] as const) {
    const { context, page } = await visitor(browser, { locale, answers: COMPLETE, viewport: { width: 390, height: 844 } });
    await context.request.post(onFunnel('/api/leads'), { data: leadBody(newEmail(`ui-narrow-${locale}`), { locale }) });
    for (const { site, path } of screens(locale)) {
      await page.goto(site === 'funnel' ? onFunnel(path) : onPortal(path));
      await page.waitForTimeout(700);
      found[`${locale} ${path}`] = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    }
    await context.close();
  }
  return found;
}

test('no screen scrolls sideways at phone width, in either language', async ({ browser }) => {
  const found = await sidewaysOverflow(browser, (locale) => [
    ...['/eligibility', '/privacy'].map((p) => ({ site: 'funnel' as const, path: applyPath(locale, p) })),
    ...['/sign-in', '/link-expired', '/unsubscribe?t=x'].map((p) => ({ site: 'portal' as const, path: `${prefixOf(locale)}${p}` })),
  ]);
  expect(Object.entries(found).filter(([, px]) => px > 0)).toEqual([]);
});

/**
 * The phone-width rules of the funnel screens (`@media (max-width: 640px)` in apps/main/src/styles/landing.css: [data-step-label]
 * { display: none }, [data-stepper] { gap: 6px }, [data-step-line] { width: 12px }, [data-q-foot] ..., [data-slots] { 2 columns },
 * [data-resp="5"] { 1 column }, ...) keep every screen inside a 390 px phone:
 *  - the four-step header of /apply/details, /apply/booking and /apply/offer (554 px wide without the rules), in both languages;
 *  - the landing page's five-column benefits grid ([data-resp="5"], "Live in Europe ... Your children"), which collapses to one.
 */
test('no landing or funnel screen with the four-step header scrolls sideways at phone width, in either language', async ({ browser }) => {
  const found = await sidewaysOverflow(browser, (locale) => ['', '/details', '/booking', '/offer'].map((p) => ({ site: 'funnel' as const, path: applyPath(locale, p) })));
  expect(Object.entries(found).filter(([, px]) => px > 0)).toEqual([]);
});

/** Same rules as above: with `[data-q-foot] > span { flex-basis: 100% }` the reassurance text has a row of its own (without it, it is a 62 px sliver beside the buttons). */
test('the quiz footer keeps its reassurance on a row of its own at phone width, in English and Hebrew', async ({ browser }) => {
  for (const locale of ['en', 'he'] as const) {
    const { context, page } = await visitor(browser, { locale, viewport: { width: 390, height: 844 } });
    await page.goto(onFunnel(applyPath(locale, '/eligibility')));
    await page.waitForTimeout(700);
    const box = await page.locator('[data-q-foot] > span').boundingBox();
    // the whole row (390 px minus the 18 px padding on each side), not the 58 px sliver that a short hidden button used to leave
    expect(box?.width, locale).toBeGreaterThan(340);
    expect(box?.height, locale).toBeLessThan(70);
    await context.close();
  }
});
