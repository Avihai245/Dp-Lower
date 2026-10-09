import { s } from '@dpl/ui';
import Image from 'next/image';
import { getTranslations } from 'next-intl/server';
import { EligibilityLink, PAD, Rating } from './kit';
import { AdvisorButton } from './open-buttons';

/** "Could you qualify?" band with the street photograph. */
export async function CtaBand() {
  const t = await getTranslations('landingMore');
  return (
    <section aria-labelledby="cta-band-title" style={s('background:#ece6dc')}>
      <div
        data-pad
        data-resp="2"
        style={s(
          `max-width:100%;margin:0 auto;padding:104px ${PAD};display:grid;grid-template-columns:minmax(0,1.1fr) minmax(0,0.9fr);gap:72px;align-items:center`,
        )}
      >
        <div>
          <h2
            id="cta-band-title"
            data-big
            style={s(
              "font-family:'Newsreader',Georgia,serif;font-weight:400;font-size:clamp(38px,4.6vw,72px);line-height:1.05;letter-spacing:-0.02em;color:#14202b;margin:0 0 22px;max-width:16ch",
            )}
          >
            {t('ctaBand.title')}
          </h2>
          <p style={s('font-size:19px;line-height:1.7;color:#736d64;margin:0 0 34px;max-width:40ch')}>{t('ctaBand.lede')}</p>
          <div data-actions style={s('display:flex;align-items:flex-start;gap:20px;flex-wrap:wrap')}>
            <EligibilityLink
              css="background:#14202b;color:#f8f5f0;font-family:'Manrope',system-ui,sans-serif;font-weight:600;font-size:17px;letter-spacing:0.06em;text-transform:uppercase;height:64px;padding:0 42px;display:inline-flex;align-items:center;justify-content:center;border-radius:12px;transition:background 200ms ease, transform 200ms ease"
              hover="background:#1e2f3f;transform:translateY(-1px)"
            >
              {t('cta.check')}
            </EligibilityLink>
            <AdvisorButton
              css="background:transparent;color:#14202b;border:1px solid rgba(20,32,43,0.3);font-family:'Manrope',system-ui,sans-serif;font-weight:600;font-size:14px;letter-spacing:0.05em;text-transform:uppercase;height:64px;padding:0 28px;display:inline-flex;align-items:center;justify-content:center;border-radius:12px"
              hover="border-color:#14202b;background:rgba(20,32,43,0.04)"
            >
              {t('cta.advisor')}
            </AdvisorButton>
            <Rating tone="light" value={t('rating.value')} reviews={t('rating.reviews')} />
          </div>
        </div>
        <div style={s('position:relative;aspect-ratio:8 / 5;background:#ded7ca;overflow:hidden')}>
          <Image
            data-reveal-img
            src="/images/pic2.webp"
            alt={t('ctaBand.imageAlt')}
            fill
            sizes="(max-width: 960px) 100vw, 44vw"
            style={{ objectFit: 'cover', objectPosition: '34% 50%' }}
          />
        </div>
      </div>
    </section>
  );
}
