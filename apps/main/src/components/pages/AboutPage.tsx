import type { Locale } from '@dpl/core';
import { getContent, getMember, type TeamMember } from '@dpl/i18n';
import { s, x } from '@dpl/ui';
import { getTranslations } from 'next-intl/server';
import Image from 'next/image';
import { Link } from '@/i18n/navigation';
import { initialsOf } from './team';
import { SANS, SERIF } from './tokens';
import { Eyebrow, H1, H2Big, LinkButton, PageFade, Pad } from './ui';

/** The partners appear in this order on the page (the content lists them differently). */
const PARTNER_ORDER = ['anat-levi', 'michael-decker', 'joshua-pex'];

interface Point {
  title: string;
  body: string;
}
interface Mark {
  name: string;
  note: string;
}

function partnersOf(locale: Locale): TeamMember[] {
  const listed = PARTNER_ORDER.map((slug) => getMember(locale, slug)).filter((m): m is TeamMember => !!m);
  const others = getContent(locale).team.filter(
    (m) => m.kind === 'partner' && !PARTNER_ORDER.includes(m.slug),
  );
  return [...listed, ...others];
}

export async function AboutPage({ locale }: { locale: Locale }) {
  const t = await getTranslations({ locale, namespace: 'pages' });
  const points = t.raw('about.how.points') as Point[];
  const marks = t.raw('about.recognition.marks') as Mark[];
  const areas = t.raw('about.civil.areas') as string[];
  const partners = partnersOf(locale);

  return (
    <PageFade>
      <Pad top={76} hero>
        <div
          data-resp="2"
          style={s(
            'display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: clamp(28px, 4vw, 72px); align-items: end; margin-bottom: 52px',
          )}
        >
          <div>
            <Eyebrow>{t('about.eyebrow')}</Eyebrow>
            <H1>{t('about.title')}</H1>
          </div>
          <div>
            <p
              style={s(
                'font-size: 18px; line-height: 1.75; color: #55606b; margin: 0 0 18px; max-width: 56ch',
              )}
            >
              {t('about.lead1')}
            </p>
            <p style={s('font-size: 18px; line-height: 1.75; color: #55606b; margin: 0; max-width: 56ch')}>
              {t('about.lead2')}
            </p>
          </div>
        </div>
        <Image
          src="/images/Decker-Pex-Levi-Team-scaled.jpg.webp"
          alt={t('about.photoAlt')}
          width={2560}
          height={1707}
          priority
          sizes="(max-width: 720px) calc(100vw - 36px), 91vw"
          style={{ width: '100%', height: 'auto', display: 'block' }}
        />
      </Pad>

      <Pad top={72}>
        <div
          data-resp="2"
          style={s(
            'display: grid; grid-template-columns: minmax(0, 0.8fr) minmax(0, 1.2fr); gap: clamp(28px, 4vw, 72px); border-top: 1px solid #ece6dc; padding-top: 46px',
          )}
        >
          <div>
            <Eyebrow>{t('about.how.eyebrow')}</Eyebrow>
            <H2Big>{t('about.how.title')}</H2Big>
          </div>
          <dl style={s('display: flex; flex-direction: column; gap: 0; margin: 0')}>
            {points.map((p) => (
              <div
                key={p.title}
                data-kv=""
                style={s(
                  'display: grid; grid-template-columns: minmax(0, 0.8fr) minmax(0, 1.2fr); gap: 20px; padding: 20px 0; border-top: 1px solid #ece6dc',
                )}
              >
                <dt style={s(`font-family: ${SERIF}; font-size: 22px; line-height: 1.25; color: #14202b`)}>
                  {p.title}
                </dt>
                <dd style={s('margin: 0; font-size: 16px; line-height: 1.7; color: #736d64')}>{p.body}</dd>
              </div>
            ))}
          </dl>
        </div>
      </Pad>

      <section style={s('background: #14202b; color: #f8f5f0; margin-top: 80px')}>
        <Pad top={72} style={{ paddingBottom: 76 }}>
          <div
            data-resp="2"
            style={s(
              'display: grid; grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.1fr); gap: clamp(28px, 4vw, 72px); align-items: center',
            )}
          >
            <div>
              <Eyebrow color="#c9a45c">{t('about.recognition.eyebrow')}</Eyebrow>
              <H2Big css="color: #f8f5f0; max-width: 20ch">
                {t.rich('about.recognition.title', { ltr: (chunks) => <bdi>{chunks}</bdi> })}
              </H2Big>
              <p
                style={s(
                  'font-size: 17px; line-height: 1.7; color: #c5cbd2; margin: 18px 0 0; max-width: 52ch',
                )}
              >
                {t('about.recognition.body')}
              </p>
            </div>
            <ul
              data-resp="3"
              style={s(
                'display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; list-style: none; margin: 0; padding: 0',
              )}
            >
              {marks.map((m) => (
                <li
                  key={m.name}
                  style={s(
                    'border: 1px solid rgba(248,245,240,0.22); padding: 24px 20px; min-height: 140px; display: flex; flex-direction: column; justify-content: flex-end',
                  )}
                >
                  <div style={s(`font-family: ${SERIF}; font-size: 26px; line-height: 1.1`)}>{m.name}</div>
                  <div style={s('font-size: 13.5px; line-height: 1.5; color: #9aa3ad; margin-top: 8px')}>
                    {m.note}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </Pad>
      </section>

      <Pad top={80}>
        <div
          data-resp="2"
          style={s(
            'display: grid; grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.1fr); gap: clamp(28px, 4vw, 72px); align-items: end; margin-bottom: 40px',
          )}
        >
          <div>
            <Eyebrow>{t('about.partners.eyebrow')}</Eyebrow>
            <H2Big css="max-width: 20ch">{t('about.partners.title')}</H2Big>
          </div>
          <p style={s('font-size: 17px; line-height: 1.7; color: #736d64; margin: 0; max-width: 52ch')}>
            {t('about.partners.body')} <LinkButton href="/team">{t('about.partners.cta')}</LinkButton>
          </p>
        </div>
        <ul
          data-resp="3"
          style={s(
            'display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: clamp(20px, 2.4vw, 32px); list-style: none; margin: 0; padding: 0',
          )}
        >
          {partners.map((p) => (
            <li key={p.slug} style={s('display: flex')}>
              <Link
                href={`/team/${p.slug}`}
                {...x(
                  `display: block; flex: 1; min-width: 0; line-height: normal; text-align: left; background: #fff; border: 1px solid #ece6dc; padding: 22px 22px 26px; cursor: pointer; font-family: ${SANS}; text-decoration: none; transition: border-color 180ms ease`,
                  { hover: 'border-color: #14202b' },
                )}
              >
                <span
                  style={s(
                    'display: block; position: relative; width: 100%; aspect-ratio: 3 / 4; overflow: hidden; background: #efe9df; margin-bottom: 20px',
                  )}
                >
                  {p.photo ? (
                    <Image
                      src={p.photo}
                      alt=""
                      fill
                      sizes="(max-width: 720px) 90vw, (max-width: 1080px) 45vw, 27vw"
                      style={{ objectFit: 'cover', objectPosition: 'center 22%' }}
                    />
                  ) : (
                    <span
                      aria-hidden="true"
                      style={s(
                        `position: absolute; inset: 0; display: grid; place-items: center; background: #14202b; color: #c9a45c; font-family: ${SERIF}; font-size: 72px`,
                      )}
                    >
                      {initialsOf(p.name)}
                    </span>
                  )}
                </span>
                <span
                  style={s(
                    `display: block; font-family: ${SERIF}; font-size: 25px; line-height: 1.15; color: #14202b`,
                  )}
                >
                  {p.name}
                </span>
                <span
                  style={s(
                    'display: block; font-size: 13.5px; font-weight: 600; letter-spacing: 0.05em; color: #a07a3c; margin-top: 8px',
                  )}
                >
                  {p.role}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </Pad>

      <Pad top={72}>
        <div style={s('border-top: 1px solid #ece6dc; padding-top: 42px')}>
          <Eyebrow as="h2">{t('about.civil.eyebrow')}</Eyebrow>
          <p
            style={s('font-size: 17px; line-height: 1.7; color: #736d64; margin: 0 0 22px; max-width: 70ch')}
          >
            {t('about.civil.intro')}
          </p>
          <ul style={s('display: flex; flex-wrap: wrap; gap: 10px; list-style: none; margin: 0; padding: 0')}>
            {areas.map((area) => (
              <li
                key={area}
                style={s('border: 1px solid #d8cfc0; padding: 9px 14px; font-size: 14px; color: #14202b')}
              >
                {area}
              </li>
            ))}
          </ul>
        </div>
      </Pad>
    </PageFade>
  );
}
