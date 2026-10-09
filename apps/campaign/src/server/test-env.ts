import fs from 'node:fs';
import type { Db } from '@dpl/db/types';

/**
 * Test support (no app code imports this): loads apps/campaign/.env.local into process.env (git-ignored, copied into
 * every worktree) and reports whether the shared local Supabase is configured, so database tests can skip cleanly on a
 * machine without it.
 */
export function loadLocalEnv(): boolean {
  try {
    const text = fs.readFileSync(new URL('../../.env.local', import.meta.url), 'utf8');
    for (const line of text.split('\n')) {
      const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
      if (m && process.env[m[1]!] === undefined) process.env[m[1]!] = m[2]!.replace(/^"|"$/g, '');
    }
  } catch {
    /* no env file: the database tests are skipped */
  }
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

let counter = 0;
const run = Date.now();

/** A lead row for the tests (unique lowercase email, controlled created_at). Remove with `cleanupLeads`. */
export async function makeLead(
  db: Db,
  o: {
    createdAt: Date;
    locale?: 'en' | 'he';
    route?: 'germany' | 'austria' | 'both' | 'unsure' | null;
    name?: string;
    stage?: 'lead' | 'account' | 'application' | 'review' | 'filed' | 'granted';
    unsubscribedAt?: Date | null;
    submittedAt?: Date | null;
    source?: string;
  },
) {
  counter++;
  const { data, error } = await db
    .from('leads')
    .insert({
      full_name: o.name ?? 'Test Lead',
      email: `emails-test+${run}-${counter}@example.com`,
      phone: '+1 212 555 0142',
      locale: o.locale ?? 'en',
      route: o.route === undefined ? 'germany' : o.route,
      stage: o.stage ?? 'lead',
      source: o.source ?? 'campaign-ger-aus',
      created_at: o.createdAt.toISOString(),
      unsubscribed_at: o.unsubscribedAt?.toISOString() ?? null,
      submitted_at: o.submittedAt?.toISOString() ?? null,
    })
    .select('*')
    .single();
  if (error || !data) throw new Error(`makeLead: ${error?.message}`);
  return data;
}

/** Deletes test leads (bookings, documents and sequence rows cascade) and the outbox events that belong to them. */
export async function cleanupLeads(db: Db, ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  await db.from('events').delete().in('lead_id', ids);
  for (const id of ids) await db.from('events').delete().like('dedupe_key', `%${id}%`);
  await db.from('leads').delete().in('id', ids);
}
