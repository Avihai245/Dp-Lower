import { s } from '@dpl/ui';
import { getTranslations } from 'next-intl/server';
import { EligibilityLink, Eyebrow, PAD, Rating } from './kit';
import { AdvisorButton } from './open-buttons';

/** The closing call to action on the navy band. */
export async function FinalCta() {
  const t = await getTranslations('landingMore');
  return (
    <section aria-labelledby="final-cta-title" data-lm-dark style={s('background:#14202b;color:#f8f5f0')}>
      <div data-pad style={s(`max-width:100%;margin:0 auto;padding:104px ${PAD}`)}>
        <div data-stagger style={s('max-width:1000px')}>
          <Eyebrow tone="bright">{t('finalCta.eyebrow')}</Eyebrow>
          <h2
            id="final-cta-title"
            data-big
            style={s(
              "font-family:'Newsreader',Georgia,serif;font-weight:400;font-size:clamp(40px,5.2vw,88px);line-height:1.03;letter-spacing:-0.024em;color:#f8f5f0;margin:0 0 28px;max-width:22ch;text-wrap:balance",
            )}
          >
            {t('finalCta.title')}
          </h2>
          <p
            style={s(
              "font-family:'Manrope',system-ui,sans-serif;font-size:20px;line-height:1.7;color:rgba(248,245,240,0.7);margin:0 0 44px;max-width:50ch",
            )}
          >
            {t('finalCta.lede')}
          </p>
          <div data-actions style={s('display:flex;align-items:flex-start;gap:22px;flex-wrap:wrap;margin-bottom:34px')}>
            <EligibilityLink
              css="background:#f8f5f0;color:#14202b;font-family:'Manrope',system-ui,sans-serif;font-weight:600;font-size:16.5px;letter-spacing:0.06em;text-transform:uppercase;height:66px;padding:0 44px;display:inline-flex;align-items:center;justify-content:center;border-radius:12px;transition:background 200ms ease, transform 200ms ease"
              hover="background:#fff;transform:translateY(-1px)"
            >
              {t('cta.check')}
            </EligibilityLink>
            <AdvisorButton
              css="background:transparent;color:#f8f5f0;border:1px solid rgba(248,245,240,0.42);font-family:'Manrope',system-ui,sans-serif;font-weight:600;font-size:15px;letter-spacing:0.05em;text-transform:uppercase;height:66px;padding:0 30px;display:inline-flex;align-items:center;justify-content:center;border-radius:12px;transition:border-color 200ms ease, background 200ms ease"
              hover="border-color:#f8f5f0;background:rgba(248,245,240,0.1)"
            >
              {t('cta.advisor')}
            </AdvisorButton>
          </div>
          <div
            style={s('display:flex;align-items:center;gap:32px;flex-wrap:wrap;padding-top:30px;border-top:1px solid rgba(248,245,240,0.18)')}
          >
            <Rating tone="dark" value={t('rating.value')} reviews={t('rating.reviews')} />
            <span
              style={s("font-family:'Manrope',system-ui,sans-serif;font-size:14.5px;color:rgba(248,245,240,0.6)")}
            >
              {t('finalCta.assurance')}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
