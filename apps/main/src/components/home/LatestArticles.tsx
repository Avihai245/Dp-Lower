import type { Locale } from '@dpl/core';
import { getContent } from '@dpl/i18n';
import { s, x } from '@dpl/ui';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { articleHref } from '@/lib/nav';
import { Arrow } from './Arrow';

const CARD =
  "text-align: left; background: transparent; border: 0; border-bottom: 1px solid #ece6dc; padding: 26px 2px 28px; cursor: pointer; font-family: 'Manrope', system-ui, sans-serif; display: flex; flex-direction: column; gap: 10px; transition: background 160ms ease; text-decoration: none; line-height: normal";

/** "Knowledge center": the three newest articles of the content, each linking to its page. */
export async function LatestArticles({ locale }: { locale: Locale }) {
  const t = await getTranslations('home');
  const { articles } = getContent(locale);

  return (
    <div data-pad style={s('margin: 0 auto; padding: 88px clamp(20px, 4.6vw, 120px) 0')}>
      <div style={s('display: flex; align-items: baseline; gap: 20px; flex-wrap: wrap; padding-bottom: 20px; border-bottom: 1px solid #14202b')}>
        <div>
          <div style={s('font-size: 12px; font-weight: 600; letter-spacing: 0.18em; text-transform: uppercase; color: #a07a3c; margin-bottom: 22px')}>
            {t('articles.eyebrow')}
          </div>
          <h2
            data-big
            style={s("font-family: 'Newsreader', Georgia, serif; font-weight: 400; font-size: clamp(30px, 3.6vw, 54px); line-height: 1.06; letter-spacing: -0.02em; color: #14202b; margin: 0; max-width: 24ch")}
          >
            {t('articles.title')}
          </h2>
        </div>
        <Link
          href="/insights"
          data-linkbtn
          {...x(
            "display: inline-block; line-height: normal; text-decoration: none; margin-left: auto; align-self: flex-end; background: none; border: 0; padding: 0; font-family: 'Manrope', system-ui, sans-serif; font-size: 15px; font-weight: 600; color: #7a5c2c; cursor: pointer; border-bottom: 1px solid #ded7ca",
            { hover: 'border-bottom-color: #7a5c2c' },
          )}
        >
          {t('articles.all')}&nbsp;
          <Arrow />
        </Link>
      </div>
      <div data-resp="3" style={s('display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0 clamp(24px, 3vw, 56px)')}>
        {articles.slice(0, 3).map((a) => (
          <Link key={a.slug} href={articleHref(a.slug)} {...x(CARD, { hover: 'background: #efe9df' })}>
            <span
              style={s('display: flex; gap: 14px; font-size: 12px; letter-spacing: 0.1em; text-transform: uppercase; color: #a07a3c')}
            >
              <span>{a.cat}</span>
              <span style={s('color: #9c958a')}>{a.date}</span>
            </span>
            <span
              style={s("font-family: 'Newsreader', Georgia, serif; font-size: clamp(21px, 1.7vw, 26px); line-height: 1.25; color: #14202b")}
            >
              {a.title}
            </span>
            <span style={s('font-size: 15.5px; line-height: 1.65; color: #736d64')}>{a.excerpt}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
