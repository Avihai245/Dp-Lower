import 'server-only';
import { firstNameOf, type Locale } from '@dpl/core';
import { createAdminSupabase } from '@dpl/db/admin';
import { campaignUrl } from '@dpl/db/links';
import { enqueueEmail } from '@dpl/db/outbox';
import { buildEmailPayload, renderEmail, type EmailContext } from '@dpl/emails';
import { absoluteUrl } from '@dpl/i18n';

/**
 * Sends the "we received your request" acknowledgement to a website visitor (template `contact-received`).
 * The visitor is not a lead: no case reference, no signed portal link (the link goes to the contact page of the firm's
 * site) and no unsubscribe. The email is written to the outbox with the dedupe key `contact-ack:{submissionId}`, so a
 * retried request never sends it twice; the dispatcher in the campaign app delivers it. Never throws.
 */
export async function queueContactAck(args: {
  submissionId: string;
  name: string;
  email: string | null;
  locale: 'en' | 'he';
}): Promise<void> {
  const email = args.email?.trim().toLowerCase();
  if (!email) return;
  try {
    const locale: Locale = args.locale;
    const site = (
      process.env.NEXT_PUBLIC_SITE_URL ??
      process.env.NEXT_PUBLIC_MAIN_SITE_URL ??
      'https://www.lawoffice.org.il'
    ).replace(/\/$/, '');
    // the PNG / JPG copies of the logo and the team photograph are hosted by the campaign site
    const images = campaignUrl('', 'en');
    const ctx: EmailContext = {
      locale,
      lead: {
        id: args.submissionId,
        firstName: firstNameOf(args.name) || args.name.trim(),
        fullName: args.name,
        email,
        caseRef: null,
        route: null,
      },
      links: {
        portal: absoluteUrl(site, locale, '/contact'),
        site: absoluteUrl(site, locale, '/'),
        privacy: absoluteUrl(site, locale, '/privacy'),
        unsubscribe: null,
        logo: `${images}/email/dpl-logo.png`,
        teamPhoto: `${images}/email/dpl-team.jpg`,
        booking: absoluteUrl(site, locale, '/contact'),
      },
      data: { name: args.name },
    };
    const payload = buildEmailPayload({
      template: 'contact-received',
      locale,
      to: { email, name: args.name },
      rendered: renderEmail('contact-received', ctx),
    });
    await enqueueEmail(createAdminSupabase(), {
      leadId: null,
      payload,
      dedupeKey: `contact-ack:${args.submissionId}`,
    });
  } catch (e) {
    console.error('[contact-ack] failed', e);
  }
}
