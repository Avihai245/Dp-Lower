import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { loadAppEnv } from '../../scripts/bootstrap-admin';

/**
 * Signing a test user in without the sign-in page (which belongs to another part of the app): the same Supabase
 * password sign-in the page would do, but with `@supabase/ssr`'s own cookie writer, so the browser gets exactly the
 * session cookies the app's middleware and server client read. The package is resolved from the campaign app (the
 * repository root does not depend on it).
 */

interface CookieToSet {
  name: string;
  value: string;
  options?: { maxAge?: number; path?: string; sameSite?: string; domain?: string };
}

interface CookieJarClient {
  auth: { signInWithPassword(c: { email: string; password: string }): Promise<{ error: { message: string } | null }> };
}
type CreateServerClient = (
  url: string,
  key: string,
  opts: { cookies: { getAll: () => Array<{ name: string; value: string }>; setAll: (c: CookieToSet[]) => void } },
) => CookieJarClient;

export interface BrowserCookie {
  name: string;
  value: string;
  url: string;
  sameSite: 'Lax';
  expires?: number;
}

/** Playwright cookies that sign a browser in as `email` on `baseURL`. */
export async function sessionCookies(baseURL: string, email: string, password: string): Promise<BrowserCookie[]> {
  const env = loadAppEnv();
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY are not set');

  const campaign = createRequire(resolve(process.cwd(), 'apps/campaign/package.json'));
  const { createServerClient } = campaign('@supabase/ssr') as { createServerClient: CreateServerClient };

  const jar = new Map<string, CookieToSet>();
  const client = createServerClient(url, key, {
    cookies: {
      getAll: () => [...jar.values()].map((c) => ({ name: c.name, value: c.value })),
      setAll: (list) => {
        for (const c of list) {
          if (!c.value || c.options?.maxAge === 0) jar.delete(c.name);
          else jar.set(c.name, c);
        }
      },
    },
  });
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`sign-in as ${email} failed: ${error.message}`);

  return [...jar.values()].map((c) => ({
    name: c.name,
    value: c.value,
    url: baseURL,
    sameSite: 'Lax' as const,
    ...(c.options?.maxAge ? { expires: Math.floor(Date.now() / 1000) + c.options.maxAge } : {}),
  }));
}
