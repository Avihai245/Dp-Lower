import { expect as baseExpect, type APIRequestContext, type Browser, type BrowserContext, type Locator, type Page } from '@playwright/test';
import { APPLY, BASE_URL, FUNNEL_URL, newIp } from './funnel';

/**
 * Helpers of the end-to-end stories (journey.spec.ts, full-journey.spec.ts, language.spec.ts, english-only.spec.ts).
 *
 * The product is two sites now:
 *   - the firm's site (apps/main, FUNNEL_URL): the firm's own pages, the landing page and the whole eligibility funnel
 *     under /apply (questions, details, booking, offer), and the lead / booking / availability / result APIs;
 *   - the portal (apps/campaign, BASE_URL): sign-in, the client portal, the staff CRM, the emailed /go links and the
 *     portal APIs. "Go to my portal" on the offer screen is the hand-over between the two (POST /api/portal/enter on the
 *     firm's site, then a full-page navigation to /enter/<token> on the portal).
 * A story therefore never has a baseURL: every address is built with onFirm() / onPortal(), so a page opened on the wrong
 * site fails loudly instead of quietly 404ing.
 *
 * On localhost cookies ignore the port, so a browser would carry the firm's cookies to the portal and the other way
 * round, which production (two domains) never does. isolatedFirmUrl() gives the same local server under a second host name
 * (127.0.0.1 instead of localhost) so that a story can run with two really separate cookie jars.
 */
export const expect = baseExpect.configure({ timeout: 20_000 });

/** The firm's site as the stories address it, and the portal. */
export const FIRM_URL = FUNNEL_URL;
export const PORTAL_URL = BASE_URL;
export const originOf = (url: string): string => new URL(url).origin;

/** An address on the firm's site (the firm's pages, /apply and its APIs). */
export const onFirm = (path: string, base: string = FIRM_URL): string => `${base}${path}`;
/** An address on the portal's site (sign-in, portal, CRM, emailed links, portal APIs). */
export const onPortal = (path: string): string => `${PORTAL_URL}${path}`;

/**
 * The firm's site under a second host name when it runs on localhost (cookies are keyed by host name, not by port, so
 * 127.0.0.1:3000 and localhost:3001 share nothing, like two production domains); the plain address otherwise.
 */
export function isolatedFirmUrl(): string | null {
  const u = new URL(FIRM_URL);
  if (u.hostname !== 'localhost') return null;
  u.hostname = '127.0.0.1';
  return u.origin;
}

export const escapeRe = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** The exact address of a page as a pattern that ignores a trailing query: urlIs(origin, '/apply/details'). */
export const urlIs = (origin: string, path: string): RegExp => new RegExp(`^${escapeRe(origin)}${escapeRe(path)}(\\?.*)?$`);

/** The language-dependent facts of a story. */
export interface StoryLocale {
  locale: 'en' | 'he';
  /** '' for English, '/he' for Hebrew */
  prefix: '' | '/he';
  tz: string;
  /** a name typed in lower case on purpose (the details form capitalises it) */
  name: string;
  first: string;
  lang: string;
  dir: 'ltr' | 'rtl';
}

export const EN: StoryLocale = { locale: 'en', prefix: '', tz: 'America/New_York', name: 'anna reinhardt', first: 'Anna', lang: 'en', dir: 'ltr' };
export const HE: StoryLocale = { locale: 'he', prefix: '/he', tz: 'Asia/Jerusalem', name: 'דנה כהן', first: 'דנה', lang: 'he', dir: 'rtl' };

/** A page of the funnel: applyPath(HE, '/booking') -> /he/apply/booking, applyPath(EN) -> /apply. */
export const applyPath = (L: Pick<StoryLocale, 'prefix'>, sub = ''): string => `${L.prefix}${APPLY}${sub}`;

/** Real script errors on the page (a rejected sign-in or an expected 4xx is logged by the browser itself and does not count). */
export function watchProblems(page: Page): string[] {
  const problems: string[] = [];
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error' && !/Failed to load resource|net::ERR_/.test(m.text())) problems.push(`console: ${m.text()}`);
  });
  return problems;
}

export interface Person {
  ctx: BrowserContext;
  page: Page;
  problems: string[];
}

/** One browser (own cookie jar, own address for the rate limits) in the language and time zone of the story. */
export async function person(
  browser: Browser,
  opts: { locale: 'en' | 'he'; tz: string; viewport?: { width: number; height: number }; headers?: Record<string, string> },
): Promise<Person> {
  const ctx = await browser.newContext({
    viewport: opts.viewport ?? { width: 1440, height: 900 },
    locale: opts.locale === 'he' ? 'he-IL' : 'en-US',
    timezoneId: opts.tz,
    extraHTTPHeaders: { 'x-forwarded-for': newIp(), ...opts.headers },
  });
  const page = await ctx.newPage();
  return { ctx, page, problems: watchProblems(page) };
}

/** The answer buttons of the question on screen. */
export const quizOptions = (page: Page): Locator => page.locator('[role=group] button[aria-pressed]');

/**
 * Answers the six eligibility questions with the second option each (the next question slides in by itself after a
 * moment), checking the progress bar on the way; `from` is the number of questions that are already answered (the chat on
 * the landing page may have done the first ones). Ends on the details form.
 */
export async function answerSixQuestions(page: Page, firm: string, L: Pick<StoryLocale, 'prefix'>, from = 0): Promise<void> {
  for (let i = from; i < 6; i++) {
    await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow', String(Math.round((i / 6) * 100)));
    const question = (await page.locator('h1').textContent()) ?? '';
    await quizOptions(page).nth(1).click();
    if (i < 5) await expect(page.locator('h1')).not.toHaveText(question);
  }
  await expect(page).toHaveURL(urlIs(firm, applyPath(L, '/details')));
}

/** Fills the details form and sends it. Ends on the booking screen. */
export async function leaveDetails(page: Page, firm: string, L: Pick<StoryLocale, 'prefix'>, who: { name: string; email: string; phone?: string }): Promise<void> {
  await page.locator('#lead-name').fill(who.name);
  await page.locator('#lead-email').fill(who.email);
  await page.locator('#lead-phone').fill(who.phone ?? '+1 555 000 0000');
  await page.locator('form button[type=submit]').click();
  await expect(page).toHaveURL(urlIs(firm, applyPath(L, '/booking')));
}

/**
 * Books the second time of the third day and waits for the confirmation. Returns the label of the time that was chosen.
 * `texts` is the funnel.booking block of the language's messages. Other tests book at the same time against the same
 * database, so when a time "was just taken" the next one of that day is tried (a handful of times) instead of failing.
 */
export async function bookACall(page: Page, texts: { bookFor: string; done: { title: string }; notice: { taken: string } }): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const days = page.locator('[aria-labelledby=book-day] button');
    await expect(days).toHaveCount(5);
    await days.nth(2).click();
    const slots = page.locator('[aria-labelledby=book-time] button');
    await expect(slots.nth(1)).toBeVisible();
    const slot = slots.nth(Math.min(1 + attempt, (await slots.count()) - 1));
    const chosen = ((await slot.textContent()) ?? '').trim();
    await slot.click();
    await page.getByRole('button', { name: texts.bookFor.replace('{time}', chosen) }).click();
    const done = page.locator('h1').filter({ hasText: texts.done.title });
    const taken = page.getByText(texts.notice.taken);
    await expect(done.or(taken)).toBeVisible();
    if (await done.isVisible()) {
      await expect(page.locator('h1')).toHaveText(texts.done.title);
      return chosen;
    }
  }
  throw new Error('every time offered was taken by somebody else');
}

/**
 * "See my result" -> the offer -> "Go to my portal": the hand-over to the portal's site. Ends on the portal (the page of
 * the portal's origin; the lead's language decides whether it is /portal or /he/portal).
 */
export async function seeResultAndEnterPortal(
  page: Page,
  firm: string,
  L: Pick<StoryLocale, 'prefix'>,
  texts: { booking: { seeResult: string }; offer: { goPortal: string } },
): Promise<void> {
  await page.getByRole('button', { name: texts.booking.seeResult }).click();
  await expect(page).toHaveURL(urlIs(firm, applyPath(L, '/offer')));
  await page.getByRole('button', { name: texts.offer.goPortal }).click();
  await expect(page).toHaveURL(urlIs(PORTAL_URL, `${L.prefix}/portal`));
}

/** The names of the cookies a browser holds for an address. */
export async function cookieNames(ctx: BrowserContext, url: string): Promise<string[]> {
  return (await ctx.cookies(url)).map((c) => c.name);
}

/** true when the cookie jar of `url` holds a Supabase session (the portal's sign-in). */
export async function hasPortalSession(ctx: BrowserContext, url: string = PORTAL_URL): Promise<boolean> {
  return (await cookieNames(ctx, url)).some((n) => /^sb-.*-auth-token/.test(n));
}

/** One hop of a redirect chain. */
export interface Hop {
  url: string;
  status: number;
  location: string | null;
}

/**
 * Follows a redirect chain by hand (across the two sites too), one request per hop, and returns every hop; the last one is the
 * page that answered. `request` keeps its cookies, so the chain behaves like one browser (a language cookie set on the way
 * counts for the next hop).
 */
export async function followRedirects(
  request: APIRequestContext,
  from: string,
  headers: Record<string, string> = { accept: 'text/html' },
  maxHops = 6,
): Promise<Hop[]> {
  const hops: Hop[] = [];
  let url = from;
  for (let i = 0; i <= maxHops; i++) {
    const res = await request.get(url, { maxRedirects: 0, headers });
    const location = res.headers()['location'] ?? null;
    hops.push({ url, status: res.status(), location });
    if (res.status() < 300 || res.status() >= 400 || !location) return hops;
    url = new URL(location, url).toString();
  }
  throw new Error(`more than ${maxHops} redirects from ${from}: ${hops.map((h) => `${h.status} ${h.url}`).join(' -> ')}`);
}

/** path + query of an address, whatever the host and whether it is absolute or not ("/apply/eligibility?source=ad"). */
export const pathAndQuery = (url: string): string => {
  const u = new URL(url, 'http://placeholder.invalid');
  return `${u.pathname}${u.search}`;
};
