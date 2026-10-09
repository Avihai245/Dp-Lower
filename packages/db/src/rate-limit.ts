import 'server-only';
import type { Db } from './types';

/**
 * Cross-instance rate limit backed by the `rate_limit_hit` SQL function.
 * Returns true when the request is allowed. If the database is unreachable it fails open (and logs):
 * blocking real visitors because the limiter is down is worse than letting a few extra requests through.
 */
export async function rateLimit(db: Db, key: string, opts: { windowSeconds: number; max: number }): Promise<boolean> {
  const { data, error } = await db.rpc('rate_limit_hit', { p_key: key, p_window: opts.windowSeconds, p_max: opts.max });
  if (error) {
    console.error('[rate-limit] failed open:', error.message);
    return true;
  }
  return data === true;
}
