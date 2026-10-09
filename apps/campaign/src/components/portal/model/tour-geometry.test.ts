import { describe, expect, it } from 'vitest';
import { placeStep, scrollTargetFor, snapStep, tourKeyAction, type Rect, type Viewport } from './tour-geometry';

const desktop: Viewport = { vw: 1440, vh: 900, docHeight: 2400 };
const phone: Viewport = { vw: 390, vh: 844, docHeight: 3000 };

describe('placeStep (desktop)', () => {
  it('has nothing to scroll to for the welcome step', () => {
    expect(placeStep(null, desktop, 280)).toEqual({ scroll: null, cardTop: null, mobile: false });
    expect(scrollTargetFor(null, desktop, 280)).toBe(0);
  });

  it('puts the card under the target when both fit (timeline near the top: no scrolling needed)', () => {
    const r: Rect = { x: 0, y: 165, w: 1440, h: 215 };
    const p = placeStep(r, desktop, 260);
    expect(p.mobile).toBe(false);
    expect(p.scroll).toBe(0);
    expect(p.cardTop).toBe(165 + 215 + 16);
    expect(p.side).toBeUndefined();
  });

  it('centres a target that fits with its card by scrolling to it', () => {
    const r: Rect = { x: 66, y: 1000, w: 470, h: 300 };
    const p = placeStep(r, desktop, 260);
    // need = 300 + 16 + 260 = 576; free = 900 - 84 - 20 - 576 = 220; scroll = 1000 - 84 - 110
    expect(p.scroll).toBe(806);
    expect(p.cardTop).toBe(1000 + 300 + 16);
  });

  it('never scrolls past the end of the page', () => {
    const r: Rect = { x: 66, y: 2300, w: 470, h: 60 };
    const p = placeStep(r, desktop, 260);
    expect(p.scroll).toBeLessThanOrEqual(desktop.docHeight - desktop.vh);
  });

  it('falls back to the card above, then to a pinned card, when it does not fit below', () => {
    // target flush with the bottom of the page: no room below once scrolled to the end
    const bottom: Rect = { x: 66, y: 2240, w: 400, h: 120 };
    const above = placeStep(bottom, desktop, 260);
    expect(above.cardTop).toBe(2240 - 16 - 260);

    // a target nearly as tall as the viewport leaves no room for the card at all
    const tall: Rect = { x: 66, y: 500, w: 800, h: 700 };
    const pinned = placeStep(tall, desktop, 260);
    expect(pinned.side).toBe(true);
    expect(pinned.scroll).toBe(500 - 84);
    expect(pinned.cardTop).toBe(Math.max(pinned.scroll! + 16, pinned.scroll! + 900 - 260 - 24));
  });
});

describe('placeStep (phone)', () => {
  it('centres a target that fits in the space above the bottom sheet', () => {
    const r: Rect = { x: 20, y: 1200, w: 350, h: 200 };
    const p = placeStep(r, phone, 999);
    expect(p.mobile).toBe(true);
    // card = min(330, 844 * 0.48 = 405) = 330; avail = 844 - 330 - 24 - 84 = 406; scroll = 1200 - 84 - (406 - 200) / 2
    expect(p.scroll).toBe(1200 - 84 - 103);
  });

  it('aligns the top of a target that is taller than the free space', () => {
    const r: Rect = { x: 20, y: 1200, w: 350, h: 600 };
    expect(placeStep(r, phone, 999).scroll).toBe(1200 - 84);
  });

  it('clamps the final scroll to the document', () => {
    const r: Rect = { x: 20, y: 5000, w: 350, h: 200 };
    expect(scrollTargetFor(r, phone, 280)).toBe(phone.docHeight - phone.vh);
    expect(scrollTargetFor({ x: 0, y: 10, w: 10, h: 10 }, phone, 280)).toBe(0);
  });
});

describe('snapStep', () => {
  it('centres the welcome card in the viewport at the current scroll position', () => {
    const snap = snapStep({ i: 0, rect: null, vp: desktop, scrollY: 0, cardH: 280 });
    expect(snap.cardPos).toEqual({ kind: 'abs', width: 400, left: 520, top: 310 });
    expect(snap.vh).toBe(900);
    expect(snap.dh).toBe(2400);
    const scrolled = snapStep({ i: 0, rect: null, vp: desktop, scrollY: 500, cardH: 280 });
    expect(scrolled.cardPos).toMatchObject({ top: 810 });
  });

  it('places the card under the target, left-aligned to it (with at most 24px of inset)', () => {
    const rect: Rect = { x: 66, y: 165, w: 1308, h: 215 };
    const snap = snapStep({ i: 1, rect, vp: desktop, scrollY: 0, cardH: 260 });
    expect(snap.cardPos).toEqual({ kind: 'abs', top: 165 + 215 + 16, left: 90, width: 400 });
  });

  it('puts the card above the target when there is no room below', () => {
    const rect: Rect = { x: 66, y: 640, w: 470, h: 250 };
    const snap = snapStep({ i: 2, rect, vp: desktop, scrollY: 100, cardH: 260 });
    // viewport top of the target = 540, bottom = 790; 790 + 16 + 260 > 888, so above: 540 - 16 - 260 = 264
    expect(snap.cardPos).toEqual({ kind: 'abs', top: 100 + 264, left: 90, width: 400 });
  });

  it('pins the card to the lower right corner when it fits neither below nor above', () => {
    const rect: Rect = { x: 66, y: 100, w: 1300, h: 700 };
    const snap = snapStep({ i: 3, rect, vp: desktop, scrollY: 0, cardH: 260 });
    expect(snap.cardPos).toEqual({ kind: 'abs', top: 900 - 260 - 24, left: 1440 - 400 - 24, width: 400 });
  });

  it('keeps the card inside the viewport horizontally', () => {
    const rect: Rect = { x: 1300, y: 100, w: 100, h: 50 };
    const snap = snapStep({ i: 4, rect, vp: desktop, scrollY: 0, cardH: 260 });
    expect(snap.cardPos).toMatchObject({ left: 1440 - 400 - 16 });
  });

  it('uses a bottom sheet on a phone and a narrower card on small windows', () => {
    expect(snapStep({ i: 1, rect: { x: 0, y: 0, w: 10, h: 10 }, vp: phone, scrollY: 0, cardH: 260 }).cardPos).toEqual({ kind: 'sheet' });
    const narrow: Viewport = { vw: 720, vh: 800, docHeight: 2000 };
    expect(snapStep({ i: 0, rect: null, vp: narrow, scrollY: 0, cardH: 260 }).cardPos).toMatchObject({ width: 400 });
    const tiny: Viewport = { vw: 460, vh: 800, docHeight: 2000 };
    expect(tiny.vw < 700).toBe(true);
  });
});

describe('tourKeyAction', () => {
  it('maps the arrows and Escape like the prototype', () => {
    expect(tourKeyAction('Escape', 2, 5, 'ltr')).toBe('close');
    expect(tourKeyAction('ArrowRight', 0, 5, 'ltr')).toBe('next');
    expect(tourKeyAction('ArrowRight', 5, 5, 'ltr')).toBe('close');
    expect(tourKeyAction('ArrowLeft', 3, 5, 'ltr')).toBe('back');
    expect(tourKeyAction('ArrowLeft', 0, 5, 'ltr')).toBeNull();
    expect(tourKeyAction('Enter', 1, 5, 'ltr')).toBeNull();
  });

  it('mirrors the arrows in a right-to-left page', () => {
    expect(tourKeyAction('ArrowLeft', 0, 5, 'rtl')).toBe('next');
    expect(tourKeyAction('ArrowLeft', 5, 5, 'rtl')).toBe('close');
    expect(tourKeyAction('ArrowRight', 3, 5, 'rtl')).toBe('back');
    expect(tourKeyAction('ArrowRight', 0, 5, 'rtl')).toBeNull();
    expect(tourKeyAction('Escape', 0, 5, 'rtl')).toBe('close');
  });
});
