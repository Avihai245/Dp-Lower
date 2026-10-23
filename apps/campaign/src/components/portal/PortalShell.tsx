'use client';
import { createBrowserSupabase } from '@dpl/db/browser';
import { useLocale, useTranslations } from 'next-intl';
import { useState, type ReactNode } from 'react';
import { Link } from '@/i18n/navigation';
import { api } from '@/lib/api';
import { IconFolder, IconForm, IconHelp, IconHome, IconLogout, IconUser } from '../ui/icons';
import { MyDetailsModal, type DetailsValues } from './MyDetailsModal';
import { richTags } from './shared';
import type { PortalLead } from './model/types';

export type PortalSection = 'overview' | 'application' | 'documents';
type Href = '/portal' | '/portal/application' | '/portal/documents';

const SECTIONS: Array<{ id: PortalSection; href: Href; Icon: typeof IconHome }> = [
  { id: 'overview', href: '/portal', Icon: IconHome },
  { id: 'application', href: '/portal/application', Icon: IconForm },
  { id: 'documents', href: '/portal/documents', Icon: IconFolder },
];

/**
 * The frame of every portal page: the logo, the three sections (overview, application, documents), and the account
 * actions (the guided tour on the overview, My details, Sign out). `onNavigate` lets a page save before it is left (the
 * application editor flushes its last keystrokes); without it the sections are plain links.
 */
export function PortalShell({
  active,
  lead,
  onTour,
  onNavigate,
  onDetailsSaved,
  children,
}: {
  active: PortalSection;
  lead: PortalLead;
  onTour?: () => void;
  onNavigate?: (href: Href) => void;
  onDetailsSaved?: (values: DetailsValues) => void;
  children: ReactNode;
}) {
  const t = useTranslations('portal');
  const locale = useLocale();
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [me, setMe] = useState(lead);

  const signOut = async () => {
    try {
      // this browser only: signing out here must not end the applicant's sessions on their other devices
      await createBrowserSupabase().auth.signOut({ scope: 'local' });
    } catch {
      /* the server call below closes the session too */
    }
    // also clears the httpOnly lead cookie, which could otherwise open the portal again without a password
    const out = await api<{ forgetUrl?: string }>('/api/portal/sign-out', { method: 'POST' });
    // the firm's site holds a lead cookie of its own: pass through it so a shared computer keeps nothing of this visit
    window.location.assign(out.data?.forgetUrl ? `${out.data.forgetUrl}?l=${locale}` : locale === 'he' ? '/he' : '/');
  };

  return (
    <div className="ui-page">
      <header className="ui-topbar">
        <div className="ui-container">
          <div className="ui-topbar-row">
            <img className="ui-logo" src="/images/DPL_logo-sm.webp" alt={t('header.logoAlt')} width={320} height={114} decoding="async" />
            <nav className="ui-nav" aria-label={t('nav.label')}>
              <div className="ui-tabs">
                {SECTIONS.map(({ id, href, Icon }) =>
                  onNavigate ? (
                    <button key={id} type="button" className="ui-tab" aria-current={id === active ? 'page' : undefined} onClick={() => onNavigate(href)}>
                      <Icon size={17} />
                      {t(`nav.${id}`)}
                    </button>
                  ) : (
                    <Link key={id} href={href} className="ui-tab" aria-current={id === active ? 'page' : undefined}>
                      <Icon size={17} />
                      {t(`nav.${id}`)}
                    </Link>
                  ),
                )}
              </div>
            </nav>
            <div className="ui-topbar-end">
              <span className="ui-badge ui-badge-line ui-badge-plain ui-hide-sm">
                {t.rich('nav.case', { ref: me.caseRef, ...richTags })}
              </span>
              {onTour && (
                <button type="button" className="ui-btn ui-btn-quiet ui-btn-sm" onClick={onTour} aria-label={t('header.tour')}>
                  <IconHelp size={17} />
                  <span className="ui-hide-sm">{t('header.tour')}</span>
                </button>
              )}
              <button type="button" className="ui-btn ui-btn-sm" onClick={() => setDetailsOpen(true)} aria-label={t('header.myDetails')}>
                <IconUser size={17} />
                <span className="ui-hide-sm">{t('header.myDetails')}</span>
              </button>
              <button type="button" className="ui-btn ui-btn-quiet ui-btn-sm" onClick={signOut} aria-label={t('header.signOut')}>
                <IconLogout size={17} />
                <span className="ui-hide-sm">{t('header.signOut')}</span>
              </button>
            </div>
          </div>
        </div>
      </header>
      <main className="ui-main">
        <div className="ui-container">{children}</div>
      </main>
      {detailsOpen && (
        <MyDetailsModal
          lead={me}
          onClose={() => setDetailsOpen(false)}
          onSaved={(values) => {
            setMe((prev) => ({ ...prev, fullName: values.fullName, phone: values.phone }));
            onDetailsSaved?.(values);
          }}
        />
      )}
    </div>
  );
}
