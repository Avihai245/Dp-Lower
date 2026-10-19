import 'server-only';
import { DEFAULT_LOCALE, signToken, verifyToken, type Locale } from '@dpl/core';
import { appSecret, campaignSiteUrl, mainSiteUrl } from './env';
import type { LeadRow } from './types';

/**
 * Only same-site relative paths survive; anything else (absolute URLs, //host, backslashes, scripts) falls back.
 * Use for every `next` / redirect parameter.
 */
export function safeNext(next: string | null | undefined, fallback = '/portal'): string {
  if (!next) return fallback;
  // eslint-disable-next-line no-control-regex
  const v = next.trim().replace(/[\u0000-\u001f\u007f]/g, '');
  if (!v.startsWith('/') || v.startsWith('//') || v.includes('\\') || /^\/[a-z][a-z0-9+.-]*:/i.test(v)) return fallback;
  return v;
}

const PORTAL_TTL = 60 * 60 * 24 * 60; // 60 days: long enough for the whole 46-day email sequence

/** Emailed "open my portal" token. Verified by /go/[token], which then opens a real Supabase session. */
export async function createPortalLinkToken(lead: Pick<LeadRow, 'id' | 'session_epoch'>, next = '/portal'): Promise<string> {
  return signToken({ lid: lead.id, ep: lead.session_epoch, p: 'portal', n: safeNext(next) }, appSecret(), PORTAL_TTL);
}

export async function readPortalLinkToken(token: string): Promise<{ leadId: string; epoch: number; next: string } | null> {
  const p = await verifyToken<{ lid?: string; ep?: number; n?: string }>(token, appSecret(), 'portal');
  if (!p || !p.lid) return null;
  return { leadId: p.lid, epoch: p.ep ?? 0, next: safeNext(p.n) };
}

const ENTER_TTL = 120; // 2 minutes: just long enough for the browser's own redirect from the firm's site to the portal

/**
 * "Go to my portal", clicked on the firm's own site (where the funnel now lives). Unlike the emailed portal link,
 * this is never mailed anywhere — it only ever carries a browser from one domain to the other in the same click — so
 * it proves nothing about the mailbox and must never be treated as if it did (no markEmailVerified on the other end).
 */
export async function createEnterToken(lead: Pick<LeadRow, 'id' | 'session_epoch'>): Promise<string> {
  return signToken({ lid: lead.id, ep: lead.session_epoch, p: 'enter' }, appSecret(), ENTER_TTL);
}

export async function readEnterToken(token: string): Promise<{ leadId: string; epoch: number } | null> {
  const p = await verifyToken<{ lid?: string; ep?: number }>(token, appSecret(), 'enter');
  if (!p || !p.lid) return null;
  return { leadId: p.lid, epoch: p.ep ?? 0 };
}

/**
 * Where a hand-over may end: a funnel page on the firm's site (/apply/...), or the portal's own /portal on the way back
 * (see the route that reads the token), each with or without the Hebrew prefix.
 */
const RESUME_TARGET = /^(\/he)?(\/apply\/(booking|offer|details|eligibility)|\/portal)$/;

/**
 * The other direction of the hand-over: someone who opened an emailed link on the portal's domain (which proved the
 * mailbox) and whose destination is a step of the funnel on the firm's site ("Book my free call", "Change or cancel").
 * The firm's site has no cookie for this browser, so the portal mints this 2-minute token and the firm's site turns it
 * into its own lead cookie and goes to the step. The destination is inside the token and must be one of RESUME_TARGET.
 */
export async function createResumeToken(lead: Pick<LeadRow, 'id' | 'session_epoch'>, target: string): Promise<string | null> {
  if (!RESUME_TARGET.test(target)) return null;
  return signToken({ lid: lead.id, ep: lead.session_epoch, p: 'resume', n: target }, appSecret(), ENTER_TTL);
}

export async function readResumeToken(token: string): Promise<{ leadId: string; epoch: number; target: string } | null> {
  const p = await verifyToken<{ lid?: string; ep?: number; n?: string }>(token, appSecret(), 'resume');
  if (!p || !p.lid || !p.n || !RESUME_TARGET.test(p.n)) return null;
  return { leadId: p.lid, epoch: p.ep ?? 0, target: p.n };
}

/** Where the firm's site turns a resume token into its own lead cookie. */
export const resumeUrl = (token: string) => `${mainSiteUrl()}/api/lead/resume?t=${encodeURIComponent(token)}`;

/** Never expires, never grants access: it can only stop the nurture emails (it is not accepted as a lead cookie or a portal link). */
export async function createUnsubscribeToken(leadId: string): Promise<string> {
  return signToken({ lid: leadId, p: 'unsub' }, appSecret());
}

export async function readUnsubscribeToken(token: string): Promise<{ leadId: string } | null> {
  const p = await verifyToken<{ lid?: string }>(token, appSecret(), 'unsub');
  return p?.lid ? { leadId: p.lid } : null;
}

const localePrefix = (l: Locale) => (l === DEFAULT_LOCALE ? '' : `/${l}`);

export const portalUrl = (token: string, locale: Locale = DEFAULT_LOCALE) => `${campaignSiteUrl()}${localePrefix(locale)}/go/${token}`;
/** Where /enter/[token] lives: the portal's own domain, same locale-prefix rule as the emailed portal link. */
export const enterUrl = (token: string, locale: Locale = DEFAULT_LOCALE) => `${campaignSiteUrl()}${localePrefix(locale)}/enter/${token}`;
export const unsubscribeUrl = (token: string, locale: Locale = DEFAULT_LOCALE) =>
  `${campaignSiteUrl()}${localePrefix(locale)}/unsubscribe?t=${token}`;
/** The address for the `List-Unsubscribe` header: a mail provider's one-click button POSTs here (RFC 8058). */
export const unsubscribeOneClickUrl = (token: string) => `${campaignSiteUrl()}/api/unsubscribe/one-click?t=${token}`;
export const campaignUrl = (path: string, locale: Locale = DEFAULT_LOCALE) => `${campaignSiteUrl()}${localePrefix(locale)}${path}`;
