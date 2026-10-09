'use client';
import { createBrowserClient } from '@supabase/ssr';
import { supabaseAnonKey, supabaseUrl } from './env';
import type { Database } from './database.types';

let client: ReturnType<typeof createBrowserClient<Database>> | undefined;

/** Supabase client for Client Components (user session in cookies; used for Realtime and auth in the browser). */
export function createBrowserSupabase() {
  client ??= createBrowserClient<Database>(supabaseUrl(), supabaseAnonKey());
  return client;
}
