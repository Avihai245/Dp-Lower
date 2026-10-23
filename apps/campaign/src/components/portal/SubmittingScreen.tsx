'use client';
import { useTranslations } from 'next-intl';

/** "Sending your application to the firm": the transition between the documents screen and the submitted dashboard. */
export function SubmittingScreen() {
  const t = useTranslations('portal.submitting');
  return (
    <div role="status" className="ui-page ui-center-page">
      <div className="ui-card ui-card-pad ui-rise" style={{ textAlign: 'center', maxWidth: 460 }}>
        <div className="ui-spinner" aria-hidden="true" />
        <h1 className="ui-h2" style={{ fontSize: 32, margin: '0 0 10px' }}>
          {t('title')}
        </h1>
        <p className="ui-lede" style={{ fontSize: 15.5 }}>
          {t('body')}
        </p>
      </div>
    </div>
  );
}
