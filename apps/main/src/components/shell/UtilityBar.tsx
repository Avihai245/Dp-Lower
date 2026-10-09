import { s } from '@dpl/ui';
import { getTranslations } from 'next-intl/server';
import { FIRM } from '@/lib/shell/firm';
import { Ltr } from './Ltr';
import { LanguageSwitcher } from './LanguageSwitcher';

const LINK = 'color: #c5cbd2; text-decoration: none';

/** Dark strip above the header: both office phones, WhatsApp and the language switch. Hidden on phones. */
export async function UtilityBar() {
  const t = await getTranslations('site');
  return (
    <div data-util role="region" aria-label={t('util.label')} style={s('background: #14202b; color: #c5cbd2')}>
      <div
        data-pad
        style={s('margin: 0 auto; padding: 9px clamp(20px, 4.6vw, 120px); display: flex; align-items: center; gap: 26px; flex-wrap: wrap; font-size: 13px')}
      >
        <a href={FIRM.telAvivHref} style={s(LINK)}>
          {t('util.telAviv')} <Ltr>{t('phones.telAviv')}</Ltr>
        </a>
        <a href={FIRM.jerusalemHref} style={s(LINK)}>
          {t('util.jerusalem')} <Ltr>{t('phones.jerusalem')}</Ltr>
        </a>
        <a href={FIRM.whatsappHref} target="_blank" rel="noopener" style={s(LINK)}>
          {t('util.whatsapp')}
        </a>
        <LanguageSwitcher />
      </div>
    </div>
  );
}
