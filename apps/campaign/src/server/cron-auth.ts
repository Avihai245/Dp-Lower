import 'server-only';
import { createHash, timingSafeEqual } from 'node:crypto';

/** Constant-time comparison of two secrets of any length (both are hashed first, so neither the content nor the length leaks). */
export function safeEqual(a: string, b: string): boolean {
  return timingSafeEqual(createHash('sha256').update(a).digest(), createHash('sha256').update(b).digest());
}

/**
 * `Authorization: Bearer $CRON_SECRET`. Vercel Cron sends exactly this header when the CRON_SECRET environment
 * variable is set, and the pg_cron + pg_net alternative (supabase/snippets/dispatch-cron.sql) sends it as well.
 * Without a configured secret nothing is authorised.
 */
export function isAuthorizedCron(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const match = /^Bearer\s+(\S+)\s*$/i.exec(req.headers.get('authorization') ?? '');
  return match ? safeEqual(match[1]!, secret) : false;
}
