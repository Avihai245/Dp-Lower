'use client';

import { s } from '@dpl/ui';
import { useEffect, useState } from 'react';

/** The firm's film, muted and looping behind the hero text. Parameters exactly as in the prototype. */
const VIDEO_SRC =
  'https://www.youtube-nocookie.com/embed/IYQ1_m3cCMA?autoplay=1&mute=1&controls=0&loop=1&playlist=IYQ1_m3cCMA&start=36&playsinline=1&modestbranding=1&rel=0&iv_load_policy=3&disablekb=1&fs=0';

/** The video is for desktop screens only (SEO-README); phones and tablets keep the poster. */
const DESKTOP = '(min-width: 961px)';
const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';
/** It starts this long after first paint so it never competes with the content for bandwidth. */
const START_DELAY_MS = 1200;

/**
 * Background video of the hero. Mounted 1.2s after first paint on desktop screens only, and not at all for visitors
 * who asked for less motion (their system setting, or "Stop animation" in the accessibility tools). The iframe is
 * purely decorative: inert, hidden from assistive technology and out of the tab order.
 */
export function HeroVideo({ title }: { title: string }) {
  const [on, setOn] = useState(false);

  useEffect(() => {
    const wide = window.matchMedia(DESKTOP);
    const reduced = window.matchMedia(REDUCED_MOTION);
    const root = document.documentElement;
    let timer = 0;

    const sync = () => {
      window.clearTimeout(timer);
      if (wide.matches && !reduced.matches && !root.hasAttribute('data-a11y-motion')) {
        timer = window.setTimeout(() => setOn(true), START_DELAY_MS);
      } else {
        setOn(false);
      }
    };

    // two frames: the first paint has happened by the time the delay starts running
    const frame = requestAnimationFrame(() => requestAnimationFrame(sync));
    wide.addEventListener('change', sync);
    reduced.addEventListener('change', sync);
    const watch = new MutationObserver(sync);
    watch.observe(root, { attributes: true, attributeFilter: ['data-a11y-motion'] });

    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(timer);
      wide.removeEventListener('change', sync);
      reduced.removeEventListener('change', sync);
      watch.disconnect();
    };
  }, []);

  if (!on) return null;
  return (
    <div
      aria-hidden="true"
      inert
      style={s(
        'position: absolute; top: 50%; left: 50%; width: 177.78vh; height: 56.25vw; min-width: 100%; min-height: 100%; transform: translate(-50%, -50%); pointer-events: none; /* noflip */',
      )}
    >
      <iframe
        src={VIDEO_SRC}
        title={title}
        tabIndex={-1}
        loading="eager"
        referrerPolicy="strict-origin-when-cross-origin"
        allow="autoplay; encrypted-media; picture-in-picture"
        allowFullScreen
        style={s('position: absolute; inset: 0; width: 100%; height: 100%; border: 0; pointer-events: none')}
      />
    </div>
  );
}
