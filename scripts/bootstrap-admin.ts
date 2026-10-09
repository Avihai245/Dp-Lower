/**
 * Creates (or promotes) a member of staff for the firm's CRM at /admin.
 *
 *   pnpm bootstrap:admin you@firm.com "Full Name" [password]
 *
 * What it does, with the Supabase service role (never run it from the browser, never commit the key):
 *   1. finds the Supabase user with that email, or creates it (email already confirmed);
 *   2. sets the password when one is given (an existing account keeps its password otherwise); a NEW account without
 *      a password argument gets a random one, which is printed once;
 *   3. writes the `staff` row with role `admin` and `active = true` (an existing row is updated, so running it again
 *      promotes / re-activates the person).
 * Sign in at /sign-in with that email and password, then open /admin.
 *
 * Connection: SUPABASE URL and service key come from the environment (NEXT_PUBLIC_SUPABASE_URL,
 * SUPABASE_SERVICE_ROLE_KEY), or from apps/campaign/.env.local when they are not set. Plain fetch, no dependencies,
 * so it also runs on a server that only has the repository's root install.
 *
 * `bootstrapStaff()` is exported for the end-to-end tests, which create their staff users with the same code.
 */
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export type StaffRole = 'admin' | 'lawyer' | 'case_manager';

export interface SupabaseEnv {
  url: string;
  serviceKey: string;
}

export interface BootstrapOptions {
  email: string;
  fullName: string;
  password?: string;
  role?: StaffRole;
  env?: SupabaseEnv;
}

export interface BootstrapResult {
  userId: string;
  /** false when the Supabase user already existed */
  created: boolean;
  /** the password that was generated (new account without a password argument), otherwise null */
  generatedPassword: string | null;
}

function parseEnvFile(path: string): Record<string, string> {
  if (!existsSync(path)) return {};
  const out: Record<string, string> = {};
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (m) out[m[1]!] = m[2]!.replace(/^(['"])(.*)\1$/, '$2');
  }
  return out;
}

/** Values from apps/campaign/.env.local (looked up from the current directory and its parents); {} when there is none. */
function readEnvFile(): Record<string, string> {
  for (const base of [process.cwd(), resolve(process.cwd(), '..'), resolve(process.cwd(), '../..')]) {
    for (const rel of ['apps/campaign/.env.local', '.env.local']) {
      const file = parseEnvFile(resolve(base, rel));
      if (Object.keys(file).length) return file;
    }
  }
  return {};
}

/** The app's environment: the process environment first, then apps/campaign/.env.local. */
export function loadAppEnv(): Record<string, string | undefined> {
  return { ...readEnvFile(), ...Object.fromEntries(Object.entries(process.env).filter(([, v]) => v)) };
}

export function loadSupabaseEnv(): SupabaseEnv {
  const env = loadAppEnv();
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or fill apps/campaign/.env.local).');
  }
  return { url: url.replace(/\/$/, ''), serviceKey };
}

async function call<T>(env: SupabaseEnv, path: string, init: { method?: string; body?: unknown; prefer?: string } = {}): Promise<T> {
  const res = await fetch(`${env.url}${path}`, {
    method: init.method ?? (init.body === undefined ? 'GET' : 'POST'),
    headers: {
      apikey: env.serviceKey,
      authorization: `Bearer ${env.serviceKey}`,
      'content-type': 'application/json',
      ...(init.prefer ? { prefer: init.prefer } : {}),
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${init.method ?? 'GET'} ${path} failed (${res.status}): ${text.slice(0, 300)}`);
  return (text ? JSON.parse(text) : null) as T;
}

/** The id of the Supabase user with this email, or null. */
export async function findUserId(env: SupabaseEnv, email: string): Promise<string | null> {
  return call<string | null>(env, '/rest/v1/rpc/auth_user_id_by_email', { body: { p_email: email.toLowerCase() } });
}

export async function bootstrapStaff(opts: BootstrapOptions): Promise<BootstrapResult> {
  const env = opts.env ?? loadSupabaseEnv();
  const email = opts.email.trim().toLowerCase();
  const role = opts.role ?? 'admin';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error(`"${opts.email}" is not an email address`);
  if (opts.password !== undefined && opts.password.length < 8) throw new Error('The password needs at least 8 characters');

  let userId = await findUserId(env, email);
  let created = false;
  let generatedPassword: string | null = null;
  if (!userId) {
    generatedPassword = opts.password ? null : randomBytes(18).toString('base64url');
    const user = await call<{ id: string }>(env, '/auth/v1/admin/users', {
      body: {
        email,
        password: opts.password ?? generatedPassword,
        email_confirm: true,
        user_metadata: { full_name: opts.fullName },
      },
    });
    userId = user.id;
    created = true;
  } else if (opts.password) {
    await call(env, `/auth/v1/admin/users/${userId}`, { method: 'PUT', body: { password: opts.password, email_confirm: true } });
  }

  await call(env, '/rest/v1/staff?on_conflict=user_id', {
    body: { user_id: userId, full_name: opts.fullName.trim(), email, role, active: true },
    prefer: 'resolution=merge-duplicates,return=minimal',
  });
  return { userId, created, generatedPassword };
}

/** Test clean-up: removes the Supabase user (the staff row goes with it, `on delete cascade`). */
export async function deleteUserByEmail(email: string, env: SupabaseEnv = loadSupabaseEnv()): Promise<void> {
  const id = await findUserId(env, email);
  if (id) await call(env, `/auth/v1/admin/users/${id}`, { method: 'DELETE' });
}

async function main(): Promise<void> {
  const [email, fullName, password] = process.argv.slice(2);
  if (!email || !fullName) {
    console.error('Usage: pnpm bootstrap:admin you@firm.com "Full Name" [password]');
    process.exit(1);
  }
  const r = await bootstrapStaff({ email, fullName, password, role: 'admin' });
  console.log(`${r.created ? 'Created' : 'Found'} the account ${email.toLowerCase()} and made it an active admin.`);
  if (r.generatedPassword) console.log(`Password (shown once): ${r.generatedPassword}`);
  else if (password) console.log('The password was set to the one you gave.');
  console.log('Sign in at /sign-in, then open /admin.');
}

if (process.argv[1] && /bootstrap-admin\.[cm]?[jt]s$/.test(process.argv[1])) {
  main().catch((e: unknown) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  });
}
