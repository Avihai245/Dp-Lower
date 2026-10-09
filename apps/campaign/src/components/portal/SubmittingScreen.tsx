'use client';
import { s } from '@dpl/ui';
import { useTranslations } from 'next-intl';
import { mix } from './shared';

/** "Sending your application to the firm": the transition between the documents screen and the submitted dashboard. */
export function SubmittingScreen() {
  const t = useTranslations('portal.submitting');
  return (
    <div role="status" style={s('min-height: 100vh; display: grid; place-items: center; padding: 40px')}>
      <div style={s('text-align: center; max-width: 44ch')}>
        <div aria-hidden="true" style={s('width: 44px; height: 44px; border: 1px solid var(--color-accent); margin: 0 auto 28px; position: relative; animation: markIn 400ms ease both')}>
          <span className="pt-grow" style={s('position: absolute; inset: 0; background: var(--color-accent); animation: barGrow 1500ms cubic-bezier(0.4,0,0.2,1) both')} />
        </div>
        <h1 style={s('font-size: 34px; letter-spacing: -0.02em; margin: 0 0 10px')}>{t('title')}</h1>
        <p style={s(`font-size: 15.5px; color: ${mix(62)}; margin: 0`)}>{t('body')}</p>
      </div>
    </div>
  );
}
