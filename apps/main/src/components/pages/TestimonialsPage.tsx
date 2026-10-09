import type { Locale } from '@dpl/core';
import { getContent } from '@dpl/i18n';
import { s } from '@dpl/ui';
import { getTranslations } from 'next-intl/server';
import { SERIF } from './tokens';
import { Eyebrow, H1, PageFade, Pad } from './ui';

const STARS = '★★★★★';

export async function TestimonialsPage({ locale }: { locale: Locale }) {
  const t = await getTranslations({ locale, namespace: 'pages' });
  const { testimonials } = getContent(locale);

  return (
    <PageFade>
      <Pad top={76} hero>
        <div
          data-resp="2"
          style={s(
            'display: grid; grid-template-columns: minmax(0, 0.7fr) minmax(0, 1.3fr); gap: clamp(28px, 5vw, 88px); align-items: end; margin-bottom: 48px',
          )}
        >
          <div>
            <div
              aria-hidden="true"
              style={s('font-size: 20px; letter-spacing: 0.22em; color: #c9a45c; margin-bottom: 12px')}
            >
              {STARS}
            </div>
            <div
              style={s(
                `font-family: ${SERIF}; font-size: clamp(60px, 6.5vw, 100px); line-height: 0.95; letter-spacing: -0.035em; color: #14202b`,
              )}
            >
              {t('testimonials.rating')}
            </div>
            <div style={s('font-size: 14.5px; color: #55606b; margin-top: 12px')}>
              {t('testimonials.ratingNote')}
            </div>
          </div>
          <div>
            <Eyebrow>{t('testimonials.eyebrow')}</Eyebrow>
            <H1>{t('testimonials.title')}</H1>
          </div>
        </div>
        <ul
          data-resp="3"
          style={s(
            'display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: clamp(18px, 2.2vw, 30px); list-style: none; margin: 0; padding: 0',
          )}
        >
          {testimonials.map((r) => (
            <li key={`${r.name}-${r.date}`} style={s('display: flex')}>
              <figure
                style={s(
                  'flex: 1; min-width: 0; margin: 0; border: 1px solid #ece6dc; background: #fff; padding: 26px 26px 24px; display: flex; flex-direction: column',
                )}
              >
                <div
                  aria-hidden="true"
                  style={s('font-size: 14px; letter-spacing: 0.22em; color: #c9a45c; margin-bottom: 16px')}
                >
                  {STARS}
                </div>
                <span className="dpl-sr-only">{t('testimonials.stars')}</span>
                <blockquote style={s('margin: 0 0 20px; flex: 1')}>
                  <p style={s('font-size: 16px; line-height: 1.7; color: #3f4b56; margin: 0')}>{r.quote}</p>
                </blockquote>
                <figcaption style={s('margin: 0; font-size: 15px; color: inherit')}>
                  <div style={s('font-size: 14.5px; font-weight: 600; color: #14202b')}>{r.name}</div>
                  <div style={s('font-size: 13px; color: #736d64; margin-top: 3px')}>{r.date}</div>
                </figcaption>
              </figure>
            </li>
          ))}
        </ul>
      </Pad>
    </PageFade>
  );
}
