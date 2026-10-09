'use client';
import { x } from '@dpl/ui';
import { useLocale, useTranslations } from 'next-intl';
import { Link, usePathname } from '@/i18n/navigation';

/**
 * English / Hebrew switch for the header (the prototype has none). Styled like the "Track my application" link beside
 * it: quiet, muted, bronze on hover. It links to the same page in the other language, so the path is kept. The visible
 * label is the other language's own name; the Hebrew label uses the Hebrew-capable family on the English page too.
 */
export function LanguageSwitch() {
  const locale = useLocale();
  const pathname = usePathname();
  const t = useTranslations('common.language');
  const other = locale === 'he' ? 'en' : 'he';

  return (
    <Link
      href={pathname}
      locale={other}
      lang={other}
      hrefLang={other}
      aria-label={t('switchLabel')}
      data-lang-switch
      {...x(
        "font-family: 'Assistant Variable', var(--font-sans); font-size: 15px; font-weight: 600; color: #736d64; text-decoration: none; border-bottom: 1px solid #ece6dc; padding-bottom: 1px",
        { hover: 'color: #a07a3c; border-bottom-color: #a07a3c' },
      )}
    >
      {t('name')}
    </Link>
  );
}
