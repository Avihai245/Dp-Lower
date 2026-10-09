import type { Locale } from '@dpl/core';

/**
 * Logic of the two enquiry forms in the site shell (the lead band at the foot of every page and the chat panel):
 * validation, payloads for POST /api/contact and the request itself.
 *
 * The validators mirror @dpl/core/format.ts (the server schemas use the same rules). They are repeated here, instead of
 * imported, because the @dpl/core barrel pulls zod into the browser bundle; lead-form.test.ts checks they stay identical.
 */

export const CONTACT_ENDPOINT = '/api/contact';

export const digitsOf = (s: string): string => s.replace(/[^0-9]/g, '');
const EMAIL_RE = /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@(?:[A-Za-z0-9-]+\.)+[A-Za-z0-9-]{2,}$/;
export const isName = (s: string): boolean => s.trim().length >= 2 && s.trim().length <= 120;
export const isEmail = (s: string): boolean => EMAIL_RE.test(s.trim()) && s.trim().length <= 254;
export const isPhone = (s: string): boolean => digitsOf(s).length >= 7 && s.trim().length <= 40;

/**
 * Capitalises each word as the visitor types ("anna reinhardt" -> "Anna Reinhardt"), without trimming (a trailing space
 * must survive the keystroke). Hebrew and other uncased scripts pass through untouched.
 */
export const autoCapitalize = (value: string): string =>
  value.replace(/(^|[\s'\-])([a-zà-ÿ])/g, (_m, p: string, c: string) => p + c.toUpperCase());

export const firstNameOf = (full: string): string => full.trim().split(/\s+/)[0] ?? '';

/**
 * What the subject select and the chat topics store. The visitor sees the translated labels (messages, same order);
 * the CRM always receives these English labels so submissions read the same whatever language the visitor used.
 */
export const MATTER_VALUES = [
  'German or Austrian passport',
  'Polish passport',
  'Portuguese passport',
  'Romanian, French or Bulgarian passport',
  'Immigration to Israel or Aliyah',
  'Status for a foreign spouse',
  'Work permit for a foreign expert',
  'Notarial translation',
  'Inheritance or family matter',
  'Something else',
] as const;

export const CHAT_TOPIC_VALUES = [
  'A European passport by descent',
  'Status or a visa in Israel',
  'Immigration to the US or Canada',
  'Notarial translation',
  'Something else',
] as const;

export type LeadField = 'name' | 'phone' | 'email' | 'consent';

export interface LeadValues {
  name: string;
  phone: string;
  email: string;
  consent: boolean;
}

/** Invalid fields in form order. The chat's email is optional, but must be valid when given. */
export function leadErrors(v: LeadValues, opts: { emailRequired: boolean }): LeadField[] {
  const out: LeadField[] = [];
  if (!isName(v.name)) out.push('name');
  if (!isPhone(v.phone)) out.push('phone');
  const email = v.email.trim();
  if (opts.emailRequired ? !isEmail(email) : email !== '' && !isEmail(email)) out.push('email');
  if (!v.consent) out.push('consent');
  return out;
}

export const isLeadReady = (v: LeadValues, opts: { emailRequired: boolean }): boolean => leadErrors(v, opts).length === 0;

/** `utm_*` parameters of the landing URL, within the limits of the API schema (12 keys, key 40 / value 300 characters). */
export function parseUtm(search: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of new URLSearchParams(search)) {
    const k = key.toLowerCase();
    if (!k.startsWith('utm_') || k.length > 40 || value === '') continue;
    if (Object.keys(out).length >= 12 && !(k in out)) break;
    out[k] = value.slice(0, 300);
  }
  return out;
}

export interface ContactPayload {
  kind: 'lead_band' | 'chat';
  name: string;
  phone: string;
  email?: string;
  matter: string;
  consent: true;
  locale: Locale;
  page: string;
  utm?: Record<string, string>;
  /** utm_source, else the referring site, else "direct" (see attribution.ts) */
  source?: string;
  /** honeypot, filled only by bots */
  website?: string;
  /** Cloudflare Turnstile token; required by the API once TURNSTILE_SECRET is set on the server */
  turnstileToken?: string;
}

export interface SubmitContext {
  locale: Locale;
  /** path of the page the form was on, with the locale prefix, e.g. /he/about */
  page: string;
  utm: Record<string, string>;
  source?: string;
}

function payload(kind: ContactPayload['kind'], v: LeadValues & { website: string }, matter: string, ctx: SubmitContext): ContactPayload {
  const email = v.email.trim();
  return {
    kind,
    name: v.name.trim(),
    phone: v.phone.trim(),
    ...(email ? { email } : {}),
    matter,
    consent: true,
    locale: ctx.locale,
    page: ctx.page.slice(0, 300),
    ...(Object.keys(ctx.utm).length ? { utm: ctx.utm } : {}),
    ...(ctx.source ? { source: ctx.source.slice(0, 80) } : {}),
    ...(v.website ? { website: v.website } : {}),
  };
}

export const buildLeadBandPayload = (v: LeadValues & { website: string; matterIndex: number }, ctx: SubmitContext): ContactPayload =>
  payload('lead_band', v, MATTER_VALUES[v.matterIndex] ?? MATTER_VALUES[MATTER_VALUES.length - 1], ctx);

export const buildChatPayload = (v: LeadValues & { website: string; topicIndex: number }, ctx: SubmitContext): ContactPayload =>
  payload('chat', v, CHAT_TOPIC_VALUES[v.topicIndex] ?? CHAT_TOPIC_VALUES[CHAT_TOPIC_VALUES.length - 1], ctx);

export type SubmitResult = { ok: true } | { ok: false; reason: 'rate' | 'captcha' | 'failed' };

/**
 * POST /api/contact answers 201 {ok:true}; 429 means the per-IP limit was hit, 400 captcha_failed that the Turnstile
 * check was missing or refused, anything else (or no network) is a plain failure.
 */
export async function postContact(body: ContactPayload, doFetch: typeof fetch = fetch): Promise<SubmitResult> {
  try {
    const res = await doFetch(CONTACT_ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (res.ok) return { ok: true };
    if (res.status === 429) return { ok: false, reason: 'rate' };
    if (res.status === 400) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      if (body?.error === 'captcha_failed') return { ok: false, reason: 'captcha' };
    }
    return { ok: false, reason: 'failed' };
  } catch {
    return { ok: false, reason: 'failed' };
  }
}
