import type { EmailPayload, Locale } from '@dpl/core';
import { isNurtureTemplate, type EmailTemplateId, type RenderedEmail } from './types';

export interface EmailSender {
  from: { email: string; name: string };
  replyTo: string;
}

/** Sender and reply-to of every email: EMAIL_FROM_ADDRESS / EMAIL_FROM_NAME / EMAIL_REPLY_TO, with the firm's defaults. */
export function emailSender(env: Record<string, string | undefined> = process.env): EmailSender {
  return {
    from: {
      email: env.EMAIL_FROM_ADDRESS || 'cases@euro-passports.com',
      name: env.EMAIL_FROM_NAME || 'Decker Pex Levi',
    },
    replyTo: env.EMAIL_REPLY_TO || 'office@lawoffice.org.il',
  };
}

/** The `email.send` outbox payload: the rendered message plus the envelope, ready for any "send email" Zap step. */
export function buildEmailPayload(a: {
  template: EmailTemplateId;
  locale: Locale;
  to: { email: string; name: string };
  rendered: RenderedEmail;
  sender?: EmailSender;
  /** the lead's signed unsubscribe address, for nurture emails */
  unsubscribeUrl?: string | null;
}): EmailPayload {
  const sender = a.sender ?? emailSender();
  const nurture = isNurtureTemplate(a.template);
  return {
    template: a.template,
    locale: a.locale,
    to: a.to,
    from: sender.from,
    replyTo: sender.replyTo,
    subject: a.rendered.subject,
    preheader: a.rendered.preheader,
    html: a.rendered.html,
    text: a.rendered.text,
    category: nurture ? 'nurture' : 'transactional',
    ...(nurture && a.unsubscribeUrl ? { listUnsubscribe: a.unsubscribeUrl } : {}),
  };
}
