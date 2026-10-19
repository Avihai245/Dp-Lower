import { expect, type APIRequestContext, type Browser, type Page } from '@playwright/test';
import { APPLY, BASE_URL, FUNNEL_URL, newIp } from './funnel';

/**
 * Helpers of the funnel browser specs (funnel.ui.spec.ts, funnel.booking.spec.ts). The funnel pages and the lead /
 * booking / availability APIs live on the firm's site (FUNNEL_URL, pages under /apply); the sign-in family, the portal,
 * the CRM and the emailed links live on the portal's site (BASE_URL). The specs never use a baseURL: every address is
 * spelled out with one of these two builders, so a page on the wrong site fails loudly instead of quietly 404ing.
 */

/** An address on the firm's site (the funnel and its APIs). */
export const onFunnel = (path: string): string => `${FUNNEL_URL}${path}`;
/** An address on the portal's site (sign-in, portal, CRM, emailed links). */
export const onPortal = (path: string): string => `${BASE_URL}${path}`;

export type UiLocale = 'en' | 'he';
export const prefixOf = (locale: UiLocale): string => (locale === 'he' ? '/he' : '');
/** A funnel page: applyPath('he', '/booking') -> /he/apply/booking, applyPath('en') -> /apply. */
export const applyPath = (locale: UiLocale, sub = ''): string => `${prefixOf(locale)}${APPLY}${sub}`;

export const originOf = (url: string): string => new URL(url).origin;

/** The same local server under a second host name, so that the two sites really do NOT share a cookie jar (see isolatedFunnelUrl). */
export function isolatedFunnelUrl(): string | null {
  const u = new URL(FUNNEL_URL);
  // cookies are keyed by host name, not by port: 127.0.0.1 and localhost are two different "sites" for the browser
  if (u.hostname !== 'localhost') return null;
  u.hostname = '127.0.0.1';
  return u.origin;
}

/**
 * A browser context with its own client address (the API rate-limits per IP) and a fixed visitor time zone. No baseURL.
 * A test that needs the two sites NOT to share cookies visits the firm's site under isolatedFunnelUrl().
 */
export async function newVisitor(
  browser: Browser,
  opts: { locale?: UiLocale; answers?: Record<string, string>; timezone?: string; viewport?: { width: number; height: number } } = {},
) {
  const context = await browser.newContext({
    locale: opts.locale === 'he' ? 'he-IL' : 'en-US',
    timezoneId: opts.timezone ?? 'America/New_York',
    ...(opts.viewport ? { viewport: opts.viewport } : {}),
    extraHTTPHeaders: { 'x-forwarded-for': newIp() },
  });
  if (opts.answers) await context.addInitScript((a) => localStorage.setItem('dpl-quiz-v1', JSON.stringify(a)), opts.answers);
  const page = await context.newPage();
  return { context, page, problems: watchProblems(page) };
}

/** Real script errors on the page (a rejected sign-in or an expected 4xx is logged by the browser itself and does not count). */
export function watchProblems(page: Page): string[] {
  const problems: string[] = [];
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) problems.push(`console: ${m.text()}`);
  });
  return problems;
}

/**
 * What "Go to my portal" does, without a browser: asks the firm's site for the one-time entry address (it must be on the
 * portal's site) and follows it ONCE, without following the redirect to the portal page. The portal session cookies end
 * up in `request`'s cookie jar. Returns the entry address.
 */
export async function enterPortal(request: APIRequestContext, funnelOrigin = FUNNEL_URL): Promise<string> {
  const res = await request.post(`${funnelOrigin}/api/portal/enter`);
  expect(res.status(), 'POST /api/portal/enter on the firm site').toBe(200);
  const { url } = (await res.json()) as { url: string };
  expect(originOf(url), 'the entry token page lives on the portal site').toBe(originOf(BASE_URL));
  expect(new URL(url).pathname).toMatch(/^(\/he)?\/enter\/[\w.-]+$/);
  const open = await request.get(url, { maxRedirects: 0 });
  expect([302, 303, 307]).toContain(open.status());
  expect(new URL(open.headers()['location']!, url).pathname).toMatch(/^(\/he)?\/portal$/);
  return url;
}
