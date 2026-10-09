import { loadAppEnv } from '../../scripts/bootstrap-admin';

/**
 * Service-role access to the local Supabase for the end-to-end tests: seed data, read back what the CRM wrote
 * (rows, activity_log, outbox events) and clean up. Plain fetch (the repository root does not depend on supabase-js).
 * Tests only ever touch rows they created themselves (unique emails, `source = 'e2e-admin'`).
 */

const env = () => {
  const e = loadAppEnv();
  const url = e.NEXT_PUBLIC_SUPABASE_URL;
  const key = e.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not set (see apps/campaign/.env.local)');
  return { url: url.replace(/\/$/, ''), key };
};

interface Init {
  method?: string;
  body?: unknown;
  prefer?: string;
  raw?: Buffer | Uint8Array;
  contentType?: string;
}

async function call(path: string, init: Init = {}): Promise<unknown> {
  const { url, key } = env();
  const res = await fetch(`${url}${path}`, {
    method: init.method ?? (init.body === undefined && !init.raw ? 'GET' : 'POST'),
    headers: {
      apikey: key,
      authorization: `Bearer ${key}`,
      ...(init.raw ? { 'content-type': init.contentType ?? 'application/octet-stream' } : { 'content-type': 'application/json' }),
      ...(init.prefer ? { prefer: init.prefer } : {}),
    },
    body: init.raw ? Buffer.from(init.raw) : init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${init.method ?? 'GET'} ${path} -> ${res.status}: ${text.slice(0, 400)}`);
  return text ? JSON.parse(text) : null;
}

const q = (v: string | number) => encodeURIComponent(String(v));

export type Row = Record<string, unknown> & { id?: string };

/** `select('leads', 'email=eq.x&select=id')` */
export const select = async <T = Row>(table: string, query = ''): Promise<T[]> => (await call(`/rest/v1/${table}?${query}`)) as T[];

export const insert = async <T = Row>(table: string, rows: Row | Row[]): Promise<T[]> =>
  (await call(`/rest/v1/${table}`, { body: rows, prefer: 'return=representation' })) as T[];

export const update = async <T = Row>(table: string, filter: string, patch: Row): Promise<T[]> =>
  (await call(`/rest/v1/${table}?${filter}`, { method: 'PATCH', body: patch, prefer: 'return=representation' })) as T[];

export const remove = async (table: string, filter: string): Promise<void> => {
  await call(`/rest/v1/${table}?${filter}`, { method: 'DELETE' });
};

/** `eq(value)` for filters: eq.<url-encoded value> */
export const eq = (v: string | number) => `eq.${q(v)}`;
export const inList = (values: string[]) => `in.(${values.map((v) => q(v)).join(',')})`;

// -- convenience reads used by the specs --------------------------------------------------------------------------------

export const getLead = async (id: string) => (await select<Row>('leads', `id=${eq(id)}&select=*`))[0]!;
export const getDoc = async (leadId: string, docType: string) =>
  (await select<Row>('documents', `lead_id=${eq(leadId)}&doc_type=${eq(docType)}&select=*`))[0] ?? null;
export const activity = (leadId: string, code?: string) =>
  select<Row>('activity_log', `lead_id=${eq(leadId)}${code ? `&code=${eq(code)}` : ''}&order=created_at.desc&select=*`);
export const events = (leadId: string, type?: string) =>
  select<Row>('events', `lead_id=${eq(leadId)}${type ? `&type=${eq(type)}` : ''}&order=created_at.desc&select=*`);
/** email.send events of a lead, optionally one template */
export const emails = async (leadId: string, template?: string) =>
  (await events(leadId, 'email.send')).filter((e) => !template || (e.payload as { template?: string }).template === template);

/** Polls `read` until `ok` accepts what it returns (rows written a moment after the screen changed). */
export async function eventually<T>(read: () => Promise<T>, ok: (v: T) => boolean, timeoutMs = 12_000): Promise<T> {
  const started = Date.now();
  for (;;) {
    const value = await read();
    if (ok(value)) return value;
    if (Date.now() - started > timeoutMs) throw new Error(`timed out waiting for the database; last value: ${JSON.stringify(value).slice(0, 300)}`);
    await new Promise((r) => setTimeout(r, 250));
  }
}
/** activity_log rows with this code, once at least `n` exist */
export const activityAfter = (leadId: string, code: string, n = 1) => eventually(() => activity(leadId, code), (rows) => rows.length >= n);
/** outbox events of this type, once at least `n` exist */
export const eventsAfter = (leadId: string, type: string, n = 1) => eventually(() => events(leadId, type), (rows) => rows.length >= n);

// -- auth users ----------------------------------------------------------------------------------------------------------

export async function createAuthUser(email: string, password: string, fullName: string): Promise<string> {
  const u = (await call('/auth/v1/admin/users', { body: { email, password, email_confirm: true, user_metadata: { full_name: fullName } } })) as { id: string };
  return u.id;
}
export const getAuthUser = async (id: string) => (await call(`/auth/v1/admin/users/${id}`)) as { id: string; email: string; user_metadata?: Record<string, unknown> };
export const deleteAuthUser = async (id: string): Promise<void> => {
  await call(`/auth/v1/admin/users/${id}`, { method: 'DELETE' });
};

// -- storage -------------------------------------------------------------------------------------------------------------

export async function uploadObject(bucket: string, path: string, body: Buffer, contentType: string): Promise<void> {
  await call(`/storage/v1/object/${bucket}/${path.split('/').map(q).join('/')}`, { method: 'POST', raw: body, contentType });
}
/** Whether a stored object exists (read with the service role). */
export async function objectExists(bucket: string, path: string): Promise<boolean> {
  const { url, key } = env();
  const res = await fetch(`${url}/storage/v1/object/${bucket}/${path.split('/').map(q).join('/')}`, { headers: { apikey: key, authorization: `Bearer ${key}` } });
  await res.arrayBuffer();
  return res.ok;
}
export async function removeObjects(bucket: string, paths: string[]): Promise<void> {
  if (paths.length) await call(`/storage/v1/object/${bucket}`, { method: 'DELETE', body: { prefixes: paths } });
}
export const storageUrl = () => env().url;
