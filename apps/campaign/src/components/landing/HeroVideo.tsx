'use client';
import { s, useMediaQuery } from '@dpl/ui';
import { useEffect, useState } from 'react';

const VIDEO_ID = '52rCx7iQeFo';
/** the prototype's embed, parameter for parameter: muted, looped, no controls, starts at 2:37 */
const EMBED_URL =
  `https://www.youtube.com/embed/${VIDEO_ID}?autoplay=1&mute=1&controls=0&loop=1&playlist=${VIDEO_ID}` +
  '&start=157&playsinline=1&modestbranding=1&rel=0&iv_load_policy=3&disablekb=1&fs=0';

/**
 * The muted looping YouTube background of the hero. It is mounted only on wide screens (>= 961px, never on phones),
 * 1200ms after the page mounts so it never competes with the first paint, and not at all for visitors who ask for
 * reduced motion (the poster stays). The 16:9 frame is scaled to cover the hero and is kept out of the tab order.
 */
export function HeroVideo({ title }: { title: string }) {
  const wide = useMediaQuery('(min-width: 961px)');
  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setReady(true), 1200);
    return () => clearTimeout(timer);
  }, []);

  if (!wide || !ready || reducedMotion) return null;
  return (
    <div
      aria-hidden="true"
      style={s(
        'position: absolute; top: 50%; left: 50%; width: 177.78vh; height: 56.25vw; min-width: 100%; min-height: 100%; transform: translate(-50%, -50%); pointer-events: none /* noflip */',
      )}
    >
      <iframe
        src={EMBED_URL}
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
