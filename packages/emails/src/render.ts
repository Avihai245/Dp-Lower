import type { EmailContext, EmailTemplateId, RenderedEmail } from './types';

/**
 * PLACEHOLDER: replaced by the real template renderers (Lead Email + Welcome 1-15 + transactional, EN/HE).
 * The signature is final.
 */
export function renderEmail(id: EmailTemplateId, ctx: EmailContext): RenderedEmail {
  const subject = `[${id}] Decker Pex Levi`;
  const text = `Hello ${ctx.lead.firstName},\n\nOpen your portal: ${ctx.links.portal}\n`;
  return { subject, preheader: '', html: `<p>Hello ${ctx.lead.firstName},</p><p><a href="${ctx.links.portal}">Open your portal</a></p>`, text };
}
