import type { Locale } from '@dpl/core';
import { getMember, type Service } from '@dpl/i18n';
import { s, x } from '@dpl/ui';
import { getTranslations } from 'next-intl/server';
import Image from 'next/image';
import { Link } from '@/i18n/navigation';
import { campaignHref } from './campaign-links';
import { avatarInitials, stripAttorneyTitle } from './format';
import { KICKER, SANS, SERIF } from './parts';

const BTN_GOLD =
  'background: #c9a45c; color: #14202b; text-decoration: none; text-align: center; font-size: 15.5px; font-weight: 700; letter-spacing: 0.05em; padding: 18px 26px; display: block; transition: background 180ms ease; border-radius: 999px';
const BTN_OUTLINE =
  'background: transparent; color: #f8f5f0; text-decoration: none; text-align: center; border: 1px solid rgba(248,245,240,0.35); font-size: 15.5px; font-weight: 600; letter-spacing: 0.05em; padding: 17px 25px; display: block; border-radius: 999px';

/** The lead attorney chip: the first member of the service's team, photo or initials. */
async function LeadChip({ service, locale }: { service: Service; locale: Locale }) {
  const t = await getTranslations({ locale, namespace: 'services' });
  const lead = getMember(locale, service.team[0] ?? '');
  const name = lead?.name ?? t('detail.leadFallbackName');
  const role = lead ? stripAttorneyTitle(lead.role, locale) : t('detail.leadFallbackRole');

  return (
    <div
      style={s(
        'display: flex; align-items: center; gap: 12px; padding: 14px 0 0; border-top: 1px solid rgba(248,245,240,0.16); margin-top: 6px',
      )}
    >
      <span
        aria-hidden="true"
        style={s(
          'position: relative; overflow: hidden; display: grid; place-items: center; width: 44px; height: 44px; flex: none; border-radius: 50%; font-size: 14px; font-weight: 600; color: #f8f5f0; background-color: rgba(248,245,240,0.14)',
        )}
      >
        {lead?.photo ? (
          <Image
            src={lead.photo}
            alt=""
            fill
            sizes="44px"
            style={{ objectFit: 'cover', objectPosition: 'center 18%' }}
          />
        ) : lead ? (
          avatarInitials(lead.name)
        ) : null}
      </span>
      <span>
        <span style={s('display: block; font-size: 14.5px; font-weight: 600; color: #f8f5f0')}>{name}</span>
        <span style={s('display: block; font-size: 12.5px; color: #9aa3ad; margin-top: 2px')}>{role}</span>
      </span>
    </div>
  );
}

/** Dark band on top of a service page: kicker, headline, lede and the calls to action. */
export async function ServiceHero({ service, locale }: { service: Service; locale: Locale }) {
  const t = await getTranslations({ locale, namespace: 'services' });

  return (
    <div style={s('background: #14202b; color: #f8f5f0')}>
      <div data-pad data-hero-pad style={s('margin: 0 auto; padding: 64px clamp(20px, 4.6vw, 120px) 72px')}>
        <Link
          href="/services"
          data-linkbtn
          {...x(
            `display: inline-block; background: none; border: 0; padding: 0; ${SANS}; font-size: 14px; color: #9aa3ad; cursor: pointer; margin-bottom: 26px; line-height: normal; text-decoration: none`,
            {
              hover: 'color: #f8f5f0',
            },
          )}
        >
          <span aria-hidden="true" style={s('display: inline-block; transform: scaleX(var(--dir, 1))')}>
            ←
          </span>{' '}
          {t('detail.back')}
        </Link>
        <div
          data-resp="2"
          style={s(
            'display: grid; grid-template-columns: minmax(0, 1.3fr) minmax(0, 0.7fr); gap: clamp(28px, 5vw, 88px); align-items: end',
          )}
        >
          <div>
            <div style={s(`${KICKER}; color: #c9a45c; margin-bottom: 20px`)}>{service.kicker}</div>
            <h1
              data-h1
              style={s(
                `${SERIF}; font-weight: 400; font-size: clamp(36px, 4.4vw, 60px); line-height: 1.05; letter-spacing: -0.022em; margin: 0 0 22px; max-width: 22ch`,
              )}
            >
              {service.headline}
            </h1>
            <p style={s('font-size: 18px; line-height: 1.7; color: #c5cbd2; margin: 0; max-width: 60ch')}>
              {service.overview[0]}
            </p>
          </div>
          <div style={s('display: flex; flex-direction: column; gap: 12px')}>
            {service.online ? (
              <>
                <a
                  href={campaignHref(locale, 'eligibility')}
                  {...x(BTN_GOLD, { hover: 'background: #d8b878' })}
                >
                  {t('detail.checkEligibility')}
                </a>
                <a
                  href={campaignHref(locale, 'sign-in')}
                  {...x(BTN_OUTLINE, { hover: 'border-color: #f8f5f0' })}
                >
                  {t('detail.signIn')}
                </a>
              </>
            ) : (
              <>
                <Link
                  href="/contact"
                  {...x(`${BTN_GOLD}; border: 1px solid #c9a45c; cursor: pointer; line-height: normal`, {
                    hover: 'background: #d8b878',
                  })}
                >
                  {t('detail.requestConsultation')}
                </Link>
                <a href="tel:+97233724722" {...x(BTN_OUTLINE, { hover: 'border-color: #f8f5f0' })}>
                  {t.rich('detail.call', { num: (chunks) => <bdi>{chunks}</bdi> })}
                </a>
              </>
            )}
            <LeadChip service={service} locale={locale} />
            <div style={s('font-size: 12.5px; line-height: 1.55; color: #9aa3ad; text-align: center')}>
              {t('detail.reassurance')}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
