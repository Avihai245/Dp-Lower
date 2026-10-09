import { s, x } from '@dpl/ui';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';

interface Review {
  quote: string;
  name: string;
  date: string;
}

/**
 * Client reviews: the 4.9 average (placeholder figure from the design, kept as designed), one featured review and two
 * more. The home page shows these three short quotes; the whole set lives on the testimonials page.
 */
export async function Reviews() {
  const t = await getTranslations('home');
  const featured = t.raw('reviews.featured') as Review;
  const supporting = t.raw('reviews.supporting') as Review[];

  return (
    <div style={s('background: #efe9df; margin-top: 96px')}>
      <div data-pad style={s('margin: 0 auto; padding: 80px clamp(20px, 4.6vw, 120px) 84px')}>
        <div
          data-resp="2"
          style={s('display: grid; grid-template-columns: minmax(0, 0.62fr) minmax(0, 1.38fr); gap: clamp(28px, 5vw, 88px); align-items: start')}
        >
          <div>
            <div aria-hidden="true" style={s('font-size: 20px; letter-spacing: 0.22em; color: #c9a45c; margin-bottom: 12px')}>
              ★★★★★
            </div>
            <div
              style={s("font-family: 'Newsreader', Georgia, serif; font-size: clamp(60px, 6.5vw, 100px); line-height: 0.95; letter-spacing: -0.035em; color: #14202b")}
            >
              4.9
            </div>
            <div style={s('font-size: 14.5px; line-height: 1.5; color: #55606b; margin-top: 14px; max-width: 22ch')}>{t.rich('reviews.average', { n: (chunks) => <bdi dir="ltr">{chunks}</bdi> })}</div>
            <Link
              href="/testimonials"
              data-linkbtn
              {...x(
                "display: inline-block; line-height: normal; text-decoration: none; margin-top: 26px; background: none; border: 0; padding: 0; font-family: 'Manrope', system-ui, sans-serif; font-size: 15px; font-weight: 600; color: #7a5c2c; cursor: pointer; border-bottom: 1px solid #d3c8b6",
                { hover: 'border-bottom-color: #7a5c2c' },
              )}
            >
              {t('reviews.read')}
            </Link>
          </div>
          <div>
            <figure style={s('margin: 0')}>
              <blockquote
                style={s("font-family: 'Newsreader', Georgia, serif; font-size: clamp(23px, 2.3vw, 33px); line-height: 1.38; letter-spacing: -0.01em; color: #14202b; margin: 0 0 22px")}
              >
                {featured.quote}
              </blockquote>
              <figcaption style={s('margin: 0')}>
                <div style={s('font-size: 15px; font-weight: 600; color: #14202b')}>{featured.name}</div>
                <div style={s('font-size: 13.5px; color: #736d64; margin-top: 3px')}>{featured.date}</div>
              </figcaption>
            </figure>
            <div
              data-resp="2"
              style={s('display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 28px; margin-top: 36px; padding-top: 30px; border-top: 1px solid #d3c8b6')}
            >
              {supporting.map((r) => (
                <figure key={r.name} style={s('margin: 0')}>
                  <blockquote style={s('font-size: 15.5px; line-height: 1.65; color: #3f4b56; margin: 0 0 12px')}>{r.quote}</blockquote>
                  <figcaption style={s('margin: 0')}>
                    <div style={s('font-size: 14px; font-weight: 600; color: #14202b')}>{r.name}</div>
                    <div style={s('font-size: 12.5px; color: #736d64; margin-top: 2px')}>{r.date}</div>
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
