/**
 * First-touch attribution: the landing page stores where a visitor first came from in two cookies, `dpl_src` (a
 * source label such as "main-site") and `dpl_utm` (a JSON object of utm_* parameters, optionally URI-encoded).
 * POST /api/leads falls back to them when the request body carries no source/utm of its own.
 */
export const SRC_COOKIE = 'dpl_src';
export const UTM_COOKIE = 'dpl_utm';

export interface FirstTouch {
  source?: string;
  utm?: Record<string, string>;
}

const decode = (v: string): string => {
  try {
    return decodeURIComponent(v);
  } catch {
    return v;
  }
};

export function parseSource(raw: string | undefined | null): string | undefined {
  if (!raw) return undefined;
  const v = decode(raw).trim();
  return v && v.length <= 80 && !/[\u0000-\u001f\u007f]/.test(v) ? v : undefined;
}

/** A JSON object of short strings, at most 12 keys (the limits of the lead schema); anything else is ignored. */
export function parseUtm(raw: string | undefined | null): Record<string, string> | undefined {
  if (!raw) return undefined;
  let value: unknown;
  try {
    value = JSON.parse(decode(raw));
  } catch {
    return undefined;
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(value)) {
    if (Object.keys(out).length >= 12) break;
    if (typeof v === 'string' && k.length > 0 && k.length <= 40 && v.length > 0) out[k] = v.slice(0, 300);
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

export const parseFirstTouch = (src: string | undefined, utm: string | undefined): FirstTouch => ({
  source: parseSource(src),
  utm: parseUtm(utm),
});
