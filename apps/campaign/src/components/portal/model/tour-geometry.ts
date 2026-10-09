/**
 * Placement maths of the guided tour, ported unchanged from the prototype (tourPlace / snapTour). Pure functions of the
 * measured geometry, so they can be tested without a browser. Coordinates are physical (getBoundingClientRect), never
 * mirrored: the spotlight sits on the element wherever it is, in English and in Hebrew.
 */

export interface Rect {
  /** distance from the document's left edge */
  x: number;
  /** distance from the document's top edge (viewport top + scroll) */
  y: number;
  w: number;
  h: number;
}

export interface Viewport {
  vw: number;
  vh: number;
  /** document.documentElement.scrollHeight */
  docHeight: number;
}

/** width below which the card becomes a bottom sheet */
export const TOUR_MOBILE_MAX = 700;
export const TOUR_GAP = 16;
export const TOUR_TOP_PAD = 84;
/** room around the spotlighted element */
export const TOUR_HOLE_PAD = 10;
export const TOUR_CARD_MAX_W = 400;
/** height assumed before the card has been measured */
export const TOUR_DEFAULT_CARD_H = 280;

export interface Placement {
  /** where to scroll the page to for this step; null for the welcome step (no target) */
  scroll: number | null;
  cardTop: number | null;
  mobile: boolean;
  /** the card sits beside/over the target because nothing else fits */
  side?: boolean;
}

/**
 * One rule shared by scrolling and rendering: the card sits under the target when both fit in the viewport; otherwise
 * above it; otherwise pinned over the lower part of the viewport.
 */
export function placeStep(r: Rect | null, vp: Viewport, measuredCardH: number): Placement {
  const { vw, vh } = vp;
  const mobile = vw < TOUR_MOBILE_MAX;
  const cardH = mobile ? Math.min(330, vh * 0.48) : measuredCardH;
  if (!r) return { scroll: null, cardTop: null, mobile };
  if (mobile) {
    const avail = vh - cardH - 24 - TOUR_TOP_PAD;
    return { scroll: Math.max(0, r.h <= avail ? r.y - TOUR_TOP_PAD - (avail - r.h) / 2 : r.y - TOUR_TOP_PAD), cardTop: null, mobile };
  }
  const maxS = Math.max(0, vp.docHeight - vh);
  const need = r.h + TOUR_GAP + cardH;
  if (need <= vh - TOUR_TOP_PAD - 20) {
    const s = Math.min(maxS, Math.max(0, r.y - TOUR_TOP_PAD - (vh - TOUR_TOP_PAD - 20 - need) / 2));
    const want = r.y + r.h + TOUR_GAP;
    const lim = s + vh - cardH - 16;
    if (want <= lim) return { scroll: s, cardTop: want, mobile };
    const above = r.y - TOUR_GAP - cardH;
    if (above >= s + 16) return { scroll: s, cardTop: above, mobile };
    return { scroll: s, cardTop: Math.max(s + 16, lim), mobile, side: true };
  }
  const s = Math.min(maxS, Math.max(0, r.y - TOUR_TOP_PAD));
  return { scroll: s, cardTop: Math.max(s + 16, s + vh - cardH - 24), mobile, side: true };
}

/** The scroll position to apply for a step: placeStep's, clamped to the page. */
export function scrollTargetFor(r: Rect | null, vp: Viewport, measuredCardH: number): number {
  const p = placeStep(r, vp, measuredCardH);
  const wanted = p.scroll ?? 0;
  return Math.min(Math.max(0, wanted), Math.max(0, vp.docHeight - vp.vh));
}

export type CardPos = { kind: 'sheet' } | { kind: 'abs'; top: number; left: number; width: number };

export interface TourSnap {
  i: number;
  rect: Rect | null;
  cardPos: CardPos;
  vh: number;
  dh: number;
}

/** Geometry for one explicit step, measured right after its scroll; rendering uses this snapshot as it is. */
export function snapStep(a: { i: number; rect: Rect | null; vp: Viewport; scrollY: number; cardH: number }): TourSnap {
  const { vw, vh, docHeight } = a.vp;
  const cardW = Math.min(TOUR_CARD_MAX_W, vw - 32);
  const mobile = vw < TOUR_MOBILE_MAX;
  let cardPos: CardPos;
  if (mobile) {
    cardPos = { kind: 'sheet' };
  } else if (!a.rect) {
    cardPos = {
      kind: 'abs',
      left: Math.round((vw - cardW) / 2),
      top: Math.round(a.scrollY + Math.max(16, (vh - TOUR_DEFAULT_CARD_H) / 2)),
      width: cardW,
    };
  } else {
    const vTop = a.rect.y - a.scrollY;
    const vBot = vTop + a.rect.h;
    let top: number;
    let left = Math.min(Math.max(16, a.rect.x + Math.min(24, a.rect.w / 10)), vw - cardW - 16);
    if (vBot + TOUR_GAP + a.cardH <= vh - 12) top = vBot + TOUR_GAP;
    else if (vTop - TOUR_GAP - a.cardH >= 12) top = vTop - TOUR_GAP - a.cardH;
    else {
      top = Math.max(16, vh - a.cardH - 24);
      left = vw - cardW - 24;
    }
    cardPos = { kind: 'abs', top: Math.round(a.scrollY + top), left: Math.round(left), width: cardW };
  }
  return { i: a.i, rect: a.rect, cardPos, vh, dh: docHeight };
}

/** Next / Back / Escape from the keyboard. `forward` is the arrow that moves on: ArrowRight in English, ArrowLeft in Hebrew. */
export type TourKeyAction = 'next' | 'back' | 'close' | null;

export function tourKeyAction(key: string, index: number, last: number, dir: 'ltr' | 'rtl'): TourKeyAction {
  if (key === 'Escape') return 'close';
  const forward = dir === 'rtl' ? 'ArrowLeft' : 'ArrowRight';
  const backward = dir === 'rtl' ? 'ArrowRight' : 'ArrowLeft';
  if (key === forward) return index < last ? 'next' : 'close';
  if (key === backward && index > 0) return 'back';
  return null;
}
