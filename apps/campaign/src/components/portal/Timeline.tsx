'use client';
import type { Locale } from '@dpl/core';
import { s } from '@dpl/ui';
import { useLocale, useTranslations } from 'next-intl';
import { formatShortDate, formatSlotDate } from './model/format';
import type { StepState, Timeline as TimelineModel, TimelineMeta } from './model/types';
import { SANS } from './shared';

const DOT_BASE = `width: 32px; height: 32px; border-radius: 50%; display: grid; place-items: center; ${SANS}; font-size: 14px; line-height: 1; background: #fff; flex: none; transition: background 300ms ease, border-color 300ms ease`;

const dotState = (state: StepState): string =>
  state === 'done'
    ? '; background: #3f6b4f; border: 1px solid #3f6b4f; color: #fff'
    : state === 'current'
      ? '; border: 2px solid #a07a3c; color: #a07a3c; font-size: 11px'
      : '; border: 1px solid var(--color-divider); color: transparent';

const markOf = (state: StepState): string => (state === 'done' ? '✓' : state === 'current' ? '●' : '');

const labelCss = (state: StepState): string =>
  `${SANS}; font-size: 15px; line-height: 1.25; display: block; color: ${state === 'next' ? '#9c958a' : '#14202b'}; font-weight: ${state === 'current' ? '600' : '500'}`;

const metaCss = (state: StepState): string =>
  `font-size: 12.5px; line-height: 1.45; display: block; margin-top: 5px; color: ${state === 'done' ? '#3f6b4f' : state === 'current' ? '#a07a3c' : '#9c958a'}`;

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

/** "Where your application stands": the stage line, horizontal on wide screens and a vertical list below 1081px. */
export function Timeline({ timeline }: { timeline: TimelineModel }) {
  const t = useTranslations('portal.timeline');
  const text = useTimelineText();
  const { nodes } = timeline;
  const reset = 'list-style: none; margin: 0; padding: 0';

  return (
    <div data-tour="timeline" style={s('background: #fff; border-bottom: 1px solid var(--color-divider)')}>
      <div data-pad style={s('max-width: 100%; margin: 0 auto; padding: 36px clamp(20px, 4.6vw, 160px) 40px')}>
        <div style={s('display: flex; align-items: baseline; gap: 20px; flex-wrap: wrap; margin-bottom: 30px')}>
          <span style={s(`${SANS}; font-size: 12px; font-weight: 600; letter-spacing: 0.18em; text-transform: uppercase; color: #a07a3c`)}>{t('title')}</span>
          <span style={s(`margin-left: auto; ${SANS}; font-size: 14px; color: #736d64`)}>{text.now(timeline.current)}</span>
        </div>
        <div style={s('position: relative')}>
          <div data-tl-line style={s('position: absolute; top: 15px; left: 7.14%; right: 7.14%; height: 2px; background: var(--color-divider)')}>
            <span
              style={s(`display: block; height: 2px; background: #3f6b4f; width: ${timeline.percent}%; transition: width 800ms cubic-bezier(0.4,0,0.2,1)`)}
            />
          </div>
          <ol data-tl style={s(`${reset}; display: grid; grid-template-columns: repeat(${nodes.length}, minmax(0, 1fr)); gap: 12px; position: relative`)}>
            {nodes.map((n) => (
              <li
                key={n.id}
                aria-current={n.state === 'current' ? 'step' : undefined}
                style={s('display: flex; flex-direction: column; align-items: center; text-align: center')}
              >
                <span aria-hidden="true" style={s(`${DOT_BASE}; margin-bottom: 14px${dotState(n.state)}`)}>
                  {markOf(n.state)}
                </span>
                <span style={s(labelCss(n.state))}>{text.label(n.id)}</span>
                <span style={s(metaCss(n.state))}>{text.meta(n.meta)}</span>
              </li>
            ))}
          </ol>
        </div>
        <ol data-tl-vert style={s(`${reset}; display: none`)}>
          {nodes.map((n, i) => (
            <li key={n.id} aria-current={n.state === 'current' ? 'step' : undefined} style={s('display: grid; grid-template-columns: 32px minmax(0, 1fr); gap: 16px')}>
              <div style={s('display: flex; flex-direction: column; align-items: center')}>
                <span aria-hidden="true" style={s(`${DOT_BASE}${dotState(n.state)}`)}>
                  {markOf(n.state)}
                </span>
                <span
                  aria-hidden="true"
                  style={s(
                    i === nodes.length - 1
                      ? 'display: none'
                      : `display: block; width: 2px; flex: 1; min-height: 22px; margin: 4px 0; background: ${n.state === 'done' ? '#3f6b4f' : 'var(--color-divider)'}`,
                  )}
                />
              </div>
              <div style={s('padding: 4px 0 18px')}>
                <span style={s(labelCss(n.state))}>{text.label(n.id)}</span>
                <span style={s(metaCss(n.state))}>{text.meta(n.meta)}</span>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

