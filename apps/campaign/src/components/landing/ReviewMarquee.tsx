import { s } from '@dpl/ui';
import { getTranslations } from 'next-intl/server';
import Image from 'next/image';

/** The five Google review screenshots, in the prototype's order. */
const SCREENSHOTS = [
  '/images/rev1.webp',
  '/images/rev4.webp',
  '/images/rev5.webp',
  '/images/rev6.webp',
  '/images/rev17.webp',
];
const GAP = 26;

/**
 * Endless row of review screenshots. The set is rendered twice and the track slides by exactly half its width
 * (`reviewScroll` in globals.css, mirrored through --dir in Hebrew), so the loop is seamless in both directions.
 * The track carries one trailing gap so that half of its width is precisely one set plus one gap (the prototype
 * came 13px short, a small jump on every lap). It pauses on hover ([data-marquee], globals.css) and stands still
 * for reduced motion. The animation itself is declared in landing.css, not inline: an inline `animation` shorthand
 * also sets animation-play-state: running, which would beat the pause rule (so the prototype never paused).
 * The second set is a visual duplicate and hidden from assistive technology.
 */
export async function ReviewMarquee() {
  const t = await getTranslations('landing.reputation');
  const tiles = [...SCREENSHOTS, ...SCREENSHOTS];
  return (
    <div style={s('padding: 64px 0 24px; overflow: hidden')}>
      <div data-marquee style={s('width: max-content')}>
        <div style={s(`display: flex; gap: ${GAP}px; width: max-content; padding-right: ${GAP}px`)}>
          {tiles.map((src, i) => {
            const duplicate = i >= SCREENSHOTS.length;
            return (
              <div
                key={i}
                data-rv-img
                aria-hidden={duplicate ? true : undefined}
                style={s(
                  'position: relative; height: 300px; width: 452px; flex: none; border-radius: 16px; overflow: hidden; box-shadow: 0 14px 34px rgba(20,32,43,0.08); background-color: #f8f5f0',
                )}
              >
                <Image
                  src={src}
                  alt={duplicate ? '' : t('marqueeAlt')}
                  fill
                  sizes="(max-width: 640px) 82vw, 452px"
                  style={s('object-fit: cover; object-position: center')}
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
