import type { Locale } from '@dpl/core';
import { s, x } from '@dpl/ui';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { campaignUrl } from '@/lib/shell/campaign';
import { FIRM } from '@/lib/shell/firm';
import { FOOTER_PAGES } from '@/lib/nav';

const HEAD = 'font-size: 12px; font-weight: 700; letter-spacing: 0.2em; text-transform: uppercase; color: #c9a45c; margin-bottom: 18px';
const ADDRESS = 'font-style: normal; font-size: 14.5px; line-height: 1.75; color: #9aa3ad; margin: 0 0 10px';
const SOCIAL = 'color: #c5cbd2; text-decoration: none';
const PAGE_LINK = "font-family: 'Manrope', system-ui, sans-serif; font-size: 14.5px; color: #9aa3ad; text-decoration: none; line-height: normal";
const LEGAL_LINK = "font-family: 'Manrope', system-ui, sans-serif; font-size: 13px; color: #9aa3ad; text-decoration: none; line-height: normal";

/** Page footer: logo and profiles, both offices, the page list, the disclaimer, legal links and the developer credit. */
export async function Footer({ locale }: { locale: Locale }) {
  const t = await getTranslations('site');
  const tel = (office: 'telAviv' | 'jerusalem') => t.raw(`footer.${office}.lines`) as string[];

  return (
    <footer>
      <div style={s('height: 3px; background: #c9a45c')} />
      <div style={s('background: #14202b; color: #c5cbd2')}>
        <div data-pad style={s('margin: 0 auto; padding: 64px clamp(20px, 4.6vw, 120px) 0')}>
          <div
            data-resp="4"
            style={s('display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: clamp(24px, 3vw, 48px); padding-bottom: 8px')}
          >
            <div>
              <img
                src="/images/DPL_logo.webp"
                alt={t('brand.logoAlt')}
                width={800}
                height={286}
                decoding="async"
                loading="lazy"
                style={s('height: 36px; width: auto; display: block; margin-bottom: 20px; filter: brightness(0) invert(1); opacity: 0.92')}
              />
              <p style={s('font-size: 14.5px; line-height: 1.7; color: #9aa3ad; margin: 0 0 18px')}>{t('footer.tagline')}</p>
              <div style={s('display: flex; gap: 18px; font-size: 14px')}>
                <a href={FIRM.linkedin} target="_blank" rel="noopener" style={s(SOCIAL)}>
                  {t('footer.social.linkedin')}
                </a>
                <a href={FIRM.youtube} target="_blank" rel="noopener" style={s(SOCIAL)}>
                  {t('footer.social.youtube')}
                </a>
                <a href={FIRM.facebook} target="_blank" rel="noopener" style={s(SOCIAL)}>
                  {t('footer.social.facebook')}
                </a>
              </div>
            </div>
            <div>
              <div style={s(HEAD)}>{t('footer.telAviv.title')}</div>
              <address style={s(ADDRESS)}>
                {tel('telAviv').map((line, i) => (
                  <span key={line}>
                    {i > 0 && <br />}
                    {line}
                  </span>
                ))}
              </address>
              <a href={FIRM.telAvivHref} style={s('font-size: 15px; color: #f8f5f0; text-decoration: none; display: block')}>
                <bdi>{t('phones.telAviv')}</bdi>
              </a>
              <a href={FIRM.mailto} style={s('font-size: 15px; color: #9aa3ad; text-decoration: none; display: block; margin-top: 6px')}>
                {FIRM.email}
              </a>
            </div>
            <div>
              <div style={s(HEAD)}>{t('footer.jerusalem.title')}</div>
              <address style={s(ADDRESS)}>
                {tel('jerusalem').map((line, i) => (
                  <span key={line}>
                    {i > 0 && <br />}
                    {line}
                  </span>
                ))}
              </address>
              <a href={FIRM.jerusalemHref} style={s('font-size: 15px; color: #f8f5f0; text-decoration: none')}>
                <bdi>{t('phones.jerusalem')}</bdi>
              </a>
            </div>
            <nav aria-label={t('footer.pagesTitle')}>
              <div style={s(HEAD)}>{t('footer.pagesTitle')}</div>
              <div data-taplist style={s('display: flex; flex-direction: column; gap: 10px; align-items: flex-start; font-size: 14.5px')}>
                {FOOTER_PAGES.map((p) => (
                  <Link key={p.id} href={p.href} data-linkbtn {...x(PAGE_LINK, { hover: 'color: #f8f5f0' })}>
                    {t(`footer.pages.${p.id}`)}
                  </Link>
                ))}
                <a href={campaignUrl(locale, 'sign-in')} {...x('font-size: 14.5px; color: #9aa3ad; text-decoration: none', { hover: 'color: #f8f5f0' })}>
                  {t('nav.portal')}
                </a>
              </div>
            </nav>
          </div>
        </div>

        <div data-pad style={s('margin: 0 auto; padding: 44px clamp(20px, 4.6vw, 120px) 46px; text-align: center')}>
          <div style={s('border-top: 1px solid rgba(248,245,240,0.16); padding-top: 30px')}>
            <p style={s('font-size: 13px; line-height: 1.7; color: #7d8792; margin: 0 auto 14px; max-width: 92ch')}>{t('footer.disclaimer')}</p>
            <div
              data-taplist
              style={s('display: flex; align-items: center; justify-content: center; gap: 16px; flex-wrap: wrap; font-size: 13px; color: #7d8792; margin-bottom: 12px')}
            >
              <span>{t('footer.copyright')}</span>
              <Link href="/terms" data-linkbtn {...x(LEGAL_LINK, { hover: 'color: #f8f5f0' })}>
                {t('footer.terms')}
              </Link>
              <Link href="/privacy" data-linkbtn {...x(LEGAL_LINK, { hover: 'color: #f8f5f0' })}>
                {t('footer.privacy')}
              </Link>
              <Link href="/accessibility" data-linkbtn {...x(LEGAL_LINK, { hover: 'color: #f8f5f0' })}>
                {t('footer.accessibility')}
              </Link>
            </div>
            <p style={s('font-size: 12.5px; color: #7d8792; margin: 0')}>
              {t.rich('footer.developedBy', {
                a: (chunks) => (
                  <a href={FIRM.developer} target="_blank" rel="noopener" style={s('color: #9aa3ad')}>
                    {chunks}
                  </a>
                ),
              })}
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
