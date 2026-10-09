import type { Locale } from '@dpl/core';
import { s } from '@dpl/ui';
import { getTranslations } from 'next-intl/server';
import { ChannelThumbnail } from './ChannelThumbnail';
import { FIRM } from './firm';
import { SERIF } from './tokens';
import { Eyebrow, H1, PageFade, Pad } from './ui';

interface PressItem {
  title: string;
  note: string;
}

export async function MediaPage({ locale }: { locale: Locale }) {
  const t = await getTranslations({ locale, namespace: 'pages' });
  const press = t.raw('media.press') as PressItem[];

  return (
    <PageFade>
      <Pad top={76} hero>
        <div
          data-resp="2"
          style={s(
            'display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: clamp(28px, 4vw, 72px); align-items: end; margin-bottom: 48px',
          )}
        >
          <div>
            <Eyebrow>{t('media.eyebrow')}</Eyebrow>
            <H1>{t('media.title')}</H1>
          </div>
          <p style={s('font-size: 18px; line-height: 1.75; color: #55606b; margin: 0; max-width: 56ch')}>
            {t('media.lead')}
          </p>
        </div>

        <a
          href={FIRM.youtube.channel}
          target="_blank"
          rel="noopener"
          style={s('display: block; position: relative; text-decoration: none')}
        >
          <span
            style={s(
              'display: block; position: relative; width: 100%; aspect-ratio: 21 / 9; overflow: hidden; background: #0d161e',
            )}
          >
            <ChannelThumbnail src={FIRM.youtube.thumbnail} sizes="(max-width: 720px) 100vw, 91vw" />
          </span>
          <span
            style={s(
              'position: absolute; inset: 0; background: linear-gradient(to top, rgba(20,32,43,0.78) 0%, rgba(20,32,43,0.05) 60%); display: block',
            )}
          />
          <span
            style={s(
              'position: absolute; left: clamp(20px, 3vw, 40px); right: clamp(20px, 3vw, 40px); bottom: clamp(20px, 3vw, 36px); color: #f8f5f0; display: flex; align-items: center; gap: 18px',
            )}
          >
            <span
              aria-hidden="true"
              style={s(
                'width: 54px; height: 54px; border: 1px solid rgba(248,245,240,0.6); border-radius: 50%; display: grid; place-items: center; flex: none',
              )}
            >
              <svg width="16" height="18" viewBox="0 0 14 16" fill="#f8f5f0" focusable="false">
                <path d="M0 0l14 8-14 8z" />
              </svg>
            </span>
            <span style={s(`font-family: ${SERIF}; font-size: clamp(22px, 2.4vw, 34px); line-height: 1.2`)}>
              {t('media.channelLabel')}
            </span>
          </span>
        </a>

        <div style={s('border-top: 1px solid #ece6dc; margin-top: 56px; padding-top: 34px')}>
          <Eyebrow as="h2" strong>
            {t('media.pressEyebrow')}
          </Eyebrow>
          <ul
            data-resp="2"
            style={s(
              'display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0 clamp(28px, 4vw, 64px); list-style: none; margin: 0; padding: 0',
            )}
          >
            {press.map((item) => (
              <li key={item.title} style={s('border-top: 1px solid #ece6dc; padding: 16px 0')}>
                <div style={s('font-size: 17px; line-height: 1.4; color: #14202b; font-weight: 500')}>
                  {item.title}
                </div>
                <div style={s('font-size: 13px; color: #736d64; margin-top: 4px')}>{item.note}</div>
              </li>
            ))}
          </ul>
          <p style={s('font-size: 12.5px; line-height: 1.55; color: #9c958a; margin: 18px 0 0')}>
            {t('media.pressNotice')}
          </p>
        </div>
      </Pad>
    </PageFade>
  );
}
