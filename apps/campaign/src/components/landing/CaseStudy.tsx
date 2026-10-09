import { s } from '@dpl/ui';
import { getTranslations } from 'next-intl/server';
import { Kicker } from './primitives';

interface Part {
  label: string;
  text: string;
}

/** "One case in full": a navy band with an illustrative Austrian case told in three parts. */
export async function CaseStudy() {
  const t = await getTranslations('landing.caseStudy');
  const parts = t.raw('parts') as Part[];
  return (
    <section
      aria-labelledby="case-title"
      className="dpl-dark"
      style={s('background: #14202b; color: #f8f5f0; margin-top: 84px')}
    >
      <div
        data-pad
        data-resp="2"
        style={s(
          'max-width: 100%; margin: 0 auto; padding: 104px clamp(20px, 4.6vw, 160px); display: grid; grid-template-columns: minmax(0, 0.85fr) minmax(0, 1.15fr); gap: clamp(40px, 5vw, 88px); align-items: start',
        )}
      >
        <div>
          <Kicker tone="gold">{t('kicker')}</Kicker>
          <h2
            id="case-title"
            data-big
            style={s(
              "font-family: 'Newsreader', Georgia, serif; font-weight: 400; font-size: clamp(30px, 3vw, 46px); line-height: 1.1; letter-spacing: -0.015em; color: #f8f5f0; margin: 0 0 20px; max-width: 20ch",
            )}
          >
            {t('title')}
          </h2>
          <div style={s('font-size: 15px; line-height: 1.7; color: rgba(248,245,240,0.6)')}>{t('who')}</div>
        </div>
        <div style={s('display: flex; flex-direction: column; gap: 0')}>
          {parts.map((p) => (
            <div
              key={p.label}
              data-num-row
              style={s(
                'display: grid; grid-template-columns: 118px minmax(0, 1fr); gap: 26px; padding: 24px 0; border-top: 1px solid rgba(248,245,240,0.18)',
              )}
            >
              <span
                style={s(
                  'font-size: 11.5px; font-weight: 600; letter-spacing: 0.14em; text-transform: uppercase; color: #d3ae6b; padding-top: 5px',
                )}
              >
                {p.label}
              </span>
              <span style={s('font-size: 17.5px; line-height: 1.65; color: rgba(248,245,240,0.9)')}>
                {p.text}
              </span>
            </div>
          ))}
          <p
            style={s(
              'font-size: 12.5px; line-height: 1.6; color: rgba(248,245,240,0.62); margin: 22px 0 0; max-width: 70ch',
            )}
          >
            {t('disclaimer')}
          </p>
        </div>
      </div>
    </section>
  );
}
