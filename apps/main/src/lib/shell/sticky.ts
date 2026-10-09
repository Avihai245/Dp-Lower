/**
 * When the floating "Talk to a lawyer, free" button is shown. Same rules as the prototype: it appears once the visitor
 * has scrolled past the hero (more than 620px), steps aside when the lead form is within reach (its top is above 92% of
 * the viewport height) and while the chat panel is open.
 */
export const STICKY_SCROLL_THRESHOLD = 620;
export const NEAR_FORM_RATIO = 0.92;

export interface StickyInput {
  scrollY: number;
  viewportHeight: number;
  /** distance of #leadform from the top of the viewport, null when the page has no lead form */
  formTop: number | null;
  chatOpen: boolean;
}

export const isPastHero = (scrollY: number): boolean => scrollY > STICKY_SCROLL_THRESHOLD;

export const isNearForm = (formTop: number | null, viewportHeight: number): boolean =>
  formTop !== null && formTop < viewportHeight * NEAR_FORM_RATIO;

export function stickyVisible({ scrollY, viewportHeight, formTop, chatOpen }: StickyInput): boolean {
  return isPastHero(scrollY) && !isNearForm(formTop, viewportHeight) && !chatOpen;
}
