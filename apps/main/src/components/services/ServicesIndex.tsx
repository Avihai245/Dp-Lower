import type { Locale } from '@dpl/core';
import { getContent, type ServiceGroup } from '@dpl/i18n';
import { s, x } from '@dpl/ui';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { FADE_IN, KICKER, PlainList, SANS, SERIF } from './parts';

const GROUPS: ServiceGroup[] = ['passports', 'israel', 'other'];

const ROW = `width: 100%; text-align: left; background: transparent; border: 0; border-bottom: 1px solid #ece6dc; cursor: pointer; padding: 18px 2px; display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 16px; align-items: baseline; ${SANS}; line-height: normal; transition: background 160ms ease; text-decoration: none`;

/** /services: the practice areas in three groups. */
export async function ServicesIndex({ locale }: { locale: Locale }) {
  const t = await getTranslations({ locale, namespace: 'services' });
  const { services } = getContent(locale);

  return (
    <div style={s(FADE_IN)}>
      <div data-pad data-hero-pad style={s('margin: 0 auto; padding: 76px clamp(20px, 4.6vw, 120px) 0')}>
        <div
          data-resp="2"
          style={s(
            'display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: clamp(28px, 4vw, 72px); align-items: end; margin-bottom: 56px',
          )}
        >
          <div>
            <div style={s(`${KICKER}; margin-bottom: 22px`)}>{t('list.kicker')}</div>
            <h1
              data-h1
              style={s(
                `${SERIF}; font-weight: 400; font-size: clamp(36px, 4.4vw, 62px); line-height: 1.05; letter-spacing: -0.022em; color: #14202b; margin: 0; max-width: 20ch`,
              )}
            >
              {t('list.title')}
            </h1>
          </div>
          <p style={s('font-size: 18px; line-height: 1.75; color: #55606b; margin: 0; max-width: 56ch')}>
            {t('list.intro')}
          </p>
        </div>

        {GROUPS.map((group) => (
          <section
            key={group}
            aria-labelledby={`services-${group}`}
            style={s('border-top: 1px solid #14202b; padding: 30px 0 0; margin-bottom: 56px')}
          >
            <div
              data-resp="2"
              style={s(
                'display: grid; grid-template-columns: minmax(0, 0.8fr) minmax(0, 1.2fr); gap: clamp(20px, 3vw, 56px); align-items: start',
              )}
            >
              <div>
                <h2
                  id={`services-${group}`}
                  style={s(
                    `${SERIF}; font-weight: 400; font-size: clamp(26px, 2.8vw, 38px); line-height: 1.12; color: #14202b; margin: 0 0 10px`,
                  )}
                >
                  {t(`list.groups.${group}.title`)}
                </h2>
                <p style={s('font-size: 16px; line-height: 1.7; color: #736d64; margin: 0; max-width: 40ch')}>
                  {t(`list.groups.${group}.lede`)}
                </p>
              </div>
              <PlainList>
                {services
                  .filter((svc) => svc.group === group)
                  .map((svc) => (
                    <li key={svc.slug}>
                      <Link href={`/services/${svc.slug}`} {...x(ROW, { hover: 'background: #efe9df' })}>
                        <span>
                          <span
                            style={s('display: block; font-size: 18px; font-weight: 500; color: #14202b')}
                          >
                            {svc.name}
                          </span>
                          <span style={s('display: block; font-size: 14px; color: #736d64; margin-top: 3px')}>
                            {svc.note}
                          </span>
                        </span>
                        <span
                          aria-hidden="true"
                          style={s('font-size: 13px; color: #a07a3c; transform: scaleX(var(--dir, 1))')}
                        >
                          →
                        </span>
                      </Link>
                    </li>
                  ))}
              </PlainList>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
