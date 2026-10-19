import 'server-only';
import { rateLimit } from './rate-limit';
import type { Db } from './types';

/**
 * Lets a short-lived hand-over token (the `enter` and `resume` tokens that carry a browser from one of the two sites to the
 * other) be used once. The first caller gets true; anybody who presents the same token later, inside the ten minutes the
 * record is kept (the tokens live two), gets false. A leaked address (a log line, a browser history entry) is therefore of
 * no use after the legitimate redirect has happened. Built on the rate-limit table: one hit allowed per token. If the
 * database cannot be reached it lets the request through, like the rate limiter (the token is still signed and short).
 */
export async function claimOnce(db: Db, token: string): Promise<boolean> {
  // the end of a signed token is its signature: unique per token and short enough for a key
  return rateLimit(db, `once:${token.slice(-48)}`, { windowSeconds: 600, max: 1 });
}
