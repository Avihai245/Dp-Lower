import { createHmac, randomBytes, randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { APIRequestContext, APIResponse, PlaywrightWorkerArgs } from '@playwright/test';

type PlaywrightRunner = PlaywrightWorkerArgs['playwright'];

/**
 * Helpers shared by the funnel end-to-end specs: the app under test (FUNNEL_BASE_URL), direct access to the local
 * Supabase (service role, for assertions and clean-up only) and a few builders. Everything the specs create uses
 * emails of the form e2e-funnel-<run>-<n>@example.com so it can be found and deleted again.
 */
export const BASE_URL = process.env.FUNNEL_BASE_URL ?? 'http://localhost:3103';

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
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: 'POST',
    headers: adminHeaders(),
    body: JSON.stringify({ email, password, email_confirm: true }),
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
  await fetch(`${SUPABASE_URL}/rest/v1/callback_requests?name=like.${encodeURIComponent(`e2e-funnel-${RUN}*`)}`, { method: 'DELETE', headers: adminHeaders() });
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
