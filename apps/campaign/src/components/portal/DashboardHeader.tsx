'use client';
import { s, x } from '@dpl/ui';
import { useTranslations } from 'next-intl';
import { PortalLogo, SANS, mix } from './shared';

const PILL = `display: flex; align-items: center; gap: 7px; background: #fff; border: 1px solid #e2dbcf; border-radius: 999px; padding: 8px 14px; ${SANS}; font-size: 13px; font-weight: 600; color: #14202b; cursor: pointer`;

/** Header of the dashboard: logo, "Show me around" (until the application is submitted), the address, My details, Sign out. */
export function DashboardHeader({
  email,
  showTour,
  onTour,
  onDetails,
  onSignOut,
}: {
  email: string;
  showTour: boolean;
  onTour: () => void;
  onDetails: () => void;
  onSignOut: () => void;
}) {
  const t = useTranslations('portal');
  return (
    <>
      <div
        style={s('max-width: 100%; width: 100%; margin: 0 auto; padding: 20px clamp(20px, 4.6vw, 160px); display: flex; align-items: center; gap: 16px; flex-wrap: wrap')}
      >
        <PortalLogo />
        {showTour && (
          <button type="button" onClick={onTour} {...x(`margin-left: auto; ${PILL}`, { hover: 'border-color: #14202b' })}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#a07a3c" strokeWidth="1.6" aria-hidden="true">
              <circle cx="12" cy="12" r="9" />
              <path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6V14M12 17h.01" />
            </svg>
            {t('header.tour')}
          </button>
        )}
        <div data-hide-xs style={s(`margin-left: auto; font-size: 13px; color: ${mix(60)}`)}>
          <bdi dir="ltr">{email}</bdi>
        </div>
        <button type="button" onClick={onDetails} {...x(PILL, { hover: 'border-color: #14202b' })}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#a07a3c" strokeWidth="1.6" aria-hidden="true">
            <circle cx="12" cy="8" r="4" />
            <path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" />
          </svg>
          {t('header.myDetails')}
        </button>
        <button
          type="button"
          onClick={onSignOut}
          {...x(`background: none; border: 0; padding: 0; ${SANS}; font-size: 13px; color: ${mix(60)}; cursor: pointer; border-bottom: 1px solid var(--color-divider)`, {
            hover: 'color: #a07a3c',
          })}
        >
          {t('header.signOut')}
        </button>
      </div>
      <div style={s('height: 1px; background: var(--color-divider)')} />
    </>
  );
}
