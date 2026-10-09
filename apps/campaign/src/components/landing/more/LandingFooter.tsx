import { s, x } from '@dpl/ui';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { PAD } from './kit';

const NAV_LINK = 'text-decoration:none;color:#23292f';

/**
 * Logo, section links, the legal disclaimer, the privacy link and the developer credit. The anchors point at "/#id"
 * so the same footer also works on /privacy.
 */
export async function LandingFooter() {
  const t = await getTranslations('landingMore.footer');
  return (
    <footer
      data-pad
      data-landing-footer
      style={s(`max-width:100%;margin:0 auto;padding:64px ${PAD} 52px;text-align:center`)}
    >
      <div
        style={s('display:flex;flex-direction:column;align-items:center;gap:24px;padding-bottom:36px;border-bottom:1px solid #ece6dc')}
      >
        <img
          src="/images/DPL_logo.webp"
          alt={t('logoAlt')}
          width={800}
          height={286}
          decoding="async"
          style={s('height:42px;width:auto;display:block')}
        />
        <nav
          aria-label={t('navLabel')}
          style={s('display:flex;justify-content:center;gap:40px;flex-wrap:wrap;font-size:15px;font-weight:500')}
        >
          <Link href="/#paths" style={s(NAV_LINK)}>
            {t('nav.paths')}
          </Link>
          <Link href="/#process" style={s(NAV_LINK)}>
            {t('nav.process')}
          </Link>
          <Link href="/#team" style={s(NAV_LINK)}>
            {t('nav.team')}
          </Link>
          <Link href="/#faq" style={s(NAV_LINK)}>
            {t('nav.faq')}
          </Link>
          <Link
            href="/sign-in"
            prefetch={false}
            // a link, but laid out like the prototype's <button>: normal line height, text centred in its box
            {...x(
              'display:flex;align-items:center;line-height:normal;text-decoration:none;background:none;border:0;padding:0;font-family:inherit;font-size:inherit;font-weight:400;color:#23292f;cursor:pointer;border-bottom:1px solid #ece6dc',
              { hover: 'color:#a07a3c' },
            )}
          >
            {t('nav.signIn')}
          </Link>
        </nav>
      </div>
      <p style={s('font-size:13.5px;line-height:1.7;color:#736d64;margin:26px auto 0;max-width:82ch')}>{t('disclaimer')}</p>
      <p style={s('font-size:13px;color:#736d64;margin:14px 0 0')}>
        <Link href="/privacy" style={s('color:#a07a3c')}>
          {t('privacy')}
        </Link>
      </p>
      <p style={s('font-size:13px;color:#736d64;margin:14px 0 0;opacity:0.85')}>
        {t.rich('credit', {
          a: (chunks) => (
            <a
              href="https://www.instagram.com/sabatier_group_ai_marketing/"
              target="_blank"
              rel="noopener"
              style={s('color:#a07a3c')}
            >
              {chunks}
            </a>
          ),
        })}
      </p>
    </footer>
  );
}
