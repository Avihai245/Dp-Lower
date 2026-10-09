import type { Locale } from '@dpl/core';
import { ea, esc, plain, rich, safeUrl, type Dyn, type Frag } from './text';
import type { EmailContext } from './types';

/**
 * Building blocks shared by every template. The inline styles are copied from the Welcome 1-15 and Lead Email
 * sources; the only differences are direction-aware: in Hebrew the horizontal paddings, borders and alignments are
 * mirrored, letter-spacing and upper-casing (designed for Latin) are dropped, and the font stacks fall back to
 * Hebrew-capable families.
 */
export class Kit {
  readonly locale: Locale;
  readonly rtl: boolean;
  readonly SANS: string;
  readonly SERIF: string;
  /** the name the email addresses; never empty */
  readonly first: string;

  constructor(readonly ctx: EmailContext) {
    this.locale = ctx.locale;
    this.rtl = ctx.locale === 'he';
    this.SANS = this.rtl ? 'Assistant,Arial,Helvetica,sans-serif' : 'Arial,Helvetica,sans-serif';
    this.SERIF = this.rtl
      ? "'Frank Ruhl Libre','Times New Roman',Times,serif"
      : "Georgia,'Times New Roman',serif";
    this.first =
      ctx.lead.firstName.trim() ||
      ctx.lead.fullName.trim() ||
      ctx.lead.email.split('@')[0] ||
      (this.rtl ? 'שלום' : 'Hello');
  }

  /** The text for each locale; `he` is used for Hebrew, `en` otherwise. */
  pick<T>(c: { en: T; he: T }): T {
    return this.rtl ? c.he : c.en;
  }

  /** Copy string with markup + {vars} -> html and plain text. */
  r(src: string, vars: Record<string, Dyn> = {}): Frag {
    return rich(src, this.rtl, vars);
  }

  /** Copy string as plain text (subject, preheader, alt text). */
  t(src: string, vars: Record<string, Dyn> = {}): string {
    return plain(src, vars);
  }

  /** The sender's first name as a {first} variable (names follow their own direction). */
  get vars(): Record<string, Dyn> {
    return { first: this.first };
  }

  /** ` dir="rtl"` for Hebrew, nothing for English. */
  get dirAttr(): string {
    return this.rtl ? ' dir="rtl"' : '';
  }

  /** inline-style tail that makes a block right-aligned/right-to-left in Hebrew */
  get ds(): string {
    return this.rtl ? ' direction:rtl; text-align:right;' : '';
  }

  /** "start" and "end" sides as physical names */
  get start(): 'left' | 'right' {
    return this.rtl ? 'right' : 'left';
  }
  get end(): 'left' | 'right' {
    return this.rtl ? 'left' : 'right';
  }

  /** wide-tracked small capitals (Latin only) */
  caps(spacing: string): string {
    return this.rtl ? '' : `letter-spacing:${spacing}; text-transform:uppercase; `;
  }

  /** letter-spacing only (Latin only) */
  track(spacing: string): string {
    return this.rtl ? '' : `letter-spacing:${spacing}; `;
  }

  /** `padding:` shorthand written in the LTR orientation of the source; mirrored in Hebrew. */
  pad(top: string, right: string, bottom: string, left: string): string {
    return this.rtl
      ? `padding:${top} ${left} ${bottom} ${right};`
      : `padding:${top} ${right} ${bottom} ${left};`;
  }

  /** `border-left:` of the source: the start-side border (right in Hebrew). */
  borderStart(value: string): string {
    return `border-${this.start}:${value};`;
  }
}

const TABLE = '<table role="presentation" cellpadding="0" cellspacing="0" border="0"';

export const join = (frags: Frag[], sep = '\n\n'): Frag => ({
  html: frags.map((f) => f.html).join(''),
  text: frags
    .map((f) => f.text)
    .filter(Boolean)
    .join(sep),
});

export const raw = (html: string, text = ''): Frag => ({ html, text });

/** wraps a margin-bottom value: numbers become px, strings pass through ("0px" in the sources) */
const px = (v: number | string): string => (typeof v === 'number' ? `${v}px` : v);

// ---------------------------------------------------------------------------------------------------------------
// text blocks
// ---------------------------------------------------------------------------------------------------------------

/** Small tracked caps label in brass ("THE PEOPLE WHO WILL HANDLE YOUR CASE"). */
export function eyebrow(
  k: Kit,
  text: Frag,
  o: { mb: number | string; center?: boolean; cls?: string } = { mb: 20 },
): Frag {
  const cls = o.cls === '' ? '' : ` class="${o.cls ?? 't-brass'}"`;
  const html = `<p${cls} style="margin:0 0 ${px(o.mb)} 0; font-family:${k.SANS}; font-size:10px; line-height:15px; ${k.caps('0.2em')}color:#7a5c2c;${o.center ? ' text-align:center;' : ''}">${text.html}</p>`;
  return { html, text: k.rtl ? text.text : text.text.toUpperCase() };
}

/** 16px body paragraph on a light background (the `.body` class gets the mobile sizes). */
export function para(k: Kit, text: Frag, o: { mb?: number | string; margin?: string } = {}): Frag {
  const margin = o.margin ?? `0 0 ${px(o.mb ?? 8)} 0`;
  const html = `<p class="body t-body" style="margin:${margin}; font-family:${k.SANS}; font-size:16px; line-height:27px; color:#3f4b56; mso-line-height-rule:exactly;">${text.html}</p>`;
  return { html, text: text.text };
}

/** Serif sub-heading: 21px/28px (questions, section titles) or 22px/32px (closing line). */
export function h2(k: Kit, text: Frag, o: { mb?: number | string; size?: 21 | 22 } = {}): Frag {
  const size = o.size === 22 ? 'font-size:22px; line-height:32px;' : 'font-size:21px; line-height:28px;';
  return {
    html: `<p class="h2 t-ink" style="margin:0 0 ${px(o.mb ?? 8)} 0; font-family:${k.SERIF}; ${size} color:#14202b;">${text.html}</p>`,
    text: text.text,
  };
}

/** Secondary note under a button. */
export function note(k: Kit, text: Frag, o: { mt?: number; color?: string; cls?: string } = {}): Frag {
  const cls = o.cls === undefined ? ' class="t-mute"' : o.cls ? ` class="${o.cls}"` : '';
  return {
    html: `<p${cls} style="margin:${o.mt ?? 14}px 0 0 0; font-family:${k.SANS}; font-size:13px; line-height:20px; color:${o.color ?? '#55606b'};">${text.html}</p>`,
    text: text.text,
  };
}

/** Bold underlined text link on its own line ("Open my portal and check my status"). */
export function textLink(k: Kit, label: Frag, href: string): Frag {
  return {
    html: `<p style="margin:0; font-family:${k.SANS}; font-size:16px; line-height:27px;"><a href="${ea(href)}" style="color:#7a5c2c; font-weight:bold; text-decoration:underline;">${label.html}</a></p>`,
    text: `${label.text}: ${safeUrl(href)}`,
  };
}

/** Title + description pairs ("Your part", "Our research", ...), each description may contain <br>. */
export function items(
  k: Kit,
  list: Array<{ title: Frag; body: Frag }>,
  o: { gap?: number; title?: 'plain' | 'display' } = {},
): Frag {
  const gap = o.gap ?? 20;
  const rows = list
    .map((it, i) => {
      const last = i === list.length - 1;
      const tdPad = last ? '0 0 0px 0' : `0 0 ${gap}px 0`;
      const title =
        o.title === 'display'
          ? `<p class="display t-ink" style="margin:0 0 4px 0; font-family:${k.SERIF}; font-size:27px; line-height:34px; color:#14202b;">${it.title.html}</p>`
          : `<p class="t-ink" style="margin:0 0 4px 0; font-family:${k.SERIF}; font-size:20px; line-height:27px; color:#14202b;">${it.title.html}</p>`;
      return `
        <tr>
          <td style="padding:${tdPad};${k.ds}">
            ${title}
            <p class="body t-body" style="margin:0; font-family:${k.SANS}; font-size:16px; line-height:26px; color:#3f4b56;">${it.body.html}</p>
          </td>
        </tr>
`;
    })
    .join('');
  return {
    html: `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"${k.dirAttr}>
${rows}      </table>`,
    text: list.map((it) => `${it.title.text}\n${it.body.text}`).join('\n\n'),
  };
}

/** The ▪ list. `size` 16 (16/26) or 15.5 (15.5/25, inside the two route cards). */
export function bullets(
  k: Kit,
  list: Frag[],
  o: { mb?: number; gap?: number; size?: 16 | 15.5; table?: boolean } = {},
): Frag {
  const gap = o.gap ?? 8;
  const fs = o.size === 15.5 ? 'font-size:15.5px; line-height:25px;' : 'font-size:16px; line-height:26px;';
  const rows = list
    .map((f, i) => {
      const last = i === list.length - 1;
      return `        <tr><td class="body t-body" style="padding:${last ? '0' : `0 0 ${gap}px 0`}; font-family:${k.SANS}; ${fs} color:#3f4b56;${k.ds}"><span style="color:#a07a3c; font-size:11px;">&#9642;</span> &nbsp;${f.html}</td></tr>`;
    })
    .join('\n');
  const margin = o.mb === undefined ? '' : ` style="margin:0 0 ${o.mb}px 0;"`;
  return {
    html: `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"${margin}${k.dirAttr}>
${rows}
      </table>`,
    text: list.map((f) => `- ${f.text}`).join('\n'),
  };
}

// ---------------------------------------------------------------------------------------------------------------
// buttons
// ---------------------------------------------------------------------------------------------------------------

/**
 * The brass-framed pill button. The frame is a gradient that flows where animation is supported (Apple Mail, iOS
 * Mail, ...) and plain brass everywhere else (the `bgcolor` fallback of the source).
 */
export function cta(
  k: Kit,
  o: { href: string; label: string; variant: 'brass' | 'ink'; center?: boolean },
): Frag {
  const align = o.center ? ' align="center"' : '';
  const link = (color: string) =>
    `<a href="${ea(o.href)}" style="display:block; font-family:${k.SANS}; font-size:16px; line-height:20px; font-weight:bold; ${k.caps('0.07em')}color:${color}; text-decoration:none;">${esc(o.label)}</a>`;
  const inner =
    o.variant === 'brass'
      ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" class="btn-brass">
        <tr>
          <td bgcolor="#f8f5f0" style="padding:18px 36px; background-color:#f8f5f0; border-radius:999px;">
            ${link('#14202b')}
          </td>
        </tr>
      </table>`
      : `<table role="presentation" cellpadding="0" cellspacing="0" border="0" class="btn-ink">
        <tr>
          <td bgcolor="#14202b" align="center" style="padding:18px 36px; background-color:#14202b;">
            ${link('#f8f5f0')}
          </td>
        </tr>
        </table>`;
  const button = `<table role="presentation" cellpadding="0" cellspacing="0" border="0" class="cta"${align}><tr><td class="frame" bgcolor="#a07a3c" style="padding:3px; background-color:#a07a3c; border-radius:999px;">
        ${inner}
      </td></tr></table>`;
  return { html: k.rtl && !o.center ? alignEnd(button) : button, text: `${o.label}: ${safeUrl(o.href)}` };
}

/**
 * Right-aligns a table in Hebrew. `align="right"` on the table itself would float it (text wraps around it), so it is
 * placed in a full-width cell instead, which every mail client honours.
 */
export function alignEnd(tableHtml: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" dir="rtl"><tr><td align="right">${tableHtml}</td></tr></table>`;
}

// ---------------------------------------------------------------------------------------------------------------
// rows of the outer sheet
// ---------------------------------------------------------------------------------------------------------------

export type Bg = 'paper' | 'stone' | 'ink';
const BG: Record<Bg, string> = { paper: '#f8f5f0', stone: '#efe9df', ink: '#14202b' };

/** A full-width coloured band of the sheet. `pad` is the source's padding shorthand ("34px 44px 32px 44px"). */
export function section(
  k: Kit,
  o: { bg: Bg; pad: string; cls?: string; center?: boolean; textAlign?: boolean },
  ...children: Frag[]
): Frag {
  const color = BG[o.bg];
  const bgAttr = o.bg === 'paper' ? '' : ` bgcolor="${color}"`;
  const align = o.center ? ' align="center"' : '';
  const ta = o.textAlign ? ' text-align:center;' : o.center ? '' : k.ds;
  const [t, r, b, l] = o.pad.split(' ') as [string, string, string, string];
  const html = `
  <tr>
    <td${align}${bgAttr}${k.dirAttr} class="${o.cls ?? 'px pt pb'} bg-${o.bg}" style="${k.pad(t, r, b, l)} background-color:${color};${ta}">
      ${children.map((c) => c.html).join('\n      ')}
    </td>
  </tr>
`;
  return {
    html,
    text: children
      .map((c) => c.text)
      .filter(Boolean)
      .join('\n\n'),
  };
}

/** Hairline or brass rule row. */
export function ruleRow(h: 1 | 2): Frag {
  const color = h === 2 ? '#a07a3c' : '#e0d8ca';
  return {
    html: `\n  <tr class="rule"><td class="rule" style="height:${h}px; background-color:${color}; line-height:${h}px; font-size:0;">&nbsp;</td></tr>\n`,
    text: '',
  };
}

/** Logo + practice line, then the brass rule. */
export function letterhead(k: Kit, tagline: string): Frag {
  const alt = k.rtl ? FIRM_NAME_HE : 'DECKER PEX LEVI';
  return {
    html: `
  <!-- letterhead -->
  <tr>
    <td align="center"${k.dirAttr} class="px pt bg-paper" style="padding:30px 40px 22px 40px; background-color:#f8f5f0;">
      <img src="${esc(k.ctx.links.logo)}" width="148" alt="${esc(alt)}" class="logo" style="display:block; border:0; width:148px; max-width:148px; height:auto; font-family:${k.SERIF}; font-size:18px; ${k.track('0.14em')}color:#14202b;">
      <p class="t-brass" style="margin:12px 0 0 0; font-family:${k.SANS}; font-size:10px; line-height:15px; ${k.caps('0.2em')}color:#7a5c2c;">${esc(tagline)}</p>
    </td>
  </tr>
${ruleRow(2).html}`,
    text: `${k.rtl ? FIRM_NAME_HE : 'DECKER PEX LEVI'}\n${tagline}`,
  };
}

export const FIRM_NAME_HE = 'דקר פקס לוי';

/** Team photograph row. */
export function photoRow(k: Kit, alt: string): Frag {
  return {
    html: `
  <tr>
    <td class="bg-paper" style="padding:0; background-color:#f8f5f0;">
      <img src="${esc(k.ctx.links.teamPhoto)}" width="600" alt="${esc(alt)}" style="display:block; border:0; width:100%; max-width:600px; height:auto;">
    </td>
  </tr>
`,
    text: '',
  };
}

export interface HeroOptions {
  kicker: string;
  h1: Frag;
  ledes: Frag[];
  cta?: { href: string; label: string };
  note?: Frag;
}

/** The ink hero: centred kicker and headline, left-aligned (right in Hebrew) lede lines, optional button. */
export function hero(k: Kit, h: HeroOptions): Frag {
  const withCta = Boolean(h.cta);
  const ledes = h.ledes
    .map((l, i) => {
      const last = i === h.ledes.length - 1;
      const mb = last ? (withCta ? '28px' : '0px') : '12px';
      return `<p class="lede" style="margin:0 0 ${mb} 0; font-family:${k.SANS}; font-size:17px; line-height:28px; color:#c5cbd2; mso-line-height-rule:exactly;">${l.html}</p>`;
    })
    .join('\n      ');
  const button = h.cta ? cta(k, { href: h.cta.href, label: h.cta.label, variant: 'brass' }) : null;
  const html = `
  <!-- hero -->
  <tr>
    <td bgcolor="#14202b"${k.dirAttr} class="px pt pb bg-ink" style="padding:42px 44px 40px 44px; background-color:#14202b;${k.ds}">
      <p class="t-brass" style="margin:0 0 18px 0; font-family:${k.SANS}; font-size:10px; line-height:15px; ${k.caps('0.2em')}color:#c9a45c; text-align:center;">${esc(h.kicker)}</p>
      <h1 class="h1" style="margin:0 0 18px 0; font-family:${k.SERIF}; font-weight:normal; font-size:30px; line-height:38px; color:#f8f5f0; text-align:center; mso-line-height-rule:exactly;">${h.h1.html}</h1>
      ${ledes}${button ? `\n      ${button.html}` : ''}${h.note ? `\n      <p class="t-mute" style="margin:16px 0 0 0; font-family:${k.SANS}; font-size:13px; line-height:20px; color:#9aa3ad;">${h.note.html}</p>` : ''}
    </td>
  </tr>
`;
  const text = [
    k.rtl ? h.kicker : h.kicker.toUpperCase(),
    h.h1.text,
    h.ledes.map((l) => l.text).join('\n'),
    button?.text ?? '',
    h.note?.text ?? '',
  ]
    .filter(Boolean)
    .join('\n\n');
  return { html, text };
}

export interface FooterOptions {
  practice: string;
  /** the "initial indication, not legal advice" notice; omitted for security emails */
  disclaimer?: Frag;
  reason: Frag;
  /** the label of the unsubscribe link, or null for transactional emails */
  unsubscribeLabel: string | null;
  /** privacy link label (transactional emails only) */
  privacyLabel?: string;
}

/** The dark footer of the Welcome emails. */
export function footer(k: Kit, f: FooterOptions): Frag {
  const links = k.ctx.links;
  const name = k.rtl ? FIRM_NAME_HE : 'DECKER PEX LEVI';
  const unsub =
    f.unsubscribeLabel && links.unsubscribe
      ? ` <a href="${ea(links.unsubscribe)}" class="t-brass" style="color:#c9a45c; text-decoration:underline;">${esc(f.unsubscribeLabel)}</a>`
      : '';
  const priv =
    !unsub && f.privacyLabel
      ? ` <a href="${ea(links.privacy)}" class="t-brass" style="color:#c9a45c; text-decoration:underline;">${esc(f.privacyLabel)}</a>`
      : '';
  const html = `
  <!-- footer -->
${ruleRow(2).html}  <tr>
    <td align="center" bgcolor="#14202b"${k.dirAttr} class="px pb bg-ink" style="padding:30px 44px 32px 44px; background-color:#14202b; text-align:center;">
      <p style="margin:0 0 8px 0; font-family:${k.SERIF}; font-size:15px; line-height:22px; ${k.track('0.1em')}color:#f8f5f0;">${esc(name)}</p>
      <p class="t-mute" style="margin:0 0 16px 0; font-family:${k.SANS}; font-size:12px; line-height:20px; color:#9aa3ad;">${esc(f.practice)}</p>
${f.disclaimer ? `      <p class="t-mute" style="margin:0 0 14px 0; font-family:${k.SANS}; font-size:11px; line-height:19px; color:#7e8791;">${f.disclaimer.html}</p>\n` : ''}      <p class="t-mute" style="margin:0; font-family:${k.SANS}; font-size:11px; line-height:19px; color:#7e8791;">${f.reason.html}${unsub}${priv}</p>
    </td>
  </tr>
`;
  const textLines = [
    name,
    f.practice,
    f.disclaimer?.text ?? '',
    f.reason.text +
      (unsub ? ` ${f.unsubscribeLabel}: ${safeUrl(links.unsubscribe!)}` : '') +
      (priv ? ` ${f.privacyLabel}: ${safeUrl(links.privacy)}` : ''),
  ];
  return { html, text: `--\n${textLines.filter(Boolean).join('\n')}` };
}

// ---------------------------------------------------------------------------------------------------------------
// blocks of the "Lead Email" design that the transactional emails reuse
// ---------------------------------------------------------------------------------------------------------------

/** The white "file plate" with a header line and label/value rows. */
export function plate(
  k: Kit,
  o: { title: Frag; right?: Frag; rows: Array<{ label: Frag; value: Frag; tone?: 'ink' | 'brass' }> },
): Frag {
  const rows = o.rows
    .map((r, i) => {
      const last = i === o.rows.length - 1;
      const border = last ? '' : ' border-bottom:1px solid #ece6dc;';
      return `              <tr>
                <td width="46%" valign="top" style="${k.pad('11px', '12px', '11px', '0')}${border} font-family:${k.SANS}; font-size:13px; line-height:20px; color:#6b6459;${k.ds}">${r.label.html}</td>
                <td valign="top" style="${last ? 'padding:11px 0;' : 'padding:11px 0;'}${border} font-family:${k.SANS}; font-size:15px; line-height:20px; color:${r.tone === 'brass' ? '#7a5c2c' : '#14202b'};${k.ds}">${r.value.html}</td>
              </tr>`;
    })
    .join('\n');
  const html = `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"${k.dirAttr} style="border:1px solid #d8cfc0; background-color:#ffffff;">
        <tr>
          <td style="padding:20px 26px 14px 26px; border-bottom:1px solid #ece6dc;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"${k.dirAttr}>
              <tr>
                <td align="${k.start}" style="font-family:${k.SANS}; font-size:10px; line-height:15px; ${k.caps('0.2em')}color:#7a5c2c;${k.ds}">${o.title.html}</td>${
                  o.right
                    ? `
                <td align="${k.end}" style="font-family:${k.SANS}; font-size:12px; line-height:15px; color:#6b6459;${k.rtl ? ' direction:rtl; text-align:left;' : ''}">${o.right.html}</td>`
                    : ''
                }
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:6px 26px 20px 26px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"${k.dirAttr}>
${rows}
            </table>
          </td>
        </tr>
      </table>`;
  const text = [
    `${k.rtl ? o.title.text : o.title.text.toUpperCase()}${o.right ? ` (${o.right.text})` : ''}`,
    ...o.rows.map((r) => `${r.label.text}: ${r.value.text}`),
  ].join('\n');
  return { html, text };
}

/** Numbered steps (01 / 02 / 03). */
export function steps(k: Kit, list: Frag[]): Frag {
  const rows = list
    .map((f, i) => {
      const last = i === list.length - 1;
      const pad = last ? 'padding:0;' : 'padding:0 0 20px 0;';
      return `        <tr>
          <td width="52" valign="top" style="width:52px; ${pad} font-family:${k.SERIF}; font-size:30px; line-height:30px; color:#7a5c2c;${k.ds}">0${i + 1}</td>
          <td valign="top" style="${pad} font-family:${k.SANS}; font-size:16px; line-height:25px; color:#14202b;${k.ds}">${f.html}</td>
        </tr>`;
    })
    .join('\n');
  return {
    html: `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"${k.dirAttr}>
${rows}
      </table>`,
    text: list.map((f, i) => `0${i + 1}  ${f.text}`).join('\n'),
  };
}

/** Pull quote with the brass rule on the start side. */
export function pullQuote(k: Kit, quote: Frag, byline: Frag): Frag {
  return {
    html: `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"${k.dirAttr} style="${k.borderStart('2px solid #a07a3c')}">
        <tr>
          <td style="${k.pad('2px', '0', '2px', '22px')}${k.ds}">
            <p class="quote" style="margin:0 0 14px 0; font-family:${k.SERIF}; font-size:22px; line-height:34px; color:#14202b;">${quote.html}</p>
            <p style="margin:0; font-family:${k.SANS}; font-size:13px; line-height:20px; color:#6b6459;">${byline.html}</p>
          </td>
        </tr>
      </table>`,
    text: `${quote.text}\n${byline.text}`,
  };
}
