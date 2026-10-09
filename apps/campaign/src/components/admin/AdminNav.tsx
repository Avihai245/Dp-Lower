'use client';

import { s, x } from '@dpl/ui';
import { useLocale, useTranslations } from 'next-intl';
import { signOutAction } from '@/app/[locale]/(admin)/admin/actions';
import { Link, usePathname } from '@/i18n/navigation';
import { useAdmin } from './AdminProvider';
import { FILTER_KEYS } from './model';
import { HelpTip } from './ui';

/**
 * The header of the CRM.
 *  - Row 1: logo and "Internal" (as designed), the section links, language switch and sign out (new: the prototype was
 *    a single screen and had no navigation or session controls).
 *  - Row 2, on the lead pages: the filter pills with their counts and the search box, exactly as designed.
 * The prototype put everything in one row; with the section links it no longer fits at 1440px.
 */
export function AdminNav() {
  const t = useTranslations('admin');
  const locale = useLocale();
  const pathname = usePathname();
  const { me, counts, filter, setFilter, query, setQuery, inbox, listQuery } = useAdmin();

  const onLeads = pathname === '/admin' || pathname.startsWith('/admin/leads');
  const sections: Array<{ href: string; label: string; on: boolean; badge?: number }> = [
    { href: '/admin', label: t('nav.leads'), on: onLeads },
    { href: '/admin/inbox', label: t('nav.inbox'), on: pathname.startsWith('/admin/inbox'), badge: inbox.callbacks + inbox.contacts },
    { href: '/admin/availability', label: t('nav.availability'), on: pathname.startsWith('/admin/availability') },
    ...(me.role === 'admin' ? [{ href: '/admin/team', label: t('nav.team'), on: pathname.startsWith('/admin/team') }] : []),
  ];

  return (
    <header style={s('background:var(--color-bg);border-bottom:1px solid var(--color-divider)')}>
      <div data-nav style={s('display:flex;align-items:center;gap:20px;padding:12px 24px;flex-wrap:wrap')}>
        <div style={s('display:flex;align-items:center;gap:10px')}>
          <img src="/images/DPL_logo-sm.webp" alt={t('nav.brandAlt')} width={320} height={114} decoding="async" style={s('height:24px;width:auto;display:block')} />
          <span
            data-hide-xs
            style={s(
              'font-family:var(--font-body);font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:color-mix(in srgb, var(--color-text) 50%, transparent)',
            )}
          >
            {t('nav.internal')}
          </span>
        </div>

        <nav aria-label={t('nav.sections')} data-admin-sections style={s('display:flex;align-items:center;flex-wrap:wrap;gap:6px 22px;margin-left:12px')}>
          {sections.map((sec) => (
            <Link
              key={sec.href}
              href={sec.href}
              aria-current={sec.on ? 'page' : undefined}
              {...x(
                `display:inline-flex;align-items:center;gap:6px;font-size:11.5px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;text-decoration:none;color:#14202b;padding:6px 1px;border-bottom:2px solid ${sec.on ? '#a07a3c' : 'transparent'};opacity:${sec.on ? '1' : '0.55'};transition:opacity 140ms ease`,
                sec.on ? {} : { hover: 'opacity:1' },
              )}
            >
              {sec.label}
              {sec.badge ? (
                <span
                  aria-label={t('nav.inboxCount', { count: sec.badge })}
                  data-inbox-badge
                  style={s(
                    'display:inline-grid;place-items:center;min-width:18px;height:18px;padding:0 5px;box-sizing:border-box;border-radius:999px;background:#a07a3c;color:#fff;font-size:11px;font-weight:700;letter-spacing:0;line-height:1',
                  )}
                >
                  {sec.badge}
                </span>
              ) : null}
            </Link>
          ))}
        </nav>

        <span data-admin-utils style={s('margin-left:auto;display:flex;align-items:center;gap:14px;flex:none')}>
          <span role="group" aria-label={t('nav.language')} style={s('display:inline-flex;align-items:center;gap:2px')}>
            {(['en', 'he'] as const).map((l) => (
              <Link
                key={l}
                href={`${pathname}${listQuery}`}
                locale={l}
                lang={l}
                hrefLang={l}
                aria-label={t(l === 'en' ? 'nav.localeEnName' : 'nav.localeHeName')}
                aria-current={locale === l ? 'true' : undefined}
                {...x(
                  `font-size:11.5px;font-weight:600;letter-spacing:0.08em;text-decoration:none;padding:4px 8px;border-radius:999px;color:${locale === l ? '#f8f5f0' : '#14202b'};background:${locale === l ? '#14202b' : 'transparent'}`,
                  locale === l ? {} : { hover: 'background:#ece6dc' },
                )}
              >
                {t(l === 'en' ? 'nav.localeEn' : 'nav.localeHe')}
              </Link>
            ))}
          </span>
          <form action={signOutAction}>
            <button
              type="submit"
              {...x(
                "background:none;border:0;padding:6px 1px;font-family:'Manrope',system-ui,sans-serif;font-size:11.5px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;color:#736d64;cursor:pointer;border-bottom:1px solid #ece6dc",
                { hover: 'color:#a07a3c;border-bottom-color:#a07a3c' },
              )}
            >
              {t('nav.signOut')}
            </button>
          </form>
        </span>
      </div>

      {onLeads && (
        <div data-nav data-nav-filters style={s('display:flex;align-items:center;gap:20px;padding:10px 24px 12px;flex-wrap:wrap;border-top:1px solid #f0ebe2')}>
          <div data-admin-filters role="group" aria-label={t('nav.filters')} style={s('display:flex;flex-wrap:wrap;align-items:center;gap:4px')}>
            {FILTER_KEYS.map((key) => {
              const on = filter === key;
              return (
                <button
                  key={key}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setFilter(key)}
                  style={s(
                    `cursor:pointer;border-radius:999px;border:1px solid ${on ? '#14202b' : '#e2dbcf'};background:${on ? '#14202b' : '#fff'};color:${on ? '#f8f5f0' : '#14202b'};padding:7px 14px;font-family:'Manrope',system-ui,sans-serif;font-size:12.5px;font-weight:600`,
                  )}
                >
                  {t(`filters.${key}`)} <span style={s('opacity:0.6')}>{counts[key]}</span>
                </button>
              );
            })}
            <span style={s('margin-left:6px')}>
              <HelpTip id="filters" />
            </span>
          </div>

          <span data-admin-search style={s('margin-left:auto;display:flex;align-items:center;gap:8px;min-width:0')}>
            <input
              type="search"
              className="input"
              placeholder={t('search.placeholder')}
              aria-label={t('search.label')}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              style={s('min-width:0;width:260px;padding:9px 14px;font-size:13.5px;border-radius:999px')}
            />
            <HelpTip id="search" />
          </span>
        </div>
      )}
    </header>
  );
}
