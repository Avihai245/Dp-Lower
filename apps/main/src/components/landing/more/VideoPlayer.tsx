'use client';
import { s, x } from '@dpl/ui';
import { useEffect, useRef, useState } from 'react';

const VIDEO_ID = 'X8BPaMIjv98';
const POSTER = `https://i.ytimg.com/vi/${VIDEO_ID}/maxresdefault.jpg`;
const EMBED = `https://www.youtube-nocookie.com/embed/${VIDEO_ID}?autoplay=1&rel=0`;

/**
 * Click-to-play: nothing from YouTube except the poster is requested until the visitor presses play, and the poster
 * itself only starts loading when the frame is within a screen of the viewport. Pressing play swaps in the
 * privacy-enhanced (youtube-nocookie) player with autoplay and moves keyboard focus to it.
 */
export function VideoPlayer({ playLabel, iframeTitle }: { playLabel: string; iframeTitle: string }) {
  const [playing, setPlaying] = useState(false);
  const [near, setNear] = useState(false);
  const frameRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') {
      setNear(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setNear(true);
          io.disconnect();
        }
      },
      { rootMargin: '900px 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (playing) iframeRef.current?.focus();
  }, [playing]);

  return (
    <div ref={frameRef} style={s('position:relative;aspect-ratio:16 / 9;background:#0d161e;overflow:hidden')}>
      {playing ? (
        <iframe
          ref={iframeRef}
          src={EMBED}
          title={iframeTitle}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
          style={s('position:absolute;inset:0;width:100%;height:100%;border:0')}
        />
      ) : (
        <button
          type="button"
          data-lm-play
          aria-label={playLabel}
          onClick={() => setPlaying(true)}
          style={s('position:absolute;inset:0;width:100%;height:100%;border:0;cursor:pointer;padding:0;background:transparent;display:grid;place-items:center')}
        >
          <span
            aria-hidden="true"
            style={{
              ...s('position:absolute;inset:0;opacity:0.62;background-size:cover;background-position:center;background-repeat:no-repeat'),
              backgroundImage: near ? `url(${POSTER})` : undefined,
            }}
          />
          <span
            {...x(
              'position:relative;display:grid;place-items:center;width:96px;height:96px;border-radius:50%;background:rgba(248,245,240,0.94);transition:transform 220ms ease, background 220ms ease',
              { hover: 'transform:scale(1.06);background:#fff' },
            )}
          >
            <svg aria-hidden="true" width="20" height="23" viewBox="0 0 20 23" fill="none" stroke="none">
              <path d="M2 1 L19 11.5 L2 22 Z" fill="#14202b" />
            </svg>
          </span>
        </button>
      )}
    </div>
  );
}
