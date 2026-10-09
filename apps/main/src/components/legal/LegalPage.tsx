import type { Locale } from '@dpl/core';
import { s } from '@dpl/ui';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { FADE_IN, SANS, SERIF } from '../services/parts';

export type LegalDoc = 'privacy' | 'terms' | 'accessibility';
export const LEGAL_DOCS: LegalDoc[] = ['privacy', 'terms', 'accessibility'];

interface LegalSection {
  title: string;
  paras: string[];
  bullets: string[];
  /** last paragraph of the section; the prototype prints it with the other paragraphs, before the bullets (kept: the firm's draft order) */
  tail?: string;
}

const PARA = 'font-size: 16.5px; line-height: 1.8; color: #55606b; margin: 0 0 14px';

/** The prototype's tab: bold caps label with a bronze underline when it is the current page. */
const tabStyle = (on: boolean) =>
  `background: none; border: 0; padding: 4px 0; cursor: pointer; ${SANS}; font-size: 13px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; line-height: normal; text-decoration: none; color: ${on ? '#14202b' : '#9c958a'}; border-bottom: 2px solid ${on ? '#a07a3c' : 'transparent'}`;

/**
 * Privacy policy, terms of use and accessibility statement. The three share one layout; the tabs are real links (each
 * document has its own URL) with aria-current, so they work without JavaScript. The text is the draft wording from the
 * design and is flagged as such at the bottom of the page.
 */
export async function LegalPage({ doc, locale }: { doc: LegalDoc; locale: Locale }) {
  const t = await getTranslations({ locale, namespace: 'legal' });
  const sections = t.raw(`${doc}.sections`) as LegalSection[];

  return (
    <div style={s(FADE_IN)}>
      <div data-pad data-hero-pad style={s('margin: 0 auto; padding: 76px clamp(20px, 4.6vw, 120px) 0')}>
        <div style={s('max-width: 80ch')}>
          <nav
            aria-label={t('tabsLabel')}
            style={s('display: flex; gap: 26px; flex-wrap: wrap; margin-bottom: 30px')}
          >
            {LEGAL_DOCS.map((d) => (
              <Link
                key={d}
                href={`/${d}`}
                aria-current={d === doc ? 'page' : undefined}
                style={s(tabStyle(d === doc))}
              >
                {t(`tabs.${d}`)}
              </Link>
            ))}
          </nav>
          <h1
            data-h1
            style={s(
              `${SERIF}; font-weight: 400; font-size: clamp(32px, 3.8vw, 52px); line-height: 1.08; letter-spacing: -0.02em; color: #14202b; margin: 0 0 14px`,
            )}
          >
            {t(`${doc}.title`)}
          </h1>
          <p style={s('font-size: 14px; color: #736d64; margin: 0 0 40px')}>{t(`${doc}.updated`)}</p>
          <p
            style={s('font-size: 18px; line-height: 1.8; color: #3f4b56; margin: 0 0 34px; max-width: 72ch')}
          >
            {t(`${doc}.lede`)}
          </p>

          {sections.map((section, i) => (
            <section key={i} style={s('border-top: 1px solid #ece6dc; padding: 28px 0 4px')}>
              <h2
                style={s(
                  `${SERIF}; font-weight: 400; font-size: clamp(22px, 2vw, 29px); line-height: 1.2; color: #14202b; margin: 0 0 14px`,
                )}
              >
                {section.title}
              </h2>
              {section.paras.map((p, j) => (
                <p key={j} style={s(PARA)}>
                  {p}
                </p>
              ))}
              {section.tail && <p style={s(PARA)}>{section.tail}</p>}
              {section.bullets.length > 0 && (
                <ul role="list" style={s('list-style: none; margin: 0; padding: 0')}>
                  {section.bullets.map((b, j) => (
                    <li
                      key={j}
                      style={s(
                        'display: grid; grid-template-columns: 16px minmax(0, 1fr); gap: 12px; padding: 7px 0; font-size: 16px; line-height: 1.7; color: #55606b',
                      )}
                    >
                      <span aria-hidden="true" style={s('color: #a07a3c')}>
                        ·
                      </span>
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}

          <div style={s('border-top: 1px solid #ece6dc; margin-top: 28px; padding-top: 28px')}>
            <p style={s('font-size: 16px; line-height: 1.75; color: #736d64; margin: 0')}>
              {t.rich('contact', {
                mail: (chunks) => (
                  <a href="mailto:office@lawoffice.org.il">
                    <bdi>{chunks}</bdi>
                  </a>
                ),
                tel: (chunks) => (
                  <a href="tel:+97233724722">
                    <bdi>{chunks}</bdi>
                  </a>
                ),
              })}
            </p>
            <p style={s('font-size: 13px; line-height: 1.6; color: #9c958a; margin: 16px 0 0')}>
              {t('draft')}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
