import { expect as baseExpect, test, type Browser, type Page } from '@playwright/test';
import en from '../apps/main/messages/en/forms.json';
import enA11y from '../apps/main/messages/en/a11y.json';
import enSite from '../apps/main/messages/en/site.json';
import he from '../apps/main/messages/he/forms.json';
import heSite from '../apps/main/messages/he/site.json';
import { RUN, SERVICE_KEY, SUPABASE_URL, eventually, newIp, rest } from './support/funnel';

/**
 * The firm's website in a browser, in English and Hebrew: the three enquiry forms (contact page, lead band, chat) all
 * the way into the database and the outbox, validation, the honeypot and the rate limit, the language switch, the
 * links into the campaign, the mega menu, the team filter, the accessibility widget and the sticky call to action.
 *
 *   MAIN_URL=http://localhost:3000 CAMPAIGN_URL=http://localhost:3001 pnpm exec playwright test e2e/main.spec.ts
 * (needs the local Supabase; everything it creates uses addresses e2e-main-<run>-*@example.com and is deleted again)
 */
const MAIN = process.env.MAIN_URL ?? 'http://localhost:3000';
const CAMPAIGN = process.env.CAMPAIGN_URL ?? 'http://localhost:3001';

test.use({ baseURL: MAIN });
const expect = baseExpect.configure({ timeout: 15_000 });

/** The forms capitalise Latin words as people type, in either language. */
const CAP = RUN.replace(/^[a-z]/, (c) => c.toUpperCase());
let counter = 0;
const mail = (label: string) => `e2e-main-${RUN}-${label}-${++counter}@example.com`;

const headers = () => ({ apikey: SERVICE_KEY, authorization: `Bearer ${SERVICE_KEY}` });
test.afterAll(async () => {
  const like = `e2e-main-${RUN}-*`;
  await fetch(`${SUPABASE_URL}/rest/v1/events?type=eq.contact.created&payload->submission->>email=like.${like}`, { method: 'DELETE', headers: headers() });
  await fetch(`${SUPABASE_URL}/rest/v1/events?type=eq.email.send&payload->to->>email=like.${like}`, { method: 'DELETE', headers: headers() });
  await fetch(`${SUPABASE_URL}/rest/v1/contact_submissions?email=like.${like}`, { method: 'DELETE', headers: headers() });
});

/** One browser context per visitor, with its own address: the API rate-limits by IP. */
async function visitor(browser: Browser, opts: { width?: number; height?: number } = {}) {
  const context = await browser.newContext({
    baseURL: MAIN,
    viewport: { width: opts.width ?? 1440, height: opts.height ?? 900 },
    extraHTTPHeaders: { 'x-forwarded-for': newIp() },
    reducedMotion: 'reduce',
  });
  const page = await context.newPage();
  const problems: string[] = [];
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error' && !/Failed to load resource|net::ERR_/.test(m.text())) problems.push(`console: ${m.text()}`);
  });
  return { context, page, problems };
}

interface Submission {
  id: string;
  kind: string;
  name: string;
  email: string | null;
  phone: string;
  matter: string | null;
  note: string | null;
  locale: string;
  page: string | null;
  consented_at: string | null;
}
const submissionOf = (email: string) =>
  eventually(async () => (await rest<Submission>('contact_submissions', `email=eq.${encodeURIComponent(email)}`))[0], `submission for ${email}`);

/** The events the submission produced: the CRM event, and the acknowledgement email in the outbox. */
async function outboxFor(email: string) {
  const crm = await eventually(
    async () => (await rest<{ id: string; payload: { submission: Submission } }>('events', `type=eq.contact.created&payload->submission->>email=eq.${encodeURIComponent(email)}`))[0],
    `contact.created for ${email}`,
  );
  const ack = await eventually(
    async () => (await rest<{ payload: { template: string; to: { email: string }; locale: string; subject: string } }>('events', `type=eq.email.send&payload->to->>email=eq.${encodeURIComponent(email)}`))[0],
    `acknowledgement email for ${email}`,
  );
  return { crm, ack };
}

const fill = async (page: Page, scope: string, v: { name: string; phone: string; email?: string }) => {
  await page.locator(`${scope} input[name=name]`).fill(v.name);
  await page.locator(`${scope} input[name=phone]`).fill(v.phone);
  if (v.email !== undefined) await page.locator(`${scope} input[name=email]`).fill(v.email);
};

for (const L of [
  { locale: 'en' as const, prefix: '', forms: en, site: enSite, name: 'e2e main anna', shown: 'E2e Main Anna', first: 'E2e' },
  { locale: 'he' as const, prefix: '/he', forms: he, site: heSite, name: 'E2E Main ' + CAP, shown: 'E2E Main ' + CAP, first: 'E2E' },
]) {
  test.describe(`enquiry forms (${L.locale})`, () => {
    test('contact page: validation first, then a real submission into the CRM outbox', async ({ browser }) => {
      const { context, page, problems } = await visitor(browser);
      await page.goto(`${L.prefix}/contact`);
      const form = page.locator('main form');
      const submit = form.locator('button[type=submit]');

      // nothing filled in: the form explains itself and names the problem fields
      await submit.click();
      await expect(form.locator('p.dpl-sr-only[role=status]')).toContainText(L.forms.contact.errors.summary);
      await expect(form.locator('input[name=name]')).toHaveAttribute('aria-invalid', 'true');
      await expect(form.locator('input[name=email]')).toHaveAttribute('aria-invalid', 'true');
      await expect(form.locator('input[name=phone]')).toHaveAttribute('aria-invalid', 'true');

      const email = mail(`contact-${L.locale}`);
      await fill(page, 'main form', { name: L.name, phone: '+972 50 123 4567', email });
      await form.locator('select[name=matter]').selectOption({ label: L.forms.matters[0]! });
      await form.locator('textarea[name=note]').fill('Grandmother born in Vienna, left in 1939.');
      await form.locator('input[name=consent]').check();
      await submit.click();

      await expect(page.locator('main h2').filter({ hasText: L.first })).toBeVisible();
      await expect(page.locator('main p[role=status]')).toContainText(email);
      const row = await submissionOf(email);
      expect(row).toMatchObject({ kind: 'contact', name: L.shown, phone: '+972 50 123 4567', locale: L.locale });
      expect(row.matter, 'the CRM always gets the English subject label').toBe(en.matters[0]);
      expect(row.note).toBe('Grandmother born in Vienna, left in 1939.');
      expect(row.page).toBe(`${L.prefix}/contact`);
      expect(new Date(row.consented_at ?? '').getTime()).toBeGreaterThan(Date.now() - 60_000);

      const { crm, ack } = await outboxFor(email);
      expect(crm.payload.submission).toMatchObject({ id: row.id, kind: 'contact', email });
      expect(ack.payload).toMatchObject({ template: 'contact-received', locale: L.locale });
      expect(problems).toEqual([]);
      await context.close();
    });

    test('lead band at the foot of a page: sendable only when valid and consented, then stored with its page', async ({ browser }) => {
      const { context, page, problems } = await visitor(browser);
      await page.goto(`${L.prefix}/services/german-citizenship`);
      const band = page.locator('#leadform');
      const submit = band.locator('button[type=submit]');
      await band.scrollIntoViewIfNeeded();

      // the button waits until everything is valid; a bad field explains itself once it is left
      await expect(submit).toHaveAttribute('aria-disabled', 'true');
      await band.locator('input[name=name]').fill('x');
      await band.locator('input[name=name]').blur();
      await expect(band.locator('input[name=name]')).toHaveAttribute('aria-invalid', 'true');

      const email = mail(`band-${L.locale}`);
      await fill(page, '#leadform', { name: L.name, phone: '03-372-4722', email });
      await expect(band.locator('input[name=name]')).not.toHaveAttribute('aria-invalid', 'true');
      await expect(submit).toHaveAttribute('aria-disabled', 'true'); // no consent yet
      await band.locator('input[name=consent]').check();
      await expect(submit).not.toHaveAttribute('aria-disabled', 'true');
      await submit.click();

      await expect(band.getByRole('status')).toContainText(L.first);
      await expect(band.getByRole('status')).toContainText(email);
      const row = await submissionOf(email);
      expect(row).toMatchObject({ kind: 'lead_band', locale: L.locale, page: `${L.prefix}/services/german-citizenship` });
      await outboxFor(email);
      expect(problems).toEqual([]);
      await context.close();
    });

    test('a click on the dimmed send button explains what is missing instead of doing nothing', async ({ browser }) => {
      const { context, page, problems } = await visitor(browser);
      await page.goto(`${L.prefix}/services/german-citizenship`);
      const band = page.locator('#leadform');
      await band.scrollIntoViewIfNeeded();
      // a real mouse click on the dimmed button (no field has been touched yet). Playwright treats aria-disabled as
      // disabled and would wait for it, so the click is forced: it lands where a visitor's would
      await band.locator('button[type=submit]').click({ force: true });
      await expect(band.locator('input[name=name]')).toHaveAttribute('aria-invalid', 'true');
      await expect(band.locator('input[name=email]')).toHaveAttribute('aria-invalid', 'true');
      await expect(band.locator('input[name=name]')).toBeFocused();
      // the consent checkbox is the last thing missing: the click names it too
      await fill(page, '#leadform', { name: L.name, phone: '03-372-4722', email: mail(`dim-${L.locale}`) });
      await band.locator('button[type=submit]').click({ force: true });
      await expect(band.locator('input[name=consent]')).toBeFocused();
      await expect(band.locator('p[id*="consent"], [role=alert]').first()).toBeVisible();

      // the same in the chat
      await page.getByRole('button', { name: L.site.chat.launcher }).click();
      const chat = page.getByRole('dialog', { name: L.site.chat.dialog });
      await chat.getByRole('button', { name: L.site.chat.topics[0]! }).click();
      await chat.locator('button[type=submit]').click({ force: true });
      await expect(chat.getByPlaceholder(L.site.chat.placeholders.name)).toHaveAttribute('aria-invalid', 'true');
      expect(problems).toEqual([]);
      await context.close();
    });

    test('chat: topic, details, a call back is requested', async ({ browser }) => {
      const { context, page, problems } = await visitor(browser);
      await page.goto(`${L.prefix}/about`);
      await page.getByRole('button', { name: L.site.chat.launcher }).click();
      const chat = page.getByRole('dialog', { name: L.site.chat.dialog });
      await expect(chat).toBeVisible();
      await chat.getByRole('button', { name: L.site.chat.topics[0]! }).click();

      const email = mail(`chat-${L.locale}`);
      await chat.getByPlaceholder(L.site.chat.placeholders.name).fill(L.name);
      await chat.getByPlaceholder(L.site.chat.placeholders.phone).fill('+1 212 555 0100');
      await chat.getByLabel(L.site.chat.emailOptional).fill(email);
      await chat.locator('input[name=consent]').check();
      await chat.locator('button[type=submit]').click();

      await expect(chat.getByRole('status')).toContainText(L.first);
      const row = await submissionOf(email);
      expect(row).toMatchObject({ kind: 'chat', locale: L.locale });
      expect(row.matter, 'the CRM always gets the English topic').toBe(enSite.chat.topics[0]);
      expect(problems).toEqual([]);
      await context.close();
    });
  });
}

test.describe('the contact API', () => {
  const payload = (email: string, extra: Record<string, unknown> = {}) => ({
    kind: 'contact', name: `E2E Main ${RUN} api`, email, phone: '+972501234567', locale: 'en', consent: true, ...extra,
  });

  const client = (playwright: Parameters<Parameters<typeof test>[2]>[0]['playwright']) =>
    playwright.request.newContext({ baseURL: MAIN, extraHTTPHeaders: { 'x-forwarded-for': newIp() } });

  test('refuses what it must', async ({ playwright }) => {
    const api = await client(playwright);
    // a foreign origin cannot post
    const foreign = await api.post('/api/contact', { data: payload(mail('api')), headers: { origin: 'https://evil.example' } });
    expect(foreign.status()).toBe(403);
    // validation: no consent, bad phone, bad email, unknown kind (four calls: the limit is five a minute)
    for (const bad of [{ consent: false }, { phone: '12' }, { email: 'not-an-email' }, { kind: 'newsletter' }]) {
      const res = await api.post('/api/contact', { data: payload(mail('api'), bad) });
      expect(res.status(), JSON.stringify(bad)).toBe(400);
    }
    await api.dispose();
  });

  test('quietly swallows a bot that fills the hidden field, and stores a real enquiry', async ({ playwright }) => {
    const api = await client(playwright);
    const botEmail = mail('bot');
    const bot = await api.post('/api/contact', { data: payload(botEmail, { website: 'http://spam.example' }) });
    expect(bot.status()).toBe(201); // told it worked
    const okEmail = mail('api');
    expect((await api.post('/api/contact', { data: payload(okEmail) })).status()).toBe(201);
    await submissionOf(okEmail);
    expect(await rest('contact_submissions', `email=eq.${encodeURIComponent(botEmail)}`)).toEqual([]);
    await api.dispose();
  });

  test('limits the rate per address: the sixth call inside a minute is refused', async ({ playwright }) => {
    const api = await client(playwright);
    const statuses: number[] = [];
    for (let i = 0; i < 6; i++) statuses.push((await api.post('/api/contact', { data: payload(mail('rate')) })).status());
    expect(statuses.slice(0, 5)).toEqual([201, 201, 201, 201, 201]);
    expect(statuses[5]).toBe(429);
    await api.dispose();
  });
});

test.describe('navigation', () => {
  test('the language switch keeps the page, flips direction, and goes back', async ({ browser }) => {
    const { context, page, problems } = await visitor(browser);
    await page.goto('/services/german-citizenship');
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
    const switcher = page.getByRole('group', { name: enSite.lang.label }).first();
    await expect(switcher.getByText(/Fran/)).toHaveCount(0);
    await switcher.getByRole('link', { name: heSite.lang.he }).click();
    await expect(page).toHaveURL(/\/he\/services\/german-citizenship$/);
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.locator('html')).toHaveAttribute('lang', 'he');
    await page.getByRole('group', { name: heSite.lang.label }).first().getByRole('link', { name: enSite.lang.en }).click();
    await expect(page).toHaveURL(/\/services\/german-citizenship$/);
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    expect(problems).toEqual([]);
    await context.close();
  });

  test('every call to the campaign carries where it came from, in the visitor language', async ({ browser }) => {
    const { context, page } = await visitor(browser);
    for (const [path, lang] of [['/', 'en'], ['/he', 'he'], ['/services/german-citizenship', 'en'], ['/he/contact', 'he']] as const) {
      await page.goto(path);
      const hrefs = await page.locator('a[href*="source=main-site"]').evaluateAll((els) => els.map((e) => (e as HTMLAnchorElement).href));
      expect(hrefs.length, path).toBeGreaterThan(0);
      for (const href of hrefs) {
        const url = new URL(href);
        expect(url.origin, href).toBe(new URL(CAMPAIGN).origin);
        expect(url.searchParams.get('source'), href).toBe('main-site');
        // either a direct page of the funnel or the landing page with an entry parameter
        const bare = url.pathname.replace(/^\/he(?=\/|$)/, '') || '/';
        const ok = ['/eligibility', '/sign-in', '/portal'].includes(bare) || ['eligibility', 'signin', 'portal'].includes(url.searchParams.get('entry') ?? '');
        expect(ok, href).toBe(true);
        expect(url.pathname.startsWith('/he'), href).toBe(lang === 'he');
      }
    }
    await context.close();
  });

  test('the mega menu opens from the keyboard, lists the practice areas and closes with Escape', async ({ browser }) => {
    const { context, page, problems } = await visitor(browser);
    await page.goto('/');
    const trigger = page.getByRole('button', { name: enSite.nav.passports });
    await trigger.focus();
    await page.keyboard.press('Enter');
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    const panel = page.locator('#dpl-mega');
    await expect(panel.getByRole('link', { name: /German citizenship/i }).first()).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await panel.getByRole('link').first().waitFor({ state: 'hidden' }).catch(() => undefined);
    expect(problems).toEqual([]);
    await context.close();
  });

  test('a menu opened by hovering closes with Escape although the focus never moved into it', async ({ browser }) => {
    const { context, page } = await visitor(browser);
    await page.goto('/');
    const trigger = page.getByRole('button', { name: enSite.nav.passports });
    await trigger.hover();
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await page.keyboard.press('Escape');
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await context.close();
  });

  test('old #/ links lead to the clean page in the right language, and keep the query string', async ({ browser }) => {
    const { context, page } = await visitor(browser);
    await page.goto('/#/service/german-citizenship');
    await expect(page).toHaveURL(/\/services\/german-citizenship$/);
    await expect(page.locator('h1').first()).toContainText(/German/i);
    await page.goto('/he?utm_source=x#/attorney/michael-decker');
    await expect(page).toHaveURL(/\/he\/team\/michael-decker\?utm_source=x$/);
    // a hash that is not one of the old addresses (or names nothing) leaves the visitor where they are
    await page.goto('/#/nonsense');
    await page.waitForTimeout(500);
    expect(new URL(page.url()).pathname).toBe('/');
    await page.goto('/#leadform');
    await page.waitForTimeout(300);
    expect(new URL(page.url()).pathname).toBe('/');
    await context.close();
  });

  test('the campaign parameters of the first page travel with an enquiry sent from another page', async ({ browser }) => {
    const { context, page } = await visitor(browser);
    const bodies: Array<Record<string, unknown>> = [];
    await page.route('**/api/contact', async (route) => {
      bodies.push(JSON.parse(route.request().postData() ?? '{}') as Record<string, unknown>);
      await route.fulfill({ status: 201, contentType: 'application/json', body: '{"ok":true}' });
    });
    await page.goto('/?utm_source=google&utm_campaign=spring');
    // the first touch is written once the page has hydrated: leaving earlier (a loaded machine) would lose it
    await page.waitForFunction(() => window.sessionStorage.getItem('dpl-attribution'));
    await page.goto('/about');
    const band = page.locator('#leadform');
    await band.scrollIntoViewIfNeeded();
    await fill(page, '#leadform', { name: 'Anna Stub', phone: '03-372-4722', email: mail('utm') });
    await band.locator('input[name=consent]').check();
    await band.locator('button[type=submit]').click();
    await expect(band.getByRole('status')).toBeVisible();
    expect(bodies[0]).toMatchObject({ kind: 'lead_band', source: 'google', utm: { utm_source: 'google', utm_campaign: 'spring' } });

    // and from the contact page
    await page.goto('/contact');
    const form = page.locator('main form');
    await fill(page, 'main form', { name: 'Anna Stub', phone: '03-372-4722', email: mail('utm2') });
    await form.locator('select[name=matter]').selectOption({ index: 1 });
    await form.locator('input[name=consent]').check();
    await form.locator('button[type=submit]').click();
    await expect.poll(() => bodies.length).toBe(2);
    expect(bodies[1]).toMatchObject({ kind: 'contact', source: 'google', utm: { utm_source: 'google', utm_campaign: 'spring' } });
    await context.close();
  });

  test('the sticky call to action appears after the first screens and is not there at the top', async ({ browser }) => {
    const { context, page } = await visitor(browser);
    await page.goto('/services/german-citizenship');
    const cta = page.locator('[data-float]').filter({ has: page.getByRole('link', { name: enSite.nav.consult }) });
    await expect(cta).toHaveCount(0);
    await page.evaluate(() => window.scrollTo(0, 900));
    await expect(page.locator('a', { hasText: enSite.nav.consult }).last()).toBeVisible();
    await context.close();
  });

  test('the accessibility tools change the page and are remembered', async ({ browser }) => {
    const { context, page } = await visitor(browser);
    await page.goto('/');
    const html = page.locator('html');
    await expect(html).not.toHaveAttribute('data-a11y-zoom', /.+/);
    await page.getByRole('button', { name: enA11y.open }).click();
    const dialog = page.getByRole('dialog', { name: enA11y.dialog });
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: enA11y.tools.larger }).click();
    await expect(html).toHaveAttribute('data-a11y-zoom', '1');
    expect(await page.locator('#dpl-page').evaluate((el) => getComputedStyle(el).getPropertyValue('zoom'))).toBe('1.12');
    await dialog.getByRole('button', { name: enA11y.tools.grayscale }).click();
    await expect(html).toHaveAttribute('data-a11y-filter', 'grayscale');
    // remembered: the stored choice is applied before the page is painted again
    await page.reload();
    await expect(html).toHaveAttribute('data-a11y-zoom', '1');
    await expect(html).toHaveAttribute('data-a11y-filter', 'grayscale');
    await page.getByRole('button', { name: enA11y.open }).click();
    await page.getByRole('dialog', { name: enA11y.dialog }).getByRole('button', { name: enA11y.reset }).click();
    await expect(html).not.toHaveAttribute('data-a11y-zoom', /.+/);
    await context.close();
  });

  test('the team directory filters by department, in both languages', async ({ browser }) => {
    for (const prefix of ['', '/he']) {
      const { context, page } = await visitor(browser);
      await page.goto(`${prefix}/team`);
      const group = page.getByRole('group').filter({ has: page.locator('button[aria-pressed]') }).first();
      const buttons = group.locator('button[aria-pressed]');
      expect(await buttons.count(), prefix).toBeGreaterThan(2);
      const cards = page.locator('a[href*="/team/"]');
      const all = await cards.count();
      expect(all, prefix).toBeGreaterThan(30);
      await buttons.nth(2).click();
      await expect(buttons.nth(2)).toHaveAttribute('aria-pressed', 'true');
      const filtered = await cards.count();
      expect(filtered, prefix).toBeGreaterThan(0);
      expect(filtered, prefix).toBeLessThan(all);
      await buttons.first().click();
      await expect(cards).toHaveCount(all);
      await context.close();
    }
  });
});

test.describe('phones @mobile', () => {
  const pages = ['/', '/about', '/services', '/services/german-citizenship', '/team', '/team/michael-decker', '/testimonials', '/insights', '/media', '/contact', '/privacy'];

  test('no page scrolls sideways at phone width, in either language', async ({ browser }) => {
    const { context, page } = await visitor(browser, { width: 390, height: 844 });
    for (const prefix of ['', '/he']) {
      for (const path of pages) {
        const url = prefix + (path === '/' ? '' : path) || '/';
        await page.goto(url);
        await page.waitForLoadState('networkidle').catch(() => undefined);
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        expect(overflow, `${url} scrolls sideways by ${overflow}px`).toBeLessThanOrEqual(0);
      }
    }
    await context.close();
  });

  test('the burger menu opens, shows the language switch and closes', async ({ browser }) => {
    const { context, page, problems } = await visitor(browser, { width: 390, height: 844 });
    await page.goto('/');
    const burger = page.getByRole('button', { name: enSite.nav.menu });
    await burger.click();
    await expect(burger).toHaveAttribute('aria-expanded', 'true');
    const nav = page.locator('#dpl-mobile-nav');
    await expect(nav.getByRole('link', { name: heSite.lang.he })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(burger).toHaveAttribute('aria-expanded', 'false');
    expect(problems).toEqual([]);
    await context.close();
  });
});
