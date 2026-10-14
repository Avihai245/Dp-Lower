'use client';

export interface ApiResult<T> {
  ok: boolean;
  status: number;
  data: T | null;
  /** machine-readable error code from the API (invalid_body, rate_limited, slot_unavailable, ...) */
  error: string | null;
  details?: unknown;
}

/** Thin fetch wrapper for the app's own JSON API. Never throws; network failures give status 0 / error 'network'. */
export async function api<T = unknown>(
  url: string,
  init: { method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'; body?: unknown; signal?: AbortSignal } = {},
): Promise<ApiResult<T>> {
  try {
    const res = await fetch(url, {
      method: init.method ?? (init.body === undefined ? 'GET' : 'POST'),
      headers: init.body === undefined ? undefined : { 'content-type': 'application/json' },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      credentials: 'same-origin',
      signal: init.signal,
    });
    let json: unknown = null;
    try {
      json = await res.json();
    } catch {
      /* empty body */
    }
    const obj = (json ?? {}) as { error?: string; details?: unknown };
    return {
      ok: res.ok,
      status: res.status,
      data: res.ok ? (json as T) : null,
      error: res.ok ? null : (obj.error ?? 'error'),
      details: obj.details,
    };
  } catch {
    return { ok: false, status: 0, data: null, error: 'network' };
  }
}
