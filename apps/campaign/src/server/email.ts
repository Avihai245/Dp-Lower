import 'server-only';
import type { EmailPayload, Locale } from '@dpl/core';
import { createAdminSupabase } from '@dpl/db/admin';
import { campaignUrl, createPortalLinkToken, createUnsubscribeToken, portalUrl, unsubscribeUrl } from '@dpl/db/links';
import { enqueueEmail } from '@dpl/db/outbox';
import type { LeadRow } from '@dpl/db/types';
import { isNurtureTemplate, renderEmail, type EmailContext, type EmailTemplateId } from '@dpl/emails';

export interface QueueEmailArgs {
  template: EmailTemplateId;
  /** the recipient. For contact-form senders that are not leads, pass a pseudo lead with caseRef null via `to`. */
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

const from = () => ({
  email: process.env.EMAIL_FROM_ADDRESS ?? 'cases@euro-passports.com',
  name: process.env.EMAIL_FROM_NAME ?? 'Decker Pex Levi',
});

/**
 * Renders a template for a lead (in the lead's language) and writes it to the outbox as an `email.send` event.
 * Nurture emails carry an unsubscribe link and are skipped for unsubscribed leads. Never throws.
 */
export async function queueEmail(a: QueueEmailArgs): Promise<void> {
  try {
    const db = createAdminSupabase();
    const nurture = isNurtureTemplate(a.template);
    if (nurture && a.lead.unsubscribed_at) return;

    const locale = a.lead.locale as Locale;
    const portalToken = await createPortalLinkToken(a.lead, a.next ?? '/portal');
    const unsubToken = nurture ? await createUnsubscribeToken(a.lead.id) : null;
    const base = campaignUrl('', locale);
    const ctx: EmailContext = {
      locale,
      lead: {
        id: a.lead.id,
        firstName: a.lead.full_name.trim().split(/\s+/)[0] ?? '',
        fullName: a.lead.full_name,
        email: a.lead.email,
        caseRef: a.lead.case_ref,
        route: a.lead.route,
      },
      links: {
        portal: portalUrl(portalToken, locale),
        site: process.env.NEXT_PUBLIC_MAIN_SITE_URL ?? 'https://www.lawoffice.org.il',
        privacy: campaignUrl('/privacy', locale),
        unsubscribe: unsubToken ? unsubscribeUrl(unsubToken, locale) : null,
        logo: `${campaignUrl('', 'en')}/email/dpl-logo.png`,
        teamPhoto: `${campaignUrl('', 'en')}/email/dpl-team.jpg`,
        booking: base || campaignUrl('/', locale),
      },
      data: a.data,
    };
    const rendered = renderEmail(a.template, ctx);
    const payload: EmailPayload = {
      template: a.template,
      locale,
      to: { email: a.lead.email, name: a.lead.full_name },
      from: from(),
      replyTo: process.env.EMAIL_REPLY_TO ?? 'office@lawoffice.org.il',
      subject: rendered.subject,
      preheader: rendered.preheader,
      html: rendered.html,
      text: rendered.text,
      category: nurture ? 'nurture' : 'transactional',
    };
    const hour = (a.at ?? new Date()).toISOString().slice(0, 13);
    await enqueueEmail(db, {
      leadId: a.lead.id,
      payload,
      dedupeKey: a.dedupeKey ?? `email:${a.template}:${a.lead.id}:${hour}`,
      at: a.at,
    });
  } catch (e) {
    console.error('[email] queueEmail failed', a.template, e);
  }
}
