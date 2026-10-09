'use client';
import { useEffect, useState } from 'react';

/** SSR-safe media query. `initial` is what the server (and first client render) assumes. */
export function useMediaQuery(query: string, initial = false): boolean {
  const [matches, setMatches] = useState(initial);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const on = () => setMatches(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [query]);
  return matches;
}

/** True once the page has scrolled past `offset` px (header shrink, sticky buttons). */
export function useScrolledPast(offset: number): boolean {
  const [past, setPast] = useState(false);
  useEffect(() => {
    const on = () => setPast(window.scrollY > offset);
    on();
    window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, [offset]);
  return past;
}

/**
 * Figures that climb to their value the first time the element `[data-count]` is scrolled into view:
 * ease-out cubic over 1300ms in 22 steps, exactly as the prototype. Returns progress 0..1.
 */
export function useCountProgress(selector = '[data-count]'): number {
  const [p, setP] = useState(0);
  useEffect(() => {
    let counting = false;
    let timer: ReturnType<typeof setInterval> | undefined;
    const start = () => {
      if (counting) return;
      counting = true;
      const steps = 22;
      const dur = 1300;
      let n = 0;
      timer = setInterval(() => {
        n += 1;
        const t = n / steps;
        setP(1 - Math.pow(1 - t, 3));
        if (n >= steps) {
          if (timer) clearInterval(timer);
          setP(1);
        }
      }, dur / steps);
    };
    const watch = setInterval(() => {
      if (counting) {
        clearInterval(watch);
        return;
      }
      const el = document.querySelector(selector);
      if (el && el.getBoundingClientRect().top < window.innerHeight * 0.9) {
        clearInterval(watch);
        start();
      }
    }, 350);
    return () => {
      clearInterval(watch);
      if (timer) clearInterval(timer);
    };
  }, [selector]);
  return p;
}
