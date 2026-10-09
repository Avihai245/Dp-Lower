import { s } from '@dpl/ui';
import { getFormatter, getTranslations } from 'next-intl/server';
import { Figures } from './Figures';
import { Isolated } from './more/ltr';
import { Kicker, Stars } from './primitives';
import { ReviewList, type WrittenReview } from './ReviewList';
import { ReviewMarquee } from './ReviewMarquee';

interface ReviewMessage {
  name: string;
  /** ISO date; formatted for the locale here */
  date: string;
  text: string;
}

/** The prototype features the last written review (WRITTEN_REVIEWS[11]). */
const FEATURED_INDEX = 11;

/**
 * "Reputation": the 4.9 rating beside a featured review, the endless row of review screenshots, the written reviews
 * with their "See all reviews" toggle, and the count-up figures with their "To verify" tags.
 */
export async function Reputation() {
  const t = await getTranslations('landing.reputation');
  const format = await getFormatter();
  const reviews: WrittenReview[] = (t.raw('reviews') as ReviewMessage[]).map((r) => ({
    name: r.name,
    date: format.dateTime(new Date(`${r.date}T12:00:00Z`), { dateStyle: 'long' }),
    text: r.text,
  }));
  const featured = reviews[FEATURED_INDEX] ?? reviews[reviews.length - 1];

  return (
    <>
      <div data-pad style={s('max-width: 100%; margin: 0 auto; padding: 64px clamp(20px, 4.6vw, 160px) 0')}>
        <div style={s('height: 1px; background: #ece6dc')} />
      </div>

      <section
        aria-labelledby="reputation-title"
        data-pad
        style={s('max-width: 100%; margin: 0 auto; padding: 62px clamp(20px, 4.6vw, 160px) 0')}
      >
        <div style={s('max-width: 100%; margin-bottom: 54px')}>
          <Kicker>{t('kicker')}</Kicker>
          <h2
            id="reputation-title"
            data-big
            style={s(
              "font-family: 'Newsreader', Georgia, serif; font-weight: 400; font-size: clamp(32px, 3.4vw, 52px); line-height: 1.1; letter-spacing: -0.015em; color: #14202b; margin: 0; max-width: 26ch",
            )}
          >
            {t('title')}
          </h2>
        </div>
        <div
          data-resp="2"
          style={s(
            'display: grid; grid-template-columns: minmax(0, 0.8fr) minmax(0, 1.2fr); gap: 72px; align-items: center',
          )}
        >
          <div>
            <div style={s('display: flex; align-items: baseline; gap: 20px; flex-wrap: wrap')}>
              <span
                style={s(
                  "font-family: 'Newsreader', Georgia, serif; font-size: clamp(64px, 7vw, 112px); line-height: 0.9; letter-spacing: -0.03em; color: #14202b",
                )}
              >
                {t('score')}
              </span>
              <span>
                <Stars
                  label={t('stars')}
                  css="display: block; color: #c99a3f; font-size: 20px; letter-spacing: 3px; margin-bottom: 8px"
                />
                <span style={s('display: block; font-size: 16px; color: #736d64')}><Isolated text={t('count')} /></span>
              </span>
            </div>
          </div>
          {featured && (
            <figure style={s('margin: 0; padding-left: 34px; border-left: 2px solid #a07a3c')}>
              <blockquote style={s('margin: 0')}>
                <p
                  style={s(
                    "font-family: 'Newsreader', Georgia, serif; font-size: clamp(22px, 2vw, 31px); line-height: 1.4; color: #14202b; margin: 0 0 22px; max-width: 44ch",
                  )}
                >
                  {t('featuredQuote', { text: featured.text })}
                </p>
              </blockquote>
              <figcaption style={s('font-size: 15px; color: #736d64; margin: 0')}>
                {featured.name} · {featured.date}
              </figcaption>
            </figure>
          )}
        </div>
      </section>

      <ReviewMarquee />

      <div
        data-pad
        style={s('max-width: 100%; margin: 0 auto; padding: 30px clamp(20px, 4.6vw, 160px) 96px')}
      >
        <ReviewList
          reviews={reviews}
          starsLabel={t('stars')}
          showAll={t('showAll')}
          showFewer={t('showFewer')}
        />
        <Figures tag={t('figureTag')} labels={t.raw('figures') as string[]} />
        <p style={s('font-size: 13px; line-height: 1.6; color: #736d64; margin: 20px 0 0')}>
          {t('figuresNote')}
        </p>
      </div>
    </>
  );
}
