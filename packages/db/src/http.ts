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
        return NextResponse.json({ error: e.code, details: e.details }, { status: e.status });
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

export function clientIp(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for');
  return (fwd?.split(',')[0] ?? req.headers.get('x-real-ip') ?? 'unknown').trim();
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
  if (!allowed) throw new ApiError(429, 'rate_limited');
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
