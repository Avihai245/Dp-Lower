import { s, x } from '@dpl/ui';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { FIRM } from '@/lib/firm';

/** "One more step" band that closes the contact page, which has its own form and therefore no lead band. */
export async function CloseBand() {
  const t = await getTranslations('site');
  return (
    <section style={s('background: #efe9df; border-top: 1px solid #ded7ca; margin-top: 88px')}>
      <div data-pad style={s('margin: 0 auto; padding: 64px clamp(20px, 4.6vw, 120px) 68px')}>
        <div
          data-resp="2"
          style={s('display: grid; grid-template-columns: minmax(0, 1.1fr) minmax(0, 0.9fr); gap: clamp(28px, 4vw, 64px); align-items: center')}
        >
          <div>
            <div style={s('font-size: 12px; font-weight: 600; letter-spacing: 0.18em; text-transform: uppercase; color: #7a5c2c; margin-bottom: 18px')}>
              {t('closeBand.eyebrow')}
            </div>
            <h2
              data-big
              style={s("font-family: 'Newsreader', Georgia, serif; font-weight: 400; font-size: clamp(28px, 3.2vw, 44px); line-height: 1.1; letter-spacing: -0.018em; color: #14202b; margin: 0 0 14px; max-width: 24ch")}
            >
              {t('closeBand.title')}
            </h2>
            <p style={s('font-size: 17px; line-height: 1.7; color: #55606b; margin: 0; max-width: 52ch')}>{t('closeBand.lede')}</p>
          </div>
          <div style={s('display: flex; gap: 14px; flex-wrap: wrap')}>
            <Link
              href="/contact"
              {...x(
                "display: inline-flex; align-items: center; justify-content: center; background: #14202b; color: #f8f5f0; border: 1px solid #14202b; cursor: pointer; font-family: 'Manrope', system-ui, sans-serif; font-size: 15.5px; font-weight: 700; letter-spacing: 0.05em; padding: 18px 28px; transition: background 180ms ease; border-radius: 999px; line-height: normal; text-decoration: none",
                { hover: 'background: #22323f' },
              )}
            >
              {t('closeBand.consult')}
            </Link>
            <a
              href={FIRM.telAvivHref}
              {...x(
                'background: transparent; color: #14202b; text-decoration: none; border: 1px solid #14202b; font-size: 15.5px; font-weight: 600; letter-spacing: 0.05em; padding: 17px 27px; display: inline-block; transition: background 180ms ease; border-radius: 999px',
                { hover: 'background: rgba(20,32,43,0.06)' },
              )}
            >
              {t.rich('closeBand.call', { phone: t('phones.telAviv'), n: (chunks) => <bdi>{chunks}</bdi> })}
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
