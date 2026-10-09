import { s } from '@dpl/ui';
import { getTranslations } from 'next-intl/server';
import { Eyebrow, PAD } from './kit';

/** "How the eligibility check works": three numbered steps. */
export async function Process() {
  const t = await getTranslations('landingMore.process');
  const steps = t.raw('steps') as Array<{ title: string; body: string }>;
  return (
    <section
      id="process"
      aria-labelledby="process-title"
      data-pad
      style={s(`max-width:100%;margin:0 auto;padding:88px ${PAD} 72px`)}
    >
      <div
        data-resp="2"
        style={s('display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:80px;align-items:end;margin-bottom:64px')}
      >
        <div>
          <Eyebrow>{t('eyebrow')}</Eyebrow>
          <h2
            id="process-title"
            data-big
            style={s(
              "font-family:'Newsreader',Georgia,serif;font-weight:400;font-size:clamp(34px,3.8vw,58px);line-height:1.08;letter-spacing:-0.018em;color:#14202b;margin:0;max-width:18ch",
            )}
          >
            {t('title')}
          </h2>
        </div>
        <p style={s('font-size:18.5px;line-height:1.75;color:#736d64;margin:0;max-width:44ch')}>{t('lede')}</p>
      </div>
      <ol
        role="list"
        data-resp="3"
        data-stagger
        style={s('display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:48px;position:relative;list-style:none;margin:0;padding:0')}
      >
        {steps.map((step, i) => (
          <li key={step.title} style={s('position:relative')}>
            <div style={s('display:flex;align-items:center;gap:18px;margin-bottom:26px')}>
              <span
                aria-hidden="true"
                style={s("font-family:'Newsreader',Georgia,serif;font-size:clamp(34px,2.6vw,52px);line-height:1;color:#a07a3c")}
              >
                {String(i + 1).padStart(2, '0')}
              </span>
              <span aria-hidden="true" style={s('flex:1;height:1px;background:#ece6dc')} />
            </div>
            <h3
              style={s(
                "font-family:'Newsreader',Georgia,serif;font-weight:400;font-size:27px;line-height:1.2;letter-spacing:normal;color:#14202b;margin:0 0 12px;max-width:18ch",
              )}
            >
              {step.title}
            </h3>
            <p style={s('font-size:16.5px;line-height:1.7;color:#736d64;margin:0;max-width:34ch')}>{step.body}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
