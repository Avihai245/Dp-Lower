'use client';
import { useTranslations } from 'next-intl';
import { useEffect } from 'react';
import { IconAlert } from '@/components/ui/icons';

/** A portal page could not be loaded (the database or storage did not answer): say so and offer another try. */
export default function PortalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations('portal.errors');
  useEffect(() => {
    console.error('[portal]', error);
  }, [error]);
  return (
    <div role="alert" className="ui-page ui-center-page">
      <div className="ui-card ui-card-pad" style={{ textAlign: 'center', maxWidth: 460 }}>
        <span className="ui-icon-chip ui-icon-chip-lg ui-icon-chip-warn" aria-hidden="true" style={{ marginBottom: 18 }}>
          <IconAlert size={22} />
        </span>
        <h1 className="ui-h2" style={{ fontSize: 30, margin: '0 0 10px' }}>
          {t('title')}
        </h1>
        <p className="ui-lede" style={{ fontSize: 15.5, margin: '0 0 24px' }}>
          {t('body')}
        </p>
        <button type="button" className="ui-btn ui-btn-primary ui-btn-lg" onClick={reset}>
          {t('retry')}
        </button>
      </div>
    </div>
  );
}
