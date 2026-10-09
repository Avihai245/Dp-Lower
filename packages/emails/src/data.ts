import { DOC_TYPES, LEAD_STATUSES, isDocType, type DocType, type LeadStatus } from '@dpl/core';
import { safeUrl } from './text';
import type { AuthLinkKind, EmailContext } from './types';

/**
 * Readers for `EmailContext.data`. The field is loosely typed (callers pass what they have), so every template reads
 * it through one of these: missing or malformed values fall back to safe defaults instead of throwing, and a value
 * that is not a string never reaches the HTML.
 */
const rec = (v: unknown): Record<string, unknown> =>
  v && typeof v === 'object' ? (v as Record<string, unknown>) : {};
const num = (v: unknown, d: number): number => (typeof v === 'number' && Number.isFinite(v) ? v : d);
const str = (v: unknown, d = ''): string => (typeof v === 'string' ? v : d);

export interface FileOpenData {
  applicationState: 'not_started' | 'in_progress' | 'complete';
  docsReceived: number;
  docsTotal: number;
}

export function fileOpenData(ctx: EmailContext): FileOpenData {
  const d = rec(ctx.data);
  const state = d.applicationState;
  return {
    applicationState: state === 'in_progress' || state === 'complete' ? state : 'not_started',
    docsReceived: Math.max(0, Math.floor(num(d.docsReceived, 0))),
    docsTotal: Math.max(0, Math.floor(num(d.docsTotal, DOC_TYPES.length))),
  };
}

export function bookingData(ctx: EmailContext): {
  startsAt: string;
  timezone: string;
  minutes: number;
  lawyer: string;
} {
  const d = rec(ctx.data);
  return {
    startsAt: str(d.startsAt),
    timezone: str(d.timezone),
    minutes: Math.max(1, Math.floor(num(d.minutes, 20))),
    lawyer: str(d.lawyer).trim(),
  };
}

export function statusData(ctx: EmailContext): { status: LeadStatus } {
  const s = rec(ctx.data).status;
  return { status: (LEAD_STATUSES as readonly unknown[]).includes(s) ? (s as LeadStatus) : 'under_review' };
}

export function docRequestData(ctx: EmailContext): { docTypes: DocType[] } {
  const t = rec(ctx.data).docTypes;
  const list = Array.isArray(t) ? t.filter(isDocType) : [];
  return { docTypes: [...new Set(list)] };
}

export function docRejectedData(ctx: EmailContext): { docType: DocType; note: string } {
  const d = rec(ctx.data);
  return { docType: isDocType(d.docType) ? d.docType : 'other', note: str(d.note).trim() };
}

/** A usable web link, or ''. */
const webUrl = (v: unknown): string => {
  const u = str(v).trim();
  return u && safeUrl(u) !== '#' ? u : '';
};

export function resetData(ctx: EmailContext): { resetUrl: string } {
  return { resetUrl: webUrl(rec(ctx.data).resetUrl) || ctx.links.portal };
}

export function detailsChangedData(ctx: EmailContext): { variant: 'current' | 'previous'; changed: Array<'name' | 'email' | 'phone'> } {
  const d = rec(ctx.data);
  const list = Array.isArray(d.changed) ? d.changed.filter((f): f is 'name' | 'email' | 'phone' => f === 'name' || f === 'email' || f === 'phone') : [];
  return { variant: d.variant === 'previous' ? 'previous' : 'current', changed: [...new Set(list)] };
}

export function contactData(ctx: EmailContext): { name: string } {
  return { name: str(rec(ctx.data).name) || ctx.lead.fullName };
}

const AUTH_KINDS: readonly AuthLinkKind[] = [
  'magiclink',
  'signup',
  'invite',
  'email_change',
  'email',
  'reauthentication',
];

export function authLinkData(ctx: EmailContext): { url: string; kind: AuthLinkKind; code: string } {
  const d = rec(ctx.data);
  return {
    url: webUrl(d.url),
    kind: (AUTH_KINDS as readonly unknown[]).includes(d.kind) ? (d.kind as AuthLinkKind) : 'magiclink',
    code: str(d.code),
  };
}
