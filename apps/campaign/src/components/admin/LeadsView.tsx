'use client';

import { s } from '@dpl/ui';
import { useTranslations } from 'next-intl';
import { useAdmin } from './AdminProvider';
import { LeadsBoard } from './LeadsBoard';
import { LeadsTable } from './LeadsTable';
import { VIEW_KEYS } from './model';
import { sub } from './rowbits';
import { HelpTip } from './ui';

const ICONS = {
  table: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M3 10h18M3 15h18M9 10v10" />
    </svg>
  ),
  board: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
      <rect x="3" y="4" width="5" height="16" rx="1.5" />
      <rect x="10" y="4" width="5" height="11" rx="1.5" />
      <rect x="17" y="4" width="4" height="7" rx="1.5" />
    </svg>
  ),
};

/** /admin: the four counters, the Table | Board switch and the list itself. */
export function LeadsView() {
  const t = useTranslations('admin');
  const { stats, view, setView, visible, rows } = useAdmin();
  const tiles = [
    { n: stats.attention, label: t('stats.attention') },
    { n: stats.waiting, label: t('stats.waiting') },
    { n: stats.review, label: t('stats.review') },
    { n: stats.newLeads, label: t('stats.newLeads') },
  ];

  return (
    <div style={s('padding:20px 24px')}>
      <div
        data-stats
        style={s(
          `display:flex;flex-wrap:wrap;gap:12px 28px;margin-bottom:18px;font-size:12.5px;font-family:'Manrope',system-ui,sans-serif;letter-spacing:0.08em;text-transform:uppercase;color:${sub(60)}`,
        )}
      >
        {tiles.map((tile) => (
          <span key={tile.label}>
            <span style={s("font-family:'Manrope',system-ui,sans-serif;font-size:22px;color:var(--color-text);margin-right:7px")}>{tile.n}</span>
            {tile.label}
          </span>
        ))}
        <HelpTip id="stats" align="left" />
      </div>

      <div style={s('display:flex;align-items:center;gap:12px;margin-bottom:14px;flex-wrap:wrap')}>
        <div role="tablist" aria-label={t('views.label')} style={s('display:inline-flex;background:#fff;border:1px solid #e2dbcf;border-radius:999px;padding:4px;gap:2px')}>
          {VIEW_KEYS.map((k) => {
            const on = view === k;
            return (
              <button
                key={k}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => setView(k)}
                style={s(
                  `display:flex;align-items:center;gap:7px;border:0;border-radius:999px;padding:8px 16px;font-family:'Manrope',system-ui,sans-serif;font-size:13px;font-weight:600;cursor:pointer;transition:background 160ms ease;background:${on ? '#14202b' : 'transparent'};color:${on ? '#f8f5f0' : '#14202b'}`,
                )}
              >
                <span style={s('display:flex')}>{ICONS[k]}</span>
                {t(`views.${k}`)}
              </button>
            );
          })}
        </div>
        <HelpTip id="views" align="left" />
        {view === 'board' && <span style={s(`font-size:13px;color:${sub(58)}`)}>{t('views.dragHint')}</span>}
        {visible.length === 0 && (
          <span role="status" style={s('font-size:13px;color:#8a3b2c')}>
            {rows.length === 0 ? t('views.noLeads') : t('views.noResults')}
          </span>
        )}
      </div>

      {view === 'table' ? <LeadsTable rows={visible} /> : <LeadsBoard rows={visible} />}
    </div>
  );
}

