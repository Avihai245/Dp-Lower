// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import {
  A11Y_FILTERS,
  A11Y_INIT_SCRIPT,
  A11Y_STORAGE_KEY,
  a11yAttributes,
  applyA11yToRoot,
  DEFAULT_A11Y,
  isDefaultA11y,
  loadA11y,
  parseStoredA11y,
  reduceA11y,
  saveA11y,
  serializeA11y,
  type A11yAction,
  type A11yState,
} from './a11y';

const run = (state: A11yState, ...actions: A11yAction[]) => actions.reduce(reduceA11y, state);

describe('reduceA11y', () => {
  it('steps the zoom from -1 to 2 and clamps at both ends', () => {
    let s = DEFAULT_A11Y;
    const seen: number[] = [];
    for (let i = 0; i < 5; i++) {
      s = run(s, { type: 'zoom', delta: 1 });
      seen.push(s.zoom);
    }
    expect(seen).toEqual([1, 2, 2, 2, 2]);
    seen.length = 0;
    for (let i = 0; i < 5; i++) {
      s = run(s, { type: 'zoom', delta: -1 });
      seen.push(s.zoom);
    }
    expect(seen).toEqual([1, 0, -1, -1, -1]);
  });

  it('keeps one colour filter at a time, and choosing the active one switches it off', () => {
    let s = run(DEFAULT_A11Y, { type: 'filter', value: 'contrast' });
    expect(s.filter).toBe('contrast');
    s = run(s, { type: 'filter', value: 'invert' });
    expect(s.filter).toBe('invert');
    s = run(s, { type: 'filter', value: 'invert' });
    expect(s.filter).toBe('');
  });

  it('toggles links, font and motion independently', () => {
    let s = run(DEFAULT_A11Y, { type: 'toggle', key: 'links' }, { type: 'toggle', key: 'motion' });
    expect(s).toMatchObject({ links: true, font: false, motion: true });
    s = run(s, { type: 'toggle', key: 'links' });
    expect(s).toMatchObject({ links: false, motion: true });
  });

  it('resets everything', () => {
    const s = run(DEFAULT_A11Y, { type: 'zoom', delta: 1 }, { type: 'filter', value: 'light' }, { type: 'toggle', key: 'font' }, { type: 'reset' });
    expect(s).toEqual(DEFAULT_A11Y);
    expect(isDefaultA11y(s)).toBe(true);
  });

  it('does not mutate the previous state', () => {
    const before = { ...DEFAULT_A11Y };
    run(DEFAULT_A11Y, { type: 'zoom', delta: 1 }, { type: 'toggle', key: 'links' });
    expect(DEFAULT_A11Y).toEqual(before);
  });
});

describe('a11yAttributes', () => {
  it('sets nothing for the defaults', () => {
    expect(Object.values(a11yAttributes(DEFAULT_A11Y))).toEqual([null, null, null, null, null]);
  });

  it('maps each setting to its data attribute', () => {
    expect(a11yAttributes({ zoom: -1, filter: 'grayscale', links: true, font: true, motion: true })).toEqual({
      'data-a11y-zoom': '-1',
      'data-a11y-filter': 'grayscale',
      'data-a11y-links': '1',
      'data-a11y-font': '1',
      'data-a11y-motion': '1',
    });
  });

  it('applies and removes attributes on the root element', () => {
    const root = document.createElement('html');
    applyA11yToRoot(root, { zoom: 2, filter: 'contrast', links: false, font: true, motion: false });
    expect(root.getAttribute('data-a11y-zoom')).toBe('2');
    expect(root.getAttribute('data-a11y-filter')).toBe('contrast');
    expect(root.hasAttribute('data-a11y-links')).toBe(false);
    expect(root.getAttribute('data-a11y-font')).toBe('1');
    applyA11yToRoot(root, DEFAULT_A11Y);
    expect(root.getAttributeNames().filter((n) => n.startsWith('data-a11y'))).toEqual([]);
  });
});

describe('stored preferences', () => {
  beforeEach(() => localStorage.clear());

  it('round-trips through the prototype-compatible JSON shape', () => {
    const state: A11yState = { zoom: 1, filter: 'invert', links: true, font: false, motion: true };
    expect(JSON.parse(serializeA11y(state))).toEqual({ a11yZoom: 1, a11yFilter: 'invert', a11yLinks: true, a11yFont: false, a11yMotion: true });
    expect(parseStoredA11y(serializeA11y(state))).toEqual(state);
  });

  it('reads what the prototype stored', () => {
    const raw = JSON.stringify({ a11yZoom: -1, a11yFilter: 'light', a11yLinks: false, a11yFont: true, a11yMotion: false });
    expect(parseStoredA11y(raw)).toEqual({ zoom: -1, filter: 'light', links: false, font: true, motion: false });
  });

  it('falls back to the defaults, field by field, for anything unexpected', () => {
    expect(parseStoredA11y(null)).toEqual(DEFAULT_A11Y);
    expect(parseStoredA11y('')).toEqual(DEFAULT_A11Y);
    expect(parseStoredA11y('{broken')).toEqual(DEFAULT_A11Y);
    expect(parseStoredA11y('[1,2]')).toEqual(DEFAULT_A11Y);
    expect(parseStoredA11y('"zoom"')).toEqual(DEFAULT_A11Y);
    expect(parseStoredA11y(JSON.stringify({ a11yZoom: 7, a11yFilter: 'sepia', a11yLinks: 'yes', a11yFont: 1, a11yMotion: null }))).toEqual(DEFAULT_A11Y);
    expect(parseStoredA11y(JSON.stringify({ a11yZoom: 1.5, a11yFilter: 'contrast' }))).toEqual({ ...DEFAULT_A11Y, filter: 'contrast' });
  });

  it('saves to localStorage and removes the key when everything is back to default', () => {
    saveA11y({ ...DEFAULT_A11Y, zoom: 2 });
    expect(JSON.parse(localStorage.getItem(A11Y_STORAGE_KEY)!).a11yZoom).toBe(2);
    expect(loadA11y().zoom).toBe(2);
    saveA11y(DEFAULT_A11Y);
    expect(localStorage.getItem(A11Y_STORAGE_KEY)).toBeNull();
    expect(loadA11y()).toEqual(DEFAULT_A11Y);
  });
});

describe('inline init script', () => {
  const attrs = () =>
    Object.fromEntries(
      document.documentElement
        .getAttributeNames()
        .filter((n) => n.startsWith('data-a11y'))
        .map((n) => [n, document.documentElement.getAttribute(n)]),
    );
  const runScript = () => new Function(A11Y_INIT_SCRIPT)();

  beforeEach(() => {
    localStorage.clear();
    for (const n of document.documentElement.getAttributeNames()) if (n.startsWith('data-a11y')) document.documentElement.removeAttribute(n);
  });

  it('does nothing without stored preferences', () => {
    runScript();
    expect(attrs()).toEqual({});
  });

  it('is small enough to inline in every page', () => {
    expect(A11Y_INIT_SCRIPT.length).toBeLessThan(900);
  });

  const cases: Array<[string, unknown]> = [
    ['everything on', { a11yZoom: 2, a11yFilter: 'invert', a11yLinks: true, a11yFont: true, a11yMotion: true }],
    ['smaller text', { a11yZoom: -1, a11yFilter: '', a11yLinks: false, a11yFont: false, a11yMotion: false }],
    ['grayscale only', { a11yZoom: 0, a11yFilter: 'grayscale', a11yLinks: false, a11yFont: false, a11yMotion: false }],
    ['out-of-range zoom', { a11yZoom: 5, a11yFilter: 'contrast' }],
    ['unknown filter', { a11yZoom: 1, a11yFilter: 'sepia' }],
    ['truthy but not true', { a11yLinks: 'yes', a11yFont: 1, a11yMotion: {} }],
    ['fractional zoom', { a11yZoom: 1.5 }],
  ];
  for (const [name, stored] of cases) {
    it(`sets exactly what parse + a11yAttributes would: ${name}`, () => {
      localStorage.setItem(A11Y_STORAGE_KEY, JSON.stringify(stored));
      runScript();
      const expected = Object.fromEntries(Object.entries(a11yAttributes(parseStoredA11y(JSON.stringify(stored)))).filter(([, v]) => v !== null));
      expect(attrs()).toEqual(expected);
    });
  }

  it('survives corrupt storage', () => {
    localStorage.setItem(A11Y_STORAGE_KEY, '{nope');
    expect(() => runScript()).not.toThrow();
    expect(attrs()).toEqual({});
  });

  it('knows the same filters as the reducer', () => {
    for (const f of A11Y_FILTERS) expect(A11Y_INIT_SCRIPT).toContain(`"${f}"`);
  });
});
