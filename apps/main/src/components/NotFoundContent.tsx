import { s } from '@dpl/ui';
import type { Metadata } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';

/** Unknown URL inside the site: the shell (header, footer) stays, the content area explains. `locale` is omitted when the request already carries it. */
export async function NotFoundContent({ locale }: { locale?: string }) {
  const t = await getTranslations({ locale: locale ?? (await getLocale()), namespace: 'site.notFound' });
  return (
    <div style={s('padding: 120px clamp(20px, 4.6vw, 120px) 140px; max-width: 920px')}>
      <div
        style={s(
          "font-family: 'Manrope', system-ui, sans-serif; font-size: 12px; font-weight: 600; letter-spacing: 0.16em; color: #a07a3c",
        )}
      >
        404
      </div>
      <h1
        style={s(
          "font-family: 'Newsreader', Georgia, serif; font-size: 56px; font-weight: 400; line-height: 1.05; letter-spacing: -0.02em; color: #14202b; margin: 14px 0 18px",
        )}
      >
        {t('title')}
      </h1>
      <p
        style={s(
          "font-family: 'Manrope', system-ui, sans-serif; font-size: 18px; line-height: 1.6; color: #55606b; margin: 0 0 34px",
        )}
      >
        {t('body')}
      </p>
      <Link
        href="/"
        style={s(
          "display: inline-block; background: #14202b; color: #f8f5f0; padding: 15px 26px; border-radius: 999px; font-family: 'Manrope', system-ui, sans-serif; font-size: 15px; font-weight: 600; text-decoration: none",
        )}
      >
        {t('home')}
      </Link>
    </div>
  );
}

/** "Page not found | Decker Pex Levi Law Offices", not indexed (WCAG 2.4.2: every page has a title). */
export async function notFoundMetadata(locale?: string): Promise<Metadata> {
  const lang = locale ?? (await getLocale());
  const t = await getTranslations({ locale: lang, namespace: 'site.notFound' });
  const seo = await getTranslations({ locale: lang, namespace: 'seo' });
  return { title: `${t('title')} | ${seo('brand')}`, robots: { index: false, follow: true } };
}
