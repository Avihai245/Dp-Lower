import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import type { ZodType } from 'zod';
import { createAdminSupabase } from './admin';
import { rateLimit } from './rate-limit';

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    public details?: unknown,
    /** extra response headers (`Retry-After` on a 429) */
    public headers?: Record<string, string>,
  ) {
    super(code);
  }
}

export const json = (data: unknown, init?: ResponseInit) => NextResponse.json(data, init);

/** Wraps a Route Handler: ApiError -> JSON error, anything else -> generic 500 (details only in the server log). */
export function handle<C = unknown>(fn: (req: NextRequest, ctx: C) => Promise<Response>) {
  return async (req: NextRequest, ctx: C): Promise<Response> => {
    try {
      return await fn(req, ctx);
    } catch (e) {
      if (e instanceof ApiError) {
        return NextResponse.json({ error: e.code, details: e.details }, { status: e.status, ...(e.headers ? { headers: e.headers } : {}) });
      }
      console.error('[api] unhandled error', req.method, req.nextUrl.pathname, e);
      return NextResponse.json({ error: 'internal_error' }, { status: 500 });
    }
  };
}

export async function parseJson<T>(req: Request, schema: ZodType<T>): Promise<T> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw new ApiError(400, 'invalid_json');
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    throw new ApiError(400, 'invalid_body', parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })));
  }
  return parsed.data;
}

/**
 * The address of the visitor, used as the rate-limit bucket. Which header can be believed depends on the host, so the
 * source is a setting (CLIENT_IP_SOURCE):
 *
 *   vercel (default)  Vercel sets `x-vercel-forwarded-for` and `x-real-ip` itself and overwrites `x-forwarded-for`, none of
 *                     which a visitor can influence; otherwise the right-most `x-forwarded-for` entry.
 *   xff               Behind other proxies (AWS Amplify / CloudFront, a load balancer): only `x-forwarded-for` is read, and
 *                     only the entry the last trusted proxy appended, counted from the right (TRUSTED_PROXY_HOPS, default
 *                     1). `x-real-ip` and `x-vercel-forwarded-for` are ignored, because off Vercel a visitor can send them
 *                     and so pick their own rate-limit bucket.
 *   cloudfront        `cloudfront-viewer-address` (ip:port), which CloudFront sets and overwrites; falls back to `xff`.
 *
 * The left-most `x-forwarded-for` entry is whatever the visitor sent and is never used.
 */
export function clientIp(req: Request): string {
  const h = req.headers;
  const entries = (h.get('x-forwarded-for') ?? '').split(',').map((e) => e.trim()).filter(Boolean);
  const hops = Math.max(1, Number.parseInt(process.env.TRUSTED_PROXY_HOPS ?? '1', 10) || 1);
  const behindProxy = () => entries.at(-hops) ?? entries[0];
  const source = (process.env.CLIENT_IP_SOURCE ?? 'vercel').toLowerCase();
  if (source === 'cloudfront') {
    const viewer = h.get('cloudfront-viewer-address')?.trim();
    const ip = viewer ? (viewer.startsWith('[') ? viewer.slice(1, viewer.indexOf(']')) : viewer.replace(/:\d+$/, '')) : '';
    return ip || behindProxy() || 'unknown';
  }
  if (source === 'xff') return behindProxy() || 'unknown';
  return (h.get('x-vercel-forwarded-for')?.split(',')[0] ?? h.get('x-real-ip') ?? entries.at(-1) ?? 'unknown').trim() || 'unknown';
}

/**
 * CSRF defence in depth for cookie-authenticated writes (SameSite=Lax already blocks cross-site POSTs):
 * the Origin header, when present, must be the app's own origin.
 */
export function assertSameOrigin(req: NextRequest): void {
  const origin = req.headers.get('origin');
  if (!origin) return;
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host');
  let ok = false;
  try {
    ok = !!host && new URL(origin).host === host;
  } catch {
    ok = false;
  }
  if (!ok) throw new ApiError(403, 'bad_origin');
}

/** Throws 429 when `ip` exceeds `max` calls per window on `bucket`. */
export async function limitOrThrow(req: Request, bucket: string, opts: { windowSeconds: number; max: number }): Promise<void> {
  const allowed = await rateLimit(createAdminSupabase(), `${bucket}:${clientIp(req)}`, opts);
  // the window is the longest a caller could have to wait: a well-behaved client (and a mail provider) knows when to come back
  if (!allowed) throw new ApiError(429, 'rate_limited', undefined, { 'Retry-After': String(opts.windowSeconds) });
}

/** Cloudflare Turnstile. Disabled (always true) until TURNSTILE_SECRET is configured. */
export async function verifyTurnstile(token: string | undefined | null, ip?: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET;
  if (!secret) return true;
  if (!token) return false;
  try {
    const body = new URLSearchParams({ secret, response: token });
    if (ip) body.set('remoteip', ip);
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body });
    const out = (await res.json()) as { success?: boolean };
    return out.success === true;
  } catch {
    return false;
  }
}
