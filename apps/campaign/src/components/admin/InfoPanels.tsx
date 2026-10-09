'use client';

import { APPLICATION_SECTIONS } from '@dpl/core';
import { s } from '@dpl/ui';
import { useLocale, useTranslations } from 'next-intl';
import { activityText } from './activity';
import { formatDateTime } from './format';
import { relTime } from './model';
import { useAgo, useIsolate } from './rowbits';
import { useAdmin } from './AdminProvider';
import type { ActivityView, AnswerView } from './types';
import { CARD, HelpTip } from './ui';

const H2 =
  "font-size:12px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:#7a5c2c;margin:0;font-family:'Manrope',system-ui,sans-serif;line-height:inherit";

/** Application: the five sections of the applicant's online form, ticked when complete. */
export function ApplicationPanel({ sections }: { sections: boolean[] }) {
  const t = useTranslations('admin');
  const done = sections.filter(Boolean).length;
  return (
    <div data-app-panel style={s(CARD)}>
      <div style={s('display:flex;align-items:baseline;gap:10px;margin-bottom:12px')}>
        <h2 style={s(H2)}>{t('app.title')}</h2>
        <span style={s('font-size:13px;color:#736d64')}>{t('app.summary', { count: done, total: APPLICATION_SECTIONS.length })}</span>
        <span style={s('margin-left:auto')}>
          <HelpTip id="app" />
        </span>
      </div>
      <ul style={s('list-style:none;margin:0;padding:0')}>
        {APPLICATION_SECTIONS.map((sec, j) => (
          <li key={sec.id} data-app-section={sec.id} data-done={sections[j] ? 'true' : 'false'} style={s('display:flex;align-items:center;gap:10px;padding:8px 0;font-size:14px')}>
            <span
              aria-hidden
              style={s(
                `width:20px;height:20px;border-radius:50%;display:grid;place-items:center;flex:none;font-size:11px;${sections[j] ? 'background:#3f6b4f;color:#fff;border:1px solid #3f6b4f' : 'border:1px solid #d8cfc0;color:transparent'}`,
              )}
            >
              {sections[j] ? '✓' : ''}
            </span>
            <span>{t(`app.sections.${sec.id}`)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Eligibility answers from the quiz, in the page language ("Not recorded" when an answer was not captured). */
export function AnswersPanel({ answers }: { answers: AnswerView[] }) {
  const t = useTranslations('admin');
  return (
    <div data-answers-panel style={s(CARD)}>
      <div style={s('display:flex;align-items:center;gap:8px;margin:0 0 14px')}>
        <h2 style={s(H2)}>{t('answers.title')}</h2>
        <span style={s('margin-left:auto')}>
          <HelpTip id="answers" />
        </span>
      </div>
      <dl style={s('margin:0')}>
        {answers.map((q) => (
          <div key={q.id} style={s('padding:7px 0;border-bottom:1px solid #f3eee6')}>
            <dt style={s('font-size:12px;color:#9a948a')}>{q.question}</dt>
            <dd style={s('font-size:14px;margin:1px 0 0')}>{q.answer ?? t('answers.notRecorded')}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/** Activity: staff actions (gold dots, with who did it) and milestones from the case record (grey dots). */
export function ActivityPanel({ activity }: { activity: ActivityView[] }) {
  const t = useTranslations('admin');
  const locale = useLocale();
  const ago = useAgo();
  const isolate = useIsolate();
  const { now } = useAdmin();
  const when = (iso: string) => (relTime(new Date(iso).getTime(), now.getTime()).kind === 'date' ? formatDateTime(iso, locale) : ago(iso, { long: true }));

  return (
    <div data-activity-panel style={s(CARD)}>
      <div style={s('display:flex;align-items:center;gap:8px;margin:0 0 14px')}>
        <h2 style={s(H2)}>{t('activity.title')}</h2>
        <span style={s('margin-left:auto')}>
          <HelpTip id="activity" />
        </span>
      </div>
      {activity.length === 0 && <div style={s('font-size:13.5px;color:#9a948a')}>{t('activity.empty')}</div>}
      <ol style={s('list-style:none;margin:0;padding:0')}>
        {activity.map((a) => (
          <li key={a.id} data-activity={a.code ?? ''} data-kind={a.kind} style={s('display:grid;grid-template-columns:14px minmax(0, 1fr) auto;gap:12px;align-items:start;padding:9px 0')}>
            <span style={s(`width:10px;height:10px;border-radius:50%;margin-top:5px;background:${a.kind === 'staff' ? '#a07a3c' : '#d8cfc0'}`)} />
            <span style={s('font-size:14px;line-height:1.45')}>
              {activityText(t, a, isolate)}
              {a.kind === 'staff' && a.actorName && <span style={s('color:#9a948a')}> · {a.actorName}</span>}
            </span>
            <span title={formatDateTime(a.createdAt, locale)} style={s('font-size:12px;color:#9a948a;white-space:nowrap')}>
              {when(a.createdAt)}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
