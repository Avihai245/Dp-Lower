import type { Locale } from '@dpl/core';
import { absoluteUrl } from '@dpl/i18n';
import { s } from '@dpl/ui';
import { getLocale, getTranslations } from 'next-intl/server';
import { JsonLd, SITE_URL } from '@/lib/seo';
import { faqJsonLd, type FaqItem } from './faq-jsonld';
import { FaqList } from './FaqList';
import { Eyebrow, PAD } from './kit';

/** "Questions people ask first.": the ten-question accordion plus the matching FAQPage structured data. */
export async function Faq() {
  const t = await getTranslations('landingMore.faq');
  const locale = (await getLocale()) as Locale;
  const items = t.raw('items') as FaqItem[];
  return (
    <section id="faq" aria-labelledby="faq-title" data-pad style={s(`max-width:100%;margin:0 auto;padding:62px ${PAD}`)}>
      <JsonLd data={faqJsonLd(items, { url: absoluteUrl(SITE_URL, locale, '/'), locale })} />
      {/* without JavaScript the buttons do nothing, so show every answer */}
      <noscript>
        <style>{'[data-faq-panel]{display:block}'}</style>
      </noscript>
      <div
        data-resp="2"
        style={s('display:grid;grid-template-columns:minmax(0,0.8fr) minmax(0,1.2fr);gap:clamp(32px,4vw,72px);align-items:end;margin-bottom:40px')}
      >
        <div>
          <Eyebrow>{t('eyebrow')}</Eyebrow>
          <h2
            id="faq-title"
            data-big
            style={s(
              "font-family:'Newsreader',Georgia,serif;font-weight:400;font-size:clamp(30px,3.2vw,48px);line-height:1.12;letter-spacing:-0.015em;color:#14202b;margin:0;max-width:18ch",
            )}
          >
            {t('title')}
          </h2>
        </div>
        <p style={s('font-size:17px;line-height:1.7;color:#736d64;margin:0;max-width:52ch')}>{t('lede')}</p>
      </div>
      <FaqList items={items} />
    </section>
  );
}
