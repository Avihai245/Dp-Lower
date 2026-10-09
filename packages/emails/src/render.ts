import { Kit } from './kit';
import { shell } from './shell';
import { finishText } from './text';
import { TEMPLATES } from './templates';
import type { EmailContext, EmailTemplateId, RenderedEmail } from './types';

/**
 * Renders one email for one recipient: subject, hidden preheader, complete HTML (inline styles, table layout) and a
 * plain-text twin. Every dynamic value is HTML-escaped; Hebrew gets `lang="he" dir="rtl"` and a mirrored layout.
 */
export function renderEmail(id: EmailTemplateId, ctx: EmailContext): RenderedEmail {
  const def = TEMPLATES[id];
  if (!def) throw new Error(`Unknown email template: ${id}`);
  const k = new Kit(ctx);
  const doc = def.build(k);
  const html = shell(k, {
    family: def.family,
    subject: doc.subject,
    preheader: doc.preheader,
    rows: doc.rows.map((r) => r.html).join(''),
  });
  const text = finishText(
    doc.rows.map((r) => r.text),
    k.rtl,
  );
  return { subject: doc.subject, preheader: doc.preheader, html, text };
}
