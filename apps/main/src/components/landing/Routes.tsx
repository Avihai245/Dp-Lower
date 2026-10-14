import { s, x } from '@dpl/ui';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { Kicker } from './primitives';

interface RouteItem {
  kicker: string;
  country: string;
  title: string;
  body: string;
}

/** "Two routes" (#paths): the German and the Austrian route, each a card that starts the eligibility check. */
export async function Routes() {
  const t = await getTranslations('landing.routes');
  const items = t.raw('items') as RouteItem[];
  return (
    <section
      id="paths"
      aria-labelledby="routes-title"
      data-pad
      style={s('max-width: 100%; margin: 0 auto; padding: 0 clamp(20px, 4.6vw, 160px) 40px')}
    >
      <Kicker>{t('kicker')}</Kicker>
      <h2
        id="routes-title"
        data-big
        style={s(
          "font-family: 'Newsreader', Georgia, serif; font-weight: 400; font-size: clamp(32px, 3.4vw, 52px); line-height: 1.1; letter-spacing: -0.015em; color: #14202b; margin: 0 0 48px; max-width: 24ch",
        )}
      >
        {t('title')}
      </h2>
      <div
        data-resp="2"
        data-stagger
        style={s('display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 28px')}
      >
        {items.map((r, k) => (
          <Link
            key={r.country}
            href="/eligibility"
            {...x(
              // the prototype's <button> has line-height: normal, which the text spans inherit; a link needs it said
              `text-align: left; cursor: pointer; font-family: 'Manrope', system-ui, sans-serif; line-height: normal; display: flex; flex-direction: column; padding: clamp(38px, 3.6vw, 60px) clamp(30px, 3vw, 52px); border: 1px solid #ece6dc; border-radius: 12px; transition: opacity 900ms cubic-bezier(0.16,1,0.3,1), transform 900ms cubic-bezier(0.16,1,0.3,1), box-shadow 260ms ease, border-color 260ms ease; text-decoration: none; background: ${k === 1 ? '#ece6dc' : '#f8f5f0'}; color: #23292f`,
              { hover: 'transform: translateY(-3px); box-shadow: 0 22px 48px rgba(20,32,43,0.12)' },
            )}
          >
            <span
              style={s(
                'font-size: 12.5px; font-weight: 600; letter-spacing: 0.14em; text-transform: uppercase; color: #a07a3c; margin-bottom: 20px',
              )}
            >
              {r.kicker}
            </span>
            <span
              style={s(
                "font-family: 'Newsreader', Georgia, serif; font-size: clamp(40px, 4.4vw, 66px); line-height: 1.02; letter-spacing: -0.022em; color: #14202b; margin-bottom: 20px",
              )}
            >
              {r.country}
            </span>
            <span
              style={s(
                "font-family: 'Newsreader', Georgia, serif; font-size: clamp(20px, 1.7vw, 26px); line-height: 1.25; color: #14202b; margin-bottom: 14px; max-width: 22ch",
              )}
            >
              {r.title}
            </span>
            <span
              style={s(
                'font-size: 16.5px; line-height: 1.7; color: #736d64; max-width: 42ch; margin-bottom: 34px',
              )}
            >
              {r.body}
            </span>
            <span
              style={s(
                'margin-top: auto; font-size: 14px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: #14202b',
              )}
            >
              {t('cta')}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
