import type { Locale } from '@dpl/core';
import { s, x } from '@dpl/ui';
import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { PAD } from '@/components/landing/more/kit';
import { LandingFooter } from '@/components/landing/more/LandingFooter';
import { Isolated } from '@/components/landing/more/ltr';
import { Link } from '@/i18n/navigation';
import { pageMetadata } from '@/lib/seo';

interface Params {
  params: Promise<{ locale: string }>;
}

interface Section {
  title: string;
  paras?: string[];
  bullets?: string[];
  /** closing sentence that follows the bullets */
  tail?: string;
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'landingMore.privacy' });
  return pageMetadata({ locale: locale as Locale, path: '/privacy', title: t('metaTitle'), description: t('metaDescription') });
}

const BODY = 'font-size:16.5px;line-height:1.8;color:#55606b;margin:0 0 14px';

/**
 * The privacy policy. The wording is the main site's draft ("Draft for review. The firm's approved legal wording
 * replaces this text before launch."), set in the legal-page layout of that design.
 */
export default async function PrivacyPage({ params }: Params) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('landingMore.privacy');
  const sections = t.raw('sections') as Section[];

  return (
    <div style={s("min-height:100vh;background:#f8f5f0;color:#23292f;font-family:'Manrope',system-ui,sans-serif")}>
      <header style={s('background:#f8f5f0;border-bottom:1px solid #ece6dc')}>
        <div
          data-pad
          style={s(`max-width:100%;margin:0 auto;padding:18px ${PAD};display:flex;align-items:center;gap:40px`)}
        >
          <Link href="/" style={s('display:block;line-height:0')}>
            <img
              src="/images/DPL_logo.webp"
              alt={t('logoAlt')}
              width={800}
              height={286}
              decoding="async"
              style={s('height:44px;width:auto;display:block')}
            />
          </Link>
          <Link
            href="/"
            {...x('margin-left:auto;text-decoration:none;color:#23292f;font-size:15px;font-weight:500', { hover: 'color:#a07a3c' })}
          >
            {t('homeLink')}
          </Link>
        </div>
      </header>

      <main data-pad style={s(`margin:0 auto;padding:76px ${PAD} 96px`)}>
        <div style={s('max-width:80ch')}>
          <h1
            data-h1
            style={s(
              "font-family:'Newsreader',Georgia,serif;font-weight:400;font-size:clamp(32px,3.8vw,52px);line-height:1.08;letter-spacing:-0.02em;color:#14202b;margin:0 0 14px",
            )}
          >
            {t('title')}
          </h1>
          <p style={s('font-size:14px;color:#736d64;margin:0 0 40px')}>{t('updated')}</p>
          <p style={s('font-size:18px;line-height:1.8;color:#3f4b56;margin:0 0 34px;max-width:72ch')}>
            <Isolated text={t('lede')} />
          </p>
          {sections.map((sec) => (
            <section key={sec.title} style={s('border-top:1px solid #ece6dc;padding:28px 0 4px')}>
              <h2
                style={s(
                  "font-family:'Newsreader',Georgia,serif;font-weight:400;font-size:clamp(22px,2vw,29px);line-height:1.2;color:#14202b;margin:0 0 14px",
                )}
              >
                {sec.title}
              </h2>
              {sec.paras?.map((p) => (
                <p key={p} style={s(BODY)}>
                  <Isolated text={p} />
                </p>
              ))}
              {sec.bullets && (
                <ul role="list" style={s('list-style:none;margin:0;padding:0')}>
                  {sec.bullets.map((b) => (
                    <li
                      key={b}
                      style={s('display:grid;grid-template-columns:16px minmax(0,1fr);gap:12px;padding:7px 0;font-size:16px;line-height:1.7;color:#55606b')}
                    >
                      <span aria-hidden="true" style={s('color:#a07a3c')}>
                        ·
                      </span>
                      <span>
                        <Isolated text={b} />
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              {sec.tail && (
                <p style={s(`${BODY};margin-top:8px`)}>
                  <Isolated text={sec.tail} />
                </p>
              )}
            </section>
          ))}
          <div style={s('border-top:1px solid #ece6dc;margin-top:28px;padding-top:28px')}>
            <p style={s('font-size:16px;line-height:1.75;color:#736d64;margin:0')}>
              {t.rich('contact', {
                email: (chunks) => (
                  <a href="mailto:office@lawoffice.org.il">
                    <bdi dir="ltr">{chunks}</bdi>
                  </a>
                ),
                phone: (chunks) => (
                  <a href="tel:+97233724722">
                    <bdi dir="ltr">{chunks}</bdi>
                  </a>
                ),
              })}
            </p>
            <p style={s('font-size:13px;line-height:1.6;color:#9c958a;margin:16px 0 0')}>{t('draft')}</p>
          </div>
        </div>
      </main>

      <LandingFooter />
    </div>
  );
}
