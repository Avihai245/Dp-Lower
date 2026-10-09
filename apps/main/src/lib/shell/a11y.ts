/**
 * Accessibility preferences of the site widget (zoom, colour filters, underlined links, readable font, no motion).
 * They are written as data-a11y-* attributes on <html>, which globals.css turns into styles for #dpl-page, and persisted
 * in localStorage under `dpl-a11y` (same JSON shape as the prototype's). A tiny inline script applies the stored
 * attributes before first paint so a returning visitor never sees the unadjusted page.
 */

export const A11Y_STORAGE_KEY = 'dpl-a11y';

export const ZOOM_MIN = -1;
export const ZOOM_MAX = 2;

export const A11Y_FILTERS = ['contrast', 'invert', 'grayscale', 'light'] as const;
export type A11yFilterValue = (typeof A11Y_FILTERS)[number];
export type A11yFilter = '' | A11yFilterValue;

export interface A11yState {
  /** -1 smaller, 0 normal, 1 larger, 2 largest */
  zoom: number;
  filter: A11yFilter;
  links: boolean;
  font: boolean;
  motion: boolean;
}

export const DEFAULT_A11Y: A11yState = { zoom: 0, filter: '', links: false, font: false, motion: false };

export type A11yAction =
  | { type: 'zoom'; delta: 1 | -1 }
  | { type: 'filter'; value: A11yFilterValue }
  | { type: 'toggle'; key: 'links' | 'font' | 'motion' }
  | { type: 'reset' };

const clampZoom = (n: number): number => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, n));

export function reduceA11y(state: A11yState, action: A11yAction): A11yState {
  switch (action.type) {
    case 'zoom':
      return { ...state, zoom: clampZoom(state.zoom + action.delta) };
    case 'filter':
      // one colour filter at a time; choosing the active one switches it off
      return { ...state, filter: state.filter === action.value ? '' : action.value };
    case 'toggle':
      return { ...state, [action.key]: !state[action.key] };
    case 'reset':
      return DEFAULT_A11Y;
  }
}

export const isDefaultA11y = (s: A11yState): boolean =>
  s.zoom === 0 && s.filter === '' && !s.links && !s.font && !s.motion;

export interface A11yAttributes {
  'data-a11y-zoom': string | null;
  'data-a11y-filter': string | null;
  'data-a11y-links': string | null;
  'data-a11y-font': string | null;
  'data-a11y-motion': string | null;
}

/** The attributes for <html>: a value to set, or null to remove the attribute. */
export function a11yAttributes(s: A11yState): A11yAttributes {
  return {
    'data-a11y-zoom': s.zoom ? String(s.zoom) : null,
    'data-a11y-filter': s.filter || null,
    'data-a11y-links': s.links ? '1' : null,
    'data-a11y-font': s.font ? '1' : null,
    'data-a11y-motion': s.motion ? '1' : null,
  };
}

export function applyA11yToRoot(root: HTMLElement, s: A11yState): void {
  for (const [name, value] of Object.entries(a11yAttributes(s))) {
    if (value === null) root.removeAttribute(name);
    else root.setAttribute(name, value);
  }
}

/** Reads the stored JSON defensively: anything unexpected falls back to the default for that field. */
export function parseStoredA11y(raw: string | null | undefined): A11yState {
  if (!raw) return DEFAULT_A11Y;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return DEFAULT_A11Y;
  }
  if (!data || typeof data !== 'object') return DEFAULT_A11Y;
  const o = data as Record<string, unknown>;
  const zoom = typeof o.a11yZoom === 'number' && Number.isInteger(o.a11yZoom) ? o.a11yZoom : 0;
  const filter = (A11Y_FILTERS as readonly unknown[]).includes(o.a11yFilter) ? (o.a11yFilter as A11yFilterValue) : '';
  return {
    zoom: zoom >= ZOOM_MIN && zoom <= ZOOM_MAX ? zoom : 0,
    filter,
    links: o.a11yLinks === true,
    font: o.a11yFont === true,
    motion: o.a11yMotion === true,
  };
}

export function serializeA11y(s: A11yState): string {
  return JSON.stringify({ a11yZoom: s.zoom, a11yFilter: s.filter, a11yLinks: s.links, a11yFont: s.font, a11yMotion: s.motion });
}

export function loadA11y(): A11yState {
  try {
    return parseStoredA11y(localStorage.getItem(A11Y_STORAGE_KEY));
  } catch {
    return DEFAULT_A11Y;
  }
}

export function saveA11y(s: A11yState): void {
  try {
    if (isDefaultA11y(s)) localStorage.removeItem(A11Y_STORAGE_KEY);
    else localStorage.setItem(A11Y_STORAGE_KEY, serializeA11y(s));
  } catch {
    /* private mode or blocked storage: the preference simply does not persist */
  }
}

/**
 * Inline script for the document: same rules as parseStoredA11y + a11yAttributes, self-contained because it runs
 * before any bundle. a11y.test.ts executes it against the same inputs as the functions above.
 */
export const A11Y_INIT_SCRIPT = `(function(){try{var raw=localStorage.getItem(${JSON.stringify(A11Y_STORAGE_KEY)});if(!raw)return;var s=JSON.parse(raw);if(!s||typeof s!=="object")return;var r=document.documentElement,z=s.a11yZoom,f=s.a11yFilter;function set(k,v){if(v)r.setAttribute(k,v);else r.removeAttribute(k)}set("data-a11y-zoom",z===-1||z===1||z===2?String(z):"");set("data-a11y-filter",f==="contrast"||f==="invert"||f==="grayscale"||f==="light"?f:"");set("data-a11y-links",s.a11yLinks===true?"1":"");set("data-a11y-font",s.a11yFont===true?"1":"");set("data-a11y-motion",s.a11yMotion===true?"1":"")}catch(e){}})();`;
