import { s } from '@dpl/ui';
import { getTranslations } from 'next-intl/server';
import Image from 'next/image';
import { Kicker } from './primitives';

interface Person {
  name: string;
  role: string;
  bio: string;
}
interface Credential {
  name: string;
  note: string;
}

/** Photographs, in the order of the `people` messages (Anat Levi, Michael Decker, Yehoshua Pex). */
const PHOTOS = ['/images/anat-levi.webp', '/images/michael-decker.webp', '/images/joshua-pex.webp'];

/** "Our team": the three attorneys, the ranking line and the admissions and memberships grid. */
export async function Attorneys() {
  const t = await getTranslations('landing.attorneys');
  const people = t.raw('people') as Person[];
  const credentials = t.raw('credentials') as Credential[];
  return (
    <section
      aria-labelledby="attorneys-title"
      data-pad
      style={s('max-width: 100%; margin: 0 auto; padding: 76px clamp(20px, 4.6vw, 160px) 0')}
    >
      <div style={s('border-top: 1px solid #ece6dc; padding-top: 46px')}>
        <div
          data-resp="2"
          style={s(
            'display: grid; grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.1fr); gap: clamp(32px, 4vw, 72px); align-items: end; margin-bottom: 44px',
          )}
        >
          <div>
            <Kicker>{t('kicker')}</Kicker>
            <h2
              id="attorneys-title"
              data-big
              style={s(
                "font-family: 'Newsreader', Georgia, serif; font-weight: 400; font-size: clamp(32px, 3.4vw, 52px); line-height: 1.1; letter-spacing: -0.015em; color: #14202b; margin: 0; max-width: 20ch",
              )}
            >
              {t('title')}
            </h2>
          </div>
          <p style={s('font-size: 17.5px; line-height: 1.7; color: #736d64; margin: 0; max-width: 50ch')}>
            {t('intro')}
          </p>
        </div>
        <div
          data-resp="3"
          data-two-up
          data-stagger
          style={s('display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 28px')}
        >
          {people.map((p, i) => {
            const photo = PHOTOS[i];
            return (
              <div
                key={p.name}
                style={s('border: 1px solid #ece6dc; background: #fff; padding: 26px 26px 28px')}
              >
                <div
                  style={s(
                    'position: relative; aspect-ratio: 3 / 4; height: auto; max-height: 520px; background: #ece6dc; display: grid; place-items: center; margin-bottom: 22px; overflow: hidden',
                  )}
                >
                  {photo ? (
                    <Image
                      src={photo}
                      alt={p.name}
                      fill
                      sizes="(max-width: 640px) 100vw, (max-width: 960px) 50vw, 30vw"
                      style={s('object-fit: cover; object-position: 50% 20%; display: block')}
                    />
                  ) : (
                    <span
                      style={s(
                        'font-size: 12.5px; letter-spacing: 0.12em; text-transform: uppercase; color: #736d64',
                      )}
                    >
                      {t('photoToCome')}
                    </span>
                  )}
                </div>
                <h3
                  style={s(
                    "font-family: 'Newsreader', Georgia, serif; font-weight: 400; letter-spacing: normal; font-size: 25px; line-height: 1.2; color: #14202b; margin: 0",
                  )}
                >
                  {p.name}
                </h3>
                <div
                  style={s(
                    'font-size: 13.5px; font-weight: 600; letter-spacing: 0.06em; color: #a07a3c; margin: 8px 0 18px',
                  )}
                >
                  {p.role}
                </div>
                <p style={s('font-size: 15.5px; line-height: 1.7; color: #736d64; margin: 0')}>{p.bio}</p>
              </div>
            );
          })}
        </div>
        <p style={s('font-size: 15px; line-height: 1.6; color: #14202b; margin: 30px 0 0')}>{t('ranking')}</p>

        <div style={s('border-top: 1px solid #ece6dc; margin-top: 38px; padding-top: 30px')}>
          <div
            style={s(
              'font-size: 11.5px; font-weight: 600; letter-spacing: 0.18em; text-transform: uppercase; color: #a07a3c; margin-bottom: 22px',
            )}
          >
            {t('credentialsTitle')}
          </div>
          <div
            data-resp="4"
            data-two-up
            style={s('display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 20px')}
          >
            {credentials.map((c) => (
              <div
                key={c.name}
                style={s(
                  'border: 1px solid #ece6dc; padding: 20px 22px; min-height: 92px; display: flex; flex-direction: column; justify-content: center',
                )}
              >
                <div
                  style={s(
                    "font-family: 'Manrope', system-ui, sans-serif; font-size: 15.5px; line-height: 1.35; color: #14202b",
                  )}
                >
                  {c.name}
                </div>
                <div style={s('font-size: 12.5px; color: #736d64; margin-top: 6px')}>{c.note}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
