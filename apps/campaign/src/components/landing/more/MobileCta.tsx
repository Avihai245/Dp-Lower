'use client';
import { s, x } from '@dpl/ui';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { useLandingUi } from '../ui-context';
import '../../../styles/landing-more.css';

/**
 * The sticky "Check your eligibility" bar. globals.css shows it at <= 640px through [data-mobile-cta]. It steps aside
 * while the chat or the call-request modal is open (the prototype let it cover the chat's Back / Continue row).
 */
export function MobileCta() {
  const t = useTranslations('landingMore.mobileCta');
  const { chatOpen, advisorOpen } = useLandingUi();
  if (chatOpen || advisorOpen) return null;
  return (
    <div
      data-mobile-cta
      style={s('display:none;position:fixed;left:0;right:0;bottom:0;z-index:50;padding:12px 16px;background:rgba(248,245,240,0.96);border-top:1px solid #ece6dc')}
    >
      <Link
        href="/eligibility"
        {...x(
          "width:100%;background:#14202b;color:#f8f5f0;font-family:'Manrope',system-ui,sans-serif;font-weight:600;font-size:15px;letter-spacing:0.06em;text-transform:uppercase;padding:18px;border-radius:12px",
          { className: 'btn lm-btn' },
        )}
      >
        {t('label')}
      </Link>
    </div>
  );
}
