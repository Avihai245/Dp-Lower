'use client';

import { useLocale, useTranslations } from 'next-intl';
import { signOutAction } from '@/app/[locale]/(admin)/admin/actions';
import { Link, usePathname } from '@/i18n/navigation';
import { IconCalendar, IconInbox, IconLock, IconLogout, IconSearch, IconShield, IconUsers } from '../ui/icons';
import { useAdmin } from './AdminProvider';
import { FILTER_KEYS } from './model';
import { initialsOf } from './rowbits';
import { HelpTip } from './ui';

type SectionIcon = typeof IconUsers;

/**
 * The CRM's navigation: an ink sidebar with the logo, the sections (with the inbox count), and at its foot the signed-in
 * member, two-step verification, the language switch and sign out. Below 1101px it folds into a bar across the top.
 */
export function AdminNav() {
  const t = useTranslations('admin');
  const locale = useLocale();
  const pathname = usePathname();
  const { me, inbox, listQuery } = useAdmin();

  const onLeads = pathname === '/admin' || pathname.startsWith('/admin/leads');
  const sections: Array<{ href: string; label: string; on: boolean; Icon: SectionIcon; badge?: number }> = [
    { href: '/admin', label: t('nav.leads'), on: onLeads, Icon: IconUsers },
    { href: '/admin/inbox', label: t('nav.inbox'), on: pathname.startsWith('/admin/inbox'), Icon: IconInbox, badge: inbox.callbacks + inbox.contacts },
    { href: '/admin/availability', label: t('nav.availability'), on: pathname.startsWith('/admin/availability'), Icon: IconCalendar },
    ...(me.role === 'admin' ? [{ href: '/admin/team', label: t('nav.team'), on: pathname.startsWith('/admin/team'), Icon: IconShield }] : []),
  ];

  return (
    <header className="adm-side">
      <div className="adm-side-brand">
        <img src="/images/DPL_logo-sm.webp" alt={t('nav.brandAlt')} width={320} height={114} decoding="async" className="adm-side-logo" />
        <span className="adm-side-tag">{t('nav.internal')}</span>
      </div>

      <nav aria-label={t('nav.sections')} data-admin-sections className="adm-side-nav">
        {sections.map(({ href, label, on, Icon, badge }) => (
          <Link key={href} href={href} aria-current={on ? 'page' : undefined} className="adm-side-link">
            <Icon size={18} />
            <span>{label}</span>
            {badge ? (
              <span aria-label={t('nav.inboxCount', { count: badge })} data-inbox-badge className="adm-side-badge">
                {badge}
              </span>
            ) : null}
          </Link>
        ))}
      </nav>

      <div data-admin-utils className="adm-side-foot">
        <div className="adm-side-me">
          <span className="adm-avatar adm-avatar-gold" aria-hidden="true">
            {initialsOf(me.name)}
          </span>
          <span className="adm-side-me-text">
            <span className="adm-side-me-name">{me.name}</span>
            <span className="adm-side-me-role">{t(`team.roles.${me.role}`)}</span>
          </span>
        </div>
        {/* two-step verification (an authenticator app) lives outside the CRM shell: it must work before the second step is done */}
        <Link href="/two-step?next=/admin" data-admin-security className="adm-side-link adm-side-link-sm">
          <IconLock size={17} />
          <span className="adm-side-label">{t('nav.security')}</span>
        </Link>
        <div className="adm-side-row">
          <span role="group" aria-label={t('nav.language')} className="adm-lang">
            {(['en', 'he'] as const).map((l) => (
              <Link
                key={l}
                href={`${pathname}${listQuery}`}
                locale={l}
                lang={l}
                hrefLang={l}
                aria-label={t(l === 'en' ? 'nav.localeEnName' : 'nav.localeHeName')}
                aria-current={locale === l ? 'true' : undefined}
              >
                {t(l === 'en' ? 'nav.localeEn' : 'nav.localeHe')}
              </Link>
            ))}
          </span>
          <form action={signOutAction}>
            <button type="submit" className="adm-side-signout">
              <IconLogout size={16} />
              <span className="adm-side-label">{t('nav.signOut')}</span>
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}

/** Above the lead list and the lead pages: the filter pills with their counts and the search box. */
export function AdminToolbar() {
  const t = useTranslations('admin');
  const pathname = usePathname();
  const { counts, filter, setFilter, query, setQuery } = useAdmin();
  const onLeads = pathname === '/admin' || pathname.startsWith('/admin/leads');
  if (!onLeads) return null;

  return (
    <div data-nav-filters className="adm-toolbar">
      <div data-admin-filters role="group" aria-label={t('nav.filters')} className="adm-chips">
        {FILTER_KEYS.map((key) => (
          <button key={key} type="button" aria-pressed={filter === key} onClick={() => setFilter(key)} className="adm-chip">
            {t(`filters.${key}`)} <span className="adm-chip-count">{counts[key]}</span>
          </button>
        ))}
        <HelpTip id="filters" />
      </div>

      <span data-admin-search className="adm-search">
        <span className="adm-search-box">
          <IconSearch size={17} />
          <input type="search" placeholder={t('search.placeholder')} aria-label={t('search.label')} value={query} onChange={(e) => setQuery(e.target.value)} />
        </span>
        <HelpTip id="search" />
      </span>
    </div>
  );
}
