import type { Locale } from '@dpl/core';
import { getContent, type TeamMember } from '@dpl/i18n';
import { s, x } from '@dpl/ui';
import { getTranslations } from 'next-intl/server';
import Image from 'next/image';
import { Link } from '@/i18n/navigation';
import { Ltr } from '@/components/shell/Ltr';
import { FIRM } from './firm';
import { initialsOf } from './team';
import { SANS, SERIF } from './tokens';
import { BackArrow, Eyebrow, H1, LinkButton, PageFade, Pad } from './ui';

/** Practice areas of a person: the services whose team lists them (the prototype's reverse lookup). */
export function practiceAreasOf(locale: Locale, slug: string) {
  return getContent(locale).services.filter((service) => service.team.includes(slug));
}

export async function AttorneyPage({ locale, member }: { locale: Locale; member: TeamMember }) {
  const t = await getTranslations({ locale, namespace: 'pages' });
  const areas = practiceAreasOf(locale, member.slug);
  const bio = member.bio || t('attorney.bioFallback', { role: member.role });

  return (
    <PageFade>
      <Pad top={64} hero>
        <LinkButton href="/team">
          <BackArrow /> {t('attorney.back')}
        </LinkButton>
        <div
          data-resp="2"
          style={s(
            'display: grid; grid-template-columns: minmax(0, 0.7fr) minmax(0, 1.3fr); gap: clamp(28px, 4vw, 72px); align-items: start; margin-top: 30px',
          )}
        >
          <div>
            {member.photo ? (
              <div
                style={s(
                  'position: relative; width: 100%; aspect-ratio: 3 / 4; overflow: hidden; background-color: #efe9df',
                )}
              >
                <Image
                  src={member.photo}
                  alt={member.name}
                  fill
                  priority
                  sizes="(max-width: 1080px) 90vw, 36vw"
                  style={{ objectFit: 'cover', objectPosition: 'center 22%' }}
                />
              </div>
            ) : (
              <div
                role="img"
                aria-label={member.name}
                style={s(
                  `width: 100%; aspect-ratio: 3 / 4; background: #14202b; display: grid; place-items: center; font-family: ${SERIF}; font-size: 72px; color: #c9a45c`,
                )}
              >
                {initialsOf(member.name)}
              </div>
            )}
          </div>
          <div>
            <Eyebrow>{member.dept}</Eyebrow>
            <H1 css="max-width: 18ch">{member.name}</H1>
            <div
              style={s(
                'font-size: 15px; font-weight: 600; letter-spacing: 0.04em; color: #a07a3c; margin: 14px 0 26px',
              )}
            >
              {member.role}
            </div>
            <p
              style={s(
                'font-size: 18px; line-height: 1.75; color: #55606b; margin: 0 0 28px; max-width: 58ch',
              )}
            >
              {bio}
            </p>
            <div style={s('display: flex; gap: 14px; flex-wrap: wrap; align-items: center')}>
              <Link
                href="/contact"
                {...x(
                  `display: inline-block; line-height: normal; text-decoration: none; background: #14202b; color: #f8f5f0; border: 1px solid #14202b; cursor: pointer; font-family: ${SANS}; font-size: 15.5px; font-weight: 700; letter-spacing: 0.05em; padding: 18px 30px; transition: background 180ms ease; border-radius: 999px`,
                  { hover: 'background: #22323f' },
                )}
              >
                {t('attorney.cta')}
              </Link>
              <a href={FIRM.mobile.href} style={s('font-size: 15.5px; text-decoration: none')}>
                <Ltr>{FIRM.mobile.display}</Ltr>
              </a>
              {member.linkedin && (
                <a href={member.linkedin} target="_blank" rel="noopener" style={s('font-size: 15.5px')}>
                  {t('attorney.linkedin')}
                </a>
              )}
            </div>
            {areas.length > 0 && (
              <div style={s('border-top: 1px solid #ece6dc; margin-top: 40px; padding-top: 26px')}>
                <Eyebrow as="h2" strong mb={14}>
                  {t('attorney.practiceAreas')}
                </Eyebrow>
                <ul
                  style={s(
                    'display: flex; flex-wrap: wrap; gap: 10px; list-style: none; margin: 0; padding: 0',
                  )}
                >
                  {areas.map((service) => (
                    <li key={service.slug}>
                      <Link
                        href={`/services/${service.slug}`}
                        {...x(
                          `display: inline-block; line-height: normal; text-decoration: none; border: 1px solid #d8cfc0; border-radius: 999px; background: transparent; padding: 9px 16px; font-size: 14px; color: #14202b; cursor: pointer; font-family: ${SANS}`,
                          { hover: 'border-color: #14202b' },
                        )}
                      >
                        {service.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </Pad>
    </PageFade>
  );
}
