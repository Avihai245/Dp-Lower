'use client';
import { s } from '@dpl/ui';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, type ReactNode, type RefObject } from 'react';

/** The sans-serif prototype font stack (mapped to the Hebrew-aware variable by s()). */
export const SANS = "font-family: 'Manrope', system-ui, sans-serif";

/** color-mix(in srgb, var(--color-text) N%, transparent): the prototype's `sub()` helper. */
export const mix = (percent: number): string => `color-mix(in srgb, var(--color-text) ${percent}%, transparent)`;

export const useDir = (): 'ltr' | 'rtl' => (useLocale() === 'he' ? 'rtl' : 'ltr');

/**
 * Tags for t.rich(): `<e>{email}</e>` keeps an address, a case reference or a time reading left to right inside Hebrew
 * text (so neighbouring punctuation cannot jump around it); `<n>{name}</n>` isolates a file name, which keeps its own direction.
 */
export const richTags = {
  e: (chunks: ReactNode) => <bdi dir="ltr">{chunks}</bdi>,
  n: (chunks: ReactNode) => <bdi>{chunks}</bdi>,
};

export function PortalLogo() {
  const t = useTranslations('portal.header');
  return <img src="/images/DPL_logo-sm.webp" alt={t('logoAlt')} width={320} height={114} decoding="async" style={s('height: 30px; width: auto; display: block')} />;
}

/**
 * The prototype's ← and → glyphs mean "back" and "forward". They are mirrored in a right-to-left page
 * (transform: scaleX(var(--dir))), so ← reads as → in Hebrew and still points away from the reading direction.
 */
export function Arrow({ forward = false }: { forward?: boolean }) {
  return (
    <span aria-hidden="true" style={{ display: 'inline-block', transform: 'scaleX(var(--dir, 1))' }}>
      {forward ? '→' : '←'}
    </span>
  );
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Dialog behaviour: keyboard focus moves into the dialog when it opens, Tab and Shift+Tab stay inside it, and focus goes
 * back to where it was when it closes. (Escape is handled by each dialog: the tour has its own key map.)
 */
export function useFocusTrap(containerRef: RefObject<HTMLElement | null>, active: boolean, initialFocus?: RefObject<HTMLElement | null>) {
  useEffect(() => {
    if (!active) return;
    const container = containerRef.current;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const first = () => initialFocus?.current ?? container?.querySelector<HTMLElement>(FOCUSABLE) ?? container;
    // the container may be positioned a moment after it mounts: focus without scrolling the page
    first()?.focus({ preventScroll: true });

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab' || !container) return;
      const items = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.offsetParent !== null || el === document.activeElement);
      if (items.length === 0) {
        e.preventDefault();
        return;
      }
      const head = items[0]!;
      const tail = items[items.length - 1]!;
      const current = document.activeElement;
      if (!container.contains(current)) {
        e.preventDefault();
        head.focus();
      } else if (current === container) {
        // focus is on the dialog itself: Tab goes to the first control, Shift+Tab to the last
        e.preventDefault();
        (e.shiftKey ? tail : head).focus();
      } else if (e.shiftKey && current === head) {
        e.preventDefault();
        tail.focus();
      } else if (!e.shiftKey && current === tail) {
        e.preventDefault();
        head.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      if (previous && document.contains(previous)) previous.focus({ preventScroll: true });
    };
  }, [active, containerRef, initialFocus]);
}
