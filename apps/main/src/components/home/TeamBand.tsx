import type { Locale } from '@dpl/core';
import { getContent } from '@dpl/i18n';
import { s, x } from '@dpl/ui';
import { getTranslations } from 'next-intl/server';
import Image from 'next/image';
import { Link } from '@/i18n/navigation';
import { Arrow } from './Arrow';

/** The three partners of the firm, in the order of the design (managing partner first). */
const PARTNER_SLUGS = ['anat-levi', 'michael-decker', 'joshua-pex'] as const;

const PARTNER_CARD =
  "text-align: left; background: #fff; border: 1px solid #ece6dc; border-left: 0; padding: 26px 26px 28px; cursor: pointer; font-family: 'Manrope', system-ui, sans-serif; display: flex; align-items: center; gap: 18px; transition: background 180ms ease; text-decoration: none; line-height: normal";

/**
 * "Thirty-seven people": the team photograph under a dark wash with its headline, and below it the three partners
 * (each linking to their page) and the button to the whole team.
 */
export async function TeamBand({ locale }: { locale: Locale }) {
  const t = await getTranslations('home');
  const { team } = getContent(locale);
  const partners = PARTNER_SLUGS.map((slug) => team.find((m) => m.slug === slug)).filter((m): m is NonNullable<typeof m> => Boolean(m));

  return (
    <>
      <div style={s('margin-top: 96px; position: relative; background: #14202b')}>
        <Image
          src="/images/Decker-Pex-Levi-Team-scaled.jpg.webp"
          alt={t('team.image')}
          width={2560}
          height={1707}
          sizes="100vw"
          style={s('width: 100%; height: clamp(360px, 46vw, 620px); object-fit: cover; object-position: center 28%; display: block; opacity: 0.42')}
        />
        <div
          style={s('position: absolute; inset: 0; background: linear-gradient(to right, rgba(20,32,43,0.94) 0%, rgba(20,32,43,0.72) 46%, rgba(20,32,43,0.42) 100%)')}
        />
        <div
          data-pad
          style={s('position: absolute; inset: 0; margin: 0 auto; padding: 0 clamp(20px, 4.6vw, 120px); display: flex; align-items: center')}
        >
          <div style={s('max-width: 620px; color: #f8f5f0')}>
            <div style={s('font-size: 12px; font-weight: 600; letter-spacing: 0.18em; text-transform: uppercase; color: #c9a45c; margin-bottom: 20px')}>
              {t('team.eyebrow')}
            </div>
            <h2
              data-big
              style={s("font-family: 'Newsreader', Georgia, serif; font-weight: 400; font-size: clamp(30px, 3.6vw, 54px); line-height: 1.06; letter-spacing: -0.02em; color: #f8f5f0; margin: 0; max-width: 20ch")}
            >
              {t('team.title')}
            </h2>
            <p style={s('font-size: 17px; line-height: 1.7; color: #c5cbd2; margin: 18px 0 0; max-width: 48ch')}>{t('team.lede')}</p>
          </div>
        </div>
      </div>

      <div data-pad style={s('margin: 0 auto; padding: 0 clamp(20px, 4.6vw, 120px)')}>
        <div
          data-partners
          style={s('display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)) auto; gap: 0; align-items: stretch; margin-top: -1px; border-left: 1px solid #ece6dc')}
        >
          {partners.map((p) => (
            <Link key={p.slug} href={`/team/${p.slug}`} {...x(PARTNER_CARD, { hover: 'background: #efe9df' })}>
              <span
                aria-hidden="true"
                style={s('display: block; position: relative; width: 68px; height: 68px; flex: none; border-radius: 50%; overflow: hidden; background-color: #efe9df')}
              >
                {p.photo && <Image src={p.photo} alt="" fill sizes="68px" style={{ objectFit: 'cover', objectPosition: 'center 18%' }} />}
              </span>
              <span>
                <span style={s("display: block; font-family: 'Newsreader', Georgia, serif; font-size: 23px; line-height: 1.15; color: #14202b")}>{p.name}</span>
                <span style={s('display: block; font-size: 13px; color: #736d64; margin-top: 5px')}>{p.role}</span>
              </span>
            </Link>
          ))}
          <Link
            href="/team"
            {...x(
              "display: flex; align-items: center; justify-content: center; text-align: center; background: #14202b; color: #f8f5f0; border: 1px solid #14202b; padding: 26px 34px; cursor: pointer; font-family: 'Manrope', system-ui, sans-serif; font-size: 14.5px; font-weight: 600; letter-spacing: 0.06em; white-space: nowrap; transition: background 180ms ease; text-decoration: none; line-height: normal",
              { hover: 'background: #22323f' },
            )}
          >
            {t('team.all')}&nbsp;
            <Arrow />
          </Link>
        </div>
      </div>
    </>
  );
}
