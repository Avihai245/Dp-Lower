import { s } from '@dpl/ui';
import { getTranslations } from 'next-intl/server';
import { Eyebrow, PAD } from './kit';

/** "Why Decker Pex Levi": four reasons in two columns. */
export async function WhyUs() {
  const t = await getTranslations('landingMore.why');
  const items = t.raw('items') as Array<{ title: string; body: string }>;
  return (
    <section aria-labelledby="why-title" style={s('background:#ece6dc')}>
      <div data-pad style={s(`max-width:100%;margin:0 auto;padding:88px ${PAD}`)}>
        <Eyebrow>{t('eyebrow')}</Eyebrow>
        <h2
          id="why-title"
          data-big
          style={s(
            "font-family:'Newsreader',Georgia,serif;font-weight:400;font-size:clamp(32px,3.6vw,54px);line-height:1.1;letter-spacing:-0.015em;color:#14202b;margin:0 0 44px;max-width:20ch",
          )}
        >
          {t('title')}
        </h2>
        <div data-resp="2" data-stagger style={s('display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:8px 80px')}>
          {items.map((item, i) => (
            <div
              key={item.title}
              style={s('display:grid;grid-template-columns:52px minmax(0,1fr);gap:22px;padding:34px 0;border-top:1px solid rgba(20,32,43,0.14)')}
            >
              <span
                aria-hidden="true"
                style={s("font-family:'Newsreader',Georgia,serif;font-size:22px;color:#a07a3c;padding-top:4px")}
              >
                {String(i + 1).padStart(2, '0')}
              </span>
              <div>
                <h3
                  style={s(
                    "font-family:'Newsreader',Georgia,serif;font-weight:400;font-size:clamp(23px,2vw,30px);line-height:1.2;letter-spacing:normal;color:#14202b;margin:0",
                  )}
                >
                  {item.title}
                </h3>
                <p style={s('font-size:16.5px;line-height:1.7;color:#736d64;margin:12px 0 0;max-width:44ch')}>{item.body}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
