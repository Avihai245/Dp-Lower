import type { Locale } from '@dpl/core';
import { getContent } from '@dpl/i18n';
import { s, x } from '@dpl/ui';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { COUNTRY_SLUGS, flagStyle } from '@/lib/home/flags';
import { serviceHref } from '@/lib/nav';
import { Arrow } from './Arrow';

const TILE =
  "text-align: left; background: #14202b; border: 0; padding: 26px 26px 24px; cursor: pointer; font-family: 'Manrope', system-ui, sans-serif; color: #f8f5f0; display: flex; flex-direction: column; gap: 18px; min-height: 172px; transition: background 220ms ease; text-decoration: none; line-height: normal";
const ROW =
  "width: 100%; text-align: left; background: transparent; border: 0; border-bottom: 1px solid rgba(248,245,240,0.14); padding: 13px 2px; cursor: pointer; font-family: 'Manrope', system-ui, sans-serif; font-size: 16px; color: #e4e8eb; display: flex; align-items: baseline; gap: 10px; transition: color 160ms ease, padding-inline-start 160ms ease; text-decoration: none; line-height: normal";

/**
 * The dark "Nine countries. Twenty-two practice areas." section: a grid of the nine country routes with their flags
 * and an "All practice areas" tile, then the Israel and Other practice areas as two index lists. All names, kickers
 * and notes come from the services content.
 */
export async function Countries({ locale }: { locale: Locale }) {
  const t = await getTranslations('home');
  const { services } = getContent(locale);
  const countries = COUNTRY_SLUGS.map((slug) => services.find((sv) => sv.slug === slug)).filter((sv): sv is NonNullable<typeof sv> => Boolean(sv));
  const groups = [
    { id: 'israel', title: t('countries.israel'), items: services.filter((sv) => sv.group === 'israel') },
    { id: 'other', title: t('countries.other'), items: services.filter((sv) => sv.group === 'other') },
  ];

  return (
    <div style={s('background: #14202b; color: #f8f5f0')}>
      <div data-pad style={s('margin: 0 auto; padding: 76px clamp(20px, 4.6vw, 120px) 84px')}>
        <div
          data-resp="2"
          style={s('display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: clamp(24px, 4vw, 72px); align-items: end; margin-bottom: 40px')}
        >
          <div>
            <div style={s('font-size: 12px; font-weight: 600; letter-spacing: 0.18em; text-transform: uppercase; color: #c9a45c; margin-bottom: 22px')}>
              {t('countries.eyebrow')}
            </div>
            <h2
              data-big
              style={s("font-family: 'Newsreader', Georgia, serif; font-weight: 400; font-size: clamp(30px, 3.6vw, 54px); line-height: 1.06; letter-spacing: -0.02em; color: #f8f5f0; margin: 0; max-width: 19ch")}
            >
              {t('countries.title')}
            </h2>
          </div>
          <p style={s('font-size: 17px; line-height: 1.7; color: #9aa3ad; margin: 0; max-width: 48ch')}>{t('countries.lede')}</p>
        </div>

        <div
          data-countries
          style={s('display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 1px; background: rgba(248,245,240,0.16); border: 1px solid rgba(248,245,240,0.16)')}
        >
          {countries.map((c) => (
            <Link key={c.slug} href={serviceHref(c.slug)} {...x(TILE, { hover: 'background: #1c2b38' })}>
              <span style={s('display: flex; align-items: center; gap: 14px')}>
                <span aria-hidden="true" style={s(flagStyle(c.slug))} />
                <span style={s('font-size: 12px; font-weight: 600; letter-spacing: 0.16em; text-transform: uppercase; color: #c9a45c')}>{c.kicker}</span>
              </span>
              <span style={s('margin-top: auto')}>
                <span
                  style={s("display: block; font-family: 'Newsreader', Georgia, serif; font-size: clamp(26px, 2.3vw, 34px); line-height: 1.05; letter-spacing: -0.014em")}
                >
                  {c.short}
                </span>
                <span style={s('display: flex; align-items: baseline; gap: 10px; margin-top: 9px')}>
                  <span style={s('font-size: 13.5px; line-height: 1.45; color: #9aa3ad; flex: 1')}>{c.note}</span>
                  <Arrow css="font-size: 13px; color: #c9a45c" />
                </span>
              </span>
            </Link>
          ))}
          <Link href="/services" {...x(TILE, { hover: 'background: #1c2b38' })}>
            <span style={s('font-size: 12px; font-weight: 600; letter-spacing: 0.16em; text-transform: uppercase; color: #c9a45c')}>{t('countries.unsure')}</span>
            <span style={s('margin-top: auto')}>
              <span
                style={s("display: block; font-family: 'Newsreader', Georgia, serif; font-size: clamp(24px, 2vw, 30px); line-height: 1.1; letter-spacing: -0.014em")}
              >
                {t('countries.all')}
              </span>
              <span style={s('display: flex; align-items: baseline; gap: 10px; margin-top: 9px')}>
                <span style={s('font-size: 13.5px; line-height: 1.45; color: #9aa3ad; flex: 1')}>{t('countries.allNote')}</span>
                <Arrow css="font-size: 13px; color: #c9a45c" />
              </span>
            </span>
          </Link>
        </div>

        <div data-resp="2" style={s('display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: clamp(24px, 4vw, 64px); margin-top: 56px')}>
          {groups.map((g) => (
            <div key={g.id}>
              <div style={s('display: flex; align-items: baseline; gap: 12px; padding-bottom: 14px; border-bottom: 1px solid rgba(248,245,240,0.35)')}>
                <h3
                  style={s("font-family: 'Newsreader', Georgia, serif; font-size: 24px; font-weight: 400; line-height: 1.1; letter-spacing: normal; color: #f8f5f0; margin: 0")}
                >
                  {g.title}
                </h3>
                <span style={s('margin-left: auto; font-size: 12px; letter-spacing: 0.1em; color: #c9a45c')}>
                  {t('countries.areas', { count: g.items.length })}
                </span>
              </div>
              <div data-two style={s('display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0 28px')}>
                {g.items.map((sv) => (
                  <Link key={sv.slug} href={serviceHref(sv.slug)} {...x(ROW, { hover: 'color: #c9a45c; padding-left: 8px' })}>
                    <span style={s('flex: 1')}>{sv.name}</span>
                    <Arrow css="font-size: 12px; color: rgba(201,164,92,0.75)" />
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
