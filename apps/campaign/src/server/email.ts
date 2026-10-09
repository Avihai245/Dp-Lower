import 'server-only';
import { DOC_TYPES, firstNameOf, type Locale } from '@dpl/core';
import { createAdminSupabase } from '@dpl/db/admin';
import {
  campaignUrl,
  createPortalLinkToken,
  createUnsubscribeToken,
  portalUrl,
  unsubscribeUrl,
} from '@dpl/db/links';
import { enqueueEmail } from '@dpl/db/outbox';
import type { Db, EventRow, LeadRow } from '@dpl/db/types';
import {
  buildEmailPayload,
  isNurtureTemplate,
  renderEmail,
  type EmailContext,
  type EmailLinks,
  type EmailTemplateId,
} from '@dpl/emails';

export interface QueueEmailArgs {
  template: EmailTemplateId;
  /** the recipient. For people who are not leads (website visitors, bare auth users) use `queueEmailToAddress`. */
  lead: LeadRow;
  /** template-specific data, see EmailData in @dpl/emails */
  data?: EmailContext['data'];
  /** idempotency key; the same key never queues twice. Default: template:leadId:YYYY-MM-DDTHH (hourly) */
  dedupeKey?: string;
  /** when to send; default now */
  at?: Date;
  /** `next` path after the portal link, default /portal */
  next?: string;
}

/** Links every email carries, built from the public URLs of the two sites (images are the PNG/JPG copies in /public/email). */
function sharedLinks(locale: Locale): Omit<EmailLinks, 'portal' | 'unsubscribe'> {
  const root = campaignUrl('', 'en');
  return {
    site: process.env.NEXT_PUBLIC_MAIN_SITE_URL ?? 'https://www.lawoffice.org.il',
    privacy: campaignUrl('/privacy', locale),
    logo: `${root}/email/dpl-logo.png`,
    teamPhoto: `${root}/email/dpl-team.jpg`,
    // the landing page: the footer link, and "Book my free call" for someone who is not a lead (leadContext signs it)
    booking: campaignUrl('/', locale),
    landing: campaignUrl('/', locale),
  };
}

/** What the "Lead Email" shows when the caller did not say: the application and records state, read from the database. */
async function fileOpenData(db: Db, leadId: string): Promise<NonNullable<EmailContext['data']>> {
  const [app, docs] = await Promise.all([
    db.from('applications').select('completed_at').eq('lead_id', leadId).maybeSingle(),
    db.from('documents').select('status').eq('lead_id', leadId),
  ]);
  const applicationState = app.data?.completed_at ? 'complete' : app.data ? 'in_progress' : 'not_started';
  const docsReceived = (docs.data ?? []).filter((d) => d.status === 'received').length;
  return { applicationState, docsReceived, docsTotal: DOC_TYPES.length };
}

async function leadContext(db: Db, a: QueueEmailArgs): Promise<EmailContext> {
  const nurture = isNurtureTemplate(a.template);
  const locale = a.lead.locale as Locale;
  const portalToken = await createPortalLinkToken(a.lead, a.next ?? '/portal');
  // "Book my free call", "Change or cancel": the lead's own booking step, signed like the portal link
  const bookingToken = await createPortalLinkToken(a.lead, '/booking');
  const unsubToken = nurture ? await createUnsubscribeToken(a.lead.id) : null;
  return {
    locale,
    lead: {
      id: a.lead.id,
      firstName: firstNameOf(a.lead.full_name) || a.lead.full_name.trim(),
      fullName: a.lead.full_name,
      email: a.lead.email,
      caseRef: a.lead.case_ref,
      route: a.lead.route,
      phone: a.lead.phone,
    },
    links: {
      ...sharedLinks(locale),
      portal: portalUrl(portalToken, locale),
      booking: portalUrl(bookingToken, locale),
      unsubscribe: unsubToken ? unsubscribeUrl(unsubToken, locale) : null,
    },
    data: a.data ?? (a.template === 'file-open' ? await fileOpenData(db, a.lead.id) : undefined),
  };
}

/** The outbox row with this dedupe key, if there is one (a failed insert and an already queued email look the same to `enqueueEmail`). */
export async function eventByDedupeKey(db: Db, key: string): Promise<EventRow | null> {
  const { data } = await db.from('events').select('*').eq('dedupe_key', key).maybeSingle();
  return data;
}

/**
 * Renders a template for a lead (in the lead's language) and writes it to the outbox. Returns the event, the event that
 * already carried this dedupe key, or null when nothing was queued (unsubscribed lead, or the write failed: look at the log).
 * Never throws.
 */
export async function queueEmailEvent(a: QueueEmailArgs): Promise<EventRow | null> {
  try {
    const db = createAdminSupabase();
    if (isNurtureTemplate(a.template) && a.lead.unsubscribed_at) return null;
    const ctx = await leadContext(db, a);
    const rendered = renderEmail(a.template, ctx);
    const payload = buildEmailPayload({
      template: a.template,
      locale: ctx.locale,
      to: { email: a.lead.email, name: a.lead.full_name },
      rendered,
      unsubscribeUrl: ctx.links.unsubscribe,
    });
    const hour = (a.at ?? new Date()).toISOString().slice(0, 13);
    const dedupeKey = a.dedupeKey ?? `email:${a.template}:${a.lead.id}:${hour}`;
    const row = await enqueueEmail(db, { leadId: a.lead.id, payload, dedupeKey, at: a.at });
    return row ?? (await eventByDedupeKey(db, dedupeKey));
  } catch (e) {
    console.error('[email] queueEmail failed', a.template, e);
    return null;
  }
}

/**
 * Renders a template for a lead (in the lead's language) and writes it to the outbox as an `email.send` event.
 * Nurture emails carry an unsubscribe link and are skipped for unsubscribed leads. Never throws.
 */
export async function queueEmail(a: QueueEmailArgs): Promise<void> {
  await queueEmailEvent(a);
}

/** Someone who is not (or not yet) a lead: a bare Supabase user asking for a recovery link, for example. */
export interface Recipient {
  email: string;
  name: string;
  locale: Locale;
  /** set when the address belongs to a lead (only used to link the outbox row to the case) */
  leadId?: string | null;
}

/**
 * Queues a transactional email for an address without a lead record: no case reference, no signed portal link
 * (the portal link is the sign-in page), no unsubscribe. Throws when the outbox write fails, so a caller that must
 * not lose the email (the auth hook) can answer with an error and let the sender retry.
 */
export async function queueEmailToAddress(a: {
  template: EmailTemplateId;
  to: Recipient;
  data?: EmailContext['data'];
  dedupeKey: string;
  at?: Date;
}): Promise<EventRow> {
  const db = createAdminSupabase();
  const { to } = a;
  const ctx: EmailContext = {
    locale: to.locale,
    lead: {
      id: to.leadId ?? to.email,
      firstName: firstNameOf(to.name) || to.name.trim() || to.email.split('@')[0] || '',
      fullName: to.name,
      email: to.email,
      caseRef: null,
      route: null,
    },
    links: { ...sharedLinks(to.locale), portal: campaignUrl('/portal', to.locale), unsubscribe: null },
    data: a.data,
  };
  const rendered = renderEmail(a.template, ctx);
  const payload = buildEmailPayload({
    template: a.template,
    locale: to.locale,
    to: { email: to.email, name: to.name },
    rendered,
  });
  const row = await enqueueEmail(db, {
    leadId: to.leadId ?? null,
    payload,
    dedupeKey: a.dedupeKey,
    at: a.at,
  });
  const event = row ?? (await eventByDedupeKey(db, a.dedupeKey));
  if (!event) throw new Error(`email ${a.template} could not be queued`);
  return event;
}
