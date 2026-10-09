'use client';
import { s, useScrolledPast, x } from '@dpl/ui';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { AdvisorButton } from './AdvisorButton';
import { LanguageSwitch } from './LanguageSwitch';

const NAV_LINK = 'text-decoration: none; color: #23292f';
const NAV_LINK_HOVER = 'color: #a07a3c';

/**
 * Sticky header. Once the page is scrolled past 40px the logo shrinks from 44px to 34px and the bar gets the blur and
 * shadow (prototype `headerCss` / `headerLogoCss`). Nav links hide at <= 960px (globals.css data-navlinks).
 */
export function Header() {
  const t = useTranslations('landing.header');
  const scrolled = useScrolledPast(40);

  const headerCss =
    'position: sticky; top: 0; z-index: 40; background: ' +
    (scrolled ? 'rgba(248,245,240,0.94)' : '#f8f5f0') +
    '; border-bottom: 1px solid #ece6dc; backdrop-filter: ' +
    (scrolled ? 'saturate(140%) blur(10px)' : 'none') +
    '; -webkit-backdrop-filter: ' +
    (scrolled ? 'saturate(140%) blur(10px)' : 'none') +
    '; box-shadow: ' +
    (scrolled ? '0 8px 24px rgba(20,32,43,0.06)' : 'none') +
    '; transition: background 260ms ease, border-color 260ms ease, box-shadow 260ms ease';
  const logoCss =
    'height: ' +
    (scrolled ? '34px' : '44px') +
    '; width: auto; display: block; transition: height 260ms ease';

  return (
    <header style={s(headerCss)}>
      <div
        data-nav
        data-pad
        style={s(
          'max-width: 100%; margin: 0 auto; padding: 18px clamp(20px, 4.6vw, 160px); display: flex; align-items: center; gap: 40px',
        )}
      >
        <Link href="/" style={s('display: block; flex: none')}>
          <img src="/images/DPL_logo.webp" alt={t('logoAlt')} width={800} height={286} style={s(logoCss)} />
        </Link>
        <nav
          data-navlinks
          aria-label={t('navLabel')}
          style={s('display: flex; gap: 36px; margin-left: auto; font-size: 15px; font-weight: 500')}
        >
          <a href="#paths" {...x(NAV_LINK, { hover: NAV_LINK_HOVER })}>
            {t('paths')}
          </a>
          <a href="#process" {...x(NAV_LINK, { hover: NAV_LINK_HOVER })}>
            {t('process')}
          </a>
          <a href="#team" {...x(NAV_LINK, { hover: NAV_LINK_HOVER })}>
            {t('team')}
          </a>
          <a href="#faq" {...x(NAV_LINK, { hover: NAV_LINK_HOVER })}>
            {t('faq')}
          </a>
          <Link
            href="/sign-in"
            {...x(
              // a <button> in the prototype: its label is centred both ways, and line-height is `normal`
              "background: none; border: 0; padding: 0; font-family: 'Manrope', system-ui, sans-serif; font-size: 15px; font-weight: 500; color: #736d64; cursor: pointer; border-bottom: 1px solid #ece6dc; line-height: normal; text-decoration: none; display: flex; align-items: center; justify-content: center; text-align: center",
              { hover: 'color: #a07a3c; border-bottom-color: #a07a3c' },
            )}
          >
            {t('track')}
          </Link>
        </nav>
        <LanguageSwitch />
        <AdvisorButton
          hideSm
          css="background: transparent; color: #14202b; border: 1px solid rgba(20,32,43,0.28); font-family: 'Manrope', system-ui, sans-serif; font-weight: 600; font-size: 13px; letter-spacing: 0.05em; text-transform: uppercase; padding: 15px 22px; border-radius: 12px; transition: border-color 200ms ease, background 200ms ease"
          hover="border-color: #14202b; background: rgba(20,32,43,0.04)"
        >
          {t('advisor')}
        </AdvisorButton>
        <Link
          href="/eligibility"
          data-nav-cta
          {...x(
            "background: #14202b; color: #f8f5f0; font-family: 'Manrope', system-ui, sans-serif; font-weight: 600; font-size: 13.5px; letter-spacing: 0.06em; text-transform: uppercase; padding: 16px 28px; border-radius: 12px; transition: background 200ms ease",
            { className: 'btn', hover: 'background: #1e2f3f' },
          )}
        >
          {t('cta')}
        </Link>
      </div>
    </header>
  );
}
