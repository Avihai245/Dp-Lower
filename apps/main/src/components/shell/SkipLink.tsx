import { x } from '@dpl/ui';
import { getTranslations } from 'next-intl/server';

/** First tab stop of every page: jumps over the header to the main content. Visible only while focused. */
export async function SkipLink() {
  const t = await getTranslations('site');
  return (
    <a
      href="#dpl-main"
      {...x('position: absolute; left: -9999px; top: 0; background: #14202b; color: #f8f5f0; padding: 12px 18px; z-index: 60', {
        focus: 'left: 0',
      })}
    >
      {t('skipLink')}
    </a>
  );
}
