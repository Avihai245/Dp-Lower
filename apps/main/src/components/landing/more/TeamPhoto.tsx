import { s } from '@dpl/ui';
import Image from 'next/image';
import { getTranslations } from 'next-intl/server';
import { EligibilityLink, Eyebrow, PAD } from './kit';

/** "Who you are trusting": the team photograph, the second photograph and the short promise next to them. */
export async function TeamPhoto() {
  const t = await getTranslations('landingMore');
  return (
    <section id="team" aria-labelledby="team-title" data-pad style={s(`max-width:100%;margin:0 auto;padding:88px ${PAD}`)}>
      <div
        data-resp="2"
        style={s('display:grid;grid-template-columns:minmax(0,0.82fr) minmax(0,1.18fr);gap:clamp(40px,5vw,84px);align-items:center')}
      >
        <div>
          <Eyebrow>{t('team.eyebrow')}</Eyebrow>
          <h2
            id="team-title"
            data-big
            style={s(
              "font-family:'Newsreader',Georgia,serif;font-weight:400;font-size:clamp(34px,3.4vw,52px);line-height:1.08;letter-spacing:-0.015em;color:#14202b;margin:0 0 26px;max-width:18ch",
            )}
          >
            {t('team.title')}
          </h2>
          <p style={s('font-size:18px;line-height:1.75;color:#736d64;margin:0 0 20px;max-width:46ch')}>{t('team.p1')}</p>
          <p style={s('font-size:18px;line-height:1.75;color:#736d64;margin:0 0 32px;max-width:46ch')}>{t('team.p2')}</p>
          <EligibilityLink
            css="background:#14202b;color:#f8f5f0;font-family:'Manrope',system-ui,sans-serif;font-weight:600;font-size:15.5px;letter-spacing:0.06em;text-transform:uppercase;padding:19px 36px;border-radius:12px;transition:background 200ms ease, transform 200ms ease"
            hover="background:#1e2f3f;transform:translateY(-1px)"
          >
            {t('cta.check')}
          </EligibilityLink>
        </div>
        <div>
          <Image
            data-reveal-img
            src="/images/Decker-Pex-Levi-Team-scaled.jpg.webp"
            alt={t('team.photoAlt')}
            width={2560}
            height={1707}
            sizes="(max-width: 960px) 100vw, 56vw"
            style={{ width: '100%', height: 'auto', aspectRatio: '2560 / 1707', display: 'block' }}
          />
          <div style={s('display:flex;align-items:flex-start;gap:24px;flex-wrap:wrap;margin-top:18px')}>
            <Image
              data-reveal-img
              src="/images/team-outside.webp"
              alt={t('team.outsideAlt')}
              width={700}
              height={427}
              sizes="300px"
              style={{ width: '300px', maxWidth: '100%', height: 'auto', aspectRatio: '700 / 427', display: 'block' }}
            />
            <p style={s('flex:1;min-width:200px;font-size:13px;line-height:1.65;color:#736d64;margin:0')}>{t('team.caption')}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
