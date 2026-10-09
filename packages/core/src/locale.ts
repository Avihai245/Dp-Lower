export const LOCALES = ['en', 'he'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'en';

export const isLocale = (v: unknown): v is Locale => v === 'en' || v === 'he';
export const dirOf = (l: Locale): 'ltr' | 'rtl' => (l === 'he' ? 'rtl' : 'ltr');

/** The firm works in Israel. Booking slots, case references and the CRM use this zone. */
export const FIRM_TIMEZONE = 'Asia/Jerusalem';
