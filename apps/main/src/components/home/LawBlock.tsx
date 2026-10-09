import type { Locale } from '@dpl/core';
import { s, x } from '@dpl/ui';
import { getTranslations } from 'next-intl/server';
import Image from 'next/image';
import { Link } from '@/i18n/navigation';
import { campaignUrl } from '@/lib/shell/campaign';
import { serviceHref } from '@/lib/nav';

const TEXT_LINK =
  "display: inline-block; line-height: normal; text-decoration: none; background: none; border: 0; padding: 0; font-family: 'Manrope', system-ui, sans-serif; font-size: 15.5px; font-weight: 600; color: #7a5c2c; cursor: pointer; border-bottom: 1px solid #ded7ca";

/**
 * "In 2020 the citizenship laws changed": the family-papers photograph with a client's quote, the explanation of the
 * German and Austrian routes, and the way in: the online eligibility check, the portal sign-in and the two route pages.
 */
export async function LawBlock({ locale }: { locale: Locale }) {
  const t = await getTranslations('home');
  return (
    <div data-pad style={s('margin: 0 auto; padding: 88px clamp(20px, 4.6vw, 120px) 0')}>
      <div
        data-resp="2"
        style={s('display: grid; grid-template-columns: minmax(0, 0.92fr) minmax(0, 1.08fr); gap: clamp(28px, 5vw, 80px); align-items: center')}
      >
        <div style={s('position: relative')}>
          <Image
            src="/images/pic1.webp"
            alt={t('law.image')}
            width={1600}
            height={1200}
            sizes="(max-width: 1080px) 100vw, 44vw"
            style={s('width: 100%; height: auto; aspect-ratio: 4 / 3; object-fit: cover; display: block; background: #efe9df')}
          />
          <figure
            data-quote
            style={s('position: absolute; right: -28px; bottom: -28px; max-width: 300px; background: #14202b; color: #f8f5f0; padding: 24px 26px; margin: 0')}
          >
            <blockquote style={s("font-family: 'Newsreader', Georgia, serif; font-size: 19px; line-height: 1.4; margin: 0 0 10px")}>{t('law.quote')}</blockquote>
            {/* the caption sits in a line of the page's own size (15px), as the prototype's inline span did */}
            <figcaption style={s('font-size: 15px; color: inherit; margin: 0')}>
              <span style={s('font-size: 12.5px; color: #9aa3ad')}>{t('law.quoteBy')}</span>
            </figcaption>
          </figure>
        </div>
        <div>
          <div style={s('font-size: 12px; font-weight: 600; letter-spacing: 0.18em; text-transform: uppercase; color: #a07a3c; margin-bottom: 22px')}>
            {t('law.eyebrow')}
          </div>
          <h2
            data-big
            style={s("font-family: 'Newsreader', Georgia, serif; font-weight: 400; font-size: clamp(30px, 3.6vw, 54px); line-height: 1.06; letter-spacing: -0.02em; color: #14202b; margin: 0; max-width: 19ch")}
          >
            {t('law.title')}
          </h2>
          <p style={s('font-size: 17.5px; line-height: 1.75; color: #55606b; margin: 20px 0 16px; max-width: 52ch')}>{t('law.p1')}</p>
          <p style={s('font-size: 17.5px; line-height: 1.75; color: #55606b; margin: 0 0 30px; max-width: 52ch')}>{t('law.p2')}</p>
          <div style={s('display: flex; gap: 14px; flex-wrap: wrap; margin-bottom: 26px')}>
            <a
              href={campaignUrl(locale, 'eligibility')}
              {...x(
                'background: #14202b; color: #f8f5f0; text-decoration: none; font-size: 15.5px; font-weight: 700; letter-spacing: 0.05em; padding: 18px 30px; display: inline-block; transition: background 180ms ease; border-radius: 999px',
                { hover: 'background: #22323f' },
              )}
            >
              {t('law.check')}
            </a>
            <a
              href={campaignUrl(locale, 'sign-in')}
              {...x(
                'background: transparent; color: #14202b; text-decoration: none; border: 1px solid #14202b; font-size: 15.5px; font-weight: 600; letter-spacing: 0.05em; padding: 17px 29px; display: inline-block; transition: background 180ms ease; border-radius: 999px',
                { hover: 'background: rgba(20,32,43,0.06)' },
              )}
            >
              {t('law.signin')}
            </a>
          </div>
          <div style={s('display: flex; gap: 28px; flex-wrap: wrap; border-top: 1px solid #ece6dc; padding-top: 20px')}>
            <Link href={serviceHref('german-citizenship')} data-linkbtn {...x(TEXT_LINK, { hover: 'border-bottom-color: #7a5c2c' })}>
              {t('law.german')}
            </Link>
            <Link href={serviceHref('austrian-citizenship')} data-linkbtn {...x(TEXT_LINK, { hover: 'border-bottom-color: #7a5c2c' })}>
              {t('law.austrian')}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
