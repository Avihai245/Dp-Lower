import { s } from '@dpl/ui';
import { getTranslations } from 'next-intl/server';
import { Kicker } from './primitives';

interface Benefit {
  title: string;
  body: string;
}

/** "What citizenship can mean": five benefits on navy, numbered 01-05, with the legal caveat underneath. */
export async function Benefits() {
  const t = await getTranslations('landing.benefits');
  const items = t.raw('items') as Benefit[];
  return (
    <section
      aria-labelledby="benefits-title"
      className="dpl-dark"
      style={s('background: #14202b; color: #f8f5f0; border-top: 1px solid rgba(248,245,240,0.16)')}
    >
      <div data-pad style={s('max-width: 100%; margin: 0 auto; padding: 88px clamp(20px, 4.6vw, 160px)')}>
        <div
          data-resp="2"
          style={s(
            'display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 72px; align-items: end; margin-bottom: 52px',
          )}
        >
          <div>
            <Kicker tone="muted">{t('kicker')}</Kicker>
            <h2
              id="benefits-title"
              data-big
              style={s(
                "font-family: 'Newsreader', Georgia, serif; font-weight: 400; font-size: clamp(34px, 3.8vw, 58px); line-height: 1.1; letter-spacing: -0.015em; color: #f8f5f0; margin: 0; max-width: 22ch",
              )}
            >
              {t('title')}
            </h2>
          </div>
          <p
            style={s(
              'font-size: 18.5px; line-height: 1.75; color: rgba(248,245,240,0.66); margin: 0; max-width: 44ch',
            )}
          >
            {t('lead')}
          </p>
        </div>
        <div
          data-resp="5"
          data-stagger
          style={s('display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 40px')}
        >
          {items.map((b, k) => (
            <div key={b.title} style={s('padding-top: 26px; border-top: 1px solid rgba(248,245,240,0.22)')}>
              <div
                style={s(
                  'font-size: 12.5px; font-weight: 600; letter-spacing: 0.14em; color: #c99a3f; margin-bottom: 16px',
                )}
              >{`0${k + 1}`}</div>
              <h3
                style={s(
                  "font-family: 'Newsreader', Georgia, serif; font-weight: 400; letter-spacing: normal; font-size: clamp(22px, 1.9vw, 29px); line-height: 1.15; color: #f8f5f0; margin: 0 0 12px",
                )}
              >
                {b.title}
              </h3>
              <div style={s('font-size: 15.5px; line-height: 1.65; color: rgba(248,245,240,0.6)')}>
                {b.body}
              </div>
            </div>
          ))}
        </div>
        <p
          style={s(
            'font-size: 13.5px; line-height: 1.6; color: rgba(248,245,240,0.42); margin: 56px 0 0; max-width: 78ch',
          )}
        >
          {t('disclaimer')}
        </p>
      </div>
    </section>
  );
}
