import { s } from '@dpl/ui';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';

export default async function NotFound() {
  const t = await getTranslations('common.notFound');
  return (
    <main style={s('min-height: 70vh; display: grid; place-items: center; padding: 40px 24px; text-align: center; background: #f8f5f0')}>
      <div style={s('max-width: 560px')}>
        <div style={s("font-family: 'Manrope', system-ui, sans-serif; font-size: 12px; font-weight: 600; letter-spacing: 0.16em; color: #a07a3c")}>404</div>
        <h1 style={s("font-family: 'Newsreader', Georgia, serif; font-size: 48px; font-weight: 400; line-height: 1.05; letter-spacing: -0.02em; color: #14202b; margin: 14px 0 16px")}>{t('title')}</h1>
        <p style={s("font-family: 'Manrope', system-ui, sans-serif; font-size: 17px; line-height: 1.6; color: #55606b; margin: 0 0 30px")}>{t('body')}</p>
        <Link href="/" style={s("display: inline-block; background: #14202b; color: #f8f5f0; padding: 14px 24px; border-radius: 999px; font-family: 'Manrope', system-ui, sans-serif; font-size: 15px; font-weight: 600; text-decoration: none")}>
          {t('home')}
        </Link>
      </div>
    </main>
  );
}
