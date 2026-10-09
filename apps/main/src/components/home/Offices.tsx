import type { Locale } from '@dpl/core';
import { getContent } from '@dpl/i18n';
import { s } from '@dpl/ui';
import { getTranslations } from 'next-intl/server';
import { Ltr } from '@/components/shell/Ltr';

/** "Our offices": Tel Aviv and Jerusalem with address, phones and a map link. Text and map URLs come from the offices content. */
export async function Offices({ locale }: { locale: Locale }) {
  const t = await getTranslations('home');
  const { offices } = getContent(locale);

  return (
    <div data-pad style={s('margin: 0 auto; padding: 88px clamp(20px, 4.6vw, 120px) 0')}>
      <div style={s('border-top: 1px solid #ece6dc; padding-top: 44px')}>
        <div style={s('font-size: 12px; font-weight: 600; letter-spacing: 0.18em; text-transform: uppercase; color: #a07a3c; margin-bottom: 22px')}>
          {t('offices.eyebrow')}
        </div>
        <div data-resp="2" style={s('display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: clamp(24px, 4vw, 64px)')}>
          {offices.map((o) => (
            <div key={o.city} style={s('border-top: 1px solid #14202b; padding-top: 24px')}>
              <h3
                style={s("font-family: 'Newsreader', Georgia, serif; font-size: clamp(26px, 2.4vw, 34px); font-weight: 400; line-height: 1.1; letter-spacing: normal; color: #14202b; margin: 0 0 14px")}
              >
                {o.city}
              </h3>
              <address style={s('font-style: normal; font-size: 16px; line-height: 1.7; color: #736d64; margin: 0 0 14px; max-width: 44ch')}>{o.address}</address>
              <div style={s('display: flex; gap: 22px; flex-wrap: wrap; align-items: baseline')}>
                <a href={o.telHref} style={s('font-size: 17px; font-weight: 600; text-decoration: none')}>
                  <Ltr>{o.tel}</Ltr>
                </a>
                <span style={s('font-size: 14.5px; color: #736d64')}>{t.rich('offices.also', { tel: o.tel2, n: (chunks) => <Ltr>{chunks}</Ltr> })}</span>
                <a href={o.map} target="_blank" rel="noopener" style={s('font-size: 14.5px')}>
                  {t('offices.map')}
                </a>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
