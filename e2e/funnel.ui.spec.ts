import { expect as baseExpect, test, type Browser, type Page } from '@playwright/test';
import { BASE_URL, cleanup, createAuthUser, leadBody, leadByEmail, makeStaff, newEmail, newIp, rest, signAppToken } from './support/funnel';

/**
 * Browser tests of the funnel screens: the six questions, the details form, the booking, the result and the
 * sign-in family, in English and Hebrew (RTL). Run against a dev or production server:
 *
 *   FUNNEL_BASE_URL=http://localhost:3103 pnpm exec playwright test e2e/funnel.ui.spec.ts
 */
test.describe.configure({ mode: 'serial' });
test.setTimeout(120_000);
test.use({ baseURL: BASE_URL });
test.afterAll(cleanup);
/** Dev servers compile each route on first use: give assertions room. */
const expect = baseExpect.configure({ timeout: 20_000 });

/** A browser context with its own address (the API rate-limits per IP) and a fixed visitor time zone. */
async function visitor(browser: Browser, opts: { locale?: 'en' | 'he'; answers?: Record<string, string>; timezone?: string } = {}) {
  const context = await browser.newContext({
    baseURL: BASE_URL,
    locale: opts.locale === 'he' ? 'he-IL' : 'en-US',
    timezoneId: opts.timezone ?? 'America/New_York',
    extraHTTPHeaders: { 'x-forwarded-for': newIp() },
  });
  if (opts.answers) await context.addInitScript((a) => localStorage.setItem('dpl-quiz-v1', JSON.stringify(a)), opts.answers);
  const page = await context.newPage();
  const problems: string[] = [];
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    // a rejected sign-in or an expected 4xx is logged by the browser itself; real script errors are what matters
    if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) problems.push(`console: ${m.text()}`);
  });
  return { context, page, problems };
}

const COMPLETE = { country: 'germany', relative: 'grandparent', when: 'before_1933', persecution: 'yes', records: 'one_or_two', residence: 'ca' };
const options = (page: Page) => page.locator('[role=group] button[aria-pressed]');
const heading = (page: Page) => page.locator('h1');

test('the whole English journey: six questions, details, booking, result, portal', async ({ browser }) => {
  const { context, page, problems } = await visitor(browser);
  await page.goto('/eligibility');

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
  await expect(page).toHaveURL(/\/details$/);

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
  await expect(page).toHaveURL(/\/booking$/);

  // booking: five real days, slots in the visitor's zone, a confirmation
  await expect(heading(page)).toHaveText('Anna, choose a time for your free call.');
  const days = page.locator('[aria-labelledby=book-day] button');
  await expect(days).toHaveCount(5);
  await expect(page.getByText('Times are in your local time zone (America/New_York).')).toBeVisible();
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
  await expect(page).toHaveURL(/\/offer$/);

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

  await page.getByRole('button', { name: 'Go to my portal' }).click();
  await expect(page).toHaveURL(/\/portal$/);
  expect((await context.cookies()).some((c) => /^sb-.*-auth-token/.test(c.name))).toBe(true);
  expect((await leadByEmail(email))?.stage).toBe('account');
  expect(problems).toEqual([]);
  await context.close();
});

test('Hebrew: the funnel is right-to-left, translated, and the Hebrew path is kept', async ({ browser }) => {
  const { context, page, problems } = await visitor(browser, { locale: 'he', answers: COMPLETE, timezone: 'Asia/Jerusalem' });
  await page.goto('/he/eligibility');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.locator('html')).toHaveAttribute('lang', 'he');
  await expect(heading(page)).toHaveText('היכן אתם גרים כיום?');
  await expect(page.getByText('שאלה אחרונה')).toBeVisible();
  await expect(page.getByRole('button', { name: 'לתוצאה שלי' })).toBeVisible();
  await page.getByRole('button', { name: 'לתוצאה שלי' }).click();
  await expect(page).toHaveURL(/\/he\/details$/);

  await expect(heading(page)).toHaveText('לאן לשלוח את התוצאה?');
  await page.getByLabel('שם מלא').fill('מיכל כהן');
  await page.getByLabel('אימייל').fill(newEmail('he'));
  await page.getByLabel('טלפון').fill('052-123-4567');
  expect(await page.getByLabel('אימייל').getAttribute('dir')).toBe('ltr');
  await page.getByRole('button', { name: 'המשך' }).click();
  await expect(page).toHaveURL(/\/he\/booking$/);

  await expect(heading(page)).toHaveText('מיכל, בחרו מועד לשיחת הייעוץ החינמית שלכם.');
  await page.locator('[aria-labelledby=book-time] button').first().waitFor();
  await expect(page.locator('[aria-labelledby=book-time] button').first()).toHaveText(/^\d{2}:\d{2}/);
  await page.locator('[aria-labelledby=book-time] button').nth(0).click();
  await page.getByRole('button', { name: /^לקבוע את השיחה ל-\d{2}:\d{2}$/ }).click();
  await expect(heading(page)).toHaveText('השיחה שלכם נקבעה.');
  await page.getByRole('button', { name: 'לתוצאה שלי' }).click();
  await expect(page).toHaveURL(/\/he\/offer$/);
  await expect(heading(page)).toHaveText('מיכל, ייתכן שיש לכם זכאות לאזרחות גרמנית.');
  await expect(page.getByText('מה שמכריע עכשיו הם המסמכים של הסבא או הסבתא שלכם.')).toBeVisible();
  await expect(page.getByText('זו אינה חוות דעת משפטית. הזכאות והענקת האזרחות אינן מובטחות.')).toBeVisible();
  await page.getByRole('button', { name: 'לפורטל שלי' }).click();
  await expect(page).toHaveURL(/\/he\/portal$/);
  expect(problems).toEqual([]);
  await context.close();
});

test('a known email from another browser shows the inbox state and changes nothing', async ({ browser }) => {
  const owner = await visitor(browser);
  const email = newEmail('ui-existing');
  const created = await owner.context.request.post('/api/leads', { data: leadBody(email) });
  expect(created.status()).toBe(201);
  const before = await leadByEmail(email);

  const { context, page, problems } = await visitor(browser, { answers: COMPLETE });
  await page.goto('/details');
  await page.getByLabel('Full name').fill('Someone Else');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Phone').fill('+49 30 1234567');
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(heading(page)).toHaveText('Check your inbox.');
  await expect(page.getByText('There is already a file open for')).toContainText(email);
  await expect(page).toHaveURL(/\/details$/);
  expect(await leadByEmail(email)).toEqual(before);

  await page.getByRole('button', { name: 'Send the link again' }).click();
  await expect(page.getByText('We sent it again.')).toBeVisible();
  await page.getByRole('button', { name: 'Use a different email' }).click();
  await expect(heading(page)).toHaveText('Where should we send your result?');
  expect(problems).toEqual([]);
  await context.close();
  await owner.context.close();
});

test('direct visits go where they can continue: no answers -> questions, no lead -> details', async ({ browser }) => {
  // nothing answered yet: every later step sends the visitor back to the questions
  const fresh = await visitor(browser);
  await fresh.page.goto('/details');
  await expect(fresh.page).toHaveURL(/\/eligibility$/);
  await fresh.context.close();

  // questions answered but no lead yet: booking and the offer need the details first
  const answered = await visitor(browser, { answers: COMPLETE });
  await answered.page.goto('/booking');
  await expect(answered.page).toHaveURL(/\/details$/);
  await answered.page.goto('/offer');
  await expect(answered.page).toHaveURL(/\/details$/);
  await answered.context.close();
});

test('the quiz resumes at the first unanswered question (shared with the landing chat)', async ({ browser }) => {
  const { context, page } = await visitor(browser, { answers: { country: 'austria', relative: 'parent' } });
  await page.goto('/eligibility');
  await expect(heading(page)).toHaveText('Roughly when did they leave?');
  await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '33');
  await context.close();
});

test('sign-in: wrong password, forgot-password flow, Google unavailable locally, expired-link page', async ({ browser }) => {
  const { context, page, problems } = await visitor(browser);
  await page.goto('/sign-in');
  await expect(heading(page)).toHaveText('Follow your case.');
  await expect(page.getByRole('button', { name: 'Go to my application' })).toBeDisabled();
  await page.getByLabel('Email', { exact: true }).fill('nobody@example.com');
  await page.getByLabel('Password').fill('not-the-password');
  await page.getByRole('button', { name: 'Go to my application' }).click();
  await expect(page.getByText('We could not match that email and password.')).toBeVisible();

  // Google: the local auth server has the provider switched off, so the page says so instead of landing on a JSON error
  await page.getByRole('button', { name: 'Continue with Google' }).click();
  await expect(page.getByText('Sign in with Google is not available right now.')).toBeVisible();
  await expect(page).toHaveURL(/\/sign-in$/);

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

  await page.goto('/sign-in?error=link');
  // Next.js adds its own role=alert route announcer, so only the page's own alerts are looked at
  await expect(page.locator('p[role=alert]')).toContainText('That link is no longer valid.');
  await page.goto('/link-expired');
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
  await owner.context.request.post('/api/leads', { data: leadBody(email) });
  await owner.context.request.post('/api/portal/enter');
  await owner.context.request.post('/api/auth/set-password', { data: { password: 'correct-horse-9' } });
  await owner.context.close();

  const { context, page, problems } = await visitor(browser);
  // an unsafe next is ignored: after signing in we land on the portal, never on another site
  await page.goto('/sign-in?next=' + encodeURIComponent('https://evil.example/steal'));
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password').fill('correct-horse-9');
  await page.getByRole('button', { name: 'Go to my application' }).click();
  await expect(page).toHaveURL(/\/portal$/);
  expect(new URL(page.url()).origin).toBe(BASE_URL);

  // signed in: the sign-in page does not ask again
  await page.goto('/sign-in');
  await expect(page).toHaveURL(/\/portal$/);
  expect(problems).toEqual([]);
  await context.close();
});

test('set a password: needs a session, validates as you type, saves and goes back to the portal', async ({ browser }) => {
  const anonymous = await visitor(browser);
  await anonymous.page.goto('/create-password');
  await expect(anonymous.page).toHaveURL(/\/sign-in\?next=%2Fcreate-password$/);
  await anonymous.context.close();

  const { context, page, problems } = await visitor(browser);
  const email = newEmail('ui-password');
  await context.request.post('/api/leads', { data: leadBody(email) });
  await context.request.post('/api/portal/enter');
  await page.goto('/create-password');
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
  await expect(page).toHaveURL(/\/portal$/);
  expect((await leadByEmail(email))?.password_set_at).toBeTruthy();

  // the reset flavour of the same screen
  await page.goto('/create-password?mode=reset');
  await expect(heading(page)).toHaveText('Choose a new password.');
  expect(problems).toEqual([]);
  await context.close();
});

test('unsubscribe: opening the link only asks; the button does it', async ({ browser }) => {
  const { context, page, problems } = await visitor(browser);
  const email = newEmail('ui-unsub');
  const created = await context.request.post('/api/leads', { data: leadBody(email) });
  const { leadId } = (await created.json()) as { leadId: string };
  const token = signAppToken({ lid: leadId, p: 'unsub' });

  await page.goto(`/unsubscribe?t=${token}`);
  await expect(heading(page)).toHaveText('Stop these emails?');
  await page.waitForTimeout(500);
  expect((await leadByEmail(email))?.unsubscribed_at).toBeNull();
  await page.getByRole('button', { name: 'Yes, unsubscribe me' }).click();
  await expect(heading(page)).toHaveText('You are unsubscribed.');
  expect((await leadByEmail(email))?.unsubscribed_at).toBeTruthy();

  await page.goto('/unsubscribe?t=garbage');
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
  const av = (await (await page.request.get('/api/availability')).json()) as AvailabilityBody;
  for (let d = av.days.length - 1; d >= 0; d--) {
    const slots = av.days[d]!.slots;
    for (let i = slots.length - 1; i >= 0; i--) if (slots[i]!.remaining === 2) return { day: d, index: i, count: slots.length, startsAt: slots[i]!.startsAt };
  }
  throw new Error('no completely free slot');
}

test('a booked call survives a reload, can be changed, and the old booking is replaced', async ({ browser }) => {
  const { context, page, problems } = await visitor(browser);
  const email = newEmail('ui-rebook');
  await context.request.post('/api/leads', { data: leadBody(email) });
  const slot = await lastFreeSlot(page);
  expect((await context.request.post('/api/bookings', { data: { startsAt: slot.startsAt, timezone: 'America/New_York' } })).status()).toBe(201);

  await page.goto('/booking');
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

test('skipping the call goes straight to the result, without a booking', async ({ browser }) => {
  const { context, page, problems } = await visitor(browser);
  await context.request.post('/api/leads', { data: leadBody(newEmail('ui-skip')) });
  await page.goto('/booking');
  await page.getByRole('button', { name: 'Skip for now and see my result' }).click();
  await expect(page).toHaveURL(/\/offer$/);
  await expect(heading(page)).toHaveText('Anna, you may have a claim to German citizenship.');
  await expect(page.getByText(/Your free call is booked/)).toBeHidden();
  expect(problems).toEqual([]);
  await context.close();
});

test('a slot taken while the page is open: a friendly message and the times that are still free', async ({ browser }) => {
  const { context, page, problems } = await visitor(browser);
  await context.request.post('/api/leads', { data: leadBody(newEmail('ui-taken')) });
  await page.goto('/booking');
  await expect(page.locator('[aria-labelledby=book-day] button')).toHaveCount(5);
  const target = await lastFreeSlot(page);

  await page.locator('[aria-labelledby=book-day] button').nth(target.day).click();
  const slots = page.locator('[aria-labelledby=book-time] button');
  await expect(slots).toHaveCount(target.count);
  await slots.nth(target.index).click();

  // two other visitors take both seats while this page stays open
  for (const who of ['a', 'b']) {
    const rival = await visitor(browser);
    await rival.context.request.post('/api/leads', { data: leadBody(newEmail(`ui-rival-${who}`)) });
    expect((await rival.context.request.post('/api/bookings', { data: { startsAt: target.startsAt, timezone: 'Asia/Jerusalem' } })).status()).toBe(201);
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
  await page.goto('/sign-in');
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password').fill('staff-pass-123');
  await page.getByRole('button', { name: 'Go to my application' }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await context.close();
});

test('no screen scrolls sideways at phone width, in either language', async ({ browser }) => {
  for (const locale of ['en', 'he'] as const) {
    const prefix = locale === 'he' ? '/he' : '';
    const context = await browser.newContext({ baseURL: BASE_URL, viewport: { width: 390, height: 844 }, locale: locale === 'he' ? 'he-IL' : 'en-US', extraHTTPHeaders: { 'x-forwarded-for': newIp() } });
    await context.addInitScript((a) => localStorage.setItem('dpl-quiz-v1', JSON.stringify(a)), COMPLETE);
    const page = await context.newPage();
    const email = newEmail(`ui-narrow-${locale}`);
    await context.request.post('/api/leads', { data: leadBody(email, { locale }) });
    for (const path of ['/eligibility', '/details', '/booking', '/offer', '/sign-in', '/link-expired', '/unsubscribe?t=x']) {
      await page.goto(`${prefix}${path}`);
      await page.waitForTimeout(700);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, `${locale} ${path}`).toBeLessThanOrEqual(0);
    }
    await context.close();
  }
});
