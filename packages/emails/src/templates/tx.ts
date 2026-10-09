import { cta, eyebrow, footer, note, para, section, type Kit } from '../kit';
import type { When } from '../labels';
import { ea, esc, safeUrl, type Frag } from '../text';
import { common, top } from './common';

/**
 * Pieces shared by the transactional emails (no source design: they reuse the Welcome letterhead, hero, bands, buttons
 * and footer, and the plate / steps / quote blocks of the Lead Email).
 */

const FOOTER = {
  en: { privacy: 'Privacy', lawOffices: 'Law Offices · Tel Aviv · Jerusalem' },
  he: { privacy: 'פרטיות', lawOffices: 'משרד עורכי דין · תל אביב · ירושלים' },
};

export const txCopy = (k: Kit) => k.pick(FOOTER);

/** Footer without the unsubscribe link (transactional): reason for the email, optional legal notice, privacy link. */
export function txFooter(k: Kit, o: { reason: string; legal?: boolean; general?: boolean }): Frag {
  const c = common(k);
  const t = txCopy(k);
  return footer(k, {
    practice: o.general ? t.lawOffices : c.practice,
    disclaimer: o.legal ? k.r(c.disclaimer) : undefined,
    reason: k.r(o.reason),
    unsubscribeLabel: null,
    privacyLabel: t.privacy,
  });
}

/** Letterhead for the firm's general (non-campaign) emails. */
export function generalTop(k: Kit): Frag {
  return top(k, txCopy(k).lawOffices);
}

/** The white card that shows when a call takes place. */
export function callCard(k: Kit, o: { eyebrow: string; when: When; lines?: Frag[]; strike?: boolean }): Frag {
  const dec = o.strike ? ' text-decoration:line-through;' : '';
  const time = `${o.when.time}${o.when.zone ? ` ${o.when.zone}` : ''}`;
  const timeHtml = k.rtl ? `<span dir="ltr" style="unicode-bidi:isolate;">${esc(time)}</span>` : esc(time);
  const lines = (o.lines ?? [])
    .map((l) => `\n            <p style="margin:12px 0 0 0; font-family:${k.SANS}; font-size:15px; line-height:24px; color:#3d4650;">${l.html}</p>`)
    .join('');
  const ey = eyebrow(k, { html: esc(o.eyebrow), text: o.eyebrow }, { mb: 14, cls: '' });
  return {
    html: `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"${k.dirAttr} style="border:1px solid #d8cfc0; background-color:#ffffff;">
        <tr>
          <td style="padding:26px 28px 24px 28px;${k.ds}">
            ${ey.html}
            <p style="margin:0 0 6px 0; font-family:${k.SERIF}; font-size:26px; line-height:34px; color:#14202b;${dec}">${esc(o.when.date)}</p>
            <p style="margin:0; font-family:${k.SERIF}; font-size:20px; line-height:28px; color:#7a5c2c;${dec}">${timeHtml}</p>${lines}
          </td>
        </tr>
      </table>`,
    text: [`${ey.text}`, o.when.date, time, ...(o.lines ?? []).map((l) => l.text)].filter(Boolean).join('\n'),
  };
}

/** A free-text note (e.g. the reviewer's) with the brass rule on the start side. */
export function noteQuote(k: Kit, text: Frag): Frag {
  return {
    html: `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"${k.dirAttr} style="${k.borderStart('2px solid #a07a3c')}">
        <tr>
          <td style="${k.pad('2px', '0', '2px', '22px')}${k.ds}">
            <p style="margin:0; font-family:${k.SANS}; font-size:16px; line-height:27px; color:#3f4b56;">${text.html}</p>
          </td>
        </tr>
      </table>`,
    text: text.text,
  };
}

/** A paper band with a framed button and a small note. */
export function actionBand(k: Kit, o: { href: string; label: string; note?: string; lead?: Frag }): Frag {
  return section(
    k,
    { bg: 'paper', pad: '32px 44px 36px 44px', cls: 'px pt pb' },
    ...(o.lead ? [o.lead] : []),
    cta(k, { href: o.href, label: o.label, variant: 'ink' }),
    ...(o.note ? [note(k, k.r(o.note), { mt: 14 })] : []),
  );
}

/** "If the button does not work, copy this address" with the URL as plain text. */
export function fallbackLink(k: Kit, intro: string, url: string): Frag {
  const p = para(k, k.r(intro), { mb: 8 });
  return {
    html: `${p.html}
      <p style="margin:0; font-family:${k.SANS}; font-size:13px; line-height:20px; color:#55606b; word-break:break-all;"><a href="${ea(url)}" style="color:#7a5c2c; text-decoration:underline;">${esc(url)}</a></p>`,
    text: `${intro}\n${safeUrl(url)}`,
  };
}

