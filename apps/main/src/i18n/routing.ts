import { defineRouting } from 'next-intl/routing';

/** English at the root, Hebrew under /he. No automatic locale detection: URLs are deterministic for SEO and sharing. */
export const routing = defineRouting({
  locales: ['en', 'he'],
  defaultLocale: 'en',
  localePrefix: 'as-needed',
  localeDetection: false,
});
