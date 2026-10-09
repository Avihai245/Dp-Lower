import type { Locale } from '@dpl/core';
import { getContent } from '@dpl/i18n';
import { s, x } from '@dpl/ui';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { FADE_IN, KICKER, SANS, SERIF } from '../services/parts';
import { InsightsList } from './InsightsList';

/** The inline "watch the media appearances" link inside the intro. */
const MEDIA_LINK = `display: inline-block; background: none; border: 0; padding: 0; ${SANS}; font-size: 15.5px; font-weight: 600; line-height: normal; color: #7a5c2c; cursor: pointer; border-bottom: 1px solid #ded7ca; text-decoration: none`;

/** /insights: the knowledge center, with a category filter over the article rows. */
export async function InsightsIndex({ locale }: { locale: Locale }) {
  const t = await getTranslations({ locale, namespace: 'insights' });
  const { articles } = getContent(locale);

  return (
    <div style={s(FADE_IN)}>
      <div data-pad data-hero-pad style={s('margin: 0 auto; padding: 76px clamp(20px, 4.6vw, 120px) 0')}>
        <div
          data-resp="2"
          style={s(
            'display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: clamp(28px, 4vw, 72px); align-items: end; margin-bottom: 44px',
          )}
        >
          <div>
            <div style={s(`${KICKER}; margin-bottom: 22px`)}>{t('list.kicker')}</div>
            <h1
              data-h1
              style={s(
                `${SERIF}; font-weight: 400; font-size: clamp(36px, 4.4vw, 62px); line-height: 1.05; letter-spacing: -0.022em; color: #14202b; margin: 0; max-width: 20ch`,
              )}
            >
              {t('list.title')}
            </h1>
          </div>
          <p style={s('font-size: 18px; line-height: 1.75; color: #55606b; margin: 0; max-width: 56ch')}>
            {t.rich('list.intro', {
              media: (chunks) => (
                <Link
                  href="/media"
                  data-linkbtn
                  {...x(MEDIA_LINK, { hover: 'border-bottom-color: #7a5c2c' })}
                >
                  {chunks}
                </Link>
              ),
            })}
          </p>
        </div>
        <InsightsList
          articles={articles.map(({ slug, date, title, excerpt, cat }) => ({
            slug,
            date,
            title,
            excerpt,
            cat,
          }))}
          allLabel={t('list.all')}
          filterLabel={t('list.filterLabel')}
        />
      </div>
    </div>
  );
}
