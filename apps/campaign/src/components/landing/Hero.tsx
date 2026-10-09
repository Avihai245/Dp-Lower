import { s, x } from '@dpl/ui';
import { getTranslations } from 'next-intl/server';
import { preconnect, preload } from 'react-dom';
import { Link } from '@/i18n/navigation';
import { AdvisorButton } from './AdvisorButton';
import { HeroVideo } from './HeroVideo';

const POSTER = 'https://i.ytimg.com/vi/52rCx7iQeFo/maxresdefault.jpg';

/**
 * Navy hero: poster as CSS background, muted looping video on wide screens (HeroVideo), two overlay gradients, the
 * staggered [data-hero-seq] intro (globals.css), the two calls to action and the rating line.
 */
export async function Hero() {
  const t = await getTranslations('landing.hero');

  // the poster is the largest paint of the page (the prototype preconnects to the same host)
  preconnect('https://i.ytimg.com');
  preload(POSTER, { as: 'image' });

  return (
    <section
      aria-labelledby="hero-title"
      className="dpl-dark"
      style={s(
        'position: relative; overflow: hidden; background: #14202b; color: #f8f5f0; min-height: clamp(600px, 88vh, 940px); display: flex; align-items: center',
      )}
    >
      <div
        aria-hidden="true"
        style={s(
          `position: absolute; inset: 0; background-color: #14202b; background-image: url(${POSTER}); background-size: cover; background-position: 50% 42%`,
        )}
      />
      <HeroVideo title={t('videoTitle')} />
      <div
        aria-hidden="true"
        style={s(
          'position: absolute; inset: 0; background: linear-gradient(100deg, rgba(20,32,43,0.94) 0%, rgba(20,32,43,0.86) 34%, rgba(20,32,43,0.58) 64%, rgba(20,32,43,0.38) 100%)',
        )}
      />
      <div
        aria-hidden="true"
        style={s(
          'position: absolute; inset: 0; background: linear-gradient(to bottom, rgba(20,32,43,0.5) 0%, rgba(20,32,43,0) 26%, rgba(20,32,43,0) 62%, rgba(20,32,43,0.7) 100%)',
        )}
      />

      <div
        data-pad
        style={s(
          'position: relative; max-width: 100%; width: 100%; margin: 0 auto; padding: 104px clamp(20px, 4.6vw, 160px) 88px',
        )}
      >
        <div data-hero-seq style={s('max-width: 860px')}>
          <div
            style={s(
              "font-family: 'Manrope', system-ui, sans-serif; font-size: 12px; font-weight: 600; letter-spacing: 0.18em; text-transform: uppercase; color: #d3ae6b; display: flex; align-items: center; gap: 14px; margin-bottom: 30px",
            )}
          >
            <span style={s('width: 30px; height: 1px; background: currentColor; opacity: 0.7')} />
            {t('kicker')}
          </div>
          <h1
            id="hero-title"
            data-hero-h1
            style={s(
              "font-family: 'Newsreader', Georgia, serif; font-weight: 400; font-size: clamp(40px, 5.4vw, 86px); line-height: 1.03; letter-spacing: -0.022em; color: #f8f5f0; margin: 0 0 30px; max-width: 21ch; text-wrap: balance",
            )}
          >
            {t('title')}
          </h1>
          <p
            style={s(
              "font-family: 'Manrope', system-ui, sans-serif; font-size: 20px; line-height: 1.65; color: rgba(248,245,240,0.82); margin: 0 0 40px; max-width: 52ch",
            )}
          >
            {t('lead')}
          </p>
          <p
            style={s(
              "font-family: 'Manrope', system-ui, sans-serif; font-size: 17px; line-height: 1.6; color: #d3ae6b; margin: -20px 0 36px; max-width: 54ch",
            )}
          >
            {t('note')}
          </p>
          <div
            data-actions
            style={s(
              'display: flex; align-items: flex-start; gap: 20px; flex-wrap: wrap; margin-bottom: 22px',
            )}
          >
            <Link
              href="/eligibility"
              {...x(
                "background: #f8f5f0; color: #14202b; font-family: 'Manrope', system-ui, sans-serif; font-weight: 600; font-size: 16.5px; letter-spacing: 0.06em; text-transform: uppercase; height: 64px; padding: 0 42px; display: inline-flex; align-items: center; justify-content: center; border-radius: 12px; transition: background 200ms ease, transform 200ms ease",
                { className: 'btn', hover: 'background: #fff; transform: translateY(-1px)' },
              )}
            >
              {t('cta')}
            </Link>
            <span style={s('display: flex; flex-direction: column; gap: 6px')}>
              <AdvisorButton
                css="background: transparent; color: #f8f5f0; border: 1px solid rgba(248,245,240,0.42); font-family: 'Manrope', system-ui, sans-serif; font-weight: 600; font-size: 15px; letter-spacing: 0.05em; text-transform: uppercase; height: 64px; padding: 0 30px; display: inline-flex; align-items: center; justify-content: center; border-radius: 12px; transition: border-color 200ms ease, background 200ms ease"
                hover="border-color: #f8f5f0; background: rgba(248,245,240,0.1)"
              >
                {t('advisor')}
              </AdvisorButton>
              <span
                style={s(
                  "font-family: 'Manrope', system-ui, sans-serif; font-size: 13px; color: rgba(248,245,240,0.6); text-align: center",
                )}
              >
                {t('advisorHint')}
              </span>
            </span>
          </div>
          <div
            style={s(
              "display: inline-flex; align-items: center; gap: 12px; font-family: 'Manrope', system-ui, sans-serif; font-size: 14.5px; color: rgba(248,245,240,0.82); margin-top: 18px",
            )}
          >
            <span
              role="img"
              aria-label={t('stars')}
              style={s('color: #d3ae6b; font-size: 15px; letter-spacing: 2px')}
            >
              ★★★★★
            </span>
            <span style={s('font-weight: 700; color: #f8f5f0')}>{t('score')}</span>
            <span aria-hidden="true" style={s('opacity: 0.45')}>
              ·
            </span>
            <span>{t('count')}</span>
          </div>
        </div>
        <div
          data-hide-sm
          style={s(
            "position: absolute; left: clamp(20px, 4.6vw, 160px); bottom: 40px; display: flex; align-items: center; gap: 14px; font-family: 'Manrope', system-ui, sans-serif; font-size: 11.5px; font-weight: 600; letter-spacing: 0.2em; text-transform: uppercase; color: rgba(248,245,240,0.55)",
          )}
        >
          <span
            data-scroll-line
            aria-hidden="true"
            style={s(
              'display: block; width: 1px; height: 44px; background: rgba(248,245,240,0.6); animation: scrollLine 2600ms ease-in-out infinite',
            )}
          />
          {t('scroll')}
        </div>
      </div>
    </section>
  );
}
