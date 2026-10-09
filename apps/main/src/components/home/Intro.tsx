import { s, x } from '@dpl/ui';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';

/** The statement under the strip: what the firm does, and the link to the About page. */
export async function Intro() {
  const t = await getTranslations('home');
  return (
    <div data-pad style={s('margin: 0 auto; padding: 84px clamp(20px, 4.6vw, 120px) 76px')}>
      <div
        data-resp="2"
        style={s('display: grid; grid-template-columns: minmax(0, 1.15fr) minmax(0, 0.85fr); gap: clamp(28px, 5vw, 96px); align-items: start')}
      >
        <h2
          style={s("font-family: 'Newsreader', Georgia, serif; font-weight: 400; font-size: clamp(26px, 2.7vw, 40px); line-height: 1.32; letter-spacing: -0.014em; color: #14202b; margin: 0; max-width: 32ch")}
        >
          {t('intro.title')}
        </h2>
        <div>
          <p style={s('font-size: 17.5px; line-height: 1.78; color: #55606b; margin: 0 0 16px; max-width: 52ch')}>{t('intro.p1')}</p>
          <p style={s('font-size: 17.5px; line-height: 1.78; color: #55606b; margin: 0 0 24px; max-width: 52ch')}>{t('intro.p2')}</p>
          <Link
            href="/about"
            data-linkbtn
            {...x(
              "display: inline-block; line-height: normal; text-decoration: none; background: none; border: 0; padding: 0; font-family: 'Manrope', system-ui, sans-serif; font-size: 15.5px; font-weight: 600; color: #7a5c2c; cursor: pointer; border-bottom: 1px solid #ded7ca",
              { hover: 'border-bottom-color: #7a5c2c' },
            )}
          >
            {t('intro.more')}
          </Link>
        </div>
      </div>
    </div>
  );
}
