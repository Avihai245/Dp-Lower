import 'server-only';
import { DEFAULT_LOCALE, signToken, verifyToken, type Locale } from '@dpl/core';
import { appSecret, campaignSiteUrl } from './env';
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
export const unsubscribeUrl = (token: string, locale: Locale = DEFAULT_LOCALE) =>
  `${campaignSiteUrl()}${localePrefix(locale)}/unsubscribe?t=${token}`;
export const campaignUrl = (path: string, locale: Locale = DEFAULT_LOCALE) => `${campaignSiteUrl()}${localePrefix(locale)}${path}`;
