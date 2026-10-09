/**
 * Development helper: compares the HTML our templates produce (English) with the static design sources
 * ("Lead Email.html", "Welcome 1.html" ... "Welcome 15.html") structurally, so that markup, inline styles and copy can
 * be proven identical rather than eyeballed. Used by `source-fidelity.test.ts` and `scripts/compare-sources.ts`.
 * Not part of the runtime package surface (index.ts does not export it).
 */
import fs from 'node:fs';
import { JSDOM } from 'jsdom';
import { getContent } from '@dpl/i18n';
import type { EmailContext, EmailTemplateId } from './types';

export const DESIGN_DIR =
  process.env.DESIGN_DIR ??
  '/tmp/claude-0/-home-user-Dp-Lower/da03b263-f960-5b12-8d27-94b18ce889b9/scratchpad/design/form-design-blockers/project';

export const hasDesignSources = (): boolean => fs.existsSync(`${DESIGN_DIR}/Lead Email.html`);

export const sourceFile = (id: EmailTemplateId): string | null =>
  id === 'file-open'
    ? 'Lead Email.html'
    : id.startsWith('welcome-')
      ? `Welcome ${id.split('-')[1]}.html`
      : null;

/**
 * The source file with the two intended substitutions applied: the merge placeholder `{{unsubscribe_link}}` becomes the
 * fixture's unsubscribe URL, and the Lead Email's "[Street address], Tel Aviv, Israel" placeholder becomes the firm's
 * real Tel Aviv office address from the content package (the brief's one deliberate difference).
 */
export function readSource(id: EmailTemplateId): string {
  const html = fs.readFileSync(`${DESIGN_DIR}/${sourceFile(id)}`, 'utf8');
  const address = (getContent('en').offices[0]?.address ?? '').replace(/\.$/, '');
  return html
    .replace(/\{\{unsubscribe_link\}\}/g, UNSUBSCRIBE_URL)
    .replace('[Street address], Tel Aviv, Israel', address);
}

const UNSUBSCRIBE_URL = 'https://euro-passports.com/unsubscribe';

/** A context whose values equal the placeholders hard-coded in the sources ("David", DPL-26-1487, portal URL, ...). */
export function sourceFixture(
  id: EmailTemplateId,
  route: 'germany' | 'austria' | 'both' = 'both',
): EmailContext {
  const lead = id === 'file-open';
  return {
    locale: 'en',
    lead: {
      id: 'x',
      firstName: 'David',
      fullName: 'David Cohen',
      email: 'david@example.com',
      caseRef: 'DPL-26-1487',
      route: lead ? 'germany' : route,
    },
    links: {
      portal: 'https://euro-passports.com/portal',
      site: 'https://www.lawoffice.org.il',
      privacy: 'https://euro-passports.com/privacy',
      unsubscribe: UNSUBSCRIBE_URL,
      logo: 'uploads/DPL_logo.webp',
      teamPhoto: 'uploads/Decker-Pex-Levi-Team-scaled.jpg.webp',
      booking: lead ? 'https://euro-passports.com/ger-aus/' : 'https://euro-passports.com/portal',
    },
    data: { applicationState: 'not_started', docsReceived: 0, docsTotal: 8 },
  };
}

/** Classes that carry styling (media queries, the animated frame); the others are dark-mode hooks without CSS. */
const FUNCTIONAL = new Set(
  'wrap px pt pb h1 h2 lede body quote num cta btn-brass btn-ink frame hide-sm logo stack bignum display'.split(
    ' ',
  ),
);

/** One line per node: tag + sorted attributes (style declarations sorted and normalised) or the collapsed text. */
export function canonicalize(html: string): string[] {
  const doc = new JSDOM(html).window.document;
  const out: string[] = [];
  const walk = (node: Node, depth: number): void => {
    const pad = '  '.repeat(depth);
    if (node.nodeType === 3) {
      const t = (node.textContent ?? '').replace(/\s+/g, ' ').trim();
      if (t) out.push(`${pad}"${t}"`);
      return;
    }
    if (node.nodeType !== 1) return;
    const el = node as Element;
    const tag = el.tagName.toLowerCase();
    const attrs: string[] = [];
    for (const a of Array.from(el.attributes).sort((x, y) => x.name.localeCompare(y.name))) {
      let v = a.value;
      if (a.name === 'class') {
        v = v
          .split(/\s+/)
          .filter((c) => FUNCTIONAL.has(c))
          .sort()
          .join(' ');
        if (!v) continue;
      } else if (a.name === 'style') {
        v = v
          .split(';')
          .map((d) => d.trim())
          .filter(Boolean)
          .filter((d) => d.replace(/\s+/g, '') !== 'white-space:nowrap')
          .map((d) =>
            d
              .replace(/\s*:\s*/, ':')
              .replace(/\s+/g, ' ')
              .replace(/\s*,\s*/g, ','),
          )
          .sort()
          .join(';');
      } else if (a.name === 'dir' || a.name === 'lang') {
        continue;
      }
      attrs.push(`${a.name}=${JSON.stringify(v)}`);
    }
    out.push(`${pad}<${tag}${attrs.length ? ` ${attrs.join(' ')}` : ''}>`);
    // the hidden preheader: ignore the invisible filler that keeps the body out of the inbox preview
    if (tag === 'span' && /display:\s*none/.test(el.getAttribute('style') ?? '')) {
      out.push(`${pad}  "${(el.textContent ?? '').replace(/[\u{a0}\u{200c}]+/gu, '').trim()}"`);
      return;
    }
    el.childNodes.forEach((c) => walk(c, depth + 1));
  };
  walk(doc.body, 0);
  return out;
}

/** Plain unified-style diff of two canonical line lists (first differing regions with a little context). */
export function diffLines(a: string[], b: string[], context = 2): string[] {
  // LCS-based diff; the lists are a few hundred lines, so O(n*m) is fine
  const n = a.length;
  const m = b.length;
  const lcs: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--)
    for (let j = m - 1; j >= 0; j--)
      lcs[i]![j] = a[i] === b[j] ? lcs[i + 1]![j + 1]! + 1 : Math.max(lcs[i + 1]![j]!, lcs[i]![j + 1]!);
  const ops: Array<{ t: ' ' | '-' | '+'; s: string }> = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      ops.push({ t: ' ', s: a[i]! });
      i++;
      j++;
    } else if (lcs[i + 1]![j]! >= lcs[i]![j + 1]!) ops.push({ t: '-', s: a[i++]! });
    else ops.push({ t: '+', s: b[j++]! });
  }
  while (i < n) ops.push({ t: '-', s: a[i++]! });
  while (j < m) ops.push({ t: '+', s: b[j++]! });
  const keep = new Array<boolean>(ops.length).fill(false);
  ops.forEach((op, idx) => {
    if (op.t === ' ') return;
    for (let d = -context; d <= context; d++) if (idx + d >= 0 && idx + d < ops.length) keep[idx + d] = true;
  });
  const out: string[] = [];
  let skipped = false;
  ops.forEach((op, idx) => {
    if (keep[idx]) {
      out.push(`${op.t} ${op.s}`);
      skipped = false;
    } else if (!skipped) {
      out.push('  ...');
      skipped = true;
    }
  });
  return out.filter((l) => l !== '  ...' || out.length > 1);
}
