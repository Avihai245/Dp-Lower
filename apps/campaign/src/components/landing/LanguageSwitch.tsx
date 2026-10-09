'use client';
import { rememberLanguage } from '@dpl/i18n';
import { x } from '@dpl/ui';
import { useLocale, useTranslations } from 'next-intl';
import NextLink from 'next/link';
import { getPathname, usePathname } from '@/i18n/navigation';

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
  // a plain link to the other language's real URL (English has no prefix): no redirect hop for visitors or crawlers
  const href = getPathname({ locale: other, href: pathname });

  return (
    <NextLink
      href={href}
      // not prefetched: the other language's page announces its own fonts, and a visitor who stays should not download them
      prefetch={false}
      lang={other}
      hrefLang={other}
      // a visitor who picks a language keeps it on the next visit, whatever country they are in
      onClick={() => rememberLanguage(other)}
      aria-label={t('switchLabel')}
      data-lang-switch
      {...x(
        "font-family: 'Assistant Variable', var(--font-sans); font-size: 15px; font-weight: 600; color: #736d64; text-decoration: none; border-bottom: 1px solid #ece6dc; padding-bottom: 1px",
        { hover: 'color: #a07a3c; border-bottom-color: #a07a3c' },
      )}
    >
      {t('name')}
    </NextLink>
  );
}
