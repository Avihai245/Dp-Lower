import { request as playwrightRequest, type APIRequestContext } from '@playwright/test';
import { loadAppEnv } from '../../scripts/bootstrap-admin';

/**
 * Plain-HTTP helpers for the end-to-end specs that deal with accounts and emails (the team spec, e2e/admin.team.spec.ts):
 * password and refresh-token grants against the local auth server, the service-role lookups of an account and of the
 * emails queued for an address, and the way an emailed "set your password" link is followed to the end. They only use
 * `fetch` and Playwright's request client (the repository root does not depend on supabase-js) and are separate from
 * e2e/support/funnel.ts, which belongs to the funnel specs.
 */

const appEnv = () => {
  const e = loadAppEnv();
  const url = e.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, '');
  const service = e.SUPABASE_SERVICE_ROLE_KEY;
  const anon = e.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !service || !anon)
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY are not set (see apps/campaign/.env.local)',
    );
  return { url, service, anon };
};

const serviceHeaders = () => {
  const { service } = appEnv();
  return { apikey: service, authorization: `Bearer ${service}`, 'content-type': 'application/json' };
};

export interface Grant {
  ok: boolean;
  status: number;
  accessToken: string | null;
  refreshToken: string | null;
}

async function grant(type: 'password' | 'refresh_token', body: Record<string, string>): Promise<Grant> {
  const { url, anon } = appEnv();
  const res = await fetch(`${url}/auth/v1/token?grant_type=${type}`, {
    method: 'POST',
    headers: { apikey: anon, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = (await res.json().catch(() => ({}))) as { access_token?: string; refresh_token?: string };
  return {
    ok: res.ok,
    status: res.status,
    accessToken: json.access_token ?? null,
    refreshToken: json.refresh_token ?? null,
  };
}

/** Password sign-in at the auth server: a session when the password is right, a refusal when it is not. */
export const passwordGrant = (email: string, password: string): Promise<Grant> =>
  grant('password', { email, password });

/** Exchanges a refresh token for a new session: refused once the session behind it has been ended. */
export const refreshGrant = (refreshToken: string): Promise<Grant> =>
  grant('refresh_token', { refresh_token: refreshToken });

/** The id of the account with this email address (any case), or null. */
export async function accountIdByEmail(email: string): Promise<string | null> {
  const { url } = appEnv();
  const res = await fetch(`${url}/rest/v1/rpc/auth_user_id_by_email`, {
    method: 'POST',
    headers: serviceHeaders(),
    body: JSON.stringify({ p_email: email.toLowerCase() }),
  });
  if (!res.ok) throw new Error(`auth_user_id_by_email failed: ${res.status} ${await res.text()}`);
  return ((await res.json()) as string | null) ?? null;
}

export interface Account {
  id: string;
  email: string;
  email_confirmed_at: string | null;
  user_metadata: Record<string, unknown>;
}

export async function accountById(id: string): Promise<Account> {
  const { url } = appEnv();
  const res = await fetch(`${url}/auth/v1/admin/users/${id}`, { headers: serviceHeaders() });
  if (!res.ok) throw new Error(`reading account ${id} failed: ${res.status}`);
  return (await res.json()) as Account;
}

export interface QueuedEmail {
  id: string;
  type: string;
  lead_id: string | null;
  dedupe_key: string | null;
  status: string;
  payload: {
    template: string;
    locale: string;
    subject: string;
    category?: string;
    to: { email: string; name?: string };
    html: string;
    text: string;
  };
}

/** The emails queued in the outbox for one recipient (staff have no lead: the recipient is only in the payload). */
export async function emailsTo(email: string): Promise<QueuedEmail[]> {
  const { url } = appEnv();
  const query = `type=eq.email.send&payload->to->>email=eq.${encodeURIComponent(email.toLowerCase())}&order=created_at.asc&select=*`;
  const res = await fetch(`${url}/rest/v1/events?${query}`, { headers: serviceHeaders() });
  if (!res.ok) throw new Error(`reading the outbox failed: ${res.status} ${await res.text()}`);
  return (await res.json()) as QueuedEmail[];
}

/** The "set your password" link of an emailed message, or null. Entities of the HTML part are decoded. */
export function passwordLinkOf(email: QueuedEmail): URL | null {
  const text = `${email.payload.text ?? ''}\n${email.payload.html ?? ''}`.replace(/&amp;/g, '&');
  const m = /https?:\/\/[^\s"'<>]+\/auth\/callback\?[^\s"'<>]+/.exec(text);
  return m ? new URL(m[0]) : null;
}

/**
 * Removes everything an invited address left behind: queued emails, an applicant lead with that address, the staff row and
 * the account itself (the staff row goes with the account).
 */
export async function removeTraces(email: string): Promise<void> {
  const { url } = appEnv();
  const lower = encodeURIComponent(email.toLowerCase());
  const headers = serviceHeaders();
  const id = await accountIdByEmail(email).catch(() => null);
  await fetch(`${url}/rest/v1/events?type=eq.email.send&payload->to->>email=eq.${lower}`, {
    method: 'DELETE',
    headers,
  }).catch(() => undefined);
  const leads = (await (
    await fetch(`${url}/rest/v1/leads?email=eq.${lower}&select=id`, { headers })
  )
    .json()
    .catch(() => [])) as Array<{ id: string }>;
  for (const l of leads) {
    await fetch(`${url}/rest/v1/events?lead_id=eq.${l.id}`, { method: 'DELETE', headers }).catch(
      () => undefined,
    );
    await fetch(`${url}/rest/v1/leads?id=eq.${l.id}`, { method: 'DELETE', headers }).catch(() => undefined);
  }
  if (id)
    await fetch(`${url}/auth/v1/admin/users/${id}`, { method: 'DELETE', headers }).catch(() => undefined);
}

/**
 * Follows an emailed password-reset link the way a person does, without a browser: the confirmation button of /open-link is
 * a form POST to /auth/callback (a mail scanner's GET must not use the one-time token up), which opens the session, and the
 * "set a password" screen saves the new password with POST /api/auth/set-password. Returns the signed-in client (dispose it)
 * and where the confirmation sent the browser.
 */
export async function completePasswordLink(
  baseURL: string,
  link: URL,
  password: string,
  clientAddress: string,
): Promise<{ api: APIRequestContext; landedOn: string; saved: number }> {
  const origin = new URL(baseURL).origin;
  const api = await playwrightRequest.newContext({
    baseURL: origin,
    extraHTTPHeaders: { 'x-forwarded-for': clientAddress },
  });
  const entry = await api.get(`${link.pathname}${link.search}`, { maxRedirects: 0 });
  if (entry.status() < 300 || entry.status() >= 400)
    throw new Error(
      `the emailed link answered ${entry.status()}, expected a redirect to the confirmation page`,
    );
  const confirm = new URL(entry.headers().location ?? '', origin);
  if (!/\/open-link$/.test(confirm.pathname))
    throw new Error(`the emailed link led to ${confirm.pathname}, expected /open-link`);
  const tokenHash = confirm.searchParams.get('r');
  const next = confirm.searchParams.get('next');
  if (!tokenHash) throw new Error('the confirmation page has no token');
  const callback = confirm.pathname.replace(/open-link$/, 'auth/callback');
  const opened = await api.post(callback, {
    form: { token_hash: tokenHash, type: 'recovery', ...(next ? { next } : {}) },
    headers: { origin },
    maxRedirects: 0,
  });
  const landedOn = new URL(opened.headers().location ?? '', origin);
  const saved = (
    await api.post('/api/auth/set-password', { data: { password }, headers: { origin } })
  ).status();
  return { api, landedOn: `${landedOn.pathname}${landedOn.search}`, saved };
}
