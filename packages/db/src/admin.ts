import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { supabaseServiceKey, supabaseUrl } from './env';
import type { Database } from './database.types';
import type { Db } from './types';

let client: Db | undefined;

/**
 * Service-role client. Bypasses RLS: only ever use it in server code, after checking who is asking
 * (lead cookie, Supabase session, staff role or CRON secret).
 */
export function createAdminSupabase(): Db {
  client ??= createClient<Database>(supabaseUrl(), supabaseServiceKey(), {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return client;
}
