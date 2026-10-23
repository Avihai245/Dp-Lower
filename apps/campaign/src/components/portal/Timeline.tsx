'use client';
import type { Locale } from '@dpl/core';
import { useLocale, useTranslations } from 'next-intl';
import { Stepper } from '../ui/Stepper';
import { formatShortDate, formatSlotDate } from './model/format';
import type { Timeline as TimelineModel, TimelineMeta } from './model/types';

/** Text of the stage line, localised. Shared with the dashboard's "Current stage" label. */
export function useTimelineText() {
  const t = useTranslations('portal');
  const locale = useLocale() as Locale;
  const meta = (m: TimelineMeta): string => {
    switch (m.kind) {
      case 'completed':
        return t('timeline.meta.completed');
      case 'signedIn':
        return t('timeline.meta.signedIn');
      case 'sections':
        return t('timeline.meta.sections', { done: m.done, total: m.total });
      case 'uploaded':
        return t('timeline.meta.uploaded', { done: m.done, total: m.total });
      case 'waiting':
        return t('timeline.meta.waiting');
      case 'afterSubmit':
        return t('timeline.meta.afterSubmit');
      case 'status':
        return t(`status.${m.status}`);
      case 'date':
        return m.style === 'slot' ? formatSlotDate(m.iso, locale, m.timezone) : formatShortDate(m.iso, locale, m.timezone);
    }
  };
  const label = (id: TimelineModel['nodes'][number]['id']): string => t(`timeline.nodes.${id}`);
  const now = (current: TimelineModel['current']): string =>
    t('timeline.now', { stage: current.kind === 'status' ? t(`status.${current.status}`) : label(current.id) });
  return { meta, label, now };
}

/** "Where your application stands": the stage line, horizontal on wide screens and a vertical list on narrow ones. */
export function Timeline({ timeline }: { timeline: TimelineModel }) {
  const t = useTranslations('portal.timeline');
  const text = useTimelineText();

  return (
    <section data-tour="timeline" className="ui-card" aria-labelledby="pt-timeline-title">
      <div className="ui-card-head ui-wrap">
        <h2 id="pt-timeline-title" className="ui-kicker" style={{ margin: 0 }}>
          {t('title')}
        </h2>
        <span className="ui-badge ui-badge-gold ui-push">{text.now(timeline.current)}</span>
      </div>
      <div className="ui-card-pad ui-timeline-body">
        <Stepper items={timeline.nodes.map((n) => ({ key: n.id, state: n.state, label: text.label(n.id), meta: text.meta(n.meta) }))} />
      </div>
    </section>
  );
}
