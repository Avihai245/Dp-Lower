'use client';

import { s } from '@dpl/ui';
import { rememberLanguage } from '@dpl/i18n';
import { useLocale, useTranslations } from 'next-intl';
import { getPathname, usePathname } from '@/i18n/navigation';

const BASE = "background: none; border: 0; padding: 0; font-family: 'Manrope', system-ui, sans-serif; font-size: 13px; text-decoration: none; line-height: normal";

/** Colours of the three states on the dark utility bar (the design) and on the light burger list (phones). */
const THEME = {
  dark: {
    wrap: 'margin-left: auto; display: flex; align-items: center; gap: 18px',
    item: BASE,
    current: 'color: #f8f5f0; font-weight: 600',
    link: 'color: #9aa3ad',
  },
  light: {
    wrap: 'display: flex; align-items: center; justify-content: center; gap: 12px; margin-top: 14px',
    item: `${BASE}; font-size: 15px; padding: 12px 10px; display: inline-block`,
    current: 'color: #14202b; font-weight: 600',
    link: 'color: #736d64',
  },
} as const;

/**
 * English / עברית switch: the same page in the other language. The language the visitor is reading is bold and not a
 * link. The prototype's Français item is left out: there is no French edition (the approved plan removes the button).

 * Clicking one also remembers the choice (the dpl_lang cookie), which beats the country-based default of the middleware.
 * The links are plain anchors with the exact address of the other edition (no redirect hop, and the same URLs as the hreflang alternates).
 * `dark` sits in the utility bar; `light` closes the burger list on phones, where the utility bar is hidden.
 */
export function LanguageSwitcher({ variant = 'dark' }: { variant?: keyof typeof THEME }) {
  const t = useTranslations('site');
  const locale = useLocale();
  const pathname = usePathname();
  const th = THEME[variant];
  // the utility bar's items were padding-less buttons in the design, which get the larger tap area on touch screens
  const mark = variant === 'dark' ? { 'data-linkbtn': true } : {};

  return (
    <span role="group" aria-label={t('lang.label')} style={s(th.wrap)}>
      {(['en', 'he'] as const).map((l) =>
        l === locale ? (
          <span key={l} lang={l} aria-current="true" {...mark} style={s(`${th.item}; cursor: default; ${th.current}`)}>
            {t(`lang.${l}`)}
          </span>
        ) : (
          <a key={l} href={getPathname({ href: pathname, locale: l })} lang={l} hrefLang={l} onClick={() => rememberLanguage(l)} {...mark} style={s(`${th.item}; cursor: pointer; ${th.link}`)}>
            {t(`lang.${l}`)}
          </a>
        ),
      )}
    </span>
  );
}
