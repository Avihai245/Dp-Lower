import { createServerClient } from '@supabase/ssr';
import type { NextRequest, NextResponse } from 'next/server';
import { supabaseAnonKey, supabaseUrl } from './env';
import type { Database } from './database.types';

/**
 * Refreshes the Supabase session cookies on `response` and returns the verified user (or null).
 * Call it from the app's middleware after the locale middleware has produced `response`.
 */
export async function refreshSession(request: NextRequest, response: NextResponse) {
  const supabase = createServerClient<Database>(supabaseUrl(), supabaseAnonKey(), {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        for (const { name, value, options } of list) {
          request.cookies.set(name, value);
          response.cookies.set(name, value, options);
        }
      },
    },
  });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { user, supabase };
}
