import { s } from '@dpl/ui';
import { getTranslations } from 'next-intl/server';

/** "Six stages. One of them is yours.": the timeline of a case. The second stage, the only one the client acts in, is filled. */
export async function Stages() {
  const t = await getTranslations('home');
  const stages = t.raw('stages.items') as Array<{ title: string; short: string }>;

  return (
    <div data-pad style={s('margin: 0 auto; padding: 96px clamp(20px, 4.6vw, 120px) 0')}>
      <div style={s('border-top: 1px solid #14202b; padding-top: 40px')}>
        <div
          data-resp="2"
          style={s('display: grid; grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.1fr); gap: clamp(24px, 4vw, 72px); align-items: end; margin-bottom: 48px')}
        >
          <div>
            <div style={s('font-size: 12px; font-weight: 600; letter-spacing: 0.18em; text-transform: uppercase; color: #a07a3c; margin-bottom: 22px')}>
              {t('stages.eyebrow')}
            </div>
            <h2
              data-big
              style={s("font-family: 'Newsreader', Georgia, serif; font-weight: 400; font-size: clamp(30px, 3.6vw, 54px); line-height: 1.06; letter-spacing: -0.02em; color: #14202b; margin: 0; max-width: 17ch")}
            >
              {t('stages.title')}
            </h2>
          </div>
          <p style={s('font-size: 17.5px; line-height: 1.7; color: #55606b; margin: 0; max-width: 46ch')}>{t('stages.lede')}</p>
        </div>
        <div style={s('position: relative')}>
          <div data-steps-line style={s('position: absolute; top: 9px; left: 0; right: 0; height: 1px; background: #d3c8b6')} />
          <ol
            data-steps
            style={s('display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 0 20px; position: relative; list-style: none; margin: 0; padding: 0')}
          >
            {stages.map((stage, i) => (
              <li key={stage.title}>
                <span
                  aria-hidden="true"
                  style={s(`display: block; width: 19px; height: 19px; border-radius: 50%; border: 1px solid #a07a3c; background: ${i === 1 ? '#a07a3c' : '#f8f5f0'}`)}
                />
                <div style={s('font-size: 12px; font-weight: 700; letter-spacing: 0.14em; color: #a07a3c; margin: 22px 0 8px')}>{String(i + 1).padStart(2, '0')}</div>
                <h3
                  style={s("font-family: 'Newsreader', Georgia, serif; font-size: 21px; font-weight: 400; line-height: 1.2; letter-spacing: normal; color: #14202b; margin: 0 0 8px")}
                >
                  {stage.title}
                </h3>
                <p style={s('font-size: 14px; line-height: 1.6; color: #736d64; margin: 0')}>{stage.short}</p>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
}
