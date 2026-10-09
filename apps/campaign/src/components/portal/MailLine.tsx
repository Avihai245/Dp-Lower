'use client';
import { s } from '@dpl/ui';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { SANS, mix, richTags } from './shared';

/**
 * The line under the header: who is signed in, where updates are sent, and (until a password is set) the nudge to set
 * one. The tour's last step points at this bar.
 */
export function MailLine({ email, passwordSet, submitted }: { email: string; passwordSet: boolean; submitted: boolean }) {
  const t = useTranslations('portal.mail');
  const key = passwordSet ? (submitted ? 'submittedPasswordSet' : 'passwordSet') : submitted ? 'submitted' : 'signedInFrom';
  return (
    <div
      data-tour="account"
      data-pad
      style={s(
        `max-width: 100%; margin: 0 auto; padding: 14px clamp(20px, 4.6vw, 160px); display: flex; align-items: flex-start; gap: 10px 14px; flex-wrap: wrap; ${SANS}; font-size: 13.5px; line-height: 1.6; color: ${mix(70)}; border-bottom: 1px solid var(--color-divider)`,
      )}
    >
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#a07a3c" strokeWidth="1.5" aria-hidden="true" style={s('flex: none; margin-top: 2px')}>
        <rect x="3" y="5" width="18" height="14" rx="1" />
        <path d="m3 7 9 6 9-6" />
      </svg>
      <span style={s('flex: 1; min-width: 200px')}>{t.rich(key, { email, ...richTags })}</span>
      {!passwordSet && (
        <Link
          href="/create-password"
          style={s(
            `background: none; border: 0; padding: 0; ${SANS}; font-size: 13.5px; font-weight: 600; color: #7a5c2c; cursor: pointer; white-space: nowrap; border-bottom: 1px solid var(--color-divider); text-decoration: none`,
          )}
        >
          {t('setPassword')}
        </Link>
      )}
    </div>
  );
}
