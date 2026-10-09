'use client';
import { s } from '@dpl/ui';
import { useTranslations } from 'next-intl';
import { useEffect } from 'react';
import { mix } from '@/components/portal/shared';

/** A portal page could not be loaded (the database or storage did not answer): say so and offer another try. */
export default function PortalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations('portal.errors');
  useEffect(() => {
    console.error('[portal]', error);
  }, [error]);
  return (
    <div role="alert" style={s('min-height: 100vh; display: grid; place-items: center; padding: 40px')}>
      <div style={s('text-align: center; max-width: 44ch')}>
        <h1 style={s('font-size: 34px; letter-spacing: -0.02em; margin: 0 0 10px')}>{t('title')}</h1>
        <p style={s(`font-size: 15.5px; color: ${mix(62)}; margin: 0 0 26px`)}>{t('body')}</p>
        <button type="button" className="btn btn-primary" onClick={reset} style={s('padding: 15px 28px; font-size: 14px; letter-spacing: 0.08em; text-transform: uppercase')}>
          {t('retry')}
        </button>
      </div>
    </div>
  );
}
