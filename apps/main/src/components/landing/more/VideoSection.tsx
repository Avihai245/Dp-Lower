import { s } from '@dpl/ui';
import { getTranslations } from 'next-intl/server';
import { Eyebrow, PAD } from './kit';
import { VideoPlayer } from './VideoPlayer';

/** "In our own words": the firm's explainer video on the navy band. */
export async function VideoSection() {
  const t = await getTranslations('landingMore.video');
  return (
    <section aria-labelledby="video-title" data-lm-dark style={s('background:#14202b;color:#f8f5f0')}>
      <div data-pad style={s(`max-width:100%;margin:0 auto;padding:88px ${PAD}`)}>
        <div
          data-resp="2"
          style={s('display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:72px;align-items:end;margin-bottom:52px')}
        >
          <div>
            <Eyebrow tone="soft">{t('eyebrow')}</Eyebrow>
            <h2
              id="video-title"
              data-big
              style={s(
                "font-family:'Newsreader',Georgia,serif;font-weight:400;font-size:clamp(32px,3.4vw,52px);line-height:1.1;letter-spacing:-0.015em;color:#f8f5f0;margin:0;max-width:20ch",
              )}
            >
              {t('title')}
            </h2>
          </div>
          <p style={s('font-size:18px;line-height:1.75;color:rgba(248,245,240,0.64);margin:0;max-width:42ch')}>{t('lede')}</p>
        </div>
        <VideoPlayer playLabel={t('play')} iframeTitle={t('iframeTitle')} />
      </div>
    </section>
  );
}
