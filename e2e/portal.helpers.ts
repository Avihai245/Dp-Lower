/**
 * Test helpers for the portal end-to-end specs (e2e/portal.*.spec.ts).
 *
 * They need the local Supabase (docs/ARCHITECTURE.md section 3) and a running campaign app at PORTAL_BASE_URL
 * (default CAMPAIGN_URL, else http://localhost:3001). Every applicant is created through the service-role client with a unique
 * `portal-e2e+...@example.com` address and removed again by dispose(): the database is shared, so nothing is left behind
 * (outbox events of the test leads included, they must never reach the dispatcher).
 *
 * The Supabase libraries are loaded from apps/campaign (the repository root has no dependency on them).
 */
import { request as playwrightRequest, type APIRequestContext } from '@playwright/test';
import { randomBytes } from 'node:crypto';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

const campaignDir = path.join(__dirname, '..', 'apps', 'campaign');
const fromCampaign = createRequire(path.join(campaignDir, 'package.json'));

const envFile = path.join(campaignDir, '.env.local');
if (fs.existsSync(envFile)) process.loadEnvFile(envFile);

export const BASE_URL = process.env.PORTAL_BASE_URL ?? process.env.CAMPAIGN_URL ?? 'http://localhost:3001';

const need = (name: string): string => {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set (copy apps/campaign/.env.local from the main checkout)`);
  return v;
};
export const SUPABASE_URL = (): string => need('NEXT_PUBLIC_SUPABASE_URL');
export const ANON_KEY = (): string => need('NEXT_PUBLIC_SUPABASE_ANON_KEY');
export const SERVICE_KEY = (): string => need('SUPABASE_SERVICE_ROLE_KEY');

/*
 * What the specs use of supabase-js and @supabase/ssr. Both belong to apps/campaign (the repository root does not depend
 * on them), so they are loaded from there at run time and described here by the small part of their API that is used.
 */
export type Row = Record<string, unknown>;
interface Reply<T = unknown> {
  data: T | null;
  error: { message: string } | null;
}
/** A query that can be awaited, and narrowed with filters. */
interface Rows<T> extends PromiseLike<Reply<T>> {
  select(columns?: string): Rows<T>;
  eq(column: string, value: unknown): Rows<T>;
  single(): PromiseLike<Reply<Row>>;
  maybeSingle(): PromiseLike<Reply<Row>>;
}
interface Bucket {
  list(path: string, options?: { limit?: number }): Promise<Reply<Array<{ id: string | null; name: string }>>>;
  remove(paths: string[]): Promise<Reply>;
  download(path: string): Promise<Reply<Blob>>;
  uploadToSignedUrl(path: string, token: string, body: Buffer, options?: { contentType?: string }): Promise<Reply>;
}
interface Credentials {
  email: string;
  password: string;
}
export interface TestClient {
  from(table: string): {
    select(columns?: string): Rows<Row[]>;
    insert(values: Row | Row[]): Rows<Row[]>;
    update(values: Row): Rows<Row[]>;
    delete(): Rows<Row[]>;
  };
  storage: { from(bucket: string): Bucket };
  auth: {
    signInWithPassword(credentials: Credentials): Promise<Reply>;
    admin: {
      createUser(attributes: Credentials & { email_confirm?: boolean }): Promise<Reply<{ user: { id: string } }>>;
      deleteUser(id: string): Promise<Reply>;
    };
  };
}
interface ClientOptions {
  auth: { persistSession: boolean; autoRefreshToken: boolean };
}
interface CookieAdapter {
  getAll(): Array<{ name: string; value: string }>;
  setAll(cookies: Array<{ name: string; value: string }>): void;
}

const { createClient } = fromCampaign('@supabase/supabase-js') as { createClient: (url: string, key: string, options: ClientOptions) => TestClient };
const { createServerClient } = fromCampaign('@supabase/ssr') as {
  createServerClient: (url: string, key: string, options: { cookies: CookieAdapter }) => Pick<TestClient, 'auth'>;
};

const NO_SESSION: ClientOptions = { auth: { persistSession: false, autoRefreshToken: false } };

let admin: TestClient | undefined;
/** Service-role client (bypasses RLS): for setting up and for asserting on what the app wrote. */
export function adminDb(): TestClient {
  admin ??= createClient(SUPABASE_URL(), SERVICE_KEY(), NO_SESSION);
  return admin;
}

/** A browser-like Supabase client (anon key) for the direct-to-storage upload step. */
export function anonClient(): TestClient {
  return createClient(SUPABASE_URL(), ANON_KEY(), NO_SESSION);
}

export interface Applicant {
  email: string;
  password: string;
  leadId: string;
  caseRef: string;
  userId: string;
  /** requests as the signed-in applicant (session cookies) */
  api: APIRequestContext;
  /** the session cookies, for a browser context */
  cookies: Array<{ name: string; value: string; domain: string; path: string; expires: number; httpOnly: boolean; secure: boolean; sameSite: 'Lax' }>;
  dispose: () => Promise<void>;
}

interface ApplicantOptions {
  route?: 'germany' | 'austria' | 'both' | 'unsure';
  locale?: 'en' | 'he';
  fullName?: string;
}

/** Creates a lead with a Supabase user and a signed-in request context (the state after "Go to my portal"). */
export async function createApplicant(opts: ApplicantOptions = {}): Promise<Applicant> {
  const db = adminDb();
  const email = `portal-e2e+${Date.now()}-${randomBytes(4).toString('hex')}@example.com`;
  const password = `Pw-${randomBytes(9).toString('base64url')}`;

  const { data: created, error: userError } = await db.auth.admin.createUser({ email, password, email_confirm: true });
  if (userError || !created?.user) throw new Error(`createUser failed: ${userError?.message}`);
  const userId = created.user.id;

  const { data: lead, error: leadError } = await db
    .from('leads')
    .insert({
      full_name: opts.fullName ?? 'Portal Tester',
      email,
      phone: '+15551234567',
      locale: opts.locale ?? 'en',
      route: opts.route ?? 'austria',
      source: 'e2e-portal',
      user_id: userId,
      stage: 'account',
      status: 'account_created',
      account_created_at: new Date().toISOString(),
    })
    .select('*')
    .single();
  if (leadError || !lead) throw new Error(`creating the lead failed: ${leadError?.message}`);

  // sign in the way the browser does and keep the cookies @supabase/ssr would have set
  const jar = new Map<string, string>();
  const ssr = createServerClient(SUPABASE_URL(), ANON_KEY(), {
    cookies: {
      getAll: () => [...jar].map(([name, value]) => ({ name, value })),
      setAll: (list: Array<{ name: string; value: string }>) => list.forEach(({ name, value }) => jar.set(name, value)),
    },
  });
  const { error: signInError } = await ssr.auth.signInWithPassword({ email, password });
  if (signInError) throw new Error(`signInWithPassword failed: ${signInError.message}`);
  for (let i = 0; i < 20 && jar.size === 0; i++) await new Promise((r) => setTimeout(r, 50));
  if (jar.size === 0) throw new Error('no session cookies were produced');

  const domain = new URL(BASE_URL).hostname;
  const cookies = [...jar].map(([name, value]) => ({
    name,
    value,
    domain,
    path: '/',
    expires: -1,
    httpOnly: false,
    secure: false,
    sameSite: 'Lax' as const,
  }));
  const api = await playwrightRequest.newContext({ baseURL: BASE_URL, storageState: { cookies, origins: [] } });

  const id = String(lead.id);
  const dispose = async () => {
    await api.dispose();
    // files first (the folder is the lead id), then the rows that point at the lead, then the lead and its user
    for (const folder of await listFolders(id)) {
      const { data: files } = await db.storage.from('documents').list(folder, { limit: 100 });
      const paths = (files ?? []).map((f) => `${folder}/${f.name}`);
      if (paths.length) await db.storage.from('documents').remove(paths);
    }
    await db.from('events').delete().eq('lead_id', id);
    await db.from('leads').delete().eq('id', id);
    await db.auth.admin.deleteUser(userId);
  };

  return { email, password, leadId: id, caseRef: String(lead.case_ref), userId, api, cookies, dispose };
}

async function listFolders(id: string): Promise<string[]> {
  const { data } = await adminDb().storage.from('documents').list(id, { limit: 100 });
  return (data ?? []).filter((o) => !o.id).map((o) => `${id}/${o.name}`);
}

/** Objects stored for a lead, as full paths. */
export async function storedObjects(id: string): Promise<string[]> {
  const out: string[] = [];
  for (const folder of await listFolders(id)) {
    const { data } = await adminDb().storage.from('documents').list(folder, { limit: 100 });
    for (const f of data ?? []) if (f.id) out.push(`${folder}/${f.name}`);
  }
  return out;
}

/** An unauthenticated request context. */
export async function anonymousApi(): Promise<APIRequestContext> {
  return playwrightRequest.newContext({ baseURL: BASE_URL });
}

/** Every field of the application, filled in. */
export const FULL_APPLICATION: Record<string, string> = {
  fullName: 'Portal Tester',
  dob: '12/03/1988',
  birthPlace: 'Boston, USA',
  citizenship: 'United States',
  anName: 'Ruth Weiss',
  anRel: 'maternal grandmother',
  anDob: '04/05/1911',
  anBirthPlace: 'Vienna, Austria',
  anLeft: '1938',
  nameChanges: 'None',
  email: 'portal.tester@example.com',
  phone: '+1 555 123 4567',
  address: '1 Example Street, Boston, MA 02110',
};

/** A small, valid PDF. */
export function tinyPdf(extra = ''): Buffer {
  return Buffer.from(`%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n${extra}`);
}

/** The first bytes of a JPEG (enough for the portal's file-type check). */
export function tinyJpeg(): Buffer {
  return Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]), Buffer.from('JFIF\u0000'), Buffer.alloc(64, 1), Buffer.from([0xff, 0xd9])]);
}

export interface UploadedFile {
  path: string;
  token: string;
}

/**
 * The browser's two steps: ask the server for a signed upload URL, then send the bytes straight to storage with
 * uploadToSignedUrl. Returns the path and token; the caller confirms (or not).
 */
export async function uploadToStorage(
  api: APIRequestContext,
  docType: string,
  file: { name: string; mimeType: string; body: Buffer },
): Promise<UploadedFile> {
  const res = await api.post('/api/portal/documents/upload-url', {
    data: { docType, fileName: file.name, mimeType: file.mimeType, size: file.body.length },
  });
  if (!res.ok()) throw new Error(`upload-url failed: ${res.status()} ${await res.text()}`);
  const { path, token } = (await res.json()) as UploadedFile;
  const { error } = await anonClient().storage.from('documents').uploadToSignedUrl(path, token, file.body, { contentType: file.mimeType });
  if (error) throw new Error(`uploadToSignedUrl failed: ${error.message}`);
  return { path, token };
}
