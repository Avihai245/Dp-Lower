import { s } from '@dpl/ui';
import { getTranslations } from 'next-intl/server';
import Image from 'next/image';
import { Kicker } from './primitives';

/** "Why this may apply to you": the family-history photograph beside three quotes and two short paragraphs. */
export async function WhyApplies() {
  const t = await getTranslations('landing.why');
  const story = t.raw('story') as string[];
  return (
    <section
      aria-labelledby="why-title"
      data-pad
      style={s('max-width: 100%; margin: 0 auto; padding: 88px clamp(20px, 4.6vw, 160px)')}
    >
      <div
        data-resp="2"
        style={s(
          'display: grid; grid-template-columns: minmax(0, 0.95fr) minmax(0, 1.05fr); gap: 84px; align-items: center',
        )}
      >
        <div style={s('position: relative; aspect-ratio: 4 / 3; background: #ece6dc; overflow: hidden')}>
          <Image
            data-reveal-img
            src="/images/pic1.webp"
            alt={t('photoAlt')}
            fill
            sizes="(max-width: 960px) 100vw, 46vw"
            style={s('object-fit: cover; object-position: 52% 58%; display: block')}
          />
        </div>
        <div data-stagger>
          <Kicker>{t('kicker')}</Kicker>
          <h2
            id="why-title"
            data-big
            style={s(
              "font-family: 'Newsreader', Georgia, serif; font-weight: 400; font-size: clamp(34px, 3.6vw, 56px); line-height: 1.1; letter-spacing: -0.015em; color: #14202b; margin: 0 0 34px; max-width: 22ch",
            )}
          >
            {t('title')}
          </h2>
          <div
            style={s(
              'display: flex; flex-direction: column; gap: 18px; padding-left: 26px; border-left: 2px solid #a07a3c; margin-bottom: 36px',
            )}
          >
            {story.map((line, k) => (
              <span
                key={line}
                style={s(
                  `font-family: 'Newsreader', Georgia, serif; font-size: clamp(20px, 1.8vw, 27px); line-height: 1.4; color: ${k === 0 ? '#14202b' : '#736d64'}`,
                )}
              >
                {line}
              </span>
            ))}
          </div>
          <p
            style={s(
              'font-size: 18.5px; line-height: 1.75; color: #736d64; margin: 0 0 18px; max-width: 54ch',
            )}
          >
            {t('p1')}
          </p>
          <p style={s('font-size: 18.5px; line-height: 1.75; color: #736d64; margin: 0; max-width: 54ch')}>
            {t('p2')}
          </p>
        </div>
      </div>
    </section>
  );
}
