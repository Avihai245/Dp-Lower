'use client';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { IconLock, IconMail } from '../ui/icons';
import { richTags } from './shared';

/**
 * The strip at the top of the dashboard: who is signed in, where updates are sent, and (until a password is set) the
 * nudge to set one. The tour's last step points at it.
 */
export function MailLine({ email, passwordSet, submitted }: { email: string; passwordSet: boolean; submitted: boolean }) {
  const t = useTranslations('portal.mail');
  const key = passwordSet ? (submitted ? 'submittedPasswordSet' : 'passwordSet') : submitted ? 'submitted' : 'signedInFrom';
  return (
    <div data-tour="account" className="ui-note ui-mailline">
      <span className="ui-icon-chip" aria-hidden="true">
        <IconMail size={16} />
      </span>
      <span className="ui-mailline-text">{t.rich(key, { email, ...richTags })}</span>
      {!passwordSet && (
        <Link href="/create-password" className="ui-btn ui-btn-sm">
          <IconLock size={15} />
          {t('setPassword')}
        </Link>
      )}
    </div>
  );
}
