'use client';
import { useEffect } from 'react';

/**
 * Scroll reveals from the prototype: elements marked [data-reveal], [data-reveal-img] or [data-stagger] get the
 * class `is-in` when they enter the viewport (the CSS for those attributes lives in each app's globals.css).
 * A 700ms poll "self-heals": anything already at or above the fold is revealed outright, so an anchor jump or a
 * fast scroll can never leave content permanently invisible. Mount once per page layout.
 */
export function RevealObserver() {
  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        for (const en of entries) {
          if (en.isIntersecting) {
            en.target.classList.add('is-in');
            io.unobserve(en.target);
          }
        }
      },
      { rootMargin: '0px 0px -12% 0px', threshold: 0.15 },
    );
    const watch = () => {
      document.querySelectorAll<HTMLElement>('[data-reveal], [data-reveal-img], [data-stagger]').forEach((el) => {
        if (el.classList.contains('is-in')) return;
        if (el.getBoundingClientRect().top < window.innerHeight) {
          el.classList.add('is-in');
          if (el.dataset.ioBound) io.unobserve(el);
          return;
        }
        if (!el.dataset.ioBound) {
          el.dataset.ioBound = '1';
          io.observe(el);
        }
      });
    };
    watch();
    const poll = setInterval(watch, 700);
    return () => {
      clearInterval(poll);
      io.disconnect();
    };
  }, []);
  return null;
}
