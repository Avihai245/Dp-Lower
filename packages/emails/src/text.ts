/**
 * Escaping and the tiny copy markup used by every template.
 *
 * Copy strings are written as plain Unicode text with this markup:
 *   <b>..</b>      bold (the sources use <strong style="font-weight:bold;">)
 *   <br>           line break
 *   <ltr>..</ltr>  a left-to-right island (Latin names, numbers, "Dun's 100, 2026"): isolated in Hebrew, plain in English
 *   {name}         a dynamic value from `vars`: always HTML-escaped, isolated in Hebrew
 * Everything else is escaped, so a hostile value can never inject markup.
 */

/** A rendered piece: email-client-safe HTML and its plain-text twin. */
export interface Frag {
  html: string;
  text: string;
}

/** A dynamic value. A plain string follows its own direction (names); `dir: 'ltr'` forces left-to-right (refs, emails, dates). */
export type Dyn = string | { text: string; dir?: 'ltr' | 'auto' };

export const ltr = (text: string): Dyn => ({ text, dir: 'ltr' });

/** Typographic characters that the sources write as named entities. */
const ENTITIES: Record<string, string> = {
  '\u{2019}': '&rsquo;',
  '\u{2018}': '&lsquo;',
  '\u{201c}': '&ldquo;',
  '\u{201d}': '&rdquo;',
  '\u{201e}': '&bdquo;',
  '\u{b7}': '&middot;',
  '\u{2014}': '&mdash;',
  '\u{2013}': '&ndash;',
  '\u{2026}': '&hellip;',
  '\u{fc}': '&uuml;',
  '\u{2605}': '&#9733;',
  '\u{25aa}': '&#9642;',
  '\u{2192}': '&rarr;',
  '\u{2190}': '&larr;',
  '\u{a0}': '&nbsp;',
};
const ENTITY_CHARS = /[\u{2019}\u{2018}\u{201c}\u{201d}\u{201e}\u{b7}\u{2014}\u{2013}\u{2026}\u{fc}\u{2605}\u{25aa}\u{2192}\u{2190}\u{a0}]/gu;

/** HTML-escapes text for element content and double-quoted attributes; typographic characters become the named entities the sources use. */
export function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(ENTITY_CHARS, (c) => ENTITIES[c] ?? c);
}

/** Only web, mail and phone links are ever written into an href; anything else (javascript:, data:, relative) becomes "#". */
export function safeUrl(url: string): string {
  const u = url.trim();
  return /^(https?:\/\/|mailto:|tel:)/i.test(u) ? u : '#';
}

/** An href value: validated, then escaped for a double-quoted attribute. */
export const ea = (url: string): string => esc(safeUrl(url));

/** Right-to-left mark. */
const RLM = '\u{200f}';
const HEBREW = /[\u{0590}-\u{05ff}]/u;

const dynText = (v: Dyn): string => (typeof v === 'string' ? v : v.text);

function dynHtml(v: Dyn, rtl: boolean): string {
  const text = esc(dynText(v));
  if (!rtl) return text;
  const dir = typeof v === 'string' ? 'auto' : (v.dir ?? 'auto');
  return `<span dir="${dir}" style="unicode-bidi:isolate;">${text}</span>`;
}

const TOKEN = /(<br\s*\/?>|<\/?b>|<\/?ltr>|\{[A-Za-z0-9_]+\})/g;

/** Turns a copy string into HTML + plain text. Throws when a {var} has no value, so a missing value can never ship as "undefined". */
export function rich(src: string, rtl: boolean, vars: Record<string, Dyn> = {}): Frag {
  let html = '';
  let text = '';
  for (const part of src.split(TOKEN)) {
    if (!part) continue;
    if (/^<br/i.test(part)) {
      html += '<br>';
      text += '\n';
    } else if (part === '<b>') {
      html += '<strong style="font-weight:bold;">';
    } else if (part === '</b>') {
      html += '</strong>';
    } else if (part === '<ltr>') {
      html += rtl ? '<span dir="ltr" style="unicode-bidi:isolate;">' : '';
    } else if (part === '</ltr>') {
      html += rtl ? '</span>' : '';
    } else if (part.startsWith('{') && part.endsWith('}')) {
      const key = part.slice(1, -1);
      const v = vars[key];
      if (v === undefined) throw new Error(`email copy uses {${key}} but no value was given`);
      html += dynHtml(v, rtl);
      text += dynText(v);
    } else {
      html += esc(part);
      text += part;
    }
  }
  return { html, text };
}

/** Verbatim text (user- or staff-written): escaped, line breaks kept, no copy markup is interpreted. */
export function lit(text: string): Frag {
  return { html: esc(text).replace(/\r?\n/g, '<br>'), text };
}

/** Plain text of a copy string (subjects, preheaders, alt texts). */
export function plain(src: string, vars: Record<string, Dyn> = {}): string {
  return rich(src, false, vars).text;
}

/**
 * Final plain-text assembly. Hebrew lines that contain Hebrew get a leading right-to-left mark so mail clients that
 * detect direction per paragraph do not treat a line that starts with a Latin name as left-to-right.
 */
export function finishText(blocks: string[], rtl: boolean): string {
  const body = blocks
    .map((b) => b.trim())
    .filter(Boolean)
    .join('\n\n');
  const out = rtl
    ? body
        .split('\n')
        .map((line) => (HEBREW.test(line) ? RLM + line : line))
        .join('\n')
    : body;
  return `${out}\n`;
}
