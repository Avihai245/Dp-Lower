import 'server-only';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { supabaseAnonKey, supabaseUrl } from './env';
import type { Database } from './database.types';

/**
 * Supabase client acting as the signed-in user (RLS applies). Use in Server Components, Route Handlers and
 * Server Actions. Cookie writes are ignored where Next forbids them (Server Components); middleware refreshes the session.
 */
export async function createServerSupabase() {
  const store = await cookies();
  return createServerClient<Database>(supabaseUrl(), supabaseAnonKey(), {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          for (const { name, value, options } of list) store.set(name, value, options);
        } catch {
          /* called from a Server Component: the middleware keeps the session fresh */
        }
      },
    },
  });
}
