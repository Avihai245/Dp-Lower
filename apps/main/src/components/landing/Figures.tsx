'use client';
import { s, useCountProgress, useMediaQuery } from '@dpl/ui';
import { useLocale } from 'next-intl';
import { FIGURES, figureValue } from '@/lib/landing-figures';

/**
 * Four figures that climb to their value the first time the strip scrolls into view (`useCountProgress`: ease-out
 * cubic, 1300ms, 22 steps, exactly as the prototype). The strip carries [data-count], which the hook watches. The
 * animated number is hidden from assistive technology, which reads the final value instead; visitors who ask for
 * reduced motion see the final values at once. The number reads left to right in Hebrew too ("1,200+", not "+1,200").
 */
export function Figures({ tag, labels }: { tag: string; labels: string[] }) {
  const counting = useCountProgress();
  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
  const progress = reducedMotion ? 1 : counting;
  const locale = useLocale();

  return (
    <div
      data-resp="4"
      data-two-up
      data-count
      style={s(
        'display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 28px 40px; border-top: 1px solid #ece6dc; padding-top: 36px; margin-top: 44px',
      )}
    >
      {FIGURES.map((figure, i) => (
        <div key={i}>
          <div style={s('display: flex; align-items: baseline; gap: 10px')}>
            <span
              aria-hidden="true"
              dir="ltr"
              style={s(
                "font-family: 'Newsreader', Georgia, serif; font-size: clamp(38px, 3.4vw, 54px); line-height: 1; color: #14202b",
              )}
            >
              {figureValue(figure, progress, locale)}
            </span>
            <span className="dpl-sr-only">{figureValue(figure, 1, locale)}</span>
            <span
              style={s(
                'font-size: 10.5px; font-weight: 600; letter-spacing: 0.12em; text-transform: uppercase; color: #a07a3c; border: 1px solid #ece6dc; padding: 4px 7px',
              )}
            >
              {tag}
            </span>
          </div>
          <div
            style={s('font-size: 15px; line-height: 1.5; color: #736d64; margin-top: 12px; max-width: 24ch')}
          >
            {labels[i]}
          </div>
        </div>
      ))}
    </div>
  );
}
