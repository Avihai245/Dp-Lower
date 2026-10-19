import { createHmac, randomBytes, randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { APIRequestContext, APIResponse, PlaywrightWorkerArgs } from '@playwright/test';

type PlaywrightRunner = PlaywrightWorkerArgs['playwright'];

/**
 * Helpers shared by the funnel end-to-end specs: the two apps under test (BASE_URL = the portal, FUNNEL_URL = the firm's
 * site with the funnel under /apply; see "the two sites" below for clients that keep their cookies apart), direct access to
 * the local Supabase (service role, for assertions and clean-up only) and a few builders. Everything the specs create uses
 * emails of the form e2e-funnel-<run>-<n>@example.com so it can be found and deleted again.
 */
/** The client portal, sign-in and staff CRM (apps/campaign, euro-passports.com in production). */
export const BASE_URL = process.env.PORTAL_BASE_URL ?? process.env.CAMPAIGN_URL ?? 'http://localhost:3001';
/**
 * The landing pages and the eligibility funnel (apps/main, lawoffice.org.il in production): pages under /apply and the lead /
 * booking / availability / callback / result APIs. "Go to my portal" hands the browser over to BASE_URL.
 */
export const FUNNEL_URL = process.env.FUNNEL_BASE_URL ?? process.env.MAIN_URL ?? 'http://localhost:3000';
/** The path under which the funnel pages live on FUNNEL_URL. */
export const APPLY = '/apply';

function readEnvFile(): Record<string, string> {
  const file = path.resolve(__dirname, '../../apps/campaign/.env.local');
  if (!fs.existsSync(file)) return {};
  const out: Record<string, string> = {};
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const i = line.indexOf('=');
    if (i > 0 && !line.trim().startsWith('#')) out[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  return out;
}
const fileEnv = readEnvFile();
const env = (k: string): string => process.env[k] ?? fileEnv[k] ?? '';

export const SUPABASE_URL = env('NEXT_PUBLIC_SUPABASE_URL') || 'http://127.0.0.1:54321';
export const SERVICE_KEY = env('SUPABASE_SERVICE_ROLE_KEY');
export const ANON_KEY = env('NEXT_PUBLIC_SUPABASE_ANON_KEY');
export const APP_SECRET = env('APP_SECRET').length >= 32 ? env('APP_SECRET') : 'dev-only-secret-dev-only-secret-dev-only-secret';

export const RUN = `${Date.now().toString(36)}${randomBytes(2).toString('hex')}`;
let counter = 0;
export const newEmail = (label = 'lead'): string => `e2e-funnel-${RUN}-${label}-${++counter}@example.com`;

/** A distinct client address per call: the API rate-limits by IP, and the spec must not trip its own limits. */
export const newIp = (): string => `10.${Math.floor(Math.random() * 250) + 1}.${Math.floor(Math.random() * 250) + 1}.${Math.floor(Math.random() * 250) + 1}`;

export const leadBody = (email: string, extra: Record<string, unknown> = {}) => ({
  fullName: 'anna reinhardt',
  email,
  phone: '+1 555 000 0000',
  locale: 'en',
  answers: { country: 'germany', relative: 'grandparent' },
  ...extra,
});

/** A client that behaves like one browser: its own cookie jar and its own address. */
export async function newClient(playwright: PlaywrightRunner, ip = newIp()): Promise<APIRequestContext> {
  return playwright.request.newContext({ baseURL: BASE_URL, extraHTTPHeaders: { 'x-forwarded-for': ip } });
}

export const setCookies = (res: APIResponse): string[] =>
  res.headersArray().filter((h) => h.name.toLowerCase() === 'set-cookie').map((h) => h.value);

// ---- the two sites -------------------------------------------------------------------------------------------------------
//
// Production serves the funnel (apps/main, lawoffice.org.il) and the portal (apps/campaign, euro-passports.com) from two
// different domains, so a browser never presents one site's cookies to the other. On localhost cookies ignore the port
// and WOULD be shared. The helpers below therefore give a person one cookie jar per site (a "visitor"), and the only way
// from the funnel to the portal is the real hand-over ("Go to my portal": POST /api/portal/enter, then the link it returns).

/** The origins ("http://localhost:3000") of the firm's site and of the portal. */
export const FUNNEL_ORIGIN = new URL(FUNNEL_URL).origin;
export const PORTAL_ORIGIN = new URL(BASE_URL).origin;

/** A client of the firm's site (funnel pages and funnel APIs): its own cookie jar and its own address. */
export async function newFunnelClient(playwright: PlaywrightRunner, ip = newIp()): Promise<APIRequestContext> {
  return playwright.request.newContext({ baseURL: FUNNEL_URL, extraHTTPHeaders: { 'x-forwarded-for': ip } });
}

/** A client of the portal site: the same as newClient(), named for what it is. */
export const newPortalClient = newClient;

/**
 * A client of `baseURL` that starts with the cookies of other clients (their cookie jars merged). Use it for "the browser
 * holds X" situations without relying on one shared jar. Note that on localhost a cookie is sent to BOTH sites whichever
 * client it came from, which production never does: use it for what a cookie alone can do, not for what a site can see.
 */
export async function newClientWithCookiesOf(
  playwright: PlaywrightRunner,
  baseURL: string,
  from: APIRequestContext[],
  options: { only?: string[]; ip?: string } = {},
): Promise<APIRequestContext> {
  const cookies = (await Promise.all(from.map(async (c) => (await c.storageState()).cookies))).flat();
  return playwright.request.newContext({
    baseURL,
    extraHTTPHeaders: { 'x-forwarded-for': options.ip ?? newIp() },
    storageState: { cookies: options.only ? cookies.filter((c) => options.only!.includes(c.name)) : cookies, origins: [] },
  });
}

/** One person with one browser: a cookie jar for the firm's site and a separate one for the portal, same address. */
export interface Visitor {
  funnel: APIRequestContext;
  portal: APIRequestContext;
  ip: string;
  dispose(): Promise<void>;
}

export async function newVisitor(playwright: PlaywrightRunner, ip = newIp()): Promise<Visitor> {
  const funnel = await newFunnelClient(playwright, ip);
  const portal = await newClient(playwright, ip);
  return { funnel, portal, ip, dispose: async () => void (await Promise.all([funnel.dispose(), portal.dispose()])) };
}

/**
 * "Go to my portal", the way the browser does it: POST /api/portal/enter on the firm's site (needs the lead cookie there)
 * returns { url } to /enter/<token> on the portal; following it with the portal's own jar opens the session and redirects to
 * the portal. Returns both responses (the redirect is NOT followed, so the caller can inspect it) and the link.
 */
export async function goToPortal(visitor: Visitor): Promise<{ enter: APIResponse; url: string; landed: APIResponse }> {
  const enter = await visitor.funnel.post('/api/portal/enter');
  if (enter.status() !== 200) throw new Error(`POST /api/portal/enter answered ${enter.status()}: ${await enter.text()}`);
  const { url } = (await enter.json()) as { url: string };
  return { enter, url, landed: await visitor.portal.get(url, { maxRedirects: 0 }) };
}

/** Where a redirect response points, as path + query ("/portal", "/sign-in?error=link"), whatever the host. */
export function redirectPath(res: APIResponse): string {
  const location = res.headers().location;
  if (!location) throw new Error(`${res.url()} answered ${res.status()} without a Location header`);
  const u = new URL(location, res.url());
  return `${u.pathname}${u.search}`;
}

/** The full target of a redirect response. */
export const redirectUrl = (res: APIResponse): URL => new URL(res.headers().location ?? '', res.url());

/** The payload of a signed app token (lead cookie, /go and /enter links), without checking the signature. */
export function decodeAppToken(token: string): Record<string, unknown> & { exp?: number; p?: string } {
  return JSON.parse(Buffer.from(token.split('.')[0]!, 'base64url').toString('utf8')) as Record<string, unknown>;
}

// ---- Supabase (service role) ----------------------------------------------------------------------------------------

const adminHeaders = () => ({ apikey: SERVICE_KEY, authorization: `Bearer ${SERVICE_KEY}`, 'content-type': 'application/json' });

export async function rest<T = Record<string, unknown>>(table: string, query = ''): Promise<T[]> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, { headers: adminHeaders() });
  if (!res.ok) throw new Error(`rest ${table}?${query}: ${res.status} ${await res.text()}`);
  return (await res.json()) as T[];
}

/** A recovery link the way the auth server would put it into an email: the one-time hashed token. */
export async function recoveryTokenHash(email: string): Promise<string> {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/generate_link`, {
    method: 'POST',
    headers: adminHeaders(),
    body: JSON.stringify({ type: 'recovery', email }),
  });
  const body = (await res.json()) as { hashed_token?: string };
  if (!res.ok || !body.hashed_token) throw new Error(`generate_link failed: ${res.status}`);
  return body.hashed_token;
}

export interface LeadRecord {
  id: string;
  case_ref: string;
  email: string;
  full_name: string;
  phone: string | null;
  locale: string;
  route: string | null;
  answers: Record<string, string>;
  source: string;
  utm: Record<string, string>;
  stage: string;
  status: string;
  session_epoch: number;
  user_id: string | null;
  password_set_at: string | null;
  email_verified_at: string | null;
  account_created_at: string | null;
  unsubscribed_at: string | null;
  result_emailed_at: string | null;
  consented_at: string | null;
}

export async function leadByEmail(email: string): Promise<LeadRecord | null> {
  return (await rest<LeadRecord>('leads', `email=eq.${encodeURIComponent(email)}&select=*`))[0] ?? null;
}

export interface EventRecord {
  id: string;
  type: string;
  channel: string;
  lead_id: string | null;
  dedupe_key: string | null;
  payload: Record<string, unknown> & { template?: string; to?: { email: string }; html?: string; text?: string };
  status: string;
}

export async function eventsOf(leadId: string): Promise<EventRecord[]> {
  return rest<EventRecord>('events', `lead_id=eq.${leadId}&order=created_at.asc&select=*`);
}

/** Polls until `fn` returns something truthy (work that runs after the response, e.g. the reset email). */
export async function eventually<T>(fn: () => Promise<T | null | undefined | false>, what: string, timeoutMs = 8000): Promise<T> {
  const until = Date.now() + timeoutMs;
  for (;;) {
    const v = await fn();
    if (v) return v;
    if (Date.now() > until) throw new Error(`timed out waiting for ${what}`);
    await new Promise((r) => setTimeout(r, 150));
  }
}

const createdUsers: string[] = [];

/** A confirmed auth user with a password (for the staff tests); removed again by cleanup(). */
export async function createAuthUser(email: string, password: string): Promise<string> {
  return createAuthUserWith(email, password, {});
}

/** createAuthUser() with `app_metadata` (e.g. the lead_id the server writes on an account it made for a lead). */
export async function createAuthUserWith(email: string, password: string, appMetadata: Record<string, unknown>): Promise<string> {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: 'POST',
    headers: adminHeaders(),
    body: JSON.stringify({ email, password, email_confirm: true, ...(Object.keys(appMetadata).length ? { app_metadata: appMetadata } : {}) }),
  });
  const body = (await res.json()) as { id?: string };
  if (!res.ok || !body.id) throw new Error(`createUser failed: ${res.status}`);
  createdUsers.push(body.id);
  return body.id;
}

/** Makes an auth user a member of the firm's staff (the CRM role table). Deleted together with the user. */
export async function makeStaff(userId: string, email: string): Promise<void> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/staff`, {
    method: 'POST',
    headers: adminHeaders(),
    body: JSON.stringify({ user_id: userId, full_name: 'E2E Staff', email, role: 'case_manager' }),
  });
  if (!res.ok) throw new Error(`staff insert failed: ${res.status} ${await res.text()}`);
}

/** Removes everything this run created (leads cascade to bookings, activity and notes). */
export async function cleanup(): Promise<void> {
  const like = encodeURIComponent(`e2e-funnel-${RUN}-*`);
  const leads = await rest<{ id: string; user_id: string | null }>('leads', `email=like.${like}&select=id,user_id`);
  for (const l of leads) {
    await fetch(`${SUPABASE_URL}/rest/v1/events?lead_id=eq.${l.id}`, { method: 'DELETE', headers: adminHeaders() });
  }
  // emails to staff have no lead: the recipient is only in the payload
  await fetch(`${SUPABASE_URL}/rest/v1/events?type=eq.email.send&payload->to->>email=like.${like}`, { method: 'DELETE', headers: adminHeaders() });
  await fetch(`${SUPABASE_URL}/rest/v1/leads?email=like.${like}`, { method: 'DELETE', headers: adminHeaders() });
  const users = [...leads.flatMap((l) => (l.user_id ? [l.user_id] : [])), ...createdUsers];
  for (const id of users) {
    await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${id}`, { method: 'DELETE', headers: adminHeaders() });
  }
  const callbackName = encodeURIComponent(`e2e-funnel-${RUN}*`);
  // the CRM event of a callback request names the person in its payload (a visitor without a lead has no lead id)
  await fetch(`${SUPABASE_URL}/rest/v1/events?type=eq.callback.requested&payload->callback->>name=like.${callbackName}`, { method: 'DELETE', headers: adminHeaders() });
  await fetch(`${SUPABASE_URL}/rest/v1/callback_requests?name=like.${callbackName}`, { method: 'DELETE', headers: adminHeaders() });
}

/** Password sign-in against the auth server, to prove a password really was set. */
export async function passwordSignIn(email: string, password: string): Promise<boolean> {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: ANON_KEY, 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  return res.ok;
}

// ---- tokens ---------------------------------------------------------------------------------------------------------

const b64url = (b: Buffer) => b.toString('base64url');

/** Same format as signToken() in @dpl/core: base64url(payload).base64url(HMAC-SHA256(secret, base64url(payload))). */
export function signAppToken(payload: Record<string, unknown>, ttlSeconds?: number): string {
  const body = ttlSeconds ? { ...payload, exp: Math.floor(Date.now() / 1000) + ttlSeconds } : payload;
  const data = b64url(Buffer.from(JSON.stringify(body)));
  return `${data}.${b64url(createHmac('sha256', APP_SECRET).update(data).digest())}`;
}

/** First https?:// link of the given shape in an email payload. */
export function linkIn(payload: EventRecord['payload'], pattern: RegExp): string | null {
  const text = `${payload.text ?? ''}\n${payload.html ?? ''}`;
  const m = pattern.exec(text);
  return m ? m[0].replace(/&amp;/g, '&') : null;
}

export const uuid = randomUUID;

/**
 * Is the portal (apps/campaign) running with its Hebrew edition on (NEXT_PUBLIC_CAMPAIGN_LOCALES=en,he)? In the default
 * English-only setting every address under /he (the staff area aside) is redirected to the English page. The Hebrew tests
 * need the bilingual build; the English-only tests need the default one.
 * (The bare /he cannot tell the two apart any more: the portal's root is its sign-in, so /he redirects in both builds.
 * /he/sign-in is a page in the bilingual build and a redirect in the English-only one.)
 */
export async function campaignIsBilingual(): Promise<boolean> {
  const res = await fetch(`${BASE_URL}/he/sign-in`, { redirect: 'manual', headers: { accept: 'text/html' } });
  return res.status !== 307 && res.status !== 308;
}

/**
 * The same question for the funnel on the firm's site: is its Hebrew edition (/he/apply/...) on? Without it /he/apply is
 * redirected to /apply (the firm's own pages are Hebrew either way).
 */
export async function funnelIsBilingual(): Promise<boolean> {
  const res = await fetch(`${FUNNEL_URL}/he/apply`, { redirect: 'manual', headers: { accept: 'text/html' } });
  return res.status !== 307 && res.status !== 308;
}

/** The Hebrew edition is on in both apps (the funnel on the firm's site and the portal). Hebrew tests skip themselves otherwise. */
export async function hebrewIsOn(): Promise<boolean> {
  return (await funnelIsBilingual()) && (await campaignIsBilingual());
}

/** The message of a skipped Hebrew test. */
export const NO_HEBREW =
  'the Hebrew edition is switched off in this build (NEXT_PUBLIC_CAMPAIGN_LOCALES): see english-only.spec.ts';

/** The languages the apps serve in this build: ['en', 'he'] when the Hebrew edition is on, else ['en']. */
export async function activeLocales(): Promise<Array<'en' | 'he'>> {
  return (await hebrewIsOn()) ? ['en', 'he'] : ['en'];
}
