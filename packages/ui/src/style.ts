import type { CSSProperties } from 'react';

/**
 * `s()` turns the CSS declaration strings of the design prototypes into React style objects, so the markup can be
 * ported with the original values copied verbatim, and makes them direction-aware:
 *
 *  - physical left/right properties become logical ones (margin-left -> margin-inline-start, text-align:left -> start,
 *    left -> inset-inline-start, border-left -> border-inline-start, 4-value margin/padding/border-radius are expanded),
 *    so the same declaration is correct in LTR (English) and RTL (Hebrew);
 *  - gradient directions flip through the --dir variable (1 in LTR, -1 in RTL, set on <html>);
 *  - 'Newsreader' / 'Manrope' families map to var(--font-serif) / var(--font-sans), which are Hebrew-aware;
 *  - `!important` is not supported in inline styles: move such rules to CSS.
 *
 * Include a CSS comment that reads noflip anywhere in the string to keep every property physical (e.g. a centred
 * absolute element with translateX(-50%)).
 * Results are cached per input string, so call it at module scope or inside render freely.
 */

type Style = Record<string, string | number>;

const LOGICAL_PROPS: Record<string, string> = {
  'margin-left': 'margin-inline-start',
  'margin-right': 'margin-inline-end',
  'padding-left': 'padding-inline-start',
  'padding-right': 'padding-inline-end',
  'border-left': 'border-inline-start',
  'border-right': 'border-inline-end',
  'border-left-color': 'border-inline-start-color',
  'border-right-color': 'border-inline-end-color',
  'border-left-width': 'border-inline-start-width',
  'border-right-width': 'border-inline-end-width',
  'border-left-style': 'border-inline-start-style',
  'border-right-style': 'border-inline-end-style',
  left: 'inset-inline-start',
  right: 'inset-inline-end',
  'border-top-left-radius': 'border-start-start-radius',
  'border-top-right-radius': 'border-start-end-radius',
  'border-bottom-right-radius': 'border-end-end-radius',
  'border-bottom-left-radius': 'border-end-start-radius',
  'scroll-margin-left': 'scroll-margin-inline-start',
  'scroll-margin-right': 'scroll-margin-inline-end',
};

const SIDE_VALUES: Record<string, string> = { left: 'start', right: 'end' };
const FLOAT_VALUES: Record<string, string> = { left: 'inline-start', right: 'inline-end' };

/** Splits on `sep` outside parentheses and quotes. */
export function splitTopLevel(input: string, sep: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let quote = '';
  let cur = '';
  for (const ch of input) {
    if (quote) {
      cur += ch;
      if (ch === quote) quote = '';
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      cur += ch;
      continue;
    }
    if (ch === '(') depth++;
    else if (ch === ')') depth--;
    if (ch === sep && depth === 0) {
      out.push(cur);
      cur = '';
      continue;
    }
    cur += ch;
  }
  if (cur.trim()) out.push(cur);
  return out;
}

const camel = (prop: string): string =>
  prop.startsWith('--') ? prop : prop.replace(/^-ms-/, 'ms-').replace(/-([a-z])/g, (_m, c: string) => c.toUpperCase());

function flipGradient(value: string): string {
  return value.replace(/(linear-gradient|repeating-linear-gradient)\(\s*([^,]+),/g, (m, fn: string, dir: string) => {
    const d = dir.trim();
    if (d === 'to right') return `${fn}(calc(90deg * var(--dir, 1)),`;
    if (d === 'to left') return `${fn}(calc(-90deg * var(--dir, 1)),`;
    const angle = /^(-?\d+(?:\.\d+)?)deg$/.exec(d);
    if (angle) return `${fn}(calc(${angle[1]}deg * var(--dir, 1)),`;
    return m;
  });
}

function mapFontFamily(value: string): string {
  const v = value.toLowerCase();
  if (v.includes('newsreader') || v.includes('georgia')) return 'var(--font-serif)';
  if (v.includes('manrope') || v.includes('system-ui') || v.includes('sans-serif')) return 'var(--font-sans)';
  return value;
}

/** Expands 1-4 value box shorthands to [top, right, bottom, left]. */
function box4(value: string): [string, string, string, string] | null {
  const p = value.trim().split(/\s+(?![^(]*\))/);
  if (p.length < 1 || p.length > 4 || p.some((x) => x === '')) return null;
  const [a, b = a, c = a, d = b] = p;
  return [a!, b, c, d];
}

function expand(prop: string, value: string, out: Style, flip: boolean): void {
  if (!flip) {
    out[camel(prop)] = value;
    return;
  }

  if (prop === 'margin' || prop === 'padding') {
    const box = box4(value);
    if (box && box[1] !== box[3]) {
      out[camel(`${prop}-block-start`)] = box[0];
      out[camel(`${prop}-inline-end`)] = box[1];
      out[camel(`${prop}-block-end`)] = box[2];
      out[camel(`${prop}-inline-start`)] = box[3];
      return;
    }
  }
  if (prop === 'border-radius' && !value.includes('/')) {
    const box = box4(value);
    if (box && (box[0] !== box[1] || box[1] !== box[2] || box[2] !== box[3]) && (box[0] !== box[1] || box[2] !== box[3])) {
      out['borderStartStartRadius'] = box[0];
      out['borderStartEndRadius'] = box[1];
      out['borderEndEndRadius'] = box[2];
      out['borderEndStartRadius'] = box[3];
      return;
    }
  }
  if (prop === 'text-align' && SIDE_VALUES[value]) {
    out.textAlign = SIDE_VALUES[value]!;
    return;
  }
  if ((prop === 'float' || prop === 'clear') && FLOAT_VALUES[value]) {
    out[camel(prop)] = FLOAT_VALUES[value]!;
    return;
  }
  const logical = LOGICAL_PROPS[prop];
  if (logical) {
    out[camel(logical)] = value;
    return;
  }
  out[camel(prop)] = value;
}

const cache = new Map<string, CSSProperties>();

export function s(css: string | undefined | null | false): CSSProperties {
  if (!css) return {};
  const hit = cache.get(css);
  if (hit) return hit;

  const noflip = /\/\*\s*noflip\s*\*\//.test(css);
  const out: Style = {};
  for (const decl of splitTopLevel(css.replace(/\/\*[\s\S]*?\*\//g, ''), ';')) {
    const i = decl.indexOf(':');
    if (i < 0) continue;
    const prop = decl.slice(0, i).trim().toLowerCase();
    let value = decl.slice(i + 1).trim();
    if (!prop || !value) continue;
    if (/!important\s*$/i.test(value)) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn(`s(): "!important" is not supported in inline styles (${prop}); move it to CSS`);
      }
      value = value.replace(/\s*!important\s*$/i, '');
    }
    if (prop === 'font-family') value = mapFontFamily(value);
    if (!noflip && (prop.startsWith('background') || prop === 'mask-image' || prop === 'mask')) value = flipGradient(value);
    expand(prop, value, out, !noflip);
  }
  cache.set(css, out as CSSProperties);
  return out as CSSProperties;
}

// -- hover / focus ---------------------------------------------------------------------------------------------

/** Property -> short class/variable key. The rules live in hover.css. */
const STATE_PROPS: Record<string, string> = {
  'border-color': 'bc',
  'border-bottom-color': 'bbc',
  'border-top-color': 'btc',
  background: 'bg',
  'background-color': 'bg',
  color: 'c',
  transform: 'tf',
  outline: 'ol',
  'outline-color': 'olc',
  'box-shadow': 'sh',
  opacity: 'op',
  'padding-left': 'pis',
  'padding-inline-start': 'pis',
  left: 'is',
  'inset-inline-start': 'is',
  'text-decoration': 'td',
  fill: 'fl',
  stroke: 'st',
};

export interface XOptions {
  /** the prototype's `style-hover` declarations */
  hover?: string;
  /** the prototype's `style-focus` declarations */
  focus?: string;
  className?: string;
}

/**
 * `s()` plus hover/focus states: `<a {...x('color:#000', { hover: 'color:#a07a3c' })} />`.
 * Hover/focus values become CSS variables consumed by the classes in `@dpl/ui/hover.css`.
 */
export function x(css: string | undefined | null | false, opts: XOptions = {}): { style: CSSProperties; className?: string } {
  const style: Style = { ...(s(css) as Style) };
  const classes: string[] = opts.className ? [opts.className] : [];
  for (const [prefix, str] of [['hv', opts.hover], ['fv', opts.focus]] as const) {
    if (!str) continue;
    for (const decl of splitTopLevel(str, ';')) {
      const i = decl.indexOf(':');
      if (i < 0) continue;
      const prop = decl.slice(0, i).trim().toLowerCase();
      const key = STATE_PROPS[prop];
      if (!key) throw new Error(`x(): unsupported ${prefix === 'hv' ? 'hover' : 'focus'} property "${prop}" (add it to STATE_PROPS and hover.css)`);
      classes.push(`${prefix}-${key}`);
      style[`--${prefix}-${key}`] = decl.slice(i + 1).trim();
    }
  }
  return { style: style as CSSProperties, className: classes.length ? [...new Set(classes)].join(' ') : undefined };
}

export const cx = (...parts: Array<string | false | null | undefined>): string => parts.filter(Boolean).join(' ');
