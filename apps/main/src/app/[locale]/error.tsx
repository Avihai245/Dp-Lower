'use client';
import { s } from '@dpl/ui';
import { useParams } from 'next/navigation';
import { useEffect } from 'react';

/**
 * A page of the site failed while it was being built or loaded (the database did not answer, a bug): say so in the
 * visitor's language and offer another try. It needs no providers, so it also works when the failure was in one of them.
 */
const COPY = {
  en: { title: 'Something went wrong.', body: 'This page could not be loaded. Please try again in a moment.', retry: 'Try again', home: 'Back to the home page' },
  he: { title: 'משהו השתבש.', body: 'לא הצלחנו לטעון את העמוד. נסו שוב בעוד רגע.', retry: 'נסו שוב', home: 'חזרה לעמוד הבית' },
} as const;

export default function LocaleError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { locale } = useParams<{ locale?: string }>();
  const t = COPY[locale === 'he' ? 'he' : 'en'];
  useEffect(() => {
    console.error('[page]', error);
  }, [error]);
  return (
    <main role="alert" style={s('min-height: 70vh; display: grid; place-items: center; padding: 60px 24px; background: #f8f5f0; color: #14202b')}>
      <div style={s('text-align: center; max-width: 46ch')}>
        <h1 style={s("font-family: var(--font-serif), Georgia, serif; font-weight: 400; font-size: 40px; line-height: 1.1; letter-spacing: -0.02em; margin: 0 0 14px")}>{t.title}</h1>
        <p style={s("font-family: var(--font-sans), system-ui, sans-serif; font-size: 16.5px; line-height: 1.65; color: #55606b; margin: 0 0 28px")}>{t.body}</p>
        <div style={s('display: flex; gap: 14px; justify-content: center; flex-wrap: wrap')}>
          <button type="button" onClick={reset} style={s("background: #14202b; color: #f8f5f0; border: 0; padding: 15px 26px; font-family: var(--font-sans), system-ui, sans-serif; font-size: 14px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; cursor: pointer")}>
            {t.retry}
          </button>
          <a href={locale === 'he' ? '/he' : '/'} style={s("display: inline-block; padding: 15px 26px; border: 1px solid #14202b; color: #14202b; text-decoration: none; font-family: var(--font-sans), system-ui, sans-serif; font-size: 14px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase")}>
            {t.home}
          </a>
        </div>
      </div>
    </main>
  );
}
