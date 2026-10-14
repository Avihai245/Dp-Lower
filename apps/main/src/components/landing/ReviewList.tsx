'use client';
import { s, x } from '@dpl/ui';
import { useState } from 'react';

export interface WrittenReview {
  name: string;
  /** already formatted for the locale */
  date: string;
  text: string;
}

const COLLAPSED_COUNT = 2;

/** The written reviews: two at first, all of them behind "See all reviews" (prototype `visibleReviews`). */
export function ReviewList({
  reviews,
  starsLabel,
  showAll,
  showFewer,
}: {
  reviews: WrittenReview[];
  starsLabel: string;
  showAll: string;
  showFewer: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? reviews : reviews.slice(0, COLLAPSED_COUNT);

  return (
    <>
      <div
        id="landing-reviews"
        data-resp="2"
        style={s('display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 28px')}
      >
        {visible.map((r, i) => (
          <div
            key={i}
            style={s(
              'background: #f8f5f0; border: 1px solid #ece6dc; padding: 34px 32px; display: flex; flex-direction: column; gap: 16px',
            )}
          >
            <span
              role="img"
              aria-label={starsLabel}
              style={s('color: #c99a3f; font-size: 14px; letter-spacing: 2px')}
            >
              ★★★★★
            </span>
            <p style={s('font-size: 16.5px; line-height: 1.7; color: #23292f; margin: 0')}>{r.text}</p>
            <span style={s('margin-top: auto; font-size: 14.5px; color: #736d64')}>
              {r.name} · {r.date}
            </span>
          </div>
        ))}
      </div>
      <div style={s('text-align: center; margin-top: 34px')}>
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls="landing-reviews"
          onClick={() => setExpanded((v) => !v)}
          {...x(
            "background: transparent; color: #14202b; border: 1px solid #14202b; font-family: 'Manrope', system-ui, sans-serif; font-weight: 600; font-size: 14px; letter-spacing: 0.06em; text-transform: uppercase; padding: 16px 30px; border-radius: 12px; transition: background 200ms ease, color 200ms ease",
            { className: 'btn', hover: 'background: #14202b; color: #f8f5f0' },
          )}
        >
          {expanded ? showFewer : showAll}
        </button>
      </div>
    </>
  );
}
