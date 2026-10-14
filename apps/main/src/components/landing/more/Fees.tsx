import { s } from '@dpl/ui';
import { getTranslations } from 'next-intl/server';
import { EligibilityLink, Eyebrow, PAD } from './kit';

/** "What this costs.", with the hairline that separates it from the questions below. */
export async function Fees() {
  const t = await getTranslations('landingMore.fees');
  const items = t.raw('items') as Array<{ title: string; body: string }>;
  return (
    <>
      <section aria-labelledby="fees-title" data-pad style={s(`max-width:100%;margin:0 auto;padding:88px ${PAD} 0`)}>
        <div
          data-resp="2"
          style={s('display:grid;grid-template-columns:minmax(0,0.85fr) minmax(0,1.15fr);gap:clamp(40px,5vw,84px);align-items:start')}
        >
          <div>
            <Eyebrow>{t('eyebrow')}</Eyebrow>
            <h2
              id="fees-title"
              data-big
              style={s(
                "font-family:'Newsreader',Georgia,serif;font-weight:400;font-size:clamp(32px,3.4vw,52px);line-height:1.1;letter-spacing:-0.015em;color:#14202b;margin:0;margin-bottom:22px;max-width:18ch",
              )}
            >
              {t('title')}
            </h2>
            <p style={s('font-size:17.5px;line-height:1.7;color:#736d64;margin:0 0 30px;max-width:44ch')}>{t('lede')}</p>
            <EligibilityLink
              css="background:#14202b;color:#f8f5f0;font-family:'Manrope',system-ui,sans-serif;font-weight:600;font-size:15px;letter-spacing:0.06em;text-transform:uppercase;padding:18px 32px;border-radius:12px"
              hover="background:#1e2f3f"
            >
              {t('cta')}
            </EligibilityLink>
          </div>
          <div style={s('border-top:1px solid #ece6dc')}>
            {items.map((item, i) => (
              <div
                key={item.title}
                style={s('display:grid;grid-template-columns:46px minmax(0,1fr);gap:24px;padding:24px 0;border-bottom:1px solid #ece6dc')}
              >
                <span
                  aria-hidden="true"
                  style={s("font-family:'Manrope',system-ui,sans-serif;font-size:12px;letter-spacing:0.14em;color:#a07a3c;padding-top:6px")}
                >
                  {String(i + 1).padStart(2, '0')}
                </span>
                <div>
                  <h3
                    style={s(
                      "font-family:'Newsreader',Georgia,serif;font-weight:400;font-size:23px;line-height:1.2;letter-spacing:normal;color:#14202b;margin:0",
                    )}
                  >
                    {item.title}
                  </h3>
                  <p style={s('font-size:15.5px;line-height:1.7;color:#736d64;margin:7px 0 0;max-width:62ch')}>{item.body}</p>
                </div>
              </div>
            ))}
            <p style={s('font-size:13px;line-height:1.6;color:#736d64;margin:20px 0 0;max-width:74ch')}>{t('note')}</p>
          </div>
        </div>
      </section>
      <div data-pad aria-hidden="true" style={s(`max-width:100%;margin:0 auto;padding:64px ${PAD} 0`)}>
        <div style={s('height:1px;background:#ece6dc')} />
      </div>
    </>
  );
}
