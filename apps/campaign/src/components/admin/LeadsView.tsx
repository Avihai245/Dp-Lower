'use client';

import { s } from '@dpl/ui';
import { useTranslations } from 'next-intl';
import { useAdmin } from './AdminProvider';
import { LeadsBoard } from './LeadsBoard';
import { LeadsTable } from './LeadsTable';
import { VIEW_KEYS } from './model';
import { sub } from './rowbits';
import { HelpTip } from './ui';
import { IconAlert, IconBoard, IconClock, IconForm, IconList, IconSpark } from '../ui/icons';

const VIEW_ICONS = { table: IconList, board: IconBoard };

/** /admin: the four counters, the Table | Board switch and the list itself. */
export function LeadsView() {
  const t = useTranslations('admin');
  const { stats, view, setView, visible, rows } = useAdmin();
  const tiles = [
    { n: stats.attention, label: t('stats.attention'), Icon: IconAlert, tone: 'ui-icon-chip-warn' },
    { n: stats.waiting, label: t('stats.waiting'), Icon: IconClock, tone: '' },
    { n: stats.review, label: t('stats.review'), Icon: IconForm, tone: 'ui-icon-chip-ink' },
    { n: stats.newLeads, label: t('stats.newLeads'), Icon: IconSpark, tone: 'ui-icon-chip-ok' },
  ];

  return (
    <div className="adm-page">
      <div data-stats className="adm-tiles">
        {tiles.map(({ n, label, Icon, tone }) => (
          <div key={label} className="adm-tile">
            <span className={`ui-icon-chip ${tone}`} aria-hidden="true">
              <Icon size={19} />
            </span>
            <span>
              <span className="adm-tile-n">{n}</span>
              <span className="adm-tile-label" style={{ display: 'block', marginTop: 4 }}>
                {label}
              </span>
            </span>
          </div>
        ))}
        <HelpTip id="stats" align="left" />
      </div>

      <div style={s('display:flex;align-items:center;gap:12px;margin-bottom:14px;flex-wrap:wrap')}>
        <div role="tablist" aria-label={t('views.label')} className="adm-seg">
          {VIEW_KEYS.map((k) => {
            const on = view === k;
            const Icon = VIEW_ICONS[k];
            return (
              <button key={k} type="button" role="tab" aria-selected={on} onClick={() => setView(k)}>
                <Icon size={16} />
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
