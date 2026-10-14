'use client';
import { useEffect, useLayoutEffect, useRef, type RefObject } from 'react';

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

/** Tab stops inside `root`, in document order, skipping anything hidden, collapsed or `visibility: hidden`. */
export function focusableIn(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) => el.tabIndex >= 0 && !el.closest('[hidden]') && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden',
  );
}

/**
 * Focus trap decision for Tab / Shift+Tab. `active` is the index of the focused tab stop or -1 when focus is outside
 * the dialog. Returns the index to move to, or null when the browser's own move stays inside.
 */
export function trapTarget(count: number, active: number, shift: boolean): number | null {
  if (count === 0) return null;
  if (shift) return active <= 0 ? count - 1 : null;
  return active === -1 || active === count - 1 ? 0 : null;
}

export interface DialogOptions {
  /**
   * true: a modal. Tab is trapped inside and Escape closes from anywhere.
   * false: a side panel. Escape only closes while focus is inside it.
   */
  modal: boolean;
  onClose: () => void;
  /** first thing to focus; defaults to the first tab stop, then the container itself */
  initialFocus?: () => HTMLElement | null | undefined;
  /** where focus goes on close when the element that opened the dialog is gone */
  fallbackFocus?: () => HTMLElement | null | undefined;
  /** true when another dialog is taking over and focus must not be handed back */
  skipRestore?: () => boolean;
}

/**
 * Focus handling for a dialog component that is mounted only while it is open: moves focus in on mount, traps Tab and
 * handles Escape, and hands focus back to the opener on unmount. The opener is read in a layout effect, which runs
 * before any other component's passive cleanup could move focus, so a dialog opened from another dialog's button still
 * remembers the right element.
 */
export function useDialog(ref: RefObject<HTMLElement | null>, opts: DialogOptions): void {
  const latest = useRef(opts);
  useEffect(() => {
    latest.current = opts;
  });
  const opener = useRef<HTMLElement | null>(null);

  useLayoutEffect(() => {
    const el = document.activeElement;
    opener.current = el instanceof HTMLElement && el !== document.body ? el : null;
  }, []);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const first = latest.current.initialFocus?.() ?? focusableIn(root)[0] ?? root;
    first.focus({ preventScroll: true });

    const onKey = (e: KeyboardEvent) => {
      const o = latest.current;
      if (e.key === 'Escape') {
        if (o.modal || root.contains(document.activeElement)) {
          e.preventDefault();
          o.onClose();
        }
        return;
      }
      if (e.key !== 'Tab' || !o.modal) return;
      const stops = focusableIn(root);
      if (stops.length === 0) {
        e.preventDefault();
        root.focus({ preventScroll: true });
        return;
      }
      const target = trapTarget(stops.length, stops.indexOf(document.activeElement as HTMLElement), e.shiftKey);
      if (target !== null) {
        e.preventDefault();
        stops[target]!.focus({ preventScroll: true });
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      const o = latest.current;
      if (o.skipRestore?.()) return;
      const back = opener.current?.isConnected ? opener.current : o.fallbackFocus?.();
      back?.focus({ preventScroll: true });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount/unmount only; the latest options are read through the ref
  }, []);
}
