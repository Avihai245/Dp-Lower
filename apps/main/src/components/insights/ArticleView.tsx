import type { Locale } from '@dpl/core';
import { getContent, getService, type Article } from '@dpl/i18n';
import { s, x } from '@dpl/ui';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { FADE_IN, KICKER, PlainList, SANS, SANS_ROW, SERIF, SERIF_ROW, SideCard } from '../services/parts';

const BACK_LINK = `display: inline-block; background: none; border: 0; padding: 0; ${SANS}; font-size: 15.5px; font-weight: 600; line-height: normal; color: #7a5c2c; cursor: pointer; border-bottom: 1px solid #ded7ca; text-decoration: none`;
const CTA_BUTTON = `background: #14202b; color: #f8f5f0; border: 1px solid #14202b; cursor: pointer; ${SANS}; font-size: 15.5px; font-weight: 700; letter-spacing: 0.05em; padding: 18px 30px; line-height: normal; text-align: center; text-decoration: none; transition: background 180ms ease; border-radius: 999px`;

/** /insights/[slug]: the article with a consultation prompt, related practice areas and three more articles. */
export async function ArticleView({ article, locale }: { article: Article; locale: Locale }) {
  const t = await getTranslations({ locale, namespace: 'insights' });
  const services = article.services
    .map((slug) => getService(locale, slug))
    .filter((svc) => svc !== undefined);
  const more = getContent(locale)
    .articles.filter((a) => a.slug !== article.slug)
    .slice(0, 3);

  return (
    <div style={s(FADE_IN)}>
      <div data-pad data-hero-pad style={s('margin: 0 auto; padding: 64px clamp(20px, 4.6vw, 120px) 0')}>
        <Link href="/insights" data-linkbtn {...x(BACK_LINK, { hover: 'border-bottom-color: #7a5c2c' })}>
          <span aria-hidden="true" style={s('display: inline-block; transform: scaleX(var(--dir, 1))')}>
            ←
          </span>{' '}
          {t('article.back')}
        </Link>
        <div
          data-resp="2"
          style={s(
            'display: grid; grid-template-columns: minmax(0, 1.3fr) minmax(0, 0.7fr); gap: clamp(28px, 5vw, 88px); align-items: start; margin-top: 30px',
          )}
        >
          <article>
            <div style={s(`${KICKER}; margin-bottom: 22px`)}>{article.cat}</div>
            <h1
              data-h1
              style={s(
                `${SERIF}; font-weight: 400; font-size: clamp(36px, 4.4vw, 62px); line-height: 1.05; letter-spacing: -0.022em; color: #14202b; margin: 0; max-width: 24ch`,
              )}
            >
              {article.title}
            </h1>
            <div
              style={s(
                'display: flex; gap: 18px; flex-wrap: wrap; font-size: 14px; color: #736d64; margin: 18px 0 36px',
              )}
            >
              <span>{article.author}</span>
              <span>{t('article.updated', { date: article.date })}</span>
            </div>
            {article.body.map((p, i) => (
              <p
                key={i}
                style={s(
                  'font-size: 18px; line-height: 1.8; color: #3f4b56; margin: 0 0 22px; max-width: 66ch',
                )}
              >
                {p}
              </p>
            ))}
            <div
              style={s(
                'background: #efe9df; margin-top: 36px; padding: 28px 30px; display: flex; gap: 20px; align-items: center; flex-wrap: wrap',
              )}
            >
              <p
                style={s(
                  'font-size: 16.5px; line-height: 1.6; color: #14202b; margin: 0; flex: 1; min-width: 220px',
                )}
              >
                {t('article.ctaText')}
              </p>
              <Link href="/contact" {...x(CTA_BUTTON, { hover: 'background: #22323f' })}>
                {t('article.ctaButton')}
              </Link>
            </div>
          </article>

          <aside style={s('position: sticky; top: 96px')}>
            {services.length > 0 && (
              <SideCard label={t('article.relatedServices')}>
                <PlainList>
                  {services.map((svc) => (
                    <li key={svc.slug}>
                      <Link
                        href={`/services/${svc.slug}`}
                        {...x(`${SANS_ROW}; font-size: 15.5px; font-weight: 600; color: #14202b`, {
                          hover: 'color: #a07a3c',
                        })}
                      >
                        {svc.name}
                      </Link>
                    </li>
                  ))}
                </PlainList>
              </SideCard>
            )}
            <SideCard label={t('article.more')} marginTop={16}>
              <PlainList>
                {more.map((a) => (
                  <li key={a.slug}>
                    <Link href={`/insights/${a.slug}`} {...x(SERIF_ROW, { hover: 'color: #a07a3c' })}>
                      {a.title}
                    </Link>
                  </li>
                ))}
              </PlainList>
            </SideCard>
          </aside>
        </div>
      </div>
    </div>
  );
}
