import type { Locale } from '@dpl/core';
import { s, x } from '@dpl/ui';
import { getTranslations } from 'next-intl/server';
import Image from 'next/image';
import { preconnect } from 'react-dom';
import { Link } from '@/i18n/navigation';
import { campaignUrl } from '@/lib/campaign';
import { HeroVideo } from './HeroVideo';

/** The film's thumbnail is the poster: the page is complete without the video, which only starts later on desktop. */
const POSTER_ORIGIN = 'https://i.ytimg.com';
const POSTER = `${POSTER_ORIGIN}/vi/IYQ1_m3cCMA/maxresdefault.jpg`;

interface Fact {
  title: string;
  note: string;
}

/** Opening block: eyebrow, headline, lede, two calls to action, rating and the four facts about the firm. */
export async function Hero({ locale }: { locale: Locale }) {
  preconnect(POSTER_ORIGIN);
  const t = await getTranslations('home');
  const facts = t.raw('hero.facts') as Fact[];

  return (
    <div style={s('position: relative; overflow: hidden; background: #14202b; color: #f8f5f0')}>
      <div style={s('position: absolute; inset: 0; background-color: #14202b')}>
        {/* a YouTube thumbnail, already compressed: served as is. It is the page's largest paint, so it is fetched eagerly with high priority */}
        <Image
          src={POSTER}
          alt=""
          fill
          unoptimized
          loading="eager"
          fetchPriority="high"
          sizes="100vw"
          style={{ objectFit: 'cover', objectPosition: '50% 38%' }}
        />
      </div>
      <HeroVideo title={t('hero.videoTitle')} />
      <div
        data-hero-scrim
        style={s('position: absolute; inset: 0; background: linear-gradient(100deg, rgba(20,32,43,0.95) 0%, rgba(20,32,43,0.88) 36%, rgba(20,32,43,0.62) 66%, rgba(20,32,43,0.42) 100%)')}
      />
      <div
        style={s('position: absolute; inset: 0; background: linear-gradient(to bottom, rgba(20,32,43,0.55) 0%, rgba(20,32,43,0) 28%, rgba(20,32,43,0) 60%, rgba(20,32,43,0.72) 100%)')}
      />
      <div data-pad data-hero-pad style={s('position: relative; margin: 0 auto; padding: 104px clamp(20px, 4.6vw, 120px) 92px')}>
        <div
          data-resp="2"
          style={s('display: grid; grid-template-columns: minmax(0, 1.15fr) minmax(0, 0.85fr); gap: clamp(32px, 5vw, 88px); align-items: end')}
        >
          <div>
            <div
              style={s('display: flex; align-items: center; gap: 12px; font-size: 12px; font-weight: 600; letter-spacing: 0.18em; text-transform: uppercase; color: #c9a45c; margin-bottom: 26px')}
            >
              <span style={s('width: 28px; height: 1px; background: currentColor; opacity: 0.7')} />
              {t('hero.eyebrow')}
            </div>
            <h1
              data-h1
              style={s("font-family: 'Newsreader', Georgia, serif; font-weight: 400; font-size: clamp(38px, 5vw, 74px); line-height: 1.02; letter-spacing: -0.025em; margin: 0 0 26px; max-width: 24ch; animation: fadeUp 520ms cubic-bezier(0.2,0,0,1) both")}
            >
              {t('hero.title')}
            </h1>
            <p
              style={s('font-size: 19px; line-height: 1.65; color: #c5cbd2; margin: 0 0 36px; max-width: 58ch; animation: fadeUp 520ms 90ms cubic-bezier(0.2,0,0,1) both')}
            >
              {t('hero.lede')}
            </p>
            <div style={s('display: flex; gap: 14px; flex-wrap: wrap; animation: fadeUp 520ms 160ms cubic-bezier(0.2,0,0,1) both')}>
              <Link
                href="/contact"
                {...x(
                  "display: inline-flex; align-items: center; justify-content: center; text-align: center; background: #c9a45c; color: #14202b; border: 1px solid #c9a45c; cursor: pointer; font-family: 'Manrope', system-ui, sans-serif; font-size: 15.5px; font-weight: 700; letter-spacing: 0.05em; padding: 18px 30px; transition: background 180ms ease; border-radius: 999px; line-height: normal; text-decoration: none",
                  { hover: 'background: #d8b878' },
                )}
              >
                {t('hero.ctaAssess')}
              </Link>
              <a
                href={campaignUrl(locale, 'eligibility')}
                {...x(
                  "background: transparent; color: #f8f5f0; text-decoration: none; border: 1px solid rgba(248,245,240,0.35); font-family: 'Manrope', system-ui, sans-serif; font-size: 15.5px; font-weight: 600; letter-spacing: 0.05em; padding: 18px 30px; display: inline-block; transition: border-color 180ms ease, background 180ms ease; border-radius: 999px",
                  { hover: 'border-color: #f8f5f0; background: rgba(248,245,240,0.06)' },
                )}
              >
                {t('hero.ctaEligibility')}
              </a>
            </div>
            <div
              style={s('display: flex; align-items: center; gap: 22px; flex-wrap: wrap; margin-top: 26px; animation: fadeUp 520ms 220ms cubic-bezier(0.2,0,0,1) both')}
            >
              <span style={s('display: flex; align-items: center; gap: 10px')}>
                <span aria-hidden="true" style={s('font-size: 14px; letter-spacing: 0.18em; color: #c9a45c')}>
                  ★★★★★
                </span>
                <span style={s('font-size: 14px; color: #c5cbd2')}>
                  {t.rich('hero.rating', {
                    b: (chunks) => <strong style={s('color: #f8f5f0; font-weight: 600')}>{chunks}</strong>,
                    n: (chunks) => <bdi dir="ltr">{chunks}</bdi>,
                  })}
                </span>
              </span>
              <span style={s('font-size: 14px; color: #c5cbd2')}>{t('hero.callback')}</span>
            </div>
          </div>
          <div
            style={s('border-left: 1px solid rgba(248,245,240,0.16); padding-left: clamp(20px, 3vw, 44px); display: flex; flex-direction: column; gap: 26px')}
          >
            {facts.map((f) => (
              <div key={f.title}>
                <div style={s("font-family: 'Newsreader', Georgia, serif; font-size: 25px; line-height: 1.2; color: #f8f5f0")}>{f.title}</div>
                <div style={s('font-size: 14.5px; line-height: 1.55; color: #9aa3ad; margin-top: 5px')}>{f.note}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
