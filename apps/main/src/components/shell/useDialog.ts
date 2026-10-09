'use client';

import { type KeyboardEvent, type RefObject, useEffect } from 'react';

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]';

interface Options {
  containerRef: RefObject<HTMLElement | null>;
  /** the launcher button: gets focus back when the dialog closes with Escape */
  returnFocusRef: RefObject<HTMLElement | null>;
  onClose: () => void;
}

/**
 * Keyboard behaviour of the floating panels (chat, accessibility tools): focus moves into the panel when it opens,
 * Tab stays inside it, Escape closes it and returns focus to the button that opened it. Attach the returned handler to
 * the panel's onKeyDown. The panels are not modal, so the rest of the page stays usable with the mouse.
 */
export function useDialog(open: boolean, { containerRef, returnFocusRef, onClose }: Options) {
  useEffect(() => {
    if (open) containerRef.current?.focus();
  }, [open, containerRef]);

  return function onKeyDown(e: KeyboardEvent<HTMLElement>) {
    if (e.key === 'Escape') {
      e.stopPropagation();
      onClose();
      returnFocusRef.current?.focus();
      return;
    }
    if (e.key !== 'Tab') return;
    const container = containerRef.current;
    if (!container) return;
    const nodes = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.tabIndex >= 0);
    const first = nodes[0];
    const last = nodes[nodes.length - 1];
    if (!first || !last) return;
    const active = document.activeElement;
    if (e.shiftKey && (active === first || active === container)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  };
}
